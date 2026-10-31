/* =====================================================================
   FUNDOS BRASIL — FERRAMENTAS DO CAPTADOR
   Carregado com <script defer> depois do script principal do index.html
   (script clássico): usa as funções e o estado globais de lá — editais,
   propostas, store, ETAPAS, statusEdital, openEdital, renderPropostas…

   1. Assinar alertas (calendário assinado e RSS do recorte atual)
   2. Buscas salvas com contagem de novidades
   3. Quadro (kanban) em Minhas propostas
   4. Go/no-go por proposta
   5. Cofre de certidões e documentos (com aviso de vencimento x prazo)
   6. Teste de elegibilidade no detalhe do edital
   7. Backup (JSON) e exportação do quadro (CSV)

   Tudo fica no localStorage deste navegador, em chaves com prefixo "fb:".
   Nenhum dado digitado ou importado vai para innerHTML sem passar por esc().
===================================================================== */
(function () {
    'use strict';

    // O script principal precisa ter rodado (ele define as funções abaixo)
    if (typeof editais === 'undefined' || typeof store === 'undefined' || typeof openEdital !== 'function') return;

    /* ---------------------------------------------------------------------
       BASE: armazenamento, datas e ícones
    --------------------------------------------------------------------- */
    const K = {
        buscas: 'fb:buscas',
        gonogo: 'fb:gonogo',
        cofre: 'fb:cofre',
        elegib: 'fb:elegibilidade',
        vista: 'fb:propostasVista'
    };
    const objeto = v => v && typeof v === 'object' && !Array.isArray(v);
    const ler = (k, padrao) => { const v = store.get(k, padrao); return v === null || v === undefined ? padrao : v; };

    let buscas = ler(K.buscas, []);
    let gonogo = ler(K.gonogo, {});
    let cofre = ler(K.cofre, []);
    let elegib = ler(K.elegib, {});
    let vista = ler(K.vista, 'lista') === 'quadro' ? 'quadro' : 'lista';
    // Dados corrompidos (ou de outra versão) não podem quebrar a página
    if (!Array.isArray(buscas)) buscas = [];
    if (!objeto(gonogo)) gonogo = {};
    if (!Array.isArray(cofre)) cofre = [];
    if (!objeto(elegib)) elegib = {};

    const salvarBuscas = () => store.set(K.buscas, buscas);
    const salvarGonogo = () => store.set(K.gonogo, gonogo);
    const salvarCofre = () => store.set(K.cofre, cofre);
    const salvarElegib = () => store.set(K.elegib, elegib);

    const hojeISO = () => isoDe(HOJE);
    const isoValido = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && isoDe(parseDate(s)) === s;
    const somaDias = (iso, n) => { const d = parseDate(iso); d.setDate(d.getDate() + n); return isoDe(d); };
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const seguro = fn => { try { fn(); } catch (_) { /* uma ferramenta auxiliar nunca derruba a página */ } };

    // Ícones SVG de traço (decorativos: o texto do botão já diz o que fazem)
    const svg = d => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${d}</svg>`;
    const ICONE = {
        sino: svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
        marcador: svg('<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>'),
        cadeado: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
        alerta: svg('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
        baixar: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>'),
        subir: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>')
    };

    /* ---------------------------------------------------------------------
       1. ASSINAR ALERTAS — calendário assinado (webcal) e RSS do recorte atual
       Os arquivos cal/*.ics e feeds/*.xml são gerados na publicação do site.
    --------------------------------------------------------------------- */

    // Pasta onde está o index.html, como URL absoluta (funciona no GitHub Pages e localmente)
    function baseSite() {
        if (/^https?:$/.test(location.protocol)) return location.origin + location.pathname.replace(/[^/]*$/, '');
        const can = document.querySelector('link[rel="canonical"]');
        return can ? can.href.replace(/[^/]*$/, '') : '';
    }

    // Mesma regra de slugify() em scripts/gerar-paginas.mjs (páginas area/<slug>/)
    function slugify(s) {
        const b = norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        if (b.length <= 70) return b;
        const c = b.slice(0, 71);
        return c.slice(0, c.lastIndexOf('-'));
    }

    // Público escolhido → publico-*, senão área → area-*, senão todos
    function recorteDe(f) {
        if (f.publico && PUBLICOS[f.publico]) return { chave: `publico-${f.publico}`, nome: PUBLICOS[f.publico], usa: 'publico' };
        if (f.area && AREAS[f.area]) return { chave: `area-${slugify(AREAS[f.area])}`, nome: AREAS[f.area], usa: 'area' };
        return { chave: 'todos', nome: 'todos os editais', usa: '' };
    }

    function linksAssinatura(f) {
        const base = baseSite();
        const r = recorteDe(f);
        const ics = `${base}cal/${r.chave}.ics`;
        const webcal = ics.replace(/^https?:/, 'webcal:');
        return {
            recorte: r,
            ics,
            webcal,
            google: 'https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(webcal),
            rss: `${base}feeds/${r.chave}.xml`,
            alteracoes: `${base}feeds/alteracoes.xml`
        };
    }

    // Filtros da tela que o calendário não consegue reproduzir (ele é por público, área ou tudo)
    function filtrosIgnorados(f, usa) {
        const nomes = { q: 'busca por palavra', status: 'situação', publico: 'quem vai propor', area: 'área', modalidade: 'tipo de apoio', formato: 'formato', procedencia: 'procedência', uf: 'estado', valor: 'valor', prazo: 'prazo', fav: 'favoritos', rec: 'compatíveis' };
        return Object.keys(nomes).filter(k => f[k] && k !== usa).map(k => nomes[k]);
    }

    function painelAssinarHTML(f) {
        const l = linksAssinatura(f);
        const ignorados = filtrosIgnorados(f, l.recorte.usa);
        return `
            <h2 class="cap-painel-titulo" id="capAssinarTitulo">Receber os prazos de <strong>${esc(l.recorte.nome)}</strong></h2>
            <p>Assine uma vez: os prazos aparecem e se atualizam sozinhos no seu calendário, inclusive quando um edital novo entra ou um prazo é prorrogado.</p>
            <div class="cap-links">
                <a class="btn btn-primary btn-small" href="${esc(l.google)}" target="_blank" rel="noopener noreferrer" data-track="assinar-google">Adicionar ao Google Agenda<span class="sr-only"> (abre em nova aba)</span></a>
                <a class="btn btn-outline btn-small" href="${esc(l.webcal)}" data-track="assinar-webcal">Outlook ou Apple Calendário</a>
                <button type="button" class="btn btn-outline btn-small" data-cap="copiar-cal">Copiar link do calendário</button>
                <a class="btn btn-outline btn-small" href="${esc(l.rss)}" target="_blank" rel="noopener" data-track="assinar-rss">RSS<span class="sr-only"> (abre em nova aba)</span></a>
            </div>
            <div class="form-group cap-link-cal">
                <label for="capLinkCal">Link do calendário (para colar em “Adicionar calendário → Da internet”)</label>
                <input id="capLinkCal" type="text" readonly value="${esc(l.ics)}">
            </div>
            ${ignorados.length ? `<p class="nota">O calendário traz todos os prazos de ${esc(l.recorte.nome)}; ${esc(ignorados.join(', '))} ${ignorados.length === 1 ? 'não entra' : 'não entram'} na assinatura.</p>` : ''}
            <p class="nota">Quer saber de retificações e prorrogações? Assine também o <a href="${esc(l.alteracoes)}" target="_blank" rel="noopener">RSS de alterações<span class="sr-only"> (abre em nova aba)</span></a>.</p>`;
    }

    async function copiarLinkCalendario() {
        const campo = document.getElementById('capLinkCal');
        if (!campo) return;
        try {
            await navigator.clipboard.writeText(campo.value);
            showNotification('Link do calendário copiado.');
        } catch (_) {
            // Sem acesso à área de transferência: seleciona o texto para a pessoa copiar
            campo.focus();
            campo.select();
            showNotification('Link selecionado: pressione Ctrl+C (ou Cmd+C) para copiar.', 'warning');
        }
    }

    /* ---------------------------------------------------------------------
       2. BUSCAS SALVAS — guarda os parâmetros da URL de #editais
       Item: { id, nome, qs, criadoEm, ultimaVisita (AAAA-MM-DD), vistos: [ids] }
    --------------------------------------------------------------------- */
    const MAX_BUSCAS = 30;
    const PARAMS_EXTRAS = ['fav', 'rec', 'view'];

    // Mesma regra de syncUrl() do index.html
    function paramsDeFiltros(f) {
        const p = new URLSearchParams();
        for (const k of Object.keys(FILTER_FIELDS)) if (f[k] && !(k === 'ordem' && (f[k] === 'prazo' || f[k] === 'compat'))) p.set(k, f[k]);
        if (f.fav) p.set('fav', '1');
        if (f.rec) p.set('rec', '1');
        return p;
    }

    // Só parâmetros conhecidos e curtos (também usado para limpar buscas importadas)
    function limparQs(qs) {
        const p = new URLSearchParams(String(qs || '').replace(/^#?editais\??/, ''));
        const out = new URLSearchParams();
        for (const [k, v] of p) if ((Object.hasOwn(FILTER_FIELDS, k) || PARAMS_EXTRAS.includes(k)) && v && v.length <= 200 && !out.has(k)) out.set(k, v);
        return out.toString();
    }

    // Identidade da busca: filtros, sem ordem nem modo de visualização
    function chaveBusca(qs) {
        const p = new URLSearchParams(qs);
        p.delete('ordem');
        p.delete('view');
        return [...p.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}=${v}`).join('&');
    }

    function filtrosDeQs(qs) {
        const p = new URLSearchParams(qs);
        const f = {};
        for (const k of Object.keys(FILTER_FIELDS)) f[k] = p.get(k) || '';
        f.ordem = f.ordem || 'prazo';
        f.fav = p.get('fav') === '1';
        f.rec = p.get('rec') === '1' && perfilAtivo();
        return f;
    }

    function resultadosDe(b) {
        try { return aplicarFiltros(filtrosDeQs(b.qs)); } catch (_) { return []; }
    }

    // Novos = publicados depois da última visita (no mesmo dia, os que ainda não estavam na lista)
    function novosDe(b) {
        const vistos = new Set(b.vistos || []);
        return resultadosDe(b).filter(e => e.publicadoEm && (e.publicadoEm > b.ultimaVisita || (e.publicadoEm === b.ultimaVisita && !vistos.has(e.id))));
    }

    function marcarVisita(b) {
        b.ultimaVisita = hojeISO();
        b.vistos = resultadosDe(b).map(e => e.id).slice(0, 1000);
    }

    function nomeSugerido(f) {
        const partes = [];
        if (f.q) partes.push(`“${f.q}”`);
        if (f.publico && PUBLICOS[f.publico]) partes.push(PUBLICOS[f.publico]);
        if (f.area && AREAS[f.area]) partes.push(AREAS[f.area]);
        if (f.modalidade) { const t = TIPOS_APOIO[tipoDoFiltro(f.modalidade)]; if (t) partes.push(t.nome); }
        if (f.status) { const st = { aberto: 'Abertos', 'em-breve': 'Em breve', fechado: 'Encerrados' }[f.status]; if (st) partes.push(st); }
        if (f.uf && UFS[f.uf]) partes.push(UFS[f.uf]);
        if (f.procedencia) partes.push(f.procedencia === 'internacional' ? 'Internacionais' : 'Nacionais');
        if (f.formato) partes.push(f.formato === 'pre-proposta' ? 'Com pré-proposta' : 'Proposta direta');
        if (f.valor) partes.push(`A partir de ${fmtValor(Number(f.valor), 'BRL')}`);
        if (f.prazo) partes.push(`Encerram em ${f.prazo} dias`);
        if (f.fav) partes.push('Favoritos');
        if (f.rec) partes.push('Compatíveis');
        return (partes.join(' · ') || 'Todos os editais').slice(0, 80);
    }

    function buscaAtual() {
        const f = getFiltros();
        const qs = paramsDeFiltros(f).toString();
        return { f, qs, chave: chaveBusca(qs) };
    }

    function salvarBuscaAtual(nome) {
        const { qs, chave } = buscaAtual();
        const existente = buscas.find(b => chaveBusca(b.qs) === chave);
        if (existente) {
            showNotification(`Esta busca já está salva como “${existente.nome}”.`, 'warning');
            return 'repetida';
        }
        if (buscas.length >= MAX_BUSCAS) {
            showNotification(`Limite de ${MAX_BUSCAS} buscas salvas. Exclua alguma para salvar outra.`, 'warning');
            return false;
        }
        const b = { id: uid(), nome: nome.slice(0, 80), qs, criadoEm: new Date().toISOString() };
        marcarVisita(b);
        buscas.push(b);
        salvarBuscas();
        track('busca-salva');
        showNotification(`Busca “${b.nome}” salva. Ela aparece em Minhas buscas, aqui e no início.`);
        return true;
    }

    function abrirBusca(id) {
        const b = buscas.find(x => x.id === id);
        if (!b) return;
        marcarVisita(b);
        salvarBuscas();
        const destino = `#editais${b.qs ? '?' + b.qs : ''}`;
        if (location.hash === destino) route(); else location.hash = destino;
    }

    function excluirBusca(id) {
        const i = buscas.findIndex(x => x.id === id);
        if (i < 0) return;
        const [removida] = buscas.splice(i, 1);
        salvarBuscas();
        renderBuscas();
        showNotification(`Busca “${removida.nome}” excluída.`, 'success', {
            label: 'Desfazer', fn: () => { buscas.splice(i, 0, removida); salvarBuscas(); renderBuscas(); }
        });
        const resto = document.querySelector('.page-content.active [data-cap="abrir-busca"]') || document.getElementById('capSalvarBtn');
        if (resto) resto.focus();
    }

    function itemBuscaHTML(b, onde, ativa) {
        const n = novosDe(b).length;
        const total = resultadosDe(b).length;
        const href = `#editais${b.qs ? '?' + b.qs : ''}`;
        return `
            <li class="cap-busca" data-busca="${esc(b.id)}">
                <div class="cap-busca-info">
                    <a class="cap-busca-nome" href="${esc(href)}" data-cap="abrir-busca" data-id="${esc(b.id)}"${ativa ? ' aria-current="true"' : ''}>${esc(b.nome)}</a>
                    ${n ? `<span class="cap-novos">${plural(n, 'novo', 'novos')} desde a última visita</span>` : ''}
                    <span class="nota">${plural(total, 'edital', 'editais')}${ativa ? ' · aberta agora' : ` · ${n ? '' : 'nada novo · '}vista em ${fmtDate(b.ultimaVisita)}`}</span>
                </div>
                <div class="cap-busca-acoes">
                    <button type="button" class="btn btn-ghost btn-small" data-cap="renomear-busca" data-id="${esc(b.id)}" data-onde="${onde}" aria-label="Renomear a busca ${esc(b.nome)}">Renomear</button>
                    <button type="button" class="btn btn-ghost btn-small" data-cap="excluir-busca" data-id="${esc(b.id)}" aria-label="Excluir a busca ${esc(b.nome)}">Excluir</button>
                </div>
            </li>`;
    }

    function renderBuscas() {
        const naPagina = paginaAtual() === 'editais' && location.hash.startsWith('#editais');
        const chaveAtiva = naPagina ? buscaAtual().chave : null;

        // Topo da barra de filtros de #editais (só quando há buscas; o painel "Salvar esta busca" explica o recurso)
        const lado = document.getElementById('capBuscasEditais');
        if (lado) {
            lado.innerHTML = buscas.length ? `
                <section class="cap-buscas-lado" aria-labelledby="capBuscasLadoTitulo">
                    <h2 class="cap-subtitulo" id="capBuscasLadoTitulo">Minhas buscas</h2>
                    <ul class="cap-buscas">${buscas.map(b => itemBuscaHTML(b, 'lado', chaveBusca(b.qs) === chaveAtiva)).join('')}</ul>
                </section>` : '';
        }

        // Início: só aparece quando há buscas salvas
        const home = document.getElementById('capBuscasHome');
        if (home) {
            home.hidden = !buscas.length;
            home.innerHTML = buscas.length ? `
                <h2 class="card-title" id="capBuscasHomeTitulo"><span>Minhas buscas</span><a class="btn btn-outline btn-small" href="#editais">Nova busca</a></h2>
                <ul class="cap-buscas">${buscas.map(b => itemBuscaHTML(b, 'home', false)).join('')}</ul>` : '';
        }
    }

    function editarNomeBusca(id, onde) {
        const b = buscas.find(x => x.id === id);
        const li = document.querySelector(`${onde === 'home' ? '#capBuscasHome' : '#capBuscasEditais'} [data-busca="${CSS.escape(id)}"]`);
        if (!b || !li) return;
        li.innerHTML = `
            <form class="cap-renomear" data-cap-form="renomear" data-id="${esc(b.id)}">
                <label for="capRenomear-${esc(b.id)}" class="sr-only">Novo nome da busca ${esc(b.nome)}</label>
                <input id="capRenomear-${esc(b.id)}" type="text" maxlength="80" required value="${esc(b.nome)}">
                <button type="submit" class="btn btn-primary btn-small">Salvar</button>
                <button type="button" class="btn btn-ghost btn-small" data-cap="cancelar-renomear">Cancelar</button>
            </form>`;
        const campo = li.querySelector('input');
        campo.focus();
        campo.select();
    }

    // A mesma busca aparece no início e em #editais: foca a cópia da página visível
    function focarAcaoBusca(id, acao) {
        const sel = `[data-cap="${acao}"][data-id="${CSS.escape(id)}"]`;
        const el = document.querySelector(`.page-content.active ${sel}`) || document.querySelector(sel);
        if (el) el.focus();
    }

    // Barra de ações acima dos resultados: Assinar alertas | Salvar esta busca
    function montarAcoesBusca() {
        const alvo = document.getElementById('capAcoesBusca');
        if (!alvo || alvo.dataset.montado) return;
        alvo.dataset.montado = '1';
        alvo.innerHTML = `
            <div class="cap-acoes-busca">
                <button type="button" class="btn btn-outline btn-small" id="capAssinarBtn" aria-expanded="false" aria-controls="capAssinarPainel">${ICONE.sino} Assinar alertas</button>
                <button type="button" class="btn btn-outline btn-small" id="capSalvarBtn" aria-expanded="false" aria-controls="capSalvarPainel">${ICONE.marcador} Salvar esta busca</button>
            </div>
            <div class="cap-painel" id="capAssinarPainel" role="region" aria-labelledby="capAssinarTitulo" hidden></div>
            <div class="cap-painel" id="capSalvarPainel" role="region" aria-labelledby="capSalvarTitulo" hidden>
                <form id="capSalvarForm" novalidate>
                    <h2 class="cap-painel-titulo" id="capSalvarTitulo">Salvar esta busca</h2>
                    <div class="form-group">
                        <label for="capBuscaNome">Nome da busca</label>
                        <input id="capBuscaNome" type="text" maxlength="80" required aria-describedby="capBuscaNomeAjuda">
                        <small id="capBuscaNomeAjuda">Guardamos os filtros atuais neste navegador. Em Minhas buscas você vê quantos editais novos apareceram desde a última vez que abriu cada uma.</small>
                    </div>
                    <div class="cap-links">
                        <button type="submit" class="btn btn-primary btn-small">Salvar busca</button>
                        <button type="button" class="btn btn-ghost btn-small" data-cap="fechar-salvar">Cancelar</button>
                    </div>
                </form>
            </div>`;
    }

    function alternarPainel(botaoId, painelId, abrir) {
        const btn = document.getElementById(botaoId), painel = document.getElementById(painelId);
        if (!btn || !painel) return;
        const aberto = abrir === undefined ? painel.hidden : abrir;
        painel.hidden = !aberto;
        btn.setAttribute('aria-expanded', String(aberto));
        return aberto;
    }

    // Chamado sempre que os filtros mudam (via syncUrl)
    function atualizarFerramentasBusca(f) {
        montarAcoesBusca();
        const painel = document.getElementById('capAssinarPainel');
        if (painel && !painel.contains(document.activeElement)) painel.innerHTML = painelAssinarHTML(f);
        // Abrir a URL de uma busca salva conta como visita
        if (paginaAtual() === 'editais' && location.hash.startsWith('#editais')) {
            const chave = chaveBusca(paramsDeFiltros(f).toString());
            const b = buscas.find(x => chaveBusca(x.qs) === chave);
            if (b) { marcarVisita(b); salvarBuscas(); }
        }
        renderBuscas();
    }

    /* ---------------------------------------------------------------------
       4. GO/NO-GO — pontuação rápida por proposta (1 a 5 em cada critério)
       Item: gonogo[idEdital] = { notas: { aderencia: 1..5, … }, justificativa, atualizadoEm }
    --------------------------------------------------------------------- */
    const CRITERIOS_GNG = [
        { k: 'aderencia', nome: 'Aderência ao edital', ajuda: 'O projeto responde ao objetivo, às linhas e ao público do edital?' },
        { k: 'chance', nome: 'Chance de sucesso', ajuda: 'Competitividade, histórico da equipe, concorrência esperada.' },
        { k: 'valor', nome: 'Valor vs. esforço', ajuda: 'O recurso compensa o trabalho de escrever, executar e prestar contas?' },
        { k: 'prazo', nome: 'Prazo viável', ajuda: 'Dá tempo de preparar uma proposta de qualidade até o prazo?' },
        { k: 'equipe', nome: 'Equipe e documentos prontos', ajuda: 'Pessoas, parcerias, certidões e contrapartida disponíveis.' }
    ];
    const GNG = {
        seguir: { nome: 'Seguir', cls: 'badge-aberto', txt: 'Boa aderência e condições para competir. Vale investir na proposta.' },
        avaliar: { nome: 'Avaliar', cls: 'badge-em-breve', txt: 'Há pontos fracos. Converse com a equipe e veja se dá para resolvê-los antes de investir tempo.' },
        'nao-seguir': { nome: 'Não seguir', cls: 'badge-urgente', txt: 'Algum critério está crítico (nota 1) ou a soma é baixa. Guarde para uma próxima chamada.' }
    };
    const gngAbertos = new Set(); // quais avaliações estão expandidas (sobrevive a re-renderizações)

    // Regra: nota 1 em qualquer critério ou soma < 13 → Não seguir; soma ≥ 19 sem nota < 3 → Seguir; resto → Avaliar
    function resultadoGNG(g) {
        const notas = CRITERIOS_GNG.map(c => (g && g.notas ? g.notas[c.k] : null)).filter(n => Number.isInteger(n));
        const total = notas.reduce((s, n) => s + n, 0);
        if (notas.length < CRITERIOS_GNG.length) return { k: null, total, faltam: CRITERIOS_GNG.length - notas.length };
        const k = notas.some(n => n === 1) || total < 13 ? 'nao-seguir' : total >= 19 && notas.every(n => n >= 3) ? 'seguir' : 'avaliar';
        return { k, total, faltam: 0 };
    }

    function seloGNG(id) {
        const r = resultadoGNG(gonogo[id]);
        if (!r.k) return r.faltam < CRITERIOS_GNG.length ? `<span class="badge badge-neutral">Go/no-go: faltam ${r.faltam}</span>` : '';
        return `<span class="badge ${GNG[r.k].cls}">${GNG[r.k].nome} · ${r.total}/25</span>`;
    }

    function resultadoGNGHTML(id) {
        const r = resultadoGNG(gonogo[id]);
        if (!r.k) return `<p class="nota">Dê uma nota a ${r.faltam === CRITERIOS_GNG.length ? 'cada um dos 5 critérios' : `mais ${plural(r.faltam, 'critério', 'critérios')}`} para ver a recomendação.</p>`;
        return `<p><span class="badge ${GNG[r.k].cls}">${GNG[r.k].nome}</span> <strong>${r.total} de 25 pontos.</strong> ${esc(GNG[r.k].txt)}</p>`;
    }

    function gngHTML(id) {
        const g = gonogo[id] || {};
        const notas = g.notas || {};
        return `
            <details class="cap-gng" data-gng="${id}"${gngAbertos.has(id) ? ' open' : ''}>
                <summary><span class="cap-gng-pergunta">Vale a pena seguir? (go/no-go)</span> <span class="cap-gng-selo">${seloGNG(id)}</span></summary>
                <div class="cap-gng-corpo">
                    <p class="nota">Dê de 1 (muito fraco) a 5 (muito forte) em cada critério. Fica salvo neste navegador.</p>
                    ${CRITERIOS_GNG.map(c => `
                        <fieldset class="cap-escala">
                            <legend><span class="cap-escala-nome">${c.nome}</span> <span class="nota">${c.ajuda}</span></legend>
                            <div class="cap-escala-opcoes">
                                ${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="gng-${id}-${c.k}" value="${n}" data-cap-gng="nota" data-id="${id}" data-k="${c.k}"${notas[c.k] === n ? ' checked' : ''}><span>${n}</span></label>`).join('')}
                            </div>
                        </fieldset>`).join('')}
                    <div class="cap-gng-resultado" aria-live="polite">${resultadoGNGHTML(id)}</div>
                    <div class="form-group">
                        <label for="gngJust-${id}">Justificativa curta</label>
                        <textarea id="gngJust-${id}" maxlength="280" rows="2" data-cap-gng="just" data-id="${id}" aria-describedby="gngJustAjuda-${id}" placeholder="Ex.: linha 2 é exatamente nosso projeto; falta parceiro internacional.">${esc(g.justificativa || '')}</textarea>
                        <small id="gngJustAjuda-${id}">Até 280 caracteres. A regra: nota 1 em algum critério ou soma abaixo de 13 = não seguir; soma de 19 ou mais, sem nota abaixo de 3 = seguir.</small>
                    </div>
                </div>
            </details>`;
    }

    function atualizarGNGNaTela(id) {
        document.querySelectorAll(`[data-gng="${id}"]`).forEach(d => {
            const selo = d.querySelector('.cap-gng-selo'); if (selo) selo.innerHTML = seloGNG(id);
            const res = d.querySelector('.cap-gng-resultado'); if (res) res.innerHTML = resultadoGNGHTML(id);
        });
        document.querySelectorAll(`.cap-cartao[data-id="${id}"] .cap-cartao-gng`).forEach(el => { el.innerHTML = seloGNGCartao(id); });
    }

    const salvarGonogoDebounced = debounce(salvarGonogo, 400);

    /* ---------------------------------------------------------------------
       5. COFRE DE CERTIDÕES E DOCUMENTOS — só metadados, neste navegador
       Item: { id, tipo, descricao, emissao, validade, atualizadoEm }
    --------------------------------------------------------------------- */
    const TIPOS_DOC = {
        'cnd-federal': { nome: 'CND federal conjunta (RFB/PGFN)', dias: 180 },
        'crf-fgts': { nome: 'CRF – regularidade do FGTS', dias: 30 },
        cndt: { nome: 'CNDT – débitos trabalhistas', dias: 180 },
        estadual: { nome: 'Certidão estadual', dias: null },
        municipal: { nome: 'Certidão municipal', dias: null },
        cauc: { nome: 'CAUC (transferências da União)', dias: null },
        estatuto: { nome: 'Estatuto / ata de eleição', dias: null },
        outro: { nome: 'Outro documento', dias: null }
    };
    let cofreEditando = null; // id do documento em edição no formulário
    let validadeAuto = true;  // a validade foi sugerida (e pode ser recalculada)?

    const nomeDoc = d => (d.descricao ? `${TIPOS_DOC[d.tipo].nome} – ${d.descricao}` : TIPOS_DOC[d.tipo].nome);

    function situacaoDoc(d) {
        if (!d.validade) return { k: 'sem', cls: 'badge-neutral', txt: 'Sem validade informada' };
        const n = diasAte(d.validade);
        if (n < 0) return { k: 'vencida', cls: 'badge-urgente', txt: `Vencida há ${plural(-n, 'dia', 'dias')}` };
        if (n === 0) return { k: 'vence', cls: 'badge-urgente', txt: 'Vence hoje' };
        if (n <= 30) return { k: 'vence', cls: 'badge-em-breve', txt: `Vence em ${plural(n, 'dia', 'dias')}` };
        return { k: 'valida', cls: 'badge-aberto', txt: `Válida · vence em ${plural(n, 'dia', 'dias')}` };
    }

    // Propostas ainda a submeter (edital não encerrado) cujo prazo cai depois da validade de alguma certidão
    function conflitosCertidoes() {
        const docs = cofre.filter(d => d.validade && TIPOS_DOC[d.tipo]);
        if (!docs.length) return [];
        const ativos = itensPropostas().filter(x => ['interesse', 'preparando'].includes(x.p.etapa) && statusEdital(x.e) !== 'fechado');
        const out = [];
        for (const { e } of ativos) for (const d of docs) if (d.validade < e.encerramento) out.push({ e, d });
        return out;
    }

    function conflitoTxt({ e, d }) {
        const quando = diasAte(d.validade) < 0 ? `venceu em ${fmtDate(d.validade)}` : `vence em ${fmtDate(d.validade)}`;
        return `${nomeDoc(d)} ${quando}, antes do prazo de “${e.titulo}” (${fmtDate(e.encerramento)}).`;
    }

    function cofreHTML() {
        const conflitos = conflitosCertidoes();
        const ordenados = [...cofre].filter(d => TIPOS_DOC[d.tipo]).sort((a, b) => (a.validade || '9999').localeCompare(b.validade || '9999'));
        const ed = cofreEditando ? cofre.find(d => d.id === cofreEditando) : null;
        return `
            <section class="card cap-cofre" aria-labelledby="capCofreTitulo">
                <h2 class="card-title" id="capCofreTitulo" tabindex="-1">Cofre de certidões e documentos</h2>
                <p class="cap-privacidade">${ICONE.cadeado}<span><strong>Nada sai do seu navegador.</strong> Guardamos só o tipo e as datas de cada documento, neste dispositivo. Os arquivos continuam com você.</span></p>
                ${conflitos.length ? `
                    <div class="cap-alerta" role="note">
                        <p><strong>${ICONE.alerta} ${plural(conflitos.length, 'certidão vence', 'certidões vencem')} antes do prazo de editais que você acompanha</strong></p>
                        <ul>${conflitos.map(c => `<li>${esc(conflitoTxt(c))}</li>`).join('')}</ul>
                        <p class="nota">Emita uma nova via perto da submissão. Algumas instituições também pedem certidões válidas na assinatura do termo.</p>
                    </div>` : ''}
                ${ordenados.length ? `
                    <ul class="cap-docs">
                        ${ordenados.map(d => {
                            const s = situacaoDoc(d);
                            return `<li class="cap-doc">
                                <div class="cap-doc-nome"><strong>${esc(nomeDoc(d))}</strong>
                                    <span class="nota">${d.emissao ? `Emitida em ${fmtDate(d.emissao)}` : 'Emissão não informada'}${d.validade ? ` · validade ${fmtDate(d.validade)}` : ''}</span></div>
                                <span class="badge ${s.cls}">${s.txt}</span>
                                <div class="cap-doc-acoes">
                                    <button type="button" class="btn btn-ghost btn-small" data-cap="editar-doc" data-id="${esc(d.id)}" aria-label="Editar ${esc(nomeDoc(d))}">Editar</button>
                                    <button type="button" class="btn btn-ghost btn-small" data-cap="excluir-doc" data-id="${esc(d.id)}" aria-label="Excluir ${esc(nomeDoc(d))}">Excluir</button>
                                </div>
                            </li>`;
                        }).join('')}
                    </ul>` : `
                    <p class="cap-vazio">Cadastre suas certidões para saber quando vencem. Avisamos aqui e em cada proposta quando uma delas vence antes do prazo de um edital que você acompanha.</p>`}
                <form id="capCofreForm" class="cap-cofre-form" novalidate>
                    <h3 class="cap-subtitulo" id="capCofreFormTitulo">${ed ? 'Editar documento' : 'Adicionar documento'}</h3>
                    <div class="cap-cofre-campos">
                        <div class="form-group">
                            <label for="capDocTipo">Tipo</label>
                            <select id="capDocTipo" required>
                                <option value="">Escolha…</option>
                                ${Object.entries(TIPOS_DOC).map(([k, t]) => `<option value="${k}"${ed && ed.tipo === k ? ' selected' : ''}>${esc(t.nome)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="capDocDesc">Descrição <span class="nota">(opcional; obrigatória em “Outro”)</span></label>
                            <input id="capDocDesc" type="text" maxlength="120" value="${ed ? esc(ed.descricao || '') : ''}" placeholder="Ex.: SEFAZ-SP, Prefeitura de Belém">
                        </div>
                        <div class="form-group">
                            <label for="capDocEmissao">Data de emissão</label>
                            <input id="capDocEmissao" type="date" value="${ed ? esc(ed.emissao || '') : ''}">
                        </div>
                        <div class="form-group">
                            <label for="capDocValidade">Válida até</label>
                            <input id="capDocValidade" type="date" value="${ed ? esc(ed.validade || '') : ''}" aria-describedby="capDocDica">
                        </div>
                    </div>
                    <p class="nota" id="capDocDica" aria-live="polite">${dicaValidade(ed ? ed.tipo : '')}</p>
                    <div id="capDocErro" class="field-error" role="alert"></div>
                    <div class="cap-links">
                        <button type="submit" class="btn btn-primary btn-small">${ed ? 'Salvar alterações' : 'Adicionar ao cofre'}</button>
                        ${ed ? '<button type="button" class="btn btn-ghost btn-small" data-cap="cancelar-doc">Cancelar edição</button>' : ''}
                    </div>
                </form>
            </section>`;
    }

    function dicaValidade(tipo) {
        const t = TIPOS_DOC[tipo];
        if (!t) return 'Escolha o tipo: para CND federal, CRF e CNDT sugerimos a validade usual a partir da emissão.';
        if (t.dias) return `Sugerimos ${t.dias} dias após a emissão (prazo usual da ${t.nome.split(' ')[0]}). Confira a data impressa na certidão.`;
        return 'Informe a validade impressa no documento. Deixe em branco se ele não tiver validade.';
    }

    function sugerirValidade() {
        const tipo = document.getElementById('capDocTipo'), em = document.getElementById('capDocEmissao'), val = document.getElementById('capDocValidade');
        if (!tipo || !em || !val) return;
        document.getElementById('capDocDica').textContent = dicaValidade(tipo.value);
        const t = TIPOS_DOC[tipo.value];
        if (validadeAuto && t && t.dias && isoValido(em.value)) val.value = somaDias(em.value, t.dias);
    }

    function erroCofre(campoId, msg) {
        const box = document.getElementById('capDocErro');
        document.querySelectorAll('#capCofreForm [aria-invalid]').forEach(el => { el.removeAttribute('aria-invalid'); el.removeAttribute('aria-errormessage'); });
        box.textContent = msg || '';
        if (!campoId) return;
        const campo = document.getElementById(campoId);
        campo.setAttribute('aria-invalid', 'true');
        campo.setAttribute('aria-errormessage', 'capDocErro');
        campo.focus();
    }

    function salvarDoc() {
        const tipo = document.getElementById('capDocTipo').value;
        const descricao = document.getElementById('capDocDesc').value.trim().slice(0, 120);
        const emissao = document.getElementById('capDocEmissao').value;
        const validade = document.getElementById('capDocValidade').value;
        if (!TIPOS_DOC[tipo]) return erroCofre('capDocTipo', 'Escolha o tipo do documento.');
        if (tipo === 'outro' && !descricao) return erroCofre('capDocDesc', 'Descreva o documento (ex.: “Alvará de funcionamento”).');
        if (emissao && !isoValido(emissao)) return erroCofre('capDocEmissao', 'Data de emissão inválida.');
        if (validade && !isoValido(validade)) return erroCofre('capDocValidade', 'Data de validade inválida.');
        if (emissao && validade && validade < emissao) return erroCofre('capDocValidade', 'A validade não pode ser anterior à emissão.');
        if (TIPOS_DOC[tipo].dias && !validade) return erroCofre('capDocValidade', 'Informe a validade (ou a data de emissão, para sugerirmos).');

        const dados = { tipo, descricao, emissao, validade, atualizadoEm: new Date().toISOString() };
        let msg;
        if (cofreEditando && cofre.some(d => d.id === cofreEditando)) {
            Object.assign(cofre.find(d => d.id === cofreEditando), dados);
            msg = 'Documento atualizado.';
        } else {
            if (cofre.length >= 200) return erroCofre('capDocTipo', 'O cofre comporta até 200 documentos.');
            cofre.push({ id: uid(), ...dados });
            msg = 'Documento guardado no cofre.';
        }
        cofreEditando = null;
        validadeAuto = true;
        salvarCofre();
        renderPropostas();
        showNotification(msg);
        const tit = document.getElementById('capCofreFormTitulo');
        const tipoSel = document.getElementById('capDocTipo');
        if (tipoSel) tipoSel.focus(); else if (tit) tit.focus();
    }

    function excluirDoc(id) {
        const i = cofre.findIndex(d => d.id === id);
        if (i < 0) return;
        const [removido] = cofre.splice(i, 1);
        if (cofreEditando === id) cofreEditando = null;
        salvarCofre();
        renderPropostas();
        document.getElementById('capCofreTitulo').focus();
        showNotification(`${nomeDoc(removido)} excluído do cofre.`, 'success', {
            label: 'Desfazer', fn: () => { cofre.splice(i, 0, removido); salvarCofre(); renderPropostas(); }
        });
    }

    /* ---------------------------------------------------------------------
       3. QUADRO (KANBAN) — colunas = ETAPAS; arrastar ou "Mover para…"
    --------------------------------------------------------------------- */
    function prazoCartao(e) {
        const st = statusEdital(e);
        if (st === 'aberto') {
            const d = diasAte(e.encerramento);
            return { urgente: d <= 7, txt: d === 0 ? 'encerra hoje' : `${plural(d, 'dia', 'dias')} (${fmtDate(e.encerramento)})` };
        }
        if (st === 'em-breve') return { urgente: false, txt: `abre em ${fmtDate(e.abertura)}` };
        return { urgente: false, txt: `encerrou em ${fmtDate(e.encerramento)}` };
    }

    function seloGNGCartao(id) {
        const r = resultadoGNG(gonogo[id]);
        return r.k
            ? `<button type="button" class="cap-selo-btn" data-cap="abrir-gng" data-id="${id}" aria-label="Go/no-go: ${GNG[r.k].nome}, ${r.total} de 25. Ver avaliação">${seloGNG(id)}</button>`
            : `<button type="button" class="link-btn cap-link-pequeno" data-cap="abrir-gng" data-id="${id}">Avaliar go/no-go</button>`;
    }

    function cartaoHTML(e, p, conflitos) {
        const pr = prazoCartao(e);
        const alertas = conflitos.filter(c => c.e.id === e.id);
        return `
            <li>
                <article class="cap-cartao" draggable="true" data-id="${e.id}" aria-labelledby="capCartao-${e.id}">
                    <h3 class="cap-cartao-titulo" id="capCartao-${e.id}"><button class="link-btn" data-action="details" data-id="${e.id}">${esc(e.titulo)}</button></h3>
                    <p class="nota">${esc(e.instituicao)}</p>
                    <dl class="cap-cartao-fatos">
                        <div><dt>Prazo</dt><dd class="${pr.urgente && ['interesse', 'preparando'].includes(p.etapa) ? 'cap-urgente' : ''}">${esc(pr.txt)}</dd></div>
                        <div><dt>Valor</dt><dd>${esc(valorPropostaTxt(e))}</dd></div>
                    </dl>
                    <div class="cap-cartao-gng">${seloGNGCartao(e.id)}</div>
                    ${alertas.length ? `<p class="cap-cartao-alerta">${ICONE.alerta}<span>${alertas.length === 1 ? `${esc(nomeDoc(alertas[0].d))} vence antes do prazo` : `${alertas.length} certidões vencem antes do prazo`}</span></p>` : ''}
                    <div class="cap-mover">
                        <label for="capMover-${e.id}">Mover para</label>
                        <select id="capMover-${e.id}">
                            ${ETAPAS.filter(et => et.k !== p.etapa).map(et => `<option value="${et.k}">${esc(et.nome)}</option>`).join('')}
                        </select>
                        <button type="button" class="btn btn-outline btn-small" data-cap="mover" data-id="${e.id}" aria-label="Mover “${esc(e.titulo)}” para a etapa escolhida">Mover</button>
                    </div>
                </article>
            </li>`;
    }

    function quadroHTML(itens, conflitos) {
        return `
            <p class="nota cap-quadro-ajuda">Arraste os cartões entre as colunas ou use “Mover para” (funciona com teclado e leitor de tela).</p>
            <div class="cap-quadro">
                ${ETAPAS.map(et => {
                    const daEtapa = itens.filter(x => x.p.etapa === et.k);
                    return `
                    <section class="cap-coluna" data-etapa="${et.k}" aria-labelledby="capCol-${et.k}">
                        <h2 class="cap-coluna-titulo" id="capCol-${et.k}">${esc(et.nome)} <span class="cap-coluna-n">${daEtapa.length}</span></h2>
                        ${daEtapa.length
                            ? `<ul class="cap-cartoes">${daEtapa.map(({ e, p }) => cartaoHTML(e, p, conflitos)).join('')}</ul>`
                            : '<p class="cap-coluna-vazia">Nenhuma proposta nesta etapa.</p>'}
                    </section>`;
                }).join('')}
            </div>`;
    }

    function mover(id, etapa) {
        const p = propostas[id];
        if (!p || !ETAPA[etapa] || p.etapa === etapa) return;
        acompanhar(id, etapa); // reaproveita a regra existente (toast com "Desfazer" e re-renderização)
        const sel = document.getElementById(`capMover-${id}`);
        if (sel) sel.focus();
    }

    function barraPropostasHTML(itens, conflitos) {
        if (!itens.length) return '';
        return `
            <div class="cap-barra">
                <div class="view-toggle" role="group" aria-label="Visualização das propostas">
                    <button type="button" data-cap="vista" data-vista="lista" aria-pressed="${vista === 'lista'}">Lista</button>
                    <button type="button" data-cap="vista" data-vista="quadro" aria-pressed="${vista === 'quadro'}">Quadro</button>
                </div>
                <button type="button" class="btn btn-ghost btn-small" data-cap="ir-cofre">Cofre de certidões</button>
                <button type="button" class="btn btn-ghost btn-small" data-cap="ir-backup">Backup</button>
            </div>
            ${conflitos.length ? `<p class="cap-alerta cap-alerta-curto">${ICONE.alerta}<span>${plural(conflitos.length, 'certidão vence', 'certidões vencem')} antes do prazo de editais que você acompanha. <button type="button" class="link-btn" data-cap="ir-cofre">Ver no cofre</button></span></p>` : ''}`;
    }

    // Acrescenta go/no-go e aviso de certidão aos cartões da lista original
    function enriquecerLista(conflitos) {
        document.querySelectorAll('#propostasList .proposta-card[data-proposta]').forEach(card => {
            const id = Number(card.dataset.proposta);
            if (!propostas[id]) return;
            const acoes = card.querySelector('.edital-actions');
            const alertas = conflitos.filter(c => c.e.id === id);
            const html = (alertas.length ? `<div class="cap-alerta cap-alerta-curto" role="note">${ICONE.alerta}<span>${alertas.map(c => esc(`${nomeDoc(c.d)} ${diasAte(c.d.validade) < 0 ? 'está vencida' : `vence em ${fmtDate(c.d.validade)}`}, antes do prazo (${fmtDate(c.e.encerramento)}).`)).join(' ')}</span></div>` : '') + gngHTML(id);
            if (acoes) acoes.insertAdjacentHTML('beforebegin', html); else card.insertAdjacentHTML('beforeend', html);
        });
    }

    /* ---------------------------------------------------------------------
       7. BACKUP (JSON) E EXPORTAÇÃO DO QUADRO (CSV)
    --------------------------------------------------------------------- */
    const FORMATO = 'fundos-brasil/captacao';
    let ultimoRelatorio = ''; // resultado da última importação (sobrevive a re-renderizações)

    function backupHTML() {
        return `
            <section class="card" aria-labelledby="capBackupTitulo">
                <h2 class="card-title" id="capBackupTitulo" tabindex="-1">Backup e exportação</h2>
                <p class="cap-texto">Guarde uma cópia ou leve para outro dispositivo: propostas, checklists, avaliações go/no-go, cofre de certidões, respostas de elegibilidade e buscas salvas vão em um único arquivo. Ele fica com você — nada é enviado para servidores.</p>
                <div class="cap-links">
                    <button type="button" class="btn btn-outline btn-small" data-cap="exportar-json">${ICONE.baixar} Exportar backup (JSON)</button>
                    <button type="button" class="btn btn-outline btn-small" data-cap="importar-json" aria-describedby="capImportAjuda">${ICONE.subir} Importar backup</button>
                    <button type="button" class="btn btn-outline btn-small" data-cap="exportar-csv">${ICONE.baixar} Exportar quadro (CSV)</button>
                    <input type="file" id="capImportFile" accept=".json,application/json" hidden>
                </div>
                <p class="nota" id="capImportAjuda">Importar junta o arquivo aos dados deste navegador; registros do mesmo edital são substituídos pelos do arquivo. O CSV abre direto no Excel.</p>
                <div id="capImportRelatorio" class="import-report" role="status"${ultimoRelatorio ? '' : ' hidden'}>${esc(ultimoRelatorio)}</div>
            </section>`;
    }

    function checklistsAtuais() {
        const out = {};
        try {
            Object.keys(localStorage).forEach(k => {
                const m = /^checklist-(\d{1,9})$/.exec(k);
                if (m) { const v = store.get(k, []); if (Array.isArray(v) && v.length) out[m[1]] = v; }
            });
        } catch (_) { /* armazenamento indisponível */ }
        return out;
    }

    function exportarJSON() {
        const dados = {
            formato: FORMATO, versao: 1, exportadoEm: new Date().toISOString(),
            propostas, checklists: checklistsAtuais(), gonogo, cofre, elegibilidade: elegib, buscas
        };
        downloadFile(`fundos-brasil-backup-${hojeISO()}.json`, JSON.stringify(dados, null, 2), 'application/json');
        track('backup-exportar');
        showNotification('Backup exportado. Guarde o arquivo em local seguro.');
    }

    // CSV para Excel em pt-BR: separador ";", BOM UTF-8, CRLF; neutraliza fórmulas (=, +, -, @)
    function exportarCSV() {
        const itens = itensPropostas();
        if (!itens.length) { showNotification('Nenhuma proposta para exportar.', 'warning'); return; }
        const cel = v => {
            let s = String(v ?? '');
            if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
            return `"${s.replace(/"/g, '""')}"`;
        };
        const cols = [
            ['Etapa', ({ p }) => ETAPA[p.etapa].nome],
            ['Edital', ({ e }) => e.titulo],
            ['Número da chamada', ({ e }) => e.numero || ''],
            ['Instituição', ({ e }) => e.instituicao],
            ['Situação do edital', ({ e }) => STATUS_LABEL[statusEdital(e)]],
            ['Prazo final', ({ e }) => fmtDate(e.encerramento)],
            ['Dias até o prazo', ({ e }) => (statusEdital(e) === 'fechado' ? '' : diasAte(e.encerramento))],
            ['Valor por proposta', ({ e }) => (temValor(e) ? e.valorMax : '')],
            ['Moeda', ({ e }) => e.moeda],
            ['Go/no-go', ({ e }) => { const r = resultadoGNG(gonogo[e.id]); return r.k ? GNG[r.k].nome : ''; }],
            ['Pontuação (de 25)', ({ e }) => { const r = resultadoGNG(gonogo[e.id]); return r.k ? r.total : ''; }],
            ['Justificativa', ({ e }) => (gonogo[e.id] && gonogo[e.id].justificativa) || ''],
            ['Protocolo', ({ p }) => p.protocolo || ''],
            ['Anotações', ({ p }) => p.notas || ''],
            ['Portal oficial', ({ e }) => e.link]
        ];
        const linhas = [cols.map(c => cel(c[0])).join(';'), ...itens.map(x => cols.map(c => cel(c[1](x))).join(';'))];
        downloadFile(`minhas-propostas-${hojeISO()}.csv`, '﻿' + linhas.join('\r\n'), 'text/csv;charset=utf-8');
        track('quadro-csv');
        showNotification(`${plural(itens.length, 'proposta exportada', 'propostas exportadas')} em CSV.`);
    }

    /* Validação do arquivo importado: nada é aceito sem checagem de tipo e tamanho.
       Devolve só dados limpos e a contagem do que foi descartado. */
    const texto = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
    const dataHora = v => (typeof v === 'string' && v.length <= 40 && !isNaN(Date.parse(v)) ? new Date(v).toISOString() : new Date().toISOString());
    const idEdital = k => /^\d{1,9}$/.test(k);

    function validarBackup(d) {
        const r = { propostas: {}, checklists: {}, gonogo: {}, cofre: [], elegibilidade: {}, buscas: [], ignorados: 0 };
        if (!objeto(d) || d.formato !== FORMATO) return null;

        if (objeto(d.propostas)) for (const [k, v] of Object.entries(d.propostas).slice(0, 1000)) {
            if (!idEdital(k) || !objeto(v) || !Object.hasOwn(ETAPA, v.etapa)) { r.ignorados++; continue; }
            r.propostas[k] = { etapa: v.etapa, notas: texto(v.notas, 5000), protocolo: texto(v.protocolo, 200), criadoEm: dataHora(v.criadoEm), atualizadoEm: dataHora(v.atualizadoEm) };
        }
        if (objeto(d.checklists)) for (const [k, v] of Object.entries(d.checklists).slice(0, 1000)) {
            if (!idEdital(k) || !Array.isArray(v)) { r.ignorados++; continue; }
            r.checklists[k] = [...new Set(v.filter(i => Number.isInteger(i) && i >= 0 && i < 200))];
        }
        if (objeto(d.gonogo)) for (const [k, v] of Object.entries(d.gonogo).slice(0, 1000)) {
            if (!idEdital(k) || !objeto(v)) { r.ignorados++; continue; }
            const notas = {};
            if (objeto(v.notas)) CRITERIOS_GNG.forEach(c => { const n = v.notas[c.k]; if (Number.isInteger(n) && n >= 1 && n <= 5) notas[c.k] = n; });
            r.gonogo[k] = { notas, justificativa: texto(v.justificativa, 280), atualizadoEm: dataHora(v.atualizadoEm) };
        }
        if (Array.isArray(d.cofre)) for (const v of d.cofre.slice(0, 200)) {
            if (!objeto(v) || !Object.hasOwn(TIPOS_DOC, v.tipo)) { r.ignorados++; continue; }
            const emissao = isoValido(v.emissao) ? v.emissao : '';
            const validade = isoValido(v.validade) ? v.validade : '';
            r.cofre.push({
                id: typeof v.id === 'string' && /^[a-z0-9]{1,24}$/.test(v.id) ? v.id : uid(),
                tipo: v.tipo, descricao: texto(v.descricao, 120).trim(), emissao, validade, atualizadoEm: dataHora(v.atualizadoEm)
            });
        }
        if (objeto(d.elegibilidade)) for (const [k, v] of Object.entries(d.elegibilidade).slice(0, 1000)) {
            if (!idEdital(k) || !objeto(v)) { r.ignorados++; continue; }
            const resp = {};
            Object.entries(v).slice(0, 10).forEach(([q, b]) => { if (q.length <= 200 && typeof b === 'boolean') resp[q] = b; });
            r.elegibilidade[k] = resp;
        }
        if (Array.isArray(d.buscas)) for (const v of d.buscas.slice(0, MAX_BUSCAS)) {
            const nome = objeto(v) ? texto(v.nome, 80).trim() : '';
            if (!nome || typeof v.qs !== 'string' || v.qs.length > 1000) { r.ignorados++; continue; }
            r.buscas.push({
                id: typeof v.id === 'string' && /^[a-z0-9]{1,24}$/.test(v.id) ? v.id : uid(),
                nome, qs: limparQs(v.qs), criadoEm: dataHora(v.criadoEm),
                ultimaVisita: isoValido(v.ultimaVisita) ? v.ultimaVisita : hojeISO(),
                vistos: Array.isArray(v.vistos) ? v.vistos.filter(Number.isInteger).slice(0, 1000) : []
            });
        }
        return r;
    }

    function relatorio(msg) {
        ultimoRelatorio = msg;
        const box = document.getElementById('capImportRelatorio');
        if (!box) { showNotification(msg); return; }
        box.hidden = false;
        box.textContent = msg; // textContent: nada do arquivo vira HTML
    }

    function importarArquivo(file) {
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { relatorio('Arquivo grande demais (máximo de 2 MB). Confira se é um backup do Fundos Brasil.'); return; }
        const leitor = new FileReader();
        leitor.onload = () => {
            let bruto;
            try { bruto = JSON.parse(String(leitor.result)); } catch (_) { relatorio('O arquivo não é um JSON válido.'); return; }
            const v = validarBackup(bruto);
            if (!v) { relatorio('Este arquivo não é um backup do Fundos Brasil (exportado em Minhas propostas → Exportar backup).'); return; }
            const n = {
                propostas: Object.keys(v.propostas).length, gonogo: Object.keys(v.gonogo).length,
                cofre: v.cofre.length, buscas: v.buscas.length
            };
            const resumo = `${plural(n.propostas, 'proposta', 'propostas')}, ${plural(n.gonogo, 'avaliação go/no-go', 'avaliações go/no-go')}, ${plural(n.cofre, 'documento', 'documentos')} do cofre e ${plural(n.buscas, 'busca salva', 'buscas salvas')}`;
            if (!confirm(`Importar ${resumo}? Registros do mesmo edital serão substituídos pelos do arquivo; o restante é mantido.`)) { relatorio('Importação cancelada. Nada foi alterado.'); return; }

            // Junta ao que já existe (mutando os objetos que o script principal usa)
            Object.entries(v.propostas).forEach(([k, p]) => { propostas[k] = p; });
            salvarPropostas();
            Object.entries(v.checklists).forEach(([k, lista]) => store.set(`checklist-${k}`, lista));
            Object.assign(gonogo, v.gonogo); salvarGonogo();
            Object.assign(elegib, v.elegibilidade); salvarElegib();
            v.cofre.forEach(doc => {
                const i = cofre.findIndex(d => d.id === doc.id);
                if (i >= 0) cofre[i] = doc; else if (cofre.length < 200) cofre.push(doc);
            });
            salvarCofre();
            let buscasIgnoradas = 0;
            v.buscas.forEach(b => {
                const i = buscas.findIndex(x => x.id === b.id || chaveBusca(x.qs) === chaveBusca(b.qs));
                if (i >= 0) buscas[i] = b; else if (buscas.length < MAX_BUSCAS) buscas.push(b); else buscasIgnoradas++;
            });
            salvarBuscas();
            track('backup-importar');
            refreshAll();
            renderBuscas();
            const ign = v.ignorados + buscasIgnoradas;
            relatorio(`Importado: ${resumo}.${ign ? ` ${plural(ign, 'item inválido ou excedente foi ignorado', 'itens inválidos ou excedentes foram ignorados')}.` : ''}`);
        };
        leitor.onerror = () => relatorio('Não foi possível ler o arquivo.');
        leitor.readAsText(file);
    }

    /* ---------------------------------------------------------------------
       6. TESTE DE ELEGIBILIDADE — no detalhe do edital, se ele tiver e.elegibilidade
       Respostas por edital: elegib[id] = { "pergunta": true|false }
    --------------------------------------------------------------------- */
    function respostasDe(e) {
        const salvas = objeto(elegib[e.id]) ? elegib[e.id] : {};
        return e.elegibilidade.map(q => (typeof salvas[q.pergunta] === 'boolean' ? salvas[q.pergunta] : null));
    }

    function resultadoElegHTML(e) {
        const resp = respostasDe(e);
        const falhaElim = e.elegibilidade.filter((q, i) => resp[i] !== null && q.eliminatoria && resp[i] !== q.esperado);
        const falhaOutros = e.elegibilidade.filter((q, i) => resp[i] !== null && !q.eliminatoria && resp[i] !== q.esperado);
        const faltam = resp.filter(r => r === null).length;
        const ressalva = ' Confira no edital oficial — ele sempre prevalece.';
        if (falhaElim.length) {
            return `<p class="cap-eleg-msg alerta"><strong>Atenção: requisito eliminatório não atendido:</strong> ${esc(falhaElim.map(q => q.pergunta).join(' · '))}.${ressalva}</p>`;
        }
        if (faltam) {
            return `<p class="cap-eleg-msg">${faltam === resp.length ? `Responda ${plural(faltam, 'pergunta', 'perguntas')} para ver o resultado.` : `Faltam ${plural(faltam, 'pergunta', 'perguntas')}.`}${ressalva}</p>`;
        }
        if (falhaOutros.length) {
            return `<p class="cap-eleg-msg aviso"><strong>Você atende aos requisitos eliminatórios, mas não a ${plural(falhaOutros.length, 'item', 'itens')}:</strong> ${esc(falhaOutros.map(q => q.pergunta).join(' · '))}. Isso pode reduzir sua pontuação.${ressalva}</p>`;
        }
        return `<p class="cap-eleg-msg ok"><strong>Pelo que você respondeu, você atende aos requisitos listados.</strong>${ressalva}</p>`;
    }

    function elegibilidadeHTML(e) {
        const resp = respostasDe(e);
        return `
            <h3 id="capElegTitulo-${e.id}">Teste rápido de elegibilidade</h3>
            <p class="nota">Triagem com os principais requisitos do edital. Responda pela sua organização; as respostas ficam salvas neste navegador.</p>
            <ol class="cap-eleg-lista">
                ${e.elegibilidade.map((q, i) => `
                    <li>
                        <fieldset>
                            <legend>${esc(q.pergunta)}${q.eliminatoria ? ' <span class="badge badge-neutral">Eliminatório</span>' : ''}</legend>
                            <div class="cap-eleg-opcoes">
                                <label><input type="radio" name="capEleg-${e.id}-${i}" value="sim" data-cap-eleg="${i}" data-id="${e.id}"${resp[i] === true ? ' checked' : ''}> Sim</label>
                                <label><input type="radio" name="capEleg-${e.id}-${i}" value="nao" data-cap-eleg="${i}" data-id="${e.id}"${resp[i] === false ? ' checked' : ''}> Não</label>
                            </div>
                        </fieldset>
                    </li>`).join('')}
            </ol>
            <div class="cap-eleg-resultado" aria-live="polite">${resultadoElegHTML(e)}</div>
            ${resp.some(r => r !== null) ? `<button type="button" class="btn btn-ghost btn-small" data-cap="limpar-eleg" data-id="${e.id}">Limpar respostas</button>` : ''}`;
    }

    function inserirElegibilidade(id) {
        const modal = document.getElementById('editalModal');
        const e = editais.find(x => x.id === id);
        if (!modal || !e || Number(modal.dataset.id) !== id) return;
        const corpo = modal.querySelector('#editalModalContent .modal-body');
        if (!corpo) return;
        const antigo = corpo.querySelector('.cap-eleg');
        if (antigo) antigo.remove();
        if (!Array.isArray(e.elegibilidade) || !e.elegibilidade.length) return;
        const sec = document.createElement('section');
        sec.className = 'modal-section no-print cap-eleg';
        sec.setAttribute('aria-labelledby', `capElegTitulo-${e.id}`);
        sec.innerHTML = elegibilidadeHTML(e);
        // Logo depois da compatibilidade com o perfil (primeira seção do corpo)
        const ref = corpo.querySelector(':scope > .modal-section');
        if (ref) ref.after(sec); else corpo.prepend(sec);
    }

    function responderEleg(input) {
        const id = Number(input.dataset.id), i = Number(input.dataset.capEleg);
        const e = editais.find(x => x.id === id);
        if (!e || !e.elegibilidade || !e.elegibilidade[i]) return;
        const atual = objeto(elegib[id]) ? elegib[id] : {};
        atual[e.elegibilidade[i].pergunta] = input.value === 'sim';
        elegib[id] = atual;
        salvarElegib();
        const sec = input.closest('.cap-eleg');
        sec.querySelector('.cap-eleg-resultado').innerHTML = resultadoElegHTML(e);
        if (!sec.querySelector('[data-cap="limpar-eleg"]')) sec.insertAdjacentHTML('beforeend', `<button type="button" class="btn btn-ghost btn-small" data-cap="limpar-eleg" data-id="${e.id}">Limpar respostas</button>`);
    }

    /* ---------------------------------------------------------------------
       GANCHOS NO SCRIPT PRINCIPAL (sem duplicar renderizações)
       Funções globais do index.html são reatribuídas por invólucros que chamam a
       original e depois acrescentam o que é desta camada.
    --------------------------------------------------------------------- */
    const original = { openEdital, renderPropostas, syncUrl, renderDashboardStats };

    openEdital = function (id) {
        original.openEdital(id);
        seguro(() => inserirElegibilidade(id));
    };

    // syncUrl roda ao fim de todo filterEditais (inclusive na busca com atraso): ponto único para "filtros mudaram"
    syncUrl = function (f) {
        original.syncUrl(f);
        seguro(() => atualizarFerramentasBusca(f));
    };

    renderDashboardStats = function () {
        original.renderDashboardStats();
        seguro(renderBuscas);
    };

    renderPropostas = function () {
        original.renderPropostas();
        seguro(() => {
            const itens = itensPropostas();
            const conflitos = conflitosCertidoes();
            const noQuadro = vista === 'quadro' && itens.length > 0;
            document.getElementById('capPropostasBarra').innerHTML = barraPropostasHTML(itens, conflitos);
            document.getElementById('pipelineResumo').hidden = noQuadro;
            document.getElementById('propostasList').hidden = noQuadro;
            const quadro = document.getElementById('capQuadro');
            quadro.hidden = !noQuadro;
            quadro.innerHTML = noQuadro ? quadroHTML(itens, conflitos) : '';
            if (!noQuadro) enriquecerLista(conflitos);
            document.getElementById('capCofre').innerHTML = cofreHTML();
            document.getElementById('capBackup').innerHTML = backupHTML();
        });
    };

    /* ---------------------------------------------------------------------
       EVENTOS (delegação com data-cap, para não colidir com data-action)
    --------------------------------------------------------------------- */
    function focarSecao(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.scrollIntoView({ block: 'start', behavior: 'smooth' });
        el.focus({ preventScroll: true });
    }

    document.addEventListener('click', ev => {
        const el = ev.target.closest && ev.target.closest('[data-cap]');
        if (!el) return;
        const id = el.dataset.id;
        switch (el.dataset.cap) {
            case 'abrir-busca':
                if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button === 1) return; // nova aba: deixa o navegador agir
                ev.preventDefault();
                abrirBusca(id);
                break;
            case 'renomear-busca': editarNomeBusca(id, el.dataset.onde); break;
            case 'cancelar-renomear': { const bid = el.closest('form').dataset.id; renderBuscas(); focarAcaoBusca(bid, 'renomear-busca'); break; }
            case 'excluir-busca': excluirBusca(id); break;
            case 'fechar-salvar': alternarPainel('capSalvarBtn', 'capSalvarPainel', false); document.getElementById('capSalvarBtn').focus(); break;
            case 'copiar-cal': copiarLinkCalendario(); break;
            case 'vista':
                vista = el.dataset.vista === 'quadro' ? 'quadro' : 'lista';
                store.set(K.vista, vista);
                renderPropostas();
                { const b = document.querySelector(`[data-cap="vista"][data-vista="${vista}"]`); if (b) b.focus(); }
                anunciar(vista === 'quadro' ? 'Mostrando o quadro por etapa' : 'Mostrando a lista de propostas');
                break;
            case 'mover': { const sel = document.getElementById(`capMover-${id}`); if (sel) mover(Number(id), sel.value); break; }
            case 'abrir-gng': {
                const n = Number(id);
                gngAbertos.add(n);
                if (vista !== 'lista') { vista = 'lista'; store.set(K.vista, vista); }
                filtroEtapa = '';
                renderPropostas();
                const d = document.querySelector(`#propostasList [data-gng="${n}"]`);
                if (d) { d.open = true; d.scrollIntoView({ block: 'center' }); d.querySelector('summary').focus(); }
                break;
            }
            case 'ir-cofre': focarSecao('capCofreTitulo'); break;
            case 'ir-backup': focarSecao('capBackupTitulo'); break;
            case 'editar-doc': {
                const d = cofre.find(x => x.id === id);
                if (!d) return;
                cofreEditando = id;
                validadeAuto = false; // não sobrescreve a validade que a pessoa já informou
                renderPropostas();
                document.getElementById('capDocTipo').focus();
                break;
            }
            case 'cancelar-doc': cofreEditando = null; validadeAuto = true; renderPropostas(); document.getElementById('capCofreFormTitulo').focus(); break;
            case 'excluir-doc': excluirDoc(id); break;
            case 'exportar-json': exportarJSON(); break;
            case 'importar-json': { const inp = document.getElementById('capImportFile'); if (inp) { inp.value = ''; inp.click(); } break; }
            case 'exportar-csv': exportarCSV(); break;
            case 'limpar-eleg': {
                const n = Number(id);
                delete elegib[n];
                salvarElegib();
                const sec = el.closest('.cap-eleg');
                const e = editais.find(x => x.id === n);
                if (sec && e) { sec.innerHTML = elegibilidadeHTML(e); const r = sec.querySelector('input[type=radio]'); if (r) r.focus(); }
                anunciar('Respostas apagadas.');
                break;
            }
        }
    });

    // Botões de disclosure (Assinar / Salvar) ficam fora do switch para manter o foco simples
    document.addEventListener('click', ev => {
        const b = ev.target.closest && ev.target.closest('#capAssinarBtn, #capSalvarBtn');
        if (!b) return;
        if (b.id === 'capAssinarBtn') {
            const painel = document.getElementById('capAssinarPainel');
            painel.innerHTML = painelAssinarHTML(getFiltros());
            if (alternarPainel('capAssinarBtn', 'capAssinarPainel')) { alternarPainel('capSalvarBtn', 'capSalvarPainel', false); track('assinar-abrir'); }
        } else if (alternarPainel('capSalvarBtn', 'capSalvarPainel')) {
            alternarPainel('capAssinarBtn', 'capAssinarPainel', false);
            const campo = document.getElementById('capBuscaNome');
            campo.value = nomeSugerido(getFiltros());
            campo.removeAttribute('aria-invalid');
            campo.focus();
            campo.select();
        }
    });

    document.addEventListener('submit', ev => {
        const form = ev.target;
        if (form.id === 'capSalvarForm') {
            ev.preventDefault();
            const campo = document.getElementById('capBuscaNome');
            const nome = campo.value.trim();
            if (!nome) { campo.setAttribute('aria-invalid', 'true'); campo.focus(); showNotification('Dê um nome para a busca.', 'warning'); return; }
            campo.removeAttribute('aria-invalid');
            if (salvarBuscaAtual(nome)) { // salva (ou já existia): fecha o painel
                alternarPainel('capSalvarBtn', 'capSalvarPainel', false);
                renderBuscas();
                document.getElementById('capSalvarBtn').focus();
            }
        }
        if (form.dataset && form.dataset.capForm === 'renomear') {
            ev.preventDefault();
            const b = buscas.find(x => x.id === form.dataset.id);
            const nome = form.querySelector('input').value.trim().slice(0, 80);
            if (!b) return;
            if (!nome) { form.querySelector('input').focus(); return; }
            b.nome = nome;
            salvarBuscas();
            renderBuscas();
            focarAcaoBusca(b.id, 'renomear-busca');
            anunciar(`Busca renomeada para ${nome}`);
        }
        if (form.id === 'capCofreForm') { ev.preventDefault(); salvarDoc(); }
    });

    document.addEventListener('change', ev => {
        const el = ev.target;
        if (el.id === 'capImportFile' && el.files && el.files[0]) importarArquivo(el.files[0]);
        if (el.id === 'capDocTipo' || el.id === 'capDocEmissao') sugerirValidade();
        if (el.id === 'capDocValidade') validadeAuto = !el.value; // a pessoa digitou: não recalcula mais
        if (el.dataset && el.dataset.capEleg !== undefined && el.checked) responderEleg(el);
        if (el.dataset && el.dataset.capGng === 'nota' && el.checked) {
            const id = Number(el.dataset.id);
            const g = gonogo[id] || { notas: {}, justificativa: '' };
            g.notas = { ...(g.notas || {}), [el.dataset.k]: Number(el.value) };
            g.atualizadoEm = new Date().toISOString();
            gonogo[id] = g;
            salvarGonogo();
            atualizarGNGNaTela(id);
        }
    });

    document.addEventListener('input', ev => {
        const el = ev.target;
        if (el.dataset && el.dataset.capGng === 'just') {
            const id = Number(el.dataset.id);
            const g = gonogo[id] || { notas: {} };
            g.justificativa = el.value.slice(0, 280);
            g.atualizadoEm = new Date().toISOString();
            gonogo[id] = g;
            salvarGonogoDebounced();
        }
    });

    // Lembra quais avaliações go/no-go estão abertas (toggle não borbulha: captura)
    document.addEventListener('toggle', ev => {
        const d = ev.target;
        if (d.classList && d.classList.contains('cap-gng')) {
            const id = Number(d.dataset.gng);
            if (d.open) gngAbertos.add(id); else gngAbertos.delete(id);
        }
    }, true);

    document.addEventListener('keydown', ev => {
        // Esc fecha os painéis de Assinar/Salvar e cancela a renomeação
        if (ev.key !== 'Escape') return;
        if (ev.target.closest && ev.target.closest('.cap-renomear')) {
            const bid = ev.target.closest('form').dataset.id;
            renderBuscas();
            focarAcaoBusca(bid, 'renomear-busca');
            return;
        }
        for (const [btn, painel] of [['capAssinarBtn', 'capAssinarPainel'], ['capSalvarBtn', 'capSalvarPainel']]) {
            const p = document.getElementById(painel);
            if (p && !p.hidden && p.contains(document.activeElement)) { alternarPainel(btn, painel, false); document.getElementById(btn).focus(); }
        }
    });

    // Arrastar e soltar no quadro (o teclado usa "Mover para")
    let arrastando = null;
    document.addEventListener('dragstart', ev => {
        const c = ev.target.closest && ev.target.closest('.cap-cartao');
        if (!c) return;
        arrastando = Number(c.dataset.id);
        c.classList.add('cap-arrastando');
        try { ev.dataTransfer.setData('text/plain', String(arrastando)); ev.dataTransfer.effectAllowed = 'move'; } catch (_) { /* navegador sem dataTransfer */ }
    });
    document.addEventListener('dragend', ev => {
        const c = ev.target.closest && ev.target.closest('.cap-cartao');
        if (c) c.classList.remove('cap-arrastando');
        document.querySelectorAll('.cap-coluna.cap-alvo').forEach(x => x.classList.remove('cap-alvo'));
        arrastando = null;
    });
    document.addEventListener('dragover', ev => {
        const col = arrastando !== null && ev.target.closest && ev.target.closest('.cap-coluna');
        if (!col) return;
        ev.preventDefault();
        document.querySelectorAll('.cap-coluna.cap-alvo').forEach(x => { if (x !== col) x.classList.remove('cap-alvo'); });
        col.classList.add('cap-alvo');
    });
    document.addEventListener('drop', ev => {
        const col = arrastando !== null && ev.target.closest && ev.target.closest('.cap-coluna');
        if (!col) return;
        ev.preventDefault();
        const id = arrastando;
        arrastando = null;
        col.classList.remove('cap-alvo');
        mover(id, col.dataset.etapa);
    });

    // Estado inicial (o script principal ainda vai chamar route() no DOMContentLoaded)
    seguro(montarAcoesBusca);
    seguro(renderBuscas);
})();
