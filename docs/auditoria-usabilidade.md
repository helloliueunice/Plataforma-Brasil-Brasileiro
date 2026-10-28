# Auditoria de usabilidade — Plataforma Brasil Brasileiro

Avaliação heurística (10 heurísticas de Nielsen) e revisão das jornadas de ponta a ponta, feita em 28/10/2026 sobre a versão com a ferramenta de editais reconstruída. Cada problema lista a heurística violada, a gravidade (0–4) e como foi resolvido.

## Jornadas avaliadas

| Jornada | Antes | Depois |
|---|---|---|
| **Proponente** — descobrir → avaliar → preparar → submeter → resultado | Terminava no checklist. Não havia onde registrar a submissão, o protocolo ou o resultado. | **Minhas propostas**: etapas (interesse, preparação, submetida, aprovada/não aprovada), próximo passo contextual, protocolo, anotações, progresso de documentos e alertas de prazo. |
| **Gestor de projeto** — executar → prestar contas → acompanhar análise | O próprio usuário escolhia o status "Aprovada"; não havia validação, rascunho, revisão, protocolo nem histórico. | Fluxo em 3 etapas (preencher → revisar → protocolo), com rascunho automático, validação com resumo de erros, exigência de identificação, comprovante para download e histórico com parecer. |
| **Cidadão** — explorar fundos → instituição → projetos → mapa | Números inventados e contraditórios; projetos sem detalhe; mapa sem legenda nem alternativa. | Painel calculado a partir dos dados, fundos como botões com contagem de editais abertos, detalhe de projeto, mapa com legenda, filtro e tabela acessível. |
| **Conta** | "Entrar" logava direto como um usuário fictício. | Formulário com validação, sessão persistente, menu da conta e retorno ao ponto de origem após o login. |

## Problemas encontrados por heurística

| # | Heurística | Problema | Grav. | Solução |
|---|---|---|---|---|
| 1 | Visibilidade do status | Título da aba nunca mudava; trocas de página não eram anunciadas para leitor de tela | 2 | `document.title` por página e por edital; região `aria-live` anuncia a página; foco vai para o conteúdo |
| 2 | Visibilidade do status | Prazos de editais acompanhados não apareciam fora da lista | 3 | Sino com contagem (prazos ≤ 15 dias), contador em "Minhas propostas", aviso de prestação perto do vencimento |
| 3 | Correspondência com o mundo real | Na prestação de contas, o usuário escolhia o próprio status ("Aprovada") | 4 | Status passa a ser atribuído pela análise; envio gera protocolo "Em análise" |
| 4 | Correspondência com o mundo real | Proposta submetida continuava com alerta "Encerra em X dias" | 2 | Depois de submetida, mostra a etapa em vez da contagem regressiva |
| 5 | Correspondência com o mundo real | Siglas (CAUC, MROSC, ICT, CRF…) sem explicação | 2 | Glossário na Ajuda e termos sublinhados com definição no próprio edital |
| 6 | Controle e liberdade | Remover favorito, parar de acompanhar e excluir edital não podiam ser desfeitos | 3 | Avisos com **Desfazer** |
| 7 | Controle e liberdade | Fechar a prestação perdia o que foi digitado | 4 | Rascunho salvo automaticamente, com opção "Continuar depois" e "Descartar rascunho" |
| 8 | Consistência e padrões | 7 elementos `role="main"`; cartões de fundos eram `div` com `role="button"` | 2 | Um único `<main>`; botões reais |
| 9 | Consistência e padrões | Números do painel contradiziam as listas (38 × 11 instituições; 1.842 × 3 projetos) | 3 | Todos os números calculados a partir dos dados exibidos |
| 10 | Prevenção de erros | Prestação aceitava envio vazio, valor acima do aprovado ou anexos inválidos | 4 | Validação por campo (valor entre o já comprovado e o aprovado, mínimo de caracteres, tipo e tamanho de arquivo, declaração) e etapa de revisão antes do envio |
| 11 | Reconhecer em vez de lembrar | Não havia como reencontrar um edital visto antes | 2 | "Vistos recentemente" e "Suas propostas" no painel |
| 12 | Reconhecer em vez de lembrar | O painel não indicava por onde começar | 3 | Três cartões de entrada, um por jornada |
| 13 | Flexibilidade e eficiência | Usuário frequente sem atalhos | 1 | Tecla `/` leva à busca; links diretos para filtros, editais e instituições |
| 14 | Estética e minimalismo | Barra de ferramentas de editais com 7 botões | 2 | Ações secundárias agrupadas em **Mais ações** |
| 15 | Ajudar a reconhecer e corrigir erros | Mensagens de erro genéricas ou ausentes | 3 | Resumo de erros com link para cada campo, mensagens que dizem como corrigir, `aria-invalid` |
| 16 | Ajudar a reconhecer e corrigir erros | Link para edital, instituição ou página inexistente falhava em silêncio | 2 | Aviso e redirecionamento para a lista ou o início |
| 17 | Ajuda e documentação | Não havia ajuda | 2 | Página **Ajuda**: passo a passo por jornada, glossário pesquisável, perguntas frequentes e opção de apagar os dados locais |
| 18 | Visibilidade / honestidade dos dados | Sem indicação da origem dos editais | 3 | Faixa informa se os dados são de exemplo ou do `editais.json` publicado, com a data |
| 19 | Flexibilidade | Mapa inútil sem conexão e inacessível por teclado | 2 | Tabela equivalente sempre visível; mensagem clara quando o mapa não carrega |
| 20 | Estética e minimalismo | Gráfico deixava área em branco sem a biblioteca | 1 | Barras em HTML como alternativa |

Gravidade: 0 = não é problema · 1 = cosmético · 2 = menor · 3 = maior · 4 = catástrofe de usabilidade.

## Verificação

Testes automatizados (Playwright) percorrem as três jornadas e as correções acima: 52 verificações em desktop e celular (390 px), sem erros de JavaScript e sem rolagem horizontal em nenhuma página.

## Limitações conhecidas

- Login, propostas, prestações e rascunhos ficam no `localStorage` do navegador. Não há servidor, autenticação real nem sincronização entre dispositivos.
- Anexos da prestação de contas guardam apenas nome e tamanho do arquivo.
- Valores de instituições, projetos e editais de exemplo são ilustrativos.
- Recomendação para a próxima rodada: teste com 5 usuários reais por perfil (pesquisador, gestor municipal, OSC) para validar a linguagem e a ordem das etapas.
