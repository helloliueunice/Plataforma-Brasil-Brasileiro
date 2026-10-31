/**
 * Funções puras usadas por scripts/gerar-paginas.mjs para:
 *   - feeds RSS 2.0 por recorte (público, área, instituição, alterações);
 *   - calendários iCalendar (RFC 5545) com um evento de dia inteiro por prazo;
 *   - histórico de alterações (comparação com o snapshot anterior, idempotente);
 *   - semana ISO no fuso de Brasília.
 * Sem dependências: só JavaScript padrão do Node 18+.
 */

/* ---------- Datas (sempre em AAAA-MM-DD, sem fuso: o "hoje" já vem no fuso de Brasília) ---------- */
export const isoOk = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const utc = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const isoDe = dt => dt.toISOString().slice(0, 10);
export const somaDias = (iso, n) => { const d = utc(iso); d.setUTCDate(d.getUTCDate() + n); return isoDe(d); };

/** Semana ISO 8601 (segunda a domingo) que contém a data. */
export function semanaISO(iso) {
    const d = utc(iso);
    const seg = new Date(d); seg.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const qui = new Date(seg); qui.setUTCDate(seg.getUTCDate() + 3);
    const ano = qui.getUTCFullYear();
    const jan4 = new Date(Date.UTC(ano, 0, 4));
    const seg1 = new Date(jan4); seg1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
    const semana = 1 + Math.round((seg - seg1) / (7 * 864e5));
    return { ano, semana, chave: `${ano}-${String(semana).padStart(2, '0')}`, inicio: isoDe(seg), fim: somaDias(isoDe(seg), 6) };
}

/* ---------- RSS 2.0 ---------- */
const escXml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
export const rfc822 = iso => new Date(`${iso}T12:00:00-03:00`).toUTCString();

/**
 * @param {{titulo:string, link:string, self:string, descricao:string, atualizado:string,
 *          itens:{titulo:string, link:string, guid:string, permalink?:boolean, data:string, categorias?:string[], descricao:string}[]}} f
 */
export function rss(f) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escXml(f.titulo)}</title>
  <link>${escXml(f.link)}</link>
  <atom:link href="${escXml(f.self)}" rel="self" type="application/rss+xml"/>
  <description>${escXml(f.descricao)}</description>
  <language>pt-BR</language>
  <ttl>720</ttl>
  <lastBuildDate>${rfc822(f.atualizado)}</lastBuildDate>
${f.itens.map(i => `  <item>
    <title>${escXml(i.titulo)}</title>
    <link>${escXml(i.link)}</link>
    <guid isPermaLink="${i.permalink === false ? 'false' : 'true'}">${escXml(i.guid)}</guid>
    <pubDate>${rfc822(i.data)}</pubDate>
${(i.categorias || []).map(c => `    <category>${escXml(c)}</category>\n`).join('')}    <description>${escXml(i.descricao)}</description>
  </item>`).join('\n')}
</channel>
</rss>
`;
}

/* ---------- iCalendar (RFC 5545) ---------- */
/** Escapa um valor TEXT: barra invertida, ponto e vírgula, vírgula e quebras de linha. */
export const icsTexto = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Dobra a linha em no máximo 75 octetos (UTF-8), sem partir caracteres; continuação começa com espaço. */
export function dobrar(linha) {
    const enc = new TextEncoder();
    const partes = []; let atual = ''; let octetos = 0;
    for (const ch of linha) {
        const n = enc.encode(ch).length;
        if (octetos + n > 75) { partes.push(atual); atual = ' ' + ch; octetos = 1 + n; }
        else { atual += ch; octetos += n; }
    }
    partes.push(atual);
    return partes.join('\r\n');
}

const ymd = iso => iso.replace(/-/g, '');

/**
 * Um VEVENT de dia inteiro.
 * @param {{uid:string, data:string, carimbo:string, resumo:string, descricao:string, url:string, sequencia?:number, alarme:string}} ev
 */
export function vevento(ev) {
    return [
        'BEGIN:VEVENT',
        `UID:${ev.uid}`,
        `DTSTAMP:${ymd(ev.carimbo)}T120000Z`,
        `DTSTART;VALUE=DATE:${ymd(ev.data)}`,
        `DTEND;VALUE=DATE:${ymd(somaDias(ev.data, 1))}`,
        ...(ev.sequencia ? [`SEQUENCE:${ev.sequencia}`] : []),
        `SUMMARY:${icsTexto(ev.resumo)}`,
        `DESCRIPTION:${icsTexto(ev.descricao)}`,
        `URL:${ev.url}`,
        'TRANSP:TRANSPARENT',
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-P7D', `DESCRIPTION:${icsTexto(`Faltam 7 dias: ${ev.alarme}`)}`, 'END:VALARM',
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-P1D', `DESCRIPTION:${icsTexto(`Amanhã: ${ev.alarme}`)}`, 'END:VALARM',
        'END:VEVENT'
    ];
}

/** Calendário completo, com CRLF e linhas dobradas. Válido mesmo sem eventos. */
export function calendario({ nome, descricao, eventos }) {
    const linhas = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Fundos Brasil//Prazos de editais//PT-BR',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:${icsTexto(nome)}`,
        `NAME:${icsTexto(nome)}`,
        `X-WR-CALDESC:${icsTexto(descricao)}`,
        `DESCRIPTION:${icsTexto(descricao)}`,
        'X-WR-TIMEZONE:America/Sao_Paulo',
        'REFRESH-INTERVAL;VALUE=DURATION:P1D',
        'X-PUBLISHED-TTL:P1D',
        ...eventos.flatMap(vevento),
        'END:VCALENDAR'
    ];
    return linhas.map(dobrar).join('\r\n') + '\r\n';
}

/* ---------- Histórico de alterações ---------- */
export const CAMPOS_CHAVE = ['titulo', 'abertura', 'encerramento', 'propostaCompleta', 'valorMax', 'valorTotal', 'link', 'etapaPrazo'];
const normaliza = v => (v === undefined || v === '' ? null : typeof v === 'string' ? v.trim() || null : v);

/** Estado dos campos-chave de cada edital, indexado por id (ordem estável). */
export function estadoAtual(editais) {
    const out = {};
    for (const e of [...editais].sort((a, b) => Number(a.id) - Number(b.id))) {
        out[e.id] = Object.fromEntries(CAMPOS_CHAVE.map(c => [c, normaliza(e[c])]));
    }
    return out;
}

/**
 * Compara o estado atual com o snapshot anterior.
 * Sem snapshot (primeira execução): não registra nada, só devolve o estado para gravar.
 * Idempotente: rodar de novo com os mesmos dados e o snapshot atualizado não gera novas entradas.
 * @returns {{novas: {id:number, campo:string, de:any, para:any, em:string}[], estado: object}}
 */
export function comparar(editais, snapshotAnterior, em) {
    const estado = estadoAtual(editais);
    const novas = [];
    if (!snapshotAnterior) return { novas, estado };
    for (const [id, atual] of Object.entries(estado)) {
        const antes = snapshotAnterior[id];
        if (!antes) { novas.push({ id: Number(id), campo: 'novo', de: null, para: atual.titulo, em }); continue; }
        for (const c of CAMPOS_CHAVE) {
            const de = normaliza(antes[c]);
            const para = atual[c];
            if (JSON.stringify(de) !== JSON.stringify(para)) novas.push({ id: Number(id), campo: c, de, para, em });
        }
    }
    return { novas, estado };
}
