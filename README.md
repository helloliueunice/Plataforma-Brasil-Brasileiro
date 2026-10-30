# Plataforma Brasil Brasileiro

Plataforma brasileira para gestão de fundos públicos, facilitando a captação, fiscalização e transparência de recursos governamentais.

É uma página única (`index.html`), sem build: abra o arquivo no navegador ou publique no GitHub Pages. Publicado em um servidor, o site carrega automaticamente o arquivo `editais.json` da raiz; aberto direto do disco, usa os editais de exemplo embutidos.

## Jornadas

- **Quero captar recursos**: editais → perfil → detalhes → acompanhar → checklist → agenda → submissão no portal oficial → resultado, tudo registrado em **Minhas propostas**.
- **Gerencio um projeto financiado**: projetos → prestação de contas em 3 etapas (preencher, revisar, protocolo), com rascunho automático, validação, comprovante e histórico da análise.
- **Quero acompanhar o dinheiro público**: fundos → instituição (desembolsos, editais, projetos) → mapa com lista acessível.
- **Ajuda**: passo a passo, glossário de termos (CAUC, MROSC, ICT…) e perguntas frequentes.

A auditoria de usabilidade que orientou essas jornadas está em [`docs/auditoria-usabilidade.md`](docs/auditoria-usabilidade.md).

## Ferramenta de editais

- **Status automático** (aberto, em breve, encerrado) calculado pelas datas, com contagem regressiva e destaque para prazos em até 7 dias.
- **Perfil do proponente**: tipo (pesquisador, ICT, empresa, OSC, município, estado), UF, áreas de interesse e valor mínimo. Cada edital recebe um percentual de compatibilidade e a explicação do porquê; tipo de proponente e UF são eliminatórios.
- **Filtros por tipologia**: chips de *quem vai propor*, *tipo de apoio* (auxílio à pesquisa, bolsas, eventos, não reembolsável/subvenção — agrupa as modalidades escritas por cada instituição), *área* e *situação*, cada um com a contagem de editais que restam se for escolhido. Em *Mais filtros*: formato de submissão (direta ou com pré-proposta; campo `preProposta`), procedência, estado, valor e prazo. Sem resultados, a página diz qual filtro remover ou, se não há oferta para o público, leva à página dele e ao formulário de sugestão. Os filtros ficam na URL (`#editais?publico=empresa&modalidade=subvencao`), e cada edital tem link próprio (`#edital-3`).
- **Lista ou calendário** mensal com aberturas, prazos finais e resultados.
- **Detalhes**: condições, cronograma, critérios com pesos e checklist de documentos por tipo de proponente (progresso salvo no navegador). Ficha pronta para imprimir ou salvar em PDF.
- **Agenda**: prazo de um edital ou de todos os filtrados em `.ics`, com lembretes 7 dias e 1 dia antes.
- **Exportação** em CSV (abre direto no Excel em português) e **comparação** de até 3 editais.
- **Gerenciar editais**: cadastre editais reais pelo formulário ou importe um arquivo JSON. Ficam salvos no navegador (`localStorage`); exporte o JSON para compartilhar ou versionar.

> Os editais são **reais**, conferidos na página ou no documento oficial de cada instituição (cada um guarda `fonte` e `verificadoEm`). Já **projetos e prestação de contas** usam dados de demonstração. Em qualquer divergência, vale o edital oficial.

## Curadoria e monitoramento automático

**Base atual (28/10/2026):** 8 chamadas vigentes da FAPESP, do CNPq (com CAPES e ANR) e da Finep, para pesquisadores, ICTs e empresas. Ficaram de fora as chamadas já encerradas e as que não puderam ser confirmadas em fonte oficial.

**Monitor diário** (`.github/workflows/monitorar-fontes.yml`, todo dia às 07h43):

1. Lê as páginas oficiais listadas em [`data/fontes.json`](data/fontes.json) (FAPESP, CNPq, Finep, MinC, MDA, FAPERJ, FAPES) e encontra links de chamadas ainda não vistos.
2. Envia cada página ou PDF à IA (API da Anthropic), que extrai os dados no formato do `editais.json` — só fatos explícitos no documento, com **trechos de evidência**, nível de confiança e pontos para conferir.
3. Valida com as mesmas regras do site: descarta prazos vencidos, resultados, duplicados e itens sem dados mínimos.
4. Confere se a página oficial de cada edital aberto mudou desde a última verificação (possível retificação ou prorrogação).
5. Abre um **pull request** com os candidatos e o relatório. Você revisa no documento oficial, corrige se precisar e faz o merge — o site e as páginas públicas se atualizam sozinhos. Retificações e falhas de fonte vão para uma issue.

**Para ativar (uma vez):**

1. Crie uma chave em [console.anthropic.com](https://console.anthropic.com) e salve como segredo `ANTHROPIC_API_KEY` em *Settings → Secrets and variables → Actions*.
2. Em *Settings → Actions → General*, marque **Allow GitHub Actions to create and approve pull requests**.
3. Rode a primeira vez em *Actions → Monitorar editais → Run workflow*.

Sem a chave, o monitor funciona em modo manual: lista os links novos numa issue para você conferir. O custo da API é por uso; o monitor analisa no máximo 15 links por dia (variável `MAX_NOVOS`) e o modelo pode ser trocado pela variável `MODELO`. Para incluir uma fonte, acrescente a página oficial que lista as chamadas em `data/fontes.json`. Endereços com o ano (como o da FAPESP) precisam ser atualizados em janeiro.

**Teste local:** `ANTHROPIC_API_KEY=... node scripts/monitorar-fontes.mjs` gera `relatorio-monitor.md` e `data/novos-editais.json`; `node scripts/monitorar-fontes.mjs --aplicar` acrescenta os candidatos ao `editais.json`.

## Formato de importação (JSON)

Uma lista de editais, ou um objeto `{ "editais": [...] }` (o mesmo formato gerado por *Exportar*).

```json
{
  "editais": [
    {
      "titulo": "Chamada Universal 2027",
      "instituicao": "CNPq",
      "agencia": "cnpq",
      "tema": "Educação",
      "modalidade": "Auxílio à pesquisa",
      "publico": ["pesquisador", "ict"],
      "abrangencia": "Nacional",
      "moeda": "BRL",
      "valorMax": 150000,
      "valorTotal": 50000000,
      "contrapartida": "Não exigida",
      "abertura": "2027-03-01",
      "encerramento": "2027-04-15",
      "resultado": "2027-08-30",
      "link": "https://www.gov.br/cnpq/pt-br",
      "tags": ["pesquisa básica"],
      "resumo": "Apoio a projetos de pesquisa em todas as áreas do conhecimento.",
      "docsExtras": ["Carta de anuência do departamento"]
    }
  ]
}
```

| Campo | Obrigatório | Observações |
|---|---|---|
| `titulo`, `instituicao` | sim | |
| `numero` | não | identificação oficial, ex.: `Chamada CNPq nº 33/2026` |
| `publico` | sim | `pesquisador`, `ict`, `empresa`, `osc`, `municipio`, `estado` (aceita também os nomes por extenso) |
| `valorMax` | sim, ou `valorNota` | número, valor máximo por proposta; `null` quando não há teto (ex.: só bolsas) |
| `valorNota` | não | faixas, linhas e o que é financiado; obrigatório se `valorMax` for `null` |
| `prazoNota` | não | horário limite, etapas seguintes, cadastro prévio exigido |
| `preProposta` | não | `true` quando há pré-proposta ou consulta de elegibilidade antes da proposta completa |
| `fonte`, `verificadoEm` | recomendado | onde a informação foi conferida e quando (`AAAA-MM-DD`) |
| `abertura`, `encerramento` | sim | `AAAA-MM-DD` ou `DD/MM/AAAA` |
| `link` | sim, se `agencia` não for cadastrada | URL `http(s)` do edital oficial |
| `agencia` | não | `cnpq`, `finep`, `fnde`, `fapesp`, `funbio`, `fns`, `banco-mundial`, `uniao-europeia`, `bid`, `gef`, `nih` |
| `tema` | não | `Tecnologia`, `Saúde`, `Educação`, `Meio Ambiente`, `Infraestrutura`, `Cultura`, `Agronegocio`, `Energia`, `Segurança`, `Desenvolvimento` |
| `abrangencia` | não | `Nacional`, uma região (`Norte`, `Nordeste`, `Centro-Oeste`, `Sudeste`, `Sul`, `Norte e Nordeste`, `Amazônia Legal`, `Semiárido`, `Cerrado e Caatinga`) ou a sigla de uma UF |
| `ufs` | não | lista de siglas, quando a abrangência for um conjunto específico de estados |
| `moeda` | não | `BRL` (padrão), `USD` ou `EUR` |
| `criterios` | não | `[{ "nome": "Mérito", "peso": 40 }, ...]`; use `"peso": null` se a chamada não divulga pesos |
| `docsExtras` | não | documentos específicos; os usuais de cada tipo de proponente entram automaticamente |

Itens inválidos são ignorados e listados no relatório de importação, com o motivo.

## Crescimento, busca e sustentação

O plano de lançamento, com distribuição, indicadores e monetização, está em [`docs/lancamento.md`](docs/lancamento.md). Configurações públicas ficam em [`data/site.json`](data/site.json): verificação do Search Console e do Bing, medição (GoatCounter ou GA4), link de apoio, boletim, canal no WhatsApp, formulário de sugestão e contato. Campos vazios ficam invisíveis.

- **Páginas por intenção de busca** (`para/`, `area/`, `prazos/`), **guias** (`guias/`, conteúdo em `scripts/conteudo.mjs`) e **glossário** (`glossario/`). Páginas com menos de 2 chamadas ficam com `noindex` e fora do sitemap.
- **Imagem de prévia por edital** (`assets/og/`), gerada por `scripts/gerar-imagens.mjs` só quando os dados exibidos mudam.
- **Sugerir edital:** formulário de issue → workflow `Sugestão de edital` → IA extrai os dados → pull request para revisão → quem sugeriu é avisado.
- **IndexNow:** `scripts/notificar-buscadores.mjs` avisa Bing e outros buscadores a cada página alterada (chave em `data/site.json` e no arquivo `<chave>.txt` da raiz).
- **Medição do funil:** eventos `edital-abrir`, `edital-whatsapp`, `edital-oficial`, `proposta-*`, `perfil-salvo`, `agenda`, `prestacao-enviada` etc.
- **Destaque patrocinado:** `"patrocinado": true` e `"patrocinioAte"` no edital; selo sempre visível, sem alterar filtros, compatibilidade ou ordem dos resultados.

## Páginas indexáveis (SEO) e compartilhamento

A plataforma em si é uma página só; para o Google e para o WhatsApp, cada edital e cada instituição também ganham uma **página estática própria**, gerada a partir do `editais.json`:

- `editais/` (lista) e `editais/<titulo>-<id>/` (um por edital), `instituicoes/` e `instituicoes/<id>/`;
- título e descrição otimizados, `canonical`, prévia para WhatsApp e redes (Open Graph, imagem `assets/og-image.jpg`), dados estruturados (schema.org), links entre editais relacionados;
- `sitemap.xml`, `robots.txt` e `404.html`;
- metatags da página inicial (bloco entre `<!-- seo:inicio -->` e `<!-- seo:fim -->`).

Para gerar: `node scripts/gerar-paginas.mjs` (Node 18+, sem dependências). A automação `.github/workflows/gerar-paginas.yml` faz isso sozinha a cada mudança no `editais.json` e todo dia às 06h17, para a situação “aberto/encerrado” acompanhar a data. Não edite os arquivos gerados à mão.

O endereço usado nos links absolutos vem, nesta ordem, da variável `SITE_URL`, do arquivo `CNAME` (domínio próprio) ou do padrão do GitHub Pages.

**Depois de publicar, uma vez só:**

1. Cadastre o site no [Google Search Console](https://search.google.com/search-console) (propriedade do tipo “prefixo do URL”) e envie o `sitemap.xml`.
2. Com domínio próprio: crie o arquivo `CNAME` com o domínio, configure o DNS conforme a documentação do GitHub Pages e rode o gerador de novo. O `robots.txt` só é lido pelos buscadores na raiz de um domínio, então ele passa a valer com o domínio próprio.

### Publicar editais reais para todos os visitantes

1. Em **Editais → Mais ações → Gerenciar editais**, cadastre ou importe os editais.
2. Use **Exportar todos** e salve o arquivo como `editais.json` na raiz do repositório, substituindo o atual.
3. Mantenha `"demonstrativo": false` e atualize `"geradoEm"`: a faixa do site mostra quantos editais foram conferidos e quando.

O gerador também grava os editais dentro do `index.html` (entre `// editais:inicio` e `// editais:fim`), para que a plataforma abra com os dados reais mesmo sem servidor.
