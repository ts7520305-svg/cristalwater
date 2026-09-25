# TASK353 — cobranças com contagens e estados reais

O centro de cobranças antigo atribuía uma única fatura a cada devedor, convertia dívida em estado `PAUSED` e oferecia três ações com endpoints já inexistentes. `/billing-center` passa a consultar os documentos em aberto, com estado do cliente separado do estado do pagamento e acesso aos documentos do cliente para revisão. [Evidência local](evidence/20260925_task353_local.json).

## Comportamento

- Nova leitura ADMIN `GET /api/admin/payments/collection/page`. Inclui clientes em todos os estados, mesmo em pausa/inativos. Usa `invoiceOpen`, a regra de saldo já existente na aplicação; exclui rascunhos e documentos retirados e soma cêntimos por documento. Não desconta novamente crédito disponível por aplicar.
- Conta cada documento em aberto. Identifica separadamente os que estão em atraso por estado original `OVERDUE` ou vencimento anterior ao instante da consulta. Data inexistente não é inventada. Um cliente em atraso pode ter também documentos ainda não vencidos: o total aberto e o subtotal em atraso são distintos.
- Pesquisa literal por nome/contacto/referência CW, filtro por estado do pagamento e 50 clientes por página, ordenados por ID. A contagem, as linhas e os totais filtrados usam a mesma transação de leitura. Os totais abrangem todas as páginas do filtro, sem somar novamente na navegação.
- As ações antigas passam a ligações explícitas para `/invoices?clientId=…`, onde o documento e as opções de lembrete podem ser revistos. A consulta não envia mensagens, marca pagamentos, altera clientes ou gera faturas fiscais. Os percursos existentes de registo de pagamentos permanecem disponíveis e foram ensaiados como regressão.
- A página distingue resultados, vazio, erro, filtros alterados e página fora de intervalo. Dados e totais antigos são retirados durante nova consulta, falha, mudança de sessão ou expiração. Respostas de outra conta/filtro, malformadas ou tardias são recusadas. Cache privada também nas recusas anteriores à rota.
- Conteúdo próprio em PT/EN/FR/ES/DE, com idioma e seleção no endereço; mudar idioma conserva resultados e não faz nova consulta. O estado original do cliente e os contactos são literais. Na recarga/histórico, a seleção do URL é reaplicada em `pageshow`, após a reposição dos campos pelo navegador.

## Validação

645 testes unitários em 91 ficheiros, quatro técnicos e sintaxe de 634 ficheiros backend, 236 frontend e 53 scripts inline. Três grupos integrados API/Chromium aprovados: nova consulta, registo de pagamentos e permissões administrativas antigas.

O cenário isolado cria 55 clientes e 60 documentos: 57 documentos em aberto totalizam 13 241 cêntimos; dois documentos em atraso totalizam 2 222 cêntimos. Inclui três documentos abertos para o primeiro cliente, clientes em pausa/inativos, rascunho, cancelamento, pagamento completo, vencimento ausente/futuro e crédito por aplicar. Confirma duas páginas (50/5), totais integrais, filtros, pesquisa literal, texto com HTML, permissões e falha de origem sanitizada. Compara os clientes e documentos originais e as contagens de pagamentos/comunicações/emails antes e depois.

No navegador: cinco idiomas e 320/390/1440, recarga, filtros, paginação, resposta incompatível, erro, offline, timeout, resposta atrasada, regresso pelo histórico, mudança de administrador e expiração. Sem chamadas de escrita ou mensagens. Quinze capturas regeneráveis em `reports/field-visual/collection-summary/`; amostras PT em 390/1440 e DE em 320 revistas. Os ensaios verificam a largura de todo o conteúdo.

Dois problemas encontrados durante a validação foram corrigidos antes do ensaio final: cache privada ausente na recusa do middleware anterior à rota; reposição automática dos campos pelo navegador após troca de conta/recarga. As verificações foram mantidas e os três grupos passaram na execução final.

Cache v165; runner com 251 grupos distintos, 40 migrações existentes. Nenhuma migração ou dependência nova. Inventário: 115 HTML, 90 páginas com referência literal em 272 scripts ativos, 25 na fila de pesquisa; nenhum recurso ausente do índice e duas imagens não materializadas localmente.

## Estado e limites

Publicada em `91f4725fbbab0683f9dccda88e8fbc793b601e49`, árvore `0dd030d4a1b40b49c76c0efe1e98179dd5b992f0`, idêntica à preparada e validada localmente. [CI 36122299824](https://github.com/ts7520305-svg/cristalwater/actions/runs/36122299824), job `108030369923`, em execução; os 251 grupos e o restauro PostgreSQL nativo deste lote continuam por confirmar. TASK351 confirmada em [250/250 grupos e restauro nativo](evidence/20260925_task351_ci.json). TASK352 publicada em `b0a000d9df20d47dc1079e2db4fe17966525b492`; CI `36119724596` em execução no último controlo.

A consulta usa as regras existentes de saldo, incluindo a compatibilidade e o arredondamento por documento; não concilia fontes históricas divergentes nem certifica recebimento/entrega real. Lê os documentos dos clientes para calcular os totais antes de paginar a resposta: capacidade e latência com o volume real continuam por medir. Cada página é uma nova consulta, sem congelar toda a carteira entre pedidos. Os cinco idiomas cobrem o conteúdo próprio; navegação comum e páginas de destino conservam os seus critérios de revisão. Sem merge, deploy ou contactos reais; a aplicação completa continua com critérios por fechar.

## Confirmação nativa — 25/09/2026

CI `36122299824`, job `108030369923`, concluído com sucesso no commit `91f4725fbbab0683f9dccda88e8fbc793b601e49`: 251/251 grupos esperados distintos, 17 etapas e restauro de 127 tabelas/47 ficheiros com linhas e hashes iguais. A lista esperada foi comparada com o runner desse commit. [Evidência nativa](evidence/20260925_task353_ci.json).
