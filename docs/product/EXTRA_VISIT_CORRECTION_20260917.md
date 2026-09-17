# TASK214 — Correção recuperável de visitas extra concluídas

## Resultado

O modo de campo permite abrir “Corrigir registo” numa visita extra concluída. O formulário consulta a versão atual, permite rever medições, checklist, notas e produtos, exige motivo e mostra as diferenças antes da confirmação. O registo principal conserva a consulta em modo de leitura; a correção usa um formulário próprio.

O pedido conserva a identidade EXTRA, piscina, conta, UUID, versão consultada e hash do conteúdo. A resposta original fica guardada na mesma transação do registo, stock, histórico, auditoria e notificação para ADMIN. Repetir o pedido não duplica os efeitos; outro pedido preparado a partir de uma versão antiga é recusado com comprovativo. A recusa significa que a correção não foi aplicada, permanece visível e pode ser reconhecida explicitamente.

## Produtos, histórico e limites

- O stock recebe apenas a diferença entre o consumo anterior e o consumo corrigido, com movimentos próprios de consumo ou devolução ligados a ExtraVisit. A visita regular com o mesmo número permanece intacta.
- Produto e unidade são verificados na guia original aberta; histórico divergente, guia ambígua/encerrada ou saldo insuficiente impedem a alteração. Se a visita não tinha consumos registados, não se presume a guia da viatura atual: a gestão precisa de reconciliar os produtos e a origem antes da correção de stock. Medições/checklist/notas continuam corrigíveis.
- Falha depois de um ajuste parcial reverte os movimentos e saldos. Falha na notificação obrigatória reverte também execução, auditoria e comprovativo. O pedido original continua recuperável.
- Horas, UUID da conclusão original, planeamento, instruções comerciais, campos de faturação e relatório mensal são conservados. Corrigir o registo técnico não recalcula preços ou documentos financeiros.
- Histórico conserva antes/depois, motivo e autoria tipada. Recuperar um comprovativo já emitido depois de reatribuição não permite novas correções sem acesso atual.

## Navegador e recuperação

Rascunhos por conta/piscina/visita, gravação verificada e comparação entre janelas. O pedido confirmado pelo utilizador é persistido em IndexedDB antes do envio e fica imutável até à resposta exata. Recarga, resposta perdida ou trocada e mudança de sessão conservam o pedido original. A conta diferente não vê os dados da conta anterior.

Uma versão entretanto alterada exige consulta e revisão explícita das diferenças. Um pedido recusado não volta a aplicar-se automaticamente quando o stock ou a visita mudam; é necessário preparar uma nova correção. Rascunhos não enviados podem ser descartados por decisão explícita; pedidos por confirmar permanecem preservados. A revisão do fim do dia inclui rascunhos, pedidos e recusas por reconhecer. A cache pública passa para v42; nenhuma consulta operacional é colocada nessa cache.

## Evidência

Confirmação final em PostgreSQL 16: [CI 35185743837](https://github.com/ts7520305-svg/cristalwater/actions/runs/35185743837), commit `6aef9a1adef2fbdee5d978df73970b8047eb6049`, árvore `2dbeb4e5281a0ab943df177b5b3fd1274637e7ad`. Aprovados 117/117 grupos, 388 testes unitários, quatro testes de técnicos, 17 scripts de navegador, 19 migrações e sintaxe de 537 ficheiros backend. Restauro de 110 tabelas e 31 ficheiros com linhas e hashes iguais. Este registo posterior é apenas documental e não altera o código ensaiado.

- `run-1789622056227`: correção extra, execução extra, recuperação de escritas e identidade REGULAR/EXTRA aprovadas.
- `run-1789622309766`: ensaio final da correção, E2E operacional e regressão água/bomba extra aprovados. Inclui seis pedidos simultâneos com o mesmo UUID, dois pedidos com a mesma versão, alteração do payload, guia fechada, falha transacional, resposta perdida, confirmação com piscina errada, rascunho preservado, conflito de duas janelas, quota/corrupção e resposta tardia após mudar de conta.
- `run-1789622506497`: repetição final aprovada, incluindo reconhecimento explícito da recusa sem eliminar o comprovativo anterior.
- `run-1789622702982`: revisão final aprovada; sem consumo original, o sistema recusa assumir a guia atual e mantém intactos o stock e a execução.
- 388 testes unitários, quatro testes de técnicos, 17 scripts de navegador e sintaxe de 537 ficheiros backend aprovados localmente. Interface exercitada a 320/390/1440 px e captura mobile revista.
- Runner integrado passa a 117 grupos; sem migração nova (19 existentes). Primeiro CI `35185543641` aprovado no commit `805a78709ab61ffd9e08ed12bf28c6b8db11d1e6`; a confirmação final acima inclui também a proteção da origem do stock.

Impedimentos/regressos, equipamento de ExtraVisit e a revisão geral dos rascunhos modernos continuam separados. Esta tarefa não substitui os ensaios físicos em telemóvel nem a validação externa de produção.
