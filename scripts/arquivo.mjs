// Arquivo de editais (data/arquivo-editais.json): guarda a última versão de cada edital publicado para que a página
// de um edital encerrado continue no ar depois que ele sai da fonte. Os programas do Transferegov, por exemplo,
// somem de data/transferegov.json no dia seguinte ao prazo; sem o arquivo, a página viraria 404.
//
// Regras (funções puras, testadas em scripts/testes/arquivo.test.mjs):
// - todo edital presente nas fontes é gravado (ou atualizado) no arquivo; mudança só em campos voláteis
//   (verificadoEm) não regrava, para o arquivo não mudar todo dia;
// - quando um edital some das fontes, o arquivo anota a data (arquivoSaiuEm) e não apaga nada;
// - volta como "encerrado" o edital que saiu das fontes no prazo ou depois dele e cujo prazo já passou;
//   o que saiu antes do prazo (retirado, cadastrado por engano) fica guardado, mas não volta ao site;
// - para tirar uma página do ar de vez, apague a entrada do arquivo e a do editais.json.
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const VOLATEIS = ['verificadoEm'];
const MARCA = 'arquivoSaiuEm';
const somaDias = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const essencia = r => { const c = { ...r }; for (const k of [...VOLATEIS, MARCA]) delete c[k]; return JSON.stringify(c); };

export function atualizarArquivo(anterior, atuais, hoje) {
    const arq = { ...(anterior || {}) };
    const presentes = new Set();
    for (const r of atuais || []) {
        if (!r || r.id == null || r.id === '') continue;
        const k = String(r.id);
        presentes.add(k);
        const antes = arq[k];
        // Presente de novo: grava a versão atual (sem a marca de saída)
        if (!antes || antes[MARCA] || essencia(antes) !== essencia(r)) arq[k] = { ...r };
    }
    const revividos = [];
    for (let [k, r] of Object.entries(arq)) {
        if (presentes.has(k)) continue;
        if (!r[MARCA]) arq[k] = r = { ...r, [MARCA]: hoje };
        const enc = r.encerramento;
        // Saiu da fonte no prazo ou depois (tolerância de 1 dia para fusos e horários de coleta) e o prazo já passou
        if (ISO.test(enc || '') && enc < hoje && r[MARCA] >= somaDias(enc, -1)) {
            const { [MARCA]: _, ...limpo } = r;
            revividos.push(limpo);
        }
    }
    const arquivo = Object.fromEntries(Object.entries(arq).sort((a, b) => Number(a[0]) - Number(b[0]) || a[0].localeCompare(b[0])));
    return { arquivo, revividos };
}
