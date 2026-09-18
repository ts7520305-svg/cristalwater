# TASK257 — Abertura autenticada dos relatórios pelos alertas

## Alteração

O botão de relatório de `/admin-alerts` usava navegação direta para uma API autenticada e não enviava Authorization. Passa a usar `cw-report-download.js`, já usado nas configurações e no centro de relatórios. Abre o PDF administrativo da visita, reservando a janela durante o clique, sem credenciais no endereço. Confirma HTTP 200, tipo PDF, visita, cliente, apresentação administrativa e integridade mínima do ficheiro antes de o apresentar.

A projeção administrativa acrescenta `report`, com identidade de visita regular e cliente histórico. Só existe para o próprio alerta de ServiceVisit ou ligações com metadados explicitamente REGULAR, sem contradições de cliente/instalação. Números inferidos de texto, ligações sem tipo, EXTRA e clientes contraditórios não autorizam o botão. O enriquecimento histórico existente é conservado e as associações sem relatório confirmado apresentam instrução de revisão. O URL guardado em serviceNote não dirige a abertura.

A seleção inclui a referência do alerta e a geração de leitura. Filtrar, atualizar, resolver/remover o alerta ou trocar de seleção cancela o documento anterior. O helper comum continua a proteger mudança/expiração da sessão, respostas tardias, falta de rede, janela bloqueada/fechada, prazo de rede, BFCache e revogação do URL temporário. Não há reabertura automática. O cliente esperado segue também na API, que já verifica o cliente histórico diretamente associado à visita.

O relatório administrativo lê as configurações atuais no servidor; este ponto de entrada não afirma usar uma versão de configurações previamente carregada na interface. As configurações mantêm a sua própria confirmação de versão. Não foram alteradas as regras de acesso nem o conteúdo dos PDFs.

## Verificação local

Ensaio `run-1789725829902` em base descartável PGlite e Chromium 149: novo percurso, faturação dos alertas e abertura dos relatórios nas configurações/centro mensal aprovados. O novo grupo verifica projeção tipada, recusa de EXTRA/associação textual/cliente contraditório, PDF real com Authorization, janela bloqueada e nova tentativa, resposta de outra visita/cliente/apresentação, PDF truncado, 503, alteração do filtro e atualização durante a resposta, offline sem reabertura e troca de conta.

395 testes unitários/63 ficheiros e quatro testes técnicos aprovados. Sintaxe de 552 JS backend/182 frontend/56 inline aprovada. Runner passa a 149 grupos; cache v79; sem migração nova. A aprovação nativa e o restauro estão registados no final deste documento.

## Continuação

Fotografias autorizadas no relatório, relatórios EXTRA e fontes Unicode/traduções continuam pendentes. Não se presume o tipo de uma visita apenas pelo número. Publicação apenas na branch de trabalho; sem merge na principal, deploy, envios reais ou emissão fiscal.

## TASK258 — Correção encontrada no CI

O primeiro CI da TASK257 (`35333002169`, job `105561362821`, commit `7ebf7e4155bc1c689380c58c200d9fc5dbb1f483`, árvore `c258f717b6f90a8532b9dbc22b636a3adcf3a8e2`) passou 148/149 grupos, incluindo o novo relatório em 6708 ms. Falhou a mudança de idioma na ficha técnica e não executou o restauro.

A causa era funcional: `cw-language-change` era emitido antes de substituir a preferência pendente. Os componentes que consultavam `readLanguage()` durante o evento liam o idioma anterior quando o respetivo PUT ainda não tinha confirmação. A atualização central grava agora a nova preferência pendente antes de traduzir e emitir o evento. As aplicações silenciosas continuam sem gravar no servidor; os dois pontos de entrada partilham a mesma ordem. Cache v80.

Reprodução determinística com PUT de idioma indisponível: `run-1789727110570` falhou no título inglês, que conservava português. Após a correção, `run-1789727147807` aprovou a ficha técnica em cinco idiomas/320–1440 px, recuperação de idioma e abertura pelos alertas. O teste de idioma confirma ainda, dentro do evento síncrono, que a leitura corresponde à escolha anunciada enquanto a resposta anterior está retida. Não foram adicionadas esperas para esconder a falha, nem retiradas asserções.

395 testes unitários/63 ficheiros e quatro testes técnicos aprovados. A confirmação nativa dos 149 grupos e do restauro consta abaixo.

## Aprovação nativa final — 18/09/2026

TASK257–258 confirmadas no commit `3ebcfd01309c32fe29476768930bb7c74b1b288a`, árvore `61c938e4a5ecf38cd25b6a0a857993e2a6bd994d`, [CI 35334809925](https://github.com/ts7520305-svg/cristalwater/actions/runs/35334809925), job `105567079628`, concluído às 10:43:23 UTC. Os 149 grupos distintos terminaram com código zero e sem sinal. Passaram 395 testes unitários/63 ficheiros, quatro testes técnicos, o gate de 21 scripts de navegador, 21 migrações aditivas e sintaxe 552/182/56. Restauro PostgreSQL 16: 110 tabelas e 32 ficheiros, com linhas e hashes iguais.

Tempos dos percursos relevantes: recuperação de idioma 4499 ms; ficha técnica 21944 ms; abertura pelos alertas 8895 ms. A atualização posterior deste registo altera apenas documentação, conservando código e testes da árvore validada. Publicação na branch de trabalho autorizada, sem força. Backup local da correção: `backup/language-order-local-20260918`. Os limites funcionais e próximos percursos acima mantêm-se.
