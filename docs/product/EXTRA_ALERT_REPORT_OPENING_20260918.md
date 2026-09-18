# TASK261 — Relatórios EXTRA a partir dos alertas

## Problema e alteração

A listagem e o enriquecimento do navegador procuravam ServiceVisit pelo número do alerta, mesmo quando os metadados indicavam EXTRA. Números iguais entre tabelas podiam apresentar contexto da visita regular. O botão só aceitava REGULAR.

A listagem passa a consultar ExtraVisit separadamente e a devolver o tipo da visita e a identidade do relatório. Aceita visitType exato REGULAR/EXTRA com visitId válido ou o campo explícito extraVisitId; recusa contradições entre ambos. Confirma cliente/instalação e associações dos avisos a alertas técnicos. Várias referências incompatíveis, tipo inválido, registo ausente ou cliente divergente não autorizam relatório. Preserva o contexto antigo não tipado, mas esse contexto não é prova para abrir o PDF.

O navegador respeita a ausência de associação confirmada pelo servidor, sem procurar outra visita regular com o mesmo número. Para EXTRA apresenta o tipo e a ação Abrir relatório extra. Confirma tipo, ID, cliente, apresentação ADMIN e PDF válido. Alterar seleção/filtro, atualizar, perder sessão ou receber resposta tardia mantém o cancelamento existente. O link de ficha EXTRA dirige à instalação/cliente, sem abrir a página de visita regular.

A projeção de execução EXTRA é extraída sem alteração do relatório para extraVisitReportProjection.js e partilhada com os alertas: medições, notas de execução, ocorrência, planeamento e notas internas permanecem distinguidos. O painel é ADMIN; não altera a apresentação nem permissões do cliente. Não há escrita de faturação ou envio na consulta/abertura. Cache v82.

O botão de relatório usa o mesmo estilo legível dos restantes botões, retirando a classe que combinava fundo claro e texto branco. Contraste e larguras móveis são verificados no navegador.

## Ensaios locais

396 testes unitários/63 ficheiros e quatro técnicos aprovados. Sintaxe 554 backend/182 frontend/56 inline. O teste unitário cobre falha da leitura ExtraVisit, garantindo que não se responde com uma lista parcial. Mantêm-se 151 grupos na suite e 21 migrações aditivas, sem migração nova.

O grupo existente test-field-alert-report-opening.js é ampliado: IDs coincidentes em clientes/piscinas diferentes, metadados mínimos, extraVisitId explícito, vínculos técnicos, referências contraditórias/ausentes/malformadas, ausência de fallback REGULAR, PDF real de ambos os tipos, resposta de tipo/cliente/visita/apresentação errados, truncamento, 503, popup bloqueado e nova tentativa, mudança de seleção/filtro, atualização durante resposta, offline e sessão diferente. As contagens confirmam leituras sem efeitos de escrita.

Regressões da listagem completa, abertura EXTRA, relatório EXTRA nas configurações e faturação passaram em run-1789734444916. O primeiro ensaio em run-1789734363166 passou abertura/relatório/faturação, mas a carga massiva posterior encerrou a ligação PGlite durante a preparação. O ensaio final executa a carga massiva primeiro, na mesma ordem da suite nativa, e passou sem alterar as asserções. Revisão visual posterior em run-1789734510065 confirma o ajuste de contraste a 320/390/1440 px; imagens sintéticas em reports/field-visual/extra-alert-report-1789734517871.

Confirmação final do percurso em run-1789734604213, incluindo asserção de contraste do botão >= 4,5:1, aprovada. CI nativo e restauro PostgreSQL 16 aprovados, conforme registo abaixo.

## Limites

Esta tarefa abre relatórios de alertas que já entram na listagem; não cria novos tipos de alerta nem altera a resolução/faturação. Não converte toda conclusão EXTRA num alerta. Referências históricas sem tipo continuam a exigir revisão. Técnico/equipamento mantêm a natureza de registo atual. Fontes Unicode/tradução integral e referências fotográficas históricas não canónicas permanecem pendentes.

Dez ficheiros: listagem, apresentação, projeção partilhada, serviço de relatório, interface, cache, teste de percurso, teste unitário e dois documentos. Publicação autorizada apenas na branch de trabalho, sem merge ou deploy. Frequência preservada por cliente/época/instalação: três ou mais visitas conforme cada caso.

## Aprovação nativa final — 18/09/2026

Commit de código `f9c367cc2fcdddc5195c829acb71961f1a4e9e10`, árvore `bb6432e52bcb4092638a660ad05e6c4c7fefa724`, [CI 35345084686](https://github.com/ts7520305-svg/cristalwater/actions/runs/35345084686), job `105599658291`, concluído às 12:47:37 UTC. Os 151 grupos distintos terminaram com código zero e sem sinal. Aprovados 396 unitários/63 ficheiros, quatro técnicos, gate de 21 scripts de navegador, 21 migrações aditivas e sintaxe 554/182/56.

Restauro PostgreSQL 16: 110 tabelas e 46 ficheiros com igualdade de linhas e hashes. Abertura pelos alertas: 11586 ms; visibilidade completa: 4200 ms; faturação: 14632 ms; relatório EXTRA: 3250 ms; relatório regular: 986 ms; fotografias: 1848 ms; configurações/centro mensal: 9022 ms. Backup local `backup/extra-alert-report-local-20260918`. Esta atualização posterior altera apenas documentação e conserva o código/testes da árvore validada.

Próxima tarefa: rever fontes e traduções dos documentos. Existe `src/assets/fonts/DejaVuSans.ttf` com licença no repositório; o relatório individual ainda usa Helvetica e rótulos portugueses. A adoção da fonte precisa de verificação de cobertura de caracteres, extração de texto e paginação. Referências fotográficas históricas permanecem por rever.
