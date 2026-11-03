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
const assinatura = d => crypto.createHash('sha256').update(JSON.stringify({ ...d, marca: MARCA, identidade: 'praca-pontos-1' })).digest('hex').slice(0, 16);

// Símbolo: radar de pontos dentro do balão de conversa Sol: o mesmo de assets/marca.svg
const SIMBOLO = (tam) => fs.readFileSync(path.join(RAIZ, 'assets', 'marca.svg'), 'utf8').trim()
    .replace(/<title>.*?<\/title>/, '').replace('<svg ', `<svg width="${tam}" height="${tam}" aria-hidden="true" `);
// Nome com contraste de peso: primeira palavra em 800, o resto em 400 ("Radar" + "Fomento")
const NOME_MARCA = esc(MARCA).replace(/^(\S+)/, '<b>$1</b>');
// Identidade "7 + 4 · Praça de pontos": creme, carvão, Inter em tudo; Pitanga (#E8505B) só no ponto do prazo
const SANS = `Inter, 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif`;
const FONTES = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';

function html(d) {
    const tam = d.titulo.length > 90 ? 50 : d.titulo.length > 60 ? 58 : 68;
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTES}"><style>
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;font-family:${SANS};background:#FFF8EC;color:#1A1A2E;padding:52px 72px;position:relative;overflow:hidden}
.marca{display:flex;align-items:center;gap:18px}
.marca .nome{font-size:36px;font-weight:400;line-height:1;letter-spacing:-.035em}
.marca .nome{color:#1E40AF}.marca .nome b{font-weight:800;color:#1A1A2E}
.marca span.tipo{margin-left:auto;font-size:19px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#4B4B63}
.topo{margin-top:36px;font-size:24px;font-weight:600;color:#1E40AF;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:1056px}
h1{margin-top:12px;font-weight:800;font-size:${tam}px;line-height:1.04;letter-spacing:-.035em;max-width:1056px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.base{position:absolute;left:72px;right:72px;bottom:48px;display:flex;gap:14px;align-items:stretch}
.box{background:#FFFFFF;border-radius:24px;padding:16px 24px;min-width:0}
.box b{display:block;font-size:31px;font-weight:800;letter-spacing:-.025em;white-space:nowrap}
.box span{display:block;font-size:19px;color:#4B4B63;margin-top:2px;white-space:nowrap}
.prazo{background:#FDE2E4;color:#8A1F27;padding-left:52px;position:relative}
.prazo span{color:#8A1F27}
.prazo::before{content:"";position:absolute;left:24px;top:30px;width:16px;height:16px;border-radius:50%;background:#E8505B}
.pub{flex:1;overflow:hidden}
.pub b{font-size:23px;font-weight:700;letter-spacing:-.015em;white-space:normal;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
</style></head><body>
<div class="marca">${SIMBOLO(60)}<span class="nome">${NOME_MARCA}</span><span class="tipo">Edital de fomento</span></div>
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
        await pg.evaluate(() => document.fonts.ready).catch(() => {}); // sem rede, fica a fonte sem serifa do sistema
        await pg.screenshot({ path: path.join(DIR, `edital-${e.id}.jpg`), type: 'jpeg', quality: 82 });
        manifesto[e.id] = assinatura(d);
    }
    await nav.close();
}
fs.writeFileSync(MANIFESTO, JSON.stringify(manifesto, null, 2) + '\n');
console.log(`✅ ${pendentes.length} imagem(ns) gerada(s), ${sobrando.length} removida(s)`);
