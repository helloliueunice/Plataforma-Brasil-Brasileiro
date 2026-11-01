/**
 * QR Code em SVG, sem dependências (modo byte, correção de erro M, versões 1 a 40).
 * Baseado no algoritmo de referência da norma ISO/IEC 18004 (mesma estrutura da biblioteca de Project Nayuki).
 *
 *   qrMatriz(texto, nivel = 'M') → { tamanho, modulos: boolean[][] }   (modulos[y][x], true = escuro)
 *   qrSvg(texto, { rotulo, margem = 4 }) → '<svg …>' (preto sobre branco, escalável)
 */
const ECC_POR_BLOCO = {
    L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28]
};
const BLOCOS = {
    L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49]
};
const FORMATO_NIVEL = { L: 1, M: 0 };

const modulosBrutos = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
const palavrasDados = (v, n) => Math.floor(modulosBrutos(v) / 8) - ECC_POR_BLOCO[n][v] * BLOCOS[n][v];

// Aritmética no corpo GF(2^8) com polinômio 0x11D (Reed-Solomon do QR Code)
const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z & 0xff; };
function divisor(grau) {
    const r = new Array(grau).fill(0); r[grau - 1] = 1; let raiz = 1;
    for (let i = 0; i < grau; i++) {
        for (let j = 0; j < r.length; j++) { r[j] = mul(r[j], raiz); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
        raiz = mul(raiz, 0x02);
    }
    return r;
}
function resto(dados, div) {
    const r = new Array(div.length).fill(0);
    for (const b of dados) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= mul(c, f); }); }
    return r;
}

const posicoesAlinhamento = v => {
    if (v === 1) return [];
    const n = Math.floor(v / 7) + 2, tam = v * 4 + 17;
    const passo = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
    const r = [6];
    for (let p = tam - 7; r.length < n; p -= passo) r.splice(1, 0, p);
    return r;
};

const MASCARAS = [
    (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
];

export function qrMatriz(texto, nivel = 'M') {
    const bytes = [...new TextEncoder().encode(String(texto))];
    let v = 1;
    for (; v <= 40; v++) { const bitsContagem = v <= 9 ? 8 : 16; if (4 + bitsContagem + bytes.length * 8 <= palavrasDados(v, nivel) * 8) break; }
    if (v > 40) throw new Error('Texto longo demais para um QR Code');
    const tam = v * 4 + 17;

    // 1. Bits de dados: modo byte (0100), contagem, bytes, terminador e preenchimento
    const bits = [];
    const poe = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    poe(4, 4); poe(bytes.length, v <= 9 ? 8 : 16); bytes.forEach(b => poe(b, 8));
    const capacidade = palavrasDados(v, nivel) * 8;
    poe(0, Math.min(4, capacidade - bits.length));
    poe(0, (8 - (bits.length % 8)) % 8);
    for (let p = 0xec; bits.length < capacidade; p ^= 0xec ^ 0x11) poe(p, 8);
    const dados = [];
    for (let i = 0; i < bits.length; i += 8) dados.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

    // 2. Correção de erro (Reed-Solomon) por bloco e intercalação
    const nBlocos = BLOCOS[nivel][v], eccLen = ECC_POR_BLOCO[nivel][v];
    const brutas = Math.floor(modulosBrutos(v) / 8);
    const curtos = nBlocos - (brutas % nBlocos), lenCurto = Math.floor(brutas / nBlocos);
    const div = divisor(eccLen);
    const blocos = [];
    for (let i = 0, k = 0; i < nBlocos; i++) {
        const d = dados.slice(k, k + lenCurto - eccLen + (i < curtos ? 0 : 1)); k += d.length;
        const ecc = resto(d, div);
        if (i < curtos) d.push(0);
        blocos.push(d.concat(ecc));
    }
    const final = [];
    for (let i = 0; i < blocos[0].length; i++) blocos.forEach((b, j) => { if (i !== lenCurto - eccLen || j >= curtos) final.push(b[i]); });

    // 3. Padrões fixos
    const m = Array.from({ length: tam }, () => new Array(tam).fill(false));
    const fixo = Array.from({ length: tam }, () => new Array(tam).fill(false));
    const set = (x, y, escuro) => { m[y][x] = escuro; fixo[y][x] = true; };
    for (let i = 0; i < tam; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    for (const [cx, cy] of [[3, 3], [tam - 4, 3], [3, tam - 4]]) {
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
            const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
            if (x >= 0 && x < tam && y >= 0 && y < tam) set(x, y, d !== 2 && d !== 4);
        }
    }
    const al = posicoesAlinhamento(v), na = al.length;
    for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    const formato = mascara => {
        const d = (FORMATO_NIVEL[nivel] << 3) | mascara; let r = d;
        for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
        const b = ((d << 10) | r) ^ 0x5412, bit = i => ((b >>> i) & 1) === 1;
        for (let i = 0; i <= 5; i++) set(8, i, bit(i));
        set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
        for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
        for (let i = 0; i < 8; i++) set(tam - 1 - i, 8, bit(i));
        for (let i = 8; i < 15; i++) set(8, tam - 15 + i, bit(i));
        set(8, tam - 8, true);
    };
    formato(0);
    if (v >= 7) {
        let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
        const b = (v << 12) | r;
        for (let i = 0; i < 18; i++) { const bit = ((b >>> i) & 1) === 1, a = tam - 11 + (i % 3), c = Math.floor(i / 3); set(a, c, bit); set(c, a, bit); }
    }

    // 4. Palavras em zigue-zague
    let i = 0;
    for (let dir = tam - 1; dir >= 1; dir -= 2) {
        if (dir === 6) dir = 5;
        for (let vert = 0; vert < tam; vert++) for (let j = 0; j < 2; j++) {
            const x = dir - j, sobe = ((dir + 1) & 2) === 0, y = sobe ? tam - 1 - vert : vert;
            if (!fixo[y][x] && i < final.length * 8) { m[y][x] = ((final[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; }
        }
    }

    // 5. Máscara de menor penalidade
    const aplica = k => { for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) if (!fixo[y][x] && MASCARAS[k](x, y)) m[y][x] = !m[y][x]; };
    const penalidade = () => {
        let p = 0, escuros = 0;
        const linha = get => {
            for (let a = 0; a < tam; a++) {
                let corrida = 1;
                const seq = [];
                for (let b = 0; b < tam; b++) seq.push(get(a, b) ? 1 : 0);
                for (let b = 1; b <= tam; b++) {
                    if (b < tam && seq[b] === seq[b - 1]) corrida++;
                    else { if (corrida >= 5) p += 3 + corrida - 5; corrida = 1; }
                }
                const s = '0000' + seq.join('') + '0000';
                for (const padrao of ['00001011101', '10111010000']) { let k = s.indexOf(padrao); while (k >= 0) { p += 40; k = s.indexOf(padrao, k + 1); } }
            }
        };
        linha((a, b) => m[a][b]); linha((a, b) => m[b][a]);
        for (let y = 0; y < tam - 1; y++) for (let x = 0; x < tam - 1; x++) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3; }
        m.forEach(l => l.forEach(c => { if (c) escuros++; }));
        const total = tam * tam;
        p += (Math.ceil(Math.abs(escuros * 20 - total * 10) / total) - 1) * 10;
        return p;
    };
    let melhor = 0, menor = Infinity;
    for (let k = 0; k < 8; k++) { aplica(k); formato(k); const p = penalidade(); if (p < menor) { menor = p; melhor = k; } aplica(k); }
    aplica(melhor); formato(melhor);
    return { tamanho: tam, versao: v, mascara: melhor, modulos: m };
}

export function qrSvg(texto, { rotulo = 'QR Code', margem = 4 } = {}) {
    const { tamanho, modulos } = qrMatriz(texto, 'M');
    const t = tamanho + margem * 2;
    let d = '';
    modulos.forEach((linha, y) => {
        // Junta módulos escuros vizinhos na mesma linha (SVG menor)
        for (let x = 0; x < tamanho; x++) {
            if (!linha[x]) continue;
            let w = 1; while (x + w < tamanho && linha[x + w]) w++;
            d += `M${x + margem} ${y + margem}h${w}v1h-${w}z`; x += w - 1;
        }
    });
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" role="img" aria-label="${esc(rotulo)}" shape-rendering="crispEdges"><rect width="${t}" height="${t}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
