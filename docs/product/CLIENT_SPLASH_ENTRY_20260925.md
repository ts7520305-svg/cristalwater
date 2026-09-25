# TASK352 — entrada inicial e portal antigo

`/splash` e `/client-wow` passam a usar o encaminhamento de sessão já revisto na TASK350. O primeiro reconhece o chefe de equipa; o segundo abre efetivamente o portal, em vez de anunciar a abertura e permanecer parado. [Evidência local](evidence/20260925_task352_local.json).

## Comportamento

- As cinco entradas antigas usam um único encaminhamento: ADMIN para a central, CLIENT para o portal e TECHNICIAN/TEAM_LEADER para o modo de campo. A entrada inicial deixa de depender de atrasos de animação e de uma verificação incompleta do token.
- Sessão ausente, expirada, incoerente ou inacessível conduz ao login. Só um idioma PT/EN/FR/ES/DE reconhecido segue no endereço. Parâmetros de conta, credenciais, destinos arbitrários e fragmentos não são propagados.
- As duas novas entradas são páginas neutras, sem consultas de negócio ou escrita no armazenamento. Filas, rascunhos, documentos, identidades e bytes antigos permanecem intactos. As guardas e APIs do destino continuam a decidir a autorização.
- Sem JavaScript, permanece uma ligação visível para o login. O script de compatibilidade de `client-wow` foi conservado para HTML antigo em cache e também limita o endereço do portal ao idioma reconhecido.

## Validação

639 testes unitários/90 ficheiros, quatro técnicos e sintaxe 633 backend/234 frontend/54 scripts inline aprovados. Dois grupos integrados: entradas antigas e login/saída/preservação de trabalho. O primeiro foi repetido após acrescentar o ensaio sem JavaScript e a compatibilidade do HTML antigo.

50 casos Chromium cobrem cinco HTML reais, quatro perfis, aliases de identidade canónicos/antigos, ausência, expiração, divergência, tokens incompatíveis e armazenamento indisponível, incluindo variantes sem extensão, `.html` e barra final. Verificam um único destino, nenhuma API e armazenamento exatamente igual. Os destinos são substitutos controlados neste grupo, não uma prova de autenticação criptográfica.

Duas entradas sem JavaScript mantêm a ligação visível em 320 px. Três casos do script antigo verificam parâmetros arbitrários e idioma repetido/desconhecido. Os dois menus do cliente voltaram a abrir o portal em 320/390/1440; o grupo de login voltou a passar, incluindo saída e preservação de trabalho.

Cache v164; o runner mantém 250 grupos distintos, com ampliação de um grupo existente; 40 migrações existentes. Inventário: 115 HTML, 89 páginas com referência literal em 271 scripts ativos, 26 na fila de pesquisa, nenhum recurso ausente do índice e duas imagens não materializadas localmente. Referência literal não comprova cobertura visual universal.

## Estado e limites

Preparada e validada localmente; publicação e CI nativo deste lote ainda por registar.

TASK351 continua em execução no último controlo. TASK349/350 mantêm CI/restauro aprovados em 248/248 e 249/249 grupos. Este lote verifica encaminhamento e compatibilidade, não certifica os cinco idiomas do texto de fallback nem todas as páginas de destino. Sem alteração de dados de negócio, merge, deploy ou contactos reais; restantes critérios da aplicação continuam abertos.
