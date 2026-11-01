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
export function abrangencia(nomePrograma, ufPrograma) {
    const m = limpa(nomePrograma).match(/\bsr\s*\(\s*([a-z]{2})\s*\)/i);
    const uf = m ? m[1].toUpperCase() : '';
    if (uf && SIGLAS.has(uf)) return { abrangencia: uf, ufs: [uf] };
    const cad = limpa(ufPrograma).toUpperCase();
    return { abrangencia: 'Nacional', abrangenciaNota: `Abrangência não informada pela API${/^[A-Z]{2}$/.test(cad) ? ` (o cadastro do programa indica ${cad})` : ''}: confira no programa quem pode propor.` };
}
