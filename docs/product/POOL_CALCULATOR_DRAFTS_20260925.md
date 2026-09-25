# TASK347 — rascunhos da calculadora antes de guardar

Os campos introduzidos na calculadora passam a ser conservados antes de enviar um pedido. A recarga recupera o rascunho da piscina, da conta e do separador, mantendo a versão originalmente revista. [Evidência local](evidence/20260925_task347_local.json).

## Comportamento entregue

- Cada alteração conserva os 34 campos e a ficha revista em `sessionStorage`, numa chave por administrador e piscina. Um separador independente não substitui o rascunho de outro. Texto, zero, casas decimais e versão são preservados; resultados anteriores não são restaurados como atuais.
- Trocar de piscina pede confirmação para conservar o rascunho e abrir a seleção. Cancelar mantém campos, seleção e endereço. Regressar à piscina recupera os respetivos campos. Recarregar a ficha pede descarte explícito e só remove o rascunho depois de confirmar uma leitura válida da ficha atual.
- A recuperação compara a versão original com a versão atual. Uma ficha entretanto alterada conserva o rascunho e bloqueia Guardar, sem aplicar os campos antigos sobre uma versão nova. Cancelar o descarte mantém os bytes e a versão original.
- Mudança de conta e expiração limpam a vista privada. Ao regressar à conta original no mesmo separador, o rascunho reaparece. Nenhum rascunho provoca automaticamente uma escrita na API. O regresso pelo histórico conserva o conflito e permite repetir a conservação quando falhou; a navegação não muda a piscina visível enquanto esse rascunho está bloqueado.
- Quota, leitura inválida e escrita ignorada são estados visíveis. Os bytes anteriores permanecem; novas gravações ficam bloqueadas. Os campos continuam editáveis e a conservação pode ser repetida expressamente. Números ainda incompletos, como o sinal `-` antes de escrever os algarismos, não substituem a última versão conservada nem impedem completar o campo.
- Antes de Guardar, o rascunho é novamente conservado. O pedido persistente da TASK346 tem prioridade na recarga, mesmo quando o endereço indica outra piscina. A confirmação só conclui o rascunho que corresponde exatamente à piscina, versão e campos enviados; rascunhos de outras piscinas permanecem.
- Se a remoção local do rascunho falhar depois de a operação ser confirmada, a confirmação do servidor continua válida. A próxima recarga reconhece o comprovativo, conclui apenas esse rascunho e não envia outra gravação. Um pedido recusado conserva o rascunho até descarte explícito.
- Foi corrigida a apresentação após normalização da gravação. Quando os campos devolvidos diferem dos campos calculados, os resultados são limpos e é pedido um novo cálculo dos valores apresentados. O ensaio cobre a remoção do volume do perfil, que faz reaparecer o volume principal; não se mostra o resultado antigo junto de um volume diferente.

## Validação

624 testes unitários em 86 ficheiros, quatro testes técnicos e sintaxe de 631 ficheiros backend, 227 frontend e 62 scripts inline aprovados. Quatro grupos de integração: rascunhos, estado da calculadora, recuperação no navegador e gravação revista na API. Os três grupos de navegador foram repetidos; o novo grupo voltou a passar após os ajustes finais de histórico da página.

O novo ensaio usa duas piscinas e dois administradores reais numa base isolada. Verifica recarga, alternância de piscina, seleção cancelada, leitura nova falhada, descarte cancelado, versão obsoleta, conta, expiração, separadores independentes, quota, escrita ignorada, número incompleto, bytes corrompidos e rascunho de outro titular. Confirma a passagem ao pedido offline, a limpeza exata após confirmação e a recuperação de uma limpeza local falhada. Quatro gravações são aplicadas, uma é recusada por conflito; a outra piscina, pagamentos, documentos e notificações permanecem iguais.

Três capturas do conflito em 320/390/1440 foram revistas e são regeneradas em `reports/field-visual/pool-calculator-drafts/`. A evidência regista fontes, logs e capturas. Cache v159, runner com 246 grupos distintos, 40 migrações existentes; sem alterações de esquema, backend ou dependências. Inventário: 115 HTML, 80 páginas com referência literal em 267 scripts ativos e 35 na fila de pesquisa; referência literal não equivale a revisão completa.

## Estado e limites

Validação local concluída; publicação deste lote e CI/restauro PostgreSQL nativo por confirmar. A TASK346 está publicada em `738f7042737a403c730fc818c0c63ca925ce41e8`, [CI 36102243450](https://github.com/ts7520305-svg/cristalwater/actions/runs/36102243450), ainda em execução no último controlo. TASK344/345 mantêm CI e restauro nativo aprovados.

O rascunho anterior a Guardar pertence ao separador: não é uma cópia de segurança nem há garantia de recuperação após o seu encerramento. O pedido já preparado continua no armazenamento persistente da TASK346. Rascunhos não são sincronizados entre dispositivos; bytes inválidos não são reparados nem apagados automaticamente. A revisão deste lote é PT-PT; fórmulas científicas, tradução completa, chamadores antigos sem versão e restantes critérios da aplicação mantêm âmbito próprio. Sem merge, deploy ou contactos reais; aplicação não declarada completa.
