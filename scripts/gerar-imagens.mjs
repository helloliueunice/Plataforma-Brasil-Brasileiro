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
const assinatura = d => crypto.createHash('sha256').update(JSON.stringify(d)).digest('hex').slice(0, 16);

function html(d) {
    const tam = d.titulo.length > 90 ? 50 : d.titulo.length > 60 ? 58 : 66;
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;font-family:'DejaVu Sans','Liberation Sans',Arial,sans-serif;background:linear-gradient(135deg,#071D41 0%,#1351B4 60%,#2F6FD6 100%);color:#fff;padding:56px 72px;position:relative;overflow:hidden}
.circ{position:absolute;right:-140px;top:-140px;width:440px;height:440px;border-radius:50%;background:#FFCD07;opacity:.16}
.marca{display:flex;align-items:center;gap:14px;font-size:28px;font-weight:700}
.topo{margin-top:34px;font-size:24px;font-weight:700;color:#FFE27A;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:1056px}
h1{margin-top:12px;font-size:${tam}px;line-height:1.1;font-weight:800;letter-spacing:-1px;max-width:1056px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.base{position:absolute;left:72px;right:72px;bottom:52px;display:flex;gap:18px;align-items:stretch}
.box{background:rgba(255,255,255,.14);border:2px solid rgba(255,255,255,.3);border-radius:18px;padding:14px 22px;min-width:0}
.box b{display:block;font-size:34px;font-weight:800;white-space:nowrap}
.box span{display:block;font-size:19px;opacity:.9;margin-top:2px;white-space:nowrap}
.prazo{background:#FFCD07;color:#071D41;border-color:#FFCD07}
.pub{flex:1;overflow:hidden}
.pub b{font-size:24px;white-space:normal;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
</style></head><body><div class="circ"></div>
<div class="marca"><svg width="52" height="52" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#168821"/><path d="M32 10 56 32 32 54 8 32z" fill="#FFCD07"/><circle cx="32" cy="32" r="11" fill="#1351B4"/></svg>Fundos Brasil · Edital de fomento</div>
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
        await pg.screenshot({ path: path.join(DIR, `edital-${e.id}.jpg`), type: 'jpeg', quality: 82 });
        manifesto[e.id] = assinatura(d);
    }
    await nav.close();
}
fs.writeFileSync(MANIFESTO, JSON.stringify(manifesto, null, 2) + '\n');
console.log(`✅ ${pendentes.length} imagem(ns) gerada(s), ${sobrando.length} removida(s)`);
