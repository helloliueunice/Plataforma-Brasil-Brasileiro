// Testes da autorização das sugestões de edital (.github/scripts/autorizar-sugestao.mjs), com consultas simuladas.
// Rodar: node --test scripts/testes/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidir, extrairLink, ROTULO } from '../../.github/scripts/autorizar-sugestao.mjs';

const CORPO = 'Link oficial: https://www.fapes.es.gov.br/edital-01-2026. Obrigado!';
const evento = (acao, extra = {}) => ({
    action: acao,
    issue: { number: 7, state: 'open', body: CORPO, labels: [{ name: 'sugestao-edital' }] },
    sender: { login: 'mantenedora', type: 'User' },
    label: acao === 'labeled' ? { name: ROTULO } : undefined,
    ...extra
});
const consultas = (o = {}) => ({
    permissao: async () => o.permissao ?? 'admin',
    issue: async () => ({ state: 'open', body: o.corpoAtual ?? CORPO, labels: o.labels ?? [{ name: 'sugestao-edital' }, { name: ROTULO }] }),
    ultimoRotulo: async () => (o.rotulo === null ? null : { created_at: '2026-11-01T12:00:00Z', actor: 'mantenedora', ...(o.rotulo || {}) }),
    editadaEm: async () => (o.editadaEm === undefined ? '2026-11-01T11:00:00Z' : o.editadaEm)
});

test('rótulo aplicado por quem escreve, sem edição posterior: autoriza e extrai o link', async () => {
    const d = await decidir(evento('labeled'), consultas());
    assert.equal(d.ok, true);
    assert.equal(d.url, 'https://www.fapes.es.gov.br/edital-01-2026');
});

test('rótulo aplicado por quem só tem triage ou leitura: recusa e avisa', async () => {
    for (const permissao of ['triage', 'read', 'none']) {
        const d = await decidir(evento('labeled'), consultas({ permissao }));
        assert.equal(d.ok, false, permissao);
        assert.equal(d.avisar, true);
        assert.match(d.motivo, /permissão de escrita/);
    }
});

test('falha ao consultar a permissão conta como sem permissão', async () => {
    const d = await decidir(evento('labeled'), { ...consultas(), permissao: async () => { throw new Error('404'); } });
    assert.equal(d.ok, false);
});

test('corpo mudou depois do rótulo: recusa', async () => {
    const d = await decidir(evento('labeled'), consultas({ corpoAtual: 'Link: https://golpe.example.com' }));
    assert.equal(d.ok, false);
    assert.match(d.motivo, /texto da issue mudou/);
});

test('editada depois do rótulo (mesmo voltando ao texto original): recusa', async () => {
    const d = await decidir(evento('labeled'), consultas({ editadaEm: '2026-11-01T12:00:05Z' }));
    assert.equal(d.ok, false);
    assert.match(d.motivo, /editada depois/);
});

test('rótulo removido antes da execução, ou sem registro do rótulo: recusa', async () => {
    assert.equal((await decidir(evento('labeled'), consultas({ labels: [{ name: 'sugestao-edital' }] }))).ok, false);
    assert.equal((await decidir(evento('labeled'), consultas({ rotulo: null }))).ok, false);
});

test('GraphQL indisponível: o hash do corpo ainda protege', async () => {
    const c = { ...consultas(), editadaEm: async () => { throw new Error('GraphQL fora'); } };
    assert.equal((await decidir(evento('labeled'), c)).ok, true);
    const c2 = { ...consultas({ corpoAtual: 'outro' }), editadaEm: async () => { throw new Error('GraphQL fora'); } };
    assert.equal((await decidir(evento('labeled'), c2)).ok, false);
});

test('issue aberta por quem escreve roda direto; por colaborador só leitura, não', async () => {
    assert.equal((await decidir(evento('opened'), consultas({ permissao: 'write' }))).ok, true);
    const d = await decidir(evento('opened'), consultas({ permissao: 'read' }));
    assert.equal(d.ok, false);
    assert.equal(d.avisar, false);
});

test('outros rótulos, bots e issues fechadas não autorizam', async () => {
    assert.equal((await decidir({ ...evento('labeled'), label: { name: 'outro' } }, consultas())).ok, false);
    assert.equal((await decidir({ ...evento('labeled'), sender: { login: 'x[bot]', type: 'Bot' } }, consultas())).ok, false);
    const fechada = evento('labeled');
    fechada.issue.state = 'closed';
    assert.equal((await decidir(fechada, consultas())).ok, false);
});

test('extrairLink(): primeiro link, sem pontuação final nem caracteres que quebram a saída', () => {
    assert.equal(extrairLink('veja (https://a.gov.br/x).'), 'https://a.gov.br/x');
    assert.equal(extrairLink('https://a.gov.br/x?y=1;'), 'https://a.gov.br/x?y=1');
    assert.equal(extrairLink('sem link'), '');
    assert.doesNotMatch(extrairLink('https://a.gov.br/x\nurl=https://mal'), /\n/);
});
