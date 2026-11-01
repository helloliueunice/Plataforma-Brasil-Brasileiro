#!/usr/bin/env node
/**
 * Confere a integridade do Pix da página Apoie.
 *
 * Uso:
 *   node scripts/verificar-pix.mjs                 → confere apoie/index.html no repositório
 *   node scripts/verificar-pix.mjs --url <https…>  → confere a página publicada
 *
 * A chave esperada vem da variável de ambiente PIX_CHAVE (variável do repositório no GitHub,
 * que só a dona altera). Falha (código 1) se:
 *   - a chave do código "copia e cola" for diferente da esperada;
 *   - o código for inválido (CRC, campos obrigatórios);
 *   - o QR Code da página não for exatamente o QR do código exibido;
 *   - a chave mostrada em texto for diferente da chave do código.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerBrCode, normalizarChavePix } from './pix.mjs';
import { qrSvg } from './qrcode.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--url');
const URL_PAGINA = i > -1 ? process.argv[i + 1] : '';

const desescapa = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

let html;
if (URL_PAGINA) {
    const r = await fetch(URL_PAGINA, { headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(30000) });
    if (!r.ok) { console.error(`Não foi possível baixar ${URL_PAGINA}: HTTP ${r.status}`); process.exit(1); }
    html = await r.text();
} else {
    html = fs.readFileSync(path.join(RAIZ, 'apoie', 'index.html'), 'utf8');
}

const erros = [];
const codigoM = html.match(/<textarea id="pixCodigo"[^>]*>([^<]*)<\/textarea>/);
const chaveM = html.match(/<code id="pixChave">([^<]*)<\/code>/);
const qrM = html.match(/<figure class="pix-qr">(<svg[\s\S]*?<\/svg>)/);

if (!codigoM) {
    // Sem Pix na página: só é aceitável se nenhuma chave for esperada
    if (process.env.PIX_CHAVE) erros.push('A página não tem código Pix, mas PIX_CHAVE está definida.');
} else {
    const codigo = desescapa(codigoM[1]).trim();
    const lido = lerBrCode(codigo);
    if (lido.erros?.length) erros.push(`Código Pix inválido: ${lido.erros.join('; ')}`);
    const chaveCodigo = normalizarChavePix(lido.campos?.chave || '');
    const esperada = normalizarChavePix(process.env.PIX_CHAVE || '');
    if (esperada && chaveCodigo !== esperada) erros.push(`Chave do Pix diferente da esperada: ${chaveCodigo || '(vazia)'} ≠ ${esperada}`);
    if (!esperada) console.log('Aviso: PIX_CHAVE não definida; conferindo só a coerência interna da página.');
    if (!chaveM || normalizarChavePix(desescapa(chaveM[1])) !== chaveCodigo) erros.push('A chave exibida em texto é diferente da chave do código copia e cola.');
    const qrEsperado = qrSvg(codigo, { rotulo: 'QR Code do Pix para apoiar o projeto' });
    if (!qrM || qrM[1] !== qrEsperado) erros.push('O QR Code da página não corresponde ao código copia e cola.');
}

if (erros.length) {
    console.error('PIX COM PROBLEMA:\n- ' + erros.join('\n- '));
    process.exit(1);
}
console.log('Pix conferido: chave, código e QR Code coerentes.');
