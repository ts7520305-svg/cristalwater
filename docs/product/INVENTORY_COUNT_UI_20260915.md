# TASK120 — Contagem física na página de inventário

A contagem física existia na API, mas não tinha formulário na interface administrativa. A página `admin-inventory` passa a incluir «Conferir stock da viatura», antes da lista de stock. Reutiliza as APIs de viaturas, saldos e contagem; não acrescenta rotas, modelos ou um módulo de navegação.

O administrador seleciona a viatura, consulta explicitamente o saldo, escolhe o produto/unidade e introduz a quantidade contada. A interface mostra o saldo consultado, a hora da consulta e a diferença. Uma confirmação explícita antecede a gravação. Quantidades zero e fracionadas são suportadas; produtos com o mesmo nome em unidades distintas mantêm seleções independentes. Saldos duplicados, incompletos ou de outra viatura não permitem confirmar.

## Recuperação e segurança

- O pedido completo é guardado antes do envio, por identidade administrativa, com identificador único. Se o armazenamento falhar, nada é enviado.
- Resposta perdida, incompleta ou falha transitória conserva a contagem original. O editor fica bloqueado até usar «Repetir confirmação». Reabrir a página recupera o pedido sem o enviar automaticamente.
- A repetição usa exatamente os mesmos dados/identificador, incluindo o saldo original. Uma confirmação reconhecida do servidor remove apenas esse pedido.
- Conflitos definitivos obrigam a consultar novamente o saldo e a voltar a contar; não se aplica a quantidade anterior automaticamente sobre um saldo novo.
- Mudança de sessão esconde os dados e fecha a confirmação aberta. Respostas/confirmações atrasadas da conta anterior não atualizam a interface nem removem a contagem guardada.
- Web Locks protege a confirmação entre janelas da mesma origem/conta. Um pedido pendente de outra janela é recuperado, não substituído. Navegadores sem esta capacidade não enviam contagens pelo formulário.
- A resposta tem de corresponder ao saldo/movimento esperado. A comparação do saldo final admite apenas a pequena diferença de representação IEEE-754 de cálculos fracionados, sem arredondar a contagem introduzida.

O armazenamento local não é fonte de verdade para o stock: a API conserva a validação do administrador, saldo, identificador e transação. Não existe correção automática de inventário. A recuperação após fechar requer que o navegador consiga carregar novamente a página; não se promete instalação/offline integral do inventário.

## Validação

- `scripts/test-inventory-count-browser.js`: nove cenários controlados, incluindo leitura sem escrita, unidades/zero, cancelamento, cliques repetidos, perda de resposta, recarga/repetição, conflito, resposta incompleta, armazenamento cheio/corrompido, mudança de conta, resposta atrasada, múltiplas janelas, falhas de leitura e larguras 320/390/1280 px.
- `scripts/test-field-inventory-count-flow.js`: formulário/página completos, login e API real da base QA. Interrompe uma resposta real depois do commit e recupera após recarga sem duplicar o movimento. Verifica conflito com saldo alterado, nova consulta, independência L/KG, zero e frações. Imagens/resultado em `reports/field-visual/inventory-count-<timestamp>/`.
- Teste específico inicial aprovado na base descartável: `field-qa-runtime/run-1789464182508`.
- O comando de navegador passa a 15 scripts e a bateria integrada a 32 grupos. Evidências no caminho já recolhido pelo workflow.
- Bateria local final aprovada: sintaxe de 484 ficheiros backend e dos novos scripts; 216 testes unitários em 49 ficheiros; 4 testes de técnicos; os 15 scripts de navegador; os 32 grupos integrados em base descartável PGlite (`reports/field-suite/1789464442010/results.json`). A simulação de dois anos e o novo percurso de contagem estão incluídos. Confirmar PostgreSQL 16/migrações/restauro no workflow associado ao commit desta tarefa antes de os declarar aprovados.

Ficheiros: `frontend/admin-inventory.html`, `frontend/admin-inventory-count.js`, os dois scripts de teste acima, `scripts/test-field-suite.js`, `package.json`, este documento e `CURRENT_WORK_CHECKPOINT.md`.

Limites: não altera o backend nem certifica os outros formulários de inventário. Não reescreve saldos/histórico, não faz migrações nem altera produção. Ensaios físicos no VPS/iPhone/Android e tradução integral desta interface permanecem pendentes. Textos novos em português.
