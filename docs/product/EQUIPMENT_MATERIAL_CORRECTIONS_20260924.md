# TASK311 — correção de declarações de materiais de equipamento

## Resultado

A administração pode corrigir/completar os materiais de uma revisão de equipamento, confirmar explicitamente que não usou materiais ou anular a declaração. O acesso parte da cobrança das manutenções e dos candidatos à repartição de materiais em Despesas. O ecrã identifica revisão, visita regular/extra, cliente, piscina e técnico; apresenta lado a lado o original e a declaração atual e conserva o histórico de alterações.

A anulação produz `WITHDRAWN`: os materiais ficam por confirmar. Não equivale a `NONE`, nem transforma um registo em falta (`MISSING`) em custo zero. Uma declaração anulada pode ser substituída por nova declaração explícita. Uma proposta igual à declaração atual é recusada. Produtos/unidades usam a normalização de stock existente e quantidades positivas até 100000, com seis casas decimais, até vinte linhas distintas.

## Origem, histórico e concorrência

- A correção exige recibo técnico original íntegro, execução e decisão comercial históricas confirmadas, cliente/piscina/visita tipada compatíveis e técnico identificado. Pode completar uma revisão moderna cujo recibo não declarou materiais. Registos antigos sem recibo verificável e fontes adulteradas permanecem bloqueados para revisão histórica própria; não se inventa um recibo técnico retroativo.
- A declaração posterior tem autor administrativo e data próprios. O `EquipmentMaintenanceCompletion.result`, notas, tempos, versão, recibo e decisão comercial originais não são reescritos. O original é recuperável mesmo depois de correções, anulação ou alteração posterior das fontes.
- O diário usa `FieldWriteRequest`, âmbito `EQUIPMENT_MATERIAL_REVIEW`, com UUID por conta, envelope, prévia, cadeia de hashes, original, proposta, motivo, autor e recibo. A confirmação, `TechnicalHistory` e `UserAuditLog` são atómicos. Uma falha em qualquer gravação não deixa uma alteração parcial.
- A prévia compara a declaração anterior/proposta e mostra todas as parcelas ativas de materiais desta visita, incluindo revisões irmãs e compras diferentes. A confirmação recalcula origens, consumos, cadeia e parcelas. Mudanças exigem nova prévia; a recusa fica recuperável no mesmo pedido.
- Correções e repartições TASK310 usam o mesmo bloqueio por visita tipada, além dos bloqueios das fontes. Duas correções, ou uma correção concorrente com uma parcela, não podem confirmar simultaneamente prévias incompatíveis. REGULAR e EXTRA com o mesmo número permanecem independentes.

## Efeito nas quantidades e custos

As leituras no campo e nas despesas usam a declaração administrativa atual sem modificar o original. A soma conjunta das revisões é novamente conferida contra o consumo líquido da visita. Uma declaração incompatível pode ser conservada explicitamente como `REVIEW`, com aviso antes da confirmação; não permite confirmar novas parcelas de custo.

A identidade da revisão entra nas provas do consumo. Uma correção/anulação assinala para revisão as parcelas MATERIAL ativas da visita, incluindo as de outras compras/revisões que partilham essa origem. Restaurar mais tarde a quantidade original não apaga as alterações intermédias nem revalida silenciosamente as parcelas antigas. O diário e as reservas originais ficam conservados; a administração deve rever/anular essas parcelas em Despesas. A anulação continua possível com o histórico de despesas íntegro.

Não cria movimento de stock, valorização de compra, despesa ou pagamento. Os tempos e parcelas LABOR permanecem intactos, tal como a decisão comercial e as receitas. Não resolve as repartições entre meses nem fornece cobertura completa dos custos, das receitas ou do lucro.

## Navegador

O formulário começa na declaração atual. Quantidades com vírgula e motivo ficam em rascunho por conta/revisão; uma edição preserva o rascunho e invalida a prévia. O pedido exato é gravado em IndexedDB antes do envio, protegido entre janelas, e o recibo é verificado pelo mesmo contrato usado no servidor. Resposta perdida ou alterada conserva o pedido; consulta ou reenvio recuperam o resultado original sem duplicar alterações. A limpeza do rascunho compara o conteúdo confirmado. Mudança transitória de conta, sessão expirada, modo offline e respostas atrasadas não permitem confirmar um contexto anterior.

Ecrã e navegação em português, nomes renderizados como texto, apresentação a 320/390/1440 px sem transbordo horizontal e estilos claro/escuro. Cache v126. A validação local do navegador utiliza Chromium; não substitui o piloto físico iPhone/Android.

## Validação e publicação

Base `43d15160583e5d709f30ceeb4bf5ed68f5e71aae`, fecho documental TASK310. Doze testes unitários novos verificam o contrato partilhado, materiais inválidos, prévias/recibos adulterados, cadeia interrompida ou divergente, original alterado, soma das revisões, anulação distinta de zero, ausência de revalidação silenciosa e falha de leitura. Passaram 449 testes/68 ficheiros; sintaxe 608 backend, 206 frontend e 62 scripts inline.

O grupo `test-field-equipment-material-review.js` usa dois processos de API, base isolada e navegador. Confere permissões, outra conta administrativa real, correção/NONE/WITHDRAWN/MISSING, limites e prévias obsoletas, recusas recuperáveis, fontes alteradas, conservação dos registos e das parcelas de trabalho, revisão conjunta dos custos de materiais entre compras, concorrência entre correções e com repartições, recuperação do recibo técnico original e rollback de recibo/auditoria/histórico. No navegador verifica rascunhos e recarregamento, adulteração de prévia/recibo, duplo clique, reenvio idêntico, perda de resposta com recuperação por consulta, resposta atrasada após edição, conflito de prévia, offline, mudança de conta e layout.

Regressões dirigidas aprovadas: materiais próprios TASK309, repartição MATERIAL TASK310 e repartição LABOR TASK308, incluindo os respetivos percursos reais no navegador. Ensaios locais usam PostgreSQL embebido em ambiente isolado. O runner passa a 214 grupos; mantém 35 migrações e 126 tabelas, sem dependências novas. Não há aprovação de volume ou de operação prolongada nesta entrega.

## CI completo e restauro aprovados

Código publicado `e63042c048871efeb95960bdc948374f3ffa3c44`, árvore `963c75d2590d2699a1f780945145e404c8c24dba`, igual à árvore local validada. [CI 35964582290](https://github.com/ts7520305-svg/cristalwater/actions/runs/35964582290), job `107520238558`, concluído com sucesso entre 2026-09-24T06:27:35Z e 2026-09-24T06:54:38Z (27m03s). As 17 etapas passaram, incluindo 214/214 grupos previstos distintos, 449 testes unitários/68 ficheiros, quatro testes técnicos, gate geral de navegador, sintaxe 608/206/62 e 35 migrações aditivas com preservação e comparação do esquema. O novo grupo passou em 8109 ms.

O restauro PostgreSQL 16 confirmou 126 tabelas e 46 ficheiros enviados, com igualdade das linhas da base de dados e dos hashes dos ficheiros. [Evidência verificável](evidence/20260924_task311_ci.json), incluindo inventário dos grupos, etapas e hash do log. A branch principal mantém `6f27081e1d183ff584a62255b016b373836734db`. O fecho documental posterior não muda o código aprovado. Deploy, fornecedores reais, volume e piloto físico permanecem fora desta aprovação.

Publicar apenas em `work/field-readiness-20260915-simulation`. Principal `feature/technicians-v25` conservada em `6f27081e1d183ff584a62255b016b373836734db`; sem merge, deploy, alterações destrutivas de produção ou contactos reais.

## Continuação

CI/restauro confirmados. Prosseguir com TASK312: origens próprias de materiais e tempos para os lembretes de serviço, com declaração explícita, execução/cliente confirmados e histórico recuperável, sem copiar o consumo ou a duração de outra intervenção. A repartição entre meses, restantes custos/receitas, históricos antigos, inventário dos ecrãs/PDFs/idiomas, volume, operação real e piloto físico permanecem na matriz. O utilizador pediu continuar até fechar os requisitos implementáveis, sem parar depois de cada tarefa.
