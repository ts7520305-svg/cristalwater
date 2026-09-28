# Contratos de manutenção: assinatura na área de cliente

Data: 28/09/2026, Europe/Lisbon. Estado: requisitos confirmados e proposta de implementação; funcionalidade de assinatura ainda não implementada. Esta especificação não é uma minuta para assinatura nem uma aprovação jurídica.

## Decisões do utilizador

- Acrescentar contratos para a manutenção das piscinas e as respetivas revisões técnicas cobradas.
- Duração anual com renovação automática por períodos anuais.
- A comunicação de não renovação tem de ocorrer pelo menos **30 dias antes do fim do contrato**. O utilizador esclareceu que este prazo não significa poder sair a qualquer momento com um mês de aviso.
- O cliente comunica a não renovação **por e-mail para o endereço indicado no contrato**. O utilizador referiu «email x» como endereço ainda por definir; não criar nem presumir uma caixa de correio. O portal apresenta esse endereço e as instruções, sem exigir um segundo pedido no portal.
- O cliente assina digitalmente **uma vez, na sua área de cliente**. A assinatura inicial abrange a renovação expressamente acordada. Não pedir assinatura anual apenas pela passagem do tempo.
- A eventual compensação por saída antecipada tem de ser legal. Não foi escolhido qualquer montante ou percentagem.

## Fluxo a implementar

1. O administrador prepara uma versão do contrato para o cliente e para a piscina ou conjunto de piscinas identificado. Inclui datas, visitas por época, produtos abrangidos, revisões, preços, pagamentos, renovação e cessação.
2. O cliente autenticado consulta o documento integral e pode descarregá-lo antes de assinar. Mostram-se de forma clara a duração, a renovação anual, a data limite para não renovar e o endereço de e-mail destinado a essa comunicação.
3. O cliente manifesta expressamente a intenção de assinar aquela versão. O método de assinatura deve comprovar identidade, intenção e ligação ao documento. Não inferir aceitação pelo login, por abrir o PDF, pelo silêncio inicial ou pelo pagamento.
4. Após confirmação da assinatura, conservar os bytes do documento assinado, identificação da versão, data, signatário e comprovativo do método utilizado. Disponibilizar uma cópia duradoura ao cliente. A assinatura não deve depender apenas de um registo local no navegador.
5. Nas renovações nas mesmas condições, manter a prova inicial e registar o novo período; não reaplicar uma imagem de assinatura a um documento diferente. Alterações materiais exigem nova versão e a aceitação adequada; uma atualização já prevista por uma fórmula acordada deve conservar a ligação à regra original.
6. O cliente envia a comunicação de não renovação para o e-mail indicado no contrato. O administrador regista a mensagem recebida e o período afetado. O portal disponibiliza o endereço e a consulta do estado, sem impor a submissão de outro formulário ou uma nova assinatura. Guardar a mensagem original e as datas disponíveis de envio e receção; a data em que o administrador a lê ou regista não substitui essas datas.

## Não renovação por e-mail

- Endereço configurável pela Cristal Water, explicitado na versão assinada e visível na área de cliente. O endereço real ainda não foi fornecido. Não permitir a publicação de um contrato com «email x» ou outro marcador por preencher.
- Solicitar informação suficiente para identificar o cliente e o contrato/piscina; esclarecer ambiguidades sem inventar um pedido para outro contrato.
- Conservar remetente, destinatário, conteúdo original, anexos relevantes, datas disponíveis e comprovativo. Não considerar um rascunho de e-mail ou a abertura de um link de correio como mensagem enviada ou recebida.
- Prever confirmação de receção com o contrato abrangido e a data de término. A confirmação informa o cliente; não é uma autorização discricionária da empresa para aceitar uma comunicação válida e atempada. Datas/entregas em disputa exigem revisão, sem inventar prova de receção.
- A não renovação atempada impede a renovação seguinte. A prestação mantém-se até ao fim do período em curso e não gera uma penalização de saída antecipada apenas por o cliente não querer renovar.
- Não confundir a data do e-mail com o termo do serviço. Manter separadas as comunicações de não renovação, saída antecipada e exercício de direitos legais.
- A caixa de correio, a leitura automática de e-mails e os envios de confirmação ainda não estão configurados. O registo manual deve ser possível sem depender de uma integração futura.

O lembrete de renovação a 60 dias é uma proposta de funcionamento apresentada pelo assistente, não um prazo legal nem uma escolha separada de fornecedor/canal confirmada pelo utilizador. Deve chegar antes do limite de 30 dias e não substituir a data contratual.

## Assinatura e prova

Uma assinatura eletrónica qualificada tem equivalência legal à assinatura manuscrita; outros meios eletrónicos podem ter valor probatório, apreciado nos termos gerais. Login, nome escrito, traço no ecrã ou código de confirmação não são, por si, prova de uma assinatura qualificada. Fonte: Decreto-Lei 12/2021, artigo 3.º [1].

O fornecedor/método ainda não foi escolhido. Preparar integração com um serviço de assinatura e guardar o tipo efetivamente validado; nunca marcar um contrato como assinado apenas por um callback não autenticado ou pelo envio de um ficheiro. Para qualificada, verificar documento, identidade, certificado e evidência de validação. Não contratar serviços pagos nem contactar clientes nesta fase. Uma assinatura não sana cláusulas abusivas.

## Regras de negócio a preservar

- Separar não renovação, saída antecipada e resolução por incumprimento ou exercício de direitos legais. Compensações ficam sujeitas a revisão e não nascem automaticamente de todas as mensalidades futuras [2][3].
- Rever a minuta conforme o tipo de cliente e o modo de contratação, incluindo livre resolução e exceções aplicáveis à manutenção solicitada no domicílio [4].
- Revisões cobradas devem corresponder ao serviço e preço acordados; peças e trabalhos adicionais seguem a autorização aplicável. Não duplicar valores já incluídos na mensalidade.
- A app regista cobranças e a referência da fatura externa; preservar o fluxo de faturação externa já pedido pelo utilizador.
- Não converter clientes existentes em novos contratos anuais por migração silenciosa. A primeira aceitação tem de ser expressa; preservar os históricos e os serviços atuais.

## Ponto de integração e aceitação

Inspeção do código em `cac9549abb4ae3f684e614478760737d82d941d0`: `Client.contractActive`/`contractActivatedAt` e `frontend/cw-contract-activation.js` representam ativação administrativa com eventual recebimento. Não representam assinatura do cliente. Não reutilizar essa flag como prova de contrato assinado.

A implementação deve demonstrar: acesso apenas ao próprio contrato; documento conservado apesar de alterações posteriores; repetição do pedido sem assinaturas/cobranças duplicadas; recusa de versões desatualizadas e confirmações falsas; download do original assinado; renovações sem nova assinatura nas condições acordadas; não renovação no limite de 30 dias com datas Europe/Lisbon, anos bissextos e mudanças de hora; revisão concluída cobrada uma única vez. Testar cancelamento do processo de assinatura e retorno tardio do fornecedor. Para o e-mail: contrato sem endereço recusado antes de publicar; registo tardio pelo administrador conserva a data original; duplicação da mesma comunicação não duplica eventos; pedido atempado impede a renovação e mantém o serviço até ao termo; contrato ambíguo e mensagem sem prova suficiente seguem para revisão.

O trabalho deste registo altera apenas documentação. Não há novo botão/API, contrato celebrado, envio, cobrança, integração de assinatura ou implantação em produção.

## Fontes consultadas em 28/09/2026

1. [Decreto-Lei 12/2021, versão consolidada, artigo 3.º](https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/2021-156957575).
2. [Decreto-Lei 446/85, artigos 5.º, 6.º, 18.º, 19.º e 22.º](https://www.pgdlisboa.pt/leis/lei_mostra_articulado.php?nid=837&tabela=leis).
3. [Código Civil, artigos 810.º a 812.º](https://www.pgdlisboa.pt/leis/lei_mostra_articulado.php?ficha=801&nid=775&pagina=9&tabela=leis).
4. [Decreto-Lei 24/2014, artigos 4.º, 10.º, 15.º e 17.º](https://www.pgdlisboa.pt/leis/lei_mostra_articulado.php?nid=2062&tabela=leis).
