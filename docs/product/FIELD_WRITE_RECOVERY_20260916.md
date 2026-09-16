# TASK201–202 — Fotografias e conclusões recuperáveis

## Resultado e reprodução

Os ecrãs técnico antigo e moderno partilham pedidos persistidos antes do transporte, com conta autenticada, UUID, conteúdo original e confirmação imutável. Respostas incompletas não eliminam pendências nem autorizam um segundo consumo.

Antes da alteração, a fila antiga de fotografias perdia o item acrescentado durante um envio (esperado um pendente, obtido zero). A fila antiga de conclusões perdia a cauda após falha de rede no primeiro pedido (esperados dois, obtido um). No ecrã moderno, uma resposta com um identificador qualquer podia ser aceite, e uma conclusão bloqueada podia ser substituída por novos dados. As implementações foram consolidadas no mesmo contrato.

## Contrato e conservação

- `FieldWriteRequest` conserva a resposta original por titular/UUID, vinculada ao tipo, visita e SHA-256 canónico. A migração `20260916170000_field_write_requests` é aditiva, sem reatribuir registos anteriores. TECH, USER ligado a TECH e ADMIN são titulares distintos. Não se guardam credenciais nos pedidos IndexedDB.
- A API bloqueia o pedido e a visita na transação. Reutilizar o UUID com outra visita/operação/conteúdo é conflito. Recuperar o próprio comprovativo antecede a verificação da atribuição atual, sem revelar alterações posteriores ou contactos adicionais.
- Fotografias vinculam categoria, tamanho e bytes. O nome estável deriva do conteúdo/formato detetado; renomear a mesma imagem não duplica a fotografia. SVG é recusado. Fotografia, auditoria e comprovativo são gravados na mesma transação SQL.
- A conclusão autentica autoria, viatura e guia. Conclusão, consumos, histórico, auditoria e comprovativo partilham a transação. Falhar a escrita do comprovativo causa rollback; repetir o pedido original depois da reparação não duplica efeitos.
- `cw-field-writes` conserva cada pedido isoladamente e valida/relê a gravação antes de enviar. O Blob só é retirado depois de persistir e reler a confirmação exata. Comprovativos confirmados permanecem locais; não se pode substituir uma conclusão por novo conteúdo.
- Web Locks coordena criação/envio entre janelas. Lotes cronológicos não substituem a fila por snapshot. Falhas conservam a cauda. Recusas definitivas suspendem repetição automática; revisão explícita reutiliza o original. `Retry-After` também impede repetição manual antecipada.
- Quota antes da gravação impede transporte. Quota na confirmação conserva pedido/bytes, mesmo que o servidor já tenha aplicado a operação. Troca de conta/credencial impede uma resposta tardia de confirmar para a conta seguinte.

## Percursos visíveis

O ecrã antigo oferece “Confirmar envio guardado”. O cabeçalho deixou de tapar botões no telemóvel; atualizações tardias da rota preservam os campos em edição na página atual. Avisos de visita bloqueada têm contraste próprio em claro/escuro.

O ecrã moderno usa o mesmo armazenamento no seletor, envio individual, sincronização e conclusão. Remover aguarda a gravação local e é recusado após início do envio; uma fotografia de resultado desconhecido não desaparece da apresentação. Fotografias confirmadas não oferecem uma falsa remoção apenas visual. O seletor captura visita/sessão e rejeita ficheiros escolhidos depois da sua alteração.

A revisão do dia consulta a fila nova, e o contador aguarda a leitura assíncrona. O service worker v30 inclui os adaptadores, páginas antigas e logótipo; APIs/uploads continuam fora do cache público.

Filas históricas globais e filas modernas com titular apenas numérico são conservadas, sem atribuição presumida. O modo moderno bloqueia escrita quando encontra esse arquivo por reconciliar; o antigo sinaliza os dados sem conta confirmada. Corrupção não aparece como fila vazia/sincronizada. A reconciliação histórica exige revisão, sem comprovativos retroativos inventados.

## Evidência local

| Ensaio | Resultado |
|---|---|
| Dois processos, seis pedidos, resposta perdida e reinício | Comprovativo original; uma fotografia e um consumo/histórico/auditoria |
| UUID/conteúdo trocado, conta alheia, reatribuição e falha SQL | Recusa ou recuperação própria exata; rollback sem efeitos duplicados |
| Botões antigos de foto/conclusão: offline, reload e recuperação | Campos/bytes originais conservados até confirmação válida |
| Quota IndexedDB antes do pedido e na confirmação | Sem transporte não persistido; Blob recuperável após falha da confirmação |
| Duas janelas, foto nova durante envio e cabeça da fila sem rede | Sem perda de itens nem substituição da fila |
| Confirmação errada, resposta tardia e seletor real após troca de conta | Sem confirmação cruzada nem atribuição do ficheiro tardio |
| Modo moderno: foto/conclusão offline e botões reais de recuperação | Confirmações falsas recusadas; consumo/foto únicos e revisão do dia correta |
| Sessão expirada/renovada, 403, 429, alteração de pedido bloqueado/confirmado | Preservação, repetição controlada e conteúdo imutável |
| Recuperação a 320/390/1440 px | Sem deslocamento horizontal; capturas mobile inspecionadas |
| Unitários / técnicos / navegador / sintaxe backend | 355 / 4 / 17 scripts / 532 ficheiros aprovados |

Seis grupos dirigidos aprovados em `run-1789580501559`: percurso completo, recuperação UI/API, resiliência, GPS e operação de visitas. Revisão final de contraste/logótipo e percurso visual em `run-1789580627317`: os três grupos aprovados. O runner passa a **104 grupos** e **18 migrações aditivas**. Confirmar CI nativo e restauro da árvore publicada; evidência local não substitui essa confirmação.

Foi corrigida uma fragilidade do ensaio: o Playwright instalado tratava uma Promise de `waitForFunction` como verdadeira antes de conhecer o booleano. Os ensaios alterados aguardam efetivamente o valor e repetem com limite; nenhuma asserção foi retirada. A preparação de sessão QA limita-se à página principal da origem de teste, sem injetar credenciais em documentos incorporados.

## Limites e continuação

- Clientes sem UUID mantêm o contrato anterior. Não é uma auditoria de todos os aliases/escritas.
- Uma cópia de fotografia pode ficar órfã se SQL falhar depois da cópia. Não se elimina um ficheiro que outra tentativa possa precisar; o reenvio usa os mesmos bytes. Restauro inclui uploads e comprovativos.
- Web Locks, IndexedDB e criptografia do navegador são necessários. Limpar dados/avaria do dispositivo pode perder trabalho local não confirmado. Falta ensaio prolongado em iPhone/Android.
- Campos ainda não submetidos na página antiga sobrevivem ao refresh na mesma página, mas não receberam rascunhos persistentes novos. São distintos dos pedidos completos já guardados.
- Foi identificado `sendInternalAlert`, que anuncia envio e limpa texto sem API. Rever este botão e a otimização antiga de rota na continuação, respeitando os destinatários e reutilizando percursos existentes.
- Sem main/deploy, fornecedores ou emissão fiscal real. Inventário visual global, requisitos avançados e validação de ambiente/campo continuam pendentes; não declarar 100%.
