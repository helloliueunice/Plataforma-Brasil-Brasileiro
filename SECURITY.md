# Política de Segurança — Radar Fomento

*Versão 1.0 · 02/11/2026 · [English summary below](#english-summary)*

O Radar Fomento leva a sério a segurança do site, dos dados e das pessoas que o usam. Esta política explica como relatar uma vulnerabilidade, o que esperar de nós e quais cuidados pedimos a quem pesquisa. Ela segue a ISO/IEC 29147 (divulgação de vulnerabilidades), a ISO/IEC 30111 (tratamento de vulnerabilidades), as recomendações do CERT.br, a Lei Geral de Proteção de Dados (Lei 13.709/2018) e o Regulamento de Comunicação de Incidente de Segurança da ANPD (Resolução CD/ANPD nº 15/2024).

## Como relatar

**Não abra issue pública** para relatar vulnerabilidades.

1. **Preferencial:** use o relato privado do GitHub, na aba **Security → Report a vulnerability** deste repositório. Só a responsável pelo projeto vê o relato.
2. **Alternativa:** e-mail para **contatofundosbrasil@gmail.com**, com o assunto `[SEGURANÇA]`.

Para nos ajudar a reproduzir, inclua se puder:

- a página, rota ou arquivo afetado;
- os passos para reproduzir e o resultado observado;
- o impacto que você imagina (ex.: execução de script, troca da chave Pix, acesso a dados);
- uma prova de conceito mínima, sem dados reais de terceiros;
- como podemos dar crédito a você, se quiser.

Aceitamos relatos em português, inglês ou espanhol.

## O que você pode esperar de nós

| Etapa | Prazo |
|---|---|
| Confirmação de recebimento | até 3 dias úteis |
| Avaliação inicial e classificação de gravidade | até 10 dias úteis |
| Correção de vulnerabilidade crítica ou alta | meta de até 30 dias |
| Correção de vulnerabilidade média ou baixa | meta de até 90 dias |
| Divulgação coordenada | combinada com você, em regra até 90 dias após o relato |

- A gravidade é classificada pelo **CVSS v4.0**, considerando o impacto real no contexto do projeto.
- Mantemos você informado durante a correção e avisamos quando ela for publicada.
- Quando fizer sentido, publicamos um aviso de segurança (GitHub Security Advisory) e pedimos identificador CVE.
- O Radar Fomento é um projeto independente e gratuito, mantido por uma pessoa: **não há programa de recompensa em dinheiro**. Com sua autorização, agradecemos publicamente na seção [Agradecimentos](#agradecimentos).

## Escopo

**Dentro do escopo**

- O site publicado em `https://helloliueunice.github.io/Plataforma-Brasil-Brasileiro/` (plataforma e páginas estáticas).
- O código deste repositório, incluindo os scripts em `scripts/` e as automações em `.github/workflows/`.
- A integridade da chave Pix, do código "copia e cola" e do QR Code da página Apoie.
- Os dados publicados (`editais.json`, `data/*.json`, feeds RSS e calendários).
- A cadeia de publicação: injeção em automações, uso indevido de credenciais, injeção de instruções no monitor de editais com IA, sugestões de edital maliciosas.

**Fora do escopo**

- Sites de terceiros que apenas citamos ou para os quais apontamos (órgãos públicos, fundações, Transferegov, bancos).
- A infraestrutura do GitHub, do GitHub Pages, do Google ou da Anthropic: relate diretamente a esses fornecedores.
- Negação de serviço (DoS/DDoS), testes de carga e varreduras automatizadas em volume.
- Engenharia social, phishing ou acesso físico.
- Ausência de cabeçalhos que o GitHub Pages não permite configurar (ex.: `frame-ancestors`, HSTS próprio), sem um ataque prático demonstrado.
- Self-XSS, ou ataques que exigem que a própria vítima cole código no navegador.
- Relatos gerados apenas por ferramentas automáticas, sem impacto demonstrado.

## Regras para pesquisa de boa-fé (porto seguro)

Se você agir de boa-fé e seguir estas regras, **não tomaremos medidas legais contra você** por causa da pesquisa, e consideraremos a atividade autorizada para fins desta política:

- teste apenas o que está no escopo e use o mínimo necessário para demonstrar o problema;
- não acesse, copie, altere ou apague dados de outras pessoas; se encontrar dados pessoais por acidente, pare, não guarde cópia e nos avise;
- **não faça pagamentos Pix de teste** e não altere a chave Pix publicada; uma demonstração local basta;
- não degrade o serviço nem interfira no uso de outras pessoas;
- não use a vulnerabilidade além do necessário para confirmá-la e não a divulgue antes do prazo combinado;
- cumpra a lei brasileira.

Esta autorização não alcança sistemas de terceiros e não substitui a permissão deles.

## Dados pessoais e incidentes

A plataforma guarda perfil, propostas e documentos **apenas no navegador de quem usa**; esses dados não chegam até nós. Tratamos poucos dados pessoais: e-mails recebidos e informações de pagamentos Pix, conforme a [Política de Privacidade](https://helloliueunice.github.io/Plataforma-Brasil-Brasileiro/privacidade/).

Se um incidente de segurança puder causar risco ou dano relevante aos titulares, comunicaremos a **Autoridade Nacional de Proteção de Dados (ANPD)** e os titulares afetados em até **3 dias úteis** do conhecimento, conforme o art. 48 da LGPD e a Resolução CD/ANPD nº 15/2024, e manteremos o registro do incidente.

Canal do titular de dados: contatofundosbrasil@gmail.com.

## Medidas de segurança adotadas

- Política de Segurança de Conteúdo (CSP) com hashes em todas as páginas e `referrer` restrito.
- Bibliotecas servidas pelo próprio site, sem CDN de terceiros.
- Escape de todo conteúdo dinâmico e aceitação apenas de links `https://`.
- Automações do GitHub fixadas por SHA, com permissões mínimas por job e sem credencial de escrita nas etapas que leem conteúdo de terceiros ou instalam pacotes.
- Trava de integridade da chave Pix no build e vigia automático da página publicada.
- Monitor de editais com lista de domínios permitidos, limite de redirecionamentos, de tamanho e de custo; todo conteúdo extraído por IA passa por revisão humana antes de ser publicado.
- Dependabot, secret scanning e revisão obrigatória dos arquivos sensíveis (`.github/CODEOWNERS`).

## Versões suportadas

O site é publicado de forma contínua a partir do branch `main`. Só a versão publicada mais recente recebe correções.

## Agradecimentos

Agradecemos às pessoas que relatarem vulnerabilidades de forma responsável. Com autorização, os nomes serão listados aqui.

---

## English summary

Please **do not open public issues** for security problems. Report privately through **GitHub → Security → Report a vulnerability** on this repository, or by e-mail to **contatofundosbrasil@gmail.com** with the subject `[SECURITY]`.

- **Response times:** acknowledgement within 3 business days; triage within 10 business days; target fix within 30 days for critical/high issues and 90 days for others.
- **Disclosure:** coordinated, normally within 90 days of the report. Severity is rated with CVSS v4.0. There is no paid bounty; with your permission we credit you publicly.
- **In scope:** the published site, this repository's code and GitHub Actions workflows, the integrity of the Pix key and QR code, and the published data.
- **Out of scope:** third-party sites, GitHub/Google/Anthropic infrastructure, DoS, social engineering, and headers that GitHub Pages cannot set unless you show a practical attack.
- **Safe harbor:** good-faith research that follows the rules above (no access to others' data, no test Pix payments, no service disruption, no early disclosure) is considered authorized, and we will not pursue legal action. Personal-data incidents are notified to Brazil's data protection authority (ANPD) and to affected people as required by the LGPD.
