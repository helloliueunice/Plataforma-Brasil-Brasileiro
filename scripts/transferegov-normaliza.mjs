// Regras de normalização dos programas do Transferegov (usadas pelo coletor e pelos testes).
// Sem dependências: recebe textos crus da API pública e devolve campos no formato do editais.json.

export const limpa = s => String(s ?? '').replace(/\s+/g, ' ').trim();

const SIGLAS = new Set(['SR', 'SDR', 'MIDR', 'TED', 'RP', 'DIEA', 'SIMEC', 'PAR', 'CERN', 'IA', 'RI', 'PRONER', 'PROMAQ', 'SUS', 'INCRA', 'MEC', 'MDA', 'MMA', 'FNDE', 'PAC', 'ODS', 'TI', 'UBS', 'CRAS', 'CREAS',
    'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO']);
const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'para', 'em', 'no', 'na', 'nos', 'nas', 'a', 'o', 'à', 'às', 'ao', 'aos', 'com', 'por']);

// Título legível: minúsculas → iniciais maiúsculas, siglas e códigos (com dígitos) em caixa alta.
export function titulo(s) {
    const base = limpa(s).toLowerCase();
    let primeira = true;
    return base.replace(/[\p{L}\p{N}]+/gu, (w, pos) => {
        const W = w.toUpperCase();
        const antes = base[pos - 1] || ' ';
        let out;
        if (SIGLAS.has(W) && (w.length > 2 || /[(\-/]/.test(antes) || /[()/]/.test(base[pos + w.length] || ''))) out = W;
        else if (/\d/.test(w) && /\p{L}/u.test(w)) out = W;
        else if (!primeira && MINUSCULAS.has(w)) out = w;
        else out = w[0].toUpperCase() + w.slice(1);
        primeira = false;
        return out;
    });
}

// Nomes de órgãos chegam sem acento na API ("Ministerio da Educacao").
const ACENTOS = [[/\bMinisterio\b/g, 'Ministério'], [/\bEducacao\b/g, 'Educação'], [/\bSaude\b/g, 'Saúde'], [/\bIntegracao\b/g, 'Integração'],
    [/\bCiencia\b/g, 'Ciência'], [/\bInovacao\b/g, 'Inovação'], [/\bComunicacoes\b/g, 'Comunicações'], [/\bPecuaria\b/g, 'Pecuária'], [/\bAgrario\b/g, 'Agrário'],
    [/\bIndustria\b/g, 'Indústria'], [/\bComercio\b/g, 'Comércio'], [/\bServicos\b/g, 'Serviços'], [/\bJustica\b/g, 'Justiça'], [/\bSeguranca\b/g, 'Segurança'],
    [/\bPublica\b/g, 'Pública'], [/\bAssistencia\b/g, 'Assistência'], [/\bFamilia\b/g, 'Família'], [/\bCombate\b/g, 'Combate'], [/\bMulheres\b/g, 'Mulheres'],
    [/\bCidades\b/g, 'Cidades'], [/\bTurismo\b/g, 'Turismo'], [/\bEsporte\b/g, 'Esporte'], [/\bGestao\b/g, 'Gestão'], [/\bInformacao\b/g, 'Informação']];
export function orgao(s) {
    let t = titulo(s || 'Governo Federal').replace(/\bcomércio\b/g, 'Comércio').replace(/\bserviços\b/g, 'Serviços');
    for (const [re, v] of ACENTOS) t = t.replace(re, v);
    return t;
}

// Área: 1º o título do programa (mais específico), depois o ministério; descrições longas confundem e não são usadas.
const REGRAS_TITULO = [
    [/audiovisual|document[aá]rio|museu|patrim[oô]nio|biblioteca/, 'Cultura'],
    [/sa[uú]de|\bsus\b|hospital|aten[cç][aã]o (prim|b[aá]s)/, 'Saúde'],
    [/educa|escola|ensino|professor/, 'Educação'],
    [/\bcultur/, 'Cultura'],
    [/esporte|lazer/, 'Desenvolvimento'],
    [/agr[ií]c|agro|pecu[aá]ri|rural|pesca|aquicult|aliment/, 'Agronegocio'],
    [/meio ambiente|ambiental|clima|saneamento|res[ií]duo|h[ií]dric|[aá]gua\b/, 'Meio Ambiente'],
    [/seguran[cç]a p[uú]blica|defesa civil|pol[ií]cia|justi[cç]a/, 'Segurança'],
    [/energia/, 'Energia'],
    [/ci[eê]ncia|tecnolog|inova[cç]|digital|conectividade|intelig[eê]ncia artificial/, 'Tecnologia'],
    [/obra|infra-?estrutura|pavimenta|estrada|mobilidade|transporte|habita|urban/, 'Infraestrutura'],
];
const REGRAS_ORGAO = [
    [/cultura/, 'Cultura'], [/sa[uú]de/, 'Saúde'], [/educa/, 'Educação'], [/agricultura|pecu[aá]ria|agr[aá]rio|pesca/, 'Agronegocio'],
    [/meio ambiente/, 'Meio Ambiente'], [/justi[cç]a|seguran[cç]a/, 'Segurança'], [/minas e energia/, 'Energia'], [/ci[eê]ncia|tecnologia/, 'Tecnologia'],
    [/cidades|transportes/, 'Infraestrutura'],
];
export function tema(nomePrograma, nomeOrgao) {
    const t = limpa(nomePrograma).toLowerCase(), o = limpa(nomeOrgao).toLowerCase();
    for (const [re, v] of REGRAS_TITULO) if (re.test(t)) return v;
    for (const [re, v] of REGRAS_ORGAO) if (re.test(o)) return v;
    return 'Desenvolvimento';
}

// Abrangência: a UF cadastrada no programa costuma ser a do órgão/unidade que o cadastrou, não um limite
// de quem pode propor. Só restringimos quando o próprio título indica a unidade regional, ex.: "Sr(Sp)".
// Sem essa confirmação, não afirmamos "Nacional": a abrangência fica "Não informada", com a UF do cadastro
// em ufCadastro (sem ufs, para não filtrar quem pode estar apto) e uma nota pedindo conferência.
export const ABRANGENCIA_NAO_INFORMADA = 'Não informada';
const UFS_VALIDAS = new Set(['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO']);
export function abrangencia(nomePrograma, ufPrograma) {
    const m = limpa(nomePrograma).match(/\bsr\s*\(\s*([a-z]{2})\s*\)/i);
    const uf = m ? m[1].toUpperCase() : '';
    if (uf && UFS_VALIDAS.has(uf)) return { abrangencia: uf, ufs: [uf] };
    const cad = limpa(ufPrograma).toUpperCase();
    const temCad = UFS_VALIDAS.has(cad);
    return {
        abrangencia: ABRANGENCIA_NAO_INFORMADA,
        ...(temCad ? { ufCadastro: cad } : {}),
        abrangenciaNota: `A fonte não informa onde o programa vale.${temCad ? ` O cadastro indica ${cad}.` : ''} Confira no programa antes de propor.`
    };
}

// Modalidade do instrumento, a partir de modalidade_programa (ou modalidade_programa_agrupada) da API.
// Valores vistos na API: CONVENIO, CONTRATO DE REPASSE, TERMO DE FOMENTO, TERMO DE COLABORACAO, TERMO DE COMPROMISSO.
const MODALIDADES = [
    [/^conv[eê]nio/, 'Convênio'],
    [/^contrato de repasse/, 'Contrato de repasse'],
    [/^termo de fomento/, 'Termo de fomento'],
    [/^termo de colabora[cç][aã]o/, 'Termo de colaboração'],
    [/^termo de compromisso/, 'Termo de compromisso'],
    [/^termo de execu[cç][aã]o descentralizada/, 'Termo de execução descentralizada'],
];
export function modalidade(...valores) {
    for (const v of valores) {
        const t = limpa(v).toLowerCase();
        if (!t) continue;
        for (const [re, nome] of MODALIDADES) if (re.test(t)) return nome;
        return t[0].toUpperCase() + t.slice(1);
    }
    return 'Transferência voluntária';
}

// Textos em linguagem simples que dependem de quem pode pedir (Lei 15.263/2025: linguagem simples).
// CAUC só vale para entes (prefeituras, estados, DF): OSC não consulta nem recebe CAUC. O item de CAUC do
// checklist vem da lista por público (DOCS_POR_PUBLICO), por isso não é repetido aqui.
const ehEnte = pubs => (pubs || []).some(p => p === 'municipio' || p === 'estado');
export function docsExtrasPrograma() {
    return ['Cadastro de quem vai pedir o recurso atualizado no Transferegov.br'];
}
export function prazoNotaPrograma(cod, pubs) {
    return `Código do programa: ${cod}. A proposta é cadastrada no Transferegov.br (módulo Discricionárias), buscando por esse código. É preciso ter cadastro no Transferegov.br${ehEnte(pubs) ? ' e, para prefeituras e estados, estar em dia no CAUC (serviço do Tesouro Nacional que mostra se o ente pode receber repasses)' : ''}.`;
}
// Termo de fomento/colaboração seguem o MROSC (Lei 13.019/2014, art. 35, § 1º): sem contrapartida em dinheiro.
export function contrapartidaPadrao(mod) {
    return /^termo de (fomento|colabora)/i.test(mod || '')
        ? 'Não é exigida em dinheiro nas parcerias com OSC (MROSC); pode haver em bens e serviços. Confira as regras do programa'
        : 'Conforme a Lei de Diretrizes Orçamentárias (LDO) e as regras do programa';
}

// Valores por proposta e contrapartida (DESLIGADO por padrão).
// O registro de discricionarias/todos-programas não traz valores (conferido nas amostras do diagnóstico de
// 31/10/2026: só datas, órgão, modalidade, natureza jurídica, descrição e critérios). Se a API pública expuser
// um endpoint com as regras do programa (valor mínimo/máximo por proposta, percentual de contrapartida),
// ligue com TRANSFEREGOV_VALORES_CAMINHO (ver transferegov.mjs). Os nomes dos campos não estão documentados:
// reconhecemos variações comuns (vl_/valor_, min/minimo, max/maximo, percentual de contrapartida).
const numero = v => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const s = limpa(v).replace(/^r\$\s*/i, '');
    if (!s) return null;
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, '')); // "1.500.000"
    const n = Number(/,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
};
const brl = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).replace(/\s/g, ' ');
export function valores(reg) {
    if (!reg || typeof reg !== 'object' || Array.isArray(reg)) return {};
    let min = null, max = null, contra = null;
    for (const [k, v] of Object.entries(reg)) {
        const c = k.toLowerCase();
        if (/contrapartida/.test(c)) { if (/(perc|pct|percentual)/.test(c) && contra == null) contra = numero(v); continue; }
        if (!/(^|_)(vl|valor)(_|$)/.test(c)) continue;
        if (/(^|_)(min|minimo)(_|$)/.test(c)) { if (min == null) min = numero(v); }
        else if (/(^|_)(max|maximo)(_|$)/.test(c)) { if (max == null) max = numero(v); }
    }
    if (!(min > 0)) min = null;
    if (!(max > 0)) max = null;
    if (min && max && min > max) [min, max] = [max, min];
    const out = {};
    if (min) out.valorMin = min;
    if (max) out.valorMax = max;
    if (min && max) { out.tipoValor = 'faixa'; out.valorNota = `De ${brl(min)} a ${brl(max)} por proposta, segundo as regras do programa no Transferegov.br.`; }
    else if (max) { out.tipoValor = 'por-proposta'; out.valorNota = `Até ${brl(max)} por proposta, segundo as regras do programa no Transferegov.br.`; }
    else if (min) out.valorNota = `A partir de ${brl(min)} por proposta, segundo as regras do programa no Transferegov.br. Confira o teto no programa.`;
    if (contra != null && contra >= 0 && contra <= 100) out.contrapartida = `${String(contra).replace('.', ',')}% do valor (regra do programa no Transferegov.br)`;
    return out;
}
