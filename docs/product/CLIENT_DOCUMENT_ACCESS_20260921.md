# TASK273 — Titularidade e leitura segura dos documentos do cliente

## Falhas reproduzidas

O ensaio isolado `run-1789790892945` confirmou HTTP 200 em dois casos indevidos: o novo titular de uma piscina recebia um documento do cliente anterior, e um registo do manifesto com `../` permitia descarregar um ficheiro de ensaio fora da pasta de documentos. A listagem também apresentava esses registos ao novo titular. Nenhum dado de produção foi usado.

## Correção

- As duas rotas existentes do portal delegam no controlador e no novo `ClientDocumentBusiness`. A identificação de ADMIN/CLIENT e a validação de IDs são partilhadas com os relatórios mensais através de `clientReadScope`; a autorização mensal anterior conserva o seu contrato.
- Uma identidade User ou Technician não demonstra a identidade Client, mesmo com IDs coincidentes. ADMIN consulta a seleção indicada; CLIENT/CUSTOMER consulta apenas a própria conta. IDs são canónicos; documentos conservam os IDs baseados em milissegundos, até ao maior inteiro seguro de JavaScript.
- `clientId` e a entidade CLIENT têm de concordar. A visita regular fornece o cliente histórico através de `ServiceVisit.clientId`; referências contraditórias, visita inexistente/sem cliente ou piscina divergente da visita não autorizam o documento. O proprietário atual da piscina nunca amplia o acesso.
- Um registo apenas ligado a uma piscina, sem cliente explícito ou visita histórica comprovada, não demonstra o destinatário. Referências a alertas/reparações ou entidades não suportadas também exigem revisão própria. Estes documentos permanecem guardados e não são reatribuídos nem apagados. O acesso administrativo genérico existente é um percurso separado, não revisto nesta tarefa.
- IDs duplicados e ficheiros referidos por vários registos são ambíguos e ficam excluídos. A lista devolve os campos anteriores, sem expor o nome interno do ficheiro, e substitui URLs livres pelo download autenticado do cliente exato. Não há truncamento a oito documentos na API.
- Caminhos absolutos, travessias, separadores, nomes internos e nomes inválidos são recusados. A abertura usa um descritor sem seguir ligações simbólicas; diretórios, pipes, hardlinks e ficheiros acima do limite existente de upload de 50 MiB são recusados. O envio utiliza esse mesmo descritor, sem reabrir o caminho depois da autorização.
- O manifesto é lido como ficheiro regular, sem seguir ligações simbólicas, com leitura limitada a 16 MiB e sem truncamento silencioso. Um manifesto ausente representa uma instalação sem registos; um manifesto ilegível, inválido ou alterado durante a leitura produz erro 503, não uma lista vazia bem-sucedida.
- Respostas privadas e sem cache, `nosniff` e identidade cliente/documento. Ficheiros são anexos `application/octet-stream`, sem executar HTML/SVG na origem da aplicação. GET e HEAD mantêm autorização igual; pedidos de intervalo não contornam a autorização. Nome de transferência sanitizado, tamanho confirmado e descritores fechados em HEAD, erro ou interrupção.
- Sem migração, alteração de preços/frequência, geração fiscal ou escrita nas fontes durante a consulta. Cache v90 e interface da TASK272 permanecem inalteradas.

## Validação

`run-1789791182694` aprovou a correção dos dois casos iniciais e a regressão de acesso mensal. O ensaio completo foi depois ampliado para titularidade histórica, identidades coincidentes, aliases, IDs grandes, duplicados, ficheiros inseguros, corrupção do manifesto, falha de leitura, substituição do caminho após abertura e interrupção da transferência. A preparação restaura a data da piscina depois da transferência deliberada de QA, mantendo a comparação integral dos dados.

Em 21/09 o ambiente temporário anterior já não estava disponível. Foram repetidos com sucesso 396 testes unitários/63 ficheiros e quatro testes técnicos. A aprovação integral dos 156 grupos e do restauro deverá ser confirmada no CI PostgreSQL 16 do commit publicado; não se usa a aprovação da TASK272 como prova desta alteração.

## Limites e próxima etapa

Esta tarefa corrige a autorização e leitura no servidor. O ecrã dos documentos genéricos ainda usa um link sem cabeçalho Authorization e limita a apresentação a oito entradas: a próxima etapa deve ligar a transferência autenticada e a consulta completa, com identidade, idioma, cancelamento e recuperação por sessão. Não declarar este percurso visual concluído. A consulta mensal da TASK272 continua independente.

Revisão explícita dos registos ambíguos/antigos, agregados mensais ADMIN, seleção de mês no email, instalação no VPS e ensaios físicos continuam separados. A frequência e os valores mantêm-se caso a caso, incluindo três ou mais visitas quando necessário. A emissão fiscal com IVA é feita no programa externo; a aplicação deverá registar o pedido e a confirmação/número da fatura externa, não emitir essa fatura fiscal.

## Ficheiros (10)

1. `src/utils/clientReadScope.js`
2. `src/business/client/ClientMonthlyReportBusiness.js`
3. `src/business/portal/ClientDocumentBusiness.js`
4. `src/services/customerPortalService.js`
5. `src/controllers/clientPortalController.js`
6. `src/routes/clientPortalRoutes.js`
7. `scripts/test-field-client-documents-access.js`
8. `scripts/test-field-suite.js`
9. Este relatório.
10. `docs/product/CURRENT_WORK_CHECKPOINT.md`
