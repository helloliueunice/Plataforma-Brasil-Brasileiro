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
import { fileURLToPath } from 'node:url';
import { GUIAS, PUBLICOS_HUB } from './conteudo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PADRAO = 'https://helloliueunice.github.io/Plataforma-Brasil-Brasileiro';
const cname = fs.existsSync(path.join(RAIZ, 'CNAME')) ? fs.readFileSync(path.join(RAIZ, 'CNAME'), 'utf8').trim() : '';
const SITE = (process.env.SITE_URL || (cname ? `https://${cname}` : PADRAO)).replace(/\/+$/, '');
const cfg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'site.json'), 'utf8'));
const NOME = cfg.nome || 'Fundos Brasil';
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
const { COTACAO_REF, AREAS, PUBLICOS, UFS, REGIOES_UF, DOCS_POR_PUBLICO, DOCS_COMUNS, CRITERIOS_PADRAO, agencias, projetos } = ctx;
// Glossário: o mesmo usado na plataforma (definido mais abaixo no index.html)
const mGloss = indexHtml.match(/const GLOSSARIO = (\[[\s\S]*?\n        \]);/);
if (!mGloss) throw new Error('GLOSSARIO não encontrado no index.html');
const GLOSSARIO = vm.runInNewContext(mGloss[1]);

const fonte = JSON.parse(fs.readFileSync(path.join(RAIZ, 'editais.json'), 'utf8'));
const brutos = Array.isArray(fonte) ? fonte : fonte.editais || [];
const demonstrativo = !Array.isArray(fonte) && !!fonte.demonstrativo;
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
const valorTxt = e => (temValor(e) ? `até ${valor(e.valorMax, e.moeda)}` : /bolsa/i.test(e.modalidade) ? 'bolsas (ver condições)' : 'ver condições');
const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
const corta = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');
// "Hoje" no fuso de Brasília (o workflow roda em UTC; depois das 21h já seria o dia seguinte)
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const statusEm = (e, dia = hoje) => (dia < e.abertura ? 'em-breve' : dia <= e.encerramento ? 'aberto' : 'fechado');
const ROTULO = { aberto: 'Inscrições abertas', 'em-breve': 'Em breve', fechado: 'Encerrado' };
const mesAno = new Date(`${hoje}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());
const patrocinado = e => !!e.patrocinado && (!e.patrocinioAte || e.patrocinioAte >= hoje) && statusEm(e) !== 'fechado';
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
const SCRIPT_EVENTOS = `document.addEventListener('click',function(ev){var a=ev.target.closest&&ev.target.closest('[data-evento]');if(!a)return;var n=a.getAttribute('data-evento');try{if(window.goatcounter&&goatcounter.count)goatcounter.count({path:'evento/'+n,title:n,event:true});if(window.gtag)gtag('event',n)}catch(e){}});`;

/* ---------- Validação ---------- */
const avisos = [];
const editais = [];
brutos.forEach((r, i) => {
    const faltam = ['id', 'titulo', 'instituicao', 'abertura', 'encerramento'].filter(c => r[c] === undefined || r[c] === '');
    if (!(Number(r.valorMax) > 0) && !r.valorNota) faltam.push('valorMax ou valorNota');
    if (!isoOk(r.abertura) || !isoOk(r.encerramento)) faltam.push('datas no formato AAAA-MM-DD');
    if (!Array.isArray(r.publico) || !r.publico.length) faltam.push('publico');
    if (faltam.length) { avisos.push(`Item ${i + 1} (${r.titulo || 'sem título'}) ignorado: ${faltam.join(', ')}`); return; }
    const ag = agencias[r.agencia];
    editais.push({
        moeda: 'BRL', procedencia: 'nacional', tema: 'Desenvolvimento', modalidade: 'Não informada', abrangencia: 'Nacional',
        contrapartida: 'Não informada', tags: [], resumo: '', docsExtras: [], valorTotal: null, ...r,
        link: r.link || (ag ? ag.link : ''),
        criterios: r.criterios && r.criterios.length ? r.criterios : CRITERIOS_PADRAO,
        documentos: [...new Set([...r.publico.flatMap(p => DOCS_POR_PUBLICO[p] || []), ...DOCS_COMUNS, ...(r.docsExtras || [])])]
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
const slugs = new Set();
editais.forEach(e => { if (slugs.has(slugEdital(e))) throw new Error(`Slug duplicado: ${slugEdital(e)} (ids repetidos?)`); slugs.add(slugEdital(e)); });

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

function layout({ rel, titulo, descricao, url, tipo = 'website', jsonld, corpo, ativo = '', robots = '', ogImagem = '' }) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
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
    ${headExtras()}
    ${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
    <a class="pular" href="#conteudo">Pular para o conteúdo</a>
    <header class="topo">
        <a class="marca" href="${rel}"><span class="marca-icone" aria-hidden="true"></span>${NOME}</a>
        <nav aria-label="Navegação principal">
            <a href="${rel}editais/"${ativo === 'editais' ? ' aria-current="page"' : ''}>Editais</a>
            <a href="${rel}prazos/">Prazos</a>
            <a href="${rel}guias/"${ativo === 'guias' ? ' aria-current="page"' : ''}>Guias</a>
            <a href="${rel}instituicoes/"${ativo === 'instituicoes' ? ' aria-current="page"' : ''}>Instituições</a>
            <a class="btn primario pequeno" href="${rel}#editais" data-evento="topo-plataforma">Abrir a plataforma</a>
        </nav>
    </header>
    <main id="conteudo" class="pagina">
${corpo}
    </main>
    <footer class="rodape">
        <p><strong>${NOME}</strong> — plataforma para encontrar editais, organizar propostas e acompanhar recursos públicos.</p>
        <nav class="rodape-links" aria-label="Editais por perfil">${Object.values(PUBLICOS_HUB).map(h => `<a href="${rel}para/${h.slug}/">${esc(h.titulo.replace('Editais abertos ', 'Editais ').replace('Editais e programas abertos ', 'Programas '))}</a>`).join(' · ')}</nav>
        <p><a href="${rel}">Início</a> · <a href="${rel}editais/">Todos os editais</a> · <a href="${rel}prazos/">Prazos</a> · <a href="${rel}guias/">Guias</a> · <a href="${rel}glossario/">Glossário</a> · <a href="${rel}instituicoes/">Instituições</a> · <a href="${rel}sugerir-edital/">Sugerir edital</a> · <a href="${rel}parcerias/">Parcerias</a> · <a href="${rel}feed.xml">RSS</a></p>
        <p>${cfg.boletim?.url ? `<a class="btn pequeno primario" href="${esc(cfg.boletim.url)}" target="_blank" rel="noopener" data-evento="boletim">Receber novos editais</a> ` : ''}${cfg.whatsappCanal ? `<a class="btn pequeno whats" href="${esc(cfg.whatsappCanal)}" target="_blank" rel="noopener" data-evento="canal-whatsapp">Canal no WhatsApp</a> ` : ''}${cfg.apoio?.url ? `<a class="btn pequeno" href="${esc(cfg.apoio.url)}" target="_blank" rel="noopener" data-evento="apoio">${esc(cfg.apoio.texto || 'Apoie')}</a>` : ''}</p>
        <p class="nota">${demonstrativo ? 'Dados demonstrativos. ' : ''}Informações de ${data(geradoEm)}. Não somos canal oficial dos financiadores: confirme sempre no edital oficial da instituição.</p>
        <p class="nota"><a href="${rel}privacidade/">Privacidade</a> · <a href="${rel}termos/">Termos de uso</a></p>
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
            else { txt = 'Encerrado'; cls = 'fechado'; }
            el.textContent = txt; el.className = 'selo ' + cls;
        });
    })();
    ${SCRIPT_EVENTOS}
    </script>
</body>
</html>
`;
}

const selo = e => {
    const st = statusEm(e);
    return `<span class="selo ${st}" data-abertura="${e.abertura}" data-encerramento="${e.encerramento}"${e.etapaPrazo ? ` data-etapa="${esc(e.etapaPrazo)}"` : ''}>${e.etapaPrazo && st !== 'fechado' ? esc(e.etapaPrazo) + ' até ' + data(e.encerramento) : ROTULO[st]}</span>`;
};
const publicoTxt = e => e.publico.map(p => PUBLICOS[p] || p).join(', ');

function cartao(e, rel) {
    return `<li class="cartao">
            <div class="selos">${patrocinado(e) ? '<span class="selo patrocinado">Patrocinado</span> ' : ''}${selo(e)} <span class="selo neutro">${esc(e.modalidade)}</span></div>
            <h3><a href="${rel}editais/${slugEdital(e)}/">${esc(e.titulo)}</a></h3>
            <p>${esc(e.instituicao)} · <strong>${valorTxt(e)}</strong>${temValor(e) ? ' por proposta' : ''} · ${esc(publicoTxt(e))}</p>
            <p class="nota">Inscrições: ${data(e.abertura)} a ${data(e.encerramento)} · ${esc(e.abrangencia)}</p>
        </li>`;
}

function escrever(rota, html) {
    const destino = path.join(RAIZ, rota);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, html);
}

// Remove páginas geradas anteriormente (editais renomeados ou removidos)
for (const dir of ['editais', 'instituicoes', 'para', 'area', 'prazos', 'glossario', 'guias', 'parcerias', 'sugerir-edital', 'privacidade', 'termos']) fs.rmSync(path.join(RAIZ, dir), { recursive: true, force: true });

/* ---------- Página de cada edital ---------- */
for (const e of editais) {
    const rel = '../../';
    const url = `${SITE}/editais/${slugEdital(e)}/`;
    const ag = agencias[e.agencia];
    const instNome = ag ? `${ag.sigla} — ${ag.nome}` : e.instituicao;
    const area = AREAS[e.tema] || e.tema;
    // Buscadores exibem ~60 caracteres: título do edital primeiro, instituição e marca só se couberem
    const titulo = (t => (t.length <= 66 ? `${t} | ${NOME}` : t))(`${corta(e.titulo, 64)} — ${e.instituicao}`);
    const descricao = corta(`${e.numero ? e.numero + '. ' : ''}${e.modalidade}${temValor(e) ? `: até ${valor(e.valorMax, e.moeda)} por proposta` : ''} para ${publicoTxt(e)}. Inscrições de ${data(e.abertura)} a ${data(e.encerramento)}. ${e.resumo}`, 158);
    const textoWhats = `${e.titulo} (${e.instituicao})${temValor(e) ? ` — até ${valor(e.valorMax, e.moeda)} por proposta` : ''}. Inscrições até ${data(e.encerramento)}: ${url}`;
    const etapas = [['Publicação do edital', e.publicadoEm], ['Abertura das inscrições', e.abertura], ['Prazo final', e.encerramento], ['Resultado (previsão)', e.resultado]].filter(([, d]) => isoOk(d));
    const relacionados = editais.filter(x => x.id !== e.id && (x.agencia === e.agencia || x.tema === e.tema)).sort(ordemPrazo).slice(0, 4);
    const ufs = Array.isArray(e.ufs) && e.ufs.length ? e.ufs : REGIOES_UF[e.abrangencia];

    const jsonld = {
        '@context': 'https://schema.org',
        '@graph': [
            { '@type': 'BreadcrumbList', itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE}/` },
                { '@type': 'ListItem', position: 2, name: 'Editais', item: `${SITE}/editais/` },
                { '@type': 'ListItem', position: 3, name: e.titulo, item: url }
            ] },
            { '@type': 'MonetaryGrant', name: e.titulo, description: e.resumo || descricao, url, ...(e.link ? { sameAs: e.link } : {}),
              funder: { '@type': 'Organization', name: instNome, ...(ag ? { url: ag.link } : {}) },
              ...(temValor(e) ? { amount: { '@type': 'MonetaryAmount', currency: e.moeda, maxValue: e.valorMax } } : {}),
              ...(e.numero ? { identifier: e.numero } : {}) }
        ]
    };

    const corpo = `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <a href="${rel}editais/">Editais</a> › <span aria-current="page">${esc(e.titulo)}</span></nav>
        <div class="selos">${patrocinado(e) ? '<span class="selo patrocinado">Patrocinado</span> ' : ''}${selo(e)} <span class="selo neutro">${esc(e.modalidade)}</span> <span class="selo ${e.procedencia === 'internacional' ? 'internacional' : 'nacional'}">${e.procedencia === 'internacional' ? 'Internacional' : 'Nacional'}</span></div>
        ${e.numero ? `<p class="numero">${esc(e.numero)}</p>` : ''}
        <h1>${esc(e.titulo)}</h1>
        <p class="sub">${ag ? `<a href="${rel}instituicoes/${e.agencia}/">${esc(e.instituicao)}</a>` : esc(e.instituicao)} · ${esc(area)} · ${esc(e.abrangencia)}</p>

        <div class="acoes">
            <a class="btn primario" href="${rel}#edital-${e.id}" data-evento="edital-acompanhar">Acompanhar e ver o checklist</a>
            ${e.link ? `<a class="btn" href="${esc(e.link)}" target="_blank" rel="noopener noreferrer" data-evento="edital-oficial">Edital oficial</a>` : ''}
            <a class="btn whats" href="https://wa.me/?text=${encodeURIComponent(textoWhats)}" target="_blank" rel="noopener noreferrer" data-evento="edital-whatsapp">Enviar no WhatsApp</a>
        </div>

        <dl class="fatos">
            <div><dt>Valor por proposta</dt><dd>${valorTxt(e)}</dd></div>
            <div><dt>Valor total do edital</dt><dd>${e.valorTotal > 0 ? valor(e.valorTotal, e.moeda) : 'Não informado'}</dd></div>
            <div><dt>Prazo final</dt><dd>${data(e.encerramento)}</dd></div>
            <div><dt>Quem pode participar</dt><dd>${e.publico.map(p => PUBLICOS_HUB[p] ? `<a href="${rel}para/${PUBLICOS_HUB[p].slug}/">${esc(PUBLICOS[p] || p)}</a>` : esc(PUBLICOS[p] || p)).join(', ')}</dd></div>
            <div><dt>Contrapartida</dt><dd>${esc(e.contrapartida)}</dd></div>
            <div><dt>Abrangência</dt><dd>${esc(e.abrangencia)}${ufs && ufs.length > 1 ? `<br><small>${ufs.join(', ')}</small>` : ''}</dd></div>
        </dl>
        ${e.valorNota ? `<p class="destaque">${esc(e.valorNota)}</p>` : ''}
        ${e.moeda !== 'BRL' && temValor(e) ? `<p class="nota">Valores em ${e.moeda}. Equivalente aproximado: até ${valor(e.valorMax * (COTACAO_REF[e.moeda] || 1))} por proposta (cotação de referência).</p>` : ''}

        <section><h2>Sobre o edital</h2><p>${esc(e.resumo || 'Consulte o edital oficial para o objetivo completo.')}</p>
            ${e.fonte || e.verificadoEm ? `<p class="nota">Conferido${e.verificadoEm ? ` em ${data(e.verificadoEm)}` : ''}${e.fonte ? ` na <a href="${esc(e.fonte)}" target="_blank" rel="noopener noreferrer">fonte oficial</a>` : ''}.</p>` : ''}
            ${e.tags.length ? `<p class="tags">${e.tags.map(t => `<span>${esc(t)}</span>`).join('')}</p>` : ''}</section>

        <section><h2>Cronograma</h2>
            <ol class="cronograma">${etapas.map(([n, d]) => `<li><strong>${n}</strong> <span>${data(d)}</span></li>`).join('')}</ol>
            ${e.prazoNota ? `<p class="destaque">${esc(e.prazoNota)}</p>` : ''}</section>

        <section><h2>Documentos usuais</h2>
            <ul class="lista">${e.documentos.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
            <p class="nota">Lista de referência para organizar a proposta; vale a lista do edital oficial. <a href="${rel}#edital-${e.id}">Marque o que já está pronto na plataforma.</a></p></section>

        <section><h2>Critérios de avaliação</h2>
            <ul class="criterios">${e.criterios.map(c => `<li><span>${esc(c.nome)}</span>${c.peso != null ? `<strong>${c.peso}%</strong><i style="width:${c.peso}%"></i>` : ''}</li>`).join('')}</ul></section>

        <aside class="aviso">${demonstrativo ? '<strong>Dados demonstrativos.</strong> ' : ''}Informações de ${data(geradoEm)}. Antes de submeter, confirme datas, valores e requisitos no edital oficial publicado pela instituição.</aside>

        <section><h2>Como se preparar</h2><ul class="lista">${GUIAS.slice(0, 3).map(g => `<li><a href="${rel}guias/${g.slug}/">${esc(g.titulo)}</a></li>`).join('')}</ul></section>

        ${relacionados.length ? `<section><h2>Editais relacionados</h2><ul class="cartoes">${relacionados.map(x => cartao(x, rel)).join('')}</ul></section>` : ''}`;

    escrever(`editais/${slugEdital(e)}/index.html`, layout({ rel, titulo, descricao, url, tipo: 'article', jsonld, corpo, ativo: 'editais', ogImagem: ogDoEdital(e) }));
}

/* ---------- Lista de editais ---------- */
{
    const rel = '../';
    const grupos = ['aberto', 'em-breve', 'fechado'].map(st => [st, editais.filter(e => statusEm(e) === st).sort(ordemPrazo)]).filter(([, l]) => l.length);
    const abertos = editais.filter(e => statusEm(e) === 'aberto').length;
    const corpo = `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <span aria-current="page">Editais</span></nav>
        <h1>Editais e chamadas públicas</h1>
        <p class="sub">${plural(editais.length, 'edital', 'editais')} de ${new Set(editais.map(e => e.instituicao)).size} instituições · ${plural(abertos, 'com inscrições abertas', 'com inscrições abertas')}</p>
        <div class="acoes"><a class="btn primario" href="${rel}#editais" data-evento="lista-plataforma">Filtrar pelo meu perfil na plataforma</a> <a class="btn" href="${rel}prazos/">Ver por prazo</a></div>
        <p class="atalhos">${Object.values(PUBLICOS_HUB).map(h => `<a href="${rel}para/${h.slug}/">${esc(h.titulo.replace('Editais abertos ', '').replace('Editais e programas abertos ', ''))}</a>`).join('')}</p>
        ${grupos.map(([st, l]) => `<section><h2>${ROTULO[st]} (${l.length})</h2><ul class="cartoes">${l.map(e => cartao(e, rel)).join('')}</ul></section>`).join('')}`;
    const itemList = { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: editais.sort(ordemPrazo).map((e, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/editais/${slugEdital(e)}/`, name: e.titulo })) };
    escrever('editais/index.html', layout({
        rel, url: `${SITE}/editais/`, ativo: 'editais', jsonld: itemList, corpo,
        titulo: `Editais abertos e chamadas públicas de fomento | ${NOME}`,
        descricao: corta(`${plural(abertos, 'edital com inscrições abertas', 'editais com inscrições abertas')} para pesquisadores, empresas, OSCs e municípios: valores, prazos, documentos e critérios de ${[...new Set(editais.map(e => e.instituicao))].join(', ')}.`, 158)
    }));
}

/* ---------- Instituições ---------- */
for (const [k, a] of Object.entries(agencias)) {
    const rel = '../../';
    const eds = editais.filter(e => e.agencia === k).sort(ordemPrazo);
    const projs = projetos.filter(p => p.agencia === k);
    const url = `${SITE}/instituicoes/${k}/`;
    const corpo = `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <a href="${rel}instituicoes/">Instituições</a> › <span aria-current="page">${esc(a.sigla)}</span></nav>
        <p class="selos"><span class="selo neutro">${esc(a.pais)} · ${esc(a.cidade)}</span></p>
        <h1>${esc(a.sigla)} — ${esc(a.nome)}</h1>
        <p class="sub">${esc(a.descricao)}</p>
        <div class="acoes">
            <a class="btn primario" href="${rel}#agencia-${k}">Desembolsos e projetos na plataforma</a>
            <a class="btn" href="${esc(a.link)}" target="_blank" rel="noopener noreferrer">Portal oficial</a>
        </div>
        <dl class="fatos">
            <div><dt>Fundação</dt><dd>${a.fundacao}</dd></div>
            <div><dt>Faixa de apoio</dt><dd>${esc(a.intervalo)}</dd></div>
            <div><dt>Editais nesta plataforma</dt><dd>${eds.length}</dd></div>
            <div><dt>Áreas</dt><dd>${a.temas.map(esc).join(', ')}</dd></div>
        </dl>
        <section><h2>Editais</h2>${eds.length ? `<ul class="cartoes">${eds.map(e => cartao(e, rel)).join('')}</ul>` : '<p>Nenhum edital cadastrado no momento.</p>'}</section>
        ${projs.length ? `<section><h2>Projetos financiados</h2><ul class="lista">${projs.map(p => `<li><strong>${esc(p.titulo)}</strong> — ${valor(p.valor, p.moeda)} · ${esc(p.status)} (${p.inicio.slice(0, 4)}–${p.fim.slice(0, 4)})</li>`).join('')}</ul></section>` : ''}`;
    escrever(`instituicoes/${k}/index.html`, layout({
        rel, url, ativo: 'instituicoes', corpo,
        titulo: `${a.sigla}: editais e financiamento | ${NOME}`,
        descricao: corta(`${a.sigla} (${a.nome}): ${a.descricao} Veja ${plural(eds.length, 'edital', 'editais')}, prazos e valores.`, 158),
        jsonld: { '@context': 'https://schema.org', '@type': 'Organization', name: a.nome, alternateName: a.sigla, url: a.link, foundingDate: String(a.fundacao), address: a.cidade }
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
        descricao: corta(`Instituições que financiam projetos no Brasil: ${Object.values(agencias).map(a => a.sigla).join(', ')}. Editais, áreas de atuação e projetos financiados.`, 158),
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
        ${cfg.boletim?.url ? `<a class="btn primario" href="${esc(cfg.boletim.url)}" target="_blank" rel="noopener" data-evento="boletim">Receber novos editais</a>` : `<a class="btn primario" href="${rel}feed.xml" data-evento="feed">Assinar o feed de editais</a>`}
        <a class="btn" href="${rel}sugerir-edital/">Sugerir um edital</a>
    </div></div>`;

for (const [pub, h] of Object.entries(PUBLICOS_HUB)) {
    const rel = '../../';
    const lista = vigentes(editais.filter(e => e.publico.includes(pub)));
    const url = `${SITE}/para/${h.slug}/`;
    const indexavel = lista.length >= MIN_INDEXAVEL;
    if (indexavel) urlsExtras.push([url, 'daily', '0.8']);
    const docs = [...(DOCS_POR_PUBLICO[pub] || []), ...DOCS_COMUNS];
    const abertos = lista.filter(e => statusEm(e) === 'aberto').length;
    escrever(`para/${h.slug}/index.html`, layout({
        rel, url, ativo: 'editais', robots: indexavel ? '' : 'noindex,follow',
        titulo: `${h.titulo} (${mesAno}) | ${NOME}`,
        descricao: corta(`${lista.length ? `${plural(abertos, 'chamada aberta', 'chamadas abertas')} agora. ` : ''}${h.descricao}`, 158),
        jsonld: lista.length ? { '@context': 'https://schema.org', '@type': 'ItemList', name: h.h1, itemListElement: lista.map((e, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/editais/${slugEdital(e)}/`, name: e.titulo })) } : null,
        corpo: `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <a href="${rel}editais/">Editais</a> › <span aria-current="page">${esc(h.titulo.replace('Editais abertos ', '').replace('Editais e programas abertos ', ''))}</span></nav>
        <h1>${esc(h.h1)}</h1>
        <p class="sub">${lista.length ? `${plural(lista.length, 'chamada vigente', 'chamadas vigentes')} · atualizado em ${data(geradoEm)}` : `Atualizado em ${data(geradoEm)}`}</p>
        <div class="acoes"><a class="btn primario" href="${rel}#editais?publico=${pub}" data-evento="hub-plataforma">Ver compatibilidade com o meu perfil</a></div>
        ${lista.length ? `<section><h2>Chamadas abertas e previstas</h2><ul class="cartoes">${lista.map(e => cartao(e, rel)).join('')}</ul></section>` : blocoVazio(rel)}
        <section><h2>Como funciona</h2>${h.intro.replace(/\{raiz\}/g, rel)}</section>
        <section><h2>Dicas rápidas</h2><ul class="lista">${h.dicas.map(d => `<li>${esc(d)}</li>`).join('')}</ul></section>
        <section><h2>Documentos que costumam ser pedidos</h2><ul class="lista">${docs.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
            <p class="nota">Veja o <a href="${rel}guias/documentos-para-editais/">checklist completo de documentos</a>. Cada edital define a lista oficial.</p></section>
        <section><h2>Guias</h2>${linkGuias(rel)}</section>`
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
        rel, url, ativo: 'editais', robots: indexavel ? '' : 'noindex,follow',
        titulo: `Editais abertos de ${nomeArea} (${mesAno}) | ${NOME}`,
        descricao: corta(`${plural(lista.length, 'chamada vigente', 'chamadas vigentes')} em ${nomeArea}: valores, prazos, quem pode participar e documentos, conferidos nas fontes oficiais.`, 158),
        jsonld: { '@context': 'https://schema.org', '@type': 'ItemList', name: `Editais de ${nomeArea}`, itemListElement: lista.map((e, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/editais/${slugEdital(e)}/`, name: e.titulo })) },
        corpo: `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <a href="${rel}editais/">Editais</a> › <span aria-current="page">${esc(nomeArea)}</span></nav>
        <h1>Editais abertos de ${esc(nomeArea)}</h1>
        <p class="sub">${plural(lista.length, 'chamada vigente', 'chamadas vigentes')} · atualizado em ${data(geradoEm)}</p>
        <ul class="cartoes">${lista.map(e => cartao(e, rel)).join('')}</ul>
        <section><h2>Por perfil</h2><ul class="lista">${Object.entries(PUBLICOS_HUB).map(([p, h]) => `<li><a href="${rel}para/${h.slug}/">${esc(h.titulo)}</a></li>`).join('')}</ul></section>
        <section><h2>Guias</h2>${linkGuias(rel)}</section>`
    }));
}

{
    const rel = '../';
    const ab = editais.filter(e => statusEm(e) === 'aberto').sort((a, b) => a.encerramento.localeCompare(b.encerramento));
    const breve = editais.filter(e => statusEm(e) === 'em-breve').sort((a, b) => a.abertura.localeCompare(b.abertura));
    const url = `${SITE}/prazos/`;
    if (ab.length + breve.length >= MIN_INDEXAVEL) urlsExtras.push([url, 'daily', '0.8']);
    const linha = e => `<li><span class="data">${data(e.encerramento).slice(0, 5)}</span> <a href="${rel}editais/${slugEdital(e)}/">${esc(e.titulo)}</a> <span class="nota">· ${esc(e.instituicao)} · ${valorTxt(e)}</span> ${selo(e)}</li>`;
    escrever('prazos/index.html', layout({
        rel, url, ativo: 'editais', robots: ab.length + breve.length >= MIN_INDEXAVEL ? '' : 'noindex,follow',
        titulo: `Prazos de editais: chamadas que encerram em breve (${mesAno}) | ${NOME}`,
        descricao: corta(`Calendário de prazos: ${plural(ab.length, 'chamada aberta', 'chamadas abertas')} em ordem de encerramento e ${plural(breve.length, 'que abre', 'que abrem')} em breve. Não perca o prazo.`, 158),
        corpo: `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <span aria-current="page">Prazos</span></nav>
        <h1>Prazos de editais: o que encerra primeiro</h1>
        <p class="sub">Atualizado em ${data(geradoEm)}. Prazos com horário-limite: confira sempre o edital oficial.</p>
        <div class="acoes"><a class="btn primario" href="${rel}#editais?view=calendario" data-evento="prazos-calendario">Ver no calendário e exportar para a agenda</a></div>
        <section><h2>Inscrições abertas, por prazo final</h2>${ab.length ? `<ul class="agenda">${ab.map(linha).join('')}</ul>` : '<p>Nenhuma chamada aberta no momento.</p>'}</section>
        ${breve.length ? `<section><h2>Abrem em breve</h2><ul class="agenda">${breve.map(e => `<li><span class="data">${data(e.abertura).slice(0, 5)}</span> <a href="${rel}editais/${slugEdital(e)}/">${esc(e.titulo)}</a> <span class="nota">· ${esc(e.instituicao)} · abre em ${data(e.abertura)}</span></li>`).join('')}</ul></section>` : ''}`
    }));
}

/* ---------- Glossário ---------- */
{
    const rel = '../';
    const url = `${SITE}/glossario/`;
    urlsExtras.push([url, 'monthly', '0.6']);
    escrever('glossario/index.html', layout({
        rel, url, ativo: 'guias',
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
        rel, url: `${SITE}/guias/`, ativo: 'guias',
        titulo: `Guias para captar recursos com editais | ${NOME}`,
        descricao: 'Guias práticos para encontrar editais, reunir documentos, escrever propostas competitivas e prestar contas de projetos financiados.',
        corpo: `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <span aria-current="page">Guias</span></nav>
        <h1>Guias para captar recursos com editais</h1>
        <p class="sub">Do primeiro edital à prestação de contas.</p>
        <ul class="cartoes">${GUIAS.map(g => `<li class="cartao"><h3><a href="${rel}guias/${g.slug}/">${esc(g.titulo)}</a></h3><p>${esc(g.descricao)}</p></li>`).join('')}
            <li class="cartao"><h3><a href="${rel}glossario/">Glossário de editais e fomento</a></h3><p>CAUC, MROSC, ICT, contrapartida, rubrica e outros termos explicados.</p></li></ul>`
    }));
    for (const g of GUIAS) {
        const relG = '../../';
        const url = `${SITE}/guias/${g.slug}/`;
        urlsExtras.push([url, 'monthly', '0.7']);
        const outros = GUIAS.filter(x => x.slug !== g.slug);
        escrever(`guias/${g.slug}/index.html`, layout({
            rel: relG, url, tipo: 'article', ativo: 'guias',
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
            <p><a href="${relG}editais/">Ver todos os editais →</a></p></section>
        <section><h2>Outros guias</h2><ul class="lista">${outros.map(x => `<li><a href="${relG}guias/${x.slug}/">${esc(x.titulo)}</a></li>`).join('')}</ul></section>`
        }));
    }
}

/* ---------- Parcerias (monetização com transparência) e sugestão de edital ---------- */
const contatoHref = cfg.contato ? (/^https?:/.test(cfg.contato) ? cfg.contato : `mailto:${cfg.contato}`) : `${REPO}/issues/new?template=parceria.yml`;
const sugestaoHref = cfg.formularioSugestao || `${REPO}/issues/new?template=sugerir-edital.yml`;
{
    const rel = '../';
    urlsExtras.push([`${SITE}/parcerias/`, 'monthly', '0.5']);
    escrever('parcerias/index.html', layout({
        rel, url: `${SITE}/parcerias/`, ativo: 'parcerias',
        titulo: `Parcerias, patrocínio e divulgação de editais | ${NOME}`,
        descricao: 'Divulgue seu edital de graça, destaque chamadas com selo de patrocínio transparente ou leve a plataforma de captação para sua instituição.',
        corpo: `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <span aria-current="page">Parcerias</span></nav>
        <h1>Parcerias</h1>
        <p class="sub">O ${NOME} é gratuito para quem busca editais. Financiadores, instituições e empresas podem ampliar o alcance das suas chamadas e apoiar o projeto, sempre com regras editoriais claras.</p>
        <ul class="cartoes">
            <li class="cartao"><h3>Publique seu edital — grátis</h3><p>Envie o link da chamada oficial. A equipe confere os dados e publica com página própria, prévia para WhatsApp e entrada no feed e nos alertas.</p><p><a class="btn pequeno primario" href="${esc(sugestaoHref)}" target="_blank" rel="noopener" data-evento="parceria-publicar">Enviar edital</a></p></li>
            <li class="cartao"><h3>Destaque patrocinado</h3><p>Sua chamada em posição de destaque na página inicial e nas páginas do público-alvo, por tempo definido.</p></li>
            <li class="cartao"><h3>Patrocínio de conteúdo</h3><p>Apoie um guia, o boletim de editais ou uma seção temática, com crédito visível e independência editorial.</p></li>
            <li class="cartao"><h3>Para governos, FAPs e fundações</h3><p>Portal de captação e prestação de contas com a sua identidade, monitoramento de chamadas e painel de indicadores para municípios, secretarias e redes.</p></li>
        </ul>
        <section><h2>Regras do destaque patrocinado</h2>
            <ul class="lista">
                <li>Só chamadas reais, com inscrições abertas e conferidas na fonte oficial.</li>
                <li>Selo <strong>“Patrocinado”</strong> sempre visível, com o nome de quem patrocina.</li>
                <li>O destaque ocupa <strong>uma vaga reservada e sinalizada</strong> na página inicial. Não altera a busca, os filtros, a compatibilidade com o perfil nem a ordem da lista de resultados.</li>
                <li>Recusamos patrocínio de chamadas encerradas, sem fonte oficial verificável ou com publicidade enganosa.</li>
                <li>Patrocínio por órgão público segue as regras de contratação aplicáveis (Lei 14.133/2021). Conflitos de interesse são informados na página da chamada.</li>
                <li>Nenhum dado pessoal de usuários é vendido ou compartilhado.</li>
            </ul></section>
        <div class="acoes"><a class="btn primario" href="${esc(contatoHref)}" target="_blank" rel="noopener" data-evento="parceria-contato">Falar sobre parceria</a>
            ${cfg.apoio?.url ? `<a class="btn" href="${esc(cfg.apoio.url)}" target="_blank" rel="noopener" data-evento="apoio">${esc(cfg.apoio.texto || 'Apoie')}</a>` : ''}</div>`
    }));
    /* ---------- Privacidade e Termos de uso (LGPD, Marco Civil, CDC) ---------- */
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
        <p class="sub">Versão de 31/10/2026. Escrita em linguagem simples, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018) e o Marco Civil da Internet (Lei 12.965/2014).</p>
        <section><h2>Quem somos</h2><p>O ${NOME} é um serviço gratuito e informativo mantido por ${responsavel}. Contato: ${canal}.</p></section>
        <section><h2>O que fica só no seu navegador</h2><p>Perfil, favoritos, propostas, checklists, rascunhos, prestações de contas de demonstração e o nome/e-mail do “login” de demonstração são gravados apenas no armazenamento local do seu navegador. <strong>Esses dados não chegam até nós.</strong> Para apagá-los, use “Apagar meus dados” na plataforma ou limpe os dados do site no navegador.</p></section>
        <section><h2>Serviços de terceiros que recebem seu endereço IP</h2><ul class="lista">
            <li><strong>GitHub Pages</strong> (hospedagem do site).</li>
            <li><strong>Google Fonts</strong> (fontes) e <strong>Cloudflare/cdnjs</strong> (bibliotecas de mapa e gráfico).</li>
            <li><strong>OpenStreetMap</strong> (imagens do mapa, só na página Mapa).</li>
            ${cfg.analytics?.goatcounter ? '<li><strong>GoatCounter</strong> (contagem agregada de visitas, sem cookies e sem identificar pessoas).</li>' : ''}
            ${cfg.analytics?.ga4 ? '<li><strong>Google Analytics</strong> (medição de uso; carregado só com o seu consentimento).</li>' : ''}
        </ul><p>Esses serviços podem estar fora do Brasil (transferência internacional, art. 33 da LGPD) e seguem as próprias políticas. Usamos esses serviços por legítimo interesse, para que o site funcione.</p></section>
        <section><h2>Sugestões de edital e pedidos de parceria</h2><p>São feitos no GitHub e ficam <strong>públicos</strong>. Não informe telefone, CPF, endereço ou e-mail pessoal nesses formulários.</p></section>
        <section><h2>Seus direitos</h2><p>Você pode pedir confirmação, acesso, correção ou eliminação de dados pessoais que porventura tratemos (art. 18 da LGPD) pelo contato acima, e também pode recorrer à Autoridade Nacional de Proteção de Dados (ANPD).</p></section>
        <section><h2>Atualizações</h2><p>Mudanças nesta política serão publicadas nesta página, com a data da versão.</p></section>`
    }));
    escrever('termos/index.html', layout({
        rel, url: `${SITE}/termos/`,
        titulo: `Termos de uso | ${NOME}`,
        descricao: `Condições de uso do ${NOME}: serviço informativo e gratuito; o edital oficial sempre prevalece; conteúdo patrocinado é sinalizado.`,
        corpo: `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <span aria-current="page">Termos de uso</span></nav>
        <h1>Termos de uso</h1>
        <p class="sub">Versão de 31/10/2026.</p>
        <ul class="lista">
            <li><strong>Serviço informativo e gratuito.</strong> O ${NOME} reúne e resume editais públicos e privados de fomento. <strong>Não é canal oficial</strong> e não tem vínculo com os órgãos e instituições citados.</li>
            <li><strong>O edital oficial sempre prevalece.</strong> Cada resumo informa a fonte e a data em que foi conferido. Prazos, valores e requisitos podem mudar (retificações, prorrogações); não garantimos que estejam completos ou atualizados. Confirme sempre no documento oficial antes de submeter.</li>
            <li><strong>Inscrições, propostas e prestações de contas reais</strong> são feitas apenas nos sistemas da instituição financiadora. As áreas de projetos e prestação de contas desta plataforma são <strong>simulações</strong>: nada é enviado a ninguém.</li>
            <li><strong>Nomes de instituições</strong> são usados apenas para identificá-las. Textos de editais publicados por órgãos públicos são atos oficiais (Lei 9.610/1998, art. 8º, IV); chamadas de entidades privadas e internacionais são resumidas com redação própria, com link para o original.</li>
            <li><strong>Conteúdo patrocinado</strong> é sempre sinalizado com o selo “Patrocinado” e segue as regras publicadas em <a href="${rel}parcerias/">Parcerias</a>.</li>
            <li><strong>Seus dados:</strong> não insira dados de terceiros nem dados sensíveis. Veja a <a href="${rel}privacidade/">Política de Privacidade</a>.</li>
            <li>Aplica-se a lei brasileira.</li>
        </ul>`
    }));
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
    <title>${esc(e.titulo)} — ${esc(e.instituicao)}</title>
    <link>${SITE}/editais/${slugEdital(e)}/</link>
    <guid isPermaLink="true">${SITE}/editais/${slugEdital(e)}/</guid>
    <pubDate>${rfc(e.publicadoEm || e.abertura)}</pubDate>
    <category>${esc(AREAS[e.tema] || e.tema)}</category>
    <description>${esc(`${e.numero ? e.numero + '. ' : ''}${valorTxt(e)}${temValor(e) ? ' por proposta' : ''} · ${publicoTxt(e)} · inscrições de ${data(e.abertura)} a ${data(e.encerramento)}. ${e.resumo}`)}</description>
  </item>`).join('\n')}
</channel>
</rss>
`);
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
    ...editais.map(e => [`${SITE}/editais/${slugEdital(e)}/`, 'weekly', statusEm(e) === 'fechado' ? '0.4' : '0.8', isoOk(e.verificadoEm) ? e.verificadoEm : geradoEm]),
    [`${SITE}/instituicoes/`, 'weekly', '0.6'],
    ...Object.keys(agencias).map(k => [`${SITE}/instituicoes/${k}/`, 'weekly', '0.6']),
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
    const embutidos = brutos.filter(r => editais.some(e => e.id === r.id));
    const bloco = `// editais:inicio (gerado por scripts/gerar-paginas.mjs a partir do editais.json — não edite aqui)
        const DADOS_META = ${JSON.stringify({ geradoEm, demonstrativo })};
        let EDITAIS_BASE = ${ind(JSON.stringify(embutidos, null, 4)).replace(/<\/(script)/gi, '<\\/$1')};
        // editais:fim`;
    indexHtml = indexHtml.replace(reDados, () => bloco);
}

/* ---------- Metatags da página inicial ---------- */
const abertosHoje = editais.filter(e => statusEm(e) === 'aberto').length;
const seoHome = `<!-- seo:inicio (gerado por scripts/gerar-paginas.mjs) -->
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
    <script>window.SITE_CFG = ${JSON.stringify({ apoio: cfg.apoio?.url ? cfg.apoio : null, boletim: cfg.boletim?.url || '', whatsappCanal: cfg.whatsappCanal || '', sugestao: sugestaoHref, contato: contatoHref }).replace(/</g, '\\u003c')};</script>
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
        <ul>${vig.map(e => `<li><a href="editais/${slugEdital(e)}/">${esc(e.titulo)}</a> — ${esc(e.instituicao)}, até ${data(e.encerramento)}</li>`).join('')}</ul>
        <p><strong>Por perfil:</strong> ${Object.values(PUBLICOS_HUB).map(h => `<a href="para/${h.slug}/">${esc(h.titulo)}</a>`).join(' · ')}</p>
        <p><strong>Guias:</strong> ${GUIAS.map(g => `<a href="guias/${g.slug}/">${esc(g.titulo)}</a>`).join(' · ')} · <a href="glossario/">Glossário</a> · <a href="prazos/">Prazos</a></p>
    </section>
    <!-- lista-seo:fim -->`;
    if (!reLista.test(indexHtml)) throw new Error('Marcadores <!-- lista-seo --> não encontrados no index.html');
    indexHtml = indexHtml.replace(reLista, () => bloco);
}
fs.writeFileSync(indexPath, indexHtml);

avisos.forEach(a => console.warn('', a));
console.log(`${editais.length} editais, ${Object.keys(agencias).length} instituições, ${urls.length} URLs no sitemap · ${SITE}`);
