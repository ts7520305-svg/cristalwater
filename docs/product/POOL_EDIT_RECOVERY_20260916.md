# TASK192–193 — Edição de piscinas com versão e recuperação

## Problema e comportamento

A TASK189 tornou atómicas a edição geral, a atualização técnica explícita, a transferência de visitas elegíveis e o histórico. Faltava impedir que uma janela antiga substituísse alterações posteriores e recuperar uma resposta perdida sem executar novamente a transferência. Os diálogos de texto da lista também não conservavam o pedido nem permitiam rever conflitos.

O editor administrativo apresenta agora os dados atuais, envia apenas os campos alterados e mantém o pedido até receber uma confirmação verificável. Alterar o cliente usa o mesmo editor e conserva o cliente original no trabalho iniciado/concluído/faturado e no histórico financeiro.

## Contrato do servidor

- `GET /api/pools/:id/edit-state` e `/api/core/pools/:id/edit-state` fornecem uma versão opaca da piscina e das quatro relações técnicas: ficha, equipamento, sala técnica e perfil de cálculo. Uma alteração apenas numa dessas relações invalida a versão, mesmo sem mudar a data da piscina.
- O catálogo identifica clientes por nome e ID, sem credenciais. Inclui clientes elegíveis e o proprietário atual, ainda que inativo. A versão própria do destinatário vincula a seleção aos seus dados e estado observados; um pedido recusado por arquivo continua obsoleto depois da reativação.
- Os dois aliases PUT partilham identidade ADMIN autenticada, UUID, assinatura canónica dos campos e versões. Campos desconhecidos, versões incompletas e valores inválidos são rejeitados antes da transação.
- Bloqueios por identidade/UUID, cliente destinatário, piscina e relações técnicas serializam a edição. Piscina, campos técnicos explícitos, visitas elegíveis, histórico obrigatório e comprovativo são gravados na mesma transação. Uma falha no histórico ou comprovativo reverte todas essas alterações.
- `PoolEditRequest` conserva a resposta original por identidade/UUID. Repetir o mesmo pedido devolve essa confirmação, mesmo após outra edição, arquivo do destinatário ou reinício do processo. Não volta a mover visitas criadas posteriormente. Reutilizar o UUID com outros dados/piscina é recusado.
- O comprovativo contém piscina, autor, UUID, versões inicial/final e do destinatário, assinatura do conteúdo, histórico, clientes anterior/novo e número de visitas transferidas. Não inclui password/PIN do cliente.
- Chamadas antigas sem UUID conservam a atomicidade da TASK189, mas não recebem proteção própria contra versão obsoleta ou repetição. As suas alterações tornam obsoletas as versões do editor novo.

## Formulário e recuperação

- Editar e Alterar cliente abrem o mesmo formulário. Nome, cliente, tipo, zona, morada, localização, mensalidade e notas gerais são comparados com a base. O volume continua na ficha técnica; notas gerais não substituem observações técnicas. Zero e vírgula decimal são aceites; valores negativos, vazios ou não numéricos são recusados.
- O rascunho pertence à conta, piscina e sessão da janela. IndexedDB conserva o pedido pendente e a confirmação; o formulário persiste e relê o pedido antes do transporte. Não há envio automático ao abrir/recarregar.
- A confirmação exige HTTP final, identidade, UUID, piscina, versões, assinatura, histórico, clientes, valores alterados e contagem de transferências consistentes. Respostas vazias, 202, incompletas, trocadas ou perdidas mantêm o pedido original para confirmação explícita.
- Web Locks e IndexedDB coordenam duas janelas. Rascunhos distintos são preservados e um pedido confirmado não pode reaparecer. Uma resposta atrasada da piscina A não fecha nem modifica o editor aberto para B.
- O conflito mostra valores atuais, do rascunho e do pedido pendente. Diferenças não sobrepostas são propostas; sobreposições exigem escolha. Clientes inativos não são opções válidas de transferência. Preparar a revisão não grava no servidor; apenas o próximo Guardar cria um novo UUID com as versões revistas.
- Um pedido incerto só é substituído após confirmação de rejeição por versão. A revisão é persistida antes de remover a pendência. Quota, corrupção ou falha ao guardar a confirmação conservam o pedido e impedem uma nova escrita ambígua.
- Trocar de conta/token limpa campos, catálogo e pré-visualizações, bloqueia o transporte antigo e preserva os registos para a conta original. Mudar de idioma depois da troca não repõe nomes antigos. O formulário declara memória própria e não é restaurado pelo mecanismo genérico da página.
- Estados e instruções do editor disponíveis em PT/EN/FR/ES/DE. Nomes e outros dados da lista permanecem literais, incluindo palavras coincidentes com rótulos traduzidos e texto com marcação HTML.

## Correção visual encontrada na verificação

Os testes iniciais conseguiam clicar no formulário porque o navegador o deslocava para a zona visível, mas as capturas após redimensionar mostravam a lista. Uma regra geral `body.cw-v2-shell-enabled > *` substituía a posição fixa do modal por relativa: a reprodução registou o topo a 2221 px numa janela de 900 px.

A regra foi corrigida com seletores específicos dos modais e camada acima da navegação. A mesma falha foi reproduzida no editor de clientes, cujo topo ficava a 2428 px, e corrigida também no seu modal e diálogo de confirmação. Em mobile, o espaço superior evita que o seletor de idioma tape Fechar. Os testes dos dois editores passam a verificar posição fixa, limites verticais/horizontais e presença à frente da página, além da largura interna. Capturas em `reports/field-visual/pool-edit/` e `client-edit/` revistas depois da correção.

## Validação e migração

- `test-field-pool-edit-recovery.js`: dois aliases, dois processos, oito pedidos concorrentes, UUID reutilizado, versões obsoletas e alterações só nas relações técnicas; perda de resposta/reinício, arquivo/reativação do destinatário, preservação financeira e reversão em falhas do histórico/comprovativo.
- `test-field-pool-edit-recovery-ui.js`: página real, dois separadores, perda/troca de confirmação, quotas/corrupção, rascunhos, conflito por campo, destinatário indisponível, sessão, idiomas e larguras 320/390/1440 px.
- Backend e atomicidade aprovados em `field-qa-runtime/run-1789555752478`; UI inicial em `run-1789555971593`. Reprodução visual falhou como esperado em `run-1789556309041` (piscinas) e `run-1789556389695` (clientes); estes resultados não são apresentados como aprovação.
- Regressões após a correção em `run-1789556450663`: API/UI de piscinas, UI de clientes, ativação de contrato e percurso E2E. Prisma validado, 324 unitários/quatro técnicos, sintaxe de 526 ficheiros backend e 17 scripts de navegador aprovados localmente. A base local usa PGlite por TCP; o CI em PostgreSQL 16 continua a ser o gate nativo.
- Revisão final dos dois grupos de piscinas aprovada em `run-1789556651262`, incluindo a rejeição de versões do destinatário ausentes/trocadas e a captura do formulário normal em mobile.
- Runner passa a 95 grupos. A décima quinta migração, `20260916140000_pool_edit_requests`, cria apenas a tabela de comprovativos, chave composta e índice. O teste de upgrade conserva os dados antigos e verifica a equivalência do esquema; são esperadas 106 tabelas no restauro.
- Base publicada confirmada: TASK190–191, commit `a8fd7656cbcbfd23222cb9803024319bade4a440`, árvore `f851087666c4a18f4af0f172ad72eef9d7def4a4`, workflow `35084563824`, com 93 grupos, catorze migrações e restauro de 105 tabelas/22 ficheiros com linhas e hashes iguais. Confirmar separadamente o workflow da árvore desta alteração.

## Limites e próximo trabalho

Limpar os dados do navegador remove os registos locais. Um rascunho ainda não enviado depende da sessão da janela. Alterações em campos técnicos fora do formulário e rotação da chave de assinatura podem exigir revisão. O contrato não representa sincronização automática nem um histórico editável.

A rota específica `/api/core/pools/:id/technical-sheet`, as propostas técnicas, criação/arquivo de piscinas e restantes escritas antigas continuam a exigir revisão própria de atomicidade e recuperação. A transação da edição geral não demonstra essas garantias nos outros percursos. O inventário visual de todas as páginas/estados permanece pendente.

Este lote não inclui merge em main, deploy/VPS, mensagens a fornecedores reais ou emissão fiscal. Não constitui declaração de prontidão integral do sistema.
