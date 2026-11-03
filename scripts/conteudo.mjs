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
        descricao: 'Auxílios à pesquisa, bolsas de produtividade e cooperação internacional com inscrições abertas: valores, prazos, critérios e documentos, de fontes oficiais (curados por pessoa ou lidos automaticamente, sempre identificados).',
        intro: `<p>Agências como CNPq, CAPES, FINEP e as fundações estaduais de amparo à pesquisa (<a href="{raiz}glossario/#fap" data-evento="glossario-abrir">FAPs</a>) abrem chamadas ao longo de todo o ano. Elas financiam projetos de pesquisa, bolsas, eventos científicos, cooperação internacional e infraestrutura. Em geral, quem submete é o pesquisador com doutorado e vínculo formal com uma universidade ou instituto de pesquisa (<a href="{raiz}glossario/#ict" data-evento="glossario-abrir">ICT</a>). Muitas FAPs exigem que a instituição fique no próprio estado.</p>
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
        intro: `<p>Organizações da sociedade civil acessam recursos públicos principalmente por <strong>chamamentos públicos</strong> regidos pelo Marco Regulatório das Organizações da Sociedade Civil (<a href="{raiz}glossario/#mrosc" data-evento="glossario-abrir">MROSC</a>, Lei nº 13.019/2014), além de editais de fundações, institutos e empresas.</p>
<p>O MROSC exige, entre outros pontos, um tempo mínimo de existência com <a href="{raiz}glossario/#cnpj" data-evento="glossario-abrir">CNPJ</a> (Cadastro Nacional da Pessoa Jurídica) ativo: em regra, 1 ano para parcerias com municípios, 2 com estados e o Distrito Federal e 3 com a União, prazo que o ente pode reduzir por ato específico quando nenhuma organização o atingir (Lei 13.019/2014, art. 33, V, “a”). Esse requisito não se aplica a acordos de cooperação. Também exige experiência prévia no objeto e capacidade técnica e operacional. O estatuto precisa prever objetivos de relevância pública e social.</p>`,
        dicas: ['Mantenha atas, estatuto e certidões em dia: são cobrados em quase todos os chamamentos.', 'Documente a experiência prévia com fotos, relatórios, declarações de parceiros e matérias.', 'Leia o plano de trabalho exigido: metas, indicadores e orçamento precisam conversar.']
    },
    municipio: {
        slug: 'municipios-e-prefeituras',
        titulo: 'Editais e programas abertos para municípios',
        h1: 'Editais e programas federais abertos para municípios e prefeituras',
        descricao: 'Programas e seleções de propostas para prefeituras: transferências voluntárias, fundo a fundo e emendas, com prazos, requisitos e documentos.',
        intro: `<p>Municípios captam recursos federais por transferências voluntárias (convênios e contratos de repasse), transferências fundo a fundo e seleções de programas, quase sempre com propostas cadastradas no <strong>Transferegov.br</strong>.</p>
<p>Antes de qualquer seleção, mantenha o município regular no <strong><a href="{raiz}glossario/#cauc" data-evento="glossario-abrir">CAUC</a></strong> (Serviço Auxiliar de Informações para Transferências Voluntárias), o cadastro do Tesouro Nacional que verifica as exigências fiscais e legais para receber transferências voluntárias. Também deixe pronto um banco de projetos (terrenos regularizados, projetos de engenharia, estudos): muitas seleções abrem com prazos curtos.</p>`,
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
<li><strong>Quem vai pedir o recurso:</strong> pesquisador, universidade ou ICT, empresa, OSC, município ou estado.</li>
<li><strong>Onde você atua:</strong> muitas fundações estaduais financiam só instituições do próprio estado.</li>
<li><strong>Área e tema:</strong> as chamadas têm linhas temáticas; propostas fora delas são eliminadas.</li>
<li><strong>Tamanho do projeto:</strong> o valor por proposta precisa ser compatível com o que você pretende fazer.</li>
</ul>
<p>Na <a href="{raiz}#editais">plataforma</a>, o seu perfil faz esse filtro e mostra o percentual de compatibilidade de cada edital, explicando os motivos.</p>

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
<li><strong>Quem pode participar:</strong> requisitos de quem vai pedir o recurso, da instituição e da equipe.</li>
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
<p>Na <a href="{raiz}#editais">plataforma</a>, cada edital traz um checklist já adaptado a quem vai pedir o recurso, e você marca o que está pronto. Termos técnicos estão explicados no <a href="{raiz}glossario/">glossário</a>.</p>`
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
    },
    {
        slug: 'leis-de-incentivo-fiscal',
        titulo: 'Leis de incentivo fiscal: como captar',
        descricao: 'Lei Rouanet, incentivo ao esporte e fundos da infância e do idoso: quem pode doar e deduzir, limites, base legal e o calendário para captar.',
        atualizado: '2026-10-31',
        html: `
<p>As leis de incentivo permitem que pessoas e empresas destinem parte do imposto de renda que já pagariam a projetos culturais, esportivos e sociais. Para quem capta, isso muda a conversa: o apoiador não tira dinheiro do próprio bolso além do imposto devido, desde que respeite os limites e as condições de cada lei. O trabalho de quem capta tem duas partes: ter o projeto aprovado (ou a organização apta a receber) e convencer quem pode deduzir.</p>
<p class="nota">Resumo informativo, conferido em fontes oficiais em 31/10/2026. As regras mudam: confirme sempre a norma vigente e peça a orientação de um contador antes de prometer dedução a um apoiador.</p>

<h2>1. Como funciona, em três passos</h2>
<ol>
<li><strong>Aprovação:</strong> o projeto é aprovado pelo órgão responsável (Ministério da Cultura, Ministério do Esporte) ou, no caso dos fundos da infância e do idoso, a organização participa da seleção feita pelo conselho de direitos que controla o fundo.</li>
<li><strong>Captação:</strong> pessoas físicas e empresas fazem a doação ou o patrocínio e recebem o comprovante para a dedução.</li>
<li><strong>Execução e prestação de contas:</strong> o recurso fica em conta específica e é usado conforme o plano aprovado.</li>
</ol>

<h2>2. Quem pode doar e deduzir</h2>
<ul>
<li><strong>Pessoas físicas</strong> que fazem a declaração do imposto de renda no <strong>modelo completo</strong>. Quem usa o desconto simplificado não aproveita essas deduções. A destinação feita na própria declaração só existe no modelo completo, entregue no prazo (Receita Federal; Lei 12.213/2010, art. 2º-A, § 2º, II, incluído pela Lei 13.797/2019).</li>
<li><strong>Empresas tributadas pelo lucro real</strong>. Em regra, empresas do Simples Nacional e do lucro presumido não usam esses mecanismos.</li>
</ul>
<p>Os limites são calculados sobre o <strong>imposto devido</strong>, não sobre a renda. Exemplo: quem tem R$ 10.000 de imposto devido e limite de 6% pode destinar até R$ 600.</p>

<h2>3. Os quatro mecanismos mais usados</h2>

<h3>Lei Rouanet (cultura)</h3>
<p>Base legal: <strong>Lei 8.313/1991</strong>, que instituiu o Programa Nacional de Apoio à Cultura (Pronac). A proposta é cadastrada no sistema Salic; depois da admissibilidade, vira projeto com número Pronac, que é usado na captação e na prestação de contas. Podem propor pessoas físicas com atuação cultural, MEIs, empresas, associações, fundações e cooperativas.</p>
<ul>
<li><strong>Limites:</strong> pessoas físicas, até 6% do imposto devido; empresas no lucro real, até 4% do imposto devido.</li>
<li><strong>Artigo 18 x artigo 26:</strong> nos projetos enquadrados no art. 18, o apoio pode ser deduzido integralmente, dentro dos limites; no art. 26, só uma parte é deduzida do imposto. O enquadramento é definido na análise do projeto.</li>
<li>O dinheiro captado entra numa conta exclusiva do projeto, aberta a pedido do Ministério da Cultura.</li>
</ul>

<h3>Lei de Incentivo ao Esporte</h3>
<p>Base legal: a <strong>Lei 11.438/2006</strong> criou o incentivo e, com as mudanças da Lei 14.439/2022, fixou os limites atuais. Em novembro de 2025, a <strong>Lei Complementar 222/2025</strong> tornou o incentivo permanente e substituiu a lei de 2006. Os projetos esportivos e paraesportivos precisam ser aprovados pelo Ministério do Esporte antes da captação.</p>
<ul>
<li><strong>Pessoas físicas:</strong> até 7% do imposto devido.</li>
<li><strong>Empresas no lucro real:</strong> até 2% do imposto devido, ou até 4% em projetos de inclusão social pelo esporte. Segundo a Câmara dos Deputados, a Lei Complementar 222/2025 eleva o limite geral para 3% a partir de 2028.</li>
</ul>

<h3>Fundos dos Direitos da Criança e do Adolescente (FIA, FDCA, FMDCA)</h3>
<p>Base legal: <strong>Estatuto da Criança e do Adolescente (Lei 8.069/1990), arts. 260 e 260-A</strong>. Os fundos são nacional, estaduais, distrital e municipais, e cada um é controlado pelo conselho de direitos correspondente (no município, o CMDCA). As organizações acessam o dinheiro participando das seleções e dos editais desses conselhos.</p>
<ul>
<li><strong>Pessoas físicas:</strong> doações ao longo do ano, dentro do limite de 6% do imposto devido; ou destinação direta na declaração, de até 3% do imposto devido.</li>
<li><strong>Empresas no lucro real:</strong> até 1% do imposto devido, somando as doações aos fundos da criança e do adolescente e aos fundos do idoso (Lei 12.213/2010, art. 3º).</li>
</ul>

<h3>Fundos do Idoso (Fundos dos Direitos da Pessoa Idosa)</h3>
<p>Base legal: <strong>Lei 12.213/2010</strong>, que criou o Fundo Nacional do Idoso e autorizou a dedução das doações aos fundos nacional, estaduais e municipais. A Lei 13.797/2019 incluiu o art. 2º-A, que permite à pessoa física doar direto na declaração.</p>
<ul>
<li><strong>Pessoas físicas:</strong> destinação na declaração de até 3% do imposto devido, dentro do limite total de 6%, observado o art. 22 da Lei 9.532/1997.</li>
<li><strong>Empresas no lucro real:</strong> até 1% do imposto devido, em conjunto com os fundos da criança e do adolescente.</li>
</ul>

<h3>O limite de 6% da pessoa física</h3>
<p>Para a pessoa física, a soma das deduções de doações aos fundos da criança e do adolescente e do idoso, à cultura e ao audiovisual fica limitada a 6% do imposto devido (Lei 9.532/1997, art. 22). Na declaração, a destinação direta é de até 3% para cada tipo de fundo. O incentivo ao esporte tem limite próprio, de 7%: confirme com quem faz a sua declaração como os limites se combinam no seu caso.</p>

<h2>4. Calendário de destinação</h2>
<ul>
<li><strong>Até 31 de dezembro:</strong> doações e patrocínios feitos durante o ano (Rouanet, esporte, fundos da infância e do idoso) são deduzidos na declaração entregue no ano seguinte. Por isso as campanhas de captação com pessoas físicas se concentram em novembro e dezembro.</li>
<li><strong>Empresas:</strong> a dedução é feita no período de apuração do imposto. A doação precisa acontecer dentro do período em que a empresa quer deduzir.</li>
<li><strong>Na declaração do imposto de renda (só pessoa física, só fundos da infância e do idoso):</strong> durante o prazo de entrega da declaração, no modelo completo, até 3% para cada tipo de fundo. A declaração gera um DARF para cada destinação, que precisa ser pago até o vencimento da quota única ou da primeira quota do imposto; sem o pagamento no prazo, a dedução é perdida (Lei 12.213/2010, art. 2º-A, §§ 3º e 4º). O valor destinado é abatido do imposto a pagar ou somado à restituição.</li>
</ul>

<h2>5. Dicas para quem capta</h2>
<ul>
<li>Só comece a captar depois da aprovação do projeto ou da seleção da organização: em regra, o apoio feito antes disso não gera dedução.</li>
<li>Monte uma lista de potenciais apoiadores: empresas do lucro real com imposto a pagar e pessoas físicas que fazem a declaração completa.</li>
<li>Mostre a conta para o apoiador: quanto ele pode destinar (o limite sobre o imposto devido) e quanto deixa de pagar.</li>
<li>Planeje duas janelas: fim de ano para doações e patrocínios, e o período da declaração para os fundos da infância e do idoso.</li>
<li>Emita o comprovante exigido por cada mecanismo e use sempre a conta específica do projeto ou do fundo.</li>
<li>Acompanhe os editais dos conselhos municipais e estaduais: é por eles que o dinheiro dos fundos chega às organizações.</li>
</ul>

<h2>Fontes oficiais</h2>
<ul>
<li><a href="https://www.planalto.gov.br/ccivil_03/leis/l8313cons.htm" target="_blank" rel="noopener">Lei 8.313/1991 (Lei Rouanet)</a> e <a href="https://www.gov.br/iphan/pt-br/assuntos/patrimonio-cultural-na-lei-rouanet/portal-do-proponente-de-patrimonio-da-lei-rouanet/bloco-1-comecando-do-zero" target="_blank" rel="noopener">guia do proponente da Lei Rouanet (Iphan)</a></li>
<li><a href="https://www2.camara.leg.br/legin/fed/lei/2022/lei-14439-24-agosto-2022-793147-publicacaooriginal-165977-pl.html" target="_blank" rel="noopener">Lei 14.439/2022 (limites do incentivo ao esporte)</a> e <a href="https://www.camara.leg.br/noticias/1227581-lei-de-incentivo-ao-esporte-se-torna-politica-permanente/" target="_blank" rel="noopener">Lei Complementar 222/2025 (Agência Câmara)</a></li>
<li><a href="https://www.planalto.gov.br/ccivil_03/leis/l8069.htm" target="_blank" rel="noopener">Estatuto da Criança e do Adolescente (Lei 8.069/1990), arts. 260 e 260-A</a></li>
<li><a href="https://www2.camara.leg.br/legin/fed/lei/2010/lei-12213-20-janeiro-2010-600950-publicacaooriginal-122733-pl.html" target="_blank" rel="noopener">Lei 12.213/2010 (Fundo Nacional do Idoso)</a> e <a href="https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/lei/L13797.htm" target="_blank" rel="noopener">Lei 13.797/2019</a></li>
<li><a href="https://www.planalto.gov.br/ccivil_03/leis/l9532.htm" target="_blank" rel="noopener">Lei 9.532/1997, art. 22 (limite de 6%)</a></li>
<li><a href="https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/passo-a-passo/destinacao-de-imposto-de-renda.pdf/@@download/file/Destina%C3%A7%C3%A3o%20de%20Imposto%20de%20Renda%20v2.pdf" target="_blank" rel="noopener">Receita Federal: passo a passo da destinação na declaração</a></li>
</ul>
<p>Procure editais de cultura e de desenvolvimento social no <a href="{raiz}editais/">painel de editais</a> e veja também <a href="{raiz}guias/como-escrever-proposta-edital/">como escrever uma proposta competitiva</a>.</p>`
    }
];

/**
 * Esquema público do editais.json (página /dados/). Campos marcados como "contrato" são opcionais
 * e podem não existir em todos os editais.
 */
export const ESQUEMA_CAMPOS = [
    ['id', 'número', 'sim', 'Identificador numérico estável do edital.'],
    ['numero', 'texto', 'não', 'Identificação oficial da chamada, ex.: "Chamada CNPq nº 33/2026".'],
    ['titulo', 'texto', 'sim', 'Título da chamada.'],
    ['instituicao', 'texto', 'sim', 'Nome ou sigla de quem financia.'],
    ['agencia', 'texto', 'não', 'Código da instituição cadastrada (ex.: cnpq, fapesp); define a página e os feeds da instituição.'],
    ['procedencia', 'texto', 'não', '"nacional" ou "internacional".'],
    ['tema', 'texto', 'não', 'Área temática (ex.: Tecnologia, Saúde, Educação, Meio Ambiente, Cultura).'],
    ['tags', 'lista de textos', 'não', 'Palavras-chave da chamada.'],
    ['modalidade', 'texto', 'não', 'Tipo de apoio: auxílio à pesquisa, subvenção, bolsa, termo de fomento, prêmio etc.'],
    ['publico', 'lista de textos', 'sim', 'Quem pode submeter: pesquisador, ict, empresa, osc, municipio, estado.'],
    ['abrangencia', 'texto', 'não', '"Nacional", uma região, uma UF ou "Não informada" (programas do Transferegov cuja fonte não diz onde valem).'],
    ['ufs', 'lista de textos', 'não', 'Siglas das UFs atendidas, quando a abrangência é um conjunto específico.'],
    ['ufCadastro', 'texto', 'não (contrato)', 'Só no Transferegov, com abrangência "Não informada": UF que aparece no cadastro do programa. Não limita quem pode propor; serve de pista.'],
    ['abrangenciaNota', 'texto', 'não (contrato)', 'Explicação da abrangência quando ela não é confirmada pela fonte.'],
    ['moeda', 'texto', 'não', 'BRL (padrão), USD ou EUR.'],
    ['valorMax', 'número ou null', 'sim, ou valorNota', 'Valor máximo por proposta; null quando não há teto.'],
    ['valorTotal', 'número ou null', 'não', 'Valor total reservado para a chamada.'],
    ['valorNota', 'texto', 'não', 'Faixas, linhas e o que é financiado.'],
    ['tipoValor', 'texto', 'não (contrato)', 'Como ler o valor: por-proposta, total, faixa, bolsa ou nao-informado.'],
    ['fonteRecurso', 'texto', 'não (contrato)', 'Origem do dinheiro: publico, privado, incentivo-fiscal, internacional ou misto.'],
    ['contrapartida', 'texto', 'não', 'Contrapartida exigida, se houver.'],
    ['publicadoEm', 'data', 'não', 'Data de publicação do edital (AAAA-MM-DD).'],
    ['abertura', 'data', 'sim', 'Início das inscrições (AAAA-MM-DD).'],
    ['encerramento', 'data', 'sim', 'Prazo final das inscrições ou da primeira etapa (AAAA-MM-DD).'],
    ['etapaPrazo', 'texto', 'não', 'Nome da etapa que encerra em "encerramento", ex.: "Pré-proposta".'],
    ['propostaCompleta', 'data', 'não', 'Prazo da proposta completa, quando há etapa anterior.'],
    ['preProposta', 'booleano', 'não', 'true quando há pré-proposta ou consulta de elegibilidade.'],
    ['fluxoContinuo', 'booleano', 'não (contrato)', 'true quando a chamada recebe propostas continuamente.'],
    ['resultado', 'data', 'não', 'Previsão de divulgação do resultado.'],
    ['proximaEdicao', 'data ou texto', 'não (contrato)', 'Depois do encerramento: data prevista (AAAA-MM-DD) ou texto curto sobre a próxima edição, ex.: "costuma abrir em março". Aparece na página do edital encerrado.'],
    ['prazoNota', 'texto', 'não', 'Horário limite, etapas seguintes, cadastro prévio exigido.'],
    ['elegibilidade', 'lista de objetos', 'não (contrato)', 'Perguntas de elegibilidade: {"pergunta", "esperado" (true/false), "eliminatoria" (true/false)}.'],
    ['resumo', 'texto', 'não', 'Objetivo da chamada em linguagem simples.'],
    ['link', 'URL', 'sim, se agencia não for cadastrada', 'Página oficial do edital.'],
    ['fonte', 'URL', 'recomendado', 'Onde a informação foi conferida.'],
    ['verificadoEm', 'data', 'recomendado', 'Quando a informação foi conferida.'],
    ['criterios', 'lista de objetos', 'não', 'Critérios de avaliação: {"nome", "peso"} (peso em %, ou null).'],
    ['docsExtras', 'lista de textos', 'não', 'Documentos específicos da chamada, além dos usuais de cada perfil.'],
    ['patrocinado', 'booleano', 'não (contrato)', 'true quando a chamada tem destaque patrocinado (sinalizado; não altera busca, filtros nem ordem).'],
    ['patrocinador', 'texto', 'não (contrato)', 'Nome de quem patrocina o destaque (até 80 caracteres), exibido no selo "Patrocinado por".'],
    ['patrocinioInicio', 'data', 'não (contrato)', 'Início do destaque patrocinado.'],
    ['patrocinioAte', 'data', 'não (contrato)', 'Fim do destaque patrocinado.'],
    ['patrocinioVagas', 'lista de textos', 'não (contrato)', 'Vagas reservadas do destaque: "inicio", "publico", "area", "semana" (padrão ["inicio"]).']
];

/**
 * Glossário em linguagem simples (Lei 15.263/2025; ISO 24495-1): completa e substitui, nas páginas
 * estáticas, as definições do GLOSSARIO do index.html com o mesmo termo (a âncora é o termo sem acento,
 * ex.: glossario/#cauc, glossario/#termo-de-fomento).
 */
export const GLOSSARIO_SIMPLES = [
    { termo: 'Edital / chamada pública', def: 'Documento em que quem financia anuncia que vai escolher projetos: diz o objetivo, quem pode participar, quanto dinheiro há, os prazos e como as propostas serão avaliadas.' },
    { termo: 'Chamamento público', def: 'Nome da chamada pública quando o governo escolhe organizações da sociedade civil (OSCs) para uma parceria, pelas regras do MROSC (Lei 13.019/2014).' },
    { termo: 'ICT', def: 'Instituição Científica, Tecnológica e de Inovação: universidade, instituto ou centro de pesquisa, público ou privado sem fins lucrativos, que tem a pesquisa ou o desenvolvimento de tecnologia entre suas missões (Lei 10.973/2004, art. 2º, V).' },
    { termo: 'FAP', def: 'Fundação de Amparo à Pesquisa: agência de um estado que financia pesquisa e inovação, como a FAPESP (São Paulo) e a FAPES (Espírito Santo). Em geral, só atende quem trabalha ou tem sede no próprio estado.' },
    { termo: 'CNPJ', def: 'Cadastro Nacional da Pessoa Jurídica: o número de registro de empresas, associações e outras organizações na Receita Federal. Muitos editais pedem um tempo mínimo de CNPJ ativo.' },
    { termo: 'MROSC', def: 'Marco Regulatório das Organizações da Sociedade Civil (Lei 13.019/2014): a lei que diz como o governo faz parcerias com ONGs, associações, fundações privadas e algumas cooperativas, da seleção à prestação de contas.' },
    { termo: 'CAUC', def: 'Serviço Auxiliar de Informações para Transferências Voluntárias, do Tesouro Nacional. Mostra se uma prefeitura, um estado ou o Distrito Federal está em dia com as exigências para receber dinheiro da União por convênio ou contrato de repasse. Vale só para esses governos: ONGs e associações não são consultadas no CAUC.' },
    { termo: 'Contrapartida', def: 'Parte do custo do projeto que você paga: em dinheiro ou em bens e serviços (por exemplo, uso de sala, equipe ou equipamentos). Cada edital diz se é exigida e quanto. Nas parcerias com OSCs pelo MROSC, não se exige contrapartida em dinheiro; pode haver em bens e serviços (Lei 13.019/2014, art. 35, § 1º).' },
    { termo: 'Termo de fomento', def: 'Parceria com o governo em que a ideia do projeto é da ONG (OSC): a organização propõe e o governo apoia com dinheiro. Previsto no MROSC (Lei 13.019/2014, art. 2º, VIII).' },
    { termo: 'Termo de colaboração', def: 'Parceria com o governo em que a ideia do projeto é do governo: ele define o que quer e escolhe uma ONG (OSC) para executar, com repasse de dinheiro. Previsto no MROSC (Lei 13.019/2014, art. 2º, VII).' },
    { termo: 'Convênio', def: 'Acordo para fazer juntos um projeto de interesse comum, com repasse de dinheiro, em geral entre órgãos públicos (por exemplo, a União e uma prefeitura). Com ONGs, só em casos específicos previstos em lei, como na saúde.' },
    { termo: 'Contrato de repasse', def: 'Parecido com o convênio, mas o dinheiro da União passa por um banco público (em geral a Caixa), que acompanha a execução. Muito usado em obras de prefeituras e estados.' },
    { termo: 'Fluxo contínuo', def: 'A chamada recebe propostas a qualquer momento enquanto estiver aberta, sem uma data única de entrega. As propostas são avaliadas aos poucos, por ordem de chegada ou em rodadas.' },
    { termo: 'Pré-proposta', def: 'Primeira etapa, mais curta, de algumas chamadas: você manda um resumo do projeto e só quem for aprovado é convidado a enviar a proposta completa. O prazo da pré-proposta costuma vir bem antes do prazo final.' },
    { termo: 'Proponente', def: 'Quem vai pedir o recurso: a pessoa ou organização que apresenta a proposta e, se ela for aprovada, assina o termo e presta contas.' }
];

// Nomes simples de quem pode pedir (bloco "Posso concorrer?" e mensagem de WhatsApp)
export const PUBLICO_SIMPLES = {
    pesquisador: 'pesquisador(a)',
    ict: 'universidade ou instituto de pesquisa',
    empresa: 'empresa ou startup',
    osc: 'ONG ou associação',
    municipio: 'prefeitura',
    estado: 'governo estadual ou do DF'
};

// Siglas explicadas na primeira vez em que aparecem numa página: [sigla, nome completo, âncora no glossário]
export const SIGLAS_PAGINA = [
    ['MROSC', 'Marco Regulatório das Organizações da Sociedade Civil', 'mrosc'],
    ['CAUC', 'Serviço Auxiliar de Informações para Transferências Voluntárias', 'cauc'],
    ['FAPs', 'Fundações de Amparo à Pesquisa', 'fap'],
    ['FAP', 'Fundação de Amparo à Pesquisa', 'fap'],
    ['ICTs', 'Instituições Científicas, Tecnológicas e de Inovação', 'ict'],
    ['ICT', 'Instituição Científica, Tecnológica e de Inovação', 'ict'],
    ['CNPJ', 'Cadastro Nacional da Pessoa Jurídica', 'cnpj'],
    ['LDO', 'Lei de Diretrizes Orçamentárias', '']
];
