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

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PADRAO = 'https://helloliueunice.github.io/Plataforma-Brasil-Brasileiro';
const cname = fs.existsSync(path.join(RAIZ, 'CNAME')) ? fs.readFileSync(path.join(RAIZ, 'CNAME'), 'utf8').trim() : '';
const SITE = (process.env.SITE_URL || (cname ? `https://${cname}` : PADRAO)).replace(/\/+$/, '');
const NOME = 'Fundos Brasil';

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

const fonte = JSON.parse(fs.readFileSync(path.join(RAIZ, 'editais.json'), 'utf8'));
const brutos = Array.isArray(fonte) ? fonte : fonte.editais || [];
const demonstrativo = !Array.isArray(fonte) && !!fonte.demonstrativo;
const geradoEm = (!Array.isArray(fonte) && fonte.geradoEm) || new Date().toISOString().slice(0, 10);

/* ---------- Utilitários ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// Mesma regra de slugEdital() no index.html
const slugify = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, '');
const slugEdital = e => `${slugify(e.titulo)}-${e.id}`;
const isoOk = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const data = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const valor = (v, moeda = 'BRL') => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda, notation: 'compact', maximumFractionDigits: 1 }).format(v);
const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
const corta = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');
const hoje = new Date().toISOString().slice(0, 10);
const statusEm = (e, dia = hoje) => (dia < e.abertura ? 'em-breve' : dia <= e.encerramento ? 'aberto' : 'fechado');
const ROTULO = { aberto: 'Inscrições abertas', 'em-breve': 'Em breve', fechado: 'Encerrado' };

/* ---------- Validação ---------- */
const avisos = [];
const editais = [];
brutos.forEach((r, i) => {
    const faltam = ['id', 'titulo', 'instituicao', 'abertura', 'encerramento', 'valorMax'].filter(c => r[c] === undefined || r[c] === '');
    if (!isoOk(r.abertura) || !isoOk(r.encerramento)) faltam.push('datas no formato AAAA-MM-DD');
    if (!Array.isArray(r.publico) || !r.publico.length) faltam.push('publico');
    if (faltam.length) { avisos.push(`Item ${i + 1} (${r.titulo || 'sem título'}) ignorado: ${faltam.join(', ')}`); return; }
    const ag = agencias[r.agencia];
    editais.push({
        moeda: 'BRL', procedencia: 'nacional', tema: 'Desenvolvimento', modalidade: 'Não informada', abrangencia: 'Nacional',
        contrapartida: 'Não informada', tags: [], resumo: '', docsExtras: [], valorTotal: r.valorMax, ...r,
        link: r.link || (ag ? ag.link : ''),
        criterios: r.criterios && r.criterios.length ? r.criterios : CRITERIOS_PADRAO,
        documentos: [...new Set([...r.publico.flatMap(p => DOCS_POR_PUBLICO[p] || []), ...DOCS_COMUNS, ...(r.docsExtras || [])])]
    });
});
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

function layout({ rel, titulo, descricao, url, tipo = 'website', jsonld, corpo, ativo = '' }) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(titulo)}</title>
    <meta name="description" content="${esc(descricao)}">
    <link rel="canonical" href="${esc(url)}">
    <meta name="theme-color" content="#1351B4">
    <meta property="og:type" content="${tipo}">
    <meta property="og:site_name" content="${NOME}">
    <meta property="og:locale" content="pt_BR">
    <meta property="og:title" content="${esc(titulo)}">
    <meta property="og:description" content="${esc(descricao)}">
    <meta property="og:url" content="${esc(url)}">
    <meta property="og:image" content="${OG_IMG}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${NOME} — editais e fundos de financiamento">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="icon" href="${rel}assets/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="${rel}assets/paginas.css">
    ${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
    <a class="pular" href="#conteudo">Pular para o conteúdo</a>
    <header class="topo">
        <a class="marca" href="${rel}"><span aria-hidden="true">🇧🇷</span> ${NOME}</a>
        <nav aria-label="Navegação principal">
            <a href="${rel}editais/"${ativo === 'editais' ? ' aria-current="page"' : ''}>Editais</a>
            <a href="${rel}instituicoes/"${ativo === 'instituicoes' ? ' aria-current="page"' : ''}>Instituições</a>
            <a href="${rel}#propostas">Minhas propostas</a>
            <a class="btn primario pequeno" href="${rel}#editais">Abrir a plataforma</a>
        </nav>
    </header>
    <main id="conteudo" class="pagina">
${corpo}
    </main>
    <footer class="rodape">
        <p><strong>${NOME}</strong> — plataforma para encontrar editais, organizar propostas e acompanhar recursos públicos.</p>
        <p><a href="${rel}">Início</a> · <a href="${rel}editais/">Todos os editais</a> · <a href="${rel}instituicoes/">Instituições</a> · <a href="${rel}#ajuda">Ajuda e glossário</a></p>
        <p class="nota">${demonstrativo ? 'Dados demonstrativos. ' : ''}Informações de ${data(geradoEm)}. Confirme sempre no edital oficial da instituição.</p>
    </footer>
    <script>
    // Atualiza a situação pela data de hoje (a página pode ter sido gerada há alguns dias)
    (function () {
        var d = new Date(), h = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        var dia = 864e5, t0 = Date.parse(h);
        document.querySelectorAll('[data-abertura]').forEach(function (el) {
            var a = el.dataset.abertura, z = el.dataset.encerramento, txt, cls;
            if (h < a) { var n = Math.round((Date.parse(a) - t0) / dia); txt = '⏰ Abre em ' + n + (n === 1 ? ' dia' : ' dias'); cls = 'em-breve'; }
            else if (h <= z) { var m = Math.round((Date.parse(z) - t0) / dia); txt = m === 0 ? '⏳ Encerra hoje' : (m <= 7 ? '⏳ Encerra em ' : '✅ Aberto · ') + m + (m === 1 ? ' dia' : ' dias') + (m > 7 ? ' restantes' : ''); cls = m <= 7 ? 'urgente' : 'aberto'; }
            else { txt = '❌ Encerrado'; cls = 'fechado'; }
            el.textContent = txt; el.className = 'selo ' + cls;
        });
    })();
    </script>
</body>
</html>
`;
}

const selo = e => {
    const st = statusEm(e);
    return `<span class="selo ${st}" data-abertura="${e.abertura}" data-encerramento="${e.encerramento}">${st === 'aberto' ? '✅' : st === 'em-breve' ? '⏰' : '❌'} ${ROTULO[st]}</span>`;
};
const publicoTxt = e => e.publico.map(p => PUBLICOS[p] || p).join(', ');

function cartao(e, rel) {
    return `<li class="cartao">
            <div class="selos">${selo(e)} <span class="selo neutro">${esc(e.modalidade)}</span></div>
            <h3><a href="${rel}editais/${slugEdital(e)}/">${esc(e.titulo)}</a></h3>
            <p>${esc(e.instituicao)} · até <strong>${valor(e.valorMax, e.moeda)}</strong> por proposta · ${esc(publicoTxt(e))}</p>
            <p class="nota">Inscrições: ${data(e.abertura)} a ${data(e.encerramento)} · ${esc(e.abrangencia)}</p>
        </li>`;
}

function escrever(rota, html) {
    const destino = path.join(RAIZ, rota);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, html);
}

// Remove páginas geradas anteriormente (editais renomeados ou removidos)
for (const dir of ['editais', 'instituicoes']) fs.rmSync(path.join(RAIZ, dir), { recursive: true, force: true });

/* ---------- Página de cada edital ---------- */
for (const e of editais) {
    const rel = '../../';
    const url = `${SITE}/editais/${slugEdital(e)}/`;
    const ag = agencias[e.agencia];
    const instNome = ag ? `${ag.sigla} — ${ag.nome}` : e.instituicao;
    const area = AREAS[e.tema] || e.tema;
    const titulo = `${e.titulo} — ${e.instituicao} | ${NOME}`;
    const descricao = corta(`${e.modalidade}: até ${valor(e.valorMax, e.moeda)} por proposta para ${publicoTxt(e)}. Inscrições de ${data(e.abertura)} a ${data(e.encerramento)}. ${e.resumo}`, 158);
    const textoWhats = `${e.titulo} (${e.instituicao}) — até ${valor(e.valorMax, e.moeda)} por proposta. Inscrições até ${data(e.encerramento)}: ${url}`;
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
              amount: { '@type': 'MonetaryAmount', currency: e.moeda, maxValue: e.valorMax } }
        ]
    };

    const corpo = `
        <nav class="migalhas" aria-label="Você está em"><a href="${rel}">Início</a> › <a href="${rel}editais/">Editais</a> › <span aria-current="page">${esc(e.titulo)}</span></nav>
        <div class="selos">${selo(e)} <span class="selo neutro">${esc(e.modalidade)}</span> <span class="selo ${e.procedencia === 'internacional' ? 'internacional' : 'nacional'}">${e.procedencia === 'internacional' ? '🌍 Internacional' : '🇧🇷 Nacional'}</span></div>
        <h1>${esc(e.titulo)}</h1>
        <p class="sub">${ag ? `<a href="${rel}instituicoes/${e.agencia}/">${esc(e.instituicao)}</a>` : esc(e.instituicao)} · ${esc(area)} · ${esc(e.abrangencia)}</p>

        <div class="acoes">
            <a class="btn primario" href="${rel}#edital-${e.id}">📋 Acompanhar e ver o checklist</a>
            ${e.link ? `<a class="btn" href="${esc(e.link)}" target="_blank" rel="noopener noreferrer">🔗 Edital oficial</a>` : ''}
            <a class="btn whats" href="https://wa.me/?text=${encodeURIComponent(textoWhats)}" target="_blank" rel="noopener noreferrer">📲 Enviar no WhatsApp</a>
        </div>

        <dl class="fatos">
            <div><dt>Valor por proposta</dt><dd>até ${valor(e.valorMax, e.moeda)}</dd></div>
            <div><dt>Valor total do edital</dt><dd>${valor(e.valorTotal, e.moeda)}</dd></div>
            <div><dt>Prazo final</dt><dd>${data(e.encerramento)}</dd></div>
            <div><dt>Quem pode participar</dt><dd>${esc(publicoTxt(e))}</dd></div>
            <div><dt>Contrapartida</dt><dd>${esc(e.contrapartida)}</dd></div>
            <div><dt>Abrangência</dt><dd>${esc(e.abrangencia)}${ufs && ufs.length > 1 ? `<br><small>${ufs.join(', ')}</small>` : ''}</dd></div>
        </dl>
        ${e.moeda !== 'BRL' ? `<p class="nota">Valores em ${e.moeda}. Equivalente aproximado: até ${valor(e.valorMax * (COTACAO_REF[e.moeda] || 1))} por proposta (cotação de referência).</p>` : ''}

        <section><h2>Sobre o edital</h2><p>${esc(e.resumo || 'Consulte o edital oficial para o objetivo completo.')}</p>
            ${e.tags.length ? `<p class="tags">${e.tags.map(t => `<span>${esc(t)}</span>`).join('')}</p>` : ''}</section>

        <section><h2>Cronograma</h2>
            <ol class="cronograma">${etapas.map(([n, d]) => `<li><strong>${n}</strong> <span>${data(d)}</span></li>`).join('')}</ol></section>

        <section><h2>Documentos usuais</h2>
            <ul class="lista">${e.documentos.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
            <p class="nota">Lista de referência para organizar a proposta; vale a lista do edital oficial. <a href="${rel}#edital-${e.id}">Marque o que já está pronto na plataforma.</a></p></section>

        <section><h2>Critérios de avaliação</h2>
            <ul class="criterios">${e.criterios.map(c => `<li><span>${esc(c.nome)}</span><strong>${c.peso}%</strong><i style="width:${c.peso}%"></i></li>`).join('')}</ul></section>

        <aside class="aviso">${demonstrativo ? 'ℹ️ <strong>Dados demonstrativos.</strong> ' : ''}Informações de ${data(geradoEm)}. Antes de submeter, confirme datas, valores e requisitos no edital oficial publicado pela instituição.</aside>

        ${relacionados.length ? `<section><h2>Editais relacionados</h2><ul class="cartoes">${relacionados.map(x => cartao(x, rel)).join('')}</ul></section>` : ''}`;

    escrever(`editais/${slugEdital(e)}/index.html`, layout({ rel, titulo, descricao, url, tipo: 'article', jsonld, corpo, ativo: 'editais' }));
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
        <div class="acoes"><a class="btn primario" href="${rel}#editais">🎯 Filtrar pelo meu perfil na plataforma</a></div>
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
            <a class="btn primario" href="${rel}#agencia-${k}">📊 Desembolsos e projetos na plataforma</a>
            <a class="btn" href="${esc(a.link)}" target="_blank" rel="noopener noreferrer">🔗 Portal oficial</a>
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
        ${bloco('nacional', '🇧🇷 Nacionais')}${bloco('internacional', '🌍 Internacionais')}`
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
    ...editais.map(e => [`${SITE}/editais/${slugEdital(e)}/`, 'weekly', statusEm(e) === 'fechado' ? '0.4' : '0.8']),
    [`${SITE}/instituicoes/`, 'weekly', '0.6'],
    ...Object.keys(agencias).map(k => [`${SITE}/instituicoes/${k}/`, 'weekly', '0.6'])
];
escrever('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, f, p]) => `  <url><loc>${esc(u)}</loc><lastmod>${geradoEm}</lastmod><changefreq>${f}</changefreq><priority>${p}</priority></url>`).join('\n')}
</urlset>
`);
escrever('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
if (!fs.existsSync(path.join(RAIZ, '.nojekyll'))) escrever('.nojekyll', '');

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
    <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebSite', name: NOME, url: `${SITE}/`, inLanguage: 'pt-BR' })}</script>
    <!-- seo:fim -->`;
const reSeo = /<!-- seo:inicio[\s\S]*?<!-- seo:fim -->/;
indexHtml = reSeo.test(indexHtml) ? indexHtml.replace(reSeo, seoHome) : indexHtml.replace('</title>', `</title>\n    ${seoHome}`);
fs.writeFileSync(indexPath, indexHtml);

avisos.forEach(a => console.warn('⚠️ ', a));
console.log(`✅ ${editais.length} editais, ${Object.keys(agencias).length} instituições, ${urls.length} URLs no sitemap · ${SITE}`);
