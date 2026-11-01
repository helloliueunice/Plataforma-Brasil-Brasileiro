/**
 * Pix "copia e cola" estático (BR Code, padrão EMV QRCPS-MPM do Banco Central), sem dependências.
 *
 *   brCodePix({ chave, nome, cidade, txid = '***', descricao = '' }) → string pronta para copiar ou virar QR Code
 *   lerBrCode(payload) → { ok, erros, campos }   (validador: TLV, campos obrigatórios e CRC16)
 *   crc16(texto) → 'ABCD'                       (CRC16-CCITT-FALSE: polinômio 0x1021, valor inicial 0xFFFF)
 *
 * Sem valor (campo 54): quem paga digita o valor no app do banco.
 */

export function crc16(txt) {
    let crc = 0xffff;
    for (const b of new TextEncoder().encode(txt)) {
        crc ^= b << 8;
        for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Nome e cidade: o padrão recomenda caracteres ASCII simples (sem acento), até 25 e 15 caracteres
const ascii = (s, max) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 .,\-\/&]/g, '').replace(/\s+/g, ' ').trim().slice(0, max).trim();

const tlv = (id, valor) => {
    const v = String(valor);
    const n = new TextEncoder().encode(v).length;
    if (n > 99) throw new Error(`Campo ${id} do Pix com mais de 99 bytes`);
    return id + String(n).padStart(2, '0') + v;
};

/** Normaliza a chave: CPF/CNPJ só com dígitos; telefone com +55; e-mail em minúsculas; aleatória (EVP) em minúsculas. */
export function normalizarChavePix(chave) {
    const c = String(chave || '').trim();
    if (!c) return '';
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)) return c.toLowerCase();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c)) return c.toLowerCase();
    if (/^\+/.test(c)) return '+' + c.replace(/\D/g, '');
    if (/^[\d.\-\/\s]+$/.test(c)) { const d = c.replace(/\D/g, ''); if (d.length === 11 || d.length === 14) return d; }
    return c;
}

export function brCodePix({ chave, nome, cidade, txid = '***', descricao = '' }) {
    const k = normalizarChavePix(chave);
    if (!k) throw new Error('Chave Pix vazia');
    const n = ascii(nome, 25) || 'N';
    const cid = ascii(cidade, 15) || 'BRASIL';
    const desc = ascii(descricao, 40);
    const conta = tlv('00', 'br.gov.bcb.pix') + tlv('01', k) + (desc ? tlv('02', desc) : '');
    const semCrc = tlv('00', '01') + tlv('01', '11') + tlv('26', conta) + tlv('52', '0000') + tlv('53', '986') + tlv('58', 'BR') + tlv('59', n) + tlv('60', cid) + tlv('62', tlv('05', String(txid || '***').replace(/[^A-Za-z0-9*]/g, '').slice(0, 25) || '***')) + '6304';
    return semCrc + crc16(semCrc);
}

/* ---------- Validador (usado nos testes) ---------- */
function lerTlv(txt) {
    const campos = []; let i = 0;
    while (i < txt.length) {
        const id = txt.slice(i, i + 2), n = Number(txt.slice(i + 2, i + 4));
        if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(txt.slice(i + 2, i + 4))) throw new Error(`TLV inválido na posição ${i}`);
        const v = txt.slice(i + 4, i + 4 + n);
        if (v.length !== n) throw new Error(`Campo ${id} truncado`);
        campos.push([id, v]); i += 4 + n;
    }
    return campos;
}

export function lerBrCode(payload) {
    const erros = []; let campos = {};
    try {
        const lista = lerTlv(payload);
        campos = Object.fromEntries(lista);
        if (lista[0]?.[0] !== '00' || campos['00'] !== '01') erros.push('Campo 00 deve ser o primeiro e valer 01');
        if (lista[lista.length - 1]?.[0] !== '63') erros.push('CRC (63) deve ser o último campo');
        const crcCalc = crc16(payload.slice(0, -4));
        if (campos['63'] !== crcCalc) erros.push(`CRC incorreto: ${campos['63']} ≠ ${crcCalc}`);
        if (!campos['26']) erros.push('Falta o campo 26 (conta Pix)');
        else {
            const conta = Object.fromEntries(lerTlv(campos['26']));
            if ((conta['00'] || '').toLowerCase() !== 'br.gov.bcb.pix') erros.push('GUI deve ser br.gov.bcb.pix');
            if (!conta['01']) erros.push('Falta a chave (26.01)');
            campos.chave = conta['01'];
        }
        if (campos['52'] !== '0000') erros.push('MCC (52) deve ser 0000');
        if (campos['53'] !== '986') erros.push('Moeda (53) deve ser 986');
        if (campos['58'] !== 'BR') erros.push('País (58) deve ser BR');
        if (!campos['59'] || campos['59'].length > 25) erros.push('Nome (59) obrigatório, até 25');
        if (!campos['60'] || campos['60'].length > 15) erros.push('Cidade (60) obrigatória, até 15');
        if (campos['62']) { const ad = Object.fromEntries(lerTlv(campos['62'])); if (!ad['05']) erros.push('Falta txid (62.05)'); }
        if (/[^\x20-\x7E]/.test(payload)) erros.push('Caracteres fora do ASCII imprimível');
    } catch (err) { erros.push(err.message); }
    return { ok: !erros.length, erros, campos };
}
