// Intérprete da busca em linguagem simples (assets/busca.js): frases → filtros + busca livre
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { interpretar, sugerirFiltros, distancia } = require('../../assets/busca.js');

const casos = [
    ['ong de cultura em sp até 200 mil', { publico: 'osc', area: 'Cultura', uf: 'SP', valorMax: 200000, resto: '' }],
    ['prefeitura na Bahia saneamento', { publico: 'municipio', uf: 'BA', area: 'Infraestrutura', resto: '' }],
    ['pesquisador de saúde no Rio Grande do Sul', { publico: 'pesquisador', area: 'Saúde', uf: 'RS', resto: '' }],
    ['empresa de tecnologia acima de 1 milhão', { publico: 'empresa', area: 'Tecnologia', valor: 1000000, resto: '' }],
    ['MEI inovação', { publico: 'empresa', area: 'Tecnologia', resto: '' }],
    ['associações de meio ambiente na amazônia', { publico: 'osc', area: 'Meio Ambiente', resto: '' }],
    ['editais que fecham esta semana', { prazo: '7', resto: '' }],
    ['cultura este mês', { area: 'Cultura', prazo: '30', resto: '' }],
    ['novos esta semana para escolas', { novos: '7', area: 'Educação', resto: '' }],
    ['audiovisual em salvador', { area: 'Cultura', uf: 'BA', resto: '' }],
    ['cutura em sao palo', { area: 'Cultura', uf: 'SP', resto: '' }],                // erros leves de digitação
    ['pesquisdores do paraná', { publico: 'pesquisador', uf: 'PR', resto: '' }],
    ['saude SUS em Pernambuco no maximo R$ 50.000', { area: 'Saúde', uf: 'PE', valorMax: 50000, resto: '' }],
    ['clima a partir de 500k', { area: 'Meio Ambiente', valor: 500000, resto: '' }],
    ['esportes para jovens em MG', { area: 'Desenvolvimento', uf: 'MG', resto: 'esporte' }],
    ['sem contrapartida abertos', { contra: '1', status: 'aberto', resto: '' }],
    ['fapesp jovem pesquisador', { publico: 'pesquisador', area: 'Desenvolvimento', resto: 'fapesp' }],
    ['bolsas de doutorado no exterior', { publico: 'pesquisador', resto: 'bolsas exterior' }],
    ['quero recurso para minha ong', { publico: 'osc', resto: '' }],                  // "minha" não vira Minas
    ['projeto para idosos nos próximos 15 dias', { area: 'Desenvolvimento', prazo: '15', resto: '' }], // "para" não vira Pará
    ['ong no Pará', { publico: 'osc', uf: 'PA', resto: '' }],
    ['se tiver algo de energia solar', { area: 'Energia', resto: 'se tiver algo' }],    // "se" minúsculo não é Sergipe
    ['no meu estado', { uf: 'CE', resto: '' }, { ufPerfil: 'CE' }]
];
for (const [frase, esperado, op] of casos) {
    test(`interpreta: ${frase}`, () => {
        const r = interpretar(frase, op);
        for (const [k, v] of Object.entries(esperado)) assert.equal(r[k], v, `${k} em "${frase}": ${JSON.stringify(r)}`);
        for (const k of ['publico', 'uf', 'area', 'valor', 'valorMax', 'prazo', 'novos', 'contra', 'status'])
            if (!(k in esperado)) assert.equal(r[k], undefined, `${k} inesperado em "${frase}": ${JSON.stringify(r)}`);
        assert.equal(r.entendidos.length, Object.keys(esperado).filter(k => k !== 'resto').length);
    });
}
test('cada filtro entendido guarda o trecho original (para tirar do texto ao remover o chip)', () => {
    const r = interpretar('ONG de cultura em SP até 200 mil');
    assert.deepEqual(r.entendidos.map(e => e.trecho), ['ONG', 'cultura', 'SP', 'até 200 mil']); // na ordem da frase
});
test('sugere filtros enquanto digita', () => {
    assert.ok(sugerirFiltros('bah').some(s => s.k === 'uf' && s.v === 'BA'));
    assert.ok(sugerirFiltros('cult').some(s => s.k === 'area' && s.v === 'Cultura'));
    assert.deepEqual(sugerirFiltros('a'), []);
});
test('distância de edição com corte', () => {
    assert.equal(distancia('cultura', 'cutura'), 1);
    assert.equal(distancia('abc', 'xyzabc', 2), 3);
});
