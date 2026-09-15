# TASK101 — Publicação e decisão de orçamentos no portal

A comparação de funcionalidades públicas de [Skimmer](https://www.getskimmer.com/) e [Pool Brain](https://www.poolbrain.com/) em 15/09/2026 mostrou valor no circuito orçamento → decisão do cliente → trabalho aprovado. O sistema já tinha versões privadas e aprovação administrativa; esta tarefa liga uma publicação explícita à decisão autenticada do cliente.

A publicação de uma versão guardada cria uma notificação no portal uma única vez. Não envia email, SMS ou WhatsApp. O cliente consulta apenas preços de venda, IVA, total e condições; custos, margens, notas internas e snapshot completo não saem pela API. A decisão exige confirmação explícita e pertence ao cliente autenticado. Administradores só consultam o portal.

Bloqueio por reparação serializa publicação, revisão e decisão. Bloqueio partilhado da piscina impede a transferência de proprietário entre a verificação de acesso e a gravação. Repetir a mesma decisão devolve sucesso sem repetir auditoria. Decisão oposta, versão substituída, expirada, reparação encerrada ou mudança de proprietário bloqueiam a operação. Recusa mantém a reparação para revisão administrativa; uma nova proposta exige nova versão. A aprovação reutiliza o fluxo existente e deixa a reparação pronta a agendar.

Migração aditiva 20260915100000_quote_portal cria RepairQuotePortal, com referência restrita à versão e cliente. Nenhuma alteração de dados históricos. Histórico publicado limitado às 100 publicações mais recentes por cliente. Notificação persistente no portal não é comprovativo de receção de mensagem externa. Não há assinatura eletrónica qualificada nem cobrança automática.

Validação: scripts/test-field-quote-portal.js cobre publicação concorrente, decisão repetida, autorização, projeção pública, rejeição, validade, versões e troca de proprietário; tests/quote-portal-projection.test.js cobre estados e privacidade. Teste de migrações verifica oito migrações cumulativas contra a estrutura anterior.
