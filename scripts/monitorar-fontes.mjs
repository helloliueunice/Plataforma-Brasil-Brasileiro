#!/usr/bin/env node
/**
 * Monitor de editais (Fase 2).
 *
 *   node scripts/monitorar-fontes.mjs            → verifica as fontes e prepara candidatos
 *   node scripts/monitorar-fontes.mjs --aplicar  → acrescenta os candidatos aprovados ao editais.json
 *
 * O que faz a cada execução:
 *  1. Lê as páginas oficiais de data/fontes.json e encontra links de chamadas que ainda não viu.
 *  2. Para cada link novo, baixa a página (ou o PDF) e pede à IA (API da Anthropic) que extraia os
 *     dados no formato do editais.json — só fatos explícitos no documento, com trechos de evidência.
 *  3. Valida cada extração com as mesmas regras do site. Os válidos viram candidatos
 *     (data/novos-editais.json); os demais entram no relatório com o motivo.
 *  4. Confere se a página oficial dos editais ainda abertos mudou (possível retificação ou prorrogação).
 *  5. Escreve relatorio-monitor.md (corpo do pull request ou da issue) e atualiza data/monitor-estado.json.
 *
 * Nada é publicado sem revisão humana: a automação abre um pull request; publicar = fazer o merge.
 *
 * Variáveis de ambiente:
 *   ANTHROPIC_API_KEY   chave da API (sem ela, o monitor só lista os links novos para revisão manual)
 *   MODELO              modelo usado na extração (padrão: claude-sonnet-5-5)
 *   MAX_NOVOS           máximo de links novos analisados por execução (padrão: 15)
 *   ANTHROPIC_BASE_URL, MONITOR_RAIZ, HOJE   usados em testes
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RAIZ = process.env.MONITOR_RAIZ || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARQ = {
    editais: path.join(RAIZ, 'editais.json'),
    fontes: path.join(RAIZ, 'data', 'fontes.json'),
    estado: path.join(RAIZ, 'data', 'monitor-estado.json'),
    novos: path.join(RAIZ, 'data', 'novos-editais.json'),
    relatorio: path.join(RAIZ, 'relatorio-monitor.md')
};
const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const API_URL = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, '') + '/v1/messages';
const MODELO = process.env.MODELO || 'claude-sonnet-5-5';
const MAX_NOVOS = Number(process.env.MAX_NOVOS || 15);
const HOJE = process.env.HOJE || new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); // data em Brasília
const UA = 'Mozilla/5.0 (compatible; FundosBrasilMonitor/1.0; +https://github.com/helloliueunice/Plataforma-Brasil-Brasileiro)';

const PUBLICOS = ['pesquisador', 'ict', 'empresa', 'osc', 'municipio', 'estado'];
const AREAS = ['Tecnologia', 'Saúde', 'Educação', 'Meio Ambiente', 'Infraestrutura', 'Cultura', 'Agronegocio', 'Energia', 'Segurança', 'Desenvolvimento'];
const DIAGNOSTICO = process.argv.includes('--diagnostico'); // só lista os links de cada fonte, sem alterar nada
// No GitHub Actions, o resultado também vira anotação visível na página da execução
const anotar = (titulo, texto, tipo = 'notice') => {
    if (!process.env.GITHUB_ACTIONS) return;
    const e = v => String(v).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    console.log(`::${tipo} title=${e(titulo).replace(/[:,]/g, ' ')}::${e(texto.slice(0, 60000))}`);
};
const lerJSON = (f, padrao) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return padrao; } };
const gravarJSON = (f, d) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n'); };
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const isoOk = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const dataBR = iso => (isoOk(iso) ? iso.split('-').reverse().join('/') : '—');
const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
// Texto de terceiros (sites, IA) no relatório/PR: neutraliza tabelas, @menções, links, imagens e HTML
const md = s => String(s ?? '').replace(/\r?\n/g, ' ').replace(/[|@!\[\]()<>`*_]/g, c => '\\' + c);

/* ============================ Aplicar candidatos ============================ */
if (process.argv.includes('--aplicar')) {
    const base = lerJSON(ARQ.editais, null);
    const novos = lerJSON(ARQ.novos, []);
    if (!base || !novos.length) { console.log('Nada a aplicar.'); process.exit(0); }
    let id = Math.max(100, ...base.editais.map(e => Number(e.id) || 0));
    for (const n of novos) base.editais.push({ id: ++id, ...n });
    base.geradoEm = HOJE;
    gravarJSON(ARQ.editais, base);
    fs.rmSync(ARQ.novos, { force: true });
    console.log(`✅ ${novos.length} edital(is) acrescentado(s) ao editais.json`);
    process.exit(0);
}

/* ============================ Rede ============================ */
async function baixar(url, { bytes = false } = {}, salto = 0, cookies = '') {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    try {
        const headers = { 'user-agent': UA, accept: 'text/html,application/pdf;q=0.9,*/*;q=0.8' };
        if (cookies) headers.cookie = cookies;
        const r = await fetch(url, { headers, redirect: 'follow', signal: ctrl.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const tipo = r.headers.get('content-type') || '';
        if (Number(r.headers.get('content-length') || 0) > 20 * 1048576) throw new Error('arquivo maior que 20 MB');
        const buf = Buffer.from(await r.arrayBuffer());
        if (bytes || /pdf/i.test(tipo) || /\.pdf($|\?)/i.test(url)) return { tipo: 'pdf', buf, url: r.url };
        // Respeita o charset declarado (alguns portais ainda usam ISO-8859-1)
        let charset = (tipo.match(/charset=([\w-]+)/i) || [])[1];
        if (!charset) charset = (buf.subarray(0, 2048).toString('latin1').match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1];
        let html;
        try { html = new TextDecoder(charset || 'utf-8').decode(buf); } catch (_) { html = buf.toString('utf8'); }
        // Páginas de "Redirect" (meta refresh ou JavaScript), como as da FAPESP: segue até 3 saltos,
        // levando os cookies definidos pela página intermediária.
        const destino = salto < 3 && textoDoHtml(html).length < 600 && destinoRedirect(html);
        if (destino) {
            const prox = new URL(destino, r.url).href;
            const novos = (r.headers.getSetCookie ? r.headers.getSetCookie() : []).map(c => c.split(';')[0]);
            const jar = [...(cookies ? cookies.split('; ') : []), ...novos, ...cookiesDoScript(html)].filter(Boolean).join('; ');
            if (prox !== r.url || jar !== cookies) return baixar(prox, { bytes }, salto + 1, jar);
        }
        return { tipo: 'html', html, url: r.url };
    } finally { clearTimeout(t); }
}
function destinoRedirect(html) {
    // aceita content="0; URL='https://…'" (aspas simples dentro, como na FAPESP) e content="0;url=https://…"
    const meta = html.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]*content=["']\s*\d*\s*;?\s*url\s*=\s*['"]?([^"'>\s]+)/i);
    if (meta) return decod(meta[1]);
    const js = html.match(/(?:window\.|document\.|top\.)?location(?:\.href)?\s*(?:=|\.replace\(|\.assign\()\s*["']([^"']+)["']/i);
    if (js) return js[1];
    if (/<title>\s*redirect/i.test(html)) { const a = html.match(/<a[^>]+href=["']([^"']+)["']/i); if (a) return decod(a[1]); }
    return null;
}
function cookiesDoScript(html) {
    return [...html.matchAll(/document\.cookie\s*=\s*["']([^"';]+)/gi)].map(m => m[1]);
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', laquo: '«', raquo: '»', hellip: '…', deg: '°', middot: '·', bull: '•', euro: '€', ordm: 'º', ordf: 'ª', uuml: 'ü', ntilde: 'ñ', ccedil: 'ç', atilde: 'ã', otilde: 'õ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', acirc: 'â', ecirc: 'ê', ocirc: 'ô', agrave: 'à', Ccedil: 'Ç', Atilde: 'Ã', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú' };
const decod = s => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e] ?? m));

function textoDoHtml(html) {
    return decod(html
        .replace(/<(script|style|noscript|svg|nav|header|footer)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<(br|\/p|\/div|\/li|\/tr|\/h\d)[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, ' '))
        .replace(/[ \t\f\v]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

// Remove menus, cabeçalhos e rodapés antes de procurar links (é onde ficam os falsos positivos)
const BLOCOS_NAVEGACAO = /<(nav|header|footer|aside)\b[\s\S]*?<\/\1>|<(div|ul|section)\b[^>]*(?:id|class)\s*=\s*["'][^"']*\b(menu|navbar|nav|navegacao|breadcrumb|rodape|footer|header|cabecalho|sidebar|barra)\b[^"']*["'][^>]*>[\s\S]*?<\/\2>/gi;
const NUMERO_CHAMADA = /\b(n[º°o.]\s*)?\d{1,4}\s*\/\s*20\d{2}\b|\b20\d{2}\b/;
const GENERICOS = /^(chamadas?( p[uú]blicas?)?( de propostas)?|editais( abertos| encerrados)?|resultados?|programas?|bolsas?|oportunidades|saiba mais|leia mais|acesse|clique aqui|ver todos?|mais informa[cç][oõ]es)$/i;

// Um link vira candidato quando parece o título de uma chamada específica, não um item de menu
function linksDe(html, base, fonte = {}) {
    const re = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const vistos = new Map();
    const rxTexto = new RegExp(fonte.filtro || 'chamada|edital', 'i');
    const rxHref = fonte.hrefFiltro ? new RegExp(fonte.hrefFiltro, 'i') : null;
    const rxIgnorar = fonte.ignorar ? new RegExp(fonte.ignorar, 'i') : null;
    const minTexto = fonte.minTexto || 25;
    const corpo = html.replace(BLOCOS_NAVEGACAO, ' ');
    let m;
    while ((m = re.exec(corpo))) {
        let url;
        try { url = new URL(decod(m[1].trim()), base).href.replace(/#.*$/, ''); } catch (_) { continue; }
        if (!/^https?:/.test(url) || url === base) continue;
        if (/(login|facebook|twitter|linkedin|instagram|youtube|whatsapp|mailto:|\/busca|\/search|\/rss|\.(jpg|png|zip|docx?|xlsx?)($|\?))/i.test(url)) continue;
        const texto = textoDoHtml(m[2]).replace(/\s+/g, ' ').trim();
        const t = norm(texto);
        if (GENERICOS.test(t) || (rxIgnorar && (rxIgnorar.test(t) || rxIgnorar.test(url)))) continue;
        if (/\bresultados?\b|\bhomologa[cç]/.test(t) || /\/resultados?[\/_-]/i.test(url)) continue; // resultados não são chamadas abertas
        const palavras = t.split(' ').filter(Boolean).length;
        const porTexto = rxTexto.test(t) && (texto.length >= minTexto || NUMERO_CHAMADA.test(t)) && palavras >= 3;
        const porHref = rxHref && rxHref.test(url) && texto.length >= 15 && palavras >= 3;
        if (!porTexto && !porHref) continue;
        if (!vistos.has(url)) vistos.set(url, texto.slice(0, 200));
    }
    return [...vistos].map(([url, texto]) => ({ url, texto }));
}

/* ============================ Extração com IA ============================ */
const FERRAMENTA = {
    name: 'registrar_edital',
    description: 'Registra os dados de uma chamada pública de fomento extraídos do documento oficial. Use null para tudo que o documento não informa. Nunca estime nem complete com conhecimento próprio.',
    input_schema: {
        type: 'object',
        properties: {
            eh_chamada_de_fomento: { type: 'boolean', description: 'true se o documento é uma chamada/edital que seleciona propostas para receber recursos (auxílio, bolsa, subvenção, termo de fomento, prêmio em dinheiro). false para notícias genéricas, resultados, licitações de compra, concursos de emprego.' },
            motivo_descarte: { type: ['string', 'null'], description: 'Se não for chamada de fomento, ou se já tiver encerrado, explique em uma frase.' },
            numero: { type: ['string', 'null'], description: 'Identificação oficial, ex.: "Chamada CNPq nº 33/2026".' },
            titulo: { type: 'string', description: 'Título curto e claro em português, sem o número.' },
            instituicao: { type: 'string', description: 'Sigla da instituição financiadora principal, ex.: CNPq, FAPESP, FINEP, MinC.' },
            tema: { type: 'string', enum: AREAS },
            tags: { type: 'array', items: { type: 'string' }, maxItems: 6 },
            modalidade: { type: 'string', description: 'Ex.: Auxílio à pesquisa, Bolsa, Bolsas, Subvenção econômica, Não reembolsável, Termo de fomento, Prêmio.' },
            publico: { type: 'array', items: { type: 'string', enum: PUBLICOS }, minItems: 1, description: 'Quem pode SUBMETER a proposta (não os beneficiários finais).' },
            abrangencia: { type: 'string', description: '"Nacional", uma região ou o nome de um estado.' },
            ufs: { type: ['array', 'null'], items: { type: 'string' }, description: 'Siglas das UFs elegíveis, se a abrangência for restrita.' },
            procedencia: { type: 'string', enum: ['nacional', 'internacional'] },
            moeda: { type: 'string', enum: ['BRL', 'USD', 'EUR'] },
            valorMax: { type: ['number', 'null'], description: 'Valor máximo por proposta, em unidades da moeda. null se não houver teto (ex.: só bolsas).' },
            valorTotal: { type: ['number', 'null'], description: 'Orçamento total da chamada.' },
            valorNota: { type: ['string', 'null'], description: 'Faixas, linhas, duração e o que é financiado, em até 2 frases. Obrigatório se valorMax for null.' },
            contrapartida: { type: ['string', 'null'] },
            publicadoEm: { type: ['string', 'null'], description: 'AAAA-MM-DD' },
            abertura: { type: ['string', 'null'], description: 'Início das submissões, AAAA-MM-DD. Se não houver, use a data de publicação.' },
            encerramento: { type: ['string', 'null'], description: 'Prazo final da PRIMEIRA etapa que o proponente precisa cumprir (ex.: pré-proposta), AAAA-MM-DD.' },
            resultado: { type: ['string', 'null'], description: 'Data do resultado final, AAAA-MM-DD, se houver data exata.' },
            prazoNota: { type: ['string', 'null'], description: 'Horário limite, etapas seguintes, cadastro prévio exigido etc., em até 2 frases.' },
            resumo: { type: 'string', description: 'Objetivo, linhas e principais requisitos de elegibilidade, em 2 a 4 frases, linguagem simples.' },
            link: { type: ['string', 'null'], description: 'Endereço da página ou documento oficial da chamada.' },
            criterios: { type: ['array', 'null'], items: { type: 'object', properties: { nome: { type: 'string' }, peso: { type: ['number', 'null'], description: 'Peso em % (0 a 100). null se não informado.' } }, required: ['nome'] } },
            docsExtras: { type: 'array', items: { type: 'string' }, maxItems: 6, description: 'Documentos ou requisitos específicos desta chamada.' },
            evidencias: { type: 'array', items: { type: 'string' }, maxItems: 5, description: 'Trechos literais curtos do documento que comprovam prazo, valor e elegibilidade.' },
            confianca: { type: 'string', enum: ['alta', 'media', 'baixa'] },
            alertas: { type: 'array', items: { type: 'string' }, description: 'Dúvidas e ambiguidades para o revisor humano.' }
        },
        required: ['eh_chamada_de_fomento', 'titulo', 'instituicao', 'tema', 'modalidade', 'publico', 'abrangencia', 'procedencia', 'moeda', 'resumo', 'evidencias', 'confianca', 'alertas']
    }
};

const SISTEMA = `Você é especialista em editais de fomento no Brasil (FAPs, CNPq, CAPES, Finep, ministérios, fundos e financiadores internacionais) e extrai dados de chamadas públicas com rigor de auditor.
Regras:
- Hoje é ${HOJE}. Use somente informações explícitas no documento; quando algo não estiver escrito, use null e registre em "alertas".
- Datas em AAAA-MM-DD. Valores numéricos em unidades (R$ 1,5 milhão = 1500000).
- "publico" indica quem SUBMETE: pesquisador (pessoa física pesquisadora/docente), ict (universidade, instituto de pesquisa, proposta institucional), empresa, osc (associação, fundação, cooperativa, OSC), municipio, estado.
- Se o prazo final já passou ou o documento é resultado/retificação sem chamada aberta, marque eh_chamada_de_fomento=false e explique em motivo_descarte.
- "evidencias" deve citar literalmente os trechos de prazo, valor e elegibilidade.
- Escreva em português claro, sem jargão desnecessário.`;

async function extrair(item, conteudo) {
    const blocos = conteudo.tipo === 'pdf'
        ? [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: conteudo.buf.toString('base64') } }]
        : [{ type: 'text', text: `Conteúdo da página (texto extraído do HTML):\n\n${textoDoHtml(conteudo.html).slice(0, 60000)}` }];
    blocos.push({ type: 'text', text: `Endereço: ${conteudo.url}\nTexto do link na página de origem: "${item.texto}"\nFonte: ${item.fonteNome}\n\nRegistre os dados desta chamada com a ferramenta registrar_edital.` });

    // Modelos recentes não aceitam forçar a ferramenta (tool_choice "tool"/"any"): usamos "auto"
    // e, se a resposta vier em texto, pedimos de novo que registre os dados com a ferramenta.
    const mensagens = [{ role: 'user', content: blocos }];
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
        const r = await fetch(API_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
            signal: AbortSignal.timeout(180000),
            body: JSON.stringify({
                model: MODELO, max_tokens: 8000, system: SISTEMA,
                tools: [FERRAMENTA], tool_choice: { type: 'auto' },
                messages: mensagens
            })
        });
        if (r.status === 429 || r.status >= 500) { await new Promise(ok => setTimeout(ok, 4000 * tentativa)); continue; }
        if (!r.ok) throw new Error(`API ${r.status}: ${(await r.text()).slice(0, 300)}`);
        const resp = await r.json();
        const uso = (resp.content || []).find(c => c.type === 'tool_use' && c.name === FERRAMENTA.name);
        if (uso) return uso.input;
        mensagens.push({ role: 'assistant', content: resp.content && resp.content.length ? resp.content : [{ type: 'text', text: '(sem resposta)' }] });
        mensagens.push({ role: 'user', content: [{ type: 'text', text: 'Registre agora os dados desta chamada usando a ferramenta registrar_edital (se não for chamada de fomento aberta, use eh_chamada_de_fomento=false).' }] });
    }
    throw new Error('A IA não retornou os dados estruturados');
}

/* ============================ Validação (mesmas regras do site) ============================ */
function validar(x, base) {
    const erros = [];
    if (!x.titulo) erros.push('sem título');
    if (!x.instituicao) erros.push('sem instituição');
    if (!Array.isArray(x.publico) || !x.publico.length || x.publico.some(p => !PUBLICOS.includes(p))) erros.push('público inválido');
    if (!isoOk(x.abertura)) erros.push('data de abertura ausente');
    if (!isoOk(x.encerramento)) erros.push('prazo final ausente');
    if (isoOk(x.abertura) && isoOk(x.encerramento) && x.encerramento < x.abertura) erros.push('prazo anterior à abertura');
    if (isoOk(x.encerramento) && x.encerramento < HOJE) erros.push(`prazo já encerrado (${dataBR(x.encerramento)})`);
    if (!(Number(x.valorMax) > 0) && !x.valorNota) erros.push('sem valor por proposta nem observação de valores');
    if (!/^https?:\/\//.test(String(x.link || ''))) erros.push('sem link oficial');
    if (!AREAS.includes(x.tema)) erros.push('área inválida');
    const chave = e => norm(`${e.instituicao} ${e.numero || e.titulo}`);
    const dup = base.find(e => (x.link && (e.link === x.link || e.fonte === x.link)) || (x.numero && e.numero && chave(e) === chave(x)));
    if (dup) erros.push(`duplicado de “${dup.titulo}” (id ${dup.id})`);
    return erros;
}

function paraEdital(x, item) {
    const e = {
        numero: x.numero || undefined, titulo: x.titulo, instituicao: x.instituicao,
        agencia: item.agencia || undefined, procedencia: x.procedencia, tema: x.tema, tags: x.tags || [],
        modalidade: x.modalidade, publico: x.publico, abrangencia: x.abrangencia || 'Nacional',
        ufs: Array.isArray(x.ufs) && x.ufs.length ? x.ufs : undefined, moeda: x.moeda || 'BRL',
        valorMax: Number(x.valorMax) > 0 ? Number(x.valorMax) : null, valorTotal: Number(x.valorTotal) > 0 ? Number(x.valorTotal) : undefined,
        valorNota: x.valorNota || undefined, contrapartida: x.contrapartida || 'Não informada',
        publicadoEm: isoOk(x.publicadoEm) ? x.publicadoEm : x.abertura, abertura: x.abertura, encerramento: x.encerramento,
        resultado: isoOk(x.resultado) ? x.resultado : undefined, prazoNota: x.prazoNota || undefined,
        resumo: x.resumo, link: x.link, fonte: item.url, verificadoEm: HOJE,
        criterios: Array.isArray(x.criterios) && x.criterios.length ? x.criterios.map(c => ({ nome: c.nome, peso: Number.isFinite(c.peso) ? c.peso : null })) : undefined,
        docsExtras: x.docsExtras || []
    };
    return JSON.parse(JSON.stringify(e)); // remove campos undefined
}

/* ============================ Execução ============================ */
const base = lerJSON(ARQ.editais, { editais: [] });
const fontes = (lerJSON(ARQ.fontes, { fontes: [] }).fontes || []).filter(f => f.ativo !== false);
const estado = lerJSON(ARQ.estado, { vistos: {}, paginas: {}, execucoes: [] });
estado.vistos ||= {}; estado.paginas ||= {}; estado.execucoes ||= [];
// Links listados em modo manual (sem chave) voltam para a fila quando a chave passa a existir
const pendente = url => { const v = estado.vistos[url]; return !v || v.resultado === 'erro' || (API_KEY && v.resultado === 'manual'); };
const conhecidos = new Set(base.editais.flatMap(e => [e.link, e.fonte]).filter(Boolean));

const rel = { candidatos: [], descartados: [], manuais: [], mudancas: [], falhasFonte: [], erros: [], adiados: 0 };

// Sugestão avulsa (formulário "Sugerir edital"): analisa só o link enviado
const SUGESTAO = process.argv.includes('--url') ? String(process.env.SUGESTAO_URL || '').trim() : '';
if (process.argv.includes('--url') && !/^https?:\/\/[^\s]+$/i.test(SUGESTAO)) {
    fs.writeFileSync(ARQ.relatorio, 'Não encontramos um link válido (começando com http:// ou https://) na sugestão. Edite a issue e informe o endereço da chamada oficial.\n');
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'candidatos=0\nrevisar=1\n');
    console.log('Sugestão sem link válido.');
    process.exit(0);
}

// 1. Fontes → links novos
const fila = [];
if (SUGESTAO) fila.push({ url: SUGESTAO, texto: 'Sugestão enviada pelo formulário', fonteId: 'sugestao', fonteNome: 'Sugestão de usuário' });
for (const f of (SUGESTAO ? [] : fontes)) {
    try {
        const pg = await baixar(f.url);
        if (pg.tipo !== 'html') throw new Error('a fonte não é uma página HTML');
        const links = linksDe(pg.html, pg.url, f);
        if (DIAGNOSTICO) {
            const lista = links.map(l => `${estado.vistos[l.url] ? '·' : conhecidos.has(l.url) ? '=' : '+'} ${l.texto}  <${l.url}>`);
            console.log(`\n## ${f.nome}\n${f.url} → ${links.length} link(s)\n${lista.map(x => '  ' + x).join('\n')}`);
            anotar(`${f.nome}: ${links.length} link(s)`, [f.url, ...lista].join('\n'));
            // Amostra: como chega a página do primeiro link (ajuda a ver redirecionamentos e bloqueios)
            if (links[0]) {
                try {
                    const c = await baixar(links[0].url);
                    const bruto = c.tipo === 'pdf' ? `[PDF, ${c.buf.length} bytes]` : c.html.slice(0, 2500);
                    anotar(`Amostra ${f.nome}`, `Pedido: ${links[0].url}\nURL final: ${c.url}\nTexto: ${c.tipo === 'pdf' ? '-' : textoDoHtml(c.html).slice(0, 300)}\n---\n${bruto}`);
                } catch (e) { anotar(`Amostra ${f.nome}`, `${links[0].url}: ${e.message}`, 'warning'); }
            }
            continue;
        }
        if (!links.length) rel.falhasFonte.push({ fonte: f.nome, url: f.url, erro: 'nenhum link de chamada encontrado (o layout pode ter mudado)' });
        for (const l of links) if (pendente(l.url) && !conhecidos.has(l.url)) fila.push({ ...l, fonteId: f.id, fonteNome: f.nome, agencia: f.agencia });
    } catch (err) {
        rel.falhasFonte.push({ fonte: f.nome, url: f.url, erro: err.message });
    }
}

if (DIAGNOSTICO) {
    for (const f of rel.falhasFonte) { console.log(`\n⚠️ ${f.fonte}: ${f.erro}`); anotar(`Falha: ${f.fonte}`, `${f.url}\n${f.erro}`, 'warning'); }
    console.log('\nLegenda: + novo · já visto · = já está na base');
    process.exit(0);
}

anotar(API_KEY ? 'Chave da API encontrada' : 'Chave da API não encontrada',
    API_KEY ? 'Extração com IA ativa.' : 'O segredo ANTHROPIC_API_KEY não chegou ao workflow: confira o nome exato em Settings → Secrets and variables → Actions → aba Secrets (Repository secrets). Os links ficam para revisão manual.',
    API_KEY ? 'notice' : 'warning');

// 2. Links novos → extração e validação
const lote = fila.slice(0, MAX_NOVOS);
rel.adiados = fila.length - lote.length;
const novos = [];
for (const item of lote) {
    if (!API_KEY) { rel.manuais.push(item); estado.vistos[item.url] = { em: HOJE, fonte: item.fonteId, resultado: 'manual' }; continue; }
    try {
        const conteudo = await baixar(item.url);
        if (conteudo.tipo === 'pdf' && conteudo.buf.length > 20 * 1048576) throw new Error('PDF maior que 20 MB');
        const x = await extrair(item, conteudo);
        const dominio = u => { try { return new URL(u).hostname.split('.').slice(-2).join('.'); } catch (_) { return ''; } };
        if (!/^https:?\/\//.test(String(x.link || '')) || dominio(x.link) !== dominio(item.url)) {
            if (x.link && dominio(x.link) !== dominio(item.url)) (x.alertas ||= []).push(`A IA indicou um link de outro domínio (${x.link}); usamos a página oficial lida.`);
            x.link = item.url;
        }
        if (!x.eh_chamada_de_fomento) {
            rel.descartados.push({ item, motivo: x.motivo_descarte || 'não é chamada de fomento' });
            estado.vistos[item.url] = { em: HOJE, fonte: item.fonteId, resultado: 'descartado' };
            continue;
        }
        const erros = validar(x, [...base.editais, ...novos]);
        if (erros.length) {
            rel.descartados.push({ item, motivo: erros.join('; '), extraido: x });
            estado.vistos[item.url] = { em: HOJE, fonte: item.fonteId, resultado: 'invalido' };
            continue;
        }
        const ed = paraEdital(x, item);
        novos.push(ed);
        rel.candidatos.push({ ed, x, item });
        estado.vistos[item.url] = { em: HOJE, fonte: item.fonteId, resultado: 'candidato' };
    } catch (err) {
        // Tenta de novo nas próximas execuções, até 3 vezes (evita gasto repetido com erro permanente)
        const ant = estado.vistos[item.url];
        const tentativas = (ant && ant.resultado === 'erro' ? ant.tentativas || 1 : 0) + 1;
        if (tentativas >= 3) estado.vistos[item.url] = { em: HOJE, fonte: item.fonteId, resultado: 'erro-definitivo', erro: err.message.slice(0, 200) };
        else estado.vistos[item.url] = { em: HOJE, fonte: item.fonteId, resultado: 'erro', tentativas };
        rel.erros.push({ item, erro: err.message + (tentativas >= 3 ? ' — desistimos após 3 tentativas' : ' — será tentado de novo') });
    }
}

// 3. Mudanças nas páginas oficiais dos editais ainda abertos ou previstos
for (const e of (SUGESTAO ? [] : base.editais.filter(e => e.encerramento >= HOJE))) {
    const url = e.link;
    if (!url) continue;
    try {
        const pg = await baixar(url, { bytes: /\.pdf($|\?)/i.test(url) });
        const assinatura = pg.tipo === 'pdf' ? hash(pg.buf) : hash(textoDoHtml(pg.html).replace(/\d{2}:\d{2}(:\d{2})?/g, ''));
        const antes = estado.paginas[url];
        if (antes && antes.hash !== assinatura) rel.mudancas.push({ e, desde: antes.em });
        estado.paginas[url] = { hash: assinatura, em: antes && antes.hash === assinatura ? antes.em : HOJE };
    } catch (err) {
        rel.falhasFonte.push({ fonte: `Página oficial de “${e.titulo}”`, url, erro: err.message });
    }
}

/* ============================ Saídas ============================ */
if (novos.length) gravarJSON(ARQ.novos, novos); else fs.rmSync(ARQ.novos, { force: true });
estado.execucoes = [{ em: HOJE, fontes: fontes.length, linksNovos: fila.length, candidatos: novos.length, descartados: rel.descartados.length, erros: rel.erros.length + rel.falhasFonte.length }, ...estado.execucoes].slice(0, 30);
gravarJSON(ARQ.estado, estado);

const linhas = [];
if (SUGESTAO) {
    linhas.push(`# Análise da sugestão — ${dataBR(HOJE)}`, '', `Link analisado: ${SUGESTAO}`, '');
} else {
    linhas.push(`# Monitor de editais — ${dataBR(HOJE)}`, '');
    linhas.push(`Fontes verificadas: **${fontes.length}** · links novos: **${fila.length}**${rel.adiados ? ` (${rel.adiados} ficam para a próxima execução)` : ''} · candidatos: **${novos.length}**`, '');
}
if (!API_KEY) linhas.push('> ⚠️ Sem `ANTHROPIC_API_KEY` configurada: os links novos estão listados para revisão manual, sem extração automática.', '');
if (rel.candidatos.length) {
    linhas.push('## ✅ Candidatos incluídos neste pull request', '', 'Revise cada um no documento oficial antes do merge. Para corrigir, edite o `editais.json` neste branch; para descartar, apague o item.', '');
    for (const { ed, x } of rel.candidatos) {
        linhas.push(`### ${ed.titulo}`, '');
        linhas.push(`| Campo | Valor |`, `|---|---|`);
        linhas.push(`| Chamada | ${md(ed.numero || '—')} · ${md(ed.instituicao)} |`);
        linhas.push(`| Prazo | ${dataBR(ed.abertura)} a **${dataBR(ed.encerramento)}**${ed.prazoNota ? ` — ${md(ed.prazoNota)}` : ''} |`);
        linhas.push(`| Valor | ${ed.valorMax ? `até ${ed.valorMax.toLocaleString('pt-BR')} ${ed.moeda}` : '—'}${ed.valorNota ? ` — ${md(ed.valorNota)}` : ''} |`);
        linhas.push(`| Quem submete | ${ed.publico.join(', ')} · ${md(ed.abrangencia)} |`);
        linhas.push(`| Fonte | ${ed.fonte} |`);
        linhas.push(`| Confiança da IA | ${x.confianca} |`, '');
        if (x.evidencias?.length) linhas.push('**Evidências:**', ...x.evidencias.map(t => `> ${md(t)}`), '');
        if (x.alertas?.length) linhas.push('**Pontos para conferir:**', ...x.alertas.map(t => `- ${md(t)}`), '');
    }
}
if (rel.mudancas.length) {
    linhas.push('## 🔁 Páginas oficiais que mudaram (possível retificação ou prorrogação)', '');
    for (const { e } of rel.mudancas) linhas.push(`- [ ] **${md(e.titulo)}** (prazo atual ${dataBR(e.encerramento)}) — ${e.link}`);
    linhas.push('');
}
if (rel.manuais.length) {
    linhas.push('## 🔎 Links novos para revisão manual', '');
    for (const m of rel.manuais) linhas.push(`- [ ] ${md(m.texto)} — ${m.url} _(${md(m.fonteNome)})_`);
    linhas.push('');
}
if (rel.descartados.length && SUGESTAO) {
    linhas.push('## Não foi possível publicar automaticamente', '');
    for (const d of rel.descartados) linhas.push(`- **Motivo:** ${md(d.motivo)}`);
    linhas.push('', 'Publicamos chamadas de fomento com inscrições abertas ou previstas, com prazo, valor ou condições e link oficial identificáveis.', '');
} else if (rel.descartados.length) {
    linhas.push('<details><summary>🗂️ Itens descartados automaticamente (' + rel.descartados.length + ')</summary>', '');
    for (const d of rel.descartados) linhas.push(`- ${md(d.item.texto)} — ${d.item.url}: ${md(d.motivo)}`);
    linhas.push('', '</details>', '');
}
if (rel.falhasFonte.length || rel.erros.length) {
    linhas.push('## ⚠️ Falhas', '');
    for (const f of rel.falhasFonte) linhas.push(`- ${md(f.fonte)} (${f.url}): ${md(f.erro)}`);
    for (const f of rel.erros) linhas.push(`- ${md(f.item.texto)} (${f.item.url}): ${md(f.erro)}`);
    linhas.push('');
}
const temItens = rel.candidatos.length || rel.mudancas.length || rel.manuais.length || rel.falhasFonte.length || rel.erros.length || (SUGESTAO && rel.descartados.length);
if (!temItens) linhas.push(SUGESTAO ? 'A análise não retornou resultado.' : 'Nenhuma novidade hoje.');
fs.writeFileSync(ARQ.relatorio, linhas.join('\n') + '\n');

console.log(`${SUGESTAO ? 'Sugestão' : `Fontes: ${fontes.length}`} · links novos: ${fila.length} · candidatos: ${novos.length} · descartados: ${rel.descartados.length} · mudanças: ${rel.mudancas.length} · falhas: ${rel.falhasFonte.length + rel.erros.length}`);
// Sinaliza ao workflow o que fazer
if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `candidatos=${novos.length}\nrevisar=${temItens ? 1 : 0}\n`);
}
