# TASK257 — Abertura autenticada dos relatórios pelos alertas

## Alteração

O botão de relatório de `/admin-alerts` usava navegação direta para uma API autenticada e não enviava Authorization. Passa a usar `cw-report-download.js`, já usado nas configurações e no centro de relatórios. Abre o PDF administrativo da visita, reservando a janela durante o clique, sem credenciais no endereço. Confirma HTTP 200, tipo PDF, visita, cliente, apresentação administrativa e integridade mínima do ficheiro antes de o apresentar.

A projeção administrativa acrescenta `report`, com identidade de visita regular e cliente histórico. Só existe para o próprio alerta de ServiceVisit ou ligações com metadados explicitamente REGULAR, sem contradições de cliente/instalação. Números inferidos de texto, ligações sem tipo, EXTRA e clientes contraditórios não autorizam o botão. O enriquecimento histórico existente é conservado e as associações sem relatório confirmado apresentam instrução de revisão. O URL guardado em serviceNote não dirige a abertura.

A seleção inclui a referência do alerta e a geração de leitura. Filtrar, atualizar, resolver/remover o alerta ou trocar de seleção cancela o documento anterior. O helper comum continua a proteger mudança/expiração da sessão, respostas tardias, falta de rede, janela bloqueada/fechada, prazo de rede, BFCache e revogação do URL temporário. Não há reabertura automática. O cliente esperado segue também na API, que já verifica o cliente histórico diretamente associado à visita.

O relatório administrativo lê as configurações atuais no servidor; este ponto de entrada não afirma usar uma versão de configurações previamente carregada na interface. As configurações mantêm a sua própria confirmação de versão. Não foram alteradas as regras de acesso nem o conteúdo dos PDFs.

## Verificação local

Ensaio `run-1789725829902` em base descartável PGlite e Chromium 149: novo percurso, faturação dos alertas e abertura dos relatórios nas configurações/centro mensal aprovados. O novo grupo verifica projeção tipada, recusa de EXTRA/associação textual/cliente contraditório, PDF real com Authorization, janela bloqueada e nova tentativa, resposta de outra visita/cliente/apresentação, PDF truncado, 503, alteração do filtro e atualização durante a resposta, offline sem reabertura e troca de conta.

395 testes unitários/63 ficheiros e quatro testes técnicos aprovados. Sintaxe de 552 JS backend/182 frontend/56 inline aprovada. Runner passa a 149 grupos; cache v79; sem migração nova. Confirmar a árvore publicada no CI nativo e no restauro antes de atribuir aprovação final.

## Continuação

Fotografias autorizadas no relatório, relatórios EXTRA e fontes Unicode/traduções continuam pendentes. Não se presume o tipo de uma visita apenas pelo número. Publicação apenas na branch de trabalho; sem merge na principal, deploy, envios reais ou emissão fiscal.
