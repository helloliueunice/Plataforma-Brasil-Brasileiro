// Testes do monitor com servidor local simulado (sem rede externa): node --test scripts/testes/*.test.mjs
// Cobrem limite de redirecionamentos, domínios permitidos por fonte, limite de tamanho de PDF e teto de chamadas à API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'monitorar-fontes.mjs');
const MB = 1048576;

function servidor() {
    let chamadasApi = 0;
    const srv = http.createServer((req, res) => {
        const base = `http://127.0.0.1:${srv.address().port}`;
        const u = new URL(req.url, base);
        const ir = (destino) => { res.writeHead(302, { location: destino }); res.end(); };
        const html = (corpo) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(`<html><body>${corpo}</body></html>`); };
        if (u.pathname === '/v1/messages') {
            chamadasApi++;
            let corpo = '';
            req.on('data', c => { corpo += c; });
            req.on('end', () => {
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ content: [{ type: 'tool_use', name: 'registrar_edital', input: { eh_chamada_de_fomento: false, motivo_descarte: 'teste', titulo: 'x', instituicao: 'X', tema: 'Tecnologia', modalidade: 'x', publico: ['ict'], abrangencia: 'Nacional', procedencia: 'nacional', moeda: 'BRL', resumo: 'x', evidencias: [], confianca: 'alta', alertas: [] } }] }));
            });
            return;
        }
        if (u.pathname === '/fonte') {
            return html([
                `<a href="/chamada-redireciona">Chamada pública de pesquisa número 1 de 2026</a>`,
                `<a href="/chamada-laco/0">Chamada pública de pesquisa número 2 de 2026</a>`,
                `<a href="/chamada-grande.pdf">Chamada pública de pesquisa número 3 de 2026 (PDF)</a>`,
                `<a href="/chamada-grande-sem-tamanho.pdf">Chamada pública de pesquisa número 4 de 2026 (PDF)</a>`,
                `<a href="/chamada-foge">Chamada pública de pesquisa número 5 de 2026</a>`,
                `<a href="https://outro-site.example.org/chamada-6">Chamada pública de pesquisa número 6 de 2026</a>`,
                `<a href="/chamada-pequena.pdf">Chamada pública de pesquisa número 7 de 2026 (PDF)</a>`
            ].join('\n'));
        }
        if (u.pathname === '/chamada-redireciona') return ir('/passo-1');
        if (u.pathname === '/passo-1') return ir(`${base}/passo-2`);
        if (u.pathname === '/passo-2') return html('<h1>Chamada 1</h1>' + '<p>Texto da chamada com prazo e valor. </p>'.repeat(40));
        if (u.pathname.startsWith('/chamada-laco/')) return ir(`/chamada-laco/${Number(u.pathname.split('/').pop()) + 1}`);
        if (u.pathname === '/chamada-foge') return ir(`http://localhost:${srv.address().port}/passo-2`); // outro host: fora da lista
        if (u.pathname === '/chamada-grande.pdf') {
            res.writeHead(200, { 'content-type': 'application/pdf', 'content-length': String(11 * MB) });
            return res.end(); // o monitor deve desistir pelo cabeçalho, sem ler o corpo
        }
        if (u.pathname === '/chamada-grande-sem-tamanho.pdf') {
            res.writeHead(200, { 'content-type': 'application/pdf' }); // sem content-length: corta na leitura
            const bloco = Buffer.alloc(MB, 0x25);
            let n = 0;
            const enviar = () => { while (n < 12) { n++; if (!res.write(bloco)) return res.once('drain', enviar); } res.end(); };
            res.on('error', () => {});
            return enviar();
        }
        if (u.pathname === '/chamada-pequena.pdf') { res.writeHead(200, { 'content-type': 'application/pdf' }); return res.end('%PDF-1.4 teste'); }
        res.writeHead(404); res.end();
    });
    return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({ srv, base: `http://127.0.0.1:${srv.address().port}`, api: () => chamadasApi })));
}

function rodar(raiz, env) {
    return new Promise((ok, falha) => {
        execFile(process.execPath, [SCRIPT], { env: { PATH: process.env.PATH, MONITOR_RAIZ: raiz, HOJE: '2026-11-01', MONITOR_PERMITIR_LOCAL: '1', ...env }, timeout: 60000 }, (err, stdout, stderr) => {
            if (err) return falha(new Error(`${err.message}\n${stdout}\n${stderr}`));
            ok(stdout);
        });
    });
}

const criadas = [];
function preparar(base) {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'monitor-'));
    criadas.push(raiz);
    fs.mkdirSync(path.join(raiz, 'data'));
    fs.writeFileSync(path.join(raiz, 'editais.json'), JSON.stringify({ editais: [] }));
    fs.writeFileSync(path.join(raiz, 'data', 'fontes.json'), JSON.stringify({ fontes: [{ id: 'teste', nome: 'Fonte de teste', url: `${base}/fonte`, filtro: 'chamada', ativo: true, dominios: ['127.0.0.1'] }] }));
    return raiz;
}

test('redirecionamentos, domínios e tamanho', async () => {
    const { srv, base, api } = await servidor();
    try {
        const raiz = preparar(base);
        await rodar(raiz, { ANTHROPIC_API_KEY: 'x', ANTHROPIC_BASE_URL: base, MAX_CHAMADAS_API: '15' });
        const rel = fs.readFileSync(path.join(raiz, 'relatorio-monitor.md'), 'utf8');
        const estado = JSON.parse(fs.readFileSync(path.join(raiz, 'data', 'monitor-estado.json'), 'utf8'));
        const res = sufixo => Object.entries(estado.vistos).find(([u]) => u.endsWith(sufixo))?.[1];
        // 2 redirecionamentos: lido e enviado à IA (descartado pela resposta simulada)
        assert.equal(res('/chamada-redireciona').resultado, 'descartado');
        // laço de redirecionamentos: para no 6º salto
        assert.equal(res('/chamada-laco/0').resultado, 'pulado');
        assert.match(res('/chamada-laco/0').erro, /mais de 5 redirecionamentos/);
        // PDF grande, com e sem content-length
        assert.equal(res('/chamada-grande.pdf').resultado, 'pulado');
        assert.match(res('/chamada-grande.pdf').erro, /PDF de 11,0 MB/);
        assert.equal(res('/chamada-grande-sem-tamanho.pdf').resultado, 'pulado');
        assert.match(res('/chamada-grande-sem-tamanho.pdf').erro, /PDF maior que 10,0 MB/);
        // redirecionamento para outro host: barrado antes de ler
        assert.equal(res('/chamada-foge').resultado, 'pulado');
        assert.match(res('/chamada-foge').erro, /fora dos domínios permitidos/);
        // link para outro domínio na página da fonte: nem é baixado
        assert.equal(res('https://outro-site.example.org/chamada-6'.slice(-10)).resultado, 'fora-dominio');
        assert.equal(res('/chamada-pequena.pdf').resultado, 'descartado');
        assert.equal(api(), 2, 'só os dois links válidos chegam à IA');
        assert.match(rel, /Links não lidos/);
        assert.equal(estado.execucoes[0].chamadasApi, 2);
    } finally { srv.close(); for (const d of criadas.splice(0)) fs.rmSync(d, { recursive: true, force: true }); }
});

test('teto de chamadas à API adia o restante sem marcar como visto', async () => {
    const { srv, base, api } = await servidor();
    try {
        const raiz = preparar(base);
        await rodar(raiz, { ANTHROPIC_API_KEY: 'x', ANTHROPIC_BASE_URL: base, MAX_CHAMADAS_API: '1' });
        const rel = fs.readFileSync(path.join(raiz, 'relatorio-monitor.md'), 'utf8');
        const estado = JSON.parse(fs.readFileSync(path.join(raiz, 'data', 'monitor-estado.json'), 'utf8'));
        assert.equal(api(), 1);
        assert.match(rel, /Teto de 1 chamadas à API/);
        const pequena = Object.keys(estado.vistos).find(u => u.endsWith('/chamada-pequena.pdf'));
        assert.equal(pequena, undefined, 'o link adiado volta na próxima execução');
    } finally { srv.close(); for (const d of criadas.splice(0)) fs.rmSync(d, { recursive: true, force: true }); }
});

test('endereços internos são recusados fora dos testes', async () => {
    const { srv, base } = await servidor();
    try {
        const raiz = preparar(base);
        await rodar(raiz, { MONITOR_PERMITIR_LOCAL: '0' });
        const rel = fs.readFileSync(path.join(raiz, 'relatorio-monitor.md'), 'utf8');
        assert.match(rel, /precisa começar com https|fora dos domínios permitidos/);
    } finally { srv.close(); for (const d of criadas.splice(0)) fs.rmSync(d, { recursive: true, force: true }); }
});
