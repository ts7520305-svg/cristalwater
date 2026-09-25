# TASK344 — consulta administrativa de pagamentos

A página `/admin-payments` passa a consultar o histórico com paginação e filtros confirmados, distinguindo uma lista vazia de uma falha. Os registos originais e os percursos de recebimento existentes são conservados. [Evidência local](evidence/20260925_task344_local.json).

## Comportamento entregue

- Novo `GET /api/admin/payments/ledger/page`, reservado a ADMIN, com resposta tipada, identidade do administrador e cache privada. As recusas anteriores ao router também recebem `private, no-store`. Falhas internas são devolvidas sem detalhes da base de dados e sem uma lista vazia fictícia.
- 50 registos por página, ordenados por instante de pagamento e ID descendentes. Contagem e linhas são lidas na mesma transação `RepeatableRead`. Cada mudança de página faz uma consulta nova, como indicado na interface; não congela todo o histórico entre páginas.
- Filtros por cliente, método original, pesquisa e intervalo UTC inclusivo. A pesquisa abrange nomes atuais, referências, identificadores, métodos e notas em todo o conjunto filtrado. `%` e `_` são tratados como texto literal. IDs, páginas, datas impossíveis, parâmetros duplicados ou desconhecidos são recusados.
- O montante parte do campo original `amount`. O campo `amountCents` é apresentado separadamente nos detalhes. Zero histórico, divergência entre os dois campos e valores sem cêntimos exatos são assinalados; não há reparação automática nem arredondamento silencioso dos casos por rever. Registos negativos permanecem visíveis.
- A classificação de crédito interno reutiliza a regra financeira existente. A lista inclui esses movimentos e explica que não representa um total de caixa ou um saldo. Não recalcula dívidas, recebimentos, receitas ou documentos fiscais.
- Cliente associado ao documento, nome atual, referência interna, estado, método e notas são identificados pela sua origem. Texto histórico é inserido como texto literal; não executa HTML. Dados de contacto e notas privadas do documento não fazem parte da projeção.
- Mudanças de filtros removem os resultados antigos até nova confirmação. Sessão alterada/expirada, respostas tardias, tipo/identidade incompatíveis, offline, timeout e regresso pelo histórico são protegidos. A memória comum de navegação não pode repor filtros sobre a seleção do endereço.
- Pesquisa e paginação no início/fim da lista, cinco idiomas no conteúdo da consulta e idioma conservado no endereço ao recarregar. A navegação comum continua com as suas traduções existentes. O acesso à conversa do cliente conserva o destino anterior, sem enviar mensagens.

## Validação

614 testes unitários em 84 ficheiros, quatro testes técnicos e sintaxe de 630 ficheiros backend, 224 frontend e 62 scripts inline aprovados. Três grupos integrados API/Chromium passaram: novo histórico de pagamentos, excedentes de recebimento e controlo de acesso administrativo antigo. Ambiente PGlite isolado, 40 migrações aditivas existentes e canais externos desligados.

O novo grupo percorre 105 registos em três páginas, confirma limites e ordenação com datas iguais, filtros, pesquisas literais, valores divergentes e crédito interno. Verifica 401/403 em GET/HEAD, parâmetros inválidos, cliente ausente e erro interno saneado. No navegador confirma cinco idiomas/reload, 320/390/1440 píxeis, texto literal, erro distinto de vazio, respostas incompatíveis, offline, timeout, respostas tardias, histórico, mudança de conta e expiração real. Pagamentos, documentos e clientes são comparados com os originais; não há pedidos de escrita na página.

A regressão de excedentes conserva o recebimento integral, o depósito de valor zero e os comprovativos repetíveis, incluindo rollback e concorrência de depósitos. Os acessos administrativos antigos continuam a recusar cliente/técnico/chefe de equipa, mantendo os percursos autorizados. Capturas e hashes em `reports/field-visual/payment-ledger/` e na evidência local; o script de integração regenera as capturas.

Cache v156, runner com 242 grupos distintos, sem novas migrações ou dependências. O limite do CI sobe de 35 para 40 minutos: a TASK343 confirmada demorou 33m06s, antes deste novo grupo, e o restauro precisa de tempo próprio.

## Estado e limites

Publicação e CI/restauro PostgreSQL deste lote por confirmar. TASK343 tem [241/241 grupos, 17 etapas e restauro de 127 tabelas/47 ficheiros aprovados](evidence/20260925_task343_ci.json), com linhas e hashes iguais. Essa aprovação não antecipa o resultado das alterações atuais.

O inventário passa a 79 páginas com referência literal em 263 scripts ativos, entre 115 HTML; 36 ficam na fila de pesquisa. A referência não equivale a revisão completa. As APIs antigas de compatibilidade permanecem como estavam; este lote trata a nova consulta utilizada pela página. Restantes páginas, idiomas comuns, cobertura financeira integral e dependências de produção mantêm critérios abertos. Sem merge, deploy ou contactos reais.
