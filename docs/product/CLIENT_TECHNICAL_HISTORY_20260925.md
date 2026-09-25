# TASK351 — histórico técnico próprio do cliente

“Detalhe técnico” deixa de abrir um formulário administrativo de extras. `/client_tech` e `/client-history` passam a consultar os registos técnicos da conta autenticada, em páginas de 50 visitas e com conteúdo próprio em cinco idiomas. A revisão encontrou e corrigiu a exposição de notas internas e a atribuição de visitas antigas ao novo titular da piscina. [Evidência local](evidence/20260925_task351_local.json).

## Comportamento entregue

- Nova consulta `GET /api/client-portal/:clientId/technical-history`, com identidade Client verificada, leitura ADMIN, filtros de piscina e datas UTC e ordenação por data original/ID. Contagem e página pertencem à mesma transação de leitura. Parâmetros inválidos ou repetidos são recusados. Uma piscina sem registos próprios produz vazio, sem revelar a existência de dados de outro cliente.
- O âmbito usa `ServiceVisit.clientId`. Mudar o titular atual de uma piscina não transfere o histórico. Registos sem cliente confirmado não são atribuídos por inferência; visitas próprias sem piscina continuam visíveis. A consulta mostra todos os estados originais, sem apresentar uma visita planeada como concluída.
- Projeção explícita de campos técnicos públicos: datas, estado, nome de técnico guardado, notas públicas, produtos, consumos e seis medições. Notas internas, alertas de trabalho, custos, margens e contactos ficam fora desta resposta. Zero, ausência, valores negativos, precisão e unidades ausentes permanecem distintos. Nomes de piscinas são atuais; nome de técnico ausente não é substituído pelo nome atual da relação.
- Os aliases antigos de histórico/última visita também usam o cliente da visita e campos públicos; deixam de devolver notas internas/alertas de trabalho e dados financeiros. Recebem cache privada e falhas 503 sem detalhes de origem. A consulta principal e o agendamento do portal deixam de inferir a titularidade através da piscina. A verificação comum de identidade distingue Client de User, mesmo com IDs coincidentes, e preserva a leitura administrativa.
- As duas páginas usam a identidade da sessão, ignorando tentativas de selecionar outro cliente no endereço. Datas originais e texto literal podem ser abertos em cada cartão. Documentos mantêm acesso pelo painel existente do portal. Já não existem controlos de criar regras/extras, preços, técnico atribuído ou apagar registos na página do cliente.
- Conteúdo próprio PT/EN/FR/ES/DE, escolha de idioma no endereço e recarga. Mudar o idioma não consulta nem altera dados. Filtros alterados invalidam os resultados até Atualizar. Erro, vazio e página fora do intervalo são distintos; respostas incompatíveis/tardias, offline, timeout, histórico, mudança de conta e expiração limpam a vista desatualizada ou privada.

## Validação

639 testes unitários em 90 ficheiros, quatro técnicos e sintaxe de 633 ficheiros backend, 234 frontend e 55 scripts inline aprovados. Quatro grupos integrados distintos: histórico técnico do cliente, login/saída/preservação, avisos do portal e pedidos do cliente. O histórico voltou a passar após conservar o nome do técnico estritamente como registado e acrescentar recusas de identidade User nos aliases antigos; os pedidos foram então ensaiados em dois processos, incluindo concorrência, perda de resposta, recuperação, rollback e finanças/agendamento inalterados.

O cenário de histórico cria 108 visitas: 105 de um cliente com a piscina atualmente noutro titular, uma própria sem piscina, uma do novo titular e uma sem cliente confirmado. São consultadas as 106 próprias em três páginas, sem repetição. Cobre datas UTC no limite do dia, nulos, zero, subunidades, negativos, precisão, estado antigo, texto com HTML literal, consumo sem unidade, filtros e paginação inválidos, perfis/IDs coincidentes, expiração e falha sanitizada. Os aliases de histórico/última visita e o histórico principal do portal conservam a separação entre clientes. Snapshots dos registos e contagens de documentos, pagamentos, notificações, relatórios e pedidos permanecem iguais.

21 capturas regeneráveis em `reports/field-visual/client-technical-history/`: detalhe técnico nos cinco idiomas em 320/390/1440, medições em alemão nas três larguras e histórico em PT nas três larguras. Revistas amostras do cabeçalho alemão/francês/inglês e das medições em alemão a 320 e 1440. O ensaio verifica ausência de transbordo horizontal. A evidência regista fontes, logs e capturas. Cache v163; runner com 250 grupos distintos; 40 migrações existentes. Sem migração, reatribuição ou escrita nos dados de negócio por estas consultas.

Inventário: 115 HTML, 87 páginas com referência literal em 271 scripts ativos, 28 na fila de pesquisa; nenhum recurso ausente do índice, duas imagens não materializadas nesta cópia. Referência literal não equivale à revisão universal de uma página.

## Estado e limites

Preparada e validada localmente; publicação e CI nativo deste lote ainda por registar.

TASK349 e TASK350 confirmadas respetivamente em [248/248](evidence/20260925_task349_ci.json) e [249/249](evidence/20260925_task350_ci.json) grupos esperados distintos, 17 etapas cada e restauro PostgreSQL de 127 tabelas/47 ficheiros com linhas e hashes iguais.

Cada página é uma consulta nova, sem congelar todo o histórico entre pedidos. As medições históricas não certificam qualidade atual da água; unidades inexistentes na origem não são inferidas. Fotografias/PDFs continuam nos seus percursos próprios. Os contratos agrupados antigos conservam os seus limites de quantidade; os restantes estados/agregados do portal, navegação comum/assistente, páginas e critérios de produção continuam com revisão separada. Registos sem cliente confirmado ficam para conferência administrativa, sem serem corrigidos por esta leitura. Sem merge, deploy ou contactos reais; aplicação não declarada completa.
