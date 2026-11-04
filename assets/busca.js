/* =====================================================================
   RADAR FOMENTO — BUSCA EM LINGUAGEM SIMPLES (sem IA externa, tudo local)
   interpretar("ong de cultura em sp até 200 mil") →
     { publico: 'osc', area: 'Cultura', uf: 'SP', valorMax: 200000, resto: '', entendidos: [...] }
   Tolerante a acentos, maiúsculas, plural/singular e erros leves de digitação
   (distância de edição pequena). O que não é entendido vira busca livre (resto).
   Funciona no navegador (window.RadarBusca) e no Node (module.exports), para testes.
===================================================================== */
(function (raiz) {
    'use strict';

    const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    // Plural → singular, aproximado (ações→acao, sociais→social, empresas→empresa, mulheres→mulher)
    const singular = t => (t.length < 4 ? t : t.replace(/oes$|aes$/, 'ao').replace(/ais$/, 'al').replace(/eis$/, 'el').replace(/(r|z)es$/, '$1').replace(/ens$/, 'em').replace(/s$/, ''));
    // Distância de edição (Levenshtein), com corte: devolve max+1 quando passa do limite
    function distancia(a, b, max = 2) {
        if (a === b) return 0;
        if (Math.abs(a.length - b.length) > max) return max + 1;
        let ant = Array.from({ length: b.length + 1 }, (_, j) => j);
        for (let i = 1; i <= a.length; i++) {
            const cur = [i];
            let menor = i;
            for (let j = 1; j <= b.length; j++) {
                cur[j] = Math.min(ant[j] + 1, cur[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
                if (cur[j] < menor) menor = cur[j];
            }
            if (menor > max) return max + 1;
            ant = cur;
        }
        return ant[b.length];
    }
    // Quanto erro aceitar: nenhum em palavras curtas (evita "minha" → "minas")
    const tolerancia = len => (len >= 9 ? 2 : len >= 6 ? 1 : 0);

    /* ---------- Dicionários ---------- */
    const UF_NOMES = {
        AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo',
        GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba',
        PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul',
        RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins'
    };
    const UF_EXTRAS = {
        minas: 'MG', bh: 'MG', 'belo horizonte': 'MG', salvador: 'BA', recife: 'PE', fortaleza: 'CE', belem: 'PA', manaus: 'AM',
        'porto alegre': 'RS', curitiba: 'PR', brasilia: 'DF', goiania: 'GO', florianopolis: 'SC', floripa: 'SC', vitoria: 'ES',
        natal: 'RN', 'joao pessoa': 'PB', maceio: 'AL', aracaju: 'SE', teresina: 'PI', 'sao luis': 'MA', cuiaba: 'MT',
        'campo grande': 'MS', 'porto velho': 'RO', 'rio branco': 'AC', 'boa vista': 'RR', macapa: 'AP', palmas: 'TO',
        'rio de janeiro': 'RJ', 'distrito federal': 'DF', gaucho: 'RS', capixaba: 'ES', paulista: 'SP', carioca: 'RJ', mineiro: 'MG', baiano: 'BA'
    };
    // Siglas que também são palavras comuns só valem em MAIÚSCULAS ou depois de "em/no/na/do/da/de"
    const SIGLAS_AMBIGUAS = new Set(['se', 'to', 'pe', 'ma', 'es', 'pa', 'am', 'al', 'ac', 'ap', 'go', 'ro', 'pi', 'ce', 'rr']);
    const PREP_LUGAR = new Set(['em', 'no', 'na', 'do', 'da', 'de', 'estado']);

    const PUBLICO_SIN = {
        osc: ['ong', 'osc', 'associacao', 'cooperativa', 'entidade', 'terceiro setor', 'sociedade civil', 'coletivo', 'fundacao', 'instituto social', 'organizacao social'],
        municipio: ['prefeitura', 'municipio', 'municipal', 'consorcio', 'consorcio publico'],
        pesquisador: ['pesquisador', 'pesquisadora', 'cientista', 'bolsista', 'mestrando', 'doutorando', 'pos-doc', 'posdoc', 'pos doutorado', 'professor pesquisador'],
        ict: ['universidade', 'faculdade', 'ict', 'instituto de pesquisa', 'instituto federal', 'centro de pesquisa', 'laboratorio'],
        empresa: ['empresa', 'startup', 'mei', 'microempresa', 'pme', 'microempreendedor', 'empreendedor', 'negocio', 'industria', 'empresa privada'],
        estado: ['governo do estado', 'governo estadual', 'secretaria estadual']
    };
    // Chaves iguais às de AREAS no index.html
    const AREA_SIN = {
        'Saúde': ['saude', 'sus', 'hospital', 'medicina', 'saude publica', 'enfermagem', 'saude mental', 'vacina'],
        'Cultura': ['cultura', 'cultural', 'arte', 'artes', 'artistico', 'audiovisual', 'cinema', 'filme', 'documentario', 'musica', 'teatro', 'danca', 'patrimonio', 'literatura', 'leitura', 'livro', 'economia criativa'],
        'Meio Ambiente': ['meio ambiente', 'ambiental', 'clima', 'climatico', 'mudanca climatica', 'amazonia', 'floresta', 'biodiversidade', 'sustentabilidade', 'sustentavel', 'reciclagem', 'cerrado', 'bioma', 'oceano'],
        'Educação': ['educacao', 'escola', 'ensino', 'educacional', 'alfabetizacao', 'professor', 'professores', 'aluno', 'estudante'],
        'Tecnologia': ['tecnologia', 'inovacao', 'digital', 'software', 'inteligencia artificial', 'ciencia', 'tecnologico', 'p&d', 'pd&i'],
        'Agronegocio': ['agro', 'agronegocio', 'agricultura', 'agricultura familiar', 'rural', 'alimento', 'seguranca alimentar', 'agropecuaria'],
        'Energia': ['energia', 'solar', 'renovavel', 'energia renovavel', 'eletrica', 'eolica'],
        'Infraestrutura': ['infraestrutura', 'obra', 'estrada', 'saneamento', 'pavimentacao', 'moradia', 'habitacao', 'mobilidade'],
        'Segurança': ['seguranca publica', 'policia', 'defesa', 'violencia'],
        'Desenvolvimento': ['social', 'desenvolvimento social', 'assistencia social', 'idoso', 'pessoa idosa', 'crianca', 'adolescente', 'juventude', 'jovem', 'mulher', 'direitos humanos', 'pobreza', 'inclusao', 'deficiencia']
    };
    const AREA_NOME = { 'Saúde': 'Saúde', 'Cultura': 'Cultura', 'Meio Ambiente': 'Meio ambiente', 'Educação': 'Educação', 'Tecnologia': 'Tecnologia e inovação', 'Agronegocio': 'Agronegócio', 'Energia': 'Energia', 'Infraestrutura': 'Infraestrutura', 'Segurança': 'Segurança', 'Desenvolvimento': 'Desenvolvimento social' };
    const PUBLICO_NOME = { pesquisador: 'Pesquisador(a)', ict: 'Universidade ou instituto', empresa: 'Empresa', osc: 'ONG/associação', municipio: 'Município', estado: 'Governo do estado' };
    // Temas sem área própria: viram busca livre (o texto do edital decide)
    const TEMA_LIVRE = { esporte: 'esporte', esportivo: 'esporte', futebol: 'esporte', paradesporto: 'esporte' };

    const PARADAS = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'para', 'pra', 'pro', 'por', 'com', 'e', 'a', 'o', 'as', 'os', 'um', 'uma',
        'que', 'edital', 'editais', 'chamada', 'chamadas', 'quero', 'preciso', 'procuro', 'busco', 'buscar', 'recurso', 'recursos', 'financiamento', 'minha', 'meu',
        'nossa', 'nosso', 'sou', 'somos', 'tenho', 'temos', 'eu', 'r$', 'reais', 'qual', 'quais', 'algum', 'alguma', 'ate', 'sobre', 'area', 'tema', 'projeto', 'projetos', 'apoio']);

    // Entradas de dicionário como sequências de tokens normalizados (frases mais longas primeiro)
    const entradas = [];
    const add = (k, v, frase, rotulo) => entradas.push({ k, v, toks: norm(frase).split(/\s+/).map(singular), rotulo });
    for (const [uf, nome] of Object.entries(UF_NOMES)) add('uf', uf, nome, `Estado: ${nome}`);
    for (const [frase, uf] of Object.entries(UF_EXTRAS)) add('uf', uf, frase, `Estado: ${UF_NOMES[uf]}`);
    for (const [k, lista] of Object.entries(PUBLICO_SIN)) for (const f of lista) add('publico', k, f, `Quem pede: ${PUBLICO_NOME[k]}`);
    for (const [k, lista] of Object.entries(AREA_SIN)) for (const f of lista) add('area', k, f, `Tema: ${AREA_NOME[k]}`);
    entradas.sort((a, b) => b.toks.length - a.toks.length);

    /* ---------- Números e valores ---------- */
    const UNIDADE = { mil: 1e3, k: 1e3, milhao: 1e6, milhoes: 1e6, mi: 1e6, mm: 1e6, bilhao: 1e9, bi: 1e9 };
    function numero(tok, prox) {
        const m = /^(\d+(?:[.,]\d+)*)(mil|k|mi|milhao|milhoes)?$/.exec(tok);
        if (!m) return null;
        let s = m[1];
        // "200.000" e "1.500.000" = milhares; "1,5" = decimal
        if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
        else s = s.replace(/\./g, '').replace(',', '.');
        let v = Number(s);
        if (!isFinite(v)) return null;
        let usou = 0;
        const u = m[2] || (prox && UNIDADE[prox] ? prox : null);
        if (u) { v *= UNIDADE[u]; if (!m[2]) usou = 1; }
        return { v, usou };
    }
    const fmtValor = v => (v >= 1e6 ? `R$ ${String(+(v / 1e6).toFixed(1)).replace('.', ',')} ${v >= 2e6 ? 'milhões' : 'milhão'}` : v >= 1e3 ? `R$ ${String(+(v / 1e3).toFixed(1)).replace('.', ',')} mil` : `R$ ${v}`);

    /* ---------- O intérprete ---------- */
    function interpretar(frase, opcoes = {}) {
        const original = String(frase || '').replace(/[“”"?!;]+/g, ' ').replace(/\s+/g, ' ').trim();
        const brutos = original ? original.split(' ') : [];
        const crus = brutos.map(t => t.replace(/^[(,.]+|[),.:]+$/g, ''));
        const n = crus.map(t => norm(t));
        const s = n.map(singular);
        const usado = new Array(n.length).fill(false);
        const r = { entendidos: [] };
        const marcar = (i, j) => { for (let x = i; x < j; x++) usado[x] = true; };
        const trecho = (i, j) => crus.slice(i, j).join(' ');
        const entender = (k, v, rotulo, i, j) => {
            if (r[k] !== undefined) { marcar(i, j); return; } // o primeiro vale; repetição é só consumida
            r[k] = v;
            r.entendidos.push({ k, v, rotulo, trecho: trecho(i, j), pos: i });
            marcar(i, j);
        };
        const livre = (i, j) => !usado.slice(i, j).some(Boolean);

        // 1. Valor: "até 200 mil", "no máximo R$ 50.000", "acima de 1 milhão", "a partir de 500k"
        for (let i = 0; i < n.length; i++) {
            if (usado[i]) continue;
            let tipo = null, k = i;
            const dois = `${n[i]} ${n[i + 1] || ''}`, tres = `${dois} ${n[i + 2] || ''}`;
            if (['ate', 'max', 'maximo', 'teto'].includes(n[i])) { tipo = 'valorMax'; k = i + 1; }
            else if (['no maximo', 'abaixo de', 'menos de', 'menor que'].includes(dois)) { tipo = 'valorMax'; k = i + 2; }
            else if (['acima de', 'mais de', 'minimo de', 'pelo menos', 'no minimo', 'maior que', 'partir de'].includes(dois)) { tipo = 'valor'; k = i + 2; }
            else if (tres === 'a partir de') { tipo = 'valor'; k = i + 3; }
            else if (['acima', 'minimo'].includes(n[i])) { tipo = 'valor'; k = i + 1; }
            if (!tipo) continue;
            if (n[k] === 'r$' || n[k] === 'rs') k++;
            const num = n[k] ? numero(n[k].replace(/^r\$/, ''), n[k + 1]) : null;
            if (!num) continue;
            const fim = k + 1 + num.usou;
            const temUnidade = num.usou || /\D$/.test(n[k]);
            if (num.v < 1000 && !temUnidade) continue; // "até 15 dias" não é valor
            entender(tipo, Math.round(num.v), `${tipo === 'valorMax' ? 'Até' : 'A partir de'} ${fmtValor(num.v)}`, i, fim);
        }

        // 2. Prazo e novidade: "fecha esta semana", "este mês", "nos próximos 15 dias", "novos", "abertos"
        for (let i = 0; i < n.length; i++) {
            if (usado[i]) continue;
            const ini = ['fecha', 'fecham', 'encerra', 'encerram', 'vence', 'vencem', 'termina', 'terminam', 'prazo'].includes(n[i]) ? 1 : 0;
            const a = n[i + ini], b = n[i + ini + 1];
            const novo = ['novo', 'novos', 'nova', 'novas', 'recente', 'recentes', 'abriu', 'abriram', 'lancado', 'lancados'].includes(n[i]);
            if (novo) {
                let fim = i + 1, dias = 7;
                if (['esta', 'essa', 'nesta', 'nessa'].includes(n[i + 1]) && n[i + 2] === 'semana') fim = i + 3;
                else if (['este', 'esse', 'neste', 'nesse'].includes(n[i + 1]) && ['mes', 'mês'].includes(n[i + 2])) { fim = i + 3; dias = 30; }
                entender('novos', String(dias), dias === 7 ? 'Novos esta semana' : 'Novos este mês', i, fim);
                continue;
            }
            if (['esta', 'essa', 'nesta', 'nessa'].includes(a) && b === 'semana') { entender('prazo', '7', 'Fecham em até 7 dias', i, i + ini + 2); continue; }
            if (['este', 'esse', 'neste', 'nesse'].includes(a) && b === 'mes') { entender('prazo', '30', 'Fecham em até 30 dias', i, i + ini + 2); continue; }
            if (a === 'hoje' && ini) { entender('prazo', '0', 'Fecham hoje', i, i + ini + 1); continue; }
            if (['proximos', 'em', 'ate'].includes(a) && /^\d{1,3}$/.test(b || '') && ['dia', 'dias'].includes(n[i + ini + 2])) {
                entender('prazo', String(Number(b)), `Fecham em até ${Number(b)} dias`, i, i + ini + 3); continue;
            }
            if (['urgente', 'urgentes'].includes(n[i])) { entender('prazo', '7', 'Fecham em até 7 dias', i, i + 1); continue; }
            if (['aberto', 'abertos', 'aberta', 'abertas'].includes(n[i]) || (n[i] === 'inscricoes' && ['aberta', 'abertas'].includes(n[i + 1]))) {
                entender('status', 'aberto', 'Abertos', i, n[i] === 'inscricoes' ? i + 2 : i + 1); continue;
            }
            if (n[i] === 'sem' && n[i + 1] === 'contrapartida') { entender('contra', '1', 'Sem contrapartida', i, i + 2); continue; }
            if (['meu', 'minha', 'nosso'].includes(n[i]) && ['estado', 'uf', 'regiao'].includes(n[i + 1]) && opcoes.ufPerfil) {
                entender('uf', opcoes.ufPerfil, `Estado: ${UF_NOMES[opcoes.ufPerfil] || opcoes.ufPerfil}`, i, i + 2);
            }
        }

        // 3. Dicionário (quem pede, Estado, tema): frases exatas primeiro, depois com tolerância a erro
        for (const tolerar of [false, true]) {
            for (const ent of entradas) {
                const L = ent.toks.length;
                for (let i = 0; i + L <= s.length; i++) {
                    if (!livre(i, i + L)) continue;
                    const junto = ent.toks.join(' ');
                    const ok = (tolerar && L > 1)
                        ? distancia(s.slice(i, i + L).join(' '), junto, tolerancia(junto.length)) <= tolerancia(junto.length)
                        : ent.toks.every((t, x) => {
                        const tok = s[i + x];
                        if (tok === t) return true;
                        if (!tolerar) return false;
                        return distancia(tok, t, tolerancia(t.length)) <= tolerancia(t.length);
                    });
                    if (!ok) continue;
                    // "Pará" só com acento ou depois de "no/do/estado do" (senão é a preposição "para")
                    if (ent.k === 'uf' && ent.v === 'PA' && L === 1 && n[i] === 'para' && !/á/i.test(crus[i]) && !['no', 'do'].includes(n[i - 1])) continue;
                    if (r[ent.k] !== undefined && r[ent.k] !== ent.v) continue;
                    entender(ent.k, ent.v, ent.rotulo, i, i + L);
                }
            }
        }

        // 4. Siglas de Estado ("sp", "BA", "em se")
        for (let i = 0; i < n.length; i++) {
            if (usado[i] || r.uf) continue;
            const sig = n[i].toUpperCase();
            if (!UF_NOMES[sig] || n[i].length !== 2) continue;
            const maiuscula = crus[i] === sig;
            if (SIGLAS_AMBIGUAS.has(n[i]) && !maiuscula && !PREP_LUGAR.has(n[i - 1])) continue;
            entender('uf', sig, `Estado: ${UF_NOMES[sig]}`, i, i + 1);
        }

        // 5. Temas sem área própria viram busca livre normalizada (ex.: "esportes" → "esporte")
        const resto = [];
        for (let i = 0; i < n.length; i++) {
            if (usado[i]) continue;
            if (TEMA_LIVRE[s[i]] || TEMA_LIVRE[n[i]]) { resto.push(TEMA_LIVRE[s[i]] || TEMA_LIVRE[n[i]]); continue; }
            if (PARADAS.has(n[i]) || !n[i]) continue;
            resto.push(crus[i]);
        }
        r.resto = resto.join(' ');
        r.entendidos.sort((a, b) => a.pos - b.pos); // na ordem da frase
        return r;
    }

    // Sugestões de filtro para o que a pessoa está digitando (última palavra ou frase parcial)
    function sugerirFiltros(texto, max = 4) {
        const t = norm(texto).trim();
        if (t.length < 2) return [];
        const ultimo = t.split(/\s+/).pop();
        const vistos = new Set(), out = [];
        for (const ent of entradas.slice().sort((a, b) => a.toks.join(' ').length - b.toks.join(' ').length)) {
            const frase = ent.toks.join(' ');
            const casa = frase.startsWith(t) || (ultimo.length >= 2 && ent.toks.some(x => x.startsWith(ultimo)));
            if (!casa) continue;
            const chave = ent.k + ':' + ent.v;
            if (vistos.has(chave)) continue;
            vistos.add(chave);
            out.push({ k: ent.k, v: ent.v, rotulo: ent.rotulo });
            if (out.length >= max) break;
        }
        return out;
    }

    const api = { interpretar, sugerirFiltros, norm, singular, distancia, UF_NOMES, AREA_NOME, PUBLICO_NOME, fmtValor };
    if (typeof module === 'object' && module.exports) module.exports = api;
    else raiz.RadarBusca = api;
})(typeof window !== 'undefined' ? window : globalThis);
