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
 *
 * Campos preenchidos para municípios:
 *  - modalidade: do campo modalidade_programa (Convênio, Contrato de repasse, Termo de fomento,
 *    Termo de colaboração, Termo de compromisso).
 *  - objeto/resumo: do campo descricao do programa.
 *  - link: não há URL pública estável por código de programa (a consulta pública do Transferegov.br
 *    é feita dentro do sistema, por formulário). Mantemos o portal oficial e destacamos o código
 *    do programa no número, no início do prazoNota e em "linkNota".
 *  - valores (DESLIGADO): todos-programas não traz valor mínimo/máximo nem contrapartida. Se houver
 *    um endpoint público com as regras do programa, defina TRANSFEREGOV_VALORES_CAMINHO com o caminho
 *    (ex.: "discricionarias/<endpoint>"); o script consulta ?id_programa=<id> para cada programa aberto
 *    e aplica valores() de transferegov-normaliza.mjs (reconhece vl_/valor_ min/max e % de contrapartida).
 *    Sem a variável, nada muda. Teste antes com --diagnostico.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { limpa, titulo, orgao as nomeOrgao, tema, abrangencia, modalidade, valores, docsExtrasPrograma, prazoNotaPrograma, contrapartidaPadrao } from './transferegov-normaliza.mjs';

const RAIZ = process.env.MONITOR_RAIZ || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.TRANSFEREGOV_URL || 'https://api-publica.transferegov.gestao.gov.br').replace(/\/+$/, '');
const DIAG = process.argv.includes('--diagnostico');
const HOJE = process.env.HOJE || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const SAIDA = path.join(RAIZ, 'data', 'transferegov.json');
const UA = 'FundosBrasil/1.0 (+https://github.com/helloliueunice/Plataforma-Brasil-Brasileiro)';
const LINK_PORTAL = 'https://www.gov.br/transferegov/pt-br';
// Endpoint opcional com as regras de valor do programa (desligado sem a variável; ver o cabeçalho)
const CAMINHO_VALORES = String(process.env.TRANSFEREGOV_VALORES_CAMINHO || '').replace(/^\/+|\/+$/g, '');

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
const iso = s => (/^\d{4}-\d{2}-\d{2}/.test(String(s || '')) ? String(s).slice(0, 10) : null);

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

function paraEdital(p, regras = null) {
    const ab = iso(p.dt_prog_ini_receb_prop), fim = iso(p.dt_prog_fim_receb_prop);
    const pubs = publicos(p);
    const orgao = nomeOrgao(p.desc_orgao_sup_programa || p.orgao_executor || 'Governo Federal');
    const desc = limpa(p.descricao || p.observacao || '');
    const cod = limpa(p.cod_programa);
    const mod = modalidade(p.modalidade_programa, p.modalidade_programa_agrupada);
    const ed = {
        id: 1000000 + Number(p.id_programa),
        numero: `Programa Transferegov ${limpa(p.cod_programa)}`,
        titulo: titulo(p.nome_programa).slice(0, 180),
        instituicao: orgao,
        agencia: null,
        procedencia: 'nacional',
        tema: tema(p.nome_programa, orgao),
        tags: ['Transferegov', 'Transferência voluntária', mod !== 'Transferência voluntária' && mod].filter(Boolean).slice(0, 4),
        modalidade: mod,
        publico: pubs,
        ...abrangencia(p.nome_programa, p.uf_programa),
        moeda: 'BRL',
        valorMax: null,
        valorNota: 'Valores, contrapartida e limites por proposta estão nas regras do programa no Transferegov.br.',
        contrapartida: contrapartidaPadrao(mod),
        publicadoEm: iso(p.data_publicacao) || iso(p.data_disponibilizacao) || ab,
        abertura: ab,
        encerramento: fim,
        prazoNota: prazoNotaPrograma(cod, pubs),
        resumo: (desc || `Programa do ${orgao} para receber propostas voluntárias de ${pubs.map(x => ({ municipio: 'municípios', estado: 'estados', osc: 'organizações da sociedade civil' })[x]).join(', ') || 'proponentes habilitados'}.`).slice(0, 600),
        link: LINK_PORTAL,
        linkNota: `No Transferegov.br, procure o programa pelo código ${cod}.`,
        fonte: `${BASE}/discricionarias/todos-programas?id_programa=${p.id_programa}`,
        verificadoEm: HOJE,
        criterios: limpa(p.criterios_de_selecao) ? [{ nome: limpa(p.criterios_de_selecao).slice(0, 200) }] : [],
        docsExtras: docsExtrasPrograma(),
        fonteRecurso: 'publico',
        tipoValor: 'nao-informado',
        fluxoContinuo: false,
        origem: 'transferegov',
        codigoPrograma: cod
    };
    if (desc) ed.objeto = desc.slice(0, 600);
    // Valores e contrapartida só quando o endpoint opcional de regras respondeu com campos reconhecidos
    const v = valores(regras);
    if (v.valorMax || v.valorMin) Object.assign(ed, v);
    else if (v.contrapartida) ed.contrapartida = v.contrapartida;
    return ed;
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
const aberto = e => e.abertura && e.encerramento && e.encerramento >= HOJE && e.publico.length;
let editais = programas
    .map(p => paraEdital(p))
    .filter(aberto)
    .sort((a, b) => a.encerramento.localeCompare(b.encerramento));

// Valores por programa (desligado sem TRANSFEREGOV_VALORES_CAMINHO). Só para os programas abertos; falhas não bloqueiam.
if (CAMINHO_VALORES) {
    let comValor = 0, falhasValor = 0;
    const amostraValor = [];
    for (const [i, e] of editais.entries()) {
        const p = porId.get(e.id - 1000000);
        try {
            const env = await pedir(CAMINHO_VALORES, { id_programa: p.id_programa });
            const linhas = Array.isArray(env) ? env : (env && env.data) || [];
            const regra = linhas.find(l => l && String(l.id_programa ?? p.id_programa) === String(p.id_programa)) || null;
            if (regra && amostraValor.length < 2) amostraValor.push(regra);
            const novo = paraEdital(p, regra);
            if (novo.valorMax || novo.valorMin || novo.contrapartida !== e.contrapartida) comValor++;
            editais[i] = novo;
        } catch (_) { falhasValor++; }
    }
    anotar('Valores dos programas', `${comValor} de ${editais.length} com valor/contrapartida reconhecidos em ${CAMINHO_VALORES}; ${falhasValor} falha(s).\nAmostra: ${JSON.stringify(amostraValor).slice(0, 3000)}`, falhasValor ? 'warning' : 'notice');
}

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
