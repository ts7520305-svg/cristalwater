# Jornada antiga: identidade e confirmação — TASK208

## Falha reproduzida

`technician.js` enviava o ID de Technician como `userId`, embora a jornada pertença a User. Quando os IDs diferiam, o botão recebia 403 e não iniciava a jornada. A consulta também ignorava o estado HTTP e mostrava “Não iniciado” quando o corpo de erro não tinha `workDay`. Reprodução pelo botão real em `run-1789589650952`, antes da correção.

## API e consistência

`GET /api/workday/status` resolve a própria conta autenticada; o alias com `:userId` continua a verificar o destinatário. A resposta inclui identidade tipada, User, dia e início desse dia no fuso do servidor. Consultas e escritas são privadas, sem cache partilhada. A associação da conta técnica ao utilizador ativo pelo email mantém o contrato anterior; a falta de associação é apresentada como erro, não como jornada inexistente.

Início e fim bloqueiam a linha do User dentro da transação. A unicidade já existente de User/dia, juntamente com esse bloqueio, permite repetição concorrente sem criar outra jornada. O fim repetido devolve a jornada já encerrada e conserva o primeiro `endAt`. Iniciar um dia já encerrado não o reabre. O novo formulário envia o dia observado e, no fim, o ID exato da jornada; dia mudado ou registo diferente são recusados. Datas impossíveis são recusadas, sem normalização silenciosa.

## Página e recuperação

`cw-legacy-workday.js` substitui os três handlers antigos. Antes de enviar, consulta a associação/estado atual e guarda a operação por conta em `cwWorkdayPending:v1:<identidade>`, contendo User, dia, operação e jornada de destino. Não guarda credenciais. Uma falha de gravação impede o POST. Web Locks coordena janelas; um pedido guardado impede preparar uma operação diferente.

O estado só é apresentado como confirmado após validar HTTP, identidade, dia, User e campos da jornada. Há consulta explícita e recuperação do pedido original. Uma resposta perdida é resolvida primeiro por leitura do dia original: se o estado pretendido já existe, não se repete o POST. Se não existe, o botão de recuperação pode repetir apenas a operação original. O fecho usa sempre o mesmo registo e não altera novamente a hora final.

Erros HTTP, respostas incompatíveis, falta de rede, quota ou dados ilegíveis deixam o estado por confirmar e conservam o pedido. Uma resposta tardia de outra sessão não confirma nem apaga dados. A recarga offline inclui o módulo no service worker v36. Uma operação nova exige rede; não há declaração de início/fim offline já confirmado.

## Evidência

- `test-field-workday-recovery.js` passou em `run-1789590332767`: botão real com IDs User/Technician diferentes, confirmação de outra conta recusada, consulta/quota sem falso sucesso, duas janelas, resposta perdida no fim, recarga realmente offline, recuperação sem segundo POST, JSON corrompido preservado e resposta após mudar de conta.
- O mesmo grupo verifica associação/isolamento, `private, no-store`, datas/registos incompatíveis, oito inícios e oito fins concorrentes: uma jornada e uma única hora final.
- Recuperação de rascunhos antigos, fotografias/conclusões e os sete casos antigos de segurança da jornada passaram em `run-1789590233409`. O grupo novo também passou nessa execução antes do caso adicional de duas janelas.
- Route OS passou em `run-1789590407937` com `TZ=UTC`. A primeira execução local, com `TZ=America/Chicago`, revelou uma falha anterior da consulta semanal de 29/02/2032, antes de chegar à jornada. `AdminWeeklyPlanningBusiness` interpreta `YYYY-MM-DD` como UTC e calcula a semana em hora local; tratar essa falha separadamente, sem atribuir o sucesso em UTC a todos os fusos.
- 382 unitários, quatro testes técnicos e sintaxe de 533 ficheiros backend aprovados. Larguras 320/390/1440 px e captura `reports/field-ui/LEGACY_WORKDAY.png` verificadas. Runner ampliado para 112 grupos, sem migração nova; confirmar CI/restauro da árvore publicada.

## Limites

A confirmação é do estado real da jornada User/dia, não um novo comprovativo imutável com autoria de cada comando. Não foi acrescentado histórico de correções de ponto nem transferência de responsabilidades/água/bomba ao encerrar. Clientes antigos que omitem dia e ID da jornada continuam com o contrato do dia atual, sem a vinculação adicional do formulário novo.

Um pedido antigo ainda não aplicado depois da mudança de dia é preservado para revisão pelo escritório; não é transferido para o dia seguinte. Apagar os dados do navegador elimina a cópia local. Sem ensaio em telefone físico, deploy, main ou declaração de conclusão global.
