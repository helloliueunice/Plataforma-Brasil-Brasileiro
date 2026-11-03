#!/usr/bin/env node
/**
 * Gera a imagem de prévia (1200×630, JPEG) de cada edital: é o que aparece ao colar o link
 * no WhatsApp, LinkedIn, Telegram etc. Só refaz a imagem quando os dados exibidos mudam.
 *
 *   node scripts/gerar-imagens.mjs              → gera o que falta (exige o pacote playwright)
 *   node scripts/gerar-imagens.mjs --verificar  → só informa se há imagens a gerar (sai com código 10 se houver)
 *
 * Saída: assets/og/edital-<id>.jpg e data/og-manifest.json (assinatura de cada imagem).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(RAIZ, 'assets', 'og');
const MANIFESTO = path.join(RAIZ, 'data', 'og-manifest.json');
const VERSAO_MODELO = 3; // mude para refazer todas as imagens após alterar o modelo

const fonte = JSON.parse(fs.readFileSync(path.join(RAIZ, 'editais.json'), 'utf8'));
const editais = (Array.isArray(fonte) ? fonte : fonte.editais || []).filter(e => e.id && e.titulo && e.encerramento);
const manifesto = fs.existsSync(MANIFESTO) ? JSON.parse(fs.readFileSync(MANIFESTO, 'utf8')) : {};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const data = iso => iso.split('-').reverse().join('/');
const valor = (v, moeda = 'BRL') => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda, notation: 'compact', maximumFractionDigits: 1 }).format(v);
const PUB = { pesquisador: 'Pesquisadores', ict: 'Universidades e ICTs', empresa: 'Empresas', osc: 'OSCs', municipio: 'Municípios', estado: 'Estados' };

function dados(e) {
    return {
        v: VERSAO_MODELO,
        titulo: e.titulo,
        topo: [e.instituicao, e.numero].filter(Boolean).join(' · '),
        valor: Number(e.valorMax) > 0 ? `até ${valor(e.valorMax, e.moeda)}` : (/bolsa/i.test(e.modalidade || '') ? 'Bolsas' : 'Ver condições'),
        valorRotulo: Number(e.valorMax) > 0 ? 'por proposta' : (e.valorTotal ? `total ${valor(e.valorTotal, e.moeda)}` : 'ver edital'),
        prazo: data(e.encerramento),
        abre: e.abertura,
        publico: (e.publico || []).map(p => PUB[p] || p).join(' · ')
    };
}
// O nome do site entra na assinatura: trocar a marca regenera as imagens de prévia
const MARCA = (() => { try { return JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'site.json'), 'utf8')).nome || 'Radar Fomento'; } catch (_) { return 'Radar Fomento'; } })();
const assinatura = d => crypto.createHash('sha256').update(JSON.stringify({ ...d, marca: MARCA, identidade: 'editorial-verde-1' })).digest('hex').slice(0, 16);

// Monograma "RF" desenhado em caminhos (não depende de fonte): o mesmo de assets/marca.svg
const MONOGRAMA = `<svg width="64" height="64" viewBox="0 0 88 88" aria-hidden="true"><rect x="1" y="1" width="86" height="86" fill="#FFFFFF" stroke="#111111" stroke-width="2"/><g fill="#111111"><path transform="translate(0.5 0)" d="M15 22h14v2.4h-3.6v15.4h5.4c4.6 0 7-2.6 7-7.6s-2.4-7.8-7-7.8h-1.8V22h2.6c7.8 0 12.2 3.6 12.2 10.1 0 4.9-2.8 8.1-7.4 9.1L44.6 59.6H48V62h-9.2L30.6 42.2h-5.2v17.4H29V62H15v-2.4h3.6V24.4H15z"/><path transform="translate(2.5 0)" d="M47 22h23v10h-2.6c-.6-4.6-2.6-7.6-7.6-7.6h-5.4v15.4h4c3 0 4.2-1.6 4.6-4.8H65.6v12.6H63c-.4-3.4-1.6-5.2-4.6-5.2h-4v16.2h4.4V62H47v-2.4h3.6V24.4H47z"/></g><rect x="74" y="7" width="8" height="8" fill="#2BB673"/></svg>`;
// Identidade "Editorial verde": papel, tinta, serifa nos títulos e um único ponto verde (Sinal)
const SERIFA = `'Instrument Serif', Georgia, 'Liberation Serif', 'DejaVu Serif', serif`;
const SANS = `Inter, 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif`;
const FONTES = 'https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Inter:wght@400;500;600&display=swap';

function html(d) {
    const tam = d.titulo.length > 90 ? 56 : d.titulo.length > 60 ? 66 : 76;
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTES}"><style>
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;font-family:${SANS};background:#FBFAF7;color:#111111;padding:52px 72px;position:relative;overflow:hidden}
.marca{display:flex;align-items:center;gap:18px;padding-bottom:22px;border-bottom:2px solid #111111}
.marca b{font-family:${SERIFA};font-weight:400;font-size:40px;line-height:1}
.marca span{margin-left:auto;font-size:20px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#555555}
.topo{margin-top:30px;font-size:24px;font-weight:600;color:#1A7A4A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:1056px}
h1{margin-top:10px;font-family:${SERIFA};font-weight:400;font-size:${tam}px;line-height:1.05;max-width:1056px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.base{position:absolute;left:72px;right:72px;bottom:48px;display:flex;gap:16px;align-items:stretch}
.box{background:#FFFFFF;border:1px solid #CFCAC0;border-top:2px solid #111111;padding:14px 22px;min-width:0}
.box b{display:block;font-size:32px;font-weight:600;white-space:nowrap}
.box span{display:block;font-size:19px;color:#555555;margin-top:2px;white-space:nowrap}
.prazo{background:#111111;color:#FBFAF7;border-color:#111111;position:relative;padding-right:40px}
.prazo span{color:#E5E1D8}
.prazo::after{content:"";position:absolute;top:12px;right:12px;width:12px;height:12px;background:#2BB673}
.pub{flex:1;overflow:hidden;background:#EDE9E1;border-color:#EDE9E1;border-top-color:#111111}
.pub b{font-size:24px;white-space:normal;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
</style></head><body>
<div class="marca">${MONOGRAMA}<b>${esc(MARCA)}</b><span>Edital de fomento</span></div>
<div class="topo">${esc(d.topo)}</div>
<h1>${esc(d.titulo)}</h1>
<div class="base">
  <div class="box"><b>${esc(d.valor)}</b><span>${esc(d.valorRotulo)}</span></div>
  <div class="box prazo"><b>até ${esc(d.prazo)}</b><span>prazo de inscrição</span></div>
  <div class="box pub"><b>${esc(d.publico)}</b><span>quem pode participar</span></div>
</div></body></html>`;
}

const pendentes = editais.filter(e => {
    const f = path.join(DIR, `edital-${e.id}.jpg`);
    return !fs.existsSync(f) || manifesto[e.id] !== assinatura(dados(e));
});
const ids = new Set(editais.map(e => String(e.id)));
const sobrando = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => /^edital-\d+\.jpg$/.test(f) && !ids.has(f.match(/\d+/)[0])) : [];

if (process.argv.includes('--verificar')) {
    console.log(`Imagens a gerar: ${pendentes.length} · a remover: ${sobrando.length}`);
    process.exit(pendentes.length || sobrando.length ? 10 : 0);
}

for (const f of sobrando) { fs.rmSync(path.join(DIR, f)); delete manifesto[f.match(/\d+/)[0]]; }
if (pendentes.length) {
    let pw;
    try { pw = await import('playwright'); } catch (_) { pw = createRequire(import.meta.url)('playwright'); } // instalação global
    const { chromium } = pw;
    const nav = await chromium.launch();
    const pg = await nav.newPage({ viewport: { width: 1200, height: 630 } });
    fs.mkdirSync(DIR, { recursive: true });
    for (const e of pendentes) {
        const d = dados(e);
        await pg.setContent(html(d), { waitUntil: 'load' });
        await pg.evaluate(() => document.fonts.ready).catch(() => {}); // sem rede, ficam as serifas do sistema
        await pg.screenshot({ path: path.join(DIR, `edital-${e.id}.jpg`), type: 'jpeg', quality: 82 });
        manifesto[e.id] = assinatura(d);
    }
    await nav.close();
}
fs.writeFileSync(MANIFESTO, JSON.stringify(manifesto, null, 2) + '\n');
console.log(`✅ ${pendentes.length} imagem(ns) gerada(s), ${sobrando.length} removida(s)`);
