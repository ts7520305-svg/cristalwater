# TASK121 — Validar o pedido antes de normalizar o inventário

A transferência antiga convertia os campos em texto no Controller antes da validação da Business. O teste reproduziu uma transferência com `unit: ['L']` aceite com HTTP 200, quando devia devolver 400 (`field-qa-runtime/run-1789465442328`). Outros valores inválidos podiam transformar-se em KG por fallback.

A transferência administrativa agora passa o corpo original à InventoryWriteBusiness. Reutiliza a validação de linhas, unidades e quantidades existente nas entradas/consumos e delega a transação à EquipmentStockOsBusiness. Unidades constituídas apenas por pontuação são recusadas; unidade omitida/vazia mantém o default KG compatível. Identificadores fornecidos têm de ser texto UUID, e a viatura é validada antes da conversão. Continua a aceitar o formato legado das linhas em JSON textual e o identificador opcional da transferência antiga.

Entradas e consumos recusam identificadores em arrays/objetos e corpos inválidos. Contagens validam os tipos numéricos antes de converter; objetos JSON que substituem `toString` deixam de provocar exceções. O alias `name` é resolvido na Business e o Controller obtém a viatura do movimento confirmado.

O teste API verifica as recusas sem movimentos novos nem alterações dos saldos, incluindo um saldo KG real para provar que uma unidade inválida não o consome. Mantém concorrência, reenvios e compatibilidade dos fluxos existentes. Após a correção, passou em `field-qa-runtime/run-1789465514910`. Testes unitários (216), técnicos (4) e sintaxe dos ficheiros alterados aprovados. A bateria integrada e PostgreSQL 16/restauro serão verificados no lote final da continuação.

Ficheiros: InventoryWriteBusiness, InventoryCountBusiness, inventoryController, test-equipment-stock-os-operational, este relatório e checkpoint. Sem migrações, alterações de rotas ou reescrita do histórico. Não altera o contrato dos restantes consumidores diretos da EquipmentStockOsBusiness.
