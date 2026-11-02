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

### Ferramentas do captador (`assets/captacao.js` e `assets/captacao.css`)

- **Assinar alertas** (em Editais): calendário assinado do recorte atual — público escolhido (`cal/publico-*.ics`), senão área (`cal/area-<slug>.ics`), senão `cal/todos.ics` — no Google Agenda, Outlook/Apple (`webcal://`) ou por link; e RSS correspondente em `feeds/`.
- **Buscas salvas**: guarda os filtros da URL de `#editais` e mostra, no início e em Editais, quantos editais novos (pela data `publicadoEm`) apareceram desde a última visita a cada busca.
- **Minhas propostas**: alterna **Lista | Quadro** (colunas por etapa; arrastar ou “Mover para”, acessível por teclado), **go/no-go** por proposta (5 critérios de 1 a 5 → Seguir / Avaliar / Não seguir), **cofre de certidões** (tipo, emissão, validade sugerida e aviso quando vence antes do prazo de um edital acompanhado), **backup** em JSON (importação validada) e **quadro em CSV**.
- **Teste de elegibilidade** no detalhe do edital, quando ele tem o campo `elegibilidade`.

Tudo fica só no navegador, em chaves `fb:*` do `localStorage` (apagadas por “Apagar meus dados”).

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
| `elegibilidade` | não | 2 a 6 perguntas de sim/não que o proponente responde sozinho: `[{ "pergunta": "Você tem título de doutor?", "esperado": true, "eliminatoria": true }, ...]`. `pergunta`: até 160 caracteres, na 2ª pessoa, terminando em `?`; `esperado`: a resposta que torna elegível; `eliminatoria`: `true` só quando o edital torna o requisito obrigatório. Use apenas requisitos escritos no edital |
| `fonteRecurso` | não | origem do dinheiro: `publico`, `privado`, `incentivo-fiscal`, `internacional` ou `misto` |
| `tipoValor` | não | como o valor é informado: `por-proposta` (teto por proposta), `total` (só orçamento global), `faixa` (mínimo e máximo por proposta), `bolsa` (só bolsas, por tabela) ou `nao-informado` |
| `fluxoContinuo` | não | `true` só quando a chamada recebe propostas continuamente; `false` para prazo único ou etapas com datas fixas |

Itens inválidos são ignorados e listados no relatório de importação, com o motivo.

## Programas federais do Transferegov (municípios, estados, consórcios e OSCs)

O workflow **Programas do Transferegov** (`.github/workflows/transferegov.yml`, todo dia às 06h23) lê a API pública de dados abertos do Transferegov (`https://api-publica.transferegov.gestao.gov.br/discricionarias/todos-programas`, sem chave) e grava em `data/transferegov.json` os programas com recebimento de **propostas voluntárias** aberto ou previsto. O gerador junta esses programas aos editais curados (IDs a partir de 1.000.000), com página própria, feeds, calendários e páginas por público. São dados oficiais atualizados diariamente, mantidos fora do `editais.json`.

- Quem pode propor vem da natureza jurídica do programa: administração municipal e consórcios → municípios; administração estadual/DF → estados; organizações da sociedade civil → OSCs.
- A consulta é pesada (a visão junta programas e propostas): o script divide por órgão e por UF quando o serviço falha, e mantém o arquivo anterior se a coleta vier incompleta.
- Diagnóstico: *Actions → Programas do Transferegov → Run workflow* com `diagnostico` marcado mostra contagens e amostras sem alterar nada.
- **Abrangência honesta:** a UF do cadastro (`uf_programa`) costuma ser a da unidade que cadastrou, não um limite. Só restringimos quando o título indica a superintendência regional (`SR(XX)` → `abrangencia: "XX"`, `ufs: ["XX"]`). Nos demais casos: `abrangencia: "Não informada"`, `ufCadastro: "<UF>"` (se houver), **sem** `ufs`, e `abrangenciaNota` pedindo conferência. As páginas mostram “Abrangência: não informada (cadastro: SP)” e o selo “Federal”, nunca “Nacional”.
- **Checklist:** o CAUC só aparece para prefeituras e estados (vem de `DOCS_POR_PUBLICO`); `docsExtras` do Transferegov não o repete e OSC não recebe CAUC.

## Jornada de consulta nas páginas estáticas

- **“Posso concorrer?”** logo abaixo do resumo de cada `editais/<slug>/`, sem JavaScript: quem pode pedir, onde vale e as perguntas eliminatórias. O botão principal é “Posso concorrer? Fazer o teste” (abre `#edital-<id>` na plataforma); os lembretes de calendário (.ics e Google Agenda) ficam ao lado do prazo.
- **Linguagem simples** (Lei 15.263/2025; ISO 24495-1): siglas (MROSC, CAUC, FAP, ICT, CNPJ, LDO) com nome completo e link para o glossário na primeira vez em cada página; definições simples em `GLOSSARIO_SIMPLES` (`scripts/conteudo.mjs`), que substituem as de mesmo termo do `GLOSSARIO` do `index.html` só nas páginas estáticas.
- **Pergunta “Foi fácil?”** no rodapé de `editais/<slug>/` e `para/<perfil>/`: três botões, anônimos, sem texto livre. Com JavaScript conta `evento/ces-facil|ces-medio|ces-dificil`, agradece e grava `fb:ces` (não pergunta de novo por 30 dias); sem JavaScript, os botões levam a `obrigado/<resposta>/` (noindex, fora do sitemap), que conta por um pixel do GoatCounter.
- **Eventos medidos** (agregados, sem dados pessoais) e o compromisso de publicar o resultado mensal estão em `dados/#experiencia`.

## Crescimento, busca e sustentação

O plano de lançamento, com distribuição, indicadores e monetização, está em [`docs/lancamento.md`](docs/lancamento.md). Configurações públicas ficam em [`data/site.json`](data/site.json): verificação do Search Console e do Bing, medição (GoatCounter ou GA4), link de apoio, boletim, canal no WhatsApp, formulário de sugestão e contato. Campos vazios ficam invisíveis.

- **Páginas por intenção de busca** (`para/`, `area/`, `prazos/`), **guias** (`guias/`, conteúdo em `scripts/conteudo.mjs`) e **glossário** (`glossario/`). Páginas com menos de 2 chamadas ficam com `noindex` e fora do sitemap.
- **Imagem de prévia por edital** (`assets/og/`), gerada por `scripts/gerar-imagens.mjs` só quando os dados exibidos mudam.
- **Sugerir edital:** formulário de issue → workflow `Sugestão de edital` → IA extrai os dados → pull request para revisão → quem sugeriu é avisado. Para evitar gasto de API por abuso, a análise roda sozinha só para quem é dono/colaborador do repositório; sugestões de outras pessoas rodam quando a mantenedora aplica o rótulo `sugestao-aprovada`.
- **Privacidade, termos e acessibilidade:** páginas `/privacidade/`, `/termos/` e `/acessibilidade/` (declaração: padrão WCAG 2.2 AA, o que foi feito, limitações conhecidas e canal para relatar barreiras, com prazo de resposta) geradas pelo `gerar-paginas.mjs`; preencha `responsavel` e `contato` em `data/site.json` para identificar quem responde pelo site (LGPD).
- **Menu e rodapé:** todas as páginas estáticas usam o mesmo menu da plataforma (Editais · Prazos · Para você · Minhas propostas · Transparência · Ajuda), com submenus em `<details>` operáveis por teclado e gaveta “Menu” no celular; o rodapé tem no máximo três grupos curtos (Editais, Para você, Sobre). A lista completa de editais fica em `editais/`.
- **Segurança (CSP):** toda página gerada, e o `index.html` (no bloco `seo`), recebe `<meta http-equiv="Content-Security-Policy">` e `<meta name="referrer" content="strict-origin-when-cross-origin">`. O gerador calcula o hash sha256 de cada `<script>` inline executável **sobre o conteúdo final** e libera só esses hashes, além de `'self'`, Google Fonts, imagens do OpenStreetMap e, se configurados, GoatCounter/GA4. Consequência: **qualquer edição de um `<script>` inline do `index.html` exige rodar `node scripts/gerar-paginas.mjs` de novo** (o workflow faz isso a cada publicação); sem isso o navegador bloqueia o script. Não use `onclick=` e outros atributos de evento: eles são bloqueados pela política.
- **Design:** design system minimalista (tokens no topo do `<style>` do `index.html` e em `assets/paginas.css`), com modo escuro automático e sem emojis como ícones.
- **IndexNow:** `scripts/notificar-buscadores.mjs` avisa Bing e outros buscadores a cada página alterada (chave em `data/site.json` e no arquivo `<chave>.txt` da raiz).
- **Medição do funil:** eventos `edital-abrir`, `edital-whatsapp`, `edital-oficial`, `proposta-*`, `perfil-salvo`, `agenda`, `prestacao-enviada` etc.
- **Monetização:** destaque patrocinado sinalizado, páginas `/anuncie/` e `/apoie/` — veja a seção [Monetização](#monetização).

## Monetização

Receitas: **destaque patrocinado** (cobrança por proposta comercial, combinada por fora) e **apoio voluntário** (Pix e Apoia.se). O **Plano Pro** (R$ 49/mês) aparece como “em breve”, com lista de espera. Tudo o que é gratuito continua gratuito.

### Regras de transparência (CDC arts. 36–37, CONAR)

- Selo sempre **“Patrocinado por &lt;patrocinador&gt;”** (ou “Patrocinado”, se faltar o nome) no cartão e no detalhe da plataforma, na página do edital, nas listas (editais, instituições, prazos, semana) e nos feeds RSS (título com o prefixo `[Patrocinado] `), com a explicação em `title`/texto para leitor de tela e o link “Por que estou vendo isto?” para `/anuncie/#regras`.
- O patrocínio **não altera** busca, filtros, compatibilidade com o perfil nem a ordem das listas. Ele só ocupa **uma vaga reservada e sinalizada** por página (“Destaque patrocinado”), fora da lista ordenada — o edital continua na sua posição normal da lista.
- Vale só no período contratado e enquanto a chamada não encerrar. Com mais de um patrocínio vigente para a mesma vaga, há rodízio diário (por id).

### Como cadastrar um patrocínio (`editais.json`)

```json
{
  "id": 107,
  "titulo": "…",
  "patrocinado": true,
  "patrocinador": "Instituto Exemplo",
  "patrocinioInicio": "2026-11-01",
  "patrocinioAte": "2026-11-30",
  "patrocinioVagas": ["inicio", "publico", "area", "semana"]
}
```

| Campo | Observações |
|---|---|
| `patrocinado` | `true` liga o destaque |
| `patrocinador` | nome exibido no selo (até 80 caracteres) |
| `patrocinioInicio`, `patrocinioAte` | `AAAA-MM-DD`; sem início vale desde já; sem fim vale até a chamada encerrar |
| `patrocinioVagas` | `inicio` (1ª vaga do destaque da página inicial), `publico` (topo das páginas `para/<público>/` dos públicos do edital), `area` (topo de `area/<área>/`), `semana` (bloco em `semana/`). Padrão: `["inicio"]` |

Faça o merge e o workflow regenera as páginas. Na página inicial, quem definiu um perfil só vê o patrocinado se o edital for compatível com ele. As regras ficam em `scripts/patrocinio.mjs` (gerador e relatório) e em `patrocinioAtivo()` no `index.html` (plataforma).

### Relatório ao patrocinador

```
node scripts/relatorio-patrocinio.mjs              # todos, em Markdown
node scripts/relatorio-patrocinio.mjs --id 107     # um edital
node scripts/relatorio-patrocinio.mjs --json       # JSON
node scripts/relatorio-patrocinio.mjs --hoje 2026-11-30
```

Lista patrocínios ativos, agendados e encerrados, com período, vagas, páginas onde o destaque aparece e dias na vaga. **Cliques** vêm do GoatCounter (preencha `analytics.goatcounter` em `data/site.json`): cada clique num item patrocinado conta `evento/patrocinio-clique` (total) e `evento/patrocinio-<id>`; o botão “Edital oficial” da página do edital conta `evento/patrocinio-oficial-<id>`. No painel do GoatCounter, escolha o período do patrocínio e filtre por `patrocinio-<id>` (o relatório indica o endereço do painel, o período e o filtro), ou exporte em *Settings › Export* e some a coluna do caminho. Contagem agregada, sem cookies e sem identificar pessoas.

### Textos e contatos

- **`data/comercial.json`**: textos de `/anuncie/` (título, para quem, por que, pacotes com `precoCheio` e `precoLancamento` — preço 0 aparece como “Sob consulta” —, `servicos` (espaço próprio para consultorias e softwares, selo “Publicidade · Serviço”, nunca ao lado de uma chamada), como funciona, regras, FAQ, chamada), de `/apoie/` (por que, uso do dinheiro, formas `pix`/`apoiase`, transparência, nota) e do Plano Pro (página própria `/pro/`). O arquivo atual é um **exemplo** (`"_exemplo": true`).
- **`/anuncie/`** abre com uma tabela-resumo de preços logo abaixo do título e termina com um formulário de pedido sem servidor: ele monta um e-mail (`mailto:` para `comercial.email`) com assunto e corpo preenchidos (organização, link oficial do edital, pacote, período, nota fiscal). Nada é enviado nem guardado pelo site.
- **`data/site.json`** (vazio = oculto):
  - `comercial.email`: e-mail **profissional** publicado em `/anuncie/` (botões abrem o e-mail com assunto preenchido); ou `comercial.formulario` (URL de formulário). Sem nenhum dos dois, os botões levam ao formulário de parceria do GitHub (público). Nenhum e-mail é publicado se não estiver aqui.
  - `apoio.pix.chave`, `apoio.pix.nome` (até 25 letras), `apoio.pix.cidade` (até 15): geram em `/apoie/` a chave com botão de copiar, o **Pix copia e cola** (BR Code estático EMV com CRC16-CCITT, `scripts/pix.mjs`) e o **QR Code** em SVG (`scripts/qrcode.mjs`, sem dependências). Chave: e-mail, telefone `+55DDNÚMERO`, CPF/CNPJ só com números ou chave aleatória.
  - `apoio.apoiase`: URL da campanha (botão “Apoiar no Apoia.se”). `apoio.url` continua aceito como outro link de apoio.
  - `pro.listaEspera`: formulário da lista de espera do Pro (vazio = mesmo contato comercial).
- Sem nenhuma forma de apoio configurada, `/apoie/` mostra “em breve”; os links “Apoie” e “Anuncie” ficam sempre no rodapé. O endereço antigo `/parcerias/` continua no ar e aponta para `/anuncie/`.

## Páginas indexáveis (SEO) e compartilhamento

A plataforma em si é uma página só; para o Google e para o WhatsApp, cada edital e cada instituição também ganham uma **página estática própria**, gerada a partir do `editais.json`:

- `editais/` (lista) e `editais/<titulo>-<id>/` (um por edital), `instituicoes/` e `instituicoes/<id>/`;
- título e descrição otimizados, `canonical`, prévia para WhatsApp e redes (Open Graph, imagem `assets/og-image.jpg`), dados estruturados (schema.org), links entre editais relacionados;
- `sitemap.xml`, `robots.txt` e `404.html`;
- **Assinaturas:** feeds RSS em `feeds/` (`todos.xml`, `publico-<publico>.xml`, `area-<slug>.xml`, `instituicao-<agencia>.xml`, `alteracoes.xml`) e calendários iCalendar em `cal/` (mesmos recortes, mais `edital-<id>.ics`), com um evento de dia inteiro por prazo e lembretes 7 dias e 1 dia antes. Todos os arquivos existem mesmo sem itens;
- **Histórico de alterações:** a cada execução, o gerador compara os campos-chave com `data/editais-snapshot.json` e acrescenta as mudanças (prazo, valor, link, título, novo edital) em `data/alteracoes.json`. Na primeira execução só cria o snapshot. A comparação é idempotente, então pode rodar várias vezes por dia. Esses dois arquivos são gravados pelo workflow; não edite à mão;
- **Resumo semanal:** `semana/` (semana ISO atual, fuso de Brasília) e `semana/AAAA-SS/` (arquivo; semanas anteriores são mantidas), mais os feeds RSS. “Resumo semanal” é sempre isso: a página `/semana/` e o RSS. Não há envio por e-mail;
- **Dados abertos:** `dados/` explica o `editais.json` (licença CC BY 4.0), o esquema dos campos (em `ESQUEMA_CAMPOS`, `scripts/conteudo.mjs`) e lista feeds e calendários;
- **Instituições sem chamada aberta ou prevista:** a página `instituicoes/<id>/` mostra “Sem chamadas abertas agora”, o portal oficial e como acompanhar (feed e calendário da instituição); fica com `noindex,follow` e fora do sitemap até haver chamada;
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

## Licença dos dados

Os dados de `editais.json`, `data/alteracoes.json`, feeds e calendários estão sob a licença [Creative Commons Atribuição 4.0 Internacional (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/deed.pt-br). A licença CC BY 4.0 cobre a seleção, a organização e os textos próprios do Fundos Brasil. Textos oficiais, nomes e marcas de terceiros não são licenciados por nós; atos oficiais são de domínio público (Lei 9.610/1998, art. 8º, IV).

O Fundos Brasil não tem vínculo com o Fundo Brasil de Direitos Humanos.

## Segurança

Encontrou uma vulnerabilidade? **Não abra issue pública.** Veja a [Política de Segurança](SECURITY.md) para relatar de forma privada (aba Security → Report a vulnerability, ou contatofundosbrasil@gmail.com). O arquivo `.well-known/security.txt` (RFC 9116) aponta para os mesmos canais; ele passa a valer na raiz quando o site tiver domínio próprio.
