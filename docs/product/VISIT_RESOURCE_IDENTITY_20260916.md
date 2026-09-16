# Identidade da visita e início autorizado — TASK210

## Falha reproduzida

ServiceVisit e ExtraVisit têm sequências independentes. A lista de campo distinguia REGULAR/EXTRA, mas os botões, rascunhos, fotografias e seleções usavam apenas o número. Com documentação válida e duas piscinas distintas, iniciar a visita EXTRA alterou a ServiceVisit com o mesmo ID para EM_EXECUCAO, deixando a ExtraVisit por iniciar. Reprodução em `run-1789591462478`. O primeiro ensaio foi corrigido porque a documentação em falta bloqueava o botão antes de chegar à falha; esse primeiro resultado não foi usado como prova da correção.

A rota `/api/operational-state/visits/:visitId/state` também aceitava o estado e a autoria fornecidos pelo cliente sem validar o técnico atribuído. O corpo podia substituir o ID da URL e encerrar/reabrir visitas fora do fluxo de conclusão.

## Correção

O início passa pelo negócio comum de visitas, com bloqueio da linha, técnico autenticado, estado elegível e verificação opcional do tipo/piscina. A URL determina o ID; o corpo não o pode substituir. Uma ExtraVisit explícita é recusada nesta API de ServiceVisit. Repetir o início conserva a primeira hora e não duplica o histórico. A autoria do histórico vem da sessão e a sua gravação pertence à mesma transação do início; notas existentes são conservadas.

A rota genérica conserva o início e a deslocação autorizados; regressar ao estado agendado exige ADMIN e uma visita ainda não iniciada. Conclusão e impedimento exigem os respetivos percursos próprios, em vez de alterar apenas o estado por este alias. Visitas terminadas/retiradas não podem ser reabertas por aqui. As respostas da rota são privadas, sem cache partilhada.

O modo de campo conserva visitas extra na lista, nas instruções, no mapa e na revisão do dia. Os campos e ações de execução ficam em consulta, com explicação e indicação para combinar o registo com o escritório. Início, conclusão/correção, fotografias, ocorrências, consumos associados, água, bomba e impedimento não podem usar uma ExtraVisit como ServiceVisit. O painel de manutenção de equipamento não recebe o ID regular errado.

Seleção, retoma, mapa e retorno usam tipo + ID. A câmara recusa um ficheiro escolhido depois de mudar para uma visita de outro tipo com o mesmo número. Respostas atrasadas de início/conclusão atualizam apenas a visita original, sem substituir a seleção ou os campos da visita seguinte; a mensagem identifica a piscina confirmada. O início valida ID, piscina, técnico, estado e hora antes de atualizar a cache. A revisão do dia mantém a visita extra pendente mesmo existindo uma conclusão regular com o mesmo número.

Os novos rascunhos modernos usam `cwFieldVisitDrafts:v2:<identidade autenticada>` e `visit-REGULAR-<id>`. Os anteriores, que não comprovam conta/tipo, permanecem intactos e são assinalados para revisão, sem importação automática. JSON ilegível ou com outra identidade não é substituído nem submetido como formulário vazio. Esta alteração não acrescenta ainda comparação de versões por campo entre janelas.

## Evidência

- `run-1789592386226`: novo grupo API/base/Chromium aprovado, com oito inícios simultâneos, autoria falsificada, outra atribuição, tipo/piscina errados, prevalência da URL, tentativa de encerrar/reabrir e falha forçada na gravação do histórico com rollback.
- Na mesma execução: handlers reais com EXTRA/REGULAR de mesmo ID, controles em consulta, fotografia escolhida após trocar o tipo, rascunhos antigos/corrompidos/de outra identidade preservados, retoma completamente offline, navegação ao mapa e retorno ao tipo correto, confirmação de início incompatível e respostas reais atrasadas de início/conclusão.
- Briefing real em cinco idiomas, E2E dos três perfis e Route OS aprovados na mesma execução. Rota moderna, recuperação de fotografias/conclusões e T1 aprovados em `run-1789592001087`.
- 388 testes unitários, 17 scripts de navegador e sintaxe de 533 ficheiros backend aprovados. O teste de mapa foi ampliado e revalidado depois: destino EXTRA correto, retorno tipado e número ambíguo sem navegação para outra piscina. Larguras 320/390/1440 px e `reports/field-ui/EXTRA_VISIT_READ_ONLY.png` inspecionadas.
- Runner ampliado para 113 grupos, sem migração nova. Confirmar CI/restauro da árvore publicada; o sucesso das TASK208–209 não substitui essa confirmação.

## Trabalho ainda aberto

ExtraVisit não tem um registo completo próprio de execução, medições, fotografias e consumos no modelo atual. Esta tarefa impede escritas na visita errada; não declara esse fluxo implementado. A execução extra completa exige um contrato próprio e ligação consistente aos efeitos comerciais existentes, com testes de repetição e ausência de dupla cobrança. Não foram criadas ServiceVisits artificiais nem copiados dados entre piscinas.

Dados históricos eventualmente gravados na visita errada não podem ser reatribuídos apenas por coincidência de IDs; exigem evidência e revisão própria. Ações antigas de clientes que omitem tipo/piscina continuam a designar uma ServiceVisit pelo contrato da rota. O início offline existente é apenas local até confirmação posterior; não foi criado um comprovativo imutável de cada comando de início. Permanecem a revisão de concorrência dos rascunhos modernos, outras filas antigas, entrada TEAM_LEADER, cobertura integral de traduções e ensaios físicos. Sem main, deploy ou serviços externos reais.
