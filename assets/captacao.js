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
   6. (Quem pode participar: agora no index.html, uma pergunta por vez — aqui só backup)
   7. Backup (JSON) e exportação do quadro (CSV)
   8. Primeiro resultado em 1 toque ("Quem vai pedir o recurso?"), "Afinar" e "Seu próximo passo"
   8b. Trilha, conquistas e celebração (gamificação honesta, só com ações reais)
   9. "Desde sua última visita" (faixa no início)
  10. Pesquisa de 1 pergunta (CES) depois de "Portal oficial" / "Quero participar"
  11. Lista compartilhável (#lista?ids=…) e "Compartilhar minha lista"
  12. Aviso no navegador (só quando a pessoa pede)
  13. Meus dados (#meus-dados): o que está salvo, exportar, apagar tudo

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
        vista: 'fb:propostasVista',
        onboarding: 'fb:onboarding',       // 'feito' | 'pulado'
        ultimaVisita: 'fb:ultimaVisita',   // AAAA-MM-DD do último dia em que o site foi aberto
        vistosIds: 'fb:vistosIds',         // ids dos editais que existiam na última visita
        vistosPrazos: 'fb:vistosPrazos',   // { id: prazo } na última visita (para "prazos mudaram")
        desde: 'fb:desdeVisita',           // { data, ids, prazos } da visita anterior (a faixa usa este retrato)
        desdeFechado: 'fb:desdeFechado',   // dia em que a faixa foi vista/fechada
        ces: 'fb:ces',                     // { em, resposta } — pesquisa de 1 pergunta, no máximo a cada 30 dias
        notificar: 'fb:notificar',         // '1' quando a pessoa pediu aviso neste navegador
        notificadoEm: 'fb:notificadoEm'
    };
    const objeto = v => v && typeof v === 'object' && !Array.isArray(v);
    const ler = (k, padrao) => { const v = store.get(k, padrao); return v === null || v === undefined ? padrao : v; };

    let buscas = ler(K.buscas, []);
    let gonogo = ler(K.gonogo, {});
    let cofre = ler(K.cofre, []);
    let vista = ler(K.vista, 'lista') === 'quadro' ? 'quadro' : 'lista';
    // Dados corrompidos (ou de outra versão) não podem quebrar a página
    if (!Array.isArray(buscas)) buscas = [];
    if (!objeto(gonogo)) gonogo = {};
    if (!Array.isArray(cofre)) cofre = [];

    const salvarBuscas = () => store.set(K.buscas, buscas);
    const salvarGonogo = () => store.set(K.gonogo, gonogo);
    const salvarCofre = () => store.set(K.cofre, cofre);
    // Respostas de "Quem pode participar": quem grava é o index.html (responderEleg); aqui só leitura para o backup
    const lerElegib = () => { const v = store.get(K.elegib, {}); return objeto(v) ? v : {}; };

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
        subir: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>'),
        imprimir: svg('<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>')
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
                <a class="btn btn-primary btn-small" href="${esc(l.google)}" target="_blank" rel="noopener noreferrer" data-evento="assinar-google">Adicionar ao Google Agenda<span class="sr-only"> (abre em nova aba)</span></a>
                <a class="btn btn-outline btn-small" href="${esc(l.webcal)}" data-evento="assinar-webcal">Outlook ou Apple Calendário</a>
                <button type="button" class="btn btn-outline btn-small" data-cap="copiar-cal">Copiar link do calendário</button>
                <a class="btn btn-outline btn-small" href="${esc(l.rss)}" target="_blank" rel="noopener" data-evento="assinar-rss">RSS<span class="sr-only"> (abre em nova aba)</span></a>
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
                        ${setasMoverHTML(e, p)}
                        <details class="cap-mover-outra">
                            <summary>Outra etapa</summary>
                            <div class="cap-mover-sel">
                                <label for="capMover-${e.id}">Mover para</label>
                                <select id="capMover-${e.id}">
                                    ${ETAPAS.filter(et => et.k !== p.etapa).map(et => `<option value="${et.k}">${esc(et.nome)}</option>`).join('')}
                                </select>
                                <button type="button" class="btn btn-outline btn-small" data-cap="mover" data-id="${e.id}" aria-label="Mover “${esc(e.titulo)}” para a etapa escolhida">Mover</button>
                            </div>
                        </details>
                    </div>
                </article>
            </li>`;
    }

    // ← / → levam à etapa vizinha; o seletor "Outra etapa" continua como alternativa acessível
    function setasMoverHTML(e, p) {
        const i = ETAPAS.findIndex(et => et.k === p.etapa);
        const ant = ETAPAS[i - 1], prox = ETAPAS[i + 1];
        const seta = (et, dir, glifo) => et
            ? `<button type="button" class="btn btn-outline btn-small cap-seta" data-cap="mover-dir" data-dir="${dir}" data-id="${e.id}" data-etapa="${et.k}" aria-label="Mover para ${esc(et.nome)}: ${esc(e.titulo)}" title="Mover para ${esc(et.nome)}"><span aria-hidden="true">${glifo}</span></button>`
            : `<span class="cap-seta-vazia" aria-hidden="true"></span>`;
        return `<div class="cap-setas" role="group" aria-label="Mover entre etapas">${seta(ant, 'ant', '←')}<span class="cap-seta-etapa">${esc(ETAPA[p.etapa].nome)}</span>${seta(prox, 'prox', '→')}</div>`;
    }

    function quadroHTML(itens, conflitos) {
        return `
            <p class="nota cap-quadro-ajuda">Arraste os cartões entre as colunas ou use as setas ← → de cada cartão (também em “Outra etapa”, com teclado e leitor de tela).</p>
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

    function mover(id, etapa, dir) {
        const p = propostas[id];
        if (!p || !ETAPA[etapa] || p.etapa === etapa) return;
        acompanhar(id, etapa); // reaproveita a regra existente (toast com "Desfazer" e re-renderização)
        // O cartão foi redesenhado na nova coluna: o foco segue o cartão (mesma seta, ou a outra se acabou a fila)
        const card = document.querySelector(`#capQuadro .cap-cartao[data-id="${id}"]`);
        const alvo = card && (dir
            ? (card.querySelector(`[data-cap="mover-dir"][data-dir="${dir}"]`) || card.querySelector('[data-cap="mover-dir"]'))
            : card.querySelector(`#capMover-${id}`));
        if (alvo) alvo.focus();
        anunciar(`Movido para ${ETAPA[etapa].nome}.`);
    }

    function barraPropostasHTML(itens, conflitos) {
        if (!itens.length) return '';
        return `
            <div class="cap-barra">
                <div class="view-toggle" role="group" aria-label="Visualização das propostas">
                    <button type="button" data-cap="vista" data-vista="lista" aria-pressed="${vista === 'lista'}">Lista</button>
                    <button type="button" data-cap="vista" data-vista="quadro" aria-pressed="${vista === 'quadro'}">Quadro</button>
                </div>
                <button type="button" class="btn btn-outline btn-small" data-cap="compartilhar-lista">Compartilhar minha lista</button>
                <button type="button" class="btn btn-ghost btn-small" data-cap="ir-cofre">Cofre de certidões</button>
                <button type="button" class="btn btn-ghost btn-small" data-cap="ir-backup">Backup</button>
            </div>
            ${avisoNavegadorHTML()}
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
                <p class="cap-texto">Guarde uma cópia ou leve para outro dispositivo: propostas, checklists, avaliações go/no-go, cofre de certidões, respostas de quem pode participar e buscas salvas vão em um único arquivo. Ele fica com você — nada é enviado para servidores.</p>
                <div class="cap-links">
                    <button type="button" class="btn btn-outline btn-small" data-cap="exportar-json">${ICONE.baixar} Exportar backup (JSON)</button>
                    <button type="button" class="btn btn-outline btn-small" data-cap="importar-json" aria-describedby="capImportAjuda">${ICONE.subir} Importar backup</button>
                    <button type="button" class="btn btn-outline btn-small" data-cap="exportar-csv">${ICONE.baixar} Exportar quadro (CSV)</button>
                    <button type="button" class="btn btn-outline btn-small" data-cap="imprimir-relatorio" aria-describedby="capRelAjuda">${ICONE.imprimir} Imprimir relatório</button>
                    <input type="file" id="capImportFile" accept=".json,application/json" hidden>
                </div>
                <p class="nota" id="capImportAjuda">Importar junta o arquivo aos dados deste navegador; registros do mesmo edital são substituídos pelos do arquivo. O CSV abre direto no Excel.</p>
                <p class="nota" id="capRelAjuda">O relatório para a diretoria sai em uma página limpa (imprima ou salve em PDF), com etapa, prazo, valor, go/no-go e próximo passo de cada proposta${usuario ? `, assinado por ${esc(usuario.nome)}` : ''}.${usuario ? '' : ' <button type="button" class="link-btn" data-action="open-login">Informe seu nome</button> para assiná-lo.'}</p>
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
            propostas, checklists: checklistsAtuais(), gonogo, cofre, elegibilidade: lerElegib(), buscas, plano: objeto(store.get('fb:plano', {})) ? store.get('fb:plano', {}) : {}
        };
        downloadFile(`radar-fomento-backup-${hojeISO()}.json`, JSON.stringify(dados, null, 2), 'application/json');
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

    /* Relatório para a diretoria: uma página limpa montada a partir das propostas e impressa com
       window.print() (o CSS de impressão esconde todo o resto). Sem bibliotecas: o navegador salva em PDF. */
    function relatorioHTML() {
        const itens = itensPropostas();
        const porEtapa = ETAPAS.map(et => [et.nome, itens.filter(x => x.p.etapa === et.k).length]).filter(([, n]) => n);
        const linha = ({ e, p }) => {
            const r = resultadoGNG(gonogo[e.id]);
            const acao = proximaAcao(e, p);
            return `<tr>
                <td>${esc(ETAPA[p.etapa].nome)}</td>
                <td><strong>${esc(e.titulo)}</strong><br><span>${esc(e.instituicao)}${e.numero ? ` · ${esc(e.numero)}` : ''}</span></td>
                <td>${fmtDate(e.encerramento)}${statusEdital(e) === 'aberto' ? `<br><span>${diasAte(e.encerramento) === 0 ? 'hoje' : `em ${plural(diasAte(e.encerramento), 'dia', 'dias')}`}</span>` : `<br><span>${esc(STATUS_LABEL[statusEdital(e)])}</span>`}</td>
                <td>${esc(valorPropostaTxt(e))}</td>
                <td>${r.k ? `${esc(GNG[r.k].nome)} (${r.total}/25)` : '—'}</td>
                <td>${esc(acao.txt)}${p.protocolo ? `<br><span>Protocolo: ${esc(p.protocolo)}</span>` : ''}</td>
            </tr>`;
        };
        return `
            <div class="rel-topo">
                <p class="rel-marca">Radar Fomento · Relatório de propostas</p>
                <h1>Propostas em acompanhamento</h1>
                <p>Gerado em ${new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}${usuario ? ` por ${esc(usuario.nome)}` : ''}. ${plural(itens.length, 'proposta', 'propostas')}${porEtapa.length ? ': ' + porEtapa.map(([n, q]) => `${q} ${esc(n.toLowerCase())}`).join(', ') : ''}.</p>
            </div>
            ${itens.length ? `<table class="rel-tabela">
                <thead><tr><th scope="col">Etapa</th><th scope="col">Edital</th><th scope="col">Prazo final</th><th scope="col">Valor por proposta</th><th scope="col">Go/no-go</th><th scope="col">Próximo passo</th></tr></thead>
                <tbody>${itens.map(linha).join('')}</tbody>
            </table>` : '<p>Nenhuma proposta em acompanhamento.</p>'}
            <p class="rel-nota">Dados organizados no navegador de quem gerou o relatório. Prazos, valores e requisitos devem ser confirmados no edital oficial de cada instituição.</p>`;
    }

    function imprimirRelatorio() {
        if (!itensPropostas().length) { showNotification('Nenhuma proposta para o relatório.', 'warning'); return; }
        let box = document.getElementById('relatorioPropostas');
        if (!box) {
            box = document.createElement('div');
            box.id = 'relatorioPropostas';
            box.className = 'relatorio-impressao';
            box.setAttribute('aria-hidden', 'true');
            document.body.appendChild(box);
        }
        box.innerHTML = relatorioHTML();
        document.body.classList.add('print-relatorio');
        const fim = () => { document.body.classList.remove('print-relatorio'); window.removeEventListener('afterprint', fim); };
        window.addEventListener('afterprint', fim);
        track('relatorio-imprimir');
        window.print();
        setTimeout(fim, 1000); // navegadores que não disparam afterprint
    }

    /* Validação do arquivo importado: nada é aceito sem checagem de tipo e tamanho.
       Devolve só dados limpos e a contagem do que foi descartado. */
    const texto = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
    const dataHora = v => (typeof v === 'string' && v.length <= 40 && !isNaN(Date.parse(v)) ? new Date(v).toISOString() : new Date().toISOString());
    const idEdital = k => /^\d{1,9}$/.test(k);

    function validarBackup(d) {
        const r = { propostas: {}, checklists: {}, gonogo: {}, cofre: [], elegibilidade: {}, buscas: [], plano: {}, ignorados: 0 };
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
            Object.entries(v).slice(0, 12).forEach(([q, b]) => { if (q.length <= 200 && (typeof b === 'boolean' || b === 'ns')) resp[q] = b; });
            r.elegibilidade[k] = resp;
        }
        if (objeto(d.plano)) for (const [k, v] of Object.entries(d.plano).slice(0, 1000)) {
            if (!idEdital(k) || !objeto(v)) { r.ignorados++; continue; }
            const m = {};
            ['cadastro', 'orcamento'].forEach(c => { if (v[c] === true) m[c] = true; });
            if (Object.keys(m).length) r.plano[k] = m;
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
        if (file.size > 2 * 1024 * 1024) { relatorio('Arquivo grande demais (máximo de 2 MB). Confira se é um backup do Radar Fomento.'); return; }
        const leitor = new FileReader();
        leitor.onload = () => {
            let bruto;
            try { bruto = JSON.parse(String(leitor.result)); } catch (_) { relatorio('O arquivo não é um JSON válido.'); return; }
            const v = validarBackup(bruto);
            if (!v) { relatorio('Este arquivo não é um backup do Radar Fomento (exportado em Minhas propostas → Exportar backup).'); return; }
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
            store.set(K.elegib, { ...lerElegib(), ...v.elegibilidade });
            { const pl = store.get('fb:plano', {}); store.set('fb:plano', { ...(objeto(pl) ? pl : {}), ...v.plano }); }
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
       8. PRIMEIRO RESULTADO EM 1 TOQUE — "Quem vai pedir o recurso?" no início
       Um toque grava o perfil (com "Desfazer") e já mostra os editais. Estado e tema
       viram "Afinar" (opcional) acima dos resultados, com o Estado sugerido pelo fuso
       horário do aparelho (sem pedir permissão, sem localização).
       Quem já usou vê "Seu próximo passo", com uma ação só.
    --------------------------------------------------------------------- */
    const DICA_PUBLICO = {
        pesquisador: 'Bolsas e auxílio para pesquisa', ict: 'Projetos da universidade ou instituto', empresa: 'Inovação e dinheiro que não precisa devolver',
        osc: 'Projetos sociais, cultura, meio ambiente', municipio: 'Obras e serviços na cidade', estado: 'Programas para o governo estadual'
    };
    const jaUsou = () => perfilAtivo() || itensPropostas().length > 0;

    function renderOnboarding(focar) {
        const box = document.getElementById('capOnboarding');
        if (!box) return;
        if (jaUsou()) { box.hidden = true; box.innerHTML = ''; return; }
        if (!focar && box.contains(document.activeElement)) return; // não redesenha debaixo do dedo
        box.hidden = false;
        box.innerHTML = `
            <h2 class="onb-titulo" id="onbTitulo">Quem vai pedir o recurso?</h2>
            <p class="onb-sub">Escolha uma opção e veja na hora os editais que servem.</p>
            <div class="onb-opcoes">${Object.entries(PUBLICOS_PERGUNTA).map(([k, t]) => `
                <button type="button" class="onb-op" data-cap="onb-pub" data-valor="${k}"><span class="onb-op-nome">${esc(t)}</span><span class="onb-op-dica">${esc(DICA_PUBLICO[k] || '')}</span></button>`).join('')}</div>
            <p class="onb-privacidade">Fica só neste aparelho. Você pode <a href="#meus-dados">ver ou apagar</a> quando quiser.</p>`;
        if (focar) { const b = box.querySelector('.onb-op'); if (b) b.focus(); }
    }

    function onbEscolherPub(k) {
        if (!PUBLICOS[k]) return;
        naoLembrarPerfil = false;
        atualizarPerfil({ publico: k });
        store.set(K.onboarding, 'feito');
        track('onboarding-concluir');
        refreshAll();
        location.hash = `editais?publico=${k}`;
    }

    // Afinar (opcional): Estado e tema em chips, acima dos resultados
    function chipAfinar(cap, valor, rotulo, ativo, extra = '') {
        return `<button type="button" class="chip-toggle afinar-chip" data-cap="${cap}" data-valor="${esc(valor)}" aria-pressed="${ativo}"${extra}>${rotulo}</button>`;
    }
    function renderAfinar() {
        const box = document.getElementById('capAfinar');
        if (!box) return;
        if (!perfilAtivo() || paginaAtual() !== 'editais') { box.innerHTML = ''; return; }
        const foco = document.activeElement && box.contains(document.activeElement)
            ? (document.activeElement.id ? '#' + document.activeElement.id : `[data-cap="${document.activeElement.dataset.cap}"][data-valor="${CSS.escape(document.activeElement.dataset.valor || '')}"]`) : null;
        const f = getFiltros();
        const sug = ufsSugeridas();
        const ufs = [...new Set([f.uf, perfil && perfil.uf, ...sug].filter(u => u && UFS[u]))].slice(0, 4);
        const unica = sug.length === 1 && !f.uf && !(perfil && perfil.uf);
        const areas = Object.keys(AREAS)
            .map(a => [a, aplicarFiltros({ ...f, area: a }).length])
            .filter(([a, n]) => n > 0 || a === f.area)
            .sort((x, y) => (y[0] === f.area) - (x[0] === f.area) || y[1] - x[1])
            .slice(0, 6);
        const curto = a => (AREAS[a] || a).split(' e ')[0];
        box.innerHTML = `
            <section class="afinar" aria-labelledby="afinarTit">
                <h2 class="afinar-tit" id="afinarTit">Afinar <span class="afinar-opc">(opcional)</span></h2>
                <div class="afinar-linha" role="group" aria-labelledby="afinarUFRot">
                    <span class="afinar-rot" id="afinarUFRot">Estado</span>
                    <div class="afinar-chips">
                        ${ufs.map(u => chipAfinar('afinar-uf', u, `${esc(UFS[u])}${unica && u === sug[0] ? ' <span class="sugestao">sugestão</span>' : ''}`, f.uf === u)).join('')}
                        ${chipAfinar('afinar-uf', '', 'Todo o Brasil', !f.uf)}
                        <label class="sr-only" for="afinarUFSel">Outro estado</label>
                        <select id="afinarUFSel" class="afinar-sel"><option value="">Outro estado…</option>${Object.entries(UFS).filter(([k]) => !ufs.includes(k)).map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join('')}</select>
                    </div>
                </div>
                ${unica ? '<p class="afinar-nota">Sugerido pelo fuso do aparelho, sem usar sua localização.</p>' : ''}
                <div class="afinar-linha" role="group" aria-labelledby="afinarTemaRot">
                    <span class="afinar-rot" id="afinarTemaRot">Tema</span>
                    <div class="afinar-chips">
                        ${areas.map(([a, n]) => chipAfinar('afinar-area', a, `${esc(curto(a))} <span class="afinar-n">${n}</span>`, f.area === a, ` aria-label="${esc(AREAS[a] || a)}: ${plural(n, 'edital', 'editais')}"`)).join('')}
                    </div>
                </div>
            </section>`;
        if (foco) { const el = box.querySelector(foco); if (el) el.focus(); }
    }
    function afinarUF(u) {
        const sel = document.getElementById('filterUF');
        if (!sel) return;
        sel.value = UFS[u] ? u : '';
        track('afinar-uf');
        filterEditais();
        anunciar(`${document.getElementById('resultsCount').textContent || ''}`.trim() || 'Resultados atualizados.');
    }
    function afinarArea(a) {
        if (!AREAS[a]) return;
        track('afinar-tema');
        escolherFaceta('area', a);
        anunciar(`${document.getElementById('resultsCount').textContent || ''}`.trim() || 'Resultados atualizados.');
    }

    // "Seu próximo passo": uma ação só, a partir do que a pessoa já fez
    function proximoPasso() {
        const ativos = itensPropostas().filter(x => ['interesse', 'preparando'].includes(x.p.etapa) && statusEdital(x.e) !== 'fechado')
            .sort((a, b) => a.e.encerramento.localeCompare(b.e.encerramento));
        if (ativos.length) {
            const { e } = ativos[0];
            const t = trilhaDe(e);
            const d = diasAte(e.encerramento);
            const prazo = statusEdital(e) === 'em-breve' ? `Abre em ${fmtDate(e.abertura)}` : d === 0 ? 'Encerra hoje' : d === 1 ? 'Encerra amanhã' : `Encerra em ${d} dias (${fmtDate(e.encerramento)})`;
            let txt, btn, foco;
            if (!t.etapas[1].feito && t.v.estado !== 'nao') { txt = 'Confira se você pode concorrer. Uma pergunta por vez.'; btn = 'Conferir agora'; foco = 'posso'; }
            else if (t.v.estado === 'nao' && !t.etapas[1].feito) { txt = 'Pelo que você respondeu, este edital não serve. Veja outros parecidos.'; btn = 'Ver o edital'; foco = 'posso'; }
            else if (t.docs < t.tot) { txt = `Marque os documentos que você já tem (${t.docs} de ${t.tot}).`; btn = 'Abrir o checklist'; foco = 'checklist'; }
            else if (!t.marcas.cadastro) { txt = `Faça o cadastro em ${sistemaDe(e)} e marque como feito.`; btn = 'Ver o passo a passo'; foco = 'plano'; }
            else if (!t.marcas.orcamento) { txt = 'Escreva a proposta, com orçamento e cronograma.'; btn = 'Ver o passo a passo'; foco = 'plano'; }
            else { txt = `Envie a proposta no portal oficial até ${fmtDate(e.encerramento)}. Depois, marque aqui.`; btn = 'Ver o passo a passo'; foco = 'plano'; }
            return { e, t, prazo, txt, btn, foco, urgente: d <= 7 && statusEdital(e) === 'aberto' };
        }
        const espera = itensPropostas().find(x => x.p.etapa === 'submetida');
        if (espera) return { e: espera.e, t: trilhaDe(espera.e), prazo: espera.e.resultado ? `Resultado previsto para ${fmtDate(espera.e.resultado)}` : 'Aguardando o resultado',
            txt: 'Quando sair o resultado, registre em Minhas propostas.', btn: 'Abrir Minhas propostas', href: '#propostas' };
        if (perfilAtivo() && perfil.publico) {
            const n = editais.filter(e => statusEdital(e) !== 'fechado' && e.publico.includes(perfil.publico) && (!perfil.uf || atendeUF(e, perfil.uf))).length;
            return { txt: n ? `Escolha um edital para começar. ${n === 1 ? 'Um serve' : `${n} servem`} para ${PUBLICOS[perfil.publico]}${perfil.uf ? ` em ${UFS[perfil.uf]}` : ''}.` : 'Nada aberto para você hoje. Veja os que abrem em breve.',
                btn: n ? `Ver ${n === 1 ? 'o edital' : `os ${n} editais`}` : 'Ver editais', href: `#editais?publico=${perfil.publico}${perfil.uf ? `&uf=${perfil.uf}` : ''}` };
        }
        return null;
    }
    function renderProximo() {
        const box = document.getElementById('capProximo');
        if (!box) return;
        const pp = jaUsou() ? proximoPasso() : null;
        if (!pp) { box.innerHTML = ''; return; }
        const acao = pp.href
            ? `<a class="btn btn-primary proximo-btn" href="${esc(pp.href)}" data-evento="proximo-passo">${esc(pp.btn)} <span aria-hidden="true">→</span></a>`
            : `<button type="button" class="btn btn-primary proximo-btn" data-cap="proximo-abrir" data-id="${pp.e.id}" data-foco="${pp.foco}">${esc(pp.btn)} <span aria-hidden="true">→</span></button>`;
        box.innerHTML = `
            <section class="proximo" aria-labelledby="proximoTit">
                <h2 class="proximo-tit" id="proximoTit">Seu próximo passo</h2>
                ${pp.e ? `<p class="proximo-edital"><strong>${esc(pp.e.titulo)}</strong> <span class="proximo-prazo${pp.urgente ? ' urgente' : ''}">${esc(pp.prazo)}</span></p>
                    ${trilhaHTML(pp.e, { compacta: true })}` : ''}
                <p class="proximo-txt">${esc(pp.txt)}</p>
                ${acao}
            </section>`;
    }
    function abrirProximo(id, foco) {
        openEdital(id);
        const alvo = foco === 'posso' ? document.getElementById(`possoTitulo-${id}`)
            : foco === 'checklist' ? document.getElementById(`checklistTitulo-${id}`)
            : document.getElementById(`planoTitulo-${id}`);
        if (alvo) { alvo.scrollIntoView({ block: 'start' }); alvo.focus({ preventScroll: true }); }
    }

    /* ---------------------------------------------------------------------
       8b. CONQUISTAS E CELEBRAÇÃO — ligadas a ações reais; sem pontos, ranking ou sequência
       fb:conquistas = { chave: data ISO da primeira vez }. fb:trilha = { id: etapas feitas }.
    --------------------------------------------------------------------- */
    K.conquistas = 'fb:conquistas';
    K.conquistasOcultas = 'fb:conquistasOcultas';
    K.trilha = 'fb:trilha';
    K.planoIcs = 'fb:planoIcs';
    const CONQUISTAS = [
        { k: 'salvo', nome: 'Primeiro edital salvo', como: 'Toque em “Quero participar” ou na estrela de um edital.', tem: () => itensPropostas().length > 0 || favorites.length > 0 },
        { k: 'pode', nome: 'Você pode concorrer!', como: 'Responda “Posso concorrer?” até ver “Sim”.', tem: () => itensPropostas().some(x => trilhaDe(x.e).v.estado === 'sim') },
        { k: 'plano', nome: 'Plano no calendário', como: 'No passo a passo, toque em “Pôr tudo no meu calendário”.', tem: () => !!ler(K.planoIcs, null) },
        { k: 'docs', nome: 'Documentos prontos', como: 'Marque todos os documentos do checklist de um edital.', tem: () => itensPropostas().some(x => x.e.documentos.length && docsProntos(x.e) === x.e.documentos.length) },
        { k: 'cofre', nome: 'Certidão no cofre', como: 'Guarde a validade de uma certidão no cofre, abaixo.', tem: () => cofre.length > 0 },
        { k: 'enviada', nome: 'Proposta enviada — marcada por você', como: 'Depois de enviar no portal oficial, toque em “Já enviei”.', tem: () => itensPropostas().some(x => ENVIADAS.includes(x.p.etapa)) }
    ];
    function conquistasGuardadas() { const v = ler(K.conquistas, {}); return objeto(v) ? v : {}; }
    // Registra as conquistas novas e devolve os nomes (uma conquista não "some" se a pessoa desfaz depois)
    function verificarConquistas(extra) {
        const g = { ...conquistasGuardadas() };
        const novas = [];
        for (const c of CONQUISTAS) {
            if (g[c.k]) continue;
            let tem = false;
            try { tem = (extra && extra[c.k]) || c.tem(); } catch (_) { tem = false; }
            if (tem) { g[c.k] = new Date().toISOString(); novas.push(c.nome); }
        }
        if (novas.length) store.set(K.conquistas, g);
        return novas;
    }
    function conquistasHTML() {
        const g = conquistasGuardadas();
        if (ler(K.conquistasOcultas, null) === '1') return `<p class="conq-oculta nota">Conquistas escondidas. <button type="button" class="link-btn" data-cap="conq-mostrar">Mostrar</button></p>`;
        const n = CONQUISTAS.filter(c => g[c.k]).length;
        return `
            <section class="conq" aria-labelledby="conqTit">
                <div class="conq-topo">
                    <h2 class="conq-tit" id="conqTit">Minhas conquistas <span class="conq-n">${n} de ${CONQUISTAS.length}</span></h2>
                    <button type="button" class="btn btn-ghost btn-small" data-cap="conq-esconder">Esconder</button>
                </div>
                <ul class="conq-lista">${CONQUISTAS.map(c => g[c.k]
                    ? `<li class="conq-item tem"><span class="conq-selo" aria-hidden="true"></span><span><strong>${esc(c.nome)}</strong><span class="nota">em ${dataBR(g[c.k])}</span></span></li>`
                    : `<li class="conq-item"><span class="conq-selo" aria-hidden="true"></span><span><strong><span class="sr-only">Ainda não: </span>${esc(c.nome)}</strong><span class="nota">${esc(c.como)}</span></span></li>`).join('')}</ul>
                <p class="nota conq-rodape">Cada conquista vem de algo útil que você fez. Sem pontos, ranking ou prazo. Fica só neste aparelho.</p>
            </section>`;
    }
    function renderConquistas() {
        const box = document.getElementById('capConquistas');
        if (box) box.innerHTML = conquistasHTML();
    }

    // Região viva própria: a celebração não atropela o anúncio da resposta
    function anunciarCelebracao(msg) {
        let r = document.getElementById('capCelebra');
        if (!r) { r = document.createElement('div'); r.id = 'capCelebra'; r.className = 'sr-only'; r.setAttribute('role', 'status'); r.setAttribute('aria-live', 'polite'); document.body.appendChild(r); }
        r.textContent = '';
        setTimeout(() => { r.textContent = msg; }, 250);
    }
    // Etapa da trilha concluída: pontos do radar se acendem (sem animação com movimento reduzido) e anúncio aria-live
    function celebrarTrilha(e) {
        if (!e) return;
        const mem = { ...(objeto(ler(K.trilha, {})) ? ler(K.trilha, {}) : {}) };
        const t = trilhaDe(e);
        const antes = Number(mem[e.id]) || 0;
        const novas = verificarConquistas();
        if (t.feitas !== antes) { mem[e.id] = t.feitas; store.set(K.trilha, mem); }
        const partes = [];
        if (t.feitas > antes) {
            const feita = [...t.etapas].reverse().find(x => x.feito);
            partes.push(`Etapa feita: ${feita.nome}. Prontidão: ${t.pct}%.`);
            const el = document.getElementById(`trilha-${e.id}`);
            if (el) { el.classList.remove('celebra'); void el.offsetWidth; el.classList.add('celebra'); }
        }
        if (novas.length) {
            partes.push(`Nova conquista: ${novas.join(', ')}.`);
            const el = document.getElementById(`trilha-${e.id}`);
            if (el && !el.querySelector('.trilha-conquista')) el.insertAdjacentHTML('beforeend', `<p class="trilha-conquista">Nova conquista: <strong>${esc(novas.join(', '))}</strong> · <a href="#propostas">ver em Minhas propostas</a></p>`);
        }
        if (partes.length) anunciarCelebracao(partes.join(' '));
    }

    /* ---------------------------------------------------------------------
       9. "DESDE SUA ÚLTIMA VISITA" — faixa no início
       Guarda o dia da visita (fb:ultimaVisita), os ids vistos e os prazos; na volta, compara.
    --------------------------------------------------------------------- */
    function prepararDesde() {
        const hoje = hojeISO();
        const ultima = ler(K.ultimaVisita, '');
        if (isoValido(ultima) && ultima < hoje) {
            store.set(K.desde, { data: ultima, ids: ler(K.vistosIds, null), prazos: ler(K.vistosPrazos, null) });
        }
        store.set(K.ultimaVisita, hoje);
    }
    // O retrato desta visita (o que a pessoa já viu) — refeito quando os dados publicados chegam
    function guardarVistos() {
        store.set(K.vistosIds, editais.map(e => e.id));
        store.set(K.vistosPrazos, Object.fromEntries(editais.map(e => [e.id, e.encerramento])));
    }
    let desdeIds = [];
    function renderDesde() {
        const box = document.getElementById('capDesde');
        if (!box) return;
        const d = ler(K.desde, null);
        const hoje = hojeISO();
        if (!objeto(d) || !isoValido(d.data) || d.data >= hoje || ler(K.desdeFechado, '') === hoje) { box.innerHTML = ''; return; }
        const ids = Array.isArray(d.ids) ? new Set(d.ids) : null;
        const servem = e => statusEdital(e) !== 'fechado' && (!perfilAtivo() || (avaliarCompat(e) || {}).elegivel);
        const novos = editais.filter(e => servem(e) && !e.custom && (ids ? !ids.has(e.id) : (e.publicadoEm && e.publicadoEm > d.data)));
        const mudaram = objeto(d.prazos) ? editais.filter(e => d.prazos[e.id] && d.prazos[e.id] !== e.encerramento && statusEdital(e) !== 'fechado') : [];
        const fav = editais.filter(e => favorites.includes(e.id) && statusEdital(e) === 'aberto' && diasAte(e.encerramento) <= 15)
            .sort((a, b) => a.encerramento.localeCompare(b.encerramento))[0];
        if (!novos.length && !mudaram.length && !fav) { box.innerHTML = ''; return; }
        const partes = [];
        if (novos.length) partes.push(`${novos.length === 1 ? '1 novo' : `${novos.length} novos`}${perfilAtivo() ? ' para você' : ''}`);
        if (mudaram.length) partes.push(plural(mudaram.length, 'prazo mudou', 'prazos mudaram'));
        if (fav) {
            const n = diasAte(fav.encerramento);
            const curto = fav.titulo.length > 60 ? fav.titulo.slice(0, 57).replace(/\s+\S*$/, '') + '…' : fav.titulo;
            partes.push(`${esc(curto)} fecha ${n === 0 ? 'hoje' : n === 1 ? 'amanhã' : `em ${n} dias`}`);
        }
        desdeIds = [...new Set([...novos, ...mudaram, ...(fav ? [fav] : [])].map(e => e.id))];
        box.innerHTML = `
            <section class="desde" aria-labelledby="desdeTitulo">
                <p id="desdeTitulo"><strong>Desde ${fmtDate(d.data).slice(0, 5)}:</strong> ${partes.join(' · ')}</p>
                <div class="desde-acoes">
                    <button type="button" class="btn btn-primary btn-small" data-cap="desde-ver" data-evento="novidades-ver">Ver</button>
                    <button type="button" class="btn btn-ghost btn-small" data-cap="desde-fechar" aria-label="Fechar o aviso de novidades">Fechar</button>
                </div>
            </section>`;
    }
    function desdeVer() {
        store.set(K.desdeFechado, hojeISO());
        location.hash = `lista?ids=${desdeIds.join(',')}&de=novidades`;
    }
    function desdeFechar() {
        store.set(K.desdeFechado, hojeISO());
        renderDesde();
        const h = document.getElementById('destaquesTitulo');
        if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
    }

    /* ---------------------------------------------------------------------
       10. PESQUISA DE 1 PERGUNTA (CES) — no detalhe, depois de "Portal oficial" ou "Quero participar"
       Sem texto livre; não pergunta de novo por 30 dias (fb:ces).
    --------------------------------------------------------------------- */
    let cesPendente = null;
    function cesPodePerguntar() {
        const c = ler(K.ces, null);
        return !objeto(c) || !c.em || isNaN(Date.parse(c.em)) || Date.now() - Date.parse(c.em) > 30 * 86400000;
    }
    function mostrarCES(id) {
        if (!id || !cesPodePerguntar()) return;
        cesPendente = id;
        reinserirCES(id);
    }
    function reinserirCES(id) {
        if (cesPendente !== id) return;
        const slot = document.querySelector(`#editalModal [data-ces-slot="${id}"]`);
        if (!slot || slot.querySelector('.ces')) return;
        slot.innerHTML = `
            <div class="ces" role="group" aria-labelledby="cesPergunta">
                <p id="cesPergunta"><strong>Foi fácil encontrar o que procurava?</strong></p>
                <div class="ces-opcoes">
                    <button type="button" class="btn btn-outline btn-small" data-cap="ces" data-valor="facil">Fácil</button>
                    <button type="button" class="btn btn-outline btn-small" data-cap="ces" data-valor="medio">Mais ou menos</button>
                    <button type="button" class="btn btn-outline btn-small" data-cap="ces" data-valor="dificil">Difícil</button>
                </div>
            </div>`;
    }
    function responderCES(v) {
        if (!['facil', 'medio', 'dificil'].includes(v)) return;
        track(`ces-${v}`);
        store.set(K.ces, { em: new Date().toISOString(), resposta: v });
        cesPendente = null;
        const slot = document.querySelector('#editalModal .ces-slot');
        if (slot) {
            slot.innerHTML = '<p class="ces-obrigado" role="status" tabindex="-1">Obrigado</p>';
            slot.firstChild.focus();
        }
    }
    // Reconhece o clique na captura (antes de o index.html redesenhar o modal) e pergunta logo depois
    document.addEventListener('click', ev => {
        const a = ev.target.closest && ev.target.closest('#editalModal [data-action="external"], #editalModal [data-action="follow"]');
        if (!a) return;
        const id = Number(document.getElementById('editalModal').dataset.id);
        setTimeout(() => seguro(() => mostrarCES(id)), 0);
    }, true);

    /* ---------------------------------------------------------------------
       11. LISTA COMPARTILHÁVEL — #lista?ids=101,1056835
    --------------------------------------------------------------------- */
    function idsDaLista() {
        const p = new URLSearchParams(location.hash.split('?')[1] || '');
        return [...new Set(String(p.get('ids') || '').split(',').map(s => s.trim()).filter(s => /^\d{1,9}$/.test(s)).map(Number))].slice(0, 100);
    }
    function renderLista() {
        const box = document.getElementById('capLista');
        if (!box) return;
        const ids = idsDaLista();
        const novidades = new URLSearchParams(location.hash.split('?')[1] || '').get('de') === 'novidades';
        const achados = ids.map(id => editais.find(e => e.id === id)).filter(Boolean);
        const faltam = ids.length - achados.length;
        document.getElementById('capListaSub').textContent = novidades ? 'O que mudou desde a sua última visita'
            : achados.length ? `${plural(achados.length, 'edital escolhido', 'editais escolhidos')} por quem compartilhou este link` : 'Lista vazia';
        box.innerHTML = achados.length ? `
            <div class="lista-topo">
                <p class="nota">${plural(achados.length, 'edital', 'editais')}${faltam ? ` · ${plural(faltam, 'não está mais no site', 'não estão mais no site')}` : ''}. Toque em <strong>Posso concorrer?</strong> para ver se cada um serve para você.</p>
                <button type="button" class="btn btn-outline btn-small" data-cap="lista-copiar">Copiar o link desta lista</button>
            </div>
            <div class="lista-editais">${achados.map(e => editalCardHTML(e)).join('')}</div>`
            : `<div class="card empty-state"><div class="empty-state-title">Nenhum edital nesta lista</div>
                <p>O link pode estar incompleto ou os editais saíram do site.</p>
                <a class="btn btn-primary" href="#editais">Ver todos os editais</a></div>`;
        document.title = `Lista de editais · Radar Fomento`;
    }
    function linkDaLista(ids) {
        const base = /^https?:$/.test(location.protocol) ? location.href.split('#')[0] : (baseSite() || location.href.split('#')[0]);
        return `${base}#lista?ids=${ids.join(',')}`;
    }
    async function compartilharLink(url, titulo, texto) {
        if (navigator.share) {
            try { await navigator.share({ title: titulo, text: texto, url }); } catch (_) { /* cancelado */ }
            return;
        }
        try { await navigator.clipboard.writeText(url); showNotification('Link copiado. Cole onde quiser compartilhar.'); }
        catch (_) { prompt('Copie o link:', url); }
    }
    function compartilharLista() {
        const ids = itensPropostas().map(x => x.e.id);
        if (!ids.length) { showNotification('Escolha um edital primeiro.', 'warning'); return; }
        track('lista-compartilhar');
        compartilharLink(linkDaLista(ids), 'Minha lista de editais', `${plural(ids.length, 'edital', 'editais')} que estou acompanhando no Radar Fomento`);
    }

    /* ---------------------------------------------------------------------
       12. AVISO NO NAVEGADOR (opcional) — só depois que a pessoa pede; nunca pedimos sozinhos
    --------------------------------------------------------------------- */
    const notifSuportada = () => 'Notification' in window;
    function avisoNavegadorHTML() {
        if (!notifSuportada()) return '';
        const ligado = ler(K.notificar, null) === '1' && Notification.permission === 'granted';
        if (ligado) return `<p class="cap-notif nota">Avisos neste navegador ligados: quando você abrir o site e um prazo estiver perto. <button type="button" class="link-btn" data-cap="parar-notificacao">Desligar</button></p>`;
        if (Notification.permission === 'denied') return '<p class="cap-notif nota">Os avisos deste site estão bloqueados nas configurações do navegador.</p>';
        return '<p class="cap-notif"><button type="button" class="btn btn-ghost btn-small" data-cap="pedir-notificacao">Avisar neste navegador quando eu abrir o site e algo estiver perto do prazo</button></p>';
    }
    async function pedirNotificacao() {
        if (!notifSuportada()) return;
        let p = Notification.permission;
        if (p === 'default') { try { p = await Notification.requestPermission(); } catch (_) { p = 'denied'; } }
        if (p === 'granted') {
            store.set(K.notificar, '1');
            track('notificacao-ligar');
            showNotification('Pronto: quando você abrir o site e um prazo estiver perto, avisamos neste navegador.');
            avisarPrazosNoNavegador(true);
        } else showNotification('O navegador não permitiu os avisos. Dá para mudar nas configurações do site.', 'warning');
        if (paginaAtual() === 'propostas') renderPropostas();
        if (paginaAtual() === 'meus-dados') renderMeusDados();
    }
    function avisarPrazosNoNavegador(forcar) {
        if (!notifSuportada() || Notification.permission !== 'granted' || ler(K.notificar, null) !== '1') return;
        const hoje = hojeISO();
        if (!forcar && ler(K.notificadoEm, '') === hoje) return;
        const lista = alertasDePrazo();
        if (!lista.length) return;
        store.set(K.notificadoEm, hoje);
        const e = lista[0], n = diasAte(e.encerramento);
        try {
            new Notification('Radar Fomento: prazo perto', {
                body: `${e.titulo}: ${n === 0 ? 'encerra hoje' : n === 1 ? 'encerra amanhã' : `faltam ${n} dias`}${lista.length > 1 ? ` (e mais ${lista.length - 1})` : ''}`,
                tag: 'fundos-brasil-prazos'
            });
        } catch (_) { /* alguns celulares só aceitam avisos por service worker */ }
    }

    /* ---------------------------------------------------------------------
       13. MEUS DADOS — #meus-dados: o que está salvo, com datas; exportar e apagar tudo
    --------------------------------------------------------------------- */
    const CHAVES_MINHAS = /^(favorites|perfil|propostas|editaisCustom|vistos|prestacoes|usuario|pcSeq|checklist-|rascunho-pc-|fb:)/;
    const dataBR = iso => (iso && !isNaN(Date.parse(iso)) ? new Date(iso).toLocaleDateString('pt-BR') : '—');
    const maisRecente = lista => lista.filter(x => x && !isNaN(Date.parse(x))).sort().pop() || '';
    function renderMeusDados() {
        const box = document.getElementById('capMeusDados');
        if (!box) return;
        const props = itensPropostas();
        const favs = (store.get('favorites', []) || []).filter(Number.isInteger);
        const eleg = lerElegib();
        const d = ler(K.desde, null);
        const linhas = [
            ['Sobre você (perfil)', perfilAtivo() ? resumoPerfil() : 'Nada salvo', perfilAtivo() ? dataBR(ler('fb:perfilEm', '')) : '—',
                '<button type="button" class="link-btn" data-action="edit-perfil">Ver ou mudar</button>'],
            ['Favoritos', plural(favs.length, 'edital', 'editais'), favs.length ? dataBR(ler('fb:favoritosEm', '')) : '—', favs.length ? '<a href="#editais?fav=1">Ver</a>' : ''],
            ['Minhas propostas', plural(props.length, 'edital escolhido', 'editais escolhidos'), props.length ? dataBR(maisRecente(props.map(x => x.p.atualizadoEm))) : '—', props.length ? '<a href="#propostas">Ver</a>' : ''],
            ['Cofre de certidões', plural(cofre.length, 'documento', 'documentos'), cofre.length ? dataBR(maisRecente(cofre.map(x => x.atualizadoEm))) : '—', cofre.length ? '<a href="#propostas">Ver</a>' : ''],
            ['Buscas salvas', plural(buscas.length, 'busca', 'buscas'), buscas.length ? dataBR(maisRecente(buscas.map(x => x.criadoEm))) : '—', ''],
            ['Respostas de “quem pode participar”', plural(Object.keys(eleg).length, 'edital respondido', 'editais respondidos'), '—', ''],
            ['Última visita', objeto(d) && isoValido(d.data) ? `antes de hoje: ${fmtDate(d.data)}` : 'Primeira visita neste aparelho', dataBR(ler(K.ultimaVisita, '') ? ler(K.ultimaVisita, '') + 'T12:00:00' : ''), ''],
            ['Passos marcados e conquistas', plural(Object.keys(conquistasGuardadas()).length, 'conquista', 'conquistas'), maisRecente(Object.values(conquistasGuardadas())) ? dataBR(maisRecente(Object.values(conquistasGuardadas()))) : '—', '<a href="#propostas">Ver</a>'],
            ['Seu nome nos relatórios', usuario ? usuario.nome : 'Não informado', '—', ''],
            ['Aviso neste navegador', ler(K.notificar, null) === '1' ? 'Ligado' : 'Desligado', '—', '']
        ];
        box.innerHTML = `
            <p class="aviso-local" role="note">${ICONE.cadeado}<span><strong>Nada disto sai do seu aparelho.</strong> Não há conta nem cadastro: tudo fica no armazenamento deste navegador. Se você limpar os dados do site ou trocar de aparelho, eles não estarão lá.</span></p>
            <div class="compare-table-wrap">
                <table class="projetos-table meus-dados-tabela">
                    <caption class="sr-only">O que está salvo neste aparelho</caption>
                    <thead><tr><th scope="col">O quê</th><th scope="col">Situação</th><th scope="col">Última mudança</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead>
                    <tbody>${linhas.map(([o, s, q, a]) => `<tr><th scope="row">${esc(o)}</th><td>${esc(s)}</td><td>${esc(q)}</td><td>${a}</td></tr>`).join('')}</tbody>
                </table>
            </div>
            ${avisoNavegadorHTML()}
            <div class="modal-actions meus-dados-acoes">
                <button type="button" class="btn btn-outline" data-cap="meus-exportar">${ICONE.baixar} Exportar</button>
                <button type="button" class="btn btn-danger" data-cap="meus-apagar">Apagar tudo</button>
            </div>
            <p class="nota">Exportar baixa um arquivo .json com tudo isso. Apagar tudo remove os dados deste aparelho e volta ao início, como na primeira visita. Para levar só as propostas para outro aparelho, use o <a href="#propostas">backup de Minhas propostas</a>.</p>`;
    }
    function exportarMeusDados() {
        const dados = {};
        try {
            Object.keys(localStorage).forEach(k => { if (CHAVES_MINHAS.test(k)) dados[k] = store.get(k, null); });
        } catch (_) { /* armazenamento indisponível */ }
        downloadFile(`radar-fomento-meus-dados-${hojeISO()}.json`, JSON.stringify({ formato: 'fundos-brasil/meus-dados', versao: 1, exportadoEm: new Date().toISOString(), dados }, null, 2), 'application/json');
        track('meus-dados-exportar');
        showNotification('Arquivo com seus dados baixado.');
    }
    function apagarTudo() {
        track('meus-dados-apagar');
        limparDados(); // confirma, apaga as chaves deste site e recarrega no início ("Quem vai pedir o recurso?" volta)
    }
    window.renderMeusDados = () => seguro(renderMeusDados);
    window.renderLista = () => seguro(renderLista);

    /* ---------------------------------------------------------------------
       GANCHOS NO SCRIPT PRINCIPAL (sem duplicar renderizações)
       Funções globais do index.html são reatribuídas por invólucros que chamam a
       original e depois acrescentam o que é desta camada.
    --------------------------------------------------------------------- */
    const original = { openEdital, renderPropostas, syncUrl, renderDashboardStats, toggleChecklist, toggleFavorite, baixarPlanoICS };

    openEdital = function (id) {
        original.openEdital(id);
        seguro(() => reinserirCES(id));
        seguro(() => celebrarTrilha(editais.find(x => x.id === id)));
        // O cabeçalho do modal fica preso no topo: o que rolamos até ele (Posso concorrer?, plano, checklist) não some atrás dele
        seguro(() => { const m = document.getElementById('editalModal'), c = m && m.querySelector('.modal-header'); if (c) m.style.setProperty('--cab', c.offsetHeight + 'px'); });
    };

    // syncUrl roda ao fim de todo filterEditais (inclusive na busca com atraso): ponto único para "filtros mudaram"
    syncUrl = function (f) {
        original.syncUrl(f);
        seguro(() => atualizarFerramentasBusca(f));
        seguro(renderAfinar);
    };

    renderDashboardStats = function () {
        original.renderDashboardStats();
        seguro(renderBuscas);
        seguro(() => renderOnboarding(false));
        seguro(renderProximo);
        seguro(renderDesde);
        seguro(guardarVistos);
    };

    // Checklist muda sem redesenhar o modal: atualiza a trilha e celebra se uma etapa fechou
    toggleChecklist = function (id, index, checked) {
        original.toggleChecklist(id, index, checked);
        seguro(() => { atualizarTrilha(id); celebrarTrilha(editais.find(x => x.id === id)); });
    };
    toggleFavorite = function (id) {
        original.toggleFavorite(id);
        seguro(() => verificarConquistas());
    };
    baixarPlanoICS = function (id) {
        original.baixarPlanoICS(id);
        seguro(() => {
            if (!ler(K.planoIcs, null)) store.set(K.planoIcs, new Date().toISOString());
            celebrarTrilha(editais.find(x => x.id === id));
        });
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
        seguro(() => { verificarConquistas(); renderConquistas(); });
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
            case 'mover-dir': mover(Number(id), el.dataset.etapa, el.dataset.dir); break;
            case 'imprimir-relatorio': imprimirRelatorio(); break;
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
            case 'compartilhar-lista': compartilharLista(); break;
            case 'pedir-notificacao': pedirNotificacao(); break;
            case 'parar-notificacao': store.set(K.notificar, null); showNotification('Pronto: não vamos mais avisar neste navegador.'); renderPropostas(); if (paginaAtual() === 'meus-dados') renderMeusDados(); break;
            case 'onb-pub': onbEscolherPub(el.dataset.valor); break;
            case 'afinar-uf': afinarUF(el.dataset.valor); break;
            case 'afinar-area': afinarArea(el.dataset.valor); break;
            case 'proximo-abrir': abrirProximo(Number(id), el.dataset.foco); break;
            case 'conq-esconder': store.set(K.conquistasOcultas, '1'); renderConquistas(); { const b = document.querySelector('[data-cap="conq-mostrar"]'); if (b) b.focus(); } break;
            case 'conq-mostrar': store.set(K.conquistasOcultas, null); renderConquistas(); { const t = document.getElementById('conqTit'); if (t) { t.setAttribute('tabindex', '-1'); t.focus(); } } break;
            case 'lista-copiar': compartilharLink(location.href, 'Lista de editais', 'Editais no Radar Fomento'); break;
            case 'desde-ver': desdeVer(); break;
            case 'desde-fechar': desdeFechar(); break;
            case 'ces': responderCES(el.dataset.valor); break;
            case 'meus-exportar': exportarMeusDados(); break;
            case 'meus-apagar': apagarTudo(); break;
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
        if (el.id === 'afinarUFSel' && el.value) afinarUF(el.value);
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
    seguro(prepararDesde);
    seguro(() => renderOnboarding(false));
    seguro(renderDesde);
    // Aviso no navegador: só se a pessoa ligou antes (nunca pede permissão sozinho)
    setTimeout(() => seguro(() => avisarPrazosNoNavegador(false)), 1500);
})();
