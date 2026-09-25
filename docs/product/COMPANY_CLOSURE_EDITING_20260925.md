# TASK343 — edição recuperável dos encerramentos

O formulário administrativo permite rever e editar um encerramento existente sem o duplicar. A revisão utiliza o identificador e a versão originais; uma alteração concorrente exige carregar explicitamente a versão atual. [Evidência local](evidence/20260925_task343_local.json).

## Comportamento entregue

- A ação **Editar** carrega o registo pela API autenticada. O estado fica apenas para leitura; ativação e cancelamento conservam as ações explícitas existentes. Guardar um formulário sem alterações não envia um pedido.
- Alterar título, mensagem, contacto ou preferências conserva as horas, milissegundos e valores nulos dos campos que não foram alterados. Só mudar expressamente um dia define o início ou fim completo desse dia UTC. Metadados, exceções e autoria anteriores não são substituídos.
- O rascunho de criação e os rascunhos de edição são independentes, por administrador e por encerramento. Reabrir a página, alternar entre registos e regressar à criação conserva os campos. Os novos rascunhos usam um espaço próprio para que um cliente antigo não os interprete como criação.
- A perda de resposta conserva o pedido UPDATE, a revisão e o hash. A recuperação confirma o mesmo comprovativo, incluindo os instantes antigos, sem repetir a alteração ou a auditoria.
- Um conflito conserva o rascunho e bloqueia Guardar. **Carregar versão atual** pede confirmação quando substitui alterações não guardadas; recusar conserva-as. Registos cancelados ou opções históricas não representáveis pelo formulário são recusados sem reescrever o original.
- Mudança ou expiração de sessão limpa os dados apresentados e conserva os pedidos para o proprietário. Falha de armazenamento impede novos pedidos; a recuperação respeita os limites existentes de sessão, offline e tempo de espera.
- Guardar não repete avisos já emitidos nem altera visitas, pagamentos ou saldos. O portal consulta a nova mensagem publicada pelo ciclo existente da TASK342; não há emissão externa automática.

## Validação

608 testes unitários em 83 ficheiros e quatro testes técnicos aprovados. Sintaxe: 629 ficheiros backend, 222 frontend e 62 scripts inline. Quatro grupos integrados passaram com API real, PGlite isolado e Chromium: edição, encerramentos administrativos, consulta de encerramentos no portal e interface do portal. As 40 migrações aditivas existentes foram aplicadas no ambiente isolado.

O novo grupo verifica preservação de campos antigos, repetição exata do comprovativo, duas alterações concorrentes, rascunhos separados, ausência de pedido sem alterações, perda de resposta, reload e recuperação, conflito e descarte explícito, alteração de um dia, offline, troca de administrador, opções antigas e quota antes do HTTP. Compara também visitas, movimentos financeiros e notificações antes/depois. A limpeza remove apenas os dados próprios do ensaio.

Capturas de 320, 390 e 1440 píxeis revistas; sem overflow horizontal nos ensaios. Os seletores nativos de data usam o formato do navegador, e a explicação do intervalo explicita UTC. Capturas regeneradas em `reports/field-visual/company-closure-edit/` pelo script de teste; hashes e resultados no ficheiro de evidência. Cache v155; runner completo com 241 grupos distintos. Sem novas migrações ou dependências.

## Critérios ainda abertos

O CI PostgreSQL e o restauro nativo desta publicação requerem confirmação própria. TASK342 continua em validação no CI `36091953492` no fecho local deste documento; TASK341 tem 238/238 grupos e restauro de 127 tabelas/47 ficheiros confirmados. Os resultados de um lote não aprovam antecipadamente outro.

O inventário mantém 115 HTML, 78 páginas com referência literal em 262 scripts ativos e 37 na fila de pesquisa. Este lote não fecha todas as páginas, idiomas, prioridades históricas, reagendamento ou dependências de produção. Sem merge, deploy ou contactos reais.
