# TASK119 — Consistent physical stock count identity

The HTTP controller previously coerced malformed product/unit values into text before validation. Direct business-layer physical counts used a normalized balance key but wrote the caller's original product/unit into the stock movement and request fingerprint. Equivalent names could therefore produce inconsistent movement history and reject retries with harmless case/spacing differences.

The controller now passes original input to validation and builds audit messages from the confirmed movement. Counts now reuse the stock normalizer for product, unit, movement and new request identity. Product/unit inputs must be text with bounded lengths and must contain a valid normalized identifier. Existing numeric, expected-balance, role and concurrency guards remain unchanged. Exact retries of historical non-normalized fingerprints are still recognized; old records are not rewritten.

API coverage rejects object/array/punctuation-only names and invalid units, races equivalent uppercase/lowercase requests to one movement, verifies canonical movement fields, recovers an old-format fingerprint and retains the concurrent consumption test. No schema changes or external notifications. Unit, technician, syntax, native PostgreSQL suite and restore gates apply.

## Retoma e conclusão — 15/09/2026

A revisão da alteração pendente acrescenta validação dos tipos da viatura e do identificador do pedido: arrays/booleanos não podem passar através de coerção. O alias legado `name` continua disponível quando `productName` não é fornecido, mas não esconde valores falsos ou numéricos inválidos. A Business recusa também um corpo inválido antes de aceder aos campos.

O teste integrado confirma que pedidos inválidos não mudam o saldo nem criam movimentos; nomes equivalentes e reenvios do alias devolvem o movimento original; alterações da quantidade com o mesmo pedido devolvem conflito. Chamadas diretas à Business também guardam produto/unidade normalizados. Uma contagem sem desvio gera uma confirmação única e conserva o saldo. O teste concorrente com consumo continua ativo.

Ficheiros da TASK119: `InventoryCountBusiness.js`, `inventoryController.js`, `test-equipment-stock-os-operational.js`, este documento e `CURRENT_WORK_CHECKPOINT.md`. A atualização do checkpoint identifica o trabalho atual e conserva o registo histórico de julho.

Validação local concluída: sintaxe de 484 ficheiros backend e dos scripts alterados; 216 testes unitários em 49 ficheiros; 4 testes específicos de técnicos; os 14 scripts de navegador; os 31 grupos integrados em base descartável PGlite, incluindo a versão final do teste de stock, simulação acelerada de dois anos e falhas de transporte. Evidência integrada: `reports/field-suite/1789462961988/results.json`. PostgreSQL 16, migrações e restauro no GitHub continuam pendentes no momento deste registo; confirmar o workflow associado ao commit desta tarefa antes de os declarar aprovados.

Limites: não reescreve o histórico, não migra saldos legados, não altera o normalizador global nem equivale a validação de produção. A compatibilidade dos fingerprints antigos garante o reenvio com os valores originais; não promete converter todas as variantes históricas. Ensaios físicos no VPS/iPhone/Android continuam pendentes.
