# Plano de lançamento, crescimento e sustentação

Objetivo: ser a referência em "editais abertos" no Brasil, medido por **propostas submetidas a partir da plataforma**, não só por visitas.

## 1. Ativação (faça uma vez — cerca de 1 hora)

| # | O quê | Onde | Por quê |
|---|---|---|---|
| 1 | Cadastrar o site no **Google Search Console** (propriedade "prefixo do URL"), colar o código de verificação em `data/site.json → googleVerificacao` e enviar o `sitemap.xml` | search.google.com/search-console | Sem isso, a indexação pode levar semanas; com isso, você vê buscas, cliques e erros |
| 2 | Fazer o mesmo no **Bing Webmaster Tools** (`bingVerificacao`) | bing.com/webmasters | O Bing alimenta o ChatGPT Search e o Copilot; o IndexNow já avisa o Bing a cada mudança |
| 3 | Criar conta no **GoatCounter** (gratuito, sem cookies, sem banner de LGPD) e colocar o código em `analytics.goatcounter` | goatcounter.com | Mede visitas e o funil: abrir edital → acompanhar → WhatsApp → portal oficial |
| 4 | Cadastrar o segredo `ANTHROPIC_API_KEY` e permitir que o Actions abra PRs | Settings → Secrets / Actions | Liga o monitor diário e as sugestões de edital com IA |
| 5 | Rodar **Monitorar editais** com `max_novos = 100` e revisar os PRs | Actions | Processa as ~90 chamadas já detectadas (FAPESP, MDA, MinC, FAPES, CNPq) |
| 6 | Rodar **Gerar páginas de editais** com `notificar_tudo` marcado | Actions | Avisa Bing e outros buscadores sobre todas as páginas no lançamento |
| 7 | Registrar um **domínio próprio** (.com.br ou .org.br, ~R$ 40/ano), criar o arquivo `CNAME` e configurar o DNS do GitHub Pages | registro.br | Credibilidade, links mais curtos e `robots.txt` válido na raiz |
| 8 | Criar o **canal no WhatsApp** e o **boletim** (Substack, Buttondown ou similar) e colar os links em `whatsappCanal` e `boletim.url` | WhatsApp / provedor | É o que traz a pessoa de volta toda semana |

Depois de editar `data/site.json`, o site é regenerado sozinho.

## 2. Por que o Google deve ranquear

- **Uma página por edital**, com título, descrição, dados estruturados, imagem de prévia própria e editais relacionados.
- **Páginas por intenção de busca**: para pesquisadores, para universidades e ICTs, por área e por prazo. Elas são atualizadas todos os dias com o mês corrente no título ("Editais abertos para pesquisadores (Outubro de 2026)").
- **Conteúdo útil e original**: quatro guias (encontrar editais, documentos, proposta competitiva, prestação de contas) e um glossário. É o que dá autoridade além da lista.
- **Proteção contra conteúdo fraco**: perfis com menos de 2 chamadas ficam fora do índice até ganharem conteúdo.
- **Técnica em dia**: sitemap, canonical, links internos, feed RSS, HTML legível sem JavaScript, scripts pesados adiados e IndexNow.

O que só vem com tempo: **autoridade (links de outros sites)** e **frescor**. Os dois estão no plano de distribuição abaixo.

## 3. Distribuição (as primeiras 8 semanas)

1. **Pró-reitorias de pesquisa e escritórios de projetos:** a maioria mantém uma página de "oportunidades de fomento". Peça para incluírem o link do Fundos Brasil (ou da página do público deles). Cada link de universidade (.edu.br) vale muito para o Google.
2. **WhatsApp e grupos de pesquisa:** compartilhe a página de cada edital novo (a prévia já mostra título, valor e prazo). Comece pelos grupos de pós-graduação e de captação de recursos.
3. **LinkedIn:** um post por semana com "editais que encerram nos próximos 15 dias", com link para `/prazos/`.
4. **Redes de OSCs e de municípios** (associações de municípios, fóruns de OSCs, consórcios): mostre as páginas para OSCs e municípios assim que o monitor trouxer chamadas para elas.
5. **Instituições financiadoras:** ofereça a publicação gratuita das chamadas (página `/parcerias/`). Elas querem alcance, e cada chamada sugerida vira conteúdo novo.
6. **Imprensa e newsletters de ciência e terceiro setor:** pauta "plataforma gratuita reúne editais conferidos nas fontes oficiais".

## 4. Indicadores (revisar toda semana)

| Etapa | Indicador | Onde |
|---|---|---|
| Alcance | impressões e cliques no Google, posição média por página | Search Console |
| Interesse | visitas por página de edital e por perfil | GoatCounter |
| Ativação | eventos `edital-abrir`, `perfil-salvo`, `proposta-interesse` | GoatCounter |
| Compartilhamento | `edital-whatsapp`, `edital-compartilhar` | GoatCounter |
| Resultado | `edital-oficial` (cliques para submeter), `proposta-submetida` | GoatCounter |
| Oferta | editais publicados e sugestões recebidas por semana | GitHub (PRs e issues) |

## 5. Sustentação financeira (em ordem de prioridade)

1. **Apoio institucional e de fomento:** projetos de tecnologia cívica e transparência têm editais próprios. Use as métricas de impacto acima.
2. **Contratos com governos, FAPs e fundações (B2G):** portal de captação e de prestação de contas com a identidade do cliente, a partir deste código.
3. **Destaque patrocinado e patrocínio de conteúdo:** só chamadas reais e abertas, sempre com o selo "Patrocinado", sem alterar filtros, compatibilidade ou a ordem dos resultados (regras publicadas em `/parcerias/`). Para ativar num edital, inclua `"patrocinado": true` e `"patrocinioAte": "AAAA-MM-DD"` no `editais.json`.
4. **Plano pago para equipes** (consultorias e escritórios de projetos), quando houver contas de usuário (Fase 3): vários perfis, relatórios e alertas ilimitados.
5. **Doações recorrentes** (Apoia.se, Catarse): link em `apoio.url`.

Não usamos anúncios de terceiros: rendem pouco nesse nicho e minam a confiança, que é o principal ativo de um portal sobre dinheiro público.

## 6. Custos

GitHub Pages, GitHub Actions, GoatCounter, Search Console e IndexNow: gratuitos. API da Anthropic: por uso, limitada por `MAX_NOVOS` (15 análises/dia por padrão). Domínio: ~R$ 40/ano.
