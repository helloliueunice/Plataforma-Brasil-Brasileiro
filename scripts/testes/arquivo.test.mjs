// Arquivo de editais encerrados (scripts/arquivo.mjs) e geração das páginas de encerrados (scripts/gerar-paginas.mjs).
// Rodar: node --test scripts/testes/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { atualizarArquivo } from '../arquivo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ed = (id, encerramento, extra = {}) => ({ id, titulo: `Edital ${id}`, abertura: '2026-01-01', encerramento, verificadoEm: '2026-10-01', ...extra });

test('grava todos os editais presentes, em ordem de id', () => {
    const { arquivo, revividos } = atualizarArquivo({}, [ed(3, '2026-12-01'), ed(1, '2026-12-01')], '2026-11-02');
    assert.deepEqual(Object.keys(arquivo), ['1', '3']);
    assert.equal(revividos.length, 0);
});

test('mudança só em verificadoEm não regrava (o arquivo não muda todo dia)', () => {
    const { arquivo: a1 } = atualizarArquivo({}, [ed(1, '2026-12-01')], '2026-11-02');
    const { arquivo: a2 } = atualizarArquivo(a1, [ed(1, '2026-12-01', { verificadoEm: '2026-11-02' })], '2026-11-02');
    assert.equal(a2['1'].verificadoEm, '2026-10-01');
    const { arquivo: a3 } = atualizarArquivo(a1, [ed(1, '2026-12-15')], '2026-11-02');
    assert.equal(a3['1'].encerramento, '2026-12-15', 'mudança de prazo regrava');
});

test('edital que sai da fonte depois do prazo volta como encerrado', () => {
    const { arquivo: a1 } = atualizarArquivo({}, [ed(1, '2026-11-01'), ed(2, '2026-12-01')], '2026-11-01');
    // Dia seguinte ao prazo: o coletor já tirou o edital 1 da fonte
    const { arquivo: a2, revividos } = atualizarArquivo(a1, [ed(2, '2026-12-01')], '2026-11-02');
    assert.deepEqual(revividos.map(r => r.id), [1]);
    assert.equal(a2['1'].arquivoSaiuEm, '2026-11-02');
    assert.equal(revividos[0].arquivoSaiuEm, undefined, 'a marca interna não vai para a página');
    // Semanas depois, continua voltando (a data de saída não muda)
    const { arquivo: a3, revividos: r3 } = atualizarArquivo(a2, [ed(2, '2026-12-01')], '2026-12-20');
    assert.deepEqual(r3.map(r => r.id), [1], 'o 2 ainda está na fonte: a página dele vem da fonte, não do arquivo');
    assert.equal(a3['1'].arquivoSaiuEm, '2026-11-02');
});

test('edital retirado antes do prazo fica guardado, mas não volta ao site', () => {
    const { arquivo: a1 } = atualizarArquivo({}, [ed(1, '2026-12-01')], '2026-11-01');
    const { arquivo: a2, revividos } = atualizarArquivo(a1, [], '2026-11-02');
    assert.equal(revividos.length, 0);
    assert.ok(a2['1'], 'não apaga (uma falha da fonte não pode apagar o histórico)');
    const { revividos: depois } = atualizarArquivo(a2, [], '2026-12-10');
    assert.equal(depois.length, 0, 'mesmo depois do prazo, não vira "encerrado"');
});

test('edital que volta para a fonte perde a marca de saída', () => {
    const { arquivo: a1 } = atualizarArquivo({}, [ed(1, '2026-12-01')], '2026-11-01');
    const { arquivo: a2 } = atualizarArquivo(a1, [], '2026-11-02');
    const { arquivo: a3 } = atualizarArquivo(a2, [ed(1, '2026-12-01')], '2026-11-03');
    assert.equal(a3['1'].arquivoSaiuEm, undefined);
});

test('gerar-paginas: programa que saiu do Transferegov depois do prazo continua no ar, indexável e no sitemap', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arquivo-'));
    try {
        for (const f of ['index.html', 'editais.json', 'scripts', 'data', 'assets/paginas.css', 'assets/favicon.svg']) fs.cpSync(path.join(RAIZ, f), path.join(tmp, f), { recursive: true });
        fs.rmSync(path.join(tmp, 'data', 'arquivo-editais.json'), { force: true });
        const arqTG = path.join(tmp, 'data', 'transferegov.json');
        const tg = JSON.parse(fs.readFileSync(arqTG, 'utf8'));
        const alvo = tg.editais[0];
        const gerar = () => execFileSync(process.execPath, [path.join(tmp, 'scripts', 'gerar-paginas.mjs')], { cwd: tmp, env: { ...process.env, PIX_CHAVE: '' }, stdio: 'pipe' });
        // 1ª execução: o programa está na fonte, com prazo ontem (vale pela data de hoje do gerador)
        const ontem = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() - 864e5));
        alvo.encerramento = ontem;
        fs.writeFileSync(arqTG, JSON.stringify(tg));
        gerar();
        // 2ª execução: o coletor tirou o programa da fonte
        fs.writeFileSync(arqTG, JSON.stringify({ ...tg, editais: tg.editais.slice(1) }));
        gerar();
        const dir = fs.readdirSync(path.join(tmp, 'editais')).find(d => d.endsWith(`-${alvo.id}`));
        assert.ok(dir, 'a página do programa encerrado continua existindo');
        const html = fs.readFileSync(path.join(tmp, 'editais', dir, 'index.html'), 'utf8');
        const [a, m, d] = ontem.split('-');
        assert.match(html, new RegExp(`Encerrado em ${d}/${m}/${a}`));
        assert.match(html, /Este edital já encerrou\./);
        assert.doesNotMatch(html, /<meta name="robots" content="noindex/);
        assert.doesNotMatch(html, new RegExp(`#edital-${alvo.id}"`), 'sem links para a plataforma, onde o programa não existe mais');
        const sitemap = fs.readFileSync(path.join(tmp, 'sitemap.xml'), 'utf8');
        assert.match(sitemap, new RegExp(`/editais/${dir}/</loc><lastmod>[^<]+</lastmod><changefreq>monthly</changefreq><priority>0\\.2</priority>`));
        const prazos = fs.readFileSync(path.join(tmp, 'prazos', 'index.html'), 'utf8');
        assert.match(prazos, /Encerrados recentemente/);
        assert.ok(prazos.includes(`editais/${dir}/`), 'aparece em "Encerrados recentemente"');
        // Não vai para o editais.json da plataforma nem gera alteração falsa
        assert.ok(!JSON.parse(fs.readFileSync(path.join(tmp, 'editais.json'), 'utf8')).editais.some(x => x.id === alvo.id));
        // (a única alteração nova é a mudança de prazo feita neste teste; a saída da fonte não registra nada)
        const antes = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'alteracoes.json'), 'utf8')).length;
        const novas = JSON.parse(fs.readFileSync(path.join(tmp, 'data', 'alteracoes.json'), 'utf8')).slice(antes);
        assert.ok(novas.every(x => x.id === alvo.id && x.campo === 'encerramento'), JSON.stringify(novas));
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});
