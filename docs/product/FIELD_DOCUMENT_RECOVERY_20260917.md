# TASK220 — Recuperação dos documentos da viatura

## Problema verificado

A cache antiga era global por viatura, sem conta nem dia. Uma consulta parcialmente falhada podia reutilizar dados antigos, renovar o timestamp conjunto e apresentar tudo como online porque o último pedido tinha sucesso. Respostas tardias podiam substituir dados de uma consulta mais recente. A guia partilhada podia ainda substituir o técnico atual pelo técnico que abriu a guia. O JSON da guia incluía o PIN desse técnico relacionado.

## Comportamento implementado

- `CWFieldDocuments` conserva secções independentes de guia AT, guia de obra/stock e seguro/inspeção, com identidade tipada da conta, papel, técnico, viatura e dia civil. Não persiste o token. O service worker v49 inclui o módulo para recarga offline.
- Cada secção conserva a sua data real de consulta e a ordem do pedido. Uma falha parcial recorre apenas à cópia desta conta/viatura/dia, sem renovar a data da secção antiga. O ecrã distingue online, cópia guardada, parcial e indisponível.
- Gravação coordenada entre janelas por Web Locks, com leitura de confirmação. Quota, corrupção, identidade incoerente e gravação não confirmada apresentam aviso e conservam os bytes anteriores. Uma resposta atrasada não substitui a cópia de um pedido posterior.
- A cache v1 sem titularidade/dia permanece intacta e não é importada. A primeira consulta válida cria uma chave v2 independente. Guias partilhadas entre técnicos da mesma viatura continuam permitidas, mas cada conta precisa da sua própria consulta ao servidor.
- Mudança de conta oculta o ecrã anterior; mudança de viatura/dia retira os documentos atuais. O início e a conclusão voltam a calcular os bloqueios documentais antes da operação. Resposta 401/403, incluindo corpo não JSON, impede fallback documental nessa consulta.
- As respostas JSON de `/api/guides` removem recursivamente PIN, senha e tokens de credenciais. A cache faz a mesma limpeza para respostas de versões anteriores. O técnico da sessão deixa de ser substituído pelo autor da guia partilhada.
- Falhas nas consultas de documentos oficiais, consumos/contexto e viatura propagam erro. Metadados oficiais ilegíveis não são ausência de documento. O PDF de obra também falha se a consulta dos consumos falhar, evitando apresentar um histórico vazio como válido.

## Evidência

| Ensaio | Resultado |
|---|---|
| `run-1789637112783` | Novo grupo documental, E2E completo e rascunhos modernos aprovados |
| `run-1789637608124` | Grupo documental final aprovado, incluindo PDF com falha de consulta, tentativa de início durante validação/recusa e mudança de dia no ecrã |
| Unitários/técnicos | 388 unitários e quatro testes de técnicos aprovados |
| Navegador/sintaxe | 17 scripts de navegador e sintaxe de 539 ficheiros backend aprovados; ficheiros JS finais alterados também verificados |
| CI nativo/restauro | CI `35205980948`, commit `2627ea6f06c5ca8abf1b7185d1c4a093b5b604ba`, árvore `5a18af23fc449b340d34ae786cde0ed893819010`: 123/123 grupos, 388 unitários/quatro técnicos, 17 scripts de navegador, 20 migrações e restauro de 110 tabelas/32 ficheiros com linhas/hashes iguais em PostgreSQL 16 |

O novo grupo usa API/base reais e Chromium: dois técnicos na mesma viatura, viatura alheia, PIN privado na fixture, três secções documentais, falha parcial, quota, gravação sem efeito, JSON corrompido, resposta com viatura errada, respostas fora de ordem, recarga totalmente offline, recusa 403 não JSON, troca de conta e dia. Confirma ausência de pedidos de início e visita ainda PLANNED durante validação/recusa. Larguras 320, 390 e 1440 sem overflow horizontal, sem erros de página. Falhas de consulta são injetadas em handlers reais e exigem resposta 500, incluindo o PDF de obra.

O primeiro ensaio usava apenas `quantity` na fixture; a API recalcula o saldo a partir do consumo, pelo que o teste passou a alterar também `usedQty`. A extensão do ensaio de início precisou de confirmar o diálogo real de check-in antes de verificar o bloqueio documental. As asserções foram mantidas e o ensaio final passou.

## Limites

A cache conserva dados JSON; os PDFs exigem ligação. Uma cópia válida de hoje pode permitir trabalho offline, mas não confirma alterações/revogações recentes. A rejeição online não apaga dados guardados. Não há sincronização entre dispositivos nem garantia de armazenamento permanente do navegador. Web Locks é necessário para guardar uma nova cópia com coordenação; a consulta online continua utilizável com aviso se a gravação falhar.

Este lote revê o centro documental do modo de campo e as consultas relacionadas; não é auditoria de todos os documentos/endpoints da aplicação. Não altera schema, emissão fiscal, fornecedores externos, main ou deploy. O PNG preexistente `technician-guide-1440x900.png` permanece excluído, SHA256 `fba3c8189d9e0a31d96b378550736f865d30a4019f5e8d4d4487b15cfc543a71`.
