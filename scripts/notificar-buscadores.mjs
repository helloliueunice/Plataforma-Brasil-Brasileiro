#!/usr/bin/env node
/**
 * Avisa buscadores compatíveis com IndexNow (Bing, Yandex, Seznam, Naver e outros) sobre páginas
 * novas ou alteradas. O Google não usa IndexNow: para ele valem o sitemap e o Search Console.
 *
 *   node scripts/notificar-buscadores.mjs editais/x/index.html sitemap.xml ...
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'site.json'), 'utf8'));
const cname = fs.existsSync(path.join(RAIZ, 'CNAME')) ? fs.readFileSync(path.join(RAIZ, 'CNAME'), 'utf8').trim() : '';
const SITE = (process.env.SITE_URL || (cname ? `https://${cname}` : 'https://helloliueunice.github.io/Plataforma-Brasil-Brasileiro')).replace(/\/+$/, '');
const chave = cfg.indexnowChave;
if (!chave || !fs.existsSync(path.join(RAIZ, `${chave}.txt`))) { console.log('IndexNow: chave ausente; nada a fazer.'); process.exit(0); }

const urls = [...new Set(process.argv.slice(2)
    .filter(f => /\.html$/.test(f) && !/^404\.html$/.test(f))
    .map(f => `${SITE}/${f.replace(/(^|\/)index\.html$/, '$1')}`))].slice(0, 10000);
if (!urls.length) { console.log('IndexNow: nenhuma página alterada.'); process.exit(0); }

const u = new URL(SITE);
const r = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: u.host, key: chave, keyLocation: `${SITE}/${chave}.txt`, urlList: urls })
});
const msg = `IndexNow: ${urls.length} URL(s) enviadas → HTTP ${r.status}${r.ok ? '' : ` ${(await r.text()).slice(0, 200)}`}`;
console.log(msg);
if (process.env.GITHUB_ACTIONS) console.log(`::${r.ok ? 'notice' : 'warning'} title=IndexNow::${msg.replace(/\n/g, ' ')}`);
// 200 = recebido; 202 = recebido, chave ainda em validação (normal na primeira vez)
if (!r.ok) process.exitCode = 1;
