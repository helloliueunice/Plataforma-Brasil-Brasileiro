/**
 * Conteúdo editorial das páginas estáticas: textos das páginas por público e guias.
 * Em HTML simples; links internos usam o marcador {raiz}, trocado pelo caminho relativo.
 * Ao editar, mantenha a data em `atualizado` (aparece para leitores e buscadores).
 */

export const PUBLICOS_HUB = {
    pesquisador: {
        slug: 'pesquisadores',
        titulo: 'Editais abertos para pesquisadores',
        h1: 'Editais e chamadas abertas para pesquisadores',
        descricao: 'Auxílios à pesquisa, bolsas de produtividade e cooperação internacional com inscrições abertas: valores, prazos, critérios e documentos, conferidos nas fontes oficiais.',
        intro: `<p>Agências como CNPq, CAPES, FINEP e as fundações estaduais de amparo à pesquisa (FAPs) abrem chamadas ao longo de todo o ano. Elas financiam projetos de pesquisa, bolsas, eventos científicos, cooperação internacional e infraestrutura. Em geral, quem submete é o pesquisador com doutorado e vínculo formal com uma universidade ou instituto de pesquisa (ICT). Muitas FAPs exigem que a instituição fique no próprio estado.</p>
<p>Antes de começar, confira três pontos que eliminam muitas propostas: <strong>elegibilidade</strong> (titulação, vínculo, tempo de doutorado), <strong>aderência</strong> às linhas da chamada e <strong>prazo</strong>, incluindo o horário limite no sistema de submissão.</p>`,
        dicas: ['Mantenha o Currículo Lattes atualizado: várias chamadas exigem atualização até a data limite.', 'Leia os critérios de avaliação e os pesos antes de escrever: eles dizem onde concentrar o texto.', 'Confirme se a chamada tem etapa de pré-proposta: o primeiro prazo costuma ser bem anterior ao final.']
    },
    ict: {
        slug: 'universidades-e-icts',
        titulo: 'Editais abertos para universidades e ICTs',
        h1: 'Editais abertos para universidades, institutos e ICTs',
        descricao: 'Chamadas institucionais para universidades e instituições de ciência e tecnologia: bolsas, infraestrutura, inovação e parcerias com empresas, com prazos e requisitos.',
        intro: `<p>Algumas chamadas são <strong>institucionais</strong>: a proposta é apresentada pela universidade ou ICT, por um representante indicado pelo dirigente máximo, e não por um pesquisador isolado. É o caso de programas de bolsas em parceria com empresas, apoio à infraestrutura e projetos de inovação social.</p>
<p>Esses editais costumam exigir comprovação institucional: Núcleo de Inovação Tecnológica (NIT) constituído, política de inovação, cadastro prévio no sistema do financiador e, nas instituições públicas, uma fundação de apoio que gerencie os recursos. Comece cedo: as assinaturas e os cadastros institucionais levam semanas.</p>`,
        dicas: ['Verifique se o cadastro da instituição no sistema do financiador está aprovado antes do prazo.', 'Reúna cedo as cartas de anuência de parceiros e a indicação formal do representante.', 'Alinhe com a fundação de apoio as regras de gestão e o custo operacional permitido.']
    },
    empresa: {
        slug: 'empresas-e-startups',
        titulo: 'Editais abertos para empresas e startups',
        h1: 'Editais de inovação abertos para empresas e startups',
        descricao: 'Subvenção econômica e apoio não reembolsável para pesquisa e inovação em empresas e startups: valores, prazos, porte exigido e documentos.',
        intro: `<p>Empresas podem receber recursos <strong>não reembolsáveis</strong> para pesquisa, desenvolvimento e inovação. É a chamada subvenção econômica, prevista na Lei de Inovação (Lei nº 10.973/2004). Programas como o PIPE, da FAPESP, e as chamadas de subvenção da Finep e das FAPs priorizam projetos com risco tecnológico e potencial de mercado.</p>
<p>Os requisitos mais comuns são porte (por exemplo, até 250 empregados), sede ou unidade de P&D no estado do financiador, regularidade fiscal e trabalhista e, em muitos casos, contrapartida. Em alguns programas, o pesquisador responsável precisa ser sócio ou ter vínculo com a empresa.</p>`,
        dicas: ['Separe as certidões federais, do FGTS e trabalhista: algumas valem só 30 dias.', 'Mostre o risco tecnológico e o que ainda não existe no mercado: é o coração da avaliação.', 'Confira se há pré-proposta e se a contrapartida pode ser econômica (bens e serviços) ou só financeira.']
    },
    osc: {
        slug: 'oscs-e-ongs',
        titulo: 'Editais abertos para OSCs e ONGs',
        h1: 'Editais abertos para OSCs, ONGs, associações e cooperativas',
        descricao: 'Chamamentos públicos e editais para organizações da sociedade civil: termos de fomento, prêmios e apoio a projetos, com prazos, valores e documentos exigidos.',
        intro: `<p>Organizações da sociedade civil acessam recursos públicos principalmente por <strong>chamamentos públicos</strong> regidos pelo Marco Regulatório das OSCs (MROSC, Lei nº 13.019/2014), além de editais de fundações, institutos e empresas.</p>
<p>O MROSC exige, entre outros pontos, um tempo mínimo de existência com CNPJ ativo: em regra, 1 ano para parcerias com municípios, 2 com estados e o Distrito Federal e 3 com a União, prazo que o ente pode reduzir por ato específico quando nenhuma organização o atingir (Lei 13.019/2014, art. 33, V, “a”). Esse requisito não se aplica a acordos de cooperação. Também exige experiência prévia no objeto e capacidade técnica e operacional. O estatuto precisa prever objetivos de relevância pública e social.</p>`,
        dicas: ['Mantenha atas, estatuto e certidões em dia: são cobrados em quase todos os chamamentos.', 'Documente a experiência prévia com fotos, relatórios, declarações de parceiros e matérias.', 'Leia o plano de trabalho exigido: metas, indicadores e orçamento precisam conversar.']
    },
    municipio: {
        slug: 'municipios-e-prefeituras',
        titulo: 'Editais e programas abertos para municípios',
        h1: 'Editais e programas federais abertos para municípios e prefeituras',
        descricao: 'Programas e seleções de propostas para prefeituras: transferências voluntárias, fundo a fundo e emendas, com prazos, requisitos e documentos.',
        intro: `<p>Municípios captam recursos federais por transferências voluntárias (convênios e contratos de repasse), transferências fundo a fundo e seleções de programas, quase sempre com propostas cadastradas no <strong>Transferegov.br</strong>.</p>
<p>Antes de qualquer seleção, mantenha o município regular no <strong>CAUC</strong>, o cadastro do Tesouro Nacional que verifica as exigências fiscais e legais para receber transferências voluntárias. Também deixe pronto um banco de projetos (terrenos regularizados, projetos de engenharia, estudos): muitas seleções abrem com prazos curtos.</p>`,
        dicas: ['Consulte o CAUC com antecedência: pendências travam a celebração do convênio.', 'Mantenha usuários do Transferegov.br ativos e com os perfis corretos.', 'Tenha projetos básicos e documentação de terrenos prontos para as seleções do ano.']
    },
    estado: {
        slug: 'governos-estaduais',
        titulo: 'Editais e programas abertos para governos estaduais',
        h1: 'Editais e programas abertos para estados e o Distrito Federal',
        descricao: 'Seleções de propostas e programas federais para governos estaduais e o DF, com prazos, requisitos e documentos.',
        intro: `<p>Estados e o Distrito Federal participam de programas federais por transferências voluntárias, fundo a fundo e seleções específicas, geralmente pelo Transferegov.br. Também podem apresentar propostas que reúnem vários municípios.</p>`,
        dicas: ['Acompanhe a situação no CAUC.', 'Coordene com os municípios propostas regionais, quando a seleção permitir.']
    }
};

export const GUIAS = [
    {
        slug: 'como-encontrar-editais',
        titulo: 'Como encontrar o edital certo para o seu projeto',
        descricao: 'Passo a passo para descobrir editais de fomento compatíveis com o seu perfil, ler uma chamada pública e decidir se vale a pena concorrer.',
        atualizado: '2026-10-29',
        html: `
<p>Todos os anos, agências públicas, fundações estaduais, ministérios, empresas e organismos internacionais abrem centenas de chamadas para financiar pesquisa, inovação, cultura e projetos sociais. O difícil raramente é a falta de oportunidade. É encontrar a chamada certa a tempo e decidir rápido se vale a pena concorrer.</p>

<h2>1. Comece pelo seu perfil, não pelo valor</h2>
<p>O primeiro filtro de qualquer edital é <strong>quem pode submeter</strong>. Uma chamada milionária não serve se ela só aceita propostas institucionais e você é pesquisador individual, ou se exige empresa com sede em outro estado. Defina com clareza:</p>
<ul>
<li><strong>Tipo de proponente:</strong> pesquisador, universidade ou ICT, empresa, OSC, município ou estado.</li>
<li><strong>Onde você atua:</strong> muitas fundações estaduais financiam só instituições do próprio estado.</li>
<li><strong>Área e tema:</strong> as chamadas têm linhas temáticas; propostas fora delas são eliminadas.</li>
<li><strong>Tamanho do projeto:</strong> o valor por proposta precisa ser compatível com o que você pretende fazer.</li>
</ul>
<p>Na <a href="{raiz}#editais">plataforma</a>, o perfil de proponente faz esse filtro e mostra o percentual de compatibilidade de cada edital, explicando os motivos.</p>

<h2>2. Saiba onde as chamadas são publicadas</h2>
<ul>
<li><strong>Agências federais:</strong> CNPq (Plataforma Integrada Carlos Chagas), CAPES e Finep.</li>
<li><strong>Fundações estaduais de amparo à pesquisa (FAPs):</strong> FAPESP, FAPEMIG, FAPERJ, FAPES, FACEPE, FAPESB e outras. Cada uma tem seu sistema.</li>
<li><strong>Ministérios e secretarias:</strong> chamamentos para OSCs e seleções de programas para municípios, quase sempre no Transferegov.br.</li>
<li><strong>Fundos, institutos e empresas:</strong> editais próprios ou via leis de incentivo.</li>
<li><strong>Organismos internacionais e chamadas conjuntas</strong>, muitas vezes com uma FAP ou com o CNPq como parceiro no Brasil.</li>
</ul>
<p>O <a href="{raiz}editais/">painel de editais</a> reúne chamadas conferidas nessas fontes e é atualizado diariamente.</p>

<h2>3. Leia o edital na ordem certa</h2>
<p>Um edital tem dezenas de páginas. Leia primeiro o que pode eliminar você:</p>
<ol>
<li><strong>Cronograma:</strong> prazo final, horário limite e etapas (há pré-proposta? cadastro prévio?).</li>
<li><strong>Elegibilidade:</strong> requisitos do proponente, da instituição e da equipe.</li>
<li><strong>Itens financiáveis e vedados:</strong> o que o dinheiro pode e não pode pagar.</li>
<li><strong>Critérios de avaliação e pesos:</strong> mostram o que o avaliador vai pontuar.</li>
<li><strong>Documentos exigidos</strong> e o formato da proposta (limite de páginas, anexos, idioma).</li>
</ol>

<h2>4. Decida em 15 minutos: vale a pena concorrer?</h2>
<p>Responda com honestidade:</p>
<ul>
<li>Sou elegível em <strong>todos</strong> os requisitos, sem exceção?</li>
<li>Minha proposta se encaixa claramente em uma linha da chamada?</li>
<li>Consigo reunir os documentos e as assinaturas até o prazo?</li>
<li>O valor e a duração cobrem o que preciso entregar?</li>
<li>Tenho equipe e histórico para pontuar bem nos critérios de maior peso?</li>
</ul>
<p>Se a resposta for "não" a alguma das três primeiras, guarde a chamada para a próxima edição e foque em outra. Muitas chamadas se repetem anualmente.</p>

<h2>5. Organize-se desde o primeiro dia</h2>
<p>Ao decidir concorrer, coloque o prazo na agenda com lembretes e monte o checklist de documentos. Na plataforma, o botão <strong>Acompanhar</strong> organiza tudo em <a href="{raiz}#propostas">Minhas propostas</a>, com o próximo passo de cada edital.</p>
<p>Veja também: <a href="{raiz}guias/documentos-para-editais/">documentos para editais</a> e <a href="{raiz}guias/como-escrever-proposta-edital/">como escrever uma proposta competitiva</a>.</p>`
    },
    {
        slug: 'documentos-para-editais',
        titulo: 'Documentos para editais: checklist por tipo de proponente',
        descricao: 'Lista prática dos documentos mais pedidos em editais de fomento para pesquisadores, ICTs, empresas, OSCs e municípios, com dicas de validade e prazos.',
        atualizado: '2026-10-29',
        html: `
<p>A falta de um documento, ou um documento vencido, é uma das causas mais comuns de propostas eliminadas antes da análise de mérito. A boa notícia é que a maior parte do que os editais pedem se repete. Com uma pasta organizada, você ganha dias em cada nova chamada.</p>
<p class="nota">Esta é uma lista de referência. Cada edital define sua própria lista, e ela sempre prevalece.</p>

<h2>Para pesquisadores</h2>
<ul>
<li><strong>Currículo Lattes atualizado:</strong> muitas chamadas exigem atualização até a data limite de submissão.</li>
<li><strong>Projeto no modelo do edital</strong>, respeitando limite de páginas, seções e idioma.</li>
<li><strong>Comprovante de vínculo</strong> com a instituição executora e, se não houver vínculo empregatício, a concordância formal da instituição.</li>
<li><strong>Diploma de doutorado</strong>, quando exigido, e comprovação do tempo de titulação em chamadas para início de carreira.</li>
<li><strong>Aprovação ou protocolo no comitê de ética</strong> (CEP/CONEP) em pesquisas com seres humanos, e autorizações de biodiversidade ou de uso de animais, quando cabíveis.</li>
</ul>

<h2>Para universidades e ICTs (propostas institucionais)</h2>
<ul>
<li>Indicação formal do representante institucional, assinada pelo dirigente máximo.</li>
<li>Comprovação de Núcleo de Inovação Tecnológica (NIT) e política de inovação, quando a chamada exigir.</li>
<li>Cadastro aprovado da instituição no sistema do financiador, às vezes com prazo próprio, anterior ao da proposta.</li>
<li>Cartas de anuência de parceiros e de cada unidade envolvida.</li>
<li>Instrumento com a fundação de apoio, nas instituições públicas.</li>
</ul>

<h2>Para empresas e startups</h2>
<ul>
<li>Contrato social e última alteração, ou documento de constituição.</li>
<li><strong>Certidão Negativa de Débitos federais (conjunta RFB/PGFN)</strong>, válida por 180 dias.</li>
<li><strong>Certificado de Regularidade do FGTS (CRF)</strong>, válido por 30 dias. Emita perto do prazo.</li>
<li><strong>Certidão Negativa de Débitos Trabalhistas (CNDT)</strong>, válida por 180 dias.</li>
<li>Comprovação de porte (número de empregados ou faturamento) e de sede ou unidade de P&D no estado, quando exigido.</li>
<li>Plano de negócios ou proposta técnica e, se houver, comprovação de contrapartida.</li>
</ul>

<h2>Para OSCs, associações e cooperativas</h2>
<ul>
<li>Estatuto social com objetivos de relevância pública e social, e ata de eleição da diretoria vigente.</li>
<li><strong>Comprovação do tempo mínimo de existência</strong> com CNPJ ativo: no MROSC, em regra, 1 ano para parcerias com municípios, 2 com estados e o DF e 3 com a União, salvo redução por ato do ente; não se aplica a acordos de cooperação (Lei 13.019/2014, art. 33).</li>
<li>Comprovação de experiência prévia no objeto: relatórios, declarações de parceiros, fotos e publicações.</li>
<li>Certidões de regularidade fiscal, previdenciária, trabalhista e do FGTS.</li>
<li>Declarações exigidas pelo MROSC, por exemplo de que a organização e seus dirigentes não estão impedidos de celebrar parcerias.</li>
</ul>

<h2>Para municípios e estados</h2>
<ul>
<li>Proposta e plano de trabalho cadastrados no <strong>Transferegov.br</strong>.</li>
<li>Situação regular no <strong>CAUC</strong> (Serviço Auxiliar de Informações para Transferências Voluntárias).</li>
<li>Declaração de contrapartida, quando exigida, com previsão orçamentária.</li>
<li>Documentação do terreno e projetos de engenharia, em obras.</li>
</ul>

<h2>Comuns a quase todos</h2>
<ul>
<li><strong>Orçamento detalhado por rubrica</strong> (material de consumo, serviços de terceiros, diárias, passagens, equipamentos), respeitando os itens vedados.</li>
<li><strong>Cronograma físico-financeiro</strong>, ligando metas e entregas aos desembolsos.</li>
<li>Cotações de preços, quando o edital pedir ou para justificar valores.</li>
</ul>

<h2>Dicas que evitam eliminação</h2>
<ul>
<li>Crie uma pasta com versões em PDF de tudo o que se repete e anote a validade de cada certidão.</li>
<li>Emita as certidões de validade curta na semana do envio.</li>
<li>Respeite tamanho e formato dos arquivos: sistemas recusam PDFs grandes ou protegidos.</li>
<li>Não deixe para a última hora: sistemas de submissão ficam lentos perto do prazo.</li>
</ul>
<p>Na <a href="{raiz}#editais">plataforma</a>, cada edital traz um checklist já adaptado ao tipo de proponente, e você marca o que está pronto. Termos técnicos estão explicados no <a href="{raiz}glossario/">glossário</a>.</p>`
    },
    {
        slug: 'como-escrever-proposta-edital',
        titulo: 'Como escrever uma proposta competitiva para edital',
        descricao: 'Estrutura, critérios de avaliação, orçamento e erros comuns: como transformar uma boa ideia em uma proposta bem avaliada em editais de fomento.',
        atualizado: '2026-10-29',
        html: `
<p>A avaliação de propostas é comparativa: o avaliador lê muitas propostas boas em pouco tempo, com uma ficha de critérios e pesos ao lado. Uma proposta competitiva facilita esse trabalho e mostra, em cada seção, por que ela merece a nota máxima em cada critério.</p>

<h2>1. Escreva para os critérios de avaliação</h2>
<p>Antes de escrever uma linha, copie os critérios e os pesos do edital. Use-os como roteiro: cada critério deve ter uma resposta clara e fácil de achar. Se "impacto" vale 30% e "equipe" vale 10%, o espaço e a energia do texto devem refletir isso.</p>

<h2>2. Estrutura que funciona</h2>
<ol>
<li><strong>Resumo:</strong> problema, objetivo, método, resultado esperado e por que agora, em poucas linhas. Muitos avaliadores formam a primeira impressão aqui.</li>
<li><strong>Problema e justificativa:</strong> dados concretos, lacuna de conhecimento ou necessidade real, ligada aos objetivos da chamada.</li>
<li><strong>Objetivos:</strong> um objetivo geral e poucos objetivos específicos, mensuráveis e alcançáveis no prazo.</li>
<li><strong>Metodologia:</strong> como cada objetivo será alcançado, com etapas, responsáveis e riscos com plano B.</li>
<li><strong>Resultados e impacto:</strong> o que muda, para quem, como será medido (indicadores) e como os resultados chegam à sociedade.</li>
<li><strong>Equipe e infraestrutura:</strong> quem faz o quê, experiência relevante e o que já existe para executar.</li>
<li><strong>Orçamento e cronograma:</strong> coerentes com as atividades e justificados.</li>
</ol>

<h2>3. Orçamento: onde muitas propostas perdem pontos</h2>
<ul>
<li>Cada item deve estar ligado a uma atividade da metodologia.</li>
<li>Respeite as rubricas permitidas e os itens vedados; itens irregulares são cortados ou desclassificam a proposta.</li>
<li>Justifique valores relevantes com cotações ou referências.</li>
<li>Não infle: avaliadores reconhecem orçamentos superdimensionados.</li>
</ul>

<h2>4. Linguagem</h2>
<ul>
<li>Frases curtas, voz ativa e termos do próprio edital.</li>
<li>Use títulos que espelhem os critérios, para o avaliador achar as respostas.</li>
<li>Prefira números e fatos a adjetivos ("atender 1.200 estudantes" em vez de "grande impacto").</li>
<li>Peça a alguém de fora da área que leia o resumo: se não entender, reescreva.</li>
</ul>

<h2>5. Erros comuns que eliminam ou derrubam a nota</h2>
<ul>
<li>Proposta fora das linhas temáticas da chamada.</li>
<li>Requisito de elegibilidade não cumprido, como vínculo, titulação ou porte.</li>
<li>Documento faltando ou vencido.</li>
<li>Limite de páginas ou formato desrespeitado.</li>
<li>Objetivos vagos, sem indicadores de resultado.</li>
<li>Submissão nas últimas horas, com sistema instável.</li>
</ul>

<h2>6. Depois do envio</h2>
<p>Guarde o comprovante e o número de protocolo, acompanhe o cronograma de resultados e o prazo de recurso. Se a proposta não for aprovada, peça o parecer da avaliação: ele é o melhor insumo para a próxima chamada.</p>
<p>Organize prazos, documentos e etapas em <a href="{raiz}#propostas">Minhas propostas</a> e encontre chamadas compatíveis no <a href="{raiz}editais/">painel de editais</a>.</p>`
    },
    {
        slug: 'prestacao-de-contas',
        titulo: 'Prestação de contas de projetos financiados: guia prático',
        descricao: 'O que é exigido na prestação de contas de projetos com recursos públicos, como se organizar desde o primeiro dia e os erros que geram ressalvas.',
        atualizado: '2026-10-29',
        html: `
<p>Receber o recurso é metade do caminho. A prestação de contas comprova que o dinheiro foi aplicado conforme o plano aprovado e que as metas foram cumpridas. Problemas nessa etapa podem gerar devolução de recursos e impedir novas parcerias, então organize-se desde o primeiro dia.</p>

<h2>O que normalmente é exigido</h2>
<ul>
<li><strong>Relatório de execução do objeto (técnico):</strong> atividades realizadas, metas atingidas, resultados e justificativa para desvios.</li>
<li><strong>Relatório de execução financeira:</strong> receitas e despesas por rubrica, com conciliação bancária.</li>
<li><strong>Comprovantes:</strong> notas fiscais, recibos, extratos da conta específica do projeto, contratos e comprovantes de pagamento.</li>
<li><strong>Evidências de entrega:</strong> listas de presença, fotos, publicações, produtos e indicadores.</li>
</ul>
<p>As regras variam conforme o instrumento:</p>
<ul>
<li><strong>Termos de outorga de agências de pesquisa:</strong> no âmbito do Marco Legal de CT&I, o Decreto nº 9.283/2018 prevê procedimentos simplificados com foco em resultados.</li>
<li><strong>Termos de fomento e colaboração com OSCs:</strong> regidos pelo MROSC (Lei nº 13.019/2014).</li>
<li><strong>Convênios e contratos de repasse da União:</strong> regidos pelo Decreto nº 11.531/2023 (com a Lei nº 14.133/2021 aplicada no que couber, art. 184) e operados no Transferegov.br.</li>
</ul>
<p>Siga sempre o termo assinado e as normas do financiador.</p>

<h2>Organize-se desde o primeiro dia</h2>
<ul>
<li>Use somente a <strong>conta específica</strong> do projeto e não misture recursos.</li>
<li>Guarde cada comprovante no dia em que a despesa acontece, numa pasta por rubrica.</li>
<li>Registre evidências das atividades enquanto elas acontecem: depois é tarde.</li>
<li>Acompanhe a execução financeira contra o cronograma todo mês.</li>
<li>Peça autorização ao financiador <strong>antes</strong> de remanejar valores entre rubricas ou mudar o plano.</li>
</ul>

<h2>Erros que geram ressalvas ou devolução</h2>
<ul>
<li>Despesa fora do período de vigência ou em item vedado.</li>
<li>Pagamento sem nota fiscal ou com documento em nome de terceiros.</li>
<li>Saque em espécie ou pagamento sem rastreabilidade bancária, quando vedado.</li>
<li>Metas não cumpridas sem justificativa documentada.</li>
<li>Prestação enviada fora do prazo.</li>
</ul>

<h2>Prazos e guarda de documentos</h2>
<p>Prestações parciais costumam ser periódicas, e a final tem prazo contado a partir do fim da vigência. Os documentos precisam ser guardados por anos: no MROSC, por 10 anos contados do dia útil seguinte ao da prestação de contas (Lei 13.019/2014, art. 68, parágrafo único). Confira o prazo do seu instrumento.</p>
<p>Na plataforma, a área de <a href="{raiz}#projetos">Projetos</a> mostra o fluxo de prestação de contas em etapas (preencher, revisar e protocolo), com rascunho automático. Ela é uma <strong>demonstração</strong>: o envio oficial é feito no sistema exigido pelo financiador.</p>`
    }
];
