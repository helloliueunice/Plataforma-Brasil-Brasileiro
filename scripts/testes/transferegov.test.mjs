// Testes do normalizador e do coletor do Transferegov com dados simulados (sem rede externa).
// Rodar: node --test scripts/testes/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { titulo, tema, abrangencia, orgao, modalidade, valores } from '../transferegov-normaliza.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'transferegov.mjs');

test('titulo(): caixa alta da API vira título legível, com siglas e códigos preservados', () => {
    assert.equal(titulo('INFRA-ESTRUTURA BÁSICA – SR(PR) SUPERINTENDÊNCIA REGIONAL DO INCRA NO PARANÁ'),
        'Infra-Estrutura Básica – SR(PR) Superintendência Regional do INCRA no Paraná');
    assert.equal(titulo('2317 - (TED 7AADAF SDR/MIDR) DESENVOLVIMENTO REGIONAL'), '2317 - (TED 7AADAF SDR/MIDR) Desenvolvimento Regional');
    assert.equal(titulo('AÇÃO 00SX - APOIO A PROJETOS'), 'Ação 00SX - Apoio a Projetos');
    assert.equal(titulo('Programa SIMEC/PAR'), 'Programa SIMEC/PAR');
    assert.equal(titulo('edupol-ia: pesquisa educação'), 'Edupol-IA: Pesquisa Educação');
    assert.equal(titulo('  fomento   ao setor  agropecuário '), 'Fomento ao Setor Agropecuário');
    // Preposição no início continua maiúscula; siglas de 2 letras soltas não viram sigla (ex.: "a", "de")
    assert.equal(titulo('DE OLHO NA ESCOLA'), 'De Olho na Escola');
    assert.equal(titulo(''), '');
});

test('orgao(): devolve acentos que a API omite', () => {
    assert.equal(orgao('MINISTERIO DA EDUCACAO'), 'Ministério da Educação');
    assert.equal(orgao('MINISTERIO DA INTEGRACAO E DO DESENVOLVIMENTO REGIONAL'), 'Ministério da Integração e do Desenvolvimento Regional');
    assert.equal(orgao(''), 'Governo Federal');
});

test('tema(): título do programa primeiro, ministério depois, Desenvolvimento por padrão', () => {
    assert.equal(tema('Produção de documentário audiovisual de caráter educativo', 'Ministério da Ciência'), 'Cultura');
    assert.equal(tema('Rede de atenção primária à saúde', 'Ministério da Educação'), 'Saúde');
    assert.equal(tema('Programa SIMEC/PAR', 'Ministério da Educação'), 'Educação');
    assert.equal(tema('Fomento ao Setor Agropecuário - Propostas Voluntárias', 'Ministério da Agricultura e Pecuária'), 'Agronegocio');
    assert.equal(tema('Programa Nacional de Estradas Rurais - PRONER', 'Ministério da Agricultura e Pecuária'), 'Infraestrutura', 'obra de estrada é infraestrutura, mesmo no ministério da agricultura');
    assert.equal(tema('Recursos Hídricos: Água em Quantidade e Qualidade', 'Ministério da Integração'), 'Meio Ambiente');
    assert.equal(tema('Apoio ao esporte e lazer', 'Ministério do Esporte'), 'Desenvolvimento');
    assert.equal(tema('Implantação de infraestrutura básica', 'Ministério do Desenvolvimento Agrário'), 'Infraestrutura');
    assert.equal(tema('Programa genérico', 'Ministério da Saúde'), 'Saúde');
    assert.equal(tema('Programa genérico', 'Ministério do Turismo'), 'Desenvolvimento');
});

test('abrangencia(): só restringe quando o título indica a superintendência regional', () => {
    assert.deepEqual(abrangencia('Infra-Estrutura Básica – SR(PR) Superintendência', 'PR'), { abrangencia: 'PR', ufs: ['PR'] });
    assert.deepEqual(abrangencia('Fomento – SR (pa) Superintendência', 'DF'), { abrangencia: 'PA', ufs: ['PA'] });
    const n = abrangencia('Programa nacional', 'SP');
    assert.equal(n.abrangencia, 'Nacional');
    assert.equal(n.ufs, undefined);
    assert.match(n.abrangenciaNota, /indica SP/);
    assert.doesNotMatch(abrangencia('Programa', '').abrangenciaNota, /indica/);
    // Sigla inexistente não restringe
    assert.equal(abrangencia('Teste SR(XX)', '').abrangencia, 'Nacional');
});

test('modalidade(): instrumentos do Transferegov com acento e caixa de frase', () => {
    assert.equal(modalidade('CONVENIO'), 'Convênio');
    assert.equal(modalidade('CONTRATO DE REPASSE'), 'Contrato de repasse');
    assert.equal(modalidade('TERMO DE FOMENTO'), 'Termo de fomento');
    assert.equal(modalidade('TERMO DE COLABORACAO'), 'Termo de colaboração');
    assert.equal(modalidade('TERMO DE COMPROMISSO'), 'Termo de compromisso');
    assert.equal(modalidade('', 'CONVENIO'), 'Convênio', 'usa modalidade_programa_agrupada quando a principal vem vazia');
    assert.equal(modalidade(null, undefined), 'Transferência voluntária');
    assert.equal(modalidade('ACORDO ESPECIAL'), 'Acordo especial');
});

test('valores(): faixa, teto, contrapartida e campos desconhecidos', () => {
    assert.deepEqual(valores({ vl_minimo_proposta: '100.000,00', vl_maximo_proposta: 1500000, percentual_contrapartida: 2 }), {
        valorMin: 100000, valorMax: 1500000, tipoValor: 'faixa',
        valorNota: 'De R$ 100.000 a R$ 1.500.000 por proposta, segundo as regras do programa no Transferegov.br.',
        contrapartida: '2% do valor (regra do programa no Transferegov.br)'
    });
    const so = valores({ valor_max: '1.500.000' });
    assert.equal(so.valorMax, 1500000);
    assert.equal(so.tipoValor, 'por-proposta');
    assert.equal(valores({ valor_min: 'R$ 50.000,00' }).valorMin, 50000);
    assert.equal(valores({ valor_min: 50000 }).tipoValor, undefined, 'só mínimo não define o tipo');
    // invertidos são corrigidos; zeros e lixo ignorados
    assert.deepEqual([valores({ vl_min: 9, vl_max: 3 }).valorMin, valores({ vl_min: 9, vl_max: 3 }).valorMax], [3, 9]);
    assert.deepEqual(valores({ vl_max: 0, vl_min: 'abc' }), {});
    assert.deepEqual(valores({ valor_global: 10, vl_repasse: 5 }), {}, 'valor global não é teto por proposta');
    assert.deepEqual(valores({ percentual_contrapartida: 150 }), {}, 'percentual impossível ignorado');
    assert.deepEqual(valores(null), {});
    assert.deepEqual(valores([1, 2]), {});
});

/* ---------------- Coletor completo contra uma API simulada ---------------- */
const PROGRAMAS = [
    { id_programa: 56851, cod_programa: '2624920260003', desc_orgao_sup_programa: 'MINISTERIO DA EDUCACAO', nome_programa: 'Rede multidisciplinar de atenção a mães e familiares', sit_programa: 'DISPONIBILIZADO', data_disponibilizacao: '2026-10-14', dt_prog_ini_receb_prop: '2026-10-14', dt_prog_fim_receb_prop: '2026-11-13', descricao: 'O projeto tem por objetivo oferecer atendimentos.', criterios_de_selecao: '', data_publicacao: '2026-10-14', modalidade_programa: 'TERMO DE COLABORACAO', natureza_juridica_programa: 'Organização da Sociedade Civil', uf_programa: 'AL', qualificacao_proposta: 'Proposta Voluntária', modalidade_programa_agrupada: 'TERMO DE COLABORACAO' },
    { id_programa: 56402, cod_programa: '4900020260011', desc_orgao_sup_programa: 'MINISTERIO DO DESENVOLVIMENTO AGRARIO E AGRICULTURA FAMILIAR', nome_programa: 'INFRA-ESTRUTURA BÁSICA – SR(PR) SUPERINTENDÊNCIA REGIONAL DO INCRA NO PARANÁ', sit_programa: 'DISPONIBILIZADO', dt_prog_ini_receb_prop: '2026-10-01', dt_prog_fim_receb_prop: '2026-12-01', descricao: '', modalidade_programa: 'CONVENIO', natureza_juridica_programa: 'Administração Pública Municipal', uf_programa: 'PR', qualificacao_proposta: 'Proposta Voluntária' },
    // Encerrado: fica de fora
    { id_programa: 1, cod_programa: '1', nome_programa: 'Encerrado', dt_prog_ini_receb_prop: '2026-01-01', dt_prog_fim_receb_prop: '2026-02-01', natureza_juridica_programa: 'Administração Pública Municipal' }
];

function apiSimulada({ comRegras = false } = {}) {
    const srv = http.createServer((req, res) => {
        const u = new URL(req.url, 'http://x');
        const json = (d) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(d)); };
        if (u.pathname === '/discricionarias/todos-programas') {
            // Só a primeira consulta devolve linhas (as demais combinações de ano/expiração vêm vazias)
            const primeira = u.searchParams.get('expiracao_prog_prop_voluntaria') === 'EXPIRACAO_PROG_MUITO_PROX' && u.searchParams.get('ano_disponibilizacao') === '2026' && u.searchParams.get('pagina') === '1';
            return json({ data: primeira ? PROGRAMAS : [] });
        }
        if (u.pathname === '/discricionarias/data-atualizacao') return json({ data_ultima_atualizacao: '2026-11-01T11:00:00' });
        if (comRegras && u.pathname === '/discricionarias/regras-teste') {
            const id = Number(u.searchParams.get('id_programa'));
            return json({ data: id === 56402 ? [{ id_programa: 56402, vl_minimo_proposta: 250000, vl_maximo_proposta: 2000000, percentual_contrapartida: 1 }] : [] });
        }
        res.writeHead(404); res.end('{}');
    });
    return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({ srv, base: `http://127.0.0.1:${srv.address().port}` })));
}

function coletar(base, env = {}) {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'tgov-'));
    return new Promise((ok, falha) => {
        execFile(process.execPath, [SCRIPT], { env: { PATH: process.env.PATH, MONITOR_RAIZ: raiz, HOJE: '2026-11-01', TRANSFEREGOV_URL: base, ...env }, timeout: 60000 }, (err, stdout, stderr) => {
            try {
                if (err) throw new Error(`${err.message}\n${stdout}\n${stderr}`);
                ok(JSON.parse(fs.readFileSync(path.join(raiz, 'data', 'transferegov.json'), 'utf8')));
            } catch (e) { falha(e); } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
        });
    });
}

test('coletor: modalidade, código em destaque e valores desligados por padrão', async () => {
    const { srv, base } = await apiSimulada();
    try {
        const out = await coletar(base);
        assert.equal(out.editais.length, 2);
        const [osc, mun] = out.editais; // ordenados pelo prazo
        assert.equal(osc.id, 1056851);
        assert.equal(osc.modalidade, 'Termo de colaboração');
        assert.deepEqual(osc.publico, ['osc']);
        assert.equal(osc.instituicao, 'Ministério da Educação');
        assert.equal(osc.link, 'https://www.gov.br/transferegov/pt-br');
        assert.match(osc.prazoNota, /^Código do programa: 2624920260003\./);
        assert.match(osc.linkNota, /2624920260003/);
        assert.equal(osc.objeto, 'O projeto tem por objetivo oferecer atendimentos.');
        assert.ok(osc.tags.includes('Termo de colaboração'));
        assert.equal(osc.valorMax, null);
        assert.equal(osc.tipoValor, 'nao-informado');
        assert.equal(mun.modalidade, 'Convênio');
        assert.deepEqual(mun.publico, ['municipio']);
        assert.deepEqual(mun.ufs, ['PR']);
        assert.equal(mun.objeto, undefined);
        assert.equal(mun.valorMax, null, 'sem TRANSFEREGOV_VALORES_CAMINHO nada de valor é inventado');
    } finally { srv.close(); }
});

test('coletor: endpoint opcional de regras preenche faixa de valor e contrapartida', async () => {
    const { srv, base } = await apiSimulada({ comRegras: true });
    try {
        const out = await coletar(base, { TRANSFEREGOV_VALORES_CAMINHO: '/discricionarias/regras-teste/' });
        const mun = out.editais.find(e => e.id === 1056402);
        assert.equal(mun.valorMin, 250000);
        assert.equal(mun.valorMax, 2000000);
        assert.equal(mun.tipoValor, 'faixa');
        assert.match(mun.valorNota, /R\$ 250\.000 a R\$ 2\.000\.000/);
        assert.match(mun.contrapartida, /^1% do valor/);
        const osc = out.editais.find(e => e.id === 1056851);
        assert.equal(osc.valorMax, null, 'programa sem regra continua sem valor');
    } finally { srv.close(); }
});
