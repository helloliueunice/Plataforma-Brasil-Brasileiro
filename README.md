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
- **Filtros**: busca sem acentos, situação, quem pode participar, área, modalidade, procedência, estado, valor por proposta e prazo. Os filtros ficam na URL (`#editais?status=aberto&uf=SP`), e cada edital tem link próprio (`#edital-3`).
- **Lista ou calendário** mensal com aberturas, prazos finais e resultados.
- **Detalhes**: condições, cronograma, critérios com pesos e checklist de documentos por tipo de proponente (progresso salvo no navegador). Ficha pronta para imprimir ou salvar em PDF.
- **Agenda**: prazo de um edital ou de todos os filtrados em `.ics`, com lembretes 7 dias e 1 dia antes.
- **Exportação** em CSV (abre direto no Excel em português) e **comparação** de até 3 editais.
- **Gerenciar editais**: cadastre editais reais pelo formulário ou importe um arquivo JSON. Ficam salvos no navegador (`localStorage`); exporte o JSON para compartilhar ou versionar.

> Os editais que acompanham a página são **demonstrativos**. Confirme sempre datas, valores e requisitos no edital oficial.

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
| `publico` | sim | `pesquisador`, `ict`, `empresa`, `osc`, `municipio`, `estado` (aceita também os nomes por extenso) |
| `valorMax` | sim | número, valor máximo por proposta |
| `abertura`, `encerramento` | sim | `AAAA-MM-DD` ou `DD/MM/AAAA` |
| `link` | sim, se `agencia` não for cadastrada | URL `http(s)` do edital oficial |
| `agencia` | não | `cnpq`, `finep`, `fnde`, `fapesp`, `funbio`, `fns`, `banco-mundial`, `uniao-europeia`, `bid`, `gef`, `nih` |
| `tema` | não | `Tecnologia`, `Saúde`, `Educação`, `Meio Ambiente`, `Infraestrutura`, `Cultura`, `Agronegocio`, `Energia`, `Segurança`, `Desenvolvimento` |
| `abrangencia` | não | `Nacional`, uma região (`Norte`, `Nordeste`, `Centro-Oeste`, `Sudeste`, `Sul`, `Norte e Nordeste`, `Amazônia Legal`, `Semiárido`, `Cerrado e Caatinga`) ou a sigla de uma UF |
| `ufs` | não | lista de siglas, quando a abrangência for um conjunto específico de estados |
| `moeda` | não | `BRL` (padrão), `USD` ou `EUR` |
| `criterios` | não | `[{ "nome": "Mérito", "peso": 40 }, ...]` |
| `docsExtras` | não | documentos específicos; os usuais de cada tipo de proponente entram automaticamente |

Itens inválidos são ignorados e listados no relatório de importação, com o motivo.

### Publicar editais reais para todos os visitantes

1. Em **Editais → Mais ações → Gerenciar editais**, cadastre ou importe os editais.
2. Use **Exportar todos** e salve o arquivo como `editais.json` na raiz do repositório, substituindo o atual.
3. Remova a linha `"demonstrativo": true` do arquivo: a faixa do site passa a dizer "editais publicados" com a data de atualização.
