#!/usr/bin/env node
/**
 * Programas abertos do Transferegov (transferências discricionárias da União)
 * ---------------------------------------------------------------------------
 * Lê a API pública de dados abertos do Transferegov (sem chave) e grava em
 * data/transferegov.json os programas com recebimento de propostas voluntárias
 * aberto ou previsto — a principal porta de entrada de municípios, estados,
 * consórcios e OSCs para recursos federais.
 *
 * Fonte: https://api-publica.transferegov.gestao.gov.br/discricionarias/todos-programas
 * (FastAPI; filtros por parâmetro; paginação ?pagina=&tamanho_da_pagina=, até 200;
 * as linhas vêm em "data". A tabela é uma visão programa × proposta: deduplicamos
 * por id_programa.)
 *
 * Uso:
 *   node scripts/transferegov.mjs                 atualiza data/transferegov.json
 *   node scripts/transferegov.mjs --diagnostico   só mostra contagens e amostras (anotações no Actions)
 * Variáveis: TRANSFEREGOV_URL (base da API, para testes), HOJE (AAAA-MM-DD), MONITOR_RAIZ.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = process.env.MONITOR_RAIZ || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.TRANSFEREGOV_URL || 'https://api-publica.transferegov.gestao.gov.br').replace(/\/+$/, '');
const DIAG = process.argv.includes('--diagnostico');
const HOJE = process.env.HOJE || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const SAIDA = path.join(RAIZ, 'data', 'transferegov.json');
const UA = 'FundosBrasil/1.0 (+https://github.com/helloliueunice/Plataforma-Brasil-Brasileiro)';

const anotar = (titulo, texto, tipo = 'notice') => {
    const e = v => String(v).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    if (process.env.GITHUB_ACTIONS) console.log(`::${tipo} title=${e(titulo).replace(/[:,]/g, ' ')}::${e(String(texto).slice(0, 60000))}`);
    else console.log(`\n## ${titulo}\n${texto}`);
};

async function pedir(caminho, params = {}) {
    const url = new URL(`${BASE}/${caminho}`);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, v);
    for (let t = 1; t <= 4; t++) {
        try {
            const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': UA }, signal: AbortSignal.timeout(60000) });
            if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
            if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`), { definitivo: true });
            return await r.json();
        } catch (err) {
            if (err.definitivo || t === 4) throw err;
            await new Promise(ok => setTimeout(ok, 2000 * t));
        }
    }
}

// Coleta todas as páginas de uma consulta. A visão é programa × proposta e pesada:
// se o serviço falhar (502/504), reduz o tamanho da página e tenta de novo.
async function todas(caminho, params, maxLinhas = 20000) {
    const linhas = [];
    let tam = 200, pagina = 1;
    while (linhas.length < maxLinhas) {
        let env;
        try { env = await pedir(caminho, { ...params, pagina, tamanho_da_pagina: tam }); }
        catch (err) {
            if (tam > 25 && !err.definitivo) { const ini = (pagina - 1) * tam; tam = Math.max(25, tam / 2); pagina = Math.floor(ini / tam) + 1; continue; }
            throw err;
        }
        const dados = Array.isArray(env) ? env : env.data || [];
        linhas.push(...dados);
        if (dados.length < tam) break;
        pagina++;
    }
    return linhas;
}

/* ---------------- Normalização para o formato do editais.json ---------------- */
const limpa = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const iso = s => (/^\d{4}-\d{2}-\d{2}/.test(String(s || '')) ? String(s).slice(0, 10) : null);
const capitaliza = s => limpa(s).toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase())
    .replace(/\b(De|Da|Do|Das|Dos|E|Para|Em|No|Na|Nos|Nas|A|O|Às|Ao|Aos|Com|Por)\b/g, w => w.toLowerCase());

// Quem pode propor, a partir da natureza jurídica / qualificação informadas no programa
function publicos(p) {
    const t = `${p.natureza_juridica_programa || ''} ${p.qualificacao_proposta || ''}`.toLowerCase();
    const s = new Set();
    if (/munic/.test(t)) s.add('municipio');
    if (/estad|distrito federal/.test(t)) s.add('estado');
    if (/organiza[cç][aã]o da sociedade civil|osc|entidade privada sem fins|sem fins lucrativos/.test(t)) s.add('osc');
    if (/cons[oó]rcio/.test(t)) { s.add('municipio'); }
    return [...s];
}

function tema(p) {
    const t = `${p.desc_orgao_sup_programa} ${p.nome_programa} ${p.descricao || ''}`.toLowerCase();
    if (/sa[uú]de|sus\b|hospital|aten[cç][aã]o (prim|b[aá]s)/.test(t)) return 'Saúde';
    if (/educa|escola|ensino/.test(t)) return 'Educação';
    if (/cultura|patrim[oô]nio|museu|biblioteca/.test(t)) return 'Cultura';
    if (/esporte|lazer/.test(t)) return 'Desenvolvimento';
    if (/agric|agro|pecu[aá]ria|rural|pesca|aliment/.test(t)) return 'Agronegocio';
    if (/meio ambiente|ambiental|clima|saneamento|res[ií]duo|[aá]gua/.test(t)) return 'Meio Ambiente';
    if (/seguran[cç]a p[uú]blica|defesa civil|pol[ií]cia|justi[cç]a/.test(t)) return 'Segurança';
    if (/energia/.test(t)) return 'Energia';
    if (/ci[eê]ncia|tecnolog|inova|digital|conectividade/.test(t)) return 'Tecnologia';
    if (/obra|infraestrutura|pavimenta|mobilidade|transporte|habita|urban|cidade/.test(t)) return 'Infraestrutura';
    return 'Desenvolvimento';
}

function paraEdital(p) {
    const ab = iso(p.dt_prog_ini_receb_prop), fim = iso(p.dt_prog_fim_receb_prop);
    const pubs = publicos(p);
    const uf = limpa(p.uf_programa).toUpperCase();
    const orgao = capitaliza(p.desc_orgao_sup_programa || p.orgao_executor || 'Governo Federal');
    const desc = limpa(p.descricao || p.observacao || '');
    return {
        id: 1000000 + Number(p.id_programa),
        numero: `Programa Transferegov ${limpa(p.cod_programa)}`,
        titulo: capitaliza(p.nome_programa).slice(0, 180),
        instituicao: orgao,
        agencia: null,
        procedencia: 'nacional',
        tema: tema(p),
        tags: ['Transferegov', 'Transferência voluntária', limpa(p.modalidade_programa) && capitaliza(p.modalidade_programa)].filter(Boolean).slice(0, 4),
        modalidade: 'Transferência voluntária',
        publico: pubs,
        abrangencia: /^[A-Z]{2}$/.test(uf) ? uf : 'Nacional',
        ...( /^[A-Z]{2}$/.test(uf) ? { ufs: [uf] } : {}),
        moeda: 'BRL',
        valorMax: null,
        valorNota: 'Valores, contrapartida e limites por proposta estão nas regras do programa no Transferegov.br.',
        contrapartida: 'Conforme a LDO e as regras do programa',
        publicadoEm: iso(p.data_publicacao) || iso(p.data_disponibilizacao) || ab,
        abertura: ab,
        encerramento: fim,
        prazoNota: `Proposta cadastrada no Transferegov.br (módulo Discricionárias), pelo código ${limpa(p.cod_programa)}. É preciso cadastro do proponente e, para entes, regularidade no CAUC.`,
        resumo: (desc || `Programa do ${orgao} para receber propostas voluntárias de ${pubs.map(x => ({ municipio: 'municípios', estado: 'estados', osc: 'organizações da sociedade civil' })[x]).join(', ') || 'proponentes habilitados'}.`).slice(0, 600),
        link: 'https://www.gov.br/transferegov/pt-br',
        fonte: `${BASE}/discricionarias/todos-programas?id_programa=${p.id_programa}`,
        verificadoEm: HOJE,
        criterios: limpa(p.criterios_de_selecao) ? [{ nome: limpa(p.criterios_de_selecao).slice(0, 200) }] : [],
        docsExtras: ['Cadastro do proponente atualizado no Transferegov.br', 'Regularidade no CAUC (entes federativos)'],
        fonteRecurso: 'publico',
        tipoValor: 'nao-informado',
        fluxoContinuo: false,
        origem: 'transferegov',
        codigoPrograma: limpa(p.cod_programa)
    };
}

/* ---------------- Coleta ---------------- */
const ANO = Number(HOJE.slice(0, 4));
const consultas = [];
for (const exp of ['EXPIRACAO_PROG_MUITO_PROX', 'EXPIRACAO_PROG_PROX', 'EXPIRACAO_PROG_DISTANTE'])
    for (const ano of [ANO, ANO - 1]) consultas.push({ expiracao_prog_prop_voluntaria: exp, ano_disponibilizacao: String(ano) });
const porId = new Map();
const registro = []; // resumo das consultas (anotado uma vez no fim)
const amostras = [];
let falhas = 0;
// Códigos de órgão superior (ministérios) para dividir consultas pesadas; e UFs como 2º nível
const ORGAOS = Array.from({ length: 80 }, (_, i) => String(20000 + i * 1000));
const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];
async function coletar(params, rotulo, nivel = 0) {
    try {
        const linhas = await todas('discricionarias/todos-programas', { sit_programa: 'DISPONIBILIZADO', ...params });
        for (const p of linhas) if (!porId.has(p.id_programa)) { porId.set(p.id_programa, p); if (amostras.length < 3) amostras.push(p); }
        if (nivel === 0 || linhas.length) registro.push(`${rotulo}: ${linhas.length} linhas · ${porId.size} programas até aqui`);
    } catch (err) {
        if (nivel === 0) { for (const o of ORGAOS) await coletar({ ...params, cod_orgao_sup_programa: o }, `${rotulo} órgão ${o}`, 1); return; }
        if (nivel === 1) { for (const uf of UFS) await coletar({ ...params, uf_programa: uf }, `${rotulo} ${uf}`, 2); return; }
        falhas++; registro.push(`FALHA ${rotulo}: ${err.message.slice(0, 80)}`);
    }
}
for (const c of consultas) await coletar(c, `${c.expiracao_prog_prop_voluntaria} ${c.ano_disponibilizacao}`);
anotar('Consultas', `${falhas} falha(s)\n` + registro.join('\n'), falhas ? 'warning' : 'notice');

const programas = [...porId.values()];
const editais = programas
    .map(paraEdital)
    .filter(e => e.abertura && e.encerramento && e.encerramento >= HOJE && e.publico.length)
    .sort((a, b) => a.encerramento.localeCompare(b.encerramento));

let atualizacao = null;
try { atualizacao = await pedir('discricionarias/data-atualizacao'); } catch (_) { /* opcional */ }

if (DIAG) {
    const cont = (f) => Object.entries(programas.reduce((m, p) => { const k = limpa(f(p)) || '(vazio)'; m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${v} × ${k}`).join('\n');
    anotar('Resumo', `Programas distintos: ${programas.length}\nAbertos com datas e público reconhecido: ${editais.length}\nAtualização da base: ${JSON.stringify(atualizacao)}`);
    anotar('Natureza jurídica', cont(p => p.natureza_juridica_programa));
    anotar('Qualificação da proposta', cont(p => p.qualificacao_proposta));
    anotar('Modalidade', cont(p => p.modalidade_programa));
    anotar('Órgão superior', cont(p => p.desc_orgao_sup_programa));
    anotar('Amostra bruta', JSON.stringify(amostras.map(p => { const { programas_propostas, ...r } = p; return r; }), null, 1).slice(0, 6000));
    anotar('Amostra normalizada', JSON.stringify(editais.slice(0, 3), null, 1));
    process.exit(0);
}

if (falhas && fs.existsSync(SAIDA) && (JSON.parse(fs.readFileSync(SAIDA, 'utf8')).editais || []).length > editais.length) { anotar('Transferegov parcial', `${falhas} consulta(s) falharam; mantivemos o arquivo anterior, mais completo.`, 'warning'); process.exit(0); }
if (!programas.length && falhas) { anotar('Transferegov indisponível', 'Nenhuma consulta funcionou; o arquivo anterior foi mantido.', 'warning'); process.exit(0); }
fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
fs.writeFileSync(SAIDA, JSON.stringify({ geradoEm: HOJE, fonte: `${BASE}/discricionarias/todos-programas`, atualizacaoBase: atualizacao, editais }, null, 2) + '\n');
anotar('Transferegov', `${editais.length} programas com propostas abertas ou previstas gravados em data/transferegov.json`);
