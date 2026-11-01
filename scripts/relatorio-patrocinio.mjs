#!/usr/bin/env node
/**
 * Relatório de patrocínios (para enviar ao patrocinador e para o controle interno).
 *
 * Uso:
 *   node scripts/relatorio-patrocinio.mjs                 # todos os patrocínios do editais.json, em Markdown
 *   node scripts/relatorio-patrocinio.mjs --id 107        # só um edital
 *   node scripts/relatorio-patrocinio.mjs --json          # saída em JSON
 *   node scripts/relatorio-patrocinio.mjs --hoje 2026-11-15   # simula outra data (padrão: hoje em Brasília)
 *
 * Para cada edital com "patrocinado": true, lista patrocinador, período, situação (ativo, agendado, expirado,
 * chamada encerrada), as vagas contratadas e as páginas onde o destaque aparece, com quantos dias de vaga
 * reservada no período (com mais de um patrocínio na mesma vaga, há rodízio diário — ver scripts/patrocinio.mjs).
 *
 * Cliques: não ficam no repositório. Com a medição ligada (analytics.goatcounter em data/site.json), cada clique
 * num item patrocinado conta dois eventos no GoatCounter:
 *   evento/patrocinio-clique       total de cliques em itens patrocinados (todos os patrocinadores)
 *   evento/patrocinio-<id>         cliques no item do edital <id> (cartão, vaga reservada, listas, plataforma)
 *   evento/patrocinio-oficial-<id> cliques em "Edital oficial" na página do edital patrocinado
 * Como consultar: entre no painel do GoatCounter, escolha o período do patrocínio e digite "patrocinio-<id>" no
 * filtro de caminhos (ou exporte em Settings › Export, CSV com a coluna Path). A soma do período é o número a
 * informar ao patrocinador. A contagem é agregada, sem cookies e sem identificar pessoas.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { situacaoPatrocinio, vagasDe, nomePatrocinador, VAGA_ROTULO, escolherVaga } from './patrocinio.mjs';
import { PUBLICOS_HUB } from './conteudo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const hoje = opt('--hoje') || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const soId = opt('--id') ? Number(opt('--id')) : null;
const cname = fs.existsSync(path.join(RAIZ, 'CNAME')) ? fs.readFileSync(path.join(RAIZ, 'CNAME'), 'utf8').trim() : '';
const SITE = (process.env.SITE_URL || (cname ? `https://${cname}` : 'https://helloliueunice.github.io/Plataforma-Brasil-Brasileiro')).replace(/\/+$/, '');
const cfg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'site.json'), 'utf8'));

const fonte = JSON.parse(fs.readFileSync(path.join(RAIZ, 'editais.json'), 'utf8'));
const todos = Array.isArray(fonte) ? fonte : fonte.editais || [];

// Mesmas regras de slug e de área do gerador (scripts/gerar-paginas.mjs)
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slugify = s => { const b = norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); if (b.length <= 70) return b; const c = b.slice(0, 71); return c.slice(0, c.lastIndexOf('-')); };
const indexHtml = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const mAreas = indexHtml.match(/const AREAS = (\{[\s\S]*?\});/);
const AREAS = mAreas ? Function(`return (${mAreas[1]})`)() : {};
const data = iso => (iso ? iso.split('-').reverse().join('/') : '—');
const somaDias = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

const patrocinados = todos.filter(e => e && e.patrocinado && (!soId || Number(e.id) === soId));
if (!patrocinados.length) { console.log(soId ? `Edital ${soId} não tem patrocínio no editais.json.` : 'Nenhum patrocínio cadastrado no editais.json.'); process.exit(0); }

// Páginas de cada vaga para um edital (a vaga só aparece na página do público/área do próprio edital)
function paginasDaVaga(e, vaga) {
    if (vaga === 'inicio') return [{ chave: 'inicio', url: `${SITE}/` }];
    if (vaga === 'semana') return [{ chave: 'semana', url: `${SITE}/semana/` }];
    if (vaga === 'publico') return (e.publico || []).filter(p => PUBLICOS_HUB[p]).map(p => ({ chave: `publico:${p}`, url: `${SITE}/para/${PUBLICOS_HUB[p].slug}/` }));
    if (vaga === 'area') return AREAS[e.tema] ? [{ chave: `area:${e.tema}`, url: `${SITE}/area/${slugify(AREAS[e.tema])}/` }] : [];
    return [];
}
// Quem disputa a mesma página nesse dia (rodízio)
const disputa = (chave, vaga, dia) => todos.filter(x => situacaoPatrocinio(x, dia) === 'ativo' && vagasDe(x).includes(vaga) && paginasDaVaga(x, vaga).some(p => p.chave === chave));

const relatorio = patrocinados.map(e => {
    const situacao = situacaoPatrocinio(e, hoje);
    const inicio = e.patrocinioInicio || e.publicadoEm || e.abertura;
    const fimContrato = e.patrocinioAte || e.encerramento;
    const fim = [fimContrato, e.encerramento, hoje].filter(Boolean).sort()[0]; // até hoje, no máximo
    const vagas = vagasDe(e).map(vaga => {
        const paginas = paginasDaVaga(e, vaga).map(p => {
            let dias = 0;
            for (let d = inicio; d && d <= fim; d = somaDias(d, 1)) {
                const escolhido = escolherVaga(disputa(p.chave, vaga, d), d);
                if (escolhido && Number(escolhido.id) === Number(e.id)) dias++;
            }
            return { url: p.url, diasNaVaga: dias };
        });
        return { vaga, rotulo: VAGA_ROTULO[vaga], paginas };
    });
    const slug = `${slugify(e.titulo)}-${e.id}`;
    return {
        id: e.id, titulo: e.titulo, instituicao: e.instituicao, patrocinador: nomePatrocinador(e) || '(sem nome — o selo mostra só "Patrocinado")',
        inicio: e.patrocinioInicio || null, ate: e.patrocinioAte || null, encerramentoChamada: e.encerramento, situacao,
        paginaDoEdital: `${SITE}/editais/${slug}/`,
        sempreComSelo: ['página do edital', 'listas (editais/, instituição, prazos, semana, relacionados)', 'plataforma (cartões e detalhes)', 'feeds RSS (título com [Patrocinado])'],
        vagas,
        goatcounter: { eventos: [`patrocinio-${e.id}`, `patrocinio-oficial-${e.id}`], painel: cfg.analytics?.goatcounter ? `https://${cfg.analytics.goatcounter}.goatcounter.com/ (período ${data(inicio)} a ${data(fim)}, filtro "patrocinio-${e.id}")` : null }
    };
});

if (args.includes('--json')) { console.log(JSON.stringify({ geradoEm: hoje, site: SITE, patrocinios: relatorio }, null, 2)); process.exit(0); }

const SITUACAO = { ativo: 'Ativo', agendado: 'Agendado (ainda não começou)', expirado: 'Encerrado (fim do período)', 'chamada-encerrada': 'Encerrado (a chamada fechou)' };
const linhas = [`# Relatório de patrocínios — ${data(hoje)}`, '', `Site: ${SITE}`, ''];
linhas.push('| Edital | Patrocinador | Período | Situação |', '|---|---|---|---|');
relatorio.forEach(r => linhas.push(`| ${r.id} — ${r.titulo} | ${r.patrocinador} | ${data(r.inicio)} a ${data(r.ate || r.encerramentoChamada)} | ${SITUACAO[r.situacao]} |`));
for (const r of relatorio) {
    linhas.push('', `## ${r.titulo} (id ${r.id})`, '', `- Patrocinador: ${r.patrocinador}`, `- Período contratado: ${data(r.inicio)} a ${r.ate ? data(r.ate) : `encerramento da chamada (${data(r.encerramentoChamada)})`}`, `- Situação em ${data(hoje)}: ${SITUACAO[r.situacao]}`, `- Página do edital: ${r.paginaDoEdital}`, `- Selo “Patrocinado” também em: ${r.sempreComSelo.join('; ')}`, '', '| Vaga reservada | Página | Dias na vaga (até hoje) |', '|---|---|---|');
    r.vagas.forEach(v => (v.paginas.length ? v.paginas : [{ url: '(nenhuma página para este edital)', diasNaVaga: 0 }]).forEach(p => linhas.push(`| ${v.rotulo} | ${p.url} | ${p.diasNaVaga} |`)));
    linhas.push('', `Cliques: no GoatCounter, eventos \`${r.goatcounter.eventos.join('`, `')}\` no período.${r.goatcounter.painel ? ` Painel: ${r.goatcounter.painel}` : ' (medição desligada: preencha analytics.goatcounter em data/site.json)'}`);
}
linhas.push('', 'Na página inicial, o patrocinado só ocupa a vaga para quem não definiu perfil ou para perfis compatíveis com o edital; o número de dias é o máximo possível.');
console.log(linhas.join('\n'));
