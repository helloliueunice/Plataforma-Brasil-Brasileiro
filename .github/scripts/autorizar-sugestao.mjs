#!/usr/bin/env node
/**
 * Decide se uma sugestão de edital (issue) pode ser analisada pela IA.
 *
 * Regras:
 *  - Quem disparou o evento (autor da issue, em "opened"; quem aplicou o rótulo, em "labeled")
 *    precisa ter permissão de escrita no repositório (admin, maintain ou write), consultada na API:
 *    GET /repos/{owner}/{repo}/collaborators/{user}/permission. "triage" pode rotular, mas não aprova.
 *  - Em "labeled" (rótulo sugestao-aprovada), a aprovação vale para o texto que existia no momento do
 *    rótulo: guardamos o hash do corpo que veio no evento e o comparamos com o corpo atual da issue;
 *    se mudou, ou se a issue foi editada depois do rótulo (lastEditedAt, via GraphQL), recusamos.
 *    O rótulo também precisa continuar aplicado.
 *  - O link analisado é extraído do corpo aprovado (o do evento), nunca interpolado no shell.
 *
 * Saídas (GITHUB_OUTPUT): ok=1|0, url=<link>, motivo=<texto nosso, sem conteúdo da issue>, avisar=1|0.
 * Variáveis: GITHUB_TOKEN (ou GH_TOKEN), GITHUB_REPOSITORY, GITHUB_EVENT_PATH, GITHUB_OUTPUT,
 *            GITHUB_API_URL (padrão https://api.github.com) e GITHUB_GRAPHQL_URL (testes).
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const ROTULO = 'sugestao-aprovada';
export const PERMISSOES_OK = new Set(['admin', 'maintain', 'write']);
export const hashCorpo = s => crypto.createHash('sha256').update(String(s ?? '').replace(/\r\n/g, '\n')).digest('hex');

// Primeiro link http(s) do corpo, sem pontuação final. Sem espaços nem quebras: seguro para GITHUB_OUTPUT.
export function extrairLink(corpo) {
    const m = String(corpo || '').match(/https?:\/\/[^\s<>()"'\]`]+/i);
    return m ? m[0].replace(/[.,;:!?]+$/, '') : '';
}

/**
 * Lógica pura (testável): recebe o evento e funções de consulta e devolve { ok, motivo, url, avisar }.
 * consultas: { permissao(login) → string, issue() → {body, state, labels:[{name}]},
 *              ultimoRotulo() → {created_at, actor} | null, editadaEm() → ISO | null }
 */
export async function decidir(ev, consultas) {
    const acao = ev.action;
    const issue = ev.issue || {};
    const quem = ev.sender && ev.sender.login;
    const negar = (motivo, avisar = false) => ({ ok: false, motivo, url: '', avisar });
    if (issue.state !== 'open') return negar('a issue não está aberta');
    if (!quem) return negar('evento sem remetente');
    if (ev.sender.type === 'Bot') return negar('eventos de bots não aprovam sugestões');

    let perm = 'none';
    try { perm = (await consultas.permissao(quem)) || 'none'; } catch (_) { perm = 'none'; }
    if (!PERMISSOES_OK.has(perm)) {
        return acao === 'labeled'
            ? negar(`o rótulo "${ROTULO}" só vale quando aplicado por quem tem permissão de escrita no repositório (permissão encontrada: ${perm})`, true)
            : negar(`autor sem permissão de escrita (${perm}); a sugestão aguarda o rótulo "${ROTULO}"`);
    }

    if (acao === 'labeled') {
        if (!ev.label || ev.label.name !== ROTULO) return negar('rótulo diferente do de aprovação');
        const aprovado = hashCorpo(issue.body);
        const atual = await consultas.issue();
        if (!atual) return negar('não foi possível ler a issue', true);
        if (atual.state !== 'open') return negar('a issue foi fechada');
        if (hashCorpo(atual.body) !== aprovado) return negar('o texto da issue mudou depois que o rótulo foi aplicado; revise o texto, remova e aplique o rótulo de novo', true);
        if (!(atual.labels || []).some(l => (l && (l.name || l)) === ROTULO)) return negar('o rótulo de aprovação foi removido');
        const rot = await consultas.ultimoRotulo();
        if (!rot || !rot.created_at) return negar('não encontramos o registro do rótulo na issue', true);
        if (rot.actor && rot.actor !== quem) return negar('o último rótulo de aprovação foi aplicado por outra pessoa; aguardando o evento dela');
        let editada = null;
        try { editada = await consultas.editadaEm(); } catch (_) { editada = null; } // o hash já cobre mudanças no corpo
        if (editada && Date.parse(editada) > Date.parse(rot.created_at)) return negar('a issue foi editada depois que o rótulo foi aplicado; revise o texto, remova e aplique o rótulo de novo', true);
    } else if (acao !== 'opened') {
        return negar(`ação não tratada (${acao})`);
    }

    const url = extrairLink(issue.body);
    return { ok: true, motivo: '', url, avisar: false };
}

/* ------------------------- Execução no GitHub Actions ------------------------- */
async function principal() {
    const ev = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const repo = process.env.GITHUB_REPOSITORY;
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
    const API = (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/, '');
    const GQL = process.env.GITHUB_GRAPHQL_URL || `${API}/graphql`;
    const num = ev.issue && ev.issue.number;
    const cab = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'fundos-brasil-sugestao' };
    const get = async caminho => {
        const r = await fetch(`${API}${caminho}`, { headers: cab, signal: AbortSignal.timeout(20000) });
        if (!r.ok) throw new Error(`HTTP ${r.status} em ${caminho}`);
        return r.json();
    };
    const [dono, nome] = repo.split('/');
    const consultas = {
        permissao: async login => (await get(`/repos/${repo}/collaborators/${encodeURIComponent(login)}/permission`)).permission,
        issue: async () => get(`/repos/${repo}/issues/${num}`),
        ultimoRotulo: async () => {
            let ultimo = null;
            for (let pagina = 1; pagina <= 10; pagina++) {
                const lista = await get(`/repos/${repo}/issues/${num}/events?per_page=100&page=${pagina}`);
                for (const e of lista) if (e.event === 'labeled' && e.label && e.label.name === ROTULO) ultimo = { created_at: e.created_at, actor: e.actor && e.actor.login };
                if (lista.length < 100) break;
            }
            return ultimo;
        },
        editadaEm: async () => {
            const r = await fetch(GQL, {
                method: 'POST', headers: { ...cab, 'content-type': 'application/json' }, signal: AbortSignal.timeout(20000),
                body: JSON.stringify({ query: 'query($o:String!,$n:String!,$i:Int!){repository(owner:$o,name:$n){issue(number:$i){lastEditedAt}}}', variables: { o: dono, n: nome, i: num } })
            });
            if (!r.ok) throw new Error(`GraphQL HTTP ${r.status}`);
            const j = await r.json();
            return j && j.data && j.data.repository && j.data.repository.issue ? j.data.repository.issue.lastEditedAt : null;
        }
    };
    const d = await decidir(ev, consultas);
    const limpa = s => String(s).replace(/[\r\n]+/g, ' ');
    console.log(d.ok ? `Autorizado. Link: ${d.url || '(nenhum)'}` : `Não autorizado: ${d.motivo}`);
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `ok=${d.ok ? 1 : 0}\nurl=${limpa(d.url)}\nmotivo=${limpa(d.motivo)}\navisar=${d.avisar ? 1 : 0}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    principal().catch(err => {
        console.log(`Não autorizado: erro ao consultar a API (${err.message})`);
        if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'ok=0\nurl=\nmotivo=erro ao consultar a API do GitHub\navisar=0\n');
    });
}
