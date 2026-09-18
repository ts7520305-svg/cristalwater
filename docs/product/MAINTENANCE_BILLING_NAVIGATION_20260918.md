# TASK269 — Revisão comercial a partir da ficha técnica

A TASK268 entregou a revisão comercial de intervenções concluídas, mas obrigava a abrir as configurações e procurar novamente a piscina. A ficha técnica passa a ter «Intervenções e cobrança» no cabeçalho e «Rever serviços concluídos» junto dos lembretes. O primeiro abre as execuções de equipamentos; o segundo abre os lembretes concluídos da mesma piscina.

## Comportamento

- Os atalhos só ficam disponíveis depois de confirmada a identidade da ficha. Uma invalidação da sessão retira-os juntamente com os restantes dados associados.
- O destino confirma a piscina através da API autenticada da ficha técnica, por identificador exato, antes de selecionar e consultar planos/intervenções. Não depende da lista geral de até 1000 piscinas nem seleciona a primeira opção como alternativa.
- `poolId` deve ser um inteiro positivo até 2147483647, sem repetição na query. `maintenanceKind`, quando presente, deve ser EQUIPMENT ou REMINDER e aparecer uma única vez. Identidade diferente na resposta e ligações inválidas não abrem outra piscina. A seleção manual permite recuperar uma ligação inválida.
- A seleção confirmada é comunicada aos dois painéis, conservada no endereço e usada ao recarregar. A indicação explícita do tipo no atalho prevalece sobre uma seleção antiga que o navegador restaure. Uma mudança manual de piscina/tipo atualiza o contexto da ligação.
- «Voltar à ficha técnica desta piscina» só surge após uma consulta válida das intervenções. Ao mudar ou atualizar a piscina, a ligação antiga é retirada enquanto se confirma a nova resposta.
- A atualização da lista geral conserva a piscina selecionada, mesmo quando essa piscina não está na lista devolvida. A consulta financeira continua a usar a identidade exata.
- Abrir, voltar, selecionar ou recarregar não cria decisões comerciais nem documentos. A confirmação explícita e a recuperação por conta da TASK268 continuam a ser o único percurso de escrita.

## Verificação

- Grupo comercial ampliado e aprovado em `run-1789758767037`; versão final com troca de cliente/piscina e revisão visual aprovada em `run-1789758838084`.
- Chromium percorre a ficha real → equipamentos → regresso à ficha → serviços concluídos → recarregamento. Uma lista geral vazia confirma a independência da pesquisa por identificador. A troca para uma piscina de outro cliente conserva o novo destino após reload e no regresso à ficha, sem mostrar as intervenções anteriores.
- Ligações duplicadas, fracionárias, tipo desconhecido e resposta de outra piscina são recusadas. Seleção manual corrige a ligação inválida. Contagens de documentos e decisões comerciais permanecem iguais durante a navegação.
- Regressão completa da TASK268: concorrência, valores, histórico, rascunhos, falhas, recuperação, duas janelas e mudança de sessão. Revisão visual a 320/390/1440 px, sem transbordo; cabeçalho da ficha e regresso à ficha verificados.
- Percurso real de equipamento aprovado em `run-1789758603212`; recuperação da ficha técnica aprovada em `run-1789758673666`. Nesses ensaios iniciais, o novo teste de navegação ainda identificou a seleção antiga restaurada pelo navegador; a versão final confirma o tipo do atalho após a leitura da piscina e o teste do percurso manual escolhe explicitamente o separador pretendido.
- 396 unitários/63 ficheiros, quatro testes de técnicos e sintaxe 558 backend/183 frontend/56 scripts inline. O runner mantém 152 grupos; este percurso amplia o grupo comercial existente. Cache v89. Sem alterações de API ou migrações.

Confirmar o CI PostgreSQL 16 e restauro da árvore publicada antes de declarar a validação final.

## Âmbito

Esta tarefa liga os ecrãs administrativos existentes. Não altera valores, a condição comercial, o agendamento de visitas, os prazos dos lembretes ou as permissões dos técnicos. O preço continua explícito por intervenção, com rascunho para revisão; não foi criado um preçário automático por plano. Instalação no VPS e ensaios físicos permanecem separados.

## Ficheiros (9)

1. `frontend/admin-pool-technical.html`
2. `frontend/admin-pool-technical.js`
3. `frontend/admin-equipment-maintenance.js`
4. `frontend/admin-maintenance-billing.js`
5. `frontend/admin-operational-settings.html`
6. `frontend/sw.js`
7. `scripts/test-field-maintenance-billing.js`
8. Este relatório.
9. `docs/product/CURRENT_WORK_CHECKPOINT.md`
