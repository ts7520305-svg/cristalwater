# TASK372 — Manutenção e custos da frota

## Comportamento

`/vehicle-maintenance` permite criar, corrigir e concluir manutenções com revisão explícita dos valores anteriores e finais. A administração entra pela frota; técnicos e líderes entram pelas guias ou pelos documentos do modo de campo e acedem apenas à viatura atualmente atribuída e ativa.

- «Manter», «Alterar» e «Limpar» distinguem omissão, zero e nulo. Datas mantidas conservam segundos e milissegundos; novas datas usam Lisboa e exigem escolha nos horários ambíguos, recusando horários inexistentes.
- Criação gera um registo pendente. Conclusão só é permitida para estados abertos, preserva os campos omitidos e regista a data real da confirmação. Corrigir um registo concluído não muda a data de conclusão. Não há reabertura ou associação de outra viatura implícita.
- Motivo separado das notas existentes. Manutenção, auditoria com identidade autenticada e comprovativo são gravados na mesma transação. Conta-quilómetros da viatura, stock, guias e documentos são preservados.
- Custos e relações financeiras são exclusivos da administração, incluindo API, revisão, comprovativo, recuperação e consulta antiga. Técnicos não recebem custos nem identificadores de despesas e não podem alterar o custo, mesmo enviando pedidos diretos. Edições técnicas preservam o custo real na base de dados.
- Uma manutenção não gera uma despesa ou pagamento. A administração vê a despesa associada e o aviso de revisão quando a origem muda. Despesas, pagamentos e comprovativos existentes permanecem intactos; o registo financeiro conserva a sua revisão própria.

## Concorrência e recuperação

A prova assinada de cinco minutos associa conta, UUID, proposta e estado atual. A confirmação verifica novamente o registo, viatura, atribuição e despesa sob bloqueio. A ordem de bloqueios acompanha o livro de despesas; alterações concorrentes na origem impedem uma confirmação desatualizada. O POST antigo de criação/conclusão devolve 409 e encaminha para revisão.

Repetir o mesmo pedido devolve o comprovativo original sem duplicar o registo. São recuperáveis a perda de resposta, o reinício do processo e o recarregamento da página. A anulação persistente impede uma confirmação tardia. Só se guarda no separador a referência mínima por conta; campos, notas, valores e token de revisão ficam em memória. Falha de armazenamento, referência corrompida, expiração e troca de conta têm estados explícitos.

## Validação

875 testes unitários em 109 ficheiros, quatro testes técnicos, sintaxe de 672 scripts backend, 282 frontend e 44 inline. Sete grupos locais aprovados integralmente:

1. API de manutenção: autorização/privacidade nas duas identidades técnicas, seis reversões SQL, criação/edição/conclusão, concorrência com despesas/pagamentos, perda/reinício/repetição/anulação, datas/zero/nulo, registo histórico sem viatura e paginação.
2. Navegador da manutenção: entradas reais da administração e guias técnicas, cinco idiomas, 320/390/1440, alvos de 44 px, dados escapados, campos preservados, perda de resposta, offline, recuperação e mudança de sessão.
3. Frota API.
4. Frota navegador.
5. Despesas reais API.
6. Fecho de obra API.
7. Recuperação do centro documental.

Dezoito capturas da manutenção; revisão visual de `de-320.png` e `review-pt-1440.png`. Ambiente isolado com dados sintéticos, PGlite 0.5.8/socket 0.2.11 e Chromium 153, sem relaxar segurança web. Nenhuma migração nova; 43 migrações aditivas existentes aplicadas. O PGlite não comprova o comportamento concorrente do PostgreSQL nativo.

Preparação local: a primeira ligação PGlite falhou por colisão de prepared statements; configuração de teste passou a desativar a cache de statements. O Chromium 138 perdeu a introdução de texto numa área dinâmica; após atualizar para 153, o grupo completo passou mantendo limites de tempo e reforçando as verificações do texto introduzido e conservado. Estas correções ficaram apenas no ambiente de teste temporário. Não foi contornada nenhuma regra da aplicação.

TASK370 confirmada em 276/276 grupos e TASK371 em 278/278; ambas com restauro nativo de 128 tabelas e 47 ficheiros, linhas e hashes iguais. Evidência em `evidence/20260926_task370_ci.json` e `evidence/20260926_task371_ci.json`.

## Publicação e próximo ponto

Publicado em `cbb552e32f12a704210473359bad56b13a686c98`, árvore `2e48b0523f4b9d5fccbe37cad0035c7c81483a4a`, na branch `work/field-readiness-20260915-simulation`; árvore remota idêntica à preparada localmente. [CI 36217019968](https://github.com/ts7520305-svg/cristalwater/actions/runs/36217019968), job `108334888707`, em execução. Evidência local: `evidence/20260926_task372_local.json`. Runner passa a 280 grupos; o gate nativo e restauro deste lote ainda não estão confirmados. Cache v183. Sem merge, deploy ou contactos externos.

Continuar na atribuição de técnicos a viaturas: `assignTechnicianVehicle` ainda grava técnico, histórico, leitura e auditoria separadamente e ignora falhas. Rever transação, identidade, quilometragem, concorrência com obras abertas e recuperação. Presets e regras de alerta continuam pendentes de revisão. Conciliação histórica, volume real, arquivo/cópias operacionais, VPS e piloto físico permanecem abertos; aplicação não declarada completa.
