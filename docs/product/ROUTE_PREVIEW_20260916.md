# TASK204 — Sugestão de rota por dia

## Resultado

O botão antigo que apenas anunciava “em desenvolvimento” passa a abrir uma sugestão por proximidade. O técnico escolhe o dia, autoriza a localização atual e recebe as visitas planeadas ainda não iniciadas da sua conta. Os nomes são texto literal; destinos válidos permitem abrir a navegação. Visitas sem coordenadas aparecem no final, com instrução para confirmar a morada.

`GET /api/route/optimize` mantém o formato de lista, mas passa a selecionar um único dia: data planeada prevalece sobre a data de criação, que só é usada quando não há planeamento explícito. Exclui início/fim já registados e estados diferentes de PLANNED. Sem `date`, usa o dia atual do servidor; datas inválidas não são corrigidas silenciosamente. ADMIN pode limitar a um técnico; técnicos/chefes continuam limitados à sua própria identidade, mesmo com outra identidade na query. A resposta indica conta, dia e natureza de pré-visualização e não pode ser colocada em cache partilhada.

Foi removida a emissão de `ROUTE_PLANNED` nesta consulta: calcular uma sugestão não cria nem altera o planeamento, a visita atual ou a lista operacional. A interface conserva os campos em edição e distingue GPS negado/antigo, consulta falhada, ausência de visitas, offline e resposta de outro dia/conta. Mudança de data/sessão invalida respostas tardias. A ordenação usa a heurística de vizinho mais próximo já existente, com coordenadas zero válidas e proteção numérica da distância.

## Validação

- `test-field-route-preview.js`: data planeada e criação divergentes; ontem/hoje/amanhã; início/fim/estado; ADMIN/técnico/chefe/CLIENT; coordenadas ausentes/zero; datas inválidas/repetidas; mesmos registos antes/depois da consulta.
- `test-field-route-preview-ui.js`: botão real, texto com markup tratado literalmente, navegação válida, formulário/visita/ordem intactos, dia vazio/futuro, falta de GPS/rede, erro HTTP, confirmação de dia incompatível e respostas tardias após mudança de data/conta. Larguras 320/390/1440; corrigida quebra de nomes longos nos cartões antigos.
- API e regressão de privacidade aprovadas em `run-1789584456711`. UI corrigida e regressão do alerta em `run-1789584557050`. Os 361 unitários e quatro técnicos passaram, incluindo a asserção de que a consulta não emite planeamento.
- Os painéis de alerta e rota reativam-se quando a página regressa do histórico preservado, mantendo a identidade original. O teste do alerta exerce esse ciclo de eventos, sem alegar cobertura de todas as políticas de cache dos dispositivos.

Runner com 108 grupos, sem migração nova. Confirmar o CI nativo e o restauro da árvore publicada. Não atribuir a esta alteração a aprovação da árvore anterior: TASK203 comprovada em `817d066c945ce97ae79f645d1850ec963115acae`, CI `35135753864`, 106 grupos e restauro de 109 tabelas/28 ficheiros.

## Limites e sequência

Esta sugestão usa distâncias em linha reta; não inclui estradas, trânsito, horários, carga, garantia de ótimo global ou ordem gravada pelo despacho. Exige rede e posição recente para calcular; não persiste novos pontos GPS. A abertura do mapa depende de ação do técnico e serviço externo. O limite diário desta consulta não corrige automaticamente os outros endpoints diários.

A cache antiga da rota ainda usa ID numérico e fallback global, e o merge pode conservar visitas ausentes do servidor. Os campos de visita por submeter ainda não têm persistência após recarregar. Estes são os próximos pontos de revisão; não estão cobertos por este relatório. Sem deploy, chamadas a fornecedores, merge em main ou afirmação de conclusão global.
