// Formulários sem servidor (listas de espera do Pro e do Radar, pedido em Anuncie) e estados do sistema no app.
// Regra: nenhuma mensagem pode sugerir que algo foi enviado ou inscrito — o site só monta um e-mail (mailto).
// Rodar: node --test scripts/testes/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROMESSA = /\b(abrimos|enviad[oa]s? com sucesso|inscri[çc][ãa]o (feita|confirmada|realizada)|recebemos (o|a|seu|sua))\b/i;

test('formulários mailto: status honesto, erro junto ao campo e cópia manual', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'formularios-'));
    try {
        for (const f of ['index.html', 'editais.json', 'scripts', 'data', 'assets/paginas.css', 'assets/favicon.svg']) fs.cpSync(path.join(RAIZ, f), path.join(tmp, f), { recursive: true });
        execFileSync(process.execPath, [path.join(tmp, 'scripts', 'gerar-paginas.mjs')], { cwd: tmp, env: { ...process.env, PIX_CHAVE: '' }, stdio: 'pipe' });
        for (const [pag, form] of [['pro', 'espera-pro-form'], ['radar-municipios', 'radar-contato-form'], ['anuncie', 'pedido-form']]) {
            const html = fs.readFileSync(path.join(tmp, pag, 'index.html'), 'utf8');
            assert.ok(html.includes(`id="${form}"`), `${pag}: formulário ${form}`);
            assert.match(html, /action="mailto:/, `${pag}: sem JavaScript o formulário ainda abre o e-mail`);
            assert.match(html, />Preparar e-mail d[eo] (inscrição|pedido)</, `${pag}: botão diz o que acontece (prepara um e-mail)`);
            const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
            assert.ok(scripts.includes('Ainda não recebemos nada'), `${pag}: status diz que nada chegou ainda`);
            assert.ok(scripts.includes('depois que você enviar'), `${pag}: status diz quando passa a valer`);
            assert.ok(scripts.includes('Nada foi enviado'), `${pag}: erro de validação diz que nada foi enviado`);
            assert.ok(scripts.includes('Copiar mensagem') && scripts.includes('Tentar abrir o e-mail de novo'), `${pag}: recuperação quando o e-mail não abre`);
            assert.ok(!PROMESSA.test(scripts.replace(/Ainda não recebemos nada/g, '')), `${pag}: nenhuma mensagem promete envio`);
        }
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});

test('app: avisos de sistema e "Quero participar" sem prometer salvo quando o navegador não guarda', () => {
    const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
    assert.ok(html.includes('id="avisosSistema"'), 'contêiner de avisos do sistema');
    for (const t of ['Você está sem internet.', 'Este navegador não está guardando dados', 'Não conseguimos baixar a lista mais recente.', 'A lista foi conferida pela última vez há', 'data-action="recarregar-dados"'])
        assert.ok(html.includes(t), `aviso: ${t}`);
    assert.ok(html.includes('mas não vai ficar salvo'), '"Quero participar" sem armazenamento não diz "salvo"');
    assert.ok(!html.includes("catch (_) { /* armazenamento indisponível */ } }\n        };"), 'falha ao gravar não é mais silenciosa');
});
