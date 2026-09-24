# TASK332 — Preço por visita no editor sazonal

## Resultado

O editor administrativo permite escolher, em cada época, mensalidade com visitas incluídas ou preço por visita concluída. A simulação separa a mensalidade do preço unitário e não transforma visitas agendadas em receita realizada. Épocas gratuitas são explícitas. Um valor mensal antigo num campo desativado não é enviado como cobrança adicional.

As cadências ancoradas e exceções datadas conservam os seus rascunhos, atribuições e horários. A forma de cobrança é mostrada por extenso mesmo num seletor estreito. A confirmação compara o preço calculado e o comprovativo original; resposta perdida ou comprovativo divergente conserva o mesmo pedido para recuperação. A troca de conta limpa os dados visíveis.

## Ficheiros e ensaios

- Editor, página que carrega o cálculo comum e cache v147.
- Teste integrado `scripts/test-field-client-service-pricing.js`, fixture de navegador e inclusão no runner: 230 grupos previstos.
- Dez testes unitários de preços/provas, incluindo calendário original, atribuição, exceções, contrato alterado, épocas mistas, prorrata bissexta e dados inválidos.
- 573 unitários/78 ficheiros, quatro técnicos e sintaxe 622 backend/218 frontend/62 inline aprovados.
- API em base descartável com 40 migrações: cinco percursos de faturação, cêntimos e preço zero, documentos/reservas preservados, concorrência, recuperação, revisão independente das receitas e comprovativos alterados rejeitados.
- Chromium real: 320/390/1440 px, modo escuro, rascunhos, preço mensal desativado, dados literais, resposta perdida, comprovativo falso, reenvio exato, geração offline e troca de conta. Regressões do acordo mensal, cadências e exceções aprovadas.

O primeiro ensaio visual contou incorretamente o deslocamento interno do texto longo como excesso de largura. A verificação conserva os limites dos controlos e contentores; permite o comportamento normal do campo de texto. A asserção de bloqueio verifica agora o campo efetivo dentro do fieldset. Não se enfraqueceram as proteções de gravação.

## Alcance

Completa a interface dos comprovativos TASK330 e da cobrança TASK331. Um preço aplica-se às visitas das instalações do acordo naquela época; preços diferentes por instalação/horário não foram acrescentados. Documentos fiscais continuam externos. PGlite e Chromium locais não substituem o CI PostgreSQL 16/restauro nem um piloto físico. Publicação apenas na branch de trabalho; sem deploy, contactos reais ou migrações novas.

Inclui o fecho documental da TASK326 com os 229 grupos e restauro nativo aprovados em `b0b3b7f95c8ae5255bdf1cd1262c1565b3f23e89`; essa aprovação não é atribuída ao código posterior.

## Resultado nativo confirmado durante a TASK335

O CI deste lote terminou com 229/230 grupos distintos aprovados. Falhou apenas o seletor antigo de nomes completos no editor, que passou a recolher a descrição da forma de cobrança; o restauro foi omitido. A TASK335 delimita o seletor à regra e verifica separadamente a cobrança. A regressão local passou; aprovação nativa do código integrado ainda por confirmar. [Evidência original](evidence/20260924_task332_initial_failure.json).
