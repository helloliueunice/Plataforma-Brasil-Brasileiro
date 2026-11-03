#!/usr/bin/env node
/**
 * Gera páginas estáticas e indexáveis a partir de editais.json:
 *   editais/            lista de todos os editais
 *   editais/<slug>/     uma página por edital (SEO, Open Graph, JSON-LD)
 *   instituicoes/       lista de instituições
 *   instituicoes/<id>/  uma página por instituição
 *   sitemap.xml, robots.txt, 404.html
 * e atualiza as metatags da página inicial (entre <!-- seo:inicio --> e <!-- seo:fim -->).
 *
 * Uso: node scripts/gerar-paginas.mjs
 * Endereço do site: variável SITE_URL, ou arquivo CNAME (domínio próprio),
 * ou o padrão do GitHub Pages abaixo.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { GUIAS, PUBLICOS_HUB, ESQUEMA_CAMPOS, GLOSSARIO_SIMPLES, PUBLICO_SIMPLES, SIGLAS_PAGINA } from './conteudo.mjs';
import { rss, calendario, comparar, semanaISO, somaDias } from './feeds.mjs';
import { patrocinioAtivo, textoSelo, escolherVaga } from './patrocinio.mjs';
import { brCodePix, normalizarChavePix } from './pix.mjs';
import { qrSvg } from './qrcode.mjs';
import { tituloLegivel } from './transferegov-normaliza.mjs';
import { atualizarArquivo } from './arquivo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PADRAO = 'https://helloliueunice.github.io/Plataforma-Brasil-Brasileiro';
const cname = fs.existsSync(path.join(RAIZ, 'CNAME')) ? fs.readFileSync(path.join(RAIZ, 'CNAME'), 'utf8').trim() : '';
const SITE = (process.env.SITE_URL || (cname ? `https://${cname}` : PADRAO)).replace(/\/+$/, '');
const cfg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'site.json'), 'utf8'));
const NOME = cfg.nome || 'Capta Brasil';
const REPO = 'https://github.com/helloliueunice/Plataforma-Brasil-Brasileiro';

/* ---------- Dados: reaproveita o bloco de configuração do index.html ---------- */
const indexPath = path.join(RAIZ, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');
const ini = indexHtml.indexOf('        const COTACAO_REF');
const fim = indexHtml.indexOf('        // Completa cada edital');
if (ini < 0 || fim < 0) throw new Error('Bloco de dados não encontrado no index.html');
const ctx = vm.runInNewContext(
    indexHtml.slice(ini, fim) + '\n;({ COTACAO_REF, AREAS, PUBLICOS, UFS, REGIOES_UF, DOCS_POR_PUBLICO, DOCS_COMUNS, CRITERIOS_PADRAO, agencias, projetos, EDITAIS_BASE })'
);
const { COTACAO_REF, AREAS, PUBLICOS, UFS, REGIOES_UF, DOCS_POR_PUBLICO, DOCS_COMUNS, CRITERIOS_PADRAO, agencias } = ctx;
// Glossário: o mesmo usado na plataforma (definido mais abaixo no index.html)
const mGloss = indexHtml.match(/const GLOSSARIO = (\[[\s\S]*?\n        \]);/);
if (!mGloss) throw new Error('GLOSSARIO não encontrado no index.html');
const GLOSSARIO_INDEX = vm.runInNewContext(mGloss[1]);
// Nas páginas estáticas, as definições em linguagem simples de scripts/conteudo.mjs substituem as de mesmo termo
// (a ordem do index.html é mantida) e os termos novos entram no fim.
const GLOSSARIO = (() => {
    const chave = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const novos = new Map(GLOSSARIO_SIMPLES.map(g => [chave(g.termo), g]));
    const lista = GLOSSARIO_INDEX.map(g => { const n = novos.get(chave(g.termo)); if (n) novos.delete(chave(g.termo)); return n ? { ...g, def: n.def } : g; });
    return [...lista, ...novos.values()];
})();

const fonte = JSON.parse(fs.readFileSync(path.join(RAIZ, 'editais.json'), 'utf8'));
const brutos = Array.isArray(fonte) ? fonte : fonte.editais || [];
const demonstrativo = !Array.isArray(fonte) && !!fonte.demonstrativo;
// Programas federais abertos lidos da API do Transferegov (scripts/transferegov.mjs): dados oficiais,
// atualizados todo dia, mantidos fora do editais.json curado. IDs a partir de 1.000.000.
const arqTG = path.join(RAIZ, 'data', 'transferegov.json');
const brutosTG = fs.existsSync(arqTG) ? (JSON.parse(fs.readFileSync(arqTG, 'utf8')).editais || []).filter(r => Number(r.id) >= 1000000) : [];
const geradoEm = (!Array.isArray(fonte) && fonte.geradoEm) || new Date().toISOString().slice(0, 10);

/* ---------- Utilitários ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// Mesma regra de slugEdital() no index.html
// Até 70 caracteres, sem cortar palavra no meio
const slugify = s => { const b = norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); if (b.length <= 70) return b; const c = b.slice(0, 71); return c.slice(0, c.lastIndexOf('-')); };
const slugEdital = e => `${slugify(e.titulo)}-${e.id}`;
const isoOk = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const data = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const valor = (v, moeda = 'BRL') => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda, notation: 'compact', maximumFractionDigits: 1 }).format(v);
const temValor = e => Number(e.valorMax) > 0;
// Linguagem simples (Lei 15.263/2025): sem "ver condições"; diz onde está a informação que falta
const valorTxt = e => (temValor(e) ? `até ${valor(e.valorMax, e.moeda)}` : e.tipoValor === 'total' && Number(e.valorTotal) > 0 ? `total de ${valor(e.valorTotal, e.moeda)} no edital` : e.origem === 'transferegov' ? 'valor não informado pela fonte' : /bolsa/i.test(e.modalidade) ? 'bolsas: valores no edital oficial' : 'valor: veja no edital oficial');
const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
const corta = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');
// "Hoje" no fuso de Brasília (o workflow roda em UTC; depois das 21h já seria o dia seguinte)
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const statusEm = (e, dia = hoje) => (dia < e.abertura ? 'em-breve' : dia <= e.encerramento ? 'aberto' : 'fechado');
const ROTULO = { aberto: 'Inscrições abertas', 'em-breve': 'Em breve', fechado: 'Encerrado' };
const mesAno = new Date(`${hoje}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());
// Destaque patrocinado (regras em scripts/patrocinio.mjs): período, chamada não encerrada e vagas contratadas
const patrocinado = (e, vaga) => patrocinioAtivo(e, hoje, vaga);
// Imagem de prévia própria do edital (gerada por scripts/gerar-imagens.mjs), se existir
const ogDoEdital = e => { const f = `assets/og/edital-${e.id}.jpg`; return fs.existsSync(path.join(RAIZ, f)) ? `${SITE}/${f}` : null; };

/* ---------- Medição e verificação (data/site.json) ---------- */
const headExtras = () => [
    cfg.googleVerificacao ? `<meta name="google-site-verification" content="${esc(cfg.googleVerificacao)}">` : '',
    cfg.bingVerificacao ? `<meta name="msvalidate.01" content="${esc(cfg.bingVerificacao)}">` : '',
    cfg.analytics?.goatcounter ? `<script data-goatcounter="https://${esc(cfg.analytics.goatcounter)}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>` : '',
    cfg.analytics?.ga4 ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(cfg.analytics.ga4)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(cfg.analytics.ga4)}');</script>` : ''
].filter(Boolean).join('\n    ');
// Eventos do funil: qualquer elemento com data-evento conta um clique
// (vários eventos separados por espaço: "patrocinio-clique patrocinio-12")
const SCRIPT_EVENTOS = `document.addEventListener('click',function(ev){var a=ev.target.closest&&ev.target.closest('[data-evento]');if(!a)return;a.getAttribute('data-evento').split(' ').forEach(function(n){if(!n)return;try{if(window.goatcounter&&goatcounter.count)goatcounter.count({path:'evento/'+n,title:n,event:true});if(window.gtag)gtag('event',n)}catch(e){}})});`;

// Alguma forma de apoio configurada? (senão /apoie/ mostra "em breve")
const pixCfg = cfg.apoio?.pix || {};
// Trava de integridade: no GitHub, a chave do data/site.json precisa ser igual à variável PIX_CHAVE
// (definida pela dona em Settings → Variables). Um commit que troque a chave sozinho não publica.
if (process.env.PIX_CHAVE && normalizarChavePix(pixCfg.chave) !== normalizarChavePix(process.env.PIX_CHAVE)) {
    console.error('ERRO: a chave Pix de data/site.json é diferente da variável PIX_CHAVE do repositório. Publicação interrompida.');
    process.exit(1);
}
const contatoHref = cfg.contato ? (/^https?:/.test(cfg.contato) ? cfg.contato : `mailto:${cfg.contato}`) : `${REPO}/issues/new?template=parceria.yml`;
const apoioConfigurado = !!(pixCfg.chave || cfg.apoio?.apoiase || cfg.apoio?.url);

// Só links https:// sem espaços, aspas ou sinais de tag (bloqueia javascript:, data: e quebras de linha).
function linkSeguro(u) { const t = String(u || '').trim(); return /^https:\/\/[^\s"'<>`]+$/i.test(t) ? t : ''; }

// Formulários externos (data/site.json → formularios): preenchido = botão para o formulário; vazio = fluxo atual (e-mail montado)
const formularioExterno = k => linkSeguro(cfg.formularios?.[k]);
// Nome do serviço que hospeda o formulário (Privacidade)
const servicoDoFormulario = u => { const h = (() => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } })();
    return /(^|\.)(forms\.gle|docs\.google\.com|forms\.google\.com)$/.test(h) ? 'Google Forms' : /(^|\.)tally\.so$/.test(h) ? 'Tally' : /(^|\.)buttondown\.(email|com)$/.test(h) ? 'Buttondown' : h; };

// Programas do Transferegov: nome sem códigos crus no início (e.titulo continua igual: gera o slug)
const legivel = e => (e.origem === 'transferegov' ? tituloLegivel(e.titulo) : { nome: e.titulo, codigo: '' });
const nomeEdital = e => legivel(e).nome;
const numeroEdital = e => [e.numero, legivel(e).codigo].filter(Boolean).join(' · ');

/* ---------- Linguagem simples: abrangência, modalidade, siglas e checklist ---------- */
// Abrangência não confirmada pela fonte (Transferegov): nunca vira "Nacional"; mostra a UF do cadastro como pista
const ABR_NAO_INFORMADA = 'Não informada';
const abrangenciaNaoInformada = e => e.abrangencia === ABR_NAO_INFORMADA;
const abrangenciaTxt = e => (abrangenciaNaoInformada(e) ? `não informada${e.ufCadastro ? ` (cadastro: ${e.ufCadastro})` : ''}` : e.abrangencia);
const abrangenciaRotulo = e => (abrangenciaNaoInformada(e) ? `Abrangência: ${abrangenciaTxt(e)}` : e.abrangencia);
// Onde vale, em frase simples (bloco "Posso concorrer?")
const ondeTxt = e => (e.abrangencia === 'Nacional' ? 'todo o Brasil'
    : abrangenciaNaoInformada(e) ? (e.ufCadastro ? `${UFS[e.ufCadastro] || e.ufCadastro} (a confirmar)` : 'não informado (a confirmar)')
    : e.abrangencia);
// Selo de procedência: "Nacional" só quando vale para todo o país; Transferegov é "Federal"; o resto mostra onde vale
const seloProcedencia = e => (e.procedencia === 'internacional' ? ['internacional', 'Internacional']
    : e.origem === 'transferegov' ? ['nacional', 'Federal']
    : e.abrangencia === 'Nacional' ? ['nacional', 'Nacional']
    : ['neutro', e.abrangencia]);
// Modalidades do MROSC em palavras do dia a dia (o nome técnico fica no title e no glossário)
const modalidadeTxt = m => (/termo de colabora[cç][aã]o/i.test(m || '') ? 'Parceria com o governo (ideia do governo)'
    : /termo de fomento/i.test(m || '') ? 'Parceria com o governo (ideia da ONG)' : m);
const modalidadeAncora = m => (/termo de colabora[cç][aã]o/i.test(m || '') ? 'termo-de-colaboracao' : /termo de fomento/i.test(m || '') ? 'termo-de-fomento' : '');
const seloModalidade = e => `<span class="selo neutro"${modalidadeTxt(e.modalidade) !== e.modalidade ? ` title="${esc(e.modalidade)}"` : ''}>${esc(modalidadeTxt(e.modalidade))}</span>`;
const quemPodePedir = e => { const l = e.publico.map(p => PUBLICO_SIMPLES[p] || PUBLICOS[p] || p); const t = l.length > 1 ? `${l.slice(0, -1).join(', ')} ou ${l[l.length - 1]}` : l[0] || ''; return t.charAt(0).toUpperCase() + t.slice(1); };
// Siglas: na primeira vez em cada página, link para o glossário e nome completo. Recebe texto puro; devolve HTML escapado.
function criaSiglas(rel) {
    const vistas = new Set();
    return texto => {
        let h = esc(texto);
        for (const [sg, nome, anc] of SIGLAS_PAGINA) {
            const chave = anc || sg;
            if (vistas.has(chave)) continue;
            const m = h.match(new RegExp(`(^|[^\\p{L}\\d/#-])${sg}(?![\\p{L}\\d])`, 'u'));
            if (!m) continue;
            const pos = m.index + m[1].length, depois = h.slice(pos + sg.length);
            const jaExplica = h.includes(esc(nome));
            // Seguida de outro parêntese ("CNPJ (MROSC)"): só o link com o nome no title; o nome completo vai na próxima ocorrência
            const adiar = !jaExplica && /^\s*\(/.test(depois);
            if (!adiar) vistas.add(chave);
            const marca = anc ? `<a href="${rel}glossario/#${anc}" data-evento="glossario-abrir"${adiar ? ` title="${esc(nome)}"` : ''}>${sg}</a>` : sg;
            if (adiar) { h = h.slice(0, pos) + marca + depois; continue; }
            // Dentro de parênteses, "(MROSC, nome completo)" em vez de parênteses aninhados
            const dentro = h[pos - 1] === '(' && depois[0] === ')';
            h = h.slice(0, pos) + marca + (jaExplica ? '' : dentro ? `, ${esc(nome)}` : ` (${esc(nome)})`) + depois;
        }
        return h;
    };
}
// Checklist: sem itens repetidos (ex.: dois itens de CAUC) e sem o que não vale para o público
// (CAUC só para prefeituras, estados e DF; OSC não recebe CAUC).
function documentosDe(e) {
    const ente = e.publico.some(p => p === 'municipio' || p === 'estado');
    const vistos = new Set(), out = [];
    for (const d of e.documentos) {
        const cauc = /\bCAUC\b/.test(d);
        if (cauc && !ente) continue;
        const k = cauc ? 'cauc' : norm(d).replace(/[^a-z0-9]+/g, ' ').trim();
        if (vistos.has(k)) continue;
        vistos.add(k); out.push(d);
    }
    return out;
}

// De onde veio o dado e quanto confiar: curadoria humana ("conferido") ou leitura automática (Transferegov).
function origemHTML(e) {
    if (e.origem === 'transferegov') return `<p class="nota aviso-auto" id="origem"><strong>Leitura automática, sem revisão humana.</strong> Dados lidos da API pública do Transferegov${e.verificadoEm ? ` em ${data(e.verificadoEm)}` : ''}. Área, abrangência, valores e prazos podem conter erros: confirme no <a href="${esc(e.link)}" target="_blank" rel="noopener noreferrer">Transferegov.br</a>, pelo código ${esc(e.codigoPrograma || '')}, antes de agir.</p>`;
    if (!e.fonte && !e.verificadoEm) return '';
    return `<p class="nota">Conferido por pessoa${e.verificadoEm ? ` em ${data(e.verificadoEm)}` : ''}${e.fonte ? ` na <a href="${esc(e.fonte)}" target="_blank" rel="noopener noreferrer">fonte oficial</a>` : ''}.</p>`;
}

/* ---------- Validação ---------- */
const avisos = [];
const editais = [];
// Arquivo de encerrados (scripts/arquivo.mjs): editais que saíram da fonte depois do prazo continuam com página
const ARQUIVO = path.join(RAIZ, 'data', 'arquivo-editais.json');
const arquivoAnterior = (() => { try { return JSON.parse(fs.readFileSync(ARQUIVO, 'utf8')).editais || {}; } catch { return {}; } })();
const { arquivo: arquivoNovo, revividos } = atualizarArquivo(arquivoAnterior, [...brutos, ...brutosTG], hoje);
{
    const txt = JSON.stringify({ _leia: 'Gerado por scripts/gerar-paginas.mjs (regras em scripts/arquivo.mjs): última versão de cada edital publicado, para manter no ar a página de quem saiu da fonte depois do prazo. Para tirar uma página do ar de vez, apague a entrada aqui e no editais.json.', editais: arquivoNovo }, null, 2) + '\n';
    if (!fs.existsSync(ARQUIVO) || fs.readFileSync(ARQUIVO, 'utf8') !== txt) fs.writeFileSync(ARQUIVO, txt);
}
const idsArquivados = new Set(revividos.map(r => r.id));
[...brutos, ...brutosTG, ...revividos].forEach((r, i) => {
    const faltam = ['id', 'titulo', 'instituicao', 'abertura', 'encerramento'].filter(c => r[c] === undefined || r[c] === '');
    if (!(Number(r.valorMax) > 0) && !r.valorNota) faltam.push('valorMax ou valorNota');
    if (!isoOk(r.abertura) || !isoOk(r.encerramento)) faltam.push('datas no formato AAAA-MM-DD');
    if (!Array.isArray(r.publico) || !r.publico.length) faltam.push('publico');
    if (faltam.length) { avisos.push(`Item ${i + 1} (${r.titulo || 'sem título'}) ignorado: ${faltam.join(', ')}`); return; }
    const ag = agencias[r.agencia];
    editais.push({
        moeda: 'BRL', procedencia: 'nacional', tema: 'Desenvolvimento', modalidade: 'Não informada', abrangencia: 'Nacional',
        contrapartida: 'Não informada', tags: [], resumo: '', docsExtras: [], valorTotal: null, ...r,
        link: linkSeguro(r.link) || (ag ? linkSeguro(ag.link) : ''),
        fonte: linkSeguro(r.fonte) || undefined,
        criterios: r.criterios && r.criterios.length ? r.criterios : CRITERIOS_PADRAO,
        documentos: [...new Set([...r.publico.flatMap(p => DOCS_POR_PUBLICO[p] || []), ...DOCS_COMUNS, ...(r.docsExtras || [])])],
        // Só no arquivo (fora do editais.json e da plataforma): sem links para a plataforma na página
        arquivado: idsArquivados.has(r.id)
    });
    Object.defineProperty(editais[editais.length - 1], '__bruto', { value: r }); // para renumerar IDs repetidos
});
{
    const vistos = new Set(); let maxId = Math.max(0, ...editais.map(e => Number(e.id) || 0)); let mudou = false;
    for (const e of editais) {
        if (vistos.has(e.id)) {
            const novo = ++maxId; avisos.push(`ID repetido ${e.id} (${e.titulo}) renumerado para ${novo}`);
            if (e.__bruto) e.__bruto.id = novo;
            e.id = novo; mudou = true;
        }
        vistos.add(e.id);
    }
    if (mudou && !Array.isArray(fonte)) {
        fs.writeFileSync(path.join(RAIZ, 'editais.json'), JSON.stringify({ ...fonte, editais: brutos }, null, 2) + '\n');
    }
}
const titulosUsados = new Set();
const descricoesUsadas = new Set();
const slugs = new Set();
editais.forEach(e => { if (slugs.has(slugEdital(e))) throw new Error(`Slug duplicado: ${slugEdital(e)} (ids repetidos?)`); slugs.add(slugEdital(e)); });

/* ---------- Histórico de alterações (data/editais-snapshot.json → data/alteracoes.json) ---------- */
// Compara os campos-chave com o estado da execução anterior. Idempotente: o workflow roda várias vezes
// por dia e só registra o que mudou desde o último snapshot. Sem snapshot, apenas cria o snapshot.
const SNAPSHOT = path.join(RAIZ, 'data', 'editais-snapshot.json');
const ALTERACOES = path.join(RAIZ, 'data', 'alteracoes.json');
const lerJson = (f, padrao) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return padrao; } };
const COM = lerJson(path.join(RAIZ, 'data', 'comercial.json'), {}) || {};
const ANU = COM.anuncie || {}, APO = COM.apoie || {}, PRO = COM.pro || {};
const gravarSeMudou = (f, txt) => { if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== txt) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, txt); } };
let alteracoes = lerJson(ALTERACOES, []);
if (!Array.isArray(alteracoes)) alteracoes = [];
{
    const anterior = fs.existsSync(SNAPSHOT) ? lerJson(SNAPSHOT, null)?.editais || null : null;
    const { novas, estado } = comparar(editais, anterior, hoje);
    alteracoes.push(...novas);
    gravarSeMudou(ALTERACOES, JSON.stringify(alteracoes, null, 2) + '\n');
    gravarSeMudou(SNAPSHOT, JSON.stringify({ _leia: 'Gerado por scripts/gerar-paginas.mjs: estado anterior dos campos-chave de cada edital, usado para registrar alterações em data/alteracoes.json. Não edite.', editais: estado }, null, 2) + '\n');
    if (novas.length) console.log(`${plural(novas.length, 'alteração registrada', 'alterações registradas')} em data/alteracoes.json`);
}
const alteracoesDe = id => alteracoes.filter(a => a.id === id && a.campo !== 'novo');
const dm = iso => data(iso).slice(0, 5);
// Domingo que fecha a semana ISO "AAAA-SS" (para o lastmod do sitemap)
const semanaFim = chave => { const [a, n] = chave.split('-').map(Number); return somaDias(semanaISO(`${a}-01-04`).inicio, (n - 1) * 7 + 6); };
const CAMPO_ROTULO = { abertura: 'Abertura', encerramento: 'Prazo', propostaCompleta: 'Prazo da proposta completa', valorMax: 'Valor por proposta', valorTotal: 'Valor total', titulo: 'Título', link: 'Link oficial', etapaPrazo: 'Etapa do prazo' };
// Frase curta para cada alteração (página do edital, resumo semanal e feed de alterações)
function textoAlteracao(a, e) {
    const moeda = e?.moeda || 'BRL';
    const fmt = v => (v == null ? 'não informado' : ['abertura', 'encerramento', 'propostaCompleta'].includes(a.campo) && isoOk(v) ? data(v) : ['valorMax', 'valorTotal'].includes(a.campo) && Number(v) > 0 ? valor(Number(v), moeda) : String(v));
    if (a.campo === 'novo') return 'Edital incluído';
    if (['encerramento', 'propostaCompleta', 'abertura'].includes(a.campo) && isoOk(a.de) && isoOk(a.para)) {
        if (a.campo === 'abertura') return `Abertura alterada de ${dm(a.de)} para ${dm(a.para)} em ${dm(a.em)}`;
        const rotulo = a.campo === 'encerramento' && e?.etapaPrazo ? `Prazo da ${e.etapaPrazo.toLowerCase()}` : CAMPO_ROTULO[a.campo];
        return `${rotulo} alterado de ${dm(a.de)} para ${dm(a.para)} em ${dm(a.em)} (${a.para > a.de ? 'prorrogado' : 'antecipado'})`;
    }
    if (a.campo === 'link') return `Link oficial atualizado em ${dm(a.em)}`;
    if (a.campo === 'titulo') return `Título alterado em ${dm(a.em)} (antes: ${a.de || 'sem título'})`;
    return `${CAMPO_ROTULO[a.campo] || a.campo} alterado de ${fmt(a.de)} para ${fmt(a.para)} em ${dm(a.em)}`;
}

/* ---------- Prazos para calendários (um evento de dia inteiro por prazo) ---------- */
const prazosDe = e => [
    isoOk(e.encerramento) && { tipo: 'encerramento', campo: 'encerramento', data: e.encerramento, rotulo: e.etapaPrazo || 'Prazo final' },
    isoOk(e.propostaCompleta) && { tipo: 'proposta-completa', campo: 'propostaCompleta', data: e.propostaCompleta, rotulo: 'Proposta completa' }
].filter(Boolean);
const FONTE_RECURSO = { publico: 'Recurso público', privado: 'Recurso privado', 'incentivo-fiscal': 'Incentivo fiscal (lei de incentivo)', internacional: 'Recurso internacional', misto: 'Misto (público e privado)' };
const elegibilidadeDe = e => (Array.isArray(e.elegibilidade) ? e.elegibilidade.filter(q => q && typeof q.pergunta === 'string' && q.pergunta.trim() && typeof q.esperado === 'boolean') : []);
const porProposta = e => !e.tipoValor || e.tipoValor === 'por-proposta';

// Janela de "encerrados recentemente" (/prazos/ e /editais/)
const desde90 = somaDias(hoje, -90);
const ordemPrazo = (a, b) => {
    const r = { aberto: 0, 'em-breve': 1, fechado: 2 };
    const sa = statusEm(a), sb = statusEm(b);
    if (sa !== sb) return r[sa] - r[sb];
    if (sa === 'aberto') return a.encerramento.localeCompare(b.encerramento);
    if (sa === 'em-breve') return a.abertura.localeCompare(b.abertura);
    return b.encerramento.localeCompare(a.encerramento);
};

/* ---------- Layout ---------- */
const OG_IMG = `${SITE}/assets/og-image.jpg`;

// Buscadores cortam títulos longos: no máximo 70 caracteres (tira a marca e, se preciso, encurta)
const ajustaTitulo = t => { if (t.length <= 70) return t; const s = t.endsWith(` | ${NOME}`) ? t.slice(0, -(NOME.length + 3)) : t; return s.length <= 70 ? s : corta(s, 70); };

/* ---------- Segurança: Content-Security-Policy por página ---------- */
// Hash sha256 de cada <script> inline executável, calculado sobre o HTML FINAL (depois de todas as substituições).
// Scripts com src e blocos de dados (application/ld+json) não entram: não são executados como código inline.
const RE_SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
function hashesScripts(html) {
    const hs = new Set();
    for (const [, attrs, corpo] of html.matchAll(RE_SCRIPT)) {
        if (/\bsrc\s*=/i.test(attrs)) continue;
        const tipo = attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i);
        if (tipo && !/^(text\/javascript|application\/javascript|module)$/i.test(tipo[1])) continue;
        hs.add(`'sha256-${crypto.createHash('sha256').update(corpo, 'utf8').digest('base64')}'`);
    }
    return [...hs];
}
// O que o site usa de fora: Google Fonts (index.html), imagens do OpenStreetMap (Mapa) e, se configurados em
// data/site.json, GoatCounter (script em gc.zgo.at, contagem em <código>.goatcounter.com) e GA4.
// Leaflet e Chart.js são servidos de assets/vendor/ ('self'). Não há iframes: frame-src 'none'.
function politicaCSP(html) {
    const gc = !!cfg.analytics?.goatcounter, ga = !!cfg.analytics?.ga4;
    const dir = [
        ["default-src", "'self'"],
        ["script-src", "'self'", ...hashesScripts(html), gc && 'https://gc.zgo.at', ga && 'https://www.googletagmanager.com'],
        ["style-src", "'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        ["font-src", 'https://fonts.gstatic.com'],
        ["img-src", "'self'", 'data:', 'https://*.tile.openstreetmap.org', gc && 'https://*.goatcounter.com', ga && 'https://*.google-analytics.com https://*.googletagmanager.com'],
        ["connect-src", "'self'", gc && 'https://*.goatcounter.com', ga && 'https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com'],
        ["frame-src", "'none'"],
        ["object-src", "'none'"],
        ["base-uri", "'none'"],
        ["form-action", "'self'", 'mailto:']
    ];
    return dir.map(d => d.filter(Boolean).join(' ')).join('; ');
}
const MARCA_CSP = '__CSP_POLITICA__';
const metasSeguranca = `<meta http-equiv="Content-Security-Policy" content="${MARCA_CSP}">
    <meta name="referrer" content="strict-origin-when-cross-origin">`;
const aplicaCSP = html => (html.includes(MARCA_CSP) ? html.replace(MARCA_CSP, () => politicaCSP(html)) : html);

/* ---------- Menu único (o mesmo da plataforma) ---------- */
const MENU_PARA = { pesquisador: 'Pesquisador', ict: 'Universidade/ICT', empresa: 'Empresa', osc: 'OSC', municipio: 'Município', estado: 'Estado' };
// ativo: 'editais' | 'prazos' | 'para:<slug>' | 'propostas' | 'instituicoes' | 'dados' | 'ajuda' | ''
function menuPrincipal(rel, ativo) {
    const cur = k => (ativo === k ? ' aria-current="page"' : '');
    const para = Object.entries(PUBLICOS_HUB).map(([k, h]) => [h.slug, MENU_PARA[k] || h.titulo, k]);
    const transp = [['instituicoes', 'Instituições', `${rel}instituicoes/`], ['projetos', 'Projetos', `${rel}#projetos`], ['mapa', 'Mapa', `${rel}#mapa`], ['dados', 'Dados', `${rel}dados/`]];
    const sub = (id, rotulo, itens, ativoDentro) => `<li class="menu-sub"><details>
                <summary${ativoDentro ? ' class="ativo"' : ''} aria-controls="${id}">${rotulo}<span class="seta" aria-hidden="true"></span></summary>
                <ul id="${id}">${itens}</ul>
            </details></li>`;
    return `<button type="button" class="menu-botao" aria-expanded="false" aria-controls="menu-principal"><span class="menu-icone" aria-hidden="true"></span>Menu</button>
        <nav id="menu-principal" class="menu" aria-label="Navegação principal">
            <ul class="menu-lista">
            <li><a href="${rel}editais/"${cur('editais')}>Editais</a></li>
            <li><a href="${rel}prazos/"${cur('prazos')}>Prazos</a></li>
            ${sub('menu-para', 'Para você', para.map(([slug, nome, k]) => `<li><a href="${rel}para/${slug}/"${cur('para:' + slug)} data-evento="para-${k}">${esc(nome)}</a></li>`).join(''), ativo.startsWith('para:'))}
            <li><a href="${rel}#propostas" data-evento="topo-propostas">Minhas propostas</a></li>
            ${sub('menu-transparencia', 'Transparência', transp.map(([k, nome, href]) => `<li><a href="${href}"${cur(k)}>${nome}</a></li>`).join(''), ['instituicoes', 'dados'].includes(ativo))}
            <li><a href="${rel}guias/"${cur('ajuda')}>Ajuda</a></li>
            </ul>
        </nav>`;
}
// Gaveta no celular, submenus que fecham com Esc/clique fora e só um aberto por vez
const SCRIPT_MENU = `(function(){var t=document.querySelector('.topo'),b=document.querySelector('.menu-botao'),s=[].slice.call(document.querySelectorAll('.menu-sub details')),largo=window.matchMedia('(min-width: 901px)');if(!t)return;function gaveta(a){t.classList.toggle('aberto',a);b.setAttribute('aria-expanded',a?'true':'false');}if(b)b.addEventListener('click',function(){gaveta(!t.classList.contains('aberto'));});s.forEach(function(d){d.addEventListener('toggle',function(){if(d.open)s.forEach(function(o){if(o!==d)o.open=false;});});d.addEventListener('focusout',function(){setTimeout(function(){if(largo.matches&&!d.contains(document.activeElement))d.open=false;},0);});});document.addEventListener('keydown',function(ev){if(ev.key!=='Escape')return;var d=s.filter(function(x){return x.open;})[0];if(d){d.open=false;d.querySelector('summary').focus();}else if(t.classList.contains('aberto')){gaveta(false);b.focus();}});document.addEventListener('click',function(ev){if(!largo.matches||!ev.target.closest)return;if(!ev.target.closest('.menu-sub'))s.forEach(function(d){d.open=false;});});})();`;

/* ---------- Pesquisa de 1 pergunta (CES: "Foi fácil?") ---------- */
// Anônima, sem texto livre. Com JavaScript: conta o evento ces-<resposta> (SCRIPT_EVENTOS), agradece e grava
// fb:ces no navegador (não pergunta de novo por 30 dias). Sem JavaScript: cada botão é um link para
// obrigado/<resposta>/, que conta a resposta por um pixel do GoatCounter.
const CES_OPCOES = [['facil', 'Fácil'], ['medio', 'Mais ou menos'], ['dificil', 'Difícil']];
const blocoCES = rel => `<section class="ces" aria-labelledby="ces-titulo" data-ces-bloco>
            <h2 id="ces-titulo">Foi fácil encontrar o que procurava?</h2>
            <div class="ces-opcoes" role="group" aria-labelledby="ces-titulo">${CES_OPCOES.map(([k, t]) => `<a class="btn" href="${rel}obrigado/${k}/" rel="nofollow" data-ces="${k}" data-evento="ces-${k}">${t}</a>`).join('')}</div>
            <p class="ces-obrigado" role="status" aria-live="polite"></p>
            <p class="nota">Resposta anônima, sem dados pessoais: contamos só o total de cada opção. <a href="${rel}dados/#experiencia">Como medimos a experiência</a>.</p>
        </section>`;
const SCRIPT_CES = `(function(){var c=document.querySelector('[data-ces-bloco]');if(!c)return;var K='fb:ces',D=30*864e5;try{var v=Number(localStorage.getItem(K));if(v&&Date.now()-v<D){c.hidden=true;return;}}catch(_){}c.addEventListener('click',function(ev){var a=ev.target.closest&&ev.target.closest('[data-ces]');if(!a)return;ev.preventDefault();try{localStorage.setItem(K,String(Date.now()));}catch(_){}c.querySelector('.ces-opcoes').hidden=true;c.querySelector('.ces-obrigado').textContent='Obrigado! Sua resposta ajuda a melhorar o site.';});})();`;

function layout({ rel, titulo: tituloBruto, descricao, url, tipo = 'website', jsonld, corpo, ativo = '', robots = '', ogImagem = '', assinatura = null, ces = false }) {
    const titulo = ajustaTitulo(tituloBruto);
    // Separadores das migalhas são decorativos para leitores de tela (a lista já é anunciada como navegação)
    corpo = corpo.replace(/(<nav class="migalhas"[^>]*>)([\s\S]*?)(<\/nav>)/g, (m, a, b, c) => a + b.replace(/ › /g, ' <span class="sep" aria-hidden="true">›</span> ') + c);
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    ${metasSeguranca}
    <script>document.documentElement.className+=' js';</script>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(titulo)}</title>
    <meta name="description" content="${esc(descricao)}">
    ${robots ? `<meta name="robots" content="${robots}">` : ''}
    <link rel="canonical" href="${esc(url)}">
    <meta name="theme-color" content="#1351B4">
    <meta property="og:type" content="${tipo}">
    <meta property="og:site_name" content="${NOME}">
    <meta property="og:locale" content="pt_BR">
    <meta property="og:title" content="${esc(titulo)}">
    <meta property="og:description" content="${esc(descricao)}">
    <meta property="og:url" content="${esc(url)}">
    <meta property="og:image" content="${ogImagem || OG_IMG}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${ogImagem ? esc(titulo) : `${NOME} — editais e fundos de financiamento`}">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="icon" href="${rel}assets/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="${rel}assets/paginas.css">
    <link rel="alternate" type="application/rss+xml" title="${NOME} — novos editais" href="${SITE}/feed.xml">
    ${assinatura ? `<link rel="alternate" type="application/rss+xml" title="${esc(`${NOME} — ${assinatura.nome}`)}" href="${SITE}/feeds/${assinatura.chave}.xml">
    <link rel="alternate" type="text/calendar" title="${esc(`Prazos — ${assinatura.nome}`)}" href="${SITE}/cal/${assinatura.chave}.ics">` : ''}
    ${headExtras()}
    ${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
    <a class="pular" href="#conteudo">Pular para o conteúdo</a>
    <header class="topo">
        <a class="marca" href="${rel}"><span class="marca-icone" aria-hidden="true"></span>${NOME}</a>
        ${menuPrincipal(rel, ativo)}
    </header>
    <main id="conteudo" class="pagina">
${corpo}
    </main>
    <footer class="rodape">
        ${ces ? blocoCES(rel) : ''}
        <div class="rodape-grupos">
            <nav aria-labelledby="rodape-editais"><h2 id="rodape-editais">Editais</h2><ul>
                <li><a href="${rel}editais/">Todos os editais</a></li>
                <li><a href="${rel}prazos/">Prazos</a></li>
                <li><a href="${rel}semana/">Resumo da semana</a></li>
                ${linkSeguro(cfg.boletim?.url) ? `<li><a href="${esc(linkSeguro(cfg.boletim.url))}" target="_blank" rel="noopener" data-evento="boletim">Receber novos editais</a></li>` : ''}
            </ul></nav>
            <nav aria-labelledby="rodape-para"><h2 id="rodape-para">Para você</h2><ul>${Object.entries(PUBLICOS_HUB).map(([k, h]) => `<li><a href="${rel}para/${h.slug}/">${esc(MENU_PARA[k] || h.titulo)}</a></li>`).join('')}</ul></nav>
            <nav aria-labelledby="rodape-sobre"><h2 id="rodape-sobre">Sobre</h2><ul>
                <li><a href="${rel}anuncie/">Anuncie</a></li>
                <li><a href="${rel}apoie/">Apoie</a></li>
                <li><a href="${rel}nunca-cobramos/">Nunca cobramos</a></li>
                <li><a href="${rel}dados/">Dados abertos</a></li>
                <li><a href="${rel}acessibilidade/">Acessibilidade</a></li>
                <li><a href="${rel}privacidade/">Privacidade</a></li>
                <li><a href="${rel}termos/">Termos de uso</a></li>
                <li><a href="${esc(contatoHref)}"${/^mailto:/.test(contatoHref) ? '' : ' target="_blank" rel="noopener"'}>Contato</a></li>
            </ul></nav>
        </div>
        <p class="nota"><strong>${NOME}</strong>: editais de fomento reunidos em um só lugar. ${demonstrativo ? 'Dados demonstrativos. ' : ''}Informações de ${data(geradoEm)}. Não somos canal oficial dos financiadores: confirme sempre no edital oficial da instituição. Antigo Fundos Brasil. Sem vínculo com o Fundo Brasil de Direitos Humanos.</p>
    </footer>
    <script>
    // Atualiza a situação pela data de hoje (a página pode ter sido gerada há alguns dias)
    (function () {
        var h; try { h = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()); } catch (_) { var d = new Date(); h = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
        var dia = 864e5, t0 = Date.parse(h);
        document.querySelectorAll('[data-abertura]').forEach(function (el) {
            var a = el.dataset.abertura, z = el.dataset.encerramento, txt, cls;
            var et = el.dataset.etapa ? el.dataset.etapa + ': ' : '';
            if (h < a) { var n = Math.round((Date.parse(a) - t0) / dia); txt = 'Abre em ' + n + (n === 1 ? ' dia' : ' dias'); cls = 'em-breve'; }
            else if (h <= z) { var m = Math.round((Date.parse(z) - t0) / dia); txt = m === 0 ? et + (et ? 'encerra hoje' : 'Encerra hoje') : (m <= 7 ? et + (et ? 'encerra em ' : 'Encerra em ') : (et || 'Aberto · ')) + m + (m === 1 ? ' dia' : ' dias') + (m > 7 && !et ? ' restantes' : ''); cls = m <= 7 ? 'urgente' : 'aberto'; }
            else { txt = 'Encerrado em ' + z.split('-').reverse().join('/'); cls = 'fechado'; }
            el.textContent = txt; el.className = 'selo ' + cls;
        });
    })();
    ${SCRIPT_EVENTOS}
    ${SCRIPT_MENU}
    ${ces ? SCRIPT_CES : ''}
    </script>
</body>
</html>
`;
}

const selo = e => {
    const st = statusEm(e);
    return `<span class="selo ${st}" data-abertura="${e.abertura}" data-encerramento="${e.encerramento}"${e.etapaPrazo ? ` data-etapa="${esc(e.etapaPrazo)}"` : ''}>${e.etapaPrazo && st !== 'fechado' ? esc(e.etapaPrazo) + ' até ' + data(e.encerramento) : st === 'fechado' ? `Encerrado em ${data(e.encerramento)}` : ROTULO[st]}</span>`;
};
const publicoTxt = e => e.publico.map(p => PUBLICOS[p] || p).join(', ');

// Selo de patrocínio (CDC arts. 36-37; CONAR): sempre com o nome de quem patrocina e a explicação
const AVISO_PATROCINIO = 'Destaque pago. Não altera a busca, os filtros, a compatibilidade nem a ordem das listas.';
const seloPatrocinio = (e, rel) => `<span class="selo patrocinado" title="${AVISO_PATROCINIO}">${esc(textoSelo(e))}</span> <a class="por-que" href="${rel}anuncie/#regras">Por que estou vendo isto?</a>`;
// Aviso visível quando quem patrocina não é o responsável pelo edital (evita sugerir vínculo)
const avisoPatrocinador = e => (patrocinado(e) && e.patrocinador && !String(e.instituicao || '').toLowerCase().includes(String(e.patrocinador).toLowerCase().trim())
    ? `<p class="nota aviso-patrocinio">${esc(e.patrocinador)} patrocina este destaque e não é o responsável por este edital. Destaques patrocinados ocupam vagas reservadas e não mudam a ordem das listas.</p>` : '');
const eventoPatrocinio = e => ` data-evento="patrocinio-clique patrocinio-${e.id}"`;
// Em listas de uma linha (prazos, semana): link com medição + selo
const linkEdital = (e, rel) => `<a href="${rel}editais/${slugEdital(e)}/"${patrocinado(e) ? eventoPatrocinio(e) : ''}>${esc(nomeEdital(e))}</a>${patrocinado(e) ? ' ' + seloPatrocinio(e, rel) : ''}`;

function cartao(e, rel) {
    const p = patrocinado(e);
    return `<li class="cartao${p ? ' tem-patrocinio' : ''}">
            <div class="selos">${p ? seloPatrocinio(e, rel) + ' ' : ''}${selo(e)} ${seloModalidade(e)}${e.origem === 'transferegov' ? ' <span class="selo auto" title="Dados lidos automaticamente do Transferegov, sem revisão humana">Não revisado por pessoa</span>' : ''}</div>
            <h3><a href="${rel}editais/${slugEdital(e)}/"${p ? eventoPatrocinio(e) : ''}>${esc(nomeEdital(e))}</a></h3>
            <p>${esc(e.instituicao)} · <strong>${valorTxt(e)}</strong>${temValor(e) ? ' por proposta' : ''} · ${esc(publicoTxt(e))}</p>
            <p class="nota">Inscrições: ${data(e.abertura)} a ${data(e.encerramento)} · ${esc(abrangenciaRotulo(e))}</p>
        </li>`;
}

// Botões de assinatura de um recorte (feeds/<chave>.xml e cal/<chave>.ics)
const assinar = (rel, chave, rotulo) => `<div class="assinar" role="group" aria-label="${esc(rotulo)}">
            <span class="assinar-rotulo">${esc(rotulo)}</span>
            <a class="btn pequeno" href="${rel}feeds/${chave}.xml" type="application/rss+xml" data-evento="assinar-rss">Feed RSS</a>
            <a class="btn pequeno" href="${rel}cal/${chave}.ics" type="text/calendar" data-evento="assinar-calendario">Calendário (.ics)</a>
            <a class="assinar-ajuda" href="${rel}dados/#assinar">Como assinar</a>
        </div>`;

// Vaga reservada e sinalizada (1 por página), fora da lista ordenada — que continua íntegra, com o mesmo
// edital na sua posição normal. Com mais de um patrocínio vigente para a vaga, rodízio diário.
function vagaPatrocinada(candidatos, vaga, rel) {
    const e = escolherVaga(candidatos.filter(x => patrocinado(x, vaga)), hoje);
    if (!e) return '';
    return `<aside class="vaga-patrocinada" aria-label="Destaque patrocinado" data-vaga="${vaga}" data-patrocinio="${e.id}">
            <p class="vaga-rotulo"><strong>Destaque patrocinado</strong> <span>· vaga reservada, fora da ordem da lista</span></p>
            <ul class="cartoes">${cartao(e, rel)}</ul>
        </aside>`;
}

function escrever(rota, html) {
    if (rota.endsWith('.html')) html = aplicaCSP(html);
    const destino = path.join(RAIZ, rota);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, html);
}

// Remove páginas geradas anteriormente (editais renomeados ou removidos)
// (semana/ não é apagada: guarda o arquivo dos resumos semanais anteriores)
for (const dir of ['editais', 'instituicoes', 'para', 'area', 'prazos', 'glossario', 'guias', 'parcerias', 'anuncie', 'apoie', 'sugerir-edital', 'privacidade', 'termos', 'dados', 'feeds', 'cal', 'obrigado']) fs.rmSync(path.join(RAIZ, dir), { recursive: true, force: true });

/* ---------- Alertas semanais: formulário externo (formularios.alertas) ou, sem ele, RSS, calendário e WhatsApp ---------- */
// Sem formulário configurado não se promete e-mail (CDC, art. 30): o bloco oferece só o que já existe.
const canalWhats = linkSeguro(cfg.whatsappCanal);
function blocoAlertas(rel, chave = 'todos', origem = '') {
    const url = formularioExterno('alertas');
    const ev = origem ? ` alertas-${origem}` : '';
    if (url) return `<section class="alertas" aria-labelledby="alertas-titulo">
            <h2 id="alertas-titulo">Receba os prazos por e-mail toda semana</h2>
            <p>Um e-mail por semana com os editais novos e os prazos que estão chegando. Gratuito; você sai quando quiser.</p>
            <div class="acoes"><a class="btn primario" href="${esc(url)}" target="_blank" rel="noopener" data-evento="alertas-formulario${ev}">Quero receber por e-mail<span class="sr-only"> (abre um formulário em outro site)</span></a></div>
            <p class="nota">A inscrição é feita num formulário de ${esc(servicoDoFormulario(url))}, fora deste site. <a href="${rel}privacidade/#formularios-externos">Como tratamos esses dados</a>.</p>
        </section>`;
    return `<section class="alertas" aria-labelledby="alertas-titulo">
            <h2 id="alertas-titulo">Acompanhe os prazos toda semana</h2>
            <p>Ainda não enviamos e-mails. Para não perder prazos, use uma destas opções gratuitas, sem cadastro:</p>
            <div class="acoes">
                <a class="btn" href="${rel}cal/${chave}.ics" type="text/calendar" data-evento="alertas-calendario${ev}">Prazos na minha agenda (.ics)</a>
                <a class="btn" href="${rel}feeds/${chave}.xml" type="application/rss+xml" data-evento="alertas-rss${ev}">Feed RSS</a>
                ${canalWhats ? `<a class="btn" href="${esc(canalWhats)}" target="_blank" rel="noopener" data-evento="alertas-whatsapp${ev}">Canal no WhatsApp</a>` : ''}
                <a class="btn" href="${rel}semana/" data-evento="alertas-semana${ev}">Resumo da semana</a>
            </div>
            <p class="nota">A agenda avisa 7 dias e 1 dia antes de cada prazo. <a href="${rel}dados/#assinar">Como assinar o calendário ou o feed</a>.</p>
        </section>`;
}

/* ---------- Página de cada edital ---------- */
for (const e of editais) {
    const rel = '../../';
    const url = `${SITE}/editais/${slugEdital(e)}/`;
    const ag = agencias[e.agencia];
    const instNome = ag ? `${ag.sigla} — ${ag.nome}` : e.instituicao;
    const area = AREAS[e.tema] || e.tema;
    const tg = e.origem === 'transferegov';
    const encerrado = statusEm(e) === 'fechado';
    // Buscadores exibem ~60 caracteres: título do edital primeiro, instituição e marca só se couberem
    // Transferegov: público em palavras do dia a dia (título, descrição)
    const PARA_TG = { municipio: 'municípios', estado: 'estados', osc: 'ONGs' };
    const listaE = l => (l.length > 1 ? `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}` : l[0] || '');
    const publicoTG = listaE(e.publico.map(p => PARA_TG[p] || PUBLICOS[p] || p));
    // Transferegov: "<nome legível>: quem pode pedir e até quando | NOME" (a marca sai se não couber; o sufixo fica)
    const tituloTG = extra => {
        const nome = nomeEdital(e), ex = extra ? ` (${extra})` : '', suf = ': quem pode pedir e até quando';
        if (`${nome}${ex}${suf} | ${NOME}`.length <= 70) return `${nome}${ex}${suf} | ${NOME}`;
        return `${corta(nome, 70 - suf.length - ex.length)}${ex}${suf}`;
    };
    const titulo = (() => {
        // Títulos de página únicos. Transferegov: programas com nomes parecidos ganham o público e, se preciso, o final do código
        const opcoes = tg ? [tituloTG(''), tituloTG(publicoTG), tituloTG(`${publicoTG}, ${String(e.codigoPrograma || e.id).slice(-4)}`)] : [tituloBase()];
        const livre = opcoes.find(t => !titulosUsados.has(t));
        if (livre) { titulosUsados.add(livre); return livre; }
        const suf = ` (${(e.ufs && e.ufs[0]) || e.abrangencia || 'BR'} ${String(e.id).slice(-4)})`;
        const u = tg ? tituloTG(`${publicoTG}, ${e.id}`) : corta(e.titulo, 70 - suf.length) + suf;
        titulosUsados.add(u); return u;
    })();
    // Transferegov: "Programa federal do <órgão> para <público>. Prazo para propostas: DD/MM/AAAA. Veja quem pode pedir, documentos
    // e como propor no Transferegov." Buscadores mostram ~160 caracteres e pedem descrições únicas: com órgão de nome longo, o
    // convite final encurta; com descrição repetida (programas do mesmo órgão, público e prazo), o nome do programa vai na frente.
    function descricaoTG() {
        const base = `${encerrouTxt}Programa federal do ${e.instituicao} para ${publicoTG}`, prazo = data(e.encerramento);
        const comNome = (fim, extra = '') => { const n = 158 - `${base}: . ${fim}${extra}`.length; if (n < 20) return ''; const nome = `${corta(nomeEdital(e), n)}${extra}`; return `${base}: ${nome}${nome.endsWith('…') ? '' : '.'} ${fim}`; };
        const opcoes = [
            `${base}. Prazo para propostas: ${prazo}. Veja quem pode pedir, documentos e como propor no Transferegov.`,
            `${base}. Prazo para propostas: ${prazo}. Veja quem pode pedir e como propor.`,
            `${base}. Prazo para propostas: ${prazo}.`,
            // Repetida (mesmo órgão, público e prazo): o nome do programa entra no meio, e o código se ainda repetir
            comNome(`Prazo para propostas: ${prazo}.`), comNome(`Prazo: ${prazo}.`), comNome(`Prazo: ${prazo}.`, ` (${e.codigoPrograma || e.id})`)
        ].filter(t => t && t.length <= 158);
        const d = opcoes.find(t => !descricoesUsadas.has(t)) || corta(`${base}. Prazo para propostas: ${prazo}. Código ${e.codigoPrograma || e.id}.`, 158);
        descricoesUsadas.add(d);
        return d;
    }
    function tituloBase() {
        const inst = e.instituicao;
        if (`${e.titulo} — ${inst} | ${NOME}`.length <= 70) return `${e.titulo} — ${inst} | ${NOME}`;
        if (`${e.titulo} — ${inst}`.length <= 70) return `${e.titulo} — ${inst}`;
        return inst.length <= 24 ? `${corta(e.titulo, 67 - inst.length)} — ${inst}` : corta(e.titulo, 70);
    }
    const encerrouTxt = statusEm(e) === 'fechado' ? `Encerrado em ${data(e.encerramento)}. ` : '';
    const descricao = tg ? descricaoTG() : encerrouTxt + corta(`${e.numero ? e.numero + '. ' : ''}${e.modalidade}${temValor(e) ? `: até ${valor(e.valorMax, e.moeda)} por proposta` : ''} para ${publicoTxt(e)}. Inscrições de ${data(e.abertura)} a ${data(e.encerramento)}. ${e.resumo}`, 158 - encerrouTxt.length);
    // WhatsApp: mensagem curta, com o link da página estática (nunca uma rota com #)
    const textoWhats = `${nomeEdital(e)}\nPrazo: ${data(e.encerramento)}\nQuem pode pedir: ${quemPodePedir(e)}\n${url}`;
    const sg = criaSiglas(rel);
    const etapas = [['Publicação do edital', e.publicadoEm], ['Abertura das inscrições', e.abertura], ['Prazo final', e.encerramento], ['Resultado (previsão)', e.resultado]].filter(([, d]) => isoOk(d));
    // Encerrado: até 3 abertos da mesma área ou do mesmo público (os dois juntos primeiro; depois o prazo mais próximo)
    const parecidos = encerrado ? editais.filter(x => x.id !== e.id && statusEm(x) === 'aberto')
        .map(x => [x, (x.tema === e.tema ? 2 : 0) + (x.publico.some(p => e.publico.includes(p)) ? 1 : 0)]).filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1] || a[0].encerramento.localeCompare(b[0].encerramento)).slice(0, 3).map(([x]) => x) : [];
    const proximaEdicao = e.proximaEdicao ? (isoOk(e.proximaEdicao) ? `Próxima edição prevista para ${data(e.proximaEdicao)}.` : `Próxima edição: ${e.proximaEdicao}`) : '';
    const relacionados = editais.filter(x => x.id !== e.id && !parecidos.includes(x) && (x.agencia === e.agencia || x.tema === e.tema)).sort(ordemPrazo).slice(0, 4);
    const ufs = Array.isArray(e.ufs) && e.ufs.length ? e.ufs : REGIOES_UF[e.abrangencia];
    const elig = elegibilidadeDe(e);
    const fonteRec = FONTE_RECURSO[e.fonteRecurso];
    // Avisos de prazo/valor alterado (do histórico), mais recentes primeiro
    const alts = alteracoesDe(e.id).filter(a => ['encerramento', 'propostaCompleta', 'abertura', 'valorMax', 'valorTotal'].includes(a.campo)).reverse();
    // Prazos futuros: viram links "Adicionar ao calendário"
    const proximos = prazosDe(e).filter(p => p.data >= hoje);
    const gcal = p => `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${p.rotulo}: ${nomeEdital(e)}`)}&dates=${p.data.replace(/-/g, '')}/${somaDias(p.data, 1).replace(/-/g, '')}&details=${encodeURIComponent(`${e.instituicao}. Confirme o horário limite no edital oficial. ${url}`)}`;
    const rotuloValor = { total: 'Valor do edital', faixa: 'Faixa de valor por proposta', bolsa: 'Bolsa' }[e.tipoValor] || 'Valor por proposta';
    const totalInformado = Number(e.valorTotal) > 0;
    const soTotal = e.tipoValor === 'total' && totalInformado && !temValor(e); // uma linha só: "Valor do edital: R$ 12,8 mi"
    const valorFato = temValor(e) ? valorTxt(e)
        : soTotal ? valor(e.valorTotal, e.moeda)
        : tg ? `Valor não informado pela fonte — veja o programa ${esc(e.codigoPrograma || '')} no Transferegov.br`
        : 'Veja no edital oficial';
    const [procCls, procTxt] = seloProcedencia(e);
    // Lembrete perto do prazo: calendário (.ics, com todos os prazos) e Google Agenda ao lado de cada data
    const botoesPrazo = p => (p && p.data >= hoje ? `<span class="prazo-acoes">${p.tipo === proximos[0].tipo ? `<a class="btn pequeno" href="${rel}cal/edital-${e.id}.ics" type="text/calendar" data-evento="edital-ics">Pôr no meu calendário (.ics)</a> ` : ''}<a class="btn pequeno" href="${esc(gcal(p))}" target="_blank" rel="noopener noreferrer" data-evento="edital-google-agenda">Google Agenda<span class="sr-only">: ${esc(p.rotulo.toLowerCase())}</span></a></span>` : '');
    const prazoEnc = prazosDe(e).find(p => p.tipo === 'encerramento'), prazoPC = prazosDe(e).find(p => p.tipo === 'proposta-completa');
    // "Posso concorrer?": quem, onde e as perguntas eliminatórias, em frase simples (funciona sem JavaScript)
    const elimSim = elig.filter(q => q.eliminatoria && q.esperado), elimNao = elig.filter(q => q.eliminatoria && !q.esperado), outras = elig.filter(q => !q.eliminatoria);
    // (função: as siglas são explicadas na ordem em que aparecem na página)
    const blocoPosso = () => `<section class="posso" aria-labelledby="posso-titulo">
            <h2 id="posso-titulo">Posso concorrer?</h2>
            <p class="posso-resumo"><strong>Quem pode pedir:</strong> ${esc(quemPodePedir(e))} <span aria-hidden="true">·</span> <strong>Onde:</strong> ${esc(ondeTxt(e))}</p>
            ${elimSim.length ? `<p>Você precisa responder <strong>SIM</strong> a todas:</p>
            <ol class="elegibilidade">${elimSim.map(q => `<li><span class="pergunta">${sg(q.pergunta)}</span></li>`).join('')}</ol>` : ''}
            ${elimNao.length ? `<p>${elimSim.length ? 'E' : 'Você precisa'} responder <strong>NÃO</strong> ${elimNao.length > 1 ? 'a todas estas' : 'a esta'}:</p>
            <ol class="elegibilidade">${elimNao.map(q => `<li><span class="pergunta">${sg(q.pergunta)}</span></li>`).join('')}</ol>` : ''}
            ${elimSim.length || elimNao.length ? `<p class="posso-alerta">Se alguma resposta for diferente, você não pode concorrer.</p>` : `<p>${tg ? `A fonte não traz a lista de requisitos. Confira no Transferegov.br, pelo código ${esc(e.codigoPrograma || '')}, quem pode propor.` : 'Os requisitos completos estão no edital oficial.'}</p>`}
            ${outras.length ? `<p>Também conta:</p><ol class="elegibilidade">${outras.map(q => `<li><span class="pergunta">${sg(q.pergunta)}</span> <span class="requisito">Resposta esperada: <strong>${q.esperado ? 'Sim' : 'Não'}</strong></span></li>`).join('')}</ol>` : ''}
            <p class="nota">Lista para conferência rápida; vale o edital oficial.${e.arquivado ? '' : ` <a href="${rel}#edital-${e.id}" data-evento="edital-teste">Fazer o teste completo na plataforma</a>.`}</p>
        </section>`;

    const jsonld = {
        '@context': 'https://schema.org',
        '@graph': [
            { '@type': 'BreadcrumbList', itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE}/` },
                { '@type': 'ListItem', position: 2, name: 'Editais', item: `${SITE}/editais/` },
                { '@type': 'ListItem', position: 3, name: nomeEdital(e), item: url }
            ] },
            { '@type': 'MonetaryGrant', name: nomeEdital(e), description: e.resumo || descricao, url, ...(e.link ? { sameAs: e.link } : {}),
              funder: { '@type': 'Organization', name: instNome, ...(ag ? { url: ag.link } : {}) },
              ...(temValor(e) ? { amount: { '@type': 'MonetaryAmount', currency: e.moeda, maxValue: e.valorMax } } : {}),
              ...(e.numero ? { identifier: e.numero } : {}) }
        ]
    };

    const corpo = `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <a href="${rel}editais/">Editais</a> › <span aria-current="page">${esc(nomeEdital(e))}</span></nav>
        <div class="selos">${patrocinado(e) ? seloPatrocinio(e, rel) + ' ' : ''}${selo(e)} ${seloModalidade(e)} <span class="selo ${procCls}">${esc(procTxt)}</span>${e.fluxoContinuo === true ? ' <span class="selo neutro">Recebe propostas a qualquer momento</span>' : ''}${tg ? ' <a class="selo auto" href="#origem" title="Dados lidos automaticamente do Transferegov, sem revisão humana">Não revisado por pessoa</a>' : ''}</div>
        ${tg ? `<p class="nota resumo-origem">Lido da API do Transferegov${e.verificadoEm ? ` em ${data(e.verificadoEm)}` : ''}, sem revisão humana: confirme na fonte. <a href="#origem">Origem e limites dos dados</a></p>` : ''}
        ${avisoPatrocinador(e)}
        ${numeroEdital(e) ? `<p class="numero">${esc(numeroEdital(e))}</p>` : ''}
        <h1>${esc(nomeEdital(e))}</h1>
        <p class="sub">${ag ? `<a href="${rel}instituicoes/${e.agencia}/">${esc(e.instituicao)}</a>` : esc(e.instituicao)} · ${esc(area)} · ${esc(abrangenciaRotulo(e))}</p>
        ${alts.length ? `<ul class="alteracoes" aria-label="Alterações registradas">${alts.map(a => `<li>${esc(textoAlteracao(a, e))}</li>`).join('')}</ul>` : ''}

        ${encerrado ? `<div class="aviso-encerrado" role="note">
            <p><strong>Este edital já encerrou.</strong> ${parecidos.length ? `<a href="#parecidos" data-evento="encerrado-parecidos">Veja editais parecidos abertos</a>` : `<a href="${rel}editais/" data-evento="encerrado-abertos">Veja os editais abertos</a>`}</p>
            ${proximaEdicao ? `<p>${sg(proximaEdicao)}</p>` : ''}
        </div>` : ''}

        <div class="acoes">
            ${encerrado ? `<a class="btn primario" href="${parecidos.length ? '#parecidos' : `${rel}editais/`}" data-evento="encerrado-parecidos">Ver editais parecidos abertos</a>`
                : `<a class="btn primario" href="${rel}#edital-${e.id}" data-evento="edital-teste">Posso concorrer? Fazer o teste</a>`}
            ${e.link ? `<a class="btn" href="${esc(e.link)}" target="_blank" rel="noopener noreferrer" data-evento="edital-oficial${patrocinado(e) ? ` patrocinio-oficial-${e.id}` : ''}">Edital oficial</a>` : ''}
            ${encerrado ? '' : `<a class="btn whats" href="https://wa.me/?text=${encodeURIComponent(textoWhats)}" target="_blank" rel="noopener noreferrer" data-evento="edital-whatsapp">Enviar no WhatsApp</a>`}
        </div>
        <p class="aviso-golpe">Nunca pague para se inscrever. <a href="${rel}nunca-cobramos/" data-evento="golpe-saiba-mais">Saiba como evitar golpes <span aria-hidden="true">→</span></a></p>

        <dl class="fatos">
            <div class="fato-prazo" id="prazo"><dt>${e.etapaPrazo ? esc(e.etapaPrazo) : 'Prazo final'}</dt><dd>${e.fluxoContinuo === true ? `Recebe propostas a qualquer momento, até ${data(e.encerramento)}` : data(e.encerramento)}${botoesPrazo(prazoEnc)}</dd></div>
            ${isoOk(e.propostaCompleta) ? `<div class="fato-prazo"><dt>Proposta completa</dt><dd>${data(e.propostaCompleta)}${botoesPrazo(prazoPC)}</dd></div>` : ''}
            <div><dt>${rotuloValor}</dt><dd>${valorFato}</dd></div>
            ${tg || soTotal ? '' : `<div><dt>Valor total do edital</dt><dd>${totalInformado ? valor(e.valorTotal, e.moeda) : 'Veja no edital oficial'}</dd></div>`}
            <div><dt>Quem pode participar</dt><dd>${e.publico.map(p => PUBLICOS_HUB[p] ? `<a href="${rel}para/${PUBLICOS_HUB[p].slug}/" data-evento="para-${p}">${esc(PUBLICOS[p] || p)}</a>` : esc(PUBLICOS[p] || p)).join(', ')}</dd></div>
            <div><dt>Contrapartida (parte do custo paga por você)</dt><dd>${sg(e.contrapartida)}</dd></div>
            ${fonteRec ? `<div><dt>Origem do recurso</dt><dd>${e.fonteRecurso === 'incentivo-fiscal' ? `<a href="${rel}guias/leis-de-incentivo-fiscal/">${esc(fonteRec)}</a>` : esc(fonteRec)}</dd></div>` : ''}
            <div><dt>Abrangência</dt><dd>${abrangenciaNaoInformada(e) ? esc(abrangenciaTxt(e).replace(/^n/, 'N')) : esc(e.abrangencia)}${ufs && ufs.length > 1 ? `<br><small>${ufs.join(', ')}</small>` : ''}${e.abrangenciaNota ? `<br><small>${sg(e.abrangenciaNota)}</small>` : ''}</dd></div>
            ${modalidadeAncora(e.modalidade) ? `<div><dt>Tipo de parceria</dt><dd>${esc(modalidadeTxt(e.modalidade))}<br><small><a href="${rel}glossario/#${modalidadeAncora(e.modalidade)}" data-evento="glossario-abrir">O que é ${/colabora/i.test(e.modalidade) ? 'termo de colaboração' : 'termo de fomento'}?</a></small></dd></div>` : ''}
        </dl>
        ${e.valorNota ? `<p class="destaque">${sg(e.valorNota)}</p>` : ''}
        ${e.moeda !== 'BRL' && temValor(e) ? `<p class="nota">Valores em ${e.moeda}. Equivalente aproximado: até ${valor(e.valorMax * (COTACAO_REF[e.moeda] || 1))} por proposta (cotação de referência).</p>` : ''}

        ${blocoPosso()}

        <section><h2>Sobre o edital</h2><p>${sg(e.resumo || 'Consulte o edital oficial para o objetivo completo.')}</p>
            ${origemHTML(e)}
            ${e.tags.length ? `<p class="tags">${e.tags.map(t => `<span>${esc(modalidadeTxt(t))}</span>`).join('')}</p>` : ''}</section>

        <section><h2>Cronograma</h2>
            <ol class="cronograma">${etapas.map(([n, d]) => `<li><strong>${n}</strong> <span>${data(d)}</span></li>`).join('')}</ol>
            ${e.prazoNota ? `<p class="destaque">${sg(e.prazoNota)}</p>` : ''}
            ${proximos.length ? `<p class="nota">Para lembrar do prazo, use os botões de calendário <a href="#prazo">ao lado da data</a>.</p>` : ''}</section>

        <section><h2>Documentos usuais</h2>
            <ul class="lista">${documentosDe(e).map(d => `<li>${sg(d)}</li>`).join('')}</ul>
            <p class="nota">Lista de referência para organizar a proposta; vale a lista do edital oficial.${e.arquivado ? '' : ` <a href="${rel}#edital-${e.id}">Marque o que já está pronto na plataforma.</a>`}</p></section>

        <section><h2>Critérios de avaliação</h2>
            <ul class="criterios">${e.criterios.map(c => `<li><span>${esc(c.nome)}</span>${c.peso != null ? `<strong>${c.peso}%</strong><i style="width:${c.peso}%"></i>` : ''}</li>`).join('')}</ul></section>

        <aside class="aviso">${demonstrativo ? '<strong>Dados demonstrativos.</strong> ' : ''}Informações de ${data(geradoEm)}. Antes de submeter, confirme datas, valores e requisitos no edital oficial publicado pela instituição.</aside>

        <section><h2>Como se preparar</h2><ul class="lista">${GUIAS.slice(0, 3).map(g => `<li><a href="${rel}guias/${g.slug}/">${esc(g.titulo)}</a></li>`).join('')}</ul></section>

        ${parecidos.length ? `<section id="parecidos" aria-labelledby="parecidos-titulo"><h2 id="parecidos-titulo">Editais parecidos abertos</h2>
            <p class="nota">Da mesma área ou para o mesmo público, com inscrições abertas agora.</p>
            <ul class="cartoes">${parecidos.map(x => cartao(x, rel)).join('')}</ul></section>` : ''}

        ${relacionados.length ? `<section><h2>Editais relacionados</h2><ul class="cartoes">${relacionados.map(x => cartao(x, rel)).join('')}</ul></section>` : ''}

        ${blocoAlertas(rel, PUBLICOS_HUB[e.publico[0]] ? `publico-${e.publico[0]}` : 'todos', 'edital')}`;

    escrever(`editais/${slugEdital(e)}/index.html`, layout({ rel, titulo, descricao, url, tipo: 'article', jsonld, corpo, ativo: 'editais', ces: true, ogImagem: ogDoEdital(e), assinatura: ag ? { chave: `instituicao-${e.agencia}`, nome: `editais ${ag.sigla}` } : null }));
}

/* ---------- Lista de editais ---------- */
{
    const rel = '../';
    const grupos = ['aberto', 'em-breve', 'fechado'].map(st => [st, editais.filter(e => statusEm(e) === st && (st !== 'fechado' || e.encerramento >= desde90)).sort(ordemPrazo)]).filter(([, l]) => l.length);
    const abertos = editais.filter(e => statusEm(e) === 'aberto').length;
    const corpo = `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <span aria-current="page">Editais</span></nav>
        <h1>Editais e chamadas públicas</h1>
        <p class="sub">${plural(editais.length, 'edital', 'editais')} de ${new Set(editais.map(e => e.instituicao)).size} instituições · ${plural(abertos, 'com inscrições abertas', 'com inscrições abertas')}</p>
        <div class="acoes"><a class="btn primario" href="${rel}#editais" data-evento="lista-plataforma">Filtrar pelo meu perfil na plataforma</a> <a class="btn" href="${rel}prazos/">Ver por prazo</a> <a class="btn" href="${rel}sugerir-edital/">Sugerir um edital</a></div>
        <p class="atalhos">${Object.entries(PUBLICOS_HUB).map(([k, h]) => `<a href="${rel}para/${h.slug}/" data-evento="para-${k}">${esc(h.titulo.replace('Editais abertos ', '').replace('Editais e programas abertos ', ''))}</a>`).join('')}</p>
        ${grupos.map(([st, l]) => `<section><h2>${st === 'fechado' ? 'Encerrados nos últimos 90 dias' : ROTULO[st]} (${l.length})</h2>${st === 'fechado' ? '<p class="nota">As páginas de editais encerrados continuam no ar, com links para editais parecidos abertos.</p>' : ''}<ul class="cartoes">${l.map(e => cartao(e, rel)).join('')}</ul></section>`).join('')}`;
    const itemList = { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: editais.sort(ordemPrazo).map((e, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/editais/${slugEdital(e)}/`, name: nomeEdital(e) })) };
    escrever('editais/index.html', layout({
        rel, url: `${SITE}/editais/`, ativo: 'editais', jsonld: itemList, corpo,
        titulo: `Editais abertos e chamadas públicas de fomento | ${NOME}`,
        descricao: corta(`${plural(abertos, 'edital com inscrições abertas', 'editais com inscrições abertas')} para pesquisadores, empresas, OSCs e municípios: valores, prazos, documentos e critérios de ${[...new Set(editais.map(e => e.instituicao))].join(', ')}.`, 158)
    }));
}

/* ---------- Instituições ---------- */
// Só dados do editais.json: nada de histórico inventado
const instIndexaveis = [];
const temPaginaArea = k => editais.some(e => e.tema === k && statusEm(e) !== 'fechado');
for (const [k, a] of Object.entries(agencias)) {
    const rel = '../../';
    const eds = editais.filter(e => e.agencia === k);
    const abertos = eds.filter(e => statusEm(e) === 'aberto').sort(ordemPrazo);
    const previstos = eds.filter(e => statusEm(e) === 'em-breve').sort(ordemPrazo);
    const encerrados = eds.filter(e => statusEm(e) === 'fechado').sort(ordemPrazo);
    const url = `${SITE}/instituicoes/${k}/`;
    // Valor médio por proposta: só editais com teto por proposta informado, na moeda mais comum
    const comValor = eds.filter(e => temValor(e) && porProposta(e));
    const moedaRef = comValor.length ? Object.entries(comValor.reduce((m, e) => ({ ...m, [e.moeda]: (m[e.moeda] || 0) + 1 }), {})).sort((x, y) => y[1] - x[1])[0][0] : 'BRL';
    const valores = comValor.filter(e => e.moeda === moedaRef).map(e => Number(e.valorMax));
    const media = valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : 0;
    const publicos = Object.keys(PUBLICOS).filter(p => eds.some(e => e.publico.includes(p)));
    const temas = Object.keys(AREAS).filter(t => eds.some(e => e.tema === t));
    const secao = (titulo, lista, vazio) => `<section><h2>${titulo} (${lista.length})</h2>${lista.length ? `<ul class="cartoes">${lista.map(e => cartao(e, rel)).join('')}</ul>` : `<p class="nota">${vazio}</p>`}</section>`;
    // Sem chamada aberta ou prevista: página útil (portal oficial e como acompanhar), fora do índice e do sitemap
    const semChamadas = !abertos.length && !previstos.length;
    if (!semChamadas) instIndexaveis.push(k);
    const rssOficial = linkSeguro(a.rss), calOficial = linkSeguro(a.calendario);
    const blocoSemChamadas = `<section class="sem-chamadas" aria-labelledby="sem-chamadas-titulo">
            <h2 id="sem-chamadas-titulo">Sem chamadas abertas agora</h2>
            <p>Não há chamada ${esc(a.sigla)} com inscrições abertas ou previstas no ${NOME} neste momento. Isso não quer dizer que a instituição não tenha oportunidades: confira sempre o portal oficial.</p>
            <div class="acoes"><a class="btn primario" href="${esc(a.link)}" target="_blank" rel="noopener noreferrer">Portal oficial ${esc(a.sigla)}</a></div>
            <h3>Como acompanhar</h3>
            <ul class="lista">
                <li>Assine o <a href="${rel}feeds/instituicao-${k}.xml" type="application/rss+xml">feed RSS de editais ${esc(a.sigla)}</a> ou o <a href="${rel}cal/instituicao-${k}.ics" type="text/calendar">calendário de prazos (.ics)</a>: quando uma chamada for cadastrada aqui, ela aparece neles. <a href="${rel}dados/#assinar">Como assinar</a>.</li>
                ${rssOficial ? `<li>A própria instituição publica um <a href="${esc(rssOficial)}" target="_blank" rel="noopener noreferrer">feed oficial de novidades</a>.</li>` : ''}
                ${calOficial ? `<li>Calendário oficial da instituição: <a href="${esc(calOficial)}" target="_blank" rel="noopener noreferrer">ver calendário</a>.</li>` : ''}
                <li>Acompanhe os editais de todas as instituições pelo <a href="${rel}semana/">resumo da semana</a>.</li>
                <li>Sabe de uma chamada aberta que não está aqui? <a href="${rel}sugerir-edital/">Sugira o edital</a>.</li>
            </ul>
            <p class="nota">Áreas em que a instituição costuma atuar: ${a.temas.map(esc).join(', ')}.</p>
        </section>`;
    const corpo = `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <a href="${rel}instituicoes/">Instituições</a> › <span aria-current="page">${esc(a.sigla)}</span></nav>
        <p class="selos"><span class="selo neutro">${esc(a.pais)} · ${esc(a.cidade)}</span></p>
        <h1>${esc(a.sigla)} — ${esc(a.nome)}</h1>
        <p class="sub">${esc(a.descricao)}</p>
        <div class="acoes">
            <a class="btn primario" href="${rel}#agencia-${k}">Ver na plataforma</a>
            <a class="btn" href="${esc(a.link)}" target="_blank" rel="noopener noreferrer">Portal oficial</a>
        </div>
        ${semChamadas ? blocoSemChamadas : `${assinar(rel, `instituicao-${k}`, 'Assinar editais desta instituição')}
        <section aria-labelledby="numeros-titulo"><h2 id="numeros-titulo">Em números</h2>
        <dl class="fatos">
            <div><dt>Inscrições abertas agora</dt><dd>${abertos.length}</dd></div>
            <div><dt>Previstos (abrem em breve)</dt><dd>${previstos.length}</dd></div>
            <div><dt>Encerrados no cadastro</dt><dd>${encerrados.length}</dd></div>
            <div><dt>Valor médio por proposta</dt><dd>${valores.length ? `${valor(media, moedaRef)}<br><small>média de ${plural(valores.length, 'edital', 'editais')} com teto informado</small>` : 'Sem valor informado'}</dd></div>
            <div><dt>Públicos atendidos</dt><dd>${publicos.length ? publicos.map(p => PUBLICOS_HUB[p] ? `<a href="${rel}para/${PUBLICOS_HUB[p].slug}/">${esc(PUBLICOS[p])}</a>` : esc(PUBLICOS[p])).join(', ') : '—'}</dd></div>
            <div><dt>Áreas</dt><dd>${temas.length ? temas.map(t => temPaginaArea(t) ? `<a href="${rel}area/${slugify(AREAS[t])}/">${esc(AREAS[t])}</a>` : esc(AREAS[t])).join(', ') : a.temas.map(esc).join(', ')}</dd></div>
        </dl>
        <p class="nota">Números calculados só com os ${plural(eds.length, 'edital cadastrado', 'editais cadastrados')} nesta plataforma (dados de ${data(geradoEm)}); não representam todo o histórico da instituição.${a.fundacao ? ` Fundação: ${esc(a.fundacao)}.` : ''}</p></section>
        ${secao('Inscrições abertas', abertos, 'Nenhum edital com inscrições abertas no momento.')}
        ${previstos.length ? secao('Previstos', previstos, '') : ''}`}
        ${encerrados.length ? secao('Encerrados', encerrados, '') : ''}`;
    escrever(`instituicoes/${k}/index.html`, layout({
        rel, url, ativo: 'instituicoes', corpo, robots: semChamadas ? 'noindex,follow' : '', assinatura: { chave: `instituicao-${k}`, nome: `editais ${a.sigla}` },
        titulo: (t => (t.length <= 70 ? t : `${a.sigla}: editais e financiamento`))(`${a.sigla}: editais e financiamento | ${NOME}`),
        descricao: semChamadas ? corta(`${a.sigla} (${a.nome}): sem chamadas abertas no momento. Link para o portal oficial e como acompanhar novas chamadas por feed e calendário.`, 158) : corta(`${a.sigla}: ${plural(abertos.length, 'edital aberto', 'editais abertos')}, ${plural(previstos.length, 'previsto', 'previstos')}, valores, prazos e quem pode participar. Assine o feed e o calendário.`, 158),
        jsonld: { '@context': 'https://schema.org', '@graph': [
            { '@type': 'Organization', '@id': `${url}#organizacao`, name: a.nome, alternateName: a.sigla, url: a.link, sameAs: [a.link], ...(a.fundacao ? { foundingDate: String(a.fundacao) } : {}), ...(a.cidade ? { address: { '@type': 'PostalAddress', addressLocality: a.cidade, ...(a.pais === 'Brasil' ? { addressCountry: 'BR' } : {}) } } : {}), description: a.descricao },
            { '@type': 'BreadcrumbList', itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE}/` },
                { '@type': 'ListItem', position: 2, name: 'Instituições', item: `${SITE}/instituicoes/` },
                { '@type': 'ListItem', position: 3, name: a.sigla, item: url }] }
        ] }
    }));
}
{
    const rel = '../';
    const proc = a => (a.pais.includes('Brasil') ? 'nacional' : 'internacional');
    const bloco = (tipo, titulo) => `<section><h2>${titulo}</h2><ul class="cartoes">${Object.entries(agencias).filter(([, a]) => proc(a) === tipo).map(([k, a]) => {
        const ab = editais.filter(e => e.agencia === k && statusEm(e) === 'aberto').length;
        return `<li class="cartao"><h3><a href="${rel}instituicoes/${k}/">${esc(a.sigla)}</a></h3><p>${esc(a.nome)} · ${esc(a.cidade)}</p><p class="nota">${ab ? plural(ab, 'edital aberto', 'editais abertos') : 'Sem editais abertos'}</p></li>`;
    }).join('')}</ul></section>`;
    escrever('instituicoes/index.html', layout({
        rel, url: `${SITE}/instituicoes/`, ativo: 'instituicoes',
        jsonld: { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: Object.entries(agencias).map(([k, a], i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/instituicoes/${k}/`, name: a.sigla })) },
        titulo: `Fundos e agências de fomento nacionais e internacionais | ${NOME}`,
        descricao: corta(`Instituições que financiam projetos no Brasil: ${Object.values(agencias).map(a => a.sigla).join(', ')}. Editais abertos, previstos, prazos e feeds por instituição.`, 158),
        corpo: `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <span aria-current="page">Instituições</span></nav>
        <h1>Fundos e agências de fomento</h1>
        <p class="sub">${plural(Object.keys(agencias).length, 'instituição', 'instituições')} nacionais e internacionais.</p>
        ${bloco('nacional', 'Nacionais')}${bloco('internacional', 'Internacionais')}`
    }));
}

/* ---------- Páginas por público, área e prazo (alvos de busca) ---------- */
// Só vai para o índice dos buscadores a página com conteúdo suficiente; as demais existem, mas com noindex
const MIN_INDEXAVEL = 2;
const vigentes = l => l.filter(e => statusEm(e) !== 'fechado').sort(ordemPrazo);
const urlsExtras = [];
const linkGuias = rel => `<ul class="lista">${GUIAS.map(g => `<li><a href="${rel}guias/${g.slug}/">${esc(g.titulo)}</a></li>`).join('')}</ul>`;
const blocoVazio = rel => `<div class="aviso">Nenhuma chamada aberta para este perfil no momento. O monitor verifica as fontes oficiais todos os dias.
    <div class="acoes" style="margin:12px 0 0;">
        ${linkSeguro(cfg.boletim?.url) ? `<a class="btn primario" href="${esc(linkSeguro(cfg.boletim.url))}" target="_blank" rel="noopener" data-evento="boletim">Receber novos editais</a>` : `<a class="btn primario" href="${rel}feed.xml" data-evento="feed">Assinar o feed de editais</a>`}
        <a class="btn" href="${rel}sugerir-edital/">Sugerir um edital</a>
    </div></div>`;

// Destaque do Radar no topo de /para/municipios-e-prefeituras/
const blocoRadarDestaque = rel => `<aside class="destaque-radar" aria-labelledby="radar-destaque-titulo">
            <p class="selos"><span class="selo neutro">Piloto gratuito em São Paulo</span></p>
            <h2 id="radar-destaque-titulo">Radar para municípios pequenos</h2>
            <p>Toda semana, para cada município: programas abertos em que pode entrar, pendências no CAUC que bloqueiam repasses, emendas destinadas e prazos, e o que fazer até cada prazo.</p>
            <div class="acoes"><a class="btn primario" href="${rel}radar-municipios/" data-evento="radar-ver radar-destaque-para">Conhecer o Radar e o piloto</a> <a class="btn" href="${rel}radar-municipios/#modelo" data-evento="radar-modelo">Ver modelo de relatório</a></div>
        </aside>`;
for (const [pub, h] of Object.entries(PUBLICOS_HUB)) {
    const rel = '../../';
    const lista = vigentes(editais.filter(e => e.publico.includes(pub)));
    const url = `${SITE}/para/${h.slug}/`;
    const indexavel = lista.length >= MIN_INDEXAVEL;
    if (indexavel) urlsExtras.push([url, 'daily', '0.8']);
    const docs = documentosDe({ publico: [pub], documentos: [...(DOCS_POR_PUBLICO[pub] || []), ...DOCS_COMUNS] });
    const abertos = lista.filter(e => statusEm(e) === 'aberto').length;
    escrever(`para/${h.slug}/index.html`, layout({
        rel, url, ces: true, ativo: `para:${h.slug}`, robots: indexavel ? '' : 'noindex,follow', assinatura: { chave: `publico-${pub}`, nome: h.titulo.replace(/^Editais (e programas )?abertos /, 'editais ') },
        titulo: `${h.titulo} (${mesAno}) | ${NOME}`,
        descricao: corta(`${lista.length ? `${plural(abertos, 'chamada aberta', 'chamadas abertas')} agora. ` : ''}${h.descricao}`, 158),
        jsonld: lista.length ? { '@context': 'https://schema.org', '@type': 'ItemList', name: h.h1, itemListElement: lista.map((e, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/editais/${slugEdital(e)}/`, name: nomeEdital(e) })) } : null,
        corpo: `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <a href="${rel}editais/">Editais</a> › <span aria-current="page">${esc(h.titulo.replace('Editais abertos ', '').replace('Editais e programas abertos ', ''))}</span></nav>
        <h1>${esc(h.h1)}</h1>
        <p class="sub">${lista.length ? `${plural(lista.length, 'chamada vigente', 'chamadas vigentes')} · atualizado em ${data(geradoEm)}` : `Atualizado em ${data(geradoEm)}`}</p>
        ${pub === 'municipio' ? blocoRadarDestaque(rel) : ''}
        <div class="acoes"><a class="btn primario" href="${rel}#editais?publico=${pub}" data-evento="hub-plataforma">Ver compatibilidade com o meu perfil</a></div>
        ${assinar(rel, `publico-${pub}`, 'Assinar novos editais deste perfil')}
        ${vagaPatrocinada(lista, 'publico', rel)}
        ${lista.length ? `<section><h2>Chamadas abertas e previstas</h2><ul class="cartoes">${lista.map(e => cartao(e, rel)).join('')}</ul></section>` : blocoVazio(rel)}
        <section><h2>Como funciona</h2>${h.intro.replace(/\{raiz\}/g, rel)}</section>
        <section><h2>Dicas rápidas</h2><ul class="lista">${h.dicas.map(d => `<li>${esc(d)}</li>`).join('')}</ul></section>
        <section><h2>Documentos que costumam ser pedidos</h2><ul class="lista">${docs.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
            <p class="nota">Veja o <a href="${rel}guias/documentos-para-editais/">checklist completo de documentos</a>. Cada edital define a lista oficial.</p></section>
        <section><h2>Guias</h2>${linkGuias(rel)}</section>
        ${pub === 'empresa' || pub === 'osc' ? `<p class="nota">Acompanha editais para vários clientes ou projetos? O <a href="${rel}pro/" data-evento="pro-ver">${esc(PRO.nome || 'Plano Pro')}</a> está em preparação.</p>` : ''}
        ${pub === 'estado' ? `<p class="nota">Apoia prefeituras pequenas a captar recursos? Conheça o <a href="${rel}radar-municipios/" data-evento="radar-ver">Radar para municípios pequenos</a>, em construção.</p>` : ''}
        ${blocoAlertas(rel, `publico-${pub}`, 'para')}`
    }));
}

for (const [k, nomeArea] of Object.entries(AREAS)) {
    const lista = vigentes(editais.filter(e => e.tema === k));
    if (!lista.length) continue;
    const rel = '../../';
    const slug = slugify(nomeArea);
    const url = `${SITE}/area/${slug}/`;
    const indexavel = lista.length >= MIN_INDEXAVEL;
    if (indexavel) urlsExtras.push([url, 'daily', '0.7']);
    escrever(`area/${slug}/index.html`, layout({
        rel, url, ativo: 'editais', robots: indexavel ? '' : 'noindex,follow', assinatura: { chave: `area-${slug}`, nome: `editais de ${nomeArea}` },
        titulo: `Editais abertos de ${nomeArea} (${mesAno}) | ${NOME}`,
        descricao: corta(`${plural(lista.length, 'chamada vigente', 'chamadas vigentes')} em ${nomeArea}: valores, prazos, quem pode participar e documentos, com link para a fonte oficial.`, 158),
        jsonld: { '@context': 'https://schema.org', '@type': 'ItemList', name: `Editais de ${nomeArea}`, itemListElement: lista.map((e, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/editais/${slugEdital(e)}/`, name: nomeEdital(e) })) },
        corpo: `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <a href="${rel}editais/">Editais</a> › <span aria-current="page">${esc(nomeArea)}</span></nav>
        <h1>Editais abertos de ${esc(nomeArea)}</h1>
        <p class="sub">${plural(lista.length, 'chamada vigente', 'chamadas vigentes')} · atualizado em ${data(geradoEm)}</p>
        ${assinar(rel, `area-${slug}`, 'Assinar editais desta área')}
        ${vagaPatrocinada(lista, 'area', rel)}
        <ul class="cartoes">${lista.map(e => cartao(e, rel)).join('')}</ul>
        <section><h2>Por perfil</h2><ul class="lista">${Object.entries(PUBLICOS_HUB).map(([p, h]) => `<li><a href="${rel}para/${h.slug}/">${esc(h.titulo)}</a></li>`).join('')}</ul></section>
        <section><h2>Guias</h2>${linkGuias(rel)}</section>`
    }));
}

{
    const rel = '../';
    const ab = editais.filter(e => statusEm(e) === 'aberto').sort((a, b) => a.encerramento.localeCompare(b.encerramento));
    const breve = editais.filter(e => statusEm(e) === 'em-breve').sort((a, b) => a.abertura.localeCompare(b.abertura));
    // Encerrados recentemente: últimos 90 dias, do mais recente para o mais antigo (as páginas continuam no ar)
    const recentes = editais.filter(e => statusEm(e) === 'fechado' && e.encerramento >= desde90).sort((a, b) => b.encerramento.localeCompare(a.encerramento) || nomeEdital(a).localeCompare(nomeEdital(b)));
    const url = `${SITE}/prazos/`;
    if (ab.length + breve.length >= MIN_INDEXAVEL) urlsExtras.push([url, 'daily', '0.8']);
    const linha = e => `<li><span class="data">${data(e.encerramento).slice(0, 5)}</span> ${linkEdital(e, rel)} <span class="nota">· ${esc(e.instituicao)} · ${valorTxt(e)}</span> ${selo(e)}</li>`;
    escrever('prazos/index.html', layout({
        rel, url, ativo: 'prazos', robots: ab.length + breve.length >= MIN_INDEXAVEL ? '' : 'noindex,follow',
        titulo: `Prazos de editais: chamadas que encerram em breve (${mesAno}) | ${NOME}`,
        descricao: corta(`Calendário de prazos: ${plural(ab.length, 'chamada aberta', 'chamadas abertas')} em ordem de encerramento e ${plural(breve.length, 'que abre', 'que abrem')} em breve. Não perca o prazo.`, 158),
        corpo: `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <span aria-current="page">Prazos</span></nav>
        <h1>Prazos de editais: o que encerra primeiro</h1>
        <p class="sub">Atualizado em ${data(geradoEm)}. Prazos com horário-limite: confira sempre o edital oficial.</p>
        <div class="acoes"><a class="btn primario" href="${rel}#editais?view=calendario" data-evento="prazos-calendario">Ver no calendário e exportar para a agenda</a></div>
        ${assinar(rel, 'todos', 'Assinar todos os prazos')}
        <section><h2>Inscrições abertas, por prazo final</h2>${ab.length ? `<ul class="agenda">${ab.map(linha).join('')}</ul>` : '<p>Nenhuma chamada aberta no momento.</p>'}</section>
        ${breve.length ? `<section><h2>Abrem em breve</h2><ul class="agenda">${breve.map(e => `<li><span class="data">${data(e.abertura).slice(0, 5)}</span> ${linkEdital(e, rel)} <span class="nota">· ${esc(e.instituicao)} · abre em ${data(e.abertura)}</span></li>`).join('')}</ul></section>` : ''}
        ${blocoAlertas(rel, 'todos', 'prazos')}
        <section id="encerrados" aria-labelledby="encerrados-titulo"><h2 id="encerrados-titulo">Encerrados recentemente</h2>
            <p class="nota">Últimos 90 dias. A página de cada edital continua no ar, com a próxima edição (quando informada) e editais parecidos abertos.</p>
            ${recentes.length ? `<ul class="agenda">${recentes.map(e => `<li><span class="data">${data(e.encerramento).slice(0, 5)}</span> ${linkEdital(e, rel)} <span class="nota">· ${esc(e.instituicao)}${e.proximaEdicao ? ` · próxima edição: ${esc(isoOk(e.proximaEdicao) ? data(e.proximaEdicao) : e.proximaEdicao)}` : ''}</span> ${selo(e)}</li>`).join('')}</ul>` : '<p>Nenhum edital encerrado nos últimos 90 dias.</p>'}</section>`
    }));
}

/* ---------- Glossário ---------- */
{
    const rel = '../';
    const url = `${SITE}/glossario/`;
    urlsExtras.push([url, 'monthly', '0.6']);
    escrever('glossario/index.html', layout({
        rel, url, ativo: 'ajuda',
        titulo: `Glossário de editais e fomento: CAUC, MROSC, ICT, contrapartida e mais | ${NOME}`,
        descricao: 'O que significam os termos dos editais de fomento: ICT, OSC, MROSC, subvenção econômica, contrapartida, CAUC, Transferegov, CNDT, CRF, rubrica e outros.',
        jsonld: { '@context': 'https://schema.org', '@type': 'DefinedTermSet', name: 'Glossário de editais e fomento', url, hasDefinedTerm: GLOSSARIO.map(g => ({ '@type': 'DefinedTerm', name: g.termo, description: g.def, url: `${url}#${slugify(g.termo)}` })) },
        corpo: `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <span aria-current="page">Glossário</span></nav>
        <h1>Glossário de editais e fomento</h1>
        <p class="sub">Os termos que mais aparecem em editais, chamadas públicas e prestação de contas, em linguagem simples.</p>
        <dl class="glossario">${GLOSSARIO.map(g => `<dt id="${slugify(g.termo)}">${esc(g.termo)}</dt><dd>${esc(g.def)}</dd>`).join('')}</dl>
        <section><h2>Guias</h2>${linkGuias(rel)}</section>`
    }));
}

/* ---------- Guias ---------- */
{
    const rel = '../';
    urlsExtras.push([`${SITE}/guias/`, 'monthly', '0.7']);
    escrever('guias/index.html', layout({
        rel, url: `${SITE}/guias/`, ativo: 'ajuda',
        titulo: `Guias para captar recursos com editais | ${NOME}`,
        descricao: 'Guias práticos para encontrar editais, reunir documentos, escrever propostas competitivas e prestar contas de projetos financiados.',
        corpo: `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <span aria-current="page">Guias</span></nav>
        <h1>Guias para captar recursos com editais</h1>
        <p class="sub">Do primeiro edital à prestação de contas.</p>
        <ul class="cartoes">${GUIAS.map(g => `<li class="cartao"><h3><a href="${rel}guias/${g.slug}/">${esc(g.titulo)}</a></h3><p>${esc(g.descricao)}</p></li>`).join('')}
            <li class="cartao"><h3><a href="${rel}glossario/" data-evento="glossario-abrir">Glossário de editais e fomento</a></h3><p>CAUC, MROSC, ICT, contrapartida, rubrica e outros termos explicados.</p></li></ul>`
    }));
    for (const g of GUIAS) {
        const relG = '../../';
        const url = `${SITE}/guias/${g.slug}/`;
        urlsExtras.push([url, 'monthly', '0.7']);
        const outros = GUIAS.filter(x => x.slug !== g.slug);
        escrever(`guias/${g.slug}/index.html`, layout({
            rel: relG, url, tipo: 'article', ativo: 'ajuda',
            titulo: `${g.titulo} | ${NOME}`, descricao: g.descricao,
            jsonld: { '@context': 'https://schema.org', '@graph': [
                { '@type': 'Article', headline: g.titulo, description: g.descricao, dateModified: g.atualizado, datePublished: g.atualizado, inLanguage: 'pt-BR', mainEntityOfPage: url, image: OG_IMG, author: { '@type': 'Organization', name: NOME, url: `${SITE}/` }, publisher: { '@type': 'Organization', name: NOME, url: `${SITE}/` } },
                { '@type': 'BreadcrumbList', itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE}/` },
                    { '@type': 'ListItem', position: 2, name: 'Guias', item: `${SITE}/guias/` },
                    { '@type': 'ListItem', position: 3, name: g.titulo, item: url }] }
            ] },
            corpo: `
        <nav class="migalhas" aria-label="Você está em"><a href="${relG}">Início</a> › <a href="${relG}guias/">Guias</a> › <span aria-current="page">${esc(g.titulo)}</span></nav>
        <article class="guia">
            <h1>${esc(g.titulo)}</h1>
            <p class="sub">${esc(g.descricao)}</p>
            <p class="nota">Atualizado em ${data(g.atualizado)} · Equipe ${NOME}</p>
            ${g.html.replace(/\{raiz\}/g, relG)}
        </article>
        <aside class="aviso">Este guia tem caráter informativo e não substitui o edital, o termo assinado nem a orientação jurídica ou contábil da sua instituição.</aside>
        <section><h2>Editais abertos agora</h2><ul class="cartoes">${vigentes(editais).slice(0, 3).map(e => cartao(e, relG)).join('')}</ul>
            <p><a href="${relG}editais/">Ver todos os editais <span aria-hidden="true">→</span></a></p></section>
        <section><h2>Outros guias</h2><ul class="lista">${outros.map(x => `<li><a href="${relG}guias/${x.slug}/">${esc(x.titulo)}</a></li>`).join('')}</ul></section>`
        }));
    }
}

/* ---------- Monetização: /anuncie/ (patrocínio), /apoie/ (Pix e Apoia.se), /parcerias/ (antigo endereço) ---------- */
// Textos em data/comercial.json; contatos e dados de pagamento em data/site.json (vazios = ocultos).
const sugestaoHref = cfg.formularioSugestao || `${REPO}/issues/new?template=sugerir-edital.yml`;
// Relatório de cliques só é oferecido quando há medição ativa (GoatCounter); sem ela não se promete (CDC, art. 30).
if (cfg.analytics?.goatcounter && ANU.relatorioCliques) {
    for (const p of ANU.pacotes || []) if (p.id !== 'institucional') p.inclui = [...(p.inclui || []), ANU.relatorioCliques.inclui];
    if (ANU.relatorioCliques.passo) ANU.comoFunciona = [...(ANU.comoFunciona || []), ANU.relatorioCliques.passo];
}
const arr = v => (Array.isArray(v) ? v : []);
const emailOk = s => /^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$/.test(String(s || '').trim());
const urlOk = s => !!linkSeguro(s);
// Só publica o que está em site.json: e-mail comercial → mailto com assunto; senão formulário; senão o formulário de parceria
const comercialHref = assunto => (emailOk(cfg.comercial?.email) ? `mailto:${cfg.comercial.email.trim()}?subject=${encodeURIComponent(assunto)}` : urlOk(cfg.comercial?.formulario) ? cfg.comercial.formulario.trim() : contatoHref);
const contatoEhGithub = !emailOk(cfg.comercial?.email) && !urlOk(cfg.comercial?.formulario) && !cfg.contato;
const alvo = href => (/^mailto:/.test(href) ? '' : ' target="_blank" rel="noopener"');
const brl = n => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2 }).format(Number(n));
const precoHTML = p => {
    const cheio = Number(p.precoCheio) || 0, lanc = Number(p.precoLancamento) || 0;
    // Sem "de/por" riscado: o preço cheio ainda não foi praticado (CDC art. 37, §1º)
    if (lanc > 0 && cheio > lanc) return `<strong class="preco-atual">${brl(lanc)}</strong> <span class="selo em-breve">Preço de lançamento</span><span class="preco-nota">válido para propostas aceitas até ${esc(p.validadeLancamento || '')}; depois, a tabela prevista é de ${brl(cheio)}</span>`;
    if (lanc > 0 || cheio > 0) return `<strong class="preco-atual">${brl(lanc || cheio)}</strong>`;
    return '<strong class="preco-atual">Sob consulta</strong>';
};
const REGRAS_BASE = [
    `Selo “Publicidade · Patrocinado por <nome do patrocinador>” sempre visível, com explicação em texto e link para estas regras.`,
    'O patrocínio não altera a busca, os filtros, a compatibilidade com o perfil nem a ordem das listas.',
    'O destaque ocupa uma vaga reservada e sinalizada (uma por página), fora da lista ordenada.',
    'Só chamadas reais, com inscrições abertas ou previstas. As curadas são conferidas por pessoa; as do Transferegov são lidas automaticamente e marcadas assim.'
];
const botaoTexto = ANU.chamada?.botao || 'Pedir proposta';
const pacotesAnu = arr(ANU.pacotes);
const idPacote = p => slugify(p.id || p.nome);
const SERV = ANU.servicos || {};
// formularios.pro tem prioridade; pro.listaEspera continua valendo (configuração antiga)
const proExterno = formularioExterno('pro') || linkSeguro(cfg.pro?.listaEspera);
const proHref = proExterno || (emailOk(cfg.comercial?.email) ? comercialHref(`Lista de espera — ${PRO.nome || 'Plano Pro'}`) : '');
// Botão para formulário externo: nova aba, sem iframe, com aviso de que o formulário é de outro serviço
const botaoFormulario = (rel, url, texto, evento) => `<div class="acoes"><a class="btn primario" href="${esc(url)}" target="_blank" rel="noopener" data-evento="${esc(evento)}">${esc(texto)}<span class="sr-only"> (abre um formulário em outro site)</span></a></div>
        <p class="nota">O formulário fica em ${esc(servicoDoFormulario(url))}, fora deste site. <a href="${rel}privacidade/#formularios-externos">Como tratamos esses dados</a>.</p>`;
const precoPro = Number(PRO.preco) > 0 ? Number(PRO.preco) : 49;
// Formulário de pedido sem servidor: monta um e-mail (mailto) com assunto e corpo preenchidos.
// Sem JavaScript, o formulário ainda abre o e-mail (campos viram parâmetros do mailto:).
const SCRIPT_PEDIDO = `(function(){var f=document.getElementById('pedido-form');if(!f)return;var st=document.getElementById('pedidoStatus'),sel=document.getElementById('pedPacote'),lk=document.getElementById('pedLink');function ajusta(){var serv=sel.value==='servicos';lk.required=!serv;document.getElementById('pedLinkObrig').hidden=serv;}sel.addEventListener('change',ajusta);ajusta();document.querySelectorAll('[data-pacote]').forEach(function(a){a.addEventListener('click',function(){sel.value=a.getAttribute('data-pacote');ajusta();setTimeout(function(){document.getElementById('pedOrg').focus();},0);});});f.addEventListener('submit',function(ev){ev.preventDefault();if(!f.reportValidity())return;var v=function(n){var el=f.elements[n];return el?String(el.value||'').trim():'';};var pac=sel.options[sel.selectedIndex].text;var nf=(f.querySelector('input[name=nf]:checked')||{}).value||'Não informado';var assunto='Pedido de proposta: '+pac+' — '+v('organizacao');var corpo=['Organização: '+v('organizacao'),'Link oficial do edital: '+(v('link')||'(não se aplica)'),'Pacote: '+pac,'Período desejado: '+(v('periodo')||'a combinar'),'Precisa de nota fiscal: '+nf,v('observacoes')?'Observações: '+v('observacoes'):''].filter(Boolean).join('\\n');var url='mailto:'+f.getAttribute('data-email')+'?subject='+encodeURIComponent(assunto)+'&body='+encodeURIComponent(corpo+'\\n');st.textContent='Abrimos o seu programa de e-mail com o pedido pronto. Revise e envie. Se nada abriu, escreva para '+f.getAttribute('data-email')+'.';window.location.href=url;});})();`;
{
    const rel = '../';
    const url = `${SITE}/anuncie/`;
    urlsExtras.push([url, 'monthly', '0.5']);
    const pacotes = pacotesAnu;
    const regras = arr(ANU.regras).length ? arr(ANU.regras) : REGRAS_BASE;
    const emailCom = emailOk(cfg.comercial?.email) ? cfg.comercial.email.trim() : '';
    const offers = pacotes.filter(p => Number(p.precoLancamento || p.precoCheio) > 0).map(p => ({ '@type': 'Offer', name: p.nome, price: Number(p.precoLancamento || p.precoCheio), priceCurrency: 'BRL', description: [p.periodo, p.vagas].filter(Boolean).join(' · '), url: `${url}#pacote-${idPacote(p)}` }));
    // Validade do preço de lançamento (a mesma em todos os pacotes, se for o caso)
    const validades = [...new Set(pacotes.map(p => p.validadeLancamento).filter(Boolean))];
    const temLancamento = pacotes.some(p => Number(p.precoLancamento) > 0 && Number(p.precoCheio) > Number(p.precoLancamento));
    const tabelaPrecos = pacotes.length ? `<div class="tabela-rolagem precos-resumo" role="region" aria-labelledby="precos-titulo" tabindex="0"><table class="tabela precos">
            <caption id="precos-titulo">${temLancamento ? `Preços de lançamento${validades.length === 1 ? ` (propostas aceitas até ${esc(validades[0])})` : ''}` : 'Preços'}</caption>
            <thead><tr><th scope="col">Pacote</th><th scope="col">Período</th><th scope="col">Preço</th></tr></thead>
            <tbody>${pacotes.map(p => {
                const cheio = Number(p.precoCheio) || 0, lanc = Number(p.precoLancamento) || 0;
                const preco = lanc > 0 && cheio > lanc ? `<strong>${brl(lanc)}</strong><small>depois, ${brl(cheio)}</small>` : lanc || cheio ? `<strong>${brl(lanc || cheio)}</strong>` : 'Sob consulta';
                return `<tr><th scope="row"><a href="#pacote-${idPacote(p)}">${esc(p.nome)}</a></th><td>${esc(p.periodo || '')}</td><td>${preco}</td></tr>`;
            }).join('')}
            ${SERV.titulo ? `<tr><th scope="row"><a href="#servicos">${esc(SERV.titulo)}</a></th><td>${esc(SERV.periodo || 'a combinar')}</td><td>Sob consulta</td></tr>` : ''}</tbody>
        </table></div>` : '';
    const colunas = pacotes.length % 3 === 0 ? 3 : pacotes.length === 1 ? 1 : 2;
    const pedido = emailCom ? `<section id="pedido" class="chamada" aria-labelledby="pedido-titulo">
            <h2 id="pedido-titulo">${esc(ANU.chamada?.titulo || 'Peça uma proposta')}</h2>
            ${ANU.chamada?.texto ? `<p>${esc(ANU.chamada.texto)}</p>` : ''}
            <p><strong>Respondemos em até 2 dias úteis.</strong></p>
            <form id="pedido-form" class="formulario" action="mailto:${esc(emailCom)}" method="get" enctype="text/plain" data-email="${esc(emailCom)}">
                <div class="campo"><label for="pedOrg">Organização <span class="obrig">(obrigatório)</span></label>
                    <input id="pedOrg" name="organizacao" type="text" required autocomplete="organization"></div>
                <div class="campo"><label for="pedLink">Link oficial do edital <span class="obrig" id="pedLinkObrig">(obrigatório)</span></label>
                    <input id="pedLink" name="link" type="url" required inputmode="url" placeholder="https://" aria-describedby="pedLinkDica">
                    <p class="dica" id="pedLinkDica">Página ou PDF da chamada na fonte oficial. Para o espaço Serviços, deixe em branco.</p></div>
                <div class="campo"><label for="pedPacote">Pacote</label>
                    <select id="pedPacote" name="pacote">${pacotes.map(p => `<option value="${esc(idPacote(p))}"${p.destaque ? ' selected' : ''}>${esc(p.nome)}</option>`).join('')}${SERV.titulo ? `<option value="servicos">${esc(SERV.titulo)}</option>` : ''}<option value="nao-sei">Ainda não sei: quero orientação</option></select></div>
                <div class="campo"><label for="pedPeriodo">Período desejado</label>
                    <input id="pedPeriodo" name="periodo" type="text" placeholder="Ex.: 30 dias a partir de 01/12/2026" aria-describedby="pedPeriodoDica">
                    <p class="dica" id="pedPeriodoDica">Início e duração. Confirmamos a disponibilidade das vagas na proposta.</p></div>
                <fieldset class="campo"><legend>Precisa de nota fiscal?</legend>
                    <div class="opcoes"><label><input type="radio" name="nf" value="Não" checked> Não</label><label><input type="radio" name="nf" value="Sim"> Sim</label></div>
                    <p class="dica">Ainda não emitimos nota fiscal (contratação com pessoa física). Se precisar, avisamos quando for possível.</p></fieldset>
                <div class="campo"><label for="pedObs">Observações (opcional)</label>
                    <textarea id="pedObs" name="observacoes" rows="3"></textarea></div>
                <div class="acoes"><button type="submit" class="btn primario" data-evento="anuncie-pedido">Montar e-mail do pedido</button></div>
                <p class="nota">Nada é enviado por este site: o botão abre o seu programa de e-mail com a mensagem pronta para <a href="${esc(comercialHref(`Anunciar no ${NOME}`))}">${esc(emailCom)}</a>. Você revisa e envia. Não guardamos o que é digitado aqui.</p>
                <p class="nota" role="status" aria-live="polite" id="pedidoStatus"></p>
            </form>
        </section>` : `<section class="chamada" id="pedido" aria-labelledby="pedido-titulo">
            <h2 id="pedido-titulo">${esc(ANU.chamada?.titulo || 'Vamos conversar?')}</h2>
            ${ANU.chamada?.texto ? `<p>${esc(ANU.chamada.texto)}</p>` : ''}
            <div class="acoes"><a class="btn primario" href="${esc(comercialHref(`Anunciar no ${NOME}`))}"${alvo(comercialHref(''))} data-evento="anuncie-contato">${esc(botaoTexto)}</a></div>
            ${contatoEhGithub ? '<p class="nota">O formulário de parceria fica no GitHub e é público: descreva a chamada e o período, sem dados pessoais. Combinamos o restante em contato privado.</p>' : ''}
        </section>`;
    escrever('anuncie/index.html', layout({
        rel, url, ativo: 'anuncie',
        titulo: `${ANU.titulo || 'Anuncie'}: destaque patrocinado de editais | ${NOME}`,
        descricao: corta(`${ANU.subtitulo ? ANU.subtitulo + ' ' : ''}Destaque patrocinado de editais com selo transparente, vaga reservada e regras claras.`, 158),
        jsonld: { '@context': 'https://schema.org', '@type': 'Service', name: ANU.titulo || `Anuncie no ${NOME}`, serviceType: 'Destaque patrocinado de editais', description: ANU.subtitulo || '', url, areaServed: { '@type': 'Country', name: 'Brasil' }, provider: { '@type': 'Organization', name: NOME, url: `${SITE}/` }, offers },
        corpo: `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <span aria-current="page">Anuncie</span></nav>
        <h1>${esc(ANU.titulo || `Anuncie no ${NOME}`)}</h1>
        ${tabelaPrecos}
        <div class="acoes"><a class="btn primario" href="#pedido" data-evento="anuncie-contato">${esc(botaoTexto)}</a> <a class="btn" href="#pacotes">Comparar pacotes</a> <a class="btn" href="#regras">Ver as regras</a></div>
        ${ANU.subtitulo ? `<p class="sub">${esc(ANU.subtitulo)}</p>` : ''}
        ${arr(ANU.paraQuem).length ? `<section aria-labelledby="para-quem"><h2 id="para-quem">Para quem é</h2><ul class="lista">${arr(ANU.paraQuem).map(t => `<li>${esc(t)}</li>`).join('')}</ul></section>` : ''}
        ${arr(ANU.porQue).length ? `<section aria-labelledby="por-que"><h2 id="por-que">Por que anunciar aqui</h2><ul class="grade-blocos">${arr(ANU.porQue).map(b => `<li><h3>${esc(b.titulo)}</h3><p>${esc(b.texto)}</p></li>`).join('')}</ul></section>` : ''}
        ${pacotes.length ? `<section id="pacotes" aria-labelledby="pacotes-titulo"><h2 id="pacotes-titulo">Pacotes</h2>
            <ul class="pacotes colunas-${colunas}">${pacotes.map(p => `<li class="pacote${p.destaque ? ' recomendado' : ''}" id="pacote-${idPacote(p)}">
                ${p.destaque ? '<p class="pacote-marca">Recomendado</p>' : ''}
                <h3>${esc(p.nome)}</h3>
                <p class="preco">${precoHTML(p)}</p>
                ${p.periodo || p.vagas ? `<p class="nota">${esc([p.periodo, p.vagas].filter(Boolean).join(' · '))}</p>` : ''}
                ${arr(p.inclui).length ? `<p class="rotulo-lista">Inclui</p><ul class="lista">${arr(p.inclui).map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
                ${arr(p.naoInclui).length ? `<p class="rotulo-lista">Não inclui</p><ul class="lista nao-inclui">${arr(p.naoInclui).map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
                <a class="btn${p.destaque ? ' primario' : ''}" href="#pedido" data-pacote="${esc(idPacote(p))}" data-evento="anuncie-pacote-${esc(idPacote(p))}">Pedir este pacote<span class="sr-only">: ${esc(p.nome)}</span></a>
            </li>`).join('')}</ul>
            <p class="nota">Cobrança por proposta comercial, combinada diretamente com a responsável pelo site. Publicar uma chamada continua gratuito: <a href="${rel}sugerir-edital/">sugira um edital</a>.${ANU.notaResumo ? ` ${esc(ANU.notaResumo)}` : ''}</p></section>` : ''}
        ${SERV.titulo ? `<section id="servicos" aria-labelledby="servicos-titulo"><h2 id="servicos-titulo">${esc(SERV.titulo)}</h2>
            ${SERV.texto ? `<p>${esc(SERV.texto)}</p>` : ''}
            <p class="selos"><span class="selo servico">${esc(SERV.selo || 'Publicidade · Serviço')}</span></p>
            ${arr(SERV.regras).length ? `<ul class="lista">${arr(SERV.regras).map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
            ${SERV.nota ? `<p class="nota">${esc(SERV.nota)}</p>` : ''}</section>` : ''}
        ${arr(ANU.comoFunciona).length ? `<section aria-labelledby="como-funciona"><h2 id="como-funciona">Como funciona</h2><ol class="passos">${arr(ANU.comoFunciona).map(b => `<li><h3>${esc(b.titulo)}</h3><p>${esc(b.texto)}</p></li>`).join('')}</ol></section>` : ''}
        ${pedido}
        <section id="regras" aria-labelledby="regras-titulo"><h2 id="regras-titulo">Regras do patrocínio</h2>
            <ul class="lista">${regras.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
            <p class="nota">Publicidade identificada como tal, conforme o Código de Defesa do Consumidor (arts. 36 e 37) e o Código Brasileiro de Autorregulamentação Publicitária (CONAR). Nenhum dado pessoal de quem usa o site é vendido ou repassado a patrocinadores: o relatório traz apenas contagens agregadas de cliques.</p></section>
        ${arr(ANU.faq).length ? `<section aria-labelledby="faq"><h2 id="faq">Perguntas frequentes</h2><div class="faq">${arr(ANU.faq).map(q => `<details><summary>${esc(q.pergunta)}</summary><p>${esc(q.resposta)}</p></details>`).join('')}</div></section>` : ''}
        ${emailCom ? `<script>${SCRIPT_PEDIDO}</script>` : ''}`
    }));
}
// Copiar texto de um campo (botões com data-copiar="<id>")
const SCRIPT_COPIAR = `document.querySelectorAll('[data-copiar]').forEach(function(b){b.addEventListener('click',function(){var el=document.getElementById(b.getAttribute('data-copiar')),st=document.getElementById('copiaStatus');var ok=function(){st.textContent='Texto copiado. Confira antes de publicar.';};var manual=function(){el.focus();el.select();st.textContent='Selecionamos o texto: use Copiar do seu aparelho.';};if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(el.value).then(ok,manual);else manual();});});`;
// Lista de espera sem servidor: monta um e-mail com as respostas (cada campo tem data-rotulo).
const SCRIPT_ESPERA = `document.querySelectorAll('form[data-espera]').forEach(function(f){var st=f.querySelector('[role=status]');f.addEventListener('submit',function(ev){ev.preventDefault();if(!f.reportValidity())return;var linhas=[],vistos={};[].forEach.call(f.elements,function(el){if(!el.name||vistos[el.name]||el.type==='submit')return;var r=el.getAttribute('data-rotulo')||el.name;var v;if(el.type==='checkbox'||el.type==='radio'){vistos[el.name]=1;v=[].filter.call(f.querySelectorAll('[name="'+el.name+'"]'),function(x){return x.checked;}).map(function(x){return x.value;}).join('; ');r=(f.querySelector('[name="'+el.name+'"]').closest('fieldset')||{}).getAttribute?f.querySelector('[name="'+el.name+'"]').closest('fieldset').getAttribute('data-rotulo')||r:r;}else{v=String(el.value||'').trim();}if(v)linhas.push(r.replace(/[?:]\s*$/,'')+': '+v);});var org=(f.elements.organizacao||{}).value||'';var assunto=f.getAttribute('data-assunto')+(org?' — '+org.trim():'');var url='mailto:'+f.getAttribute('data-email')+'?subject='+encodeURIComponent(assunto)+'&body='+encodeURIComponent(linhas.join('\\n')+'\\n');if(window.goatcounter&&window.goatcounter.count)window.goatcounter.count({path:f.getAttribute('data-evento')+'-enviar',title:f.getAttribute('data-evento'),event:true});st.textContent='Abrimos o seu e-mail com as respostas prontas. Revise e envie. Se nada abriu, escreva para '+f.getAttribute('data-email')+'.';window.location.href=url;});});`;
const CAMPOS_PRO = [
    { nome: 'organizacao', rotulo: 'Organização ou nome profissional', tipo: 'text', obrig: true, auto: 'organization' },
    { nome: 'perfil', rotulo: 'Você é', tipo: 'select', opcoes: ['Consultoria de captação', 'Captador(a) autônomo(a)', 'ONG, associação ou cooperativa', 'Universidade ou instituto', 'Empresa', 'Prefeitura ou governo', 'Outro'] },
    { nome: 'clientes', rotulo: 'Para quantos clientes ou projetos você procura editais?', tipo: 'select', opcoes: ['Só para a minha organização', '2 a 5', '6 a 20', 'Mais de 20'] },
    { nome: 'prioridades', rotulo: 'O que seria mais útil? (marque até 3)', tipo: 'checkbox', opcoes: ['Alertas por e-mail', 'Alertas por WhatsApp', 'Um perfil para cada cliente', 'Acesso da equipe', 'Relatório com a minha marca', 'Histórico de cada financiador'] },
    { nome: 'preco', rotulo: 'Quanto pagaria por mês?', tipo: 'radio', opcoes: ['Até R$ 29', 'R$ 49', 'R$ 99 a R$ 149 para a equipe', 'Não pagaria; uso só o gratuito'] },
    { nome: 'consentimento', rotulo: 'Consentimento', tipo: 'aceite', texto: 'Quero ser avisado(a) do lançamento. Posso sair da lista quando quiser.' }
];
const CAMPOS_RADAR = [
    { nome: 'organizacao', rotulo: 'Município ou entidade', tipo: 'text', obrig: true, auto: 'organization', dica: 'Ex.: Prefeitura de …, Associação dos Municípios de …, Consórcio Intermunicipal …' },
    { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: ['Prefeitura', 'Associação de municípios', 'Consórcio público', 'Câmara municipal', 'Outro'] },
    { nome: 'municipios', rotulo: 'Quantos municípios?', tipo: 'select', opcoes: ['1', '2 a 10', '11 a 30', 'Mais de 30'] },
    { nome: 'funcao', rotulo: 'Sua função', tipo: 'text', auto: 'organization-title', dica: 'Ex.: secretária de planejamento, assessor de convênios, prefeito' },
    { nome: 'interesse', rotulo: 'Interesse', tipo: 'radio', obrig: true, opcoes: ['Participar do piloto', 'Receber uma proposta', 'Só conhecer por enquanto'] },
    { nome: 'consentimento', rotulo: 'Consentimento', tipo: 'aceite', texto: 'Aceito ser contatado(a) sobre o Radar. Posso sair da lista quando quiser.' }
];
function formEspera({ id, titulo, assunto, evento, campos }) {
    const email = cfg.comercial.email.trim();
    const campo = c => {
        const idc = `${id}-${c.nome}`;
        if (c.tipo === 'select') return `<div class="campo"><label for="${idc}">${esc(c.rotulo)}</label><select id="${idc}" name="${c.nome}" data-rotulo="${esc(c.rotulo)}">${c.opcoes.map(o => `<option>${esc(o)}</option>`).join('')}</select></div>`;
        if (c.tipo === 'checkbox' || c.tipo === 'radio') return `<fieldset class="campo" data-rotulo="${esc(c.rotulo)}"><legend>${esc(c.rotulo)}${c.obrig ? ' <span class="obrig">(obrigatório)</span>' : ''}</legend><div class="opcoes">${c.opcoes.map((o, i) => `<label><input type="${c.tipo}" name="${c.nome}" value="${esc(o)}"${c.tipo === 'radio' && c.obrig && i === 0 ? ' required' : ''}> ${esc(o)}</label>`).join('')}</div></fieldset>`;
        if (c.tipo === 'aceite') return `<div class="campo"><label><input type="checkbox" name="${c.nome}" value="Sim" required data-rotulo="${esc(c.rotulo)}"> ${esc(c.texto)}</label></div>`;
        return `<div class="campo"><label for="${idc}">${esc(c.rotulo)}${c.obrig ? ' <span class="obrig">(obrigatório)</span>' : ''}</label><input id="${idc}" name="${c.nome}" type="text"${c.obrig ? ' required' : ''}${c.auto ? ` autocomplete="${c.auto}"` : ''} data-rotulo="${esc(c.rotulo)}">${c.dica ? `<p class="dica">${esc(c.dica)}</p>` : ''}</div>`;
    };
    return `<section class="chamada" id="${id}" aria-labelledby="${id}-titulo">
            <h2 id="${id}-titulo">${esc(titulo)}</h2>
            <form class="formulario" data-espera data-email="${esc(email)}" data-assunto="${esc(assunto)}" data-evento="${esc(evento)}" action="mailto:${esc(email)}" method="get" enctype="text/plain">
                ${campos.map(campo).join('\n                ')}
                <div class="acoes"><button type="submit" class="btn primario" data-evento="${esc(evento)}">Montar e-mail de inscrição</button></div>
                <p class="nota">Nada é enviado por este site: o botão abre o seu programa de e-mail com as respostas prontas para ${esc(email)}. Você revisa e envia. Seu e-mail de contato é o próprio remetente.</p>
                <p class="nota" role="status" aria-live="polite"></p>
            </form>
        </section>`;
}

/* ---------- Plano Pro (em breve): página própria, fora de /anuncie/ ---------- */
{
    const rel = '../';
    const url = `${SITE}/pro/`;
    urlsExtras.push([url, 'monthly', '0.3']);
    escrever('pro/index.html', layout({
        rel, url,
        titulo: `${PRO.nome || 'Plano Pro'} (em breve) para consultorias e captadores | ${NOME}`,
        descricao: corta(`${PRO.nome || 'Plano Pro'}, em breve: alertas por perfil, vários perfis de busca e acesso para a equipe. Entre na lista de espera, sem cobrança.`, 158),
        jsonld: { '@context': 'https://schema.org', '@type': 'Product', name: PRO.nome || 'Plano Pro', description: PRO.chamada || '', offers: { '@type': 'Offer', price: precoPro, priceCurrency: 'BRL', availability: 'https://schema.org/PreOrder', url } },
        corpo: `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <span aria-current="page">${esc(PRO.nome || 'Plano Pro')}</span></nav>
        <p class="selos"><span class="selo neutro">${esc(PRO.status || 'Em breve')}</span></p>
        <h1>${esc(PRO.nome || 'Plano Pro')}</h1>
        ${PRO.chamada ? `<p class="sub">${esc(PRO.chamada)}</p>` : ''}
        <section id="pro" class="bloco-pro" aria-labelledby="pro-titulo">
            <h2 id="pro-titulo">O que vai incluir</h2>
            <p class="preco"><strong class="preco-atual">${brl(precoPro)}</strong><span><span aria-hidden="true">/</span><span class="sr-only">por </span>${esc(PRO.periodo || 'mês')}</span></p>
            ${arr(PRO.inclui).length ? `<ul class="lista">${arr(PRO.inclui).map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
            <p class="nota">Ainda não está à venda: a lista de espera não gera cobrança nem compromisso. Tudo o que é gratuito hoje continua gratuito.</p>
        </section>
        ${proExterno ? botaoFormulario(rel, proExterno, PRO.botao || 'Entrar na lista de espera', 'pro-lista-espera pro-formulario') : emailOk(cfg.comercial?.email) ? formEspera({ id: 'espera-pro', titulo: 'Entrar na lista de espera', assunto: `Lista de espera — ${PRO.nome || 'Plano Pro'}`, evento: 'pro-lista-espera', campos: CAMPOS_PRO }) : `<div class="acoes">${proHref ? `<a class="btn primario" href="${esc(proHref)}"${alvo(proHref)} data-evento="pro-lista-espera">${esc(PRO.botao || 'Entrar na lista de espera')}</a>` : '<p class="nota">A lista de espera abre em breve.</p>'}</div>`}
        <p class="nota">Como tratamos os dados da lista de espera: veja a <a href="${rel}privacidade/#lista-espera">Política de Privacidade</a>.</p>
        <script>${SCRIPT_ESPERA}</script>`
    }));
}

/* ---------- Radar para municípios pequenos (em construção): piloto em São Paulo, modelo de relatório e formulário ---------- */
// O modelo de relatório é um EXEMPLO FICTÍCIO: município, valores, números e datas inventados (datas relativas a hoje,
// para o exemplo não envelhecer). Nenhum dado real de município aparece nesta página.
{
    const rel = '../';
    const url = `${SITE}/radar-municipios/`;
    urlsExtras.push([url, 'monthly', '0.5']);
    const progMun = editais.filter(e => statusEm(e) !== 'fechado' && e.publico.includes('municipio')).length;
    const radarExterno = formularioExterno('radar');
    const d = n => data(somaDias(hoje, n)), dd = n => dm(somaDias(hoje, n));
    const semaforo = [
        ['regular', 'Regular', 'Dívidas com a Receita Federal e a Dívida Ativa da União', 'Certidão em dia: nada a fazer agora.', `válida até ${dd(74)}`],
        ['atencao', 'Atenção', 'FGTS (certificado de regularidade)', `O certificado vence em 6 dias. Peça a renovação na Caixa antes de ${dd(6)} para não travar repasses.`, `vence em ${dd(6)}`],
        ['bloqueia', 'Pendente: bloqueia repasses', 'Relatórios fiscais no Siconfi (RREO do bimestre)', 'O relatório do último bimestre não foi enviado ao Tesouro. Enquanto faltar, a prefeitura não pode receber transferências voluntárias da União. Fale com a contabilidade.', `pendente desde ${dd(-30)}`],
        ['regular', 'Regular', 'Prestação de contas de convênios antigos', 'Nenhuma prestação de contas atrasada.', `conferido em ${dd(-1)}`],
        ['regular', 'Regular', 'Gasto mínimo em educação e saúde (Siope e Siops)', 'Os dados do ano anterior foram enviados e cumprem o mínimo.', `conferido em ${dd(-1)}`]
    ];
    const programas = [
        ['Programa federal de estradas vicinais (exemplo)', 'Ministério da área', dd(12), 'Sim: municípios de até 50 mil habitantes', 'Enviar a proposta no Transferegov'],
        ['Equipamentos para a agricultura familiar (exemplo)', 'Ministério da área', dd(26), 'Sim, com contrapartida de 1%', 'Separar orçamentos de 3 fornecedores'],
        ['Reforma de unidades básicas de saúde (exemplo)', 'Ministério da área', dd(40), 'Depende: exige terreno regularizado', 'Confirmar a matrícula do terreno']
    ];
    const emendas = [
        ['Emenda individual nº 0000.0000 (fictícia)', 'R$ 350 mil', 'Pavimentação de vias urbanas', `Aguardando o plano de trabalho até ${dd(9)}`],
        ['Emenda de bancada nº 0000.0001 (fictícia)', 'R$ 120 mil', 'Compra de ambulância', 'Plano de trabalho aprovado; aguardando empenho']
    ];
    const propostas = [
        ['Proposta 000000/2026 (fictícia)', 'Em análise no ministério', `Responder à diligência: anexar o orçamento detalhado até ${dd(5)}`],
        ['Proposta 000001/2026 (fictícia)', 'Rascunho no Transferegov', 'Só pode ser enviada com o CAUC regular']
    ];
    const tarefas = [
        ['Hoje', 'Pedir à contabilidade o envio do RREO ao Siconfi: sem isso, nenhum repasse novo sai.'],
        [`Até ${dd(5)}`, 'Anexar o orçamento detalhado na proposta 000000/2026 (responde à diligência).'],
        [`Até ${dd(6)}`, 'Renovar o certificado do FGTS na Caixa.'],
        [`Até ${dd(9)}`, 'Cadastrar o plano de trabalho da emenda de pavimentação.'],
        [`Até ${dd(12)}`, 'Enviar a proposta do programa de estradas vicinais.']
    ];
    const fontes = [
        ['CAUC (Tesouro Nacional)', 'situação do município para receber transferências', d(-1)],
        ['Transferegov.br', 'programas abertos, propostas e planos de trabalho', d(-1)],
        ['Portal da Transparência e Transferegov.br', 'emendas parlamentares destinadas ao município', d(-2)],
        ['Siconfi (Tesouro Nacional)', 'envio dos relatórios fiscais', d(-1)]
    ];
    const tabela = (cap, cab, linhas) => `<div class="tabela-rolagem" role="region" aria-label="${esc(cap)}" tabindex="0"><table class="tabela"><thead><tr>${cab.map(c => `<th scope="col">${c}</th>`).join('')}</tr></thead><tbody>${linhas.map(l => `<tr>${l.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const relatorio = `<article class="relatorio" aria-labelledby="relatorio-titulo">
            <p class="relatorio-rotulo"><strong>Exemplo fictício</strong> · município, números, valores e datas inventados para mostrar o formato. Não são dados reais.</p>
            <header class="relatorio-topo">
                <h3 id="relatorio-titulo">Radar semanal · Município Exemplo (SP)</h3>
                <p class="nota">Semana de ${d(0)} · cerca de 9 mil habitantes · 1 página</p>
            </header>
            <section aria-labelledby="rel-cauc"><h4 id="rel-cauc">1. Semáforo do CAUC</h4>
                <p class="nota">O CAUC é o cadastro do Tesouro Nacional que diz se a prefeitura pode receber dinheiro de convênios e transferências da União. Um item pendente basta para travar repasses.</p>
                <ul class="semaforo">${semaforo.map(([cls, rot, item, expl, quando]) => `<li class="sinal-${cls}"><span class="sinal">${esc(rot)}</span><div><strong>${esc(item)}</strong> <span class="nota">· ${esc(quando)}</span><p>${esc(expl)}</p></div></li>`).join('')}</ul></section>
            <section aria-labelledby="rel-prog"><h4 id="rel-prog">2. Programas abertos em que o município pode entrar</h4>
                ${tabela('Programas abertos (exemplo)', ['Programa', 'Órgão', 'Prazo', 'Pode entrar?', 'Próximo passo'], programas)}</section>
            <section aria-labelledby="rel-emendas"><h4 id="rel-emendas">3. Emendas destinadas e situação</h4>
                ${tabela('Emendas (exemplo)', ['Emenda', 'Valor', 'Para quê', 'Situação'], emendas)}</section>
            <section aria-labelledby="rel-propostas"><h4 id="rel-propostas">4. Propostas em andamento</h4>
                ${tabela('Propostas (exemplo)', ['Proposta', 'Situação', 'Pendência'], propostas)}</section>
            <section aria-labelledby="rel-fazer"><h4 id="rel-fazer">5. O que fazer até cada prazo</h4>
                <ol class="tarefas">${tarefas.map(([q, t]) => `<li><span class="data">${esc(q)}</span> <span>${esc(t)}</span></li>`).join('')}</ol></section>
            <section aria-labelledby="rel-fontes"><h4 id="rel-fontes">6. Fontes e data de cada fonte</h4>
                <ul class="lista">${fontes.map(([f, o, q]) => `<li><strong>${esc(f)}</strong>: ${esc(o)} · consultado em ${q}</li>`).join('')}</ul>
                <p class="nota">Cada informação do relatório leva a fonte oficial e a data da consulta. Confirme sempre na fonte antes de agir.</p></section>
        </article>`;
    escrever('radar-municipios/index.html', layout({
        rel, url,
        titulo: `Radar para municípios pequenos de SP: CAUC, programas e emendas | ${NOME}`,
        descricao: corta('Toda semana, para cada município: programas abertos, pendências no CAUC, emendas e prazos, e o que fazer até cada prazo. Piloto gratuito com prefeituras pequenas de SP.', 158),
        corpo: `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <a href="${rel}para/${PUBLICOS_HUB.municipio?.slug || 'municipios-e-prefeituras'}/">Municípios</a> › <span aria-current="page">Radar para municípios</span></nav>
        <p class="selos"><span class="selo neutro">Em construção</span> <span class="selo neutro">Piloto gratuito em São Paulo</span></p>
        <h1>Radar para municípios pequenos</h1>
        <p class="sub">Para prefeituras pequenas e associações de municípios de São Paulo. Toda semana, para cada município: programas abertos em que pode entrar, pendências no CAUC que bloqueiam repasses, emendas destinadas e prazos, e o que fazer até cada prazo.</p>
        <div class="acoes"><a class="btn primario" href="#radar-contato" data-evento="radar-quero">Quero participar do piloto</a> <a class="btn" href="#modelo" data-evento="radar-modelo">Ver modelo de relatório</a></div>
        <section aria-labelledby="radar-para-quem"><h2 id="radar-para-quem">Para quem é</h2><ul class="lista">
            <li><strong>Prefeituras pequenas</strong>, que muitas vezes têm uma ou duas pessoas cuidando de convênios, sem tempo para acompanhar todos os sistemas.</li>
            <li><strong>Associações e consórcios de municípios</strong>, que apoiam várias prefeituras ao mesmo tempo.</li>
            <li>No piloto: municípios paulistas com até 20 mil habitantes (são 393 no estado).</li>
        </ul></section>
        <section aria-labelledby="radar-semana"><h2 id="radar-semana">O que chega toda semana</h2>
            <ul class="grade-blocos">
                <li><h3>Programas abertos</h3><p>Programas federais e editais em que o município pode entrar, com prazo e próximo passo. Hoje o site já reúne ${plural(progMun, 'programa ou edital aberto', 'programas e editais abertos')} para municípios.</p></li>
                <li><h3>Semáforo do CAUC</h3><p>O que está regular, o que vence logo e o que já bloqueia repasses, explicado em linguagem simples.</p></li>
                <li><h3>Emendas e propostas</h3><p>Emendas destinadas ao município, propostas em andamento e o que falta em cada uma.</p></li>
                <li><h3>O que fazer até cada prazo</h3><p>Uma lista curta, em ordem de data, para a equipe agir antes de perder o recurso.</p></li>
            </ul></section>
        <section aria-labelledby="radar-piloto"><h2 id="radar-piloto">Piloto em São Paulo</h2>
            <ul class="lista">
                <li>Até <strong>3 associações ou consórcios</strong>, ou até <strong>10 municípios</strong>.</li>
                <li><strong>Gratuito durante o piloto.</strong> Em troca, pedimos retorno sobre o relatório (o que ajuda, o que falta) e, se o Radar for útil, uma carta de apoio.</li>
                <li>O relatório usa só dados públicos oficiais: não pedimos senha nem acesso aos sistemas da prefeitura.</li>
            </ul>
            <p class="aviso"><strong>Em construção.</strong> O Radar está sendo construído junto com quem participar do piloto. A contratação depois do piloto exige CNPJ, que está em preparação. Participar do piloto não gera cobrança nem compromisso de contratar. O resto do site continua gratuito para todos.</p></section>
        <section id="modelo" aria-labelledby="modelo-titulo"><h2 id="modelo-titulo">Modelo de relatório (exemplo fictício)</h2>
            <p>Assim deve ficar o relatório semanal de cada município: uma página, com a fonte e a data de cada informação.</p>
            ${relatorio}</section>
        ${radarExterno ? `<section class="chamada" id="radar-contato" aria-labelledby="radar-contato-titulo">
            <h2 id="radar-contato-titulo">Quero participar ou saber mais</h2>
            <p>Conte qual é o município ou a entidade, quantos municípios são e qual é o seu interesse: participar do piloto, receber uma proposta ou só conhecer.</p>
            ${botaoFormulario(rel, radarExterno, 'Abrir o formulário do Radar', 'radar-lista-espera radar-formulario')}
        </section>` : emailOk(cfg.comercial?.email) ? formEspera({ id: 'radar-contato', titulo: 'Quero participar ou saber mais', assunto: 'Radar para municípios — piloto SP', evento: 'radar-lista-espera', campos: CAMPOS_RADAR }) : `<section class="chamada" id="radar-contato"><h2>Quero participar ou saber mais</h2><div class="acoes"><a class="btn primario" href="${esc(contatoHref)}"${alvo(contatoHref)} data-evento="radar-lista-espera">Falar com a equipe</a></div></section>`}
        <p class="nota">Como tratamos os dados deste contato: veja a <a href="${rel}privacidade/#lista-espera">Política de Privacidade</a>.</p>
        <script>${SCRIPT_ESPERA}</script>`
    }));
}

/* ---------- Divulgar (uso interno): post semanal pronto para WhatsApp e LinkedIn ---------- */
{
    const rel = '../';
    const fimJanela = somaDias(hoje, 15);
    const fecham = editais.filter(e => statusEm(e) === 'aberto' && e.encerramento <= fimJanela && !patrocinado(e)).sort((a, b) => a.encerramento.localeCompare(b.encerramento)).slice(0, 10);
    const novos = editais.filter(e => statusEm(e) !== 'fechado' && e.publicadoEm && e.publicadoEm >= somaDias(hoje, -7) && e.publicadoEm <= hoje).slice(0, 6);
    const curto = t => (t.length > 90 ? t.slice(0, 87).replace(/\s+\S*$/, '') + '…' : t);
    const linhaWhats = e => `• *${curto(nomeEdital(e))}* (${e.instituicao})\nQuem pode pedir: ${quemPodePedir(e)} · Prazo: ${data(e.encerramento)}\n${SITE}/editais/${slugEdital(e)}/`;
    const linhaLinked = e => `→ ${curto(nomeEdital(e))} (${e.instituicao}). Prazo: ${data(e.encerramento)}. ${SITE}/editais/${slugEdital(e)}/`;
    const whats = [`*Editais que fecham nos próximos 15 dias* (atualizado em ${data(hoje)})`, '', ...fecham.map(linhaWhats).join('\n\n').split('\n'),
        ...(novos.length ? ['', '*Novos esta semana*', '', ...novos.map(linhaWhats).join('\n\n').split('\n')] : []),
        '', `Todos os prazos: ${SITE}/prazos/`, `${NOME}: editais de fomento com fonte oficial, de graça.`].join('\n');
    const linked = [`Editais de fomento que fecham nos próximos 15 dias (${data(hoje)}):`, '', ...fecham.map(linhaLinked),
        ...(novos.length ? ['', 'Novos esta semana:', ...novos.map(linhaLinked)] : []),
        '', `A lista completa, com quem pode participar e o teste "Posso concorrer?", está em ${SITE}/prazos/`, '', '#captaçãoderecursos #editais #terceirosetor #pesquisa #fomento'].join('\n');
    escrever('divulgar/index.html', layout({
        rel, url: `${SITE}/divulgar/`, robots: 'noindex,nofollow',
        titulo: `Divulgar: post semanal pronto | ${NOME}`,
        descricao: 'Texto pronto para divulgar os editais da semana no WhatsApp e no LinkedIn.',
        corpo: `
        <h1>Post semanal pronto</h1>
        <p class="sub">Atualizado todo dia. Copie, confira e publique no canal do WhatsApp, em grupos e no LinkedIn. ${plural(fecham.length, 'edital fecha', 'editais fecham')} nos próximos 15 dias${novos.length ? `; ${plural(novos.length, 'novo', 'novos')} nesta semana` : ''}.</p>
        <section aria-labelledby="t-whats"><h2 id="t-whats">WhatsApp</h2>
            <textarea id="postWhats" class="pix-codigo" rows="16" readonly spellcheck="false">${esc(whats)}</textarea>
            <p><button type="button" class="btn primario" data-copiar="postWhats" data-evento="divulgar-copiar-whats">Copiar texto do WhatsApp</button>
            <a class="btn" href="https://wa.me/?text=${encodeURIComponent(whats)}" target="_blank" rel="noopener noreferrer">Abrir no WhatsApp</a></p></section>
        <section aria-labelledby="t-linked"><h2 id="t-linked">LinkedIn</h2>
            <textarea id="postLinked" class="pix-codigo" rows="14" readonly spellcheck="false">${esc(linked)}</textarea>
            <p><button type="button" class="btn primario" data-copiar="postLinked" data-evento="divulgar-copiar-linkedin">Copiar texto do LinkedIn</button></p></section>
        <p class="nota" role="status" aria-live="polite" id="copiaStatus"></p>
        <p class="nota">Esta página não aparece no Google nem no menu. Editais patrocinados ficam de fora do post, para manter a lista neutra.</p>
        <script>${SCRIPT_COPIAR}</script>`
    }));
}
{
    const rel = '../';
    const url = `${SITE}/apoie/`;
    urlsExtras.push([url, 'monthly', '0.5']);
    let pix = null;
    if (pixCfg.chave) {
        try {
            const codigo = brCodePix({ chave: pixCfg.chave, nome: pixCfg.nome || NOME, cidade: pixCfg.cidade || 'BRASIL' });
            pix = { codigo, qr: qrSvg(codigo, { rotulo: 'QR Code do Pix para apoiar o projeto' }) };
        } catch (err) { avisos.push(`Pix não gerado: ${err.message}`); }
    }
    const apoiase = urlOk(cfg.apoio?.apoiase) ? cfg.apoio.apoiase.trim() : '';
    const outro = urlOk(cfg.apoio?.url) && cfg.apoio.url.trim() !== apoiase ? cfg.apoio.url.trim() : '';
    const formasTxt = Object.fromEntries(arr(APO.formas).map(f => [f.id, f]));
    const formaPix = pix ? `<section class="forma" id="pix" aria-labelledby="pix-titulo">
            <h2 id="pix-titulo">${esc(formasTxt.pix?.titulo || 'Pix')}</h2>
            ${formasTxt.pix?.texto ? `<p>${esc(formasTxt.pix.texto)}</p>` : ''}
            <p class="aviso-pix"><strong>Este Pix é só para apoiar o site.</strong> Nunca pedimos Pix para inscrever você em edital, liberar recurso ou aprovar projeto. <a href="${rel}nunca-cobramos/" data-evento="golpe-saiba-mais">Como evitar golpes</a>.</p>
            <div class="pix">
                <figure class="pix-qr">${pix.qr}<figcaption>Aponte a câmera do app do seu banco</figcaption></figure>
                <div class="pix-dados">
                    <p class="rotulo-lista">Chave Pix</p>
                    <p class="pix-chave"><code id="pixChave">${esc(pixCfg.chave)}</code> <button type="button" class="btn pequeno" data-copiar="pixChave" data-evento="apoio-pix-chave">Copiar chave</button></p>
                    <label class="rotulo-lista" for="pixCodigo">Pix copia e cola</label>
                    <textarea id="pixCodigo" class="pix-codigo" readonly rows="4" spellcheck="false">${esc(pix.codigo)}</textarea>
                    <p><button type="button" class="btn pequeno primario" data-copiar="pixCodigo" data-evento="apoio-pix-copia-e-cola">Copiar código</button></p>
                    <p class="nota">Recebedor: ${esc(pixCfg.nome || NOME)}${pixCfg.cidade ? ` · ${esc(pixCfg.cidade)}` : ''}. Confira o nome no app do banco antes de confirmar. Você escolhe o valor.</p>
                    <p class="nota" role="status" aria-live="polite" id="copiaStatus"></p>
                </div>
            </div>
        </section>` : '';
    const formaApoiase = apoiase ? `<section class="forma" id="apoiase" aria-labelledby="apoiase-titulo">
            <h2 id="apoiase-titulo">${esc(formasTxt.apoiase?.titulo || 'Apoia.se')}</h2>
            ${formasTxt.apoiase?.texto ? `<p>${esc(formasTxt.apoiase.texto)}</p>` : ''}
            <div class="acoes"><a class="btn primario" href="${esc(apoiase)}" target="_blank" rel="noopener" data-evento="apoio-apoiase">Apoiar no Apoia.se</a></div>
        </section>` : '';
    // Ordem das formas: a de data/comercial.json (pix, apoiase), depois as que faltarem
    const ordem = [...new Set([...arr(APO.formas).map(f => f.id), 'pix', 'apoiase'])];
    const formas = ordem.map(id => ({ pix: formaPix, apoiase: formaApoiase }[id] || '')).join('');
    const usos = arr(APO.usoDoDinheiro);
    escrever('apoie/index.html', layout({
        rel, url, ativo: 'apoie',
        titulo: `${APO.titulo || 'Apoie'} | ${NOME}`,
        descricao: corta(`${APO.subtitulo ? APO.subtitulo + ' ' : ''}Apoie o ${NOME} com Pix ou contribuição mensal e ajude a manter as fontes conferidas todos os dias.`, 158),
        corpo: `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <span aria-current="page">Apoie</span></nav>
        <h1>${esc(APO.titulo || `Apoie o ${NOME}`)}</h1>
        ${APO.subtitulo ? `<p class="sub">${esc(APO.subtitulo)}</p>` : ''}
        <p class="aviso-golpe">O apoio é voluntário e serve só para manter o site. Ele não tem relação com nenhum edital: nunca cobramos para você se inscrever ou receber recurso. <a href="${rel}nunca-cobramos/" data-evento="golpe-saiba-mais">Saiba como evitar golpes <span aria-hidden="true">→</span></a></p>
        ${apoioConfigurado ? '' : `<div class="aviso" id="em-breve"><strong>Em breve.</strong> As formas de apoio (Pix e contribuição mensal) estão sendo preparadas. Enquanto isso, a melhor ajuda é compartilhar o site com quem procura editais.${cfg.boletim?.url ? ` <a href="${esc(cfg.boletim.url)}" target="_blank" rel="noopener">Receba os novos editais</a>.` : ''}</div>`}
        ${arr(APO.porQue).length ? `<section aria-labelledby="por-que-apoiar"><h2 id="por-que-apoiar">Por que apoiar</h2><ul class="lista">${arr(APO.porQue).map(t => `<li>${esc(t)}</li>`).join('')}</ul></section>` : ''}
        ${formas}
        ${outro ? `<section class="forma" aria-labelledby="outro-titulo"><h2 id="outro-titulo">Outra forma de apoiar</h2><div class="acoes"><a class="btn" href="${esc(outro)}" target="_blank" rel="noopener" data-evento="apoio">${esc(cfg.apoio?.texto || 'Apoiar')}</a></div></section>` : ''}
        ${usos.length ? `<section aria-labelledby="uso-titulo"><h2 id="uso-titulo">Para onde vai o dinheiro</h2>
            <div class="tabela-rolagem" role="region" aria-labelledby="uso-titulo" tabindex="0"><table class="tabela"><thead><tr><th scope="col">Item</th><th scope="col">Valor</th></tr></thead>
            <tbody>${usos.map(u => `<tr><td>${esc(u.item)}</td><td>${typeof u.valor === 'number' ? brl(u.valor) : esc(u.valor)}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
        ${APO.transparencia ? `<section aria-labelledby="transparencia-titulo"><h2 id="transparencia-titulo">Transparência</h2><p>${esc(APO.transparencia)}</p></section>` : ''}
        ${APO.nota ? `<p class="aviso">${esc(APO.nota)}</p>` : ''}
        <p class="nota">Organizações que querem divulgar uma chamada: veja <a href="${rel}anuncie/">Anuncie</a>. Nada é cobrado de quem procura editais.</p>
        <p class="nota">Consultorias e captadores que acompanham editais para vários clientes: conheça o <a href="${rel}pro/">${esc(PRO.nome || 'Plano Pro')} (em breve)</a>.</p>
        ${pix ? `<script>
        document.querySelectorAll('[data-copiar]').forEach(function (b) {
            b.addEventListener('click', function () {
                var el = document.getElementById(b.getAttribute('data-copiar')), st = document.getElementById('copiaStatus');
                var txt = el.value !== undefined ? el.value : el.textContent;
                var feito = function () { st.textContent = b.getAttribute('data-copiar') === 'pixChave' ? 'Chave copiada.' : 'Código Pix copiado. Cole no app do seu banco, em Pix copia e cola.'; };
                var manual = function () { if (el.select) { el.focus(); el.select(); } else { var r = document.createRange(); r.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(r); } try { if (document.execCommand('copy')) return feito(); } catch (e) {} st.textContent = 'Selecionado: use Ctrl+C ou "Copiar" do seu aparelho.'; };
                if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(feito, manual); else manual();
            });
        });
        </script>` : ''}`
    }));
}
{
    // Endereço antigo: continua funcionando, com o conteúdo resumido e links para /anuncie/ e /apoie/
    // (canonical aponta para /anuncie/, que concentra o conteúdo; GitHub Pages não faz redirecionamento no servidor)
    const rel = '../';
    escrever('parcerias/index.html', layout({
        rel, url: `${SITE}/anuncie/`,
        titulo: `Parcerias e patrocínio | ${NOME}`,
        descricao: `Parcerias com o ${NOME}: destaque patrocinado de chamadas com regras de transparência, apoio por Pix e publicação gratuita de editais.`,
        corpo: `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <span aria-current="page">Parcerias</span></nav>
        <h1>Parcerias e patrocínio</h1>
        <p class="sub">O conteúdo desta página agora está em <a href="${rel}anuncie/">Anuncie</a>.</p>
        <div class="acoes"><a class="btn primario" href="${rel}anuncie/" data-evento="parcerias-anuncie">Ver pacotes e regras do patrocínio</a></div>
        <ul class="lista">
            <li><a href="${rel}anuncie/">Anuncie</a>: destaque patrocinado de chamadas, pacotes e <a href="${rel}anuncie/#regras">regras de transparência</a>.</li>
            <li><a href="${rel}apoie/">Apoie</a>: contribua com Pix ou mensalmente.</li>
            <li><a href="${rel}sugerir-edital/">Sugerir edital</a>: publicar uma chamada é gratuito.</li>
            <li>Portal para governos, FAPs e fundações: <a href="${esc(comercialHref(`Parceria institucional — ${NOME}`))}"${alvo(comercialHref(''))}>fale com a equipe</a>.</li>
        </ul>`
    }));
    /* ---------- Privacidade e Termos de uso (LGPD, Marco Civil, CDC) ---------- */
    // Formulários externos (data/site.json → formularios): consentimento, operador possivelmente fora do Brasil e como sair
    function secaoFormulariosExternos(rel) {
        const usos = { alertas: 'prazos por e-mail toda semana', pro: `lista de espera do ${PRO.nome || 'Plano Pro'}`, radar: 'contato e piloto do Radar para municípios' };
        const ativos = Object.keys(usos).filter(k => formularioExterno(k)).map(k => [usos[k], servicoDoFormulario(formularioExterno(k))]);
        return `<section id="formularios-externos"><h2>Formulários de outros serviços</h2>
            <p>${ativos.length ? `Alguns botões levam a formulários hospedados por outros serviços: ${ativos.map(([u, sv]) => `${esc(u)} (${esc(sv)})`).join('; ')}.` : 'Hoje nenhum botão do site leva a formulário de outro serviço. Se isso mudar, o serviço aparecerá listado aqui.'} O formulário abre em outra aba, fora deste site; nada é carregado dentro das nossas páginas.</p>
            <ul class="lista">
                <li><strong>O que é coletado:</strong> só o que você preencher (por exemplo, e-mail, nome da organização e respostas) e o que o próprio serviço registra quando você acessa o formulário.</li>
                <li><strong>Base legal:</strong> o seu consentimento (art. 7º, I, e art. 8º da LGPD), dado ao marcar a caixa de consentimento e enviar o formulário. Usamos os dados só para a finalidade descrita no formulário.</li>
                <li><strong>Quem guarda os dados:</strong> o serviço do formulário atua como operador (art. 39), seguindo as nossas instruções e a política de privacidade dele. Esses serviços podem guardar os dados em servidores fora do Brasil (transferência internacional, art. 33).</li>
                <li><strong>Como sair:</strong> use o link de descadastro que vai em cada e-mail ou peça pelo canal ${canal}. Apagamos os seus dados da nossa lista e no serviço do formulário em até 15 dias.</li>
                <li><strong>Por quanto tempo:</strong> enquanto você estiver inscrito; nas listas de espera, até 6 meses depois do lançamento ou do fim do piloto.</li>
            </ul></section>`;
    }
    const responsavel = cfg.responsavel ? esc(cfg.responsavel) : 'a pessoa responsável pelo projeto (repositório público no GitHub)';
    const canal = cfg.contato ? `<a href="${esc(contatoHref)}">${esc(cfg.contato)}</a>` : `<a href="${esc(REPO)}/issues/new" target="_blank" rel="noopener">abertura de solicitação no GitHub</a> (pública — para pedidos sobre seus dados, não informe dados pessoais nela; peça um contato privado)`;
    urlsExtras.push([`${SITE}/privacidade/`, 'yearly', '0.3'], [`${SITE}/termos/`, 'yearly', '0.3']);
    escrever('privacidade/index.html', layout({
        rel, url: `${SITE}/privacidade/`,
        titulo: `Política de Privacidade | ${NOME}`,
        descricao: `Como o ${NOME} trata dados: o que fica só no seu navegador, quais serviços recebem seu IP e como exercer seus direitos (LGPD).`,
        corpo: `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <span aria-current="page">Privacidade</span></nav>
        <h1>Política de Privacidade</h1>
        <p class="sub">Versão de 02/11/2026. Escrita em linguagem simples, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018) e o Marco Civil da Internet (Lei 12.965/2014).</p>
        <section><h2>Quem somos</h2><p>O ${NOME} é um serviço gratuito e informativo mantido por ${responsavel}. Contato: ${canal}.</p></section>
        <section><h2>O que fica só no seu navegador</h2><p>Perfil, favoritos, propostas, checklists, rascunhos, prestações de contas de demonstração e o nome/e-mail do “login” de demonstração são gravados apenas no armazenamento local do seu navegador. <strong>Esses dados não chegam até nós.</strong> Para apagá-los, use “Apagar meus dados” na plataforma ou limpe os dados do site no navegador.</p></section>
        <section><h2>Serviços de terceiros que recebem seu endereço IP</h2><ul class="lista">
            <li><strong>GitHub Pages</strong> (hospedagem do site).</li>
            <li><strong>Google Fonts</strong> (fontes). As bibliotecas de mapa e gráfico são servidas pelo próprio site.</li>
            <li><strong>OpenStreetMap</strong> (imagens do mapa, só na página Mapa).</li>
            ${cfg.analytics?.goatcounter ? '<li><strong>GoatCounter</strong> (contagem de visitas e de cliques em botões e destaques, sem cookies e sem identificar pessoas). Recebe o endereço IP e o navegador apenas para gerar estatísticas agregadas, que também usamos nos relatórios a patrocinadores. Base legal: legítimo interesse (art. 7º, IX). Servidores fora do Brasil (art. 33). Bloqueadores de anúncios podem impedir a contagem, sem prejuízo ao uso do site.</li>' : ''}
            ${cfg.analytics?.ga4 ? '<li><strong>Google Analytics</strong> (medição de uso; carregado só com o seu consentimento).</li>' : ''}
        </ul><p>Esses serviços podem estar fora do Brasil (transferência internacional, art. 33 da LGPD) e seguem as próprias políticas. Usamos esses serviços por legítimo interesse, para que o site funcione.</p></section>
        <section><h2>Sugestões de edital e pedidos de parceria</h2><p>${contatoEhGithub ? 'São feitos no GitHub e ficam <strong>públicos</strong>. Não informe telefone, CPF, endereço ou e-mail pessoal nesses formulários.' : 'Sugestões de edital feitas no GitHub ficam <strong>públicas</strong>: não informe dados pessoais nelas. Pedidos comerciais enviados pelo contato de <a href="' + rel + 'anuncie/">Anuncie</a> são usados só para responder e preparar a proposta (base legal: procedimentos preliminares a contrato, art. 7º, V). Guardamos esses e-mails por até 2 anos após o último contato, ou por 5 anos se houver contratação, por obrigações fiscais.'}</p></section>
        <section><h2>Resumo semanal e feeds</h2><p>O “Resumo da semana” é a página <a href="${rel}semana/">semana/</a> e os feeds RSS e calendários do site. Para eles não há cadastro: o leitor de RSS ou a agenda de quem assina busca os arquivos diretamente no site, como qualquer visita.${formularioExterno('alertas') ? ' O envio de prazos por e-mail é feito por um formulário de outro serviço (veja abaixo).' : ' Ainda não enviamos e-mails com os prazos.'}</p></section>
        ${secaoFormulariosExternos(rel)}
        <section><h2>Formulário de pedido em Anuncie</h2><p>O formulário de <a href="${rel}anuncie/#pedido">Anuncie</a> não envia nem guarda nada: ele só monta uma mensagem no seu programa de e-mail, que você revisa e envia. O tratamento começa quando o e-mail chega até nós (veja acima).</p></section>
        <section><h2>E-mail do projeto</h2><p>O e-mail de contato é hospedado pelo Google (Gmail), que atua como operador e pode armazenar mensagens fora do Brasil (art. 33 da LGPD).</p></section>
        <section><h2>Apoio (Pix e Apoia.se)</h2><p>A página <a href="${rel}apoie/">Apoie</a> não coleta nenhum dado: o código Pix e o QR Code são gerados no próprio site e o pagamento acontece no app do seu banco. Como em qualquer Pix, o banco informa a quem recebe o nome de quem pagou e parte do CPF ou CNPJ; usamos essas informações apenas para controle financeiro e cumprimento de obrigações legais e fiscais (art. 7º, II), guardadas por 5 anos, sem publicá-las nem compartilhá-las. Contribuições pelo Apoia.se seguem a política de privacidade daquela plataforma.</p></section>
        <section id="lista-espera"><h2>Listas de espera (Plano Pro e Radar para municípios)</h2><p>${formularioExterno('pro') || formularioExterno('radar') ? 'Quando o botão leva a um formulário de outro serviço, valem também as regras de “Formulários de outros serviços”, acima. ' : ''}Quando não há formulário externo, as listas funcionam por e-mail: o formulário só monta uma mensagem no seu programa de e-mail, e nada é gravado por este site. Recebemos o que você escrever (organização, perfil, respostas) e o seu endereço de e-mail como remetente. Finalidade: avisar sobre o lançamento, convidar para o piloto e entender que recursos priorizar. Base legal: consentimento (art. 7º, I), que você pode revogar a qualquer momento respondendo ao e-mail ou pelo contato acima. As respostas sobre preço e prioridades são analisadas só em conjunto. Os dados são apagados até 6 meses após o lançamento ou se o produto for cancelado.</p></section>
        <section id="experiencia"><h2>Pergunta “Foi fácil?” e contagem de páginas</h2><ul class="lista">
            <li>A pergunta “Foi fácil encontrar o que procurava?”, no fim das páginas de editais e por perfil, é <strong>anônima</strong>: tem só três botões, <strong>sem texto livre</strong>, e guardamos apenas o total de cada resposta (dado agregado), sem ligar a resposta a você. No seu navegador fica só a data em que você respondeu (chave <code>fb:ces</code>), para não perguntarmos de novo por 30 dias.</li>
            <li>${cfg.analytics?.goatcounter ? 'A contagem de páginas e de cliques em botões da plataforma e destas páginas é feita pelo GoatCounter, sem cookies e sem identificar pessoas (veja acima). Sem JavaScript, a resposta à pergunta é contada por uma imagem de 1 pixel do GoatCounter.' : 'Hoje o site não conta visitas nem cliques: as respostas à pergunta não são registradas.'} Os resultados agregados são publicados em <a href="${rel}dados/#experiencia">Dados abertos</a>.</li>
        </ul></section>
        <section><h2>Patrocinadores</h2><p>Editais em destaque patrocinado são sinalizados com “Patrocinado por” e o nome de quem patrocina. Patrocinadores recebem só números agregados (quantos cliques o destaque teve), contados sem cookies e sem identificar pessoas. Nenhum dado pessoal de quem usa o site é vendido ou repassado.</p></section>
        <section><h2>Seus direitos e canal do titular</h2><p>Você pode pedir confirmação, acesso, correção ou eliminação de dados pessoais que porventura tratemos (art. 18 da LGPD) pelo canal de comunicação com titulares: ${canal}. Respondemos em até 15 dias. Como agente de tratamento de pequeno porte, o projeto não nomeia encarregado, mas mantém este canal (Resolução CD/ANPD nº 2/2022). Você também pode recorrer à Autoridade Nacional de Proteção de Dados (ANPD).</p></section>
        <section><h2>Atualizações</h2><p>Mudanças nesta política serão publicadas nesta página, com a data da versão.</p></section>`
    }));
    escrever('termos/index.html', layout({
        rel, url: `${SITE}/termos/`,
        titulo: `Termos de uso | ${NOME}`,
        descricao: `Condições de uso do ${NOME}: serviço informativo e gratuito; o edital oficial sempre prevalece; patrocínio sinalizado com o nome de quem patrocina.`,
        corpo: `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <span aria-current="page">Termos de uso</span></nav>
        <h1>Termos de uso</h1>
        <p class="sub">Versão de 01/11/2026.</p>
        <ul class="lista">
            <li><strong>Serviço informativo e gratuito.</strong> O ${NOME} reúne e resume editais públicos e privados de fomento. <strong>Não é canal oficial</strong> e não tem vínculo com os órgãos e instituições citados. <strong>Também não tem vínculo com o Fundo Brasil de Direitos Humanos</strong>, fundação que publica editais próprios.</li>
            <li><strong>O edital oficial sempre prevalece.</strong> Cada resumo informa a fonte e a data em que foi conferido. Os programas do Transferegov são <strong>lidos automaticamente</strong> da API pública, sem revisão humana, e aparecem marcados assim; o monitor de editais usa inteligência artificial para preparar rascunhos, que só são publicados depois de revisados por pessoa. Prazos, valores e requisitos podem mudar (retificações, prorrogações); não garantimos que estejam completos ou atualizados. Confirme sempre no documento oficial antes de submeter.</li>
            <li><strong>Inscrições, propostas e prestações de contas reais</strong> são feitas apenas nos sistemas da instituição financiadora. As áreas de projetos e prestação de contas desta plataforma são <strong>simulações</strong>: nada é enviado a ninguém.</li>
            <li><strong>Nomes de instituições</strong> são usados apenas para identificá-las. Textos de editais publicados por órgãos públicos são atos oficiais (Lei 9.610/1998, art. 8º, IV); chamadas de entidades privadas e internacionais são resumidas com redação própria, com link para o original.</li>
            <li><strong>Conteúdo patrocinado</strong> é sempre sinalizado com o selo “Patrocinado por” e o nome de quem patrocina, ocupa só vagas reservadas e não altera a busca, os filtros, a compatibilidade nem a ordem das listas. As regras estão em <a href="${rel}anuncie/#regras">Anuncie</a>. A curadoria continua independente: patrocínio não garante publicação de chamada que não atenda aos critérios.</li>
            <li><strong>Apoio voluntário.</strong> Contribuições por Pix ou Apoia.se são doações ao projeto: não dão acesso a serviços, prioridade na curadoria nem tratamento diferenciado. O plano Pro anunciado como “em breve” ainda não é vendido; a lista de espera não gera cobrança.</li>
            <li><strong>Serviços (consultorias e softwares)</strong> só são anunciados no espaço “Serviços”, com o selo “Publicidade · Serviço”, separado das listas de editais e nunca ao lado de uma chamada.</li>
            <li><strong>Licença dos dados abertos.</strong> A licença CC BY 4.0 cobre a seleção, a organização e os textos próprios do ${NOME}. Textos oficiais, nomes e marcas de terceiros não são licenciados por nós; atos oficiais são de domínio público (Lei 9.610/1998, art. 8º, IV). Detalhes em <a href="${rel}dados/">Dados abertos</a>.</li>
            <li><strong>Resumo semanal</strong> é a página <a href="${rel}semana/">Resumo da semana</a> e os feeds RSS do site.${formularioExterno('alertas') ? ' Quem quiser pode se inscrever, por um formulário de outro serviço, para receber os prazos por e-mail; a inscrição é gratuita e pode ser cancelada a qualquer momento.' : ' Ainda não há envio por e-mail nem lista de contatos.'}</li>
            <li><strong>Nunca cobramos</strong> para você se inscrever em edital, “liberar” recurso ou garantir aprovação. Quem pedir dinheiro em nome do ${NOME} está tentando aplicar um golpe: veja <a href="${rel}nunca-cobramos/">Nunca cobramos</a>.</li>
            <li><strong>Seus dados:</strong> não insira dados de terceiros nem dados sensíveis. Veja a <a href="${rel}privacidade/">Política de Privacidade</a>.</li>
            <li>Aplica-se a lei brasileira.</li>
        </ul>`
    }));
    /* ---------- Declaração de acessibilidade ---------- */
    {
        const emailAcess = cfg.contato && emailOk(cfg.contato) ? `mailto:${cfg.contato.trim()}?subject=${encodeURIComponent(`Acessibilidade — ${NOME}`)}` : contatoHref;
        urlsExtras.push([`${SITE}/acessibilidade/`, 'yearly', '0.3']);
        escrever('acessibilidade/index.html', layout({
            rel, url: `${SITE}/acessibilidade/`,
            titulo: `Declaração de acessibilidade | ${NOME}`,
            descricao: `Compromisso de acessibilidade do ${NOME}: padrão WCAG 2.2 nível AA, o que já foi feito, limitações conhecidas e como relatar barreiras.`,
            corpo: `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <span aria-current="page">Acessibilidade</span></nav>
        <h1>Declaração de acessibilidade</h1>
        <p class="sub">Versão de 01/11/2026. Revisada a cada mudança grande no site e, no mínimo, a cada 6 meses.</p>
        <section><h2>Nosso compromisso</h2>
            <p>Queremos que qualquer pessoa consiga encontrar e entender um edital no ${NOME}, inclusive quem usa leitor de tela, navega só pelo teclado, amplia a tela ou usa o celular. O padrão que buscamos é a <strong>WCAG 2.2, nível AA</strong> (Diretrizes de Acessibilidade para Conteúdo Web, do W3C), em linha com a Lei Brasileira de Inclusão (Lei 13.146/2015, art. 63).</p>
            <p>Situação atual: <strong>parcialmente conforme</strong>. A maior parte do site atende ao padrão; as exceções conhecidas estão listadas abaixo.</p></section>
        <section><h2>O que já foi feito</h2><ul class="lista">
            <li><strong>Contraste:</strong> textos e selos com contraste mínimo de 4,5:1 nos temas claro e escuro; a situação de cada edital (aberto, em breve, encerrado) é escrita por extenso, não só indicada por cor.</li>
            <li><strong>Foco visível:</strong> todo link, botão e campo mostra um contorno nítido quando recebe o foco.</li>
            <li><strong>Teclado:</strong> todo o site funciona sem mouse, inclusive os menus “Para você” e “Transparência” (Enter abre, Esc fecha) e a gaveta “Menu” no celular.</li>
            <li><strong>Link “Pular para o conteúdo”:</strong> é o primeiro item de cada página e leva direto ao texto principal.</li>
            <li><strong>Leitores de tela:</strong> regiões marcadas (cabeçalho, navegação, conteúdo, rodapé), um título principal por página, títulos em ordem, tabelas com cabeçalhos, rótulos visíveis em todos os campos de formulário, avisos de cópia lidos automaticamente e ícones decorativos ocultos para leitores de tela.</li>
            <li><strong>Celular:</strong> sem rolagem horizontal em 320 px de largura e áreas de toque de pelo menos 44 × 44 px nos botões e menus.</li>
            <li><strong>Sem dependência de JavaScript</strong> nas páginas de editais, guias e instituições: o conteúdo está no HTML.</li>
            <li><strong>Idioma</strong> declarado (português do Brasil) e textos em linguagem simples.</li>
        </ul></section>
        <section><h2>Limitações conhecidas</h2><ul class="lista">
            <li><strong>Mapa</strong> (na plataforma, em Transparência › Mapa): o mapa interativo depende de imagens e de movimentos de arrastar. Alternativa com o mesmo conteúdo, em texto: <a href="${rel}instituicoes/">lista de instituições</a>.</li>
            <li><strong>Gráficos</strong> da área Transparência: nem todos têm uma tabela equivalente ao lado. Os números principais aparecem também em texto.</li>
            <li><strong>Documentos oficiais</strong> (PDFs de editais) são publicados pelas instituições e podem não ser acessíveis; não temos como corrigi-los, mas resumimos o essencial em cada página de edital.</li>
            <li><strong>Programas do Transferegov</strong> são lidos automaticamente e podem trazer textos longos, em maiúsculas ou com siglas sem explicação.</li>
            <li>Ainda não fizemos uma avaliação completa com pessoas que usam leitores de tela no dia a dia. Ela está entre as próximas etapas.</li>
        </ul></section>
        <section><h2>Encontrou uma barreira?</h2>
            <p>Conte o que aconteceu, em qual página e, se puder, qual navegador ou tecnologia assistiva você usa: <a href="${esc(emailAcess)}">${cfg.contato ? esc(cfg.contato) : 'canal de contato'}</a> (assunto “Acessibilidade”).</p>
            <p><strong>Prazo de resposta: até 5 dias úteis.</strong> Se a barreira impedir o acesso às informações de um edital, enviamos essas informações por e-mail, em texto, no mesmo prazo.</p></section>
        <p class="nota">Declaração feita em 01/11/2026 por autoavaliação (revisão manual por teclado, leitura do código e verificação de contraste).</p>`
        }));
    }
    escrever('sugerir-edital/index.html', layout({
        rel, url: `${SITE}/sugerir-edital/`, ativo: 'parcerias',
        titulo: `Sugira um edital | ${NOME}`,
        descricao: 'Conhece uma chamada pública aberta que não está aqui? Envie o link oficial: conferimos e publicamos gratuitamente.',
        corpo: `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <span aria-current="page">Sugerir edital</span></nav>
        <h1>Sugira um edital</h1>
        <p class="sub">Conhece uma chamada aberta que ainda não está aqui? Envie o link do edital oficial.</p>
        <ol class="lista">
            <li>Envie o endereço da página ou do PDF oficial da chamada.</li>
            <li>A IA extrai os dados e um revisor confere tudo no documento oficial.</li>
            <li>Aprovado, o edital ganha página própria, entra no feed e nos alertas, e você recebe o link.</li>
        </ol>
        <div class="acoes"><a class="btn primario" href="${esc(sugestaoHref)}" target="_blank" rel="noopener" data-evento="sugerir-edital">Enviar edital</a></div>
        <p class="nota">Publicamos somente chamadas de fomento com inscrições abertas ou previstas: auxílios, bolsas, subvenção, termos de fomento e prêmios. Não divulgamos licitações de compra nem concursos de emprego.</p>`
    }));
}

/* ---------- Nunca cobramos (/nunca-cobramos/): golpes com editais, em linguagem simples ---------- */
// Canais de denúncia: só oficiais, conferidos em 02/11/2026 (Banco Central, Polícia Civil de SP, CGU).
{
    const rel = '../';
    const url = `${SITE}/nunca-cobramos/`;
    urlsExtras.push([url, 'monthly', '0.5']);
    const ext = (href, txt, ev) => `<a href="${href}" target="_blank" rel="noopener noreferrer" data-evento="golpe-${ev}">${txt}</a>`;
    escrever('nunca-cobramos/index.html', layout({
        rel, url, ativo: '',
        titulo: `Nunca cobramos: como evitar golpes com editais | ${NOME}`,
        descricao: 'Ninguém precisa pagar para se inscrever em edital. Veja como reconhecer golpes com editais, Pix e falsas promessas de aprovação, e onde denunciar.',
        jsonld: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Nunca cobramos: como evitar golpes com editais', url, inLanguage: 'pt-BR', isPartOf: { '@type': 'WebSite', name: NOME, url: `${SITE}/` } },
        corpo: `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <span aria-current="page">Nunca cobramos</span></nav>
        <h1>Nunca cobramos para você concorrer a um edital</h1>
        <p class="sub">O ${NOME} é gratuito. Se alguém pedir dinheiro em nosso nome para inscrever você, liberar recurso ou aprovar projeto, é golpe.</p>
        <section aria-labelledby="nunca-titulo"><h2 id="nunca-titulo">O que este site nunca faz</h2><ul class="lista">
            <li><strong>Nunca cobra taxa de inscrição.</strong> Consultar editais, fazer o teste “Posso concorrer?” e usar a lista de documentos é de graça.</li>
            <li><strong>Nunca pede Pix, boleto ou depósito</strong> para “liberar” recurso, “destravar” pagamento, “reservar vaga” ou “acelerar” análise.</li>
            <li><strong>Nunca garante aprovação.</strong> Quem decide é o financiador, pelas regras do edital. Ninguém pode prometer resultado.</li>
            <li><strong>Nunca pede senhas</strong>: nem do gov.br, nem do banco, nem códigos que chegam por SMS.</li>
            <li><strong>Não faz inscrição por você.</strong> A proposta é enviada só no sistema do próprio financiador.</li>
        </ul>
        <p>O único Pix que aparece neste site está na página <a href="${rel}apoie/">Apoie</a>: é uma doação voluntária para manter o site e não tem relação com nenhum edital.</p></section>
        <section aria-labelledby="oficiais-titulo"><h2 id="oficiais-titulo">Editais oficiais, em regra, não cobram para concorrer</h2>
            <p>Programas do governo federal no Transferegov, fundações de amparo à pesquisa, editais de cultura e fundações privadas, em regra, não cobram nada para receber uma proposta. Quando o projeto é aprovado, o dinheiro vai para a conta do projeto, sem pagamento antecipado a ninguém.</p>
            <ul class="lista">
                <li>Se um edital tiver alguma taxa, ela está escrita no <strong>edital oficial</strong>, publicado no site da própria instituição. Nunca é cobrada por mensagem, ligação ou perfil em rede social.</li>
                <li><strong>Contrapartida não é taxa.</strong> É a parte do custo do projeto que a sua organização assume, prevista no edital. Ela fica no próprio projeto e nunca é paga a intermediários.</li>
                <li>Na página de cada edital, o botão “Edital oficial” leva à fonte. Confira lá antes de fazer qualquer coisa.</li>
            </ul></section>
        <section aria-labelledby="sinais-titulo"><h2 id="sinais-titulo">Como reconhecer um golpe</h2><ul class="lista">
            <li>Pedem dinheiro para inscrever, liberar, aprovar ou “agilizar” um recurso.</li>
            <li>Prometem aprovação garantida, “vaga reservada” ou “recurso já aprovado em seu nome”.</li>
            <li>Criam pressa: “só hoje”, “últimas vagas”, “o dinheiro volta para Brasília amanhã”.</li>
            <li>Falam em nome de ministério, prefeitura, fundação ou deste site por WhatsApp, e-mail gratuito ou perfil desconhecido.</li>
            <li>Pedem Pix para uma pessoa ou empresa que não é o órgão que publicou o edital.</li>
            <li>Mandam link que não é o endereço oficial da instituição (órgãos federais usam endereços terminados em gov.br).</li>
            <li>Pedem senha do gov.br, do banco ou um código que chegou por SMS.</li>
        </ul></section>
        <section aria-labelledby="fazer-titulo"><h2 id="fazer-titulo">O que fazer</h2>
            <ol class="lista">
                <li><strong>Não pague nada</strong> e não envie documentos nem senhas.</li>
                <li><strong>Confira na fonte oficial:</strong> abra o site da instituição por conta própria (não pelo link que recebeu) ou use o botão “Edital oficial” da página do edital aqui no site.</li>
                <li><strong>Se já pagou por Pix, fale com o seu banco imediatamente</strong> pelo app ou pelo atendimento oficial e peça a devolução pelo Mecanismo Especial de Devolução (MED). O pedido pode ser feito até 80 dias depois do Pix, mas quanto antes, maior a chance de recuperar o dinheiro.</li>
                <li><strong>Registre um boletim de ocorrência.</strong> Em vários estados dá para fazer pela internet, na delegacia eletrônica da Polícia Civil.</li>
            </ol></section>
        <section aria-labelledby="denunciar-titulo"><h2 id="denunciar-titulo">Onde denunciar</h2>
            <ul class="lista">
                <li><strong>Seu banco</strong>: pelo app ou pelo telefone que está no cartão. O Banco Central explica ${ext('https://www.bcb.gov.br/meubc/faqs/p/o-que-e-e-como-funciona-o-mecanismo-especial-de-devolucao-med', 'como funciona o MED, a devolução de Pix em caso de golpe', 'bcb-med')}.</li>
                <li><strong>Reclamação contra o banco</strong>, se ele não atender: ${ext('https://www.bcb.gov.br/meubc/faleconosco', 'Fale conosco do Banco Central', 'bcb-reclamacao')}.</li>
                <li><strong>Boletim de ocorrência em São Paulo:</strong> ${ext('https://www.delegaciaeletronica.policiacivil.sp.gov.br/', 'Delegacia Eletrônica da Polícia Civil de SP', 'bo-sp')}. Em outros estados, procure a delegacia eletrônica da Polícia Civil do seu estado.</li>
                <li><strong>Golpe que usa o nome de órgão ou programa do governo federal:</strong> denuncie no ${ext('https://falabr.cgu.gov.br/web/home', 'Fala.BR, da Controladoria-Geral da União', 'falabr')}.</li>
                <li><strong>Golpe que usa o nome deste site:</strong> avise pelo <a href="${esc(contatoHref)}"${/^mailto:/.test(contatoHref) ? '' : ' target="_blank" rel="noopener"'}>nosso contato</a>, com print da mensagem, para alertarmos outras pessoas.</li>
            </ul>
            <p class="nota">Links conferidos em 02/11/2026. Este site não é canal oficial de denúncia: ele só indica os canais oficiais.</p></section>`
    }));
}

/* ---------- Feed RSS ---------- */
{
    const itens = [...editais].filter(e => statusEm(e) !== 'fechado').sort((a, b) => (b.publicadoEm || '').localeCompare(a.publicadoEm || ''));
    const rfc = iso => new Date(`${iso}T12:00:00-03:00`).toUTCString();
    escrever('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${esc(NOME)} — novos editais</title>
  <link>${SITE}/</link>
  <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
  <description>${esc(cfg.descricaoCurta || 'Editais abertos de fomento no Brasil')}</description>
  <language>pt-BR</language>
  <lastBuildDate>${rfc(geradoEm)}</lastBuildDate>
${itens.map(e => `  <item>
    <title>${patrocinado(e) ? '[Patrocinado] ' : ''}${esc(nomeEdital(e))} — ${esc(e.instituicao)}</title>
    <link>${SITE}/editais/${slugEdital(e)}/</link>
    <guid isPermaLink="true">${SITE}/editais/${slugEdital(e)}/</guid>
    <pubDate>${rfc(e.publicadoEm || e.abertura)}</pubDate>
    <category>${esc(AREAS[e.tema] || e.tema)}</category>
    <description>${esc(`${patrocinado(e) ? `${textoSelo(e)}. ` : ''}${numeroEdital(e) ? numeroEdital(e) + '. ' : ''}${valorTxt(e)}${temValor(e) ? ' por proposta' : ''} · ${publicoTxt(e)} · inscrições de ${data(e.abertura)} a ${data(e.encerramento)}. ${e.resumo}`)}</description>
  </item>`).join('\n')}
</channel>
</rss>
`);
}

/* ---------- Feeds RSS e calendários por recorte (contrato com a plataforma: nomes fixos) ---------- */
//   feeds/todos.xml, feeds/publico-<publico>.xml, feeds/area-<slug>.xml, feeds/instituicao-<agencia>.xml, feeds/alteracoes.xml
//   cal/todos.ics, cal/publico-<publico>.ics, cal/area-<slug>.ics, cal/instituicao-<agencia>.ics, cal/edital-<id>.ics
// Todos são gerados, mesmo vazios.
const urlEdital = e => `${SITE}/editais/${slugEdital(e)}/`;
const porId = new Map(editais.map(e => [e.id, e]));
const descricaoEdital = e => `${numeroEdital(e) ? numeroEdital(e) + '. ' : ''}${valorTxt(e)}${temValor(e) && porProposta(e) ? ' por proposta' : ''} · ${publicoTxt(e)} · inscrições de ${data(e.abertura)} a ${data(e.encerramento)}${e.etapaPrazo ? ` (${e.etapaPrazo.toLowerCase()})` : ''}${isoOk(e.propostaCompleta) ? `; proposta completa até ${data(e.propostaCompleta)}` : ''}. ${e.resumo}`.trim();
const itemRss = e => ({
    titulo: `${patrocinado(e) ? '[Patrocinado] ' : ''}${nomeEdital(e)} — ${e.instituicao}`, link: urlEdital(e), guid: urlEdital(e),
    data: isoOk(e.publicadoEm) ? e.publicadoEm : e.abertura,
    categorias: [AREAS[e.tema] || e.tema, ...e.publico.map(p => PUBLICOS[p] || p)], descricao: (patrocinado(e) ? `${textoSelo(e)}. ` : '') + descricaoEdital(e)
});
const eventosDe = (e, desde = '') => prazosDe(e).filter(p => p.data >= desde).map(p => ({
    uid: `edital-${e.id}-${p.tipo}@fundosbrasil`, data: p.data, carimbo: isoOk(geradoEm) ? geradoEm : hoje,
    sequencia: alteracoes.filter(a => a.id === e.id && a.campo === p.campo).length,
    resumo: `${p.rotulo}: ${nomeEdital(e)}`, alarme: `${p.rotulo} — ${nomeEdital(e)}`, url: urlEdital(e),
    descricao: [
        `${e.instituicao}${numeroEdital(e) ? ` · ${numeroEdital(e)}` : ''}`,
        `Valor: ${valorTxt(e)}${temValor(e) && porProposta(e) ? ' por proposta' : ''}`,
        `Quem pode participar: ${publicoTxt(e)}`,
        e.prazoNota || '',
        `Página do edital: ${urlEdital(e)}`,
        e.link ? `Confirme data e horário limite no edital oficial: ${e.link}` : ''
    ].filter(Boolean).join('\n')
}));
const nomePublico = p => (PUBLICOS_HUB[p] ? PUBLICOS_HUB[p].titulo.replace(/^Editais (e programas )?abertos /, 'editais ') : `editais para ${PUBLICOS[p] || p}`);
const RECORTES = [
    { chave: 'todos', nome: 'todos os editais', grupo: 'Geral', filtro: () => true, pagina: `${SITE}/editais/` },
    ...Object.keys(PUBLICOS).map(p => ({ chave: `publico-${p}`, nome: nomePublico(p), rotulo: PUBLICOS[p], grupo: 'Por perfil', filtro: e => e.publico.includes(p), pagina: PUBLICOS_HUB[p] ? `${SITE}/para/${PUBLICOS_HUB[p].slug}/` : `${SITE}/editais/` })),
    ...Object.entries(AREAS).map(([k, n]) => ({ chave: `area-${slugify(n)}`, nome: `editais de ${n}`, rotulo: n, grupo: 'Por área', filtro: e => e.tema === k, pagina: temPaginaArea(k) ? `${SITE}/area/${slugify(n)}/` : `${SITE}/editais/` })),
    ...Object.entries(agencias).map(([k, a]) => ({ chave: `instituicao-${k}`, nome: `editais ${a.sigla}`, rotulo: a.sigla, grupo: 'Por instituição', filtro: e => e.agencia === k, pagina: `${SITE}/instituicoes/${k}/` }))
];
for (const r of RECORTES) {
    const lista = editais.filter(r.filtro);
    const itens = lista.filter(e => statusEm(e) !== 'fechado').map(itemRss).sort((a, b) => b.data.localeCompare(a.data) || a.link.localeCompare(b.link));
    escrever(`feeds/${r.chave}.xml`, rss({
        titulo: `${NOME} — ${r.nome}`, link: r.pagina, self: `${SITE}/feeds/${r.chave}.xml`, atualizado: geradoEm, itens,
        descricao: `Editais com inscrições abertas ou previstas (${r.nome}), com link para a fonte oficial. Confirme sempre no edital oficial.`
    }));
    const eventos = lista.flatMap(e => eventosDe(e, hoje)).sort((a, b) => a.data.localeCompare(b.data) || a.uid.localeCompare(b.uid));
    escrever(`cal/${r.chave}.ics`, calendario({
        nome: `Prazos de ${r.nome} — ${NOME}`,
        descricao: `Prazos de ${r.nome}, com lembretes 7 dias e 1 dia antes. Atualizado todo dia. Confirme sempre no edital oficial.`, eventos
    }));
}
for (const e of editais) {
    escrever(`cal/edital-${e.id}.ics`, calendario({ nome: `${corta(nomeEdital(e), 60)} — ${NOME}`, descricao: `Prazos de ${nomeEdital(e)} (${e.instituicao}). Confirme sempre no edital oficial.`, eventos: eventosDe(e) }));
}
// Feed de alterações (prazo prorrogado ou antecipado, valor alterado, novo edital)
{
    const hash = s => { let h = 5381; for (const c of s) h = ((h * 33) ^ c.codePointAt(0)) >>> 0; return h.toString(36); };
    const tituloDe = id => porId.get(id)?.titulo || alteracoes.find(x => x.id === id && x.campo === 'novo')?.para || `Edital ${id}`;
    const ult = alteracoes.slice(-100).reverse();
    escrever('feeds/alteracoes.xml', rss({
        titulo: `${NOME} — alterações em editais`, link: `${SITE}/semana/`, self: `${SITE}/feeds/alteracoes.xml`,
        descricao: 'Prazos prorrogados ou antecipados, valores alterados e editais incluídos, registrados a cada atualização dos dados.',
        atualizado: [geradoEm, ...ult.map(a => a.em)].filter(isoOk).sort().pop() || hoje,
        itens: ult.map(a => {
            const e = porId.get(a.id);
            const link = e ? urlEdital(e) : `${SITE}/editais/`;
            return {
                titulo: a.campo === 'novo' ? `Novo edital: ${tituloDe(a.id)}${e ? ` — ${e.instituicao}` : ''}` : `${textoAlteracao(a, e)}: ${tituloDe(a.id)}`,
                link, guid: `${link}#alteracao-${a.id}-${a.campo}-${a.em}-${hash(JSON.stringify(a))}`, permalink: false, data: a.em,
                categorias: [a.campo === 'novo' ? 'Novo edital' : CAMPO_ROTULO[a.campo] || a.campo],
                descricao: a.campo === 'novo' && e ? descricaoEdital(e) : `${textoAlteracao(a, e)}. Confirme no edital oficial.`
            };
        })
    }));
}

/* ---------- Resumo semanal: semana/ (semana atual) e semana/AAAA-SS/ (arquivo) ---------- */
{
    const sem = semanaISO(hoje);
    const ate14 = somaDias(hoje, 14);
    const naSemana = d => isoOk(d) && d >= sem.inicio && d <= sem.fim;
    const idsNovos = new Set([...editais.filter(e => naSemana(e.publicadoEm)).map(e => e.id), ...alteracoes.filter(a => a.campo === 'novo' && naSemana(a.em)).map(a => a.id)]);
    const novos = editais.filter(e => idsNovos.has(e.id)).sort(ordemPrazo);
    const encerrando = editais.flatMap(e => prazosDe(e).filter(p => p.data >= hoje && p.data <= ate14).map(p => ({ e, p }))).sort((x, y) => x.p.data.localeCompare(y.p.data) || x.e.titulo.localeCompare(y.e.titulo));
    const alterados = [...new Set(alteracoes.filter(a => a.campo !== 'novo' && naSemana(a.em) && porId.has(a.id)).map(a => a.id))].map(id => ({ e: porId.get(id), lista: alteracoes.filter(a => a.id === id && a.campo !== 'novo' && naSemana(a.em)) }));
    const dirSemana = path.join(RAIZ, 'semana');
    const anteriores = fs.existsSync(dirSemana) ? fs.readdirSync(dirSemana).filter(d => /^\d{4}-\d{2}$/.test(d) && d !== sem.chave && fs.existsSync(path.join(dirSemana, d, 'index.html'))).sort().reverse() : [];
    const periodo = `${dm(sem.inicio)} a ${data(sem.fim)}`;
    const corpoSemana = (rel, arquivo) => `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › ${arquivo ? `<a href="${rel}semana/">Resumo da semana</a> › <span aria-current="page">Semana ${sem.semana}/${sem.ano}</span>` : '<span aria-current="page">Resumo da semana</span>'}</nav>
        <h1>Resumo da semana ${sem.semana} de ${sem.ano}</h1>
        <p class="sub">${periodo} · situação em ${data(hoje)}. Editais novos, prazos dos próximos 14 dias e mudanças registradas.</p>
        ${assinar(rel, 'todos', 'Assinar novos editais e prazos')}
        <p class="nota">Mudanças de prazo e valor também têm um <a href="${rel}feeds/alteracoes.xml">feed de alterações</a>.</p>
        ${arquivo ? '' : vagaPatrocinada(editais, 'semana', rel)}
        <section><h2>Novos nesta semana (${novos.length})</h2>${novos.length ? `<ul class="cartoes">${novos.map(e => cartao(e, rel)).join('')}</ul>` : '<p class="nota">Nenhum edital novo publicado nesta semana até agora.</p>'}</section>
        <section><h2>Encerram nos próximos 14 dias (${encerrando.length})</h2>${encerrando.length ? `<ul class="agenda">${encerrando.map(({ e, p }) => `<li><span class="data">${dm(p.data)}</span> ${linkEdital(e, rel)} <span class="nota">· ${esc(p.rotulo)} · ${esc(e.instituicao)} · ${valorTxt(e)}</span></li>`).join('')}</ul>` : '<p class="nota">Nenhum prazo nos próximos 14 dias.</p>'}</section>
        <section><h2>Alterados nesta semana (${alterados.length})</h2>${alterados.length ? `<ul class="lista">${alterados.map(({ e, lista }) => `<li>${linkEdital(e, rel)} <span class="nota">· ${esc(e.instituicao)}</span><br>${lista.map(a => esc(textoAlteracao(a, e))).join('; ')}</li>`).join('')}</ul>` : '<p class="nota">Nenhuma mudança de prazo, valor ou link registrada nesta semana.</p>'}</section>
        <aside class="aviso">Prazos podem ter horário-limite e etapas anteriores. Confirme sempre no edital oficial.</aside>
        ${arquivo ? '' : blocoAlertas(rel, 'todos', 'semana')}
        ${!arquivo && anteriores.length ? `<section><h2>Semanas anteriores</h2><ul class="lista">${anteriores.map(d => `<li><a href="${rel}semana/${d}/">Semana ${Number(d.slice(5))} de ${d.slice(0, 4)}</a></li>`).join('')}</ul></section>` : ''}
        ${arquivo ? `<p><a href="${rel}semana/">Ver o resumo da semana atual</a></p>` : `<p class="nota">Endereço permanente deste resumo: <a href="${rel}semana/${sem.chave}/">semana ${sem.semana} de ${sem.ano}</a>.</p>`}`;
    const descSemana = corta(`Semana ${sem.semana}/${sem.ano} (${periodo}): ${plural(novos.length, 'edital novo', 'editais novos')}, ${plural(encerrando.length, 'prazo', 'prazos')} nos próximos 14 dias e ${plural(alterados.length, 'edital alterado', 'editais alterados')}.`, 158);
    escrever('semana/index.html', layout({ rel: '../', url: `${SITE}/semana/`, ativo: 'semana', corpo: corpoSemana('../', false), assinatura: { chave: 'todos', nome: 'todos os editais' },
        titulo: `Resumo semanal de editais: novos, prazos e mudanças | ${NOME}`, descricao: corta(`Resumo desta semana, sempre atualizado: ${plural(novos.length, 'edital novo', 'editais novos')}, ${plural(encerrando.length, 'prazo', 'prazos')} em 14 dias e ${plural(alterados.length, 'mudança', 'mudanças')}.`, 158) }));
    escrever(`semana/${sem.chave}/index.html`, layout({ rel: '../../', url: `${SITE}/semana/${sem.chave}/`, ativo: 'semana', corpo: corpoSemana('../../', true),
        titulo: `Editais da semana ${sem.semana} de ${sem.ano} | ${NOME}`, descricao: descSemana }));
    urlsExtras.push([`${SITE}/semana/`, 'daily', '0.7', hoje], [`${SITE}/semana/${sem.chave}/`, 'daily', '0.4', hoje],
        ...anteriores.map(d => [`${SITE}/semana/${d}/`, 'yearly', '0.3', semanaFim(d)]));
}

/* ---------- Dados abertos (/dados/) ---------- */
{
    const rel = '../';
    const url = `${SITE}/dados/`;
    urlsExtras.push([url, 'weekly', '0.5']);
    const LICENCA = 'https://creativecommons.org/licenses/by/4.0/deed.pt-br';
    const linhaRecorte = r => `<tr><td>${esc(r.rotulo || 'Todos os editais')}</td><td><a href="${rel}feeds/${r.chave}.xml">feeds/${r.chave}.xml</a></td><td><a href="${rel}cal/${r.chave}.ics">cal/${r.chave}.ics</a></td></tr>`;
    const tabelaRecortes = ['Geral', 'Por perfil', 'Por área', 'Por instituição'].map(g => `<h3>${g}</h3>
        <div class="tabela-rolagem" role="region" aria-label="Feeds e calendários: ${g.toLowerCase()}" tabindex="0"><table class="tabela"><thead><tr><th scope="col">Recorte</th><th scope="col">RSS</th><th scope="col">Calendário</th></tr></thead>
        <tbody>${RECORTES.filter(r => r.grupo === g).map(linhaRecorte).join('')}</tbody></table></div>`).join('');
    escrever('dados/index.html', layout({
        rel, url, ativo: 'dados',
        titulo: `Dados abertos de editais: JSON, RSS e calendário | ${NOME}`,
        descricao: `Baixe os ${editais.filter(e => !e.arquivado).length} editais em JSON (licença CC BY 4.0), veja o esquema dos campos e assine feeds RSS e calendários por perfil, área e instituição.`,
        jsonld: { '@context': 'https://schema.org', '@type': 'Dataset', '@id': `${url}#dataset`,
            name: `${NOME}: editais de fomento abertos no Brasil`,
            description: `Editais e chamadas públicas de fomento (pesquisa, inovação, cultura, meio ambiente, social) de fontes oficiais: instituição, público, valores, datas de abertura e encerramento, etapas, critérios e links oficiais. Atualizado diariamente, com histórico de alterações de prazo e valor.`,
            url, license: 'https://creativecommons.org/licenses/by/4.0/', isAccessibleForFree: true, inLanguage: 'pt-BR', dateModified: geradoEm,
            keywords: ['editais', 'fomento', 'chamadas públicas', 'financiamento', 'pesquisa', 'inovação', 'OSC'],
            spatialCoverage: { '@type': 'Place', name: 'Brasil' },
            creator: { '@type': 'Organization', name: NOME, url: `${SITE}/` },
            distribution: [
                { '@type': 'DataDownload', name: 'editais.json', encodingFormat: 'application/json', contentUrl: `${SITE}/editais.json` },
                { '@type': 'DataDownload', name: 'Histórico de alterações', encodingFormat: 'application/json', contentUrl: `${SITE}/data/alteracoes.json` },
                { '@type': 'DataDownload', name: 'Feed RSS de editais', encodingFormat: 'application/rss+xml', contentUrl: `${SITE}/feeds/todos.xml` },
                { '@type': 'DataDownload', name: 'Feed RSS de alterações', encodingFormat: 'application/rss+xml', contentUrl: `${SITE}/feeds/alteracoes.xml` },
                { '@type': 'DataDownload', name: 'Calendário de prazos', encodingFormat: 'text/calendar', contentUrl: `${SITE}/cal/todos.ics` }
            ] },
        corpo: `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <span aria-current="page">Dados abertos</span></nav>
        <h1>Dados abertos dos editais</h1>
        <p class="sub">${plural(editais.filter(e => !e.arquivado).length, 'edital', 'editais')} em um único arquivo JSON, atualizado diariamente (dados de ${data(geradoEm)}), com licença aberta, feeds e calendários.</p>
        <div class="acoes">
            <a class="btn primario" href="${rel}editais.json" download type="application/json" data-evento="dados-baixar">Baixar editais.json</a>
            <a class="btn" href="${rel}data/alteracoes.json" type="application/json" data-evento="dados-alteracoes">Histórico de alterações (JSON)</a>
        </div>
        <section><h2>O que é</h2>
            <p>O <code>editais.json</code> é a mesma base usada pela plataforma e pelas páginas deste site: editais e chamadas públicas de fomento: os curados são conferidos por pessoa na fonte oficial; os do Transferegov (campo <code>origem</code>) são lidos automaticamente da API pública, sem revisão. Cada edital traz quem financia, quem pode participar, valores, datas, etapas, critérios e o link oficial.</p>
            <p>O arquivo é um objeto <code>{ "geradoEm", "demonstrativo", "editais": [...] }</code>. Datas usam o formato <code>AAAA-MM-DD</code> e o fuso de Brasília; valores são números na moeda do campo <code>moeda</code>. Campos opcionais podem não existir em todos os editais.</p></section>
        <section><h2>Licença</h2>
            <p>Os dados estão sob a licença <a href="${LICENCA}" target="_blank" rel="noopener license">Creative Commons Atribuição 4.0 Internacional (CC BY 4.0)</a>: você pode copiar, redistribuir e adaptar, inclusive para uso comercial, desde que cite a fonte, por exemplo: “Dados: ${NOME} (${SITE}/dados/)”.</p>
            <p><strong>O que a licença cobre.</strong> A licença CC BY 4.0 cobre a seleção, a organização e os textos próprios do ${NOME}. Textos oficiais, nomes e marcas de terceiros não são licenciados por nós; atos oficiais são de domínio público (Lei 9.610/1998, art. 8º, IV).</p>
            <p class="nota">O edital oficial sempre prevalece. Os resumos são informativos e podem ficar desatualizados entre uma verificação e outra; o campo <code>verificadoEm</code> diz quando cada edital foi conferido.</p></section>
        <section><h2>Esquema dos campos</h2>
            <div class="tabela-rolagem" role="region" aria-label="Esquema dos campos do editais.json" tabindex="0"><table class="tabela">
                <thead><tr><th scope="col">Campo</th><th scope="col">Tipo</th><th scope="col">Obrigatório</th><th scope="col">Descrição</th></tr></thead>
                <tbody>${ESQUEMA_CAMPOS.map(([c, t, o, d]) => `<tr><td><code>${esc(c)}</code></td><td>${esc(t)}</td><td>${esc(o)}</td><td>${esc(d)}</td></tr>`).join('')}</tbody>
            </table></div>
            <p class="nota">“Contrato” indica campos novos e opcionais: quem consome os dados deve funcionar com e sem eles.</p></section>
        <section><h2>Histórico de alterações</h2>
            <p>A cada atualização, o site compara os campos principais de cada edital (título, abertura, prazo, proposta completa, valores, link e etapa) com a versão anterior e registra as mudanças em <a href="${rel}data/alteracoes.json"><code>data/alteracoes.json</code></a>: uma lista de <code>{ "id", "campo", "de", "para", "em" }</code>. Editais incluídos aparecem com <code>"campo": "novo"</code>. As mesmas mudanças saem no <a href="${rel}feeds/alteracoes.xml">feed de alterações</a> e no <a href="${rel}semana/">resumo da semana</a>.</p></section>
        <section id="assinar"><h2>Feeds e calendários</h2>
            <p>Receba os editais novos num leitor de RSS e os prazos direto na sua agenda. Os calendários trazem um evento de dia inteiro para cada prazo, com lembretes 7 dias e 1 dia antes, e são atualizados todo dia.</p>
            <ul class="lista">
                <li><strong>Google Agenda:</strong> no computador, em “Outras agendas”, escolha “Do URL” e cole o endereço do calendário, por exemplo <code>${SITE}/cal/todos.ics</code>.</li>
                <li><strong>Outlook:</strong> “Adicionar calendário” › “Assinar da Web” e cole o endereço.</li>
                <li><strong>Apple Calendário:</strong> “Arquivo” › “Nova assinatura de calendário” e cole o endereço.</li>
                <li><strong>Leitor de RSS</strong> (Feedly, Inoreader, Thunderbird e outros): adicione o endereço do feed, por exemplo <code>${SITE}/feeds/todos.xml</code>.</li>
            </ul>
            <p>Feed de mudanças de prazo e valor: <a href="${rel}feeds/alteracoes.xml">feeds/alteracoes.xml</a>.</p>
            ${tabelaRecortes}</section>
        <section id="experiencia" aria-labelledby="experiencia-titulo"><h2 id="experiencia-titulo">Como medimos a experiência</h2>
            <p>Queremos saber se o site ajuda você a encontrar um edital e decidir se pode concorrer. Para isso, ${cfg.analytics?.goatcounter ? 'contamos alguns cliques, sempre de forma agregada' : 'vamos contar alguns cliques, sempre de forma agregada (a contagem ainda não está ligada)'}: <strong>sem cookies, sem cadastro e sem dados pessoais</strong>. Ninguém é identificado; vemos só quantas vezes cada botão foi usado.</p>
            <div class="tabela-rolagem" role="region" aria-labelledby="experiencia-titulo" tabindex="0"><table class="tabela">
                <thead><tr><th scope="col">Evento</th><th scope="col">O que conta</th></tr></thead>
                <tbody>${[
                    ['edital-teste', 'Cliques em “Posso concorrer? Fazer o teste”, na página de cada edital.'],
                    ['edital-oficial', 'Cliques em “Edital oficial”: quantas pessoas seguiram para a fonte.'],
                    ['edital-ics, edital-google-agenda', 'Prazos salvos na agenda (arquivo .ics ou Google Agenda).'],
                    ['edital-whatsapp', 'Editais enviados pelo WhatsApp.'],
                    ['glossario-abrir', 'Siglas e termos abertos no glossário.'],
                    ['para-<perfil>', 'Acessos às páginas por perfil (pesquisador, OSC, município etc.).'],
                    ['ces-facil, ces-medio, ces-dificil', 'Respostas à pergunta “Foi fácil encontrar o que procurava?”.']
                ].map(([ev, d]) => `<tr><td><code>${esc(ev)}</code></td><td>${esc(d)}</td></tr>`).join('')}</tbody>
            </table></div>
            <h3>A pergunta “Foi fácil?”</h3>
            <p>No fim das páginas de editais e por perfil há uma única pergunta: “Foi fácil encontrar o que procurava?”, com três respostas: <strong>Fácil</strong>, <strong>Mais ou menos</strong> e <strong>Difícil</strong>. Não há campo de texto. Depois de responder, a pergunta some por 30 dias naquele navegador. Funciona também sem JavaScript.</p>
            <h3>Resultado mensal</h3>
            <p>Todo mês publicamos nesta seção o resultado agregado do mês anterior: total de respostas, a porcentagem de cada opção e os eventos mais usados. A coleta começou em novembro de 2026; o primeiro resultado sai em dezembro de 2026.</p>
            <p class="nota">Seguimos como referência a Lei do Governo Digital (Lei 14.129/2021), que pede aos serviços públicos digitais que avaliem a satisfação de quem os usa e melhorem com base nela. O ${NOME} não é um serviço público, mas adota a mesma prática. Detalhes na <a href="${rel}privacidade/#experiencia">Política de Privacidade</a>.</p></section>`
    }));
}

/* ---------- Obrigado (resposta à pergunta "Foi fácil?" sem JavaScript) ---------- */
// noindex e fora do sitemap. Com GoatCounter configurado, um pixel conta a resposta (img-src já permite *.goatcounter.com).
for (const [k, t] of CES_OPCOES) {
    const rel = '../../';
    const pixel = cfg.analytics?.goatcounter ? `<img class="pixel" src="https://${esc(cfg.analytics.goatcounter)}.goatcounter.com/count?p=/evento/ces-${k}&amp;t=ces-${k}&amp;e=true" alt="" width="1" height="1">` : '';
    escrever(`obrigado/${k}/index.html`, layout({
        rel, url: `${SITE}/obrigado/${k}/`, robots: 'noindex,nofollow',
        titulo: `Obrigado pela resposta (${t}) | ${NOME}`, descricao: `Resposta anônima “${t}” à pergunta “Foi fácil encontrar o que procurava?”, contada só no total.`,
        corpo: `
        <h1>Obrigado!</h1>
        <p class="sub">Você respondeu: <strong>${t}</strong>. A resposta é anônima e entra só na contagem total.</p>
        ${k === 'dificil' ? `<p>Sentimos muito. Estes caminhos podem ajudar:</p>
        <ul class="lista"><li><a href="${rel}glossario/" data-evento="glossario-abrir">Glossário</a>: o que querem dizer as siglas e os termos dos editais.</li><li><a href="${rel}guias/como-encontrar-editais/">Como encontrar o edital certo</a>.</li><li><a href="${rel}prazos/">Prazos</a>: o que encerra primeiro.</li></ul>` : ''}
        <div class="acoes"><a class="btn primario" href="${rel}editais/">Voltar para os editais</a> <a class="btn" href="${rel}">Ir para o início</a></div>
        <p class="nota">Use o botão “Voltar” do navegador para retornar à página em que estava. <a href="${rel}dados/#experiencia">Como medimos a experiência</a>.</p>
        ${pixel}`
    }));
}

/* ---------- 404, sitemap, robots ---------- */
escrever('404.html', layout({
    rel: `${new URL(SITE).pathname.replace(/\/?$/, '/')}`, url: `${SITE}/`, titulo: `Página não encontrada | ${NOME}`, descricao: 'Esta página não existe ou foi removida.',
    corpo: `<h1>Página não encontrada</h1><p class="sub">O edital pode ter sido renomeado ou removido.</p>
        <div class="acoes"><a class="btn primario" href="${new URL(SITE).pathname.replace(/\/?$/, '/')}editais/">Ver todos os editais</a><a class="btn" href="${new URL(SITE).pathname.replace(/\/?$/, '/')}">Ir para o início</a></div>`
}).replace('<meta name="viewport"', '<meta name="robots" content="noindex">\n    <meta name="viewport"'));

const urls = [
    [`${SITE}/`, 'daily', '1.0'],
    [`${SITE}/editais/`, 'daily', '0.9'],
    // Encerrados continuam no sitemap (página no ar e indexável), com prioridade baixa e a data do encerramento
    ...editais.map(e => (statusEm(e) === 'fechado'
        ? [`${SITE}/editais/${slugEdital(e)}/`, 'monthly', '0.2', [e.encerramento, isoOk(e.verificadoEm) ? e.verificadoEm : ''].sort().pop()]
        : [`${SITE}/editais/${slugEdital(e)}/`, 'weekly', '0.8', isoOk(e.verificadoEm) ? e.verificadoEm : geradoEm])),
    [`${SITE}/instituicoes/`, 'weekly', '0.6'],
    ...instIndexaveis.map(k => [`${SITE}/instituicoes/${k}/`, 'weekly', '0.6']),
    ...urlsExtras
];
escrever('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, f, p, lm]) => `  <url><loc>${esc(u)}</loc><lastmod>${lm || geradoEm}</lastmod><changefreq>${f}</changefreq><priority>${p}</priority></url>`).join('\n')}
</urlset>
`);
escrever('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
if (!fs.existsSync(path.join(RAIZ, '.nojekyll'))) escrever('.nojekyll', '');

/* ---------- Editais embutidos no index.html ---------- */
{
    const reDados = /\/\/ editais:inicio[^\n]*\n[\s\S]*?\/\/ editais:fim/;
    if (!reDados.test(indexHtml)) throw new Error('Marcadores // editais:inicio e // editais:fim não encontrados no index.html');
    const ind = s => s.split('\n').map((l, i) => (i ? '        ' + l : l)).join('\n');
    const embutidos = [...brutos, ...brutosTG].filter(r => editais.some(e => e.id === r.id));
    const bloco = `// editais:inicio (gerado por scripts/gerar-paginas.mjs a partir do editais.json — não edite aqui)
        const DADOS_META = ${JSON.stringify({ geradoEm, demonstrativo })};
        let EDITAIS_BASE = ${ind(JSON.stringify(embutidos, null, 4)).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')};
        // editais:fim`;
    indexHtml = indexHtml.replace(reDados, () => bloco);
}

/* ---------- Metatags da página inicial ---------- */
const abertosHoje = editais.filter(e => statusEm(e) === 'aberto').length;
const seoHome = `<!-- seo:inicio (gerado por scripts/gerar-paginas.mjs) -->
    ${metasSeguranca}
    <meta name="description" content="${esc(corta(`Encontre editais e chamadas públicas compatíveis com seu perfil (${plural(abertosHoje, 'aberto', 'abertos')} agora), organize documentos e prazos, preste contas e acompanhe recursos públicos.`, 158))}">
    <link rel="canonical" href="${SITE}/">
    <meta name="theme-color" content="#1351B4">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${NOME}">
    <meta property="og:locale" content="pt_BR">
    <meta property="og:title" content="${NOME} — editais, propostas e prestação de contas">
    <meta property="og:description" content="Editais abertos, compatibilidade com seu perfil, checklist de documentos, prazos na agenda e prestação de contas.">
    <meta property="og:url" content="${SITE}/">
    <meta property="og:image" content="${OG_IMG}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
    <link rel="alternate" type="application/rss+xml" title="${NOME} — novos editais" href="${SITE}/feed.xml">
    ${headExtras()}
    <script>window.SITE_CFG = ${JSON.stringify({ apoio: cfg.apoio?.url ? { url: cfg.apoio.url, texto: cfg.apoio.texto } : null, apoie: apoioConfigurado, apoioTexto: cfg.apoio?.texto || '', boletim: cfg.boletim?.url || '', whatsappCanal: cfg.whatsappCanal || '', sugestao: sugestaoHref, contato: contatoHref }).replace(/</g, '\\u003c')};</script>
    <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [
        { '@type': 'WebSite', name: NOME, url: `${SITE}/`, inLanguage: 'pt-BR', description: cfg.descricaoCurta },
        { '@type': 'Organization', name: NOME, url: `${SITE}/`, logo: `${SITE}/assets/favicon.svg` }] })}</script>
    <!-- seo:fim -->`;
const reSeo = /<!-- seo:inicio[\s\S]*?<!-- seo:fim -->/;
indexHtml = reSeo.test(indexHtml) ? indexHtml.replace(reSeo, seoHome) : indexHtml.replace('</title>', `</title>\n    ${seoHome}`);
// Bloco visível e rastreável na página inicial: links diretos para editais, perfis e guias
{
    const reLista = /<!-- lista-seo:inicio -->[\s\S]*?<!-- lista-seo:fim -->/;
    const vig = vigentes(editais);
    const bloco = `<!-- lista-seo:inicio -->
    <section class="seo-links" aria-labelledby="seoLinksTitulo">
        <h2 id="seoLinksTitulo">Editais abertos agora</h2>
        <ul>${vig.map(e => `<li>${linkEdital(e, '')} — ${esc(e.instituicao)}, até ${data(e.encerramento)}</li>`).join('')}</ul>
        <p><strong>Por perfil:</strong> ${Object.values(PUBLICOS_HUB).map(h => `<a href="para/${h.slug}/">${esc(h.titulo)}</a>`).join(' · ')}</p>
        <p><strong>Guias:</strong> ${GUIAS.map(g => `<a href="guias/${g.slug}/">${esc(g.titulo)}</a>`).join(' · ')} · <a href="glossario/" data-evento="glossario-abrir">Glossário</a> · <a href="prazos/">Prazos</a> · <a href="semana/">Resumo da semana</a> · <a href="dados/">Dados abertos</a></p>
    </section>
    <!-- lista-seo:fim -->`;
    if (!reLista.test(indexHtml)) throw new Error('Marcadores <!-- lista-seo --> não encontrados no index.html');
    indexHtml = indexHtml.replace(reLista, () => bloco);
}
// CSP por último: os hashes valem para o conteúdo final dos scripts inline do index.html.
// Qualquer edição manual de um <script> inline do index.html exige rodar este gerador de novo (o workflow faz isso).
indexHtml = aplicaCSP(indexHtml);
fs.writeFileSync(indexPath, indexHtml);

avisos.forEach(a => console.warn('', a));
console.log(`${editais.length} editais, ${Object.keys(agencias).length} instituições, ${urls.length} URLs no sitemap · ${SITE}`);
