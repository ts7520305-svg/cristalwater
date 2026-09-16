# TASK198–199 — Recuperação e aplicação das propostas técnicas

## Resultado

A criação, a decisão individual, o lote e a aplicação à ficha técnica aceitam pedidos identificados por conta/UUID e conservam o resultado original. O navegador guarda o pedido antes do envio e oferece confirmação explícita depois de uma resposta perdida, recarregamento ou falha ao guardar o recibo local. Uma aprovação continua a ser uma decisão; a aplicação exige uma comparação própria e confirmação do administrador.

## TASK198 — Pedidos recuperáveis

- `TechnicalProposalRequest` guarda o resumo do pedido e a resposta original. A migração `20260916160000_technical_proposal_requests` é aditiva; a tabela não depende da permanência dos registos mutáveis da proposta/ficha.
- A criação e a decisão gravam a proposta, os eventos, a propagação, as notificações e o recibo na mesma transação. O reenvio igual devolve a resposta inicial antes de consultar o estado atual; reutilizar o UUID com outro conteúdo é recusado.
- O lote reserva o pedido e deriva um UUID por item. Não mantém uma ligação ocupada enquanto abre outra transação. Itens e finalização coordenam-se pelo bloqueio do pedido principal; os comprovativos dos itens prevalecem sobre uma falha transitória de uma execução concorrente. O resultado final não ganha sucessos tardios nem perde os sucessos já gravados.
- O módulo comum do navegador usa IndexedDB por conta e Web Locks por piscina/operação/proposta. Não guarda credenciais no pedido. Comprovativos incompletos, conteúdo trocado, erros não reconhecidos e falta de espaço conservam o pedido por confirmar. Dados corrompidos bloqueiam novos envios e são preservados.
- O formulário técnico conserva rascunhos por conta/piscina na sessão da janela. Uma confirmação só limpa o rascunho correspondente; outra janela com o mesmo rascunho reconhece o comprovativo. A administração conserva as seleções falhadas de um lote recuperado.

## TASK199 — Aplicação revista à ficha

- A comparação exige proposta aprovada, histórico coerente, administrador autenticado e versões da proposta e da ficha. As versões abrangem o conteúdo dos componentes, incluindo alterações que não atualizam a data do componente.
- Cada campo é interpretado pelo mesmo contrato usado pelo editor da ficha. Uma diferença face à base capturada exige escolha explícita entre valor atual e proposto. A nota histórica é um comando de acrescentar uma nota.
- O resultado mostra também os efeitos calculados no volume e na profundidade média, incluindo os volumes usados no cálculo e no tratamento. Escolhas explícitas que contradigam esses cálculos impedem a aplicação; nenhum cálculo substitui silenciosamente uma escolha.
- O pedido de aplicação inclui as duas versões, as escolhas e o resumo dos efeitos revistos. Os bloqueios seguem a ordem piscina, componentes e proposta. Ficha, nota, histórico, propagação, notificações, estado `APPLIED` e comprovativo são gravados em conjunto.
- A confirmação no navegador valida o pedido, o autor, os identificadores, o estado e os efeitos devolvidos. Recuperar uma resposta não repete a nota nem aplica novamente a proposta. A atualização da lista de propostas conserva um rascunho não guardado do editor da ficha.
- Comparação verificada em PT/EN/FR/ES/DE e a 320/390/1440 px. O diálogo tem posição fixa e permanece dentro da área visível; o conteúdo longo tem deslocamento próprio.

## Evidência

| Ensaio | Resultado local |
|---|---|
| API, concorrência entre dois processos, UUID reutilizado, perda de resposta e reinício | `run-1789569295316`: aprovado |
| Reserva de lote interrompida e seis recuperações concorrentes | Mesmo ensaio: dois itens, um resultado original, sem repetição dos efeitos |
| Falha SQL na ficha, nota, evento, notificações e recibo da aplicação | Mesmo ensaio: estado anterior integralmente preservado |
| Valores tipados, escolhas incompatíveis com o cálculo, versão de componente e repetição após eliminação de registos mutáveis | Mesmo ensaio: aprovado |
| Formulários reais de criação/decisão/lote/aplicação, idiomas e dimensões | `run-1789569295316`: aprovado, incluindo regressão TASK197 |
| Quota antes do envio e ao guardar confirmação; duas janelas; recibos incompletos; corrupção; resposta tardia após mudar de conta | `run-1789569381725`: aprovado |
| Regressões da ficha técnica: atomicidade, recuperação API e editor real | `run-1789569097814`: três grupos aprovados |
| Testes unitários e técnicos | 324 + 4 aprovados |
| Navegador independente | 17 scripts aprovados |
| Sintaxe backend | 530 ficheiros aprovados |

Dois ensaios locais anteriores da TASK197 encontraram `UnexpectedMessage`/falha de rollback no adaptador PGlite após erros SQL deliberados. A versão final passou localmente em `run-1789569295316`. A verificação posterior no CI com PostgreSQL 16 também passou: [workflow 35110081844](https://github.com/ts7520305-svg/cristalwater/actions/runs/35110081844), commit `8d7360a36dc18a665047e6c943c128e9db1652e2`, árvore `fbb02941e666907fbc3786143d854a18c6abfa1e`. **101 grupos**, **17 migrações aditivas**, 324 unitários/quatro técnicos, 17 scripts de navegador e sintaxe de 530 ficheiros aprovados; restauro de **108 tabelas/22 ficheiros**, com linhas e hashes iguais.

## Limites

Os pedidos antigos sem UUID mantêm compatibilidade e serialização, mas não obtêm recuperação da resposta original. A aplicação exige sempre UUID e comparação. O acesso à recuperação depende da conta original e dos dados guardados no navegador; apagar esses dados elimina o acesso local ao pedido. IndexedDB e Web Locks são necessários neste percurso. Os recibos confirmados são conservados para reconhecer rascunhos antigos, sem limpeza automática nesta entrega. Propostas históricas com tipos inválidos ou histórico incoerente exigem revisão administrativa.

Esta entrega não demonstra prontidão global, receção em telefones reais ou funcionamento dos fornecedores externos. A retoma seguinte reviu o GPS antigo: a chave global/substituição por snapshot já fora corrigida na TASK83. A falha remanescente de confirmação incompleta e a consolidação dos emissores são tratadas na TASK200; ver `GPS_CONFIRMATION_RECOVERY_20260916.md`.
