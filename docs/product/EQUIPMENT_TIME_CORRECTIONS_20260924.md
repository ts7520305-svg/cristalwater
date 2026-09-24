# TASK321 — Correção administrativa dos tempos de equipamento

Base publicada: `0e7da4846d9d97cd0d7a88ff9382fa3bdf24b028`, fecho TASK320 aprovado no CI e restauro. Lote de 20 ficheiros.

## Resultado

A administração pode corrigir, completar ou anular a declaração de tempo de uma revisão de equipamento. Cada alteração tem autor, data, motivo, contexto revisto e comprovativo próprio. A conclusão técnica, a sua resposta original, os materiais, a visita e os registos financeiros existentes são conservados.

O editor mostra o original, a declaração atual, os intervalos propostos e as parcelas de custo afetadas antes da confirmação. Aceita até 20 intervalos UTC com precisão de milissegundos e exclui as pausas. O histórico apresenta cada declaração e respetivo motivo. A página fica acessível pela gestão de manutenções e pela seleção de parcelas em Despesas.

## Origem, reservas e histórico

- O comprovativo técnico original e a decisão comercial têm de ser verificáveis. O cliente, piscina, tipo de visita e técnico histórico têm de coincidir com a origem. Reatribuir a visita não transfere automaticamente o trabalho para outro técnico.
- Completar uma revisão originalmente sem tempos exige uma origem técnica verificável, pelo titular técnico do recibo ou pela origem preservada noutro recurso. Um recibo administrativo antigo sem prova do técnico executante não é suficiente. Esses casos continuam a exigir revisão histórica própria.
- Os intervalos ficam dentro da visita e antes da conclusão original da revisão. Sobreposições com outras revisões, lembretes associados ou serviços do técnico são recusadas. Retirar uma declaração liberta os seus intervalos, conservando o motivo e o original; não equivale a confirmar duração zero.
- O histórico reutiliza o mesmo verificador de cadeia das correções de materiais, parametrizado pelo recurso. Uma alteração do original, do recibo ou da sequência torna o estado indisponível para novas confirmações. Não se escolhe silenciosamente a última linha de um histórico danificado.
- Leituras de campo, reservas dos lembretes e valorização usam a declaração efetiva. O técnico vê que houve uma revisão administrativa e mantém acesso ao tempo original.

## Custos e concorrência

As parcelas ativas desta revisão são apresentadas com o montante e a duração originais. Depois da alteração, ficam assinaladas para revisão e continuam a reservar os seus cêntimos e duração. A administração anula a parcela antiga em Despesas e confirma uma nova parcela com a declaração corrigida.

A nova prova financeira de versão 5 inclui o comprovativo da revisão administrativa. O servidor e o navegador verificam a identidade da revisão, o autor, motivo, data, intervalos e vínculo ao registo valorizado. As provas anteriores de equipamento e lembretes mantêm o seu formato. Mesmo regressar às horas iniciais conserva a identidade da correção e exige rever uma parcela baseada numa declaração anterior.

O bloqueio por visita é partilhado pelas correções e pela criação/anulação de parcelas. Dois pedidos concorrentes com o mesmo identificador recebem a mesma resposta; propostas diferentes ou uma corrida entre correção e valorização conservam um resultado aprovado e recusam o cálculo desatualizado. O recibo, histórico técnico e auditoria são atómicos.

## Interface e recuperação

O editor de materiais e de tempos partilha sessão, rascunho, confirmação e recuperação, mantendo campos e armazenamentos próprios. As alterações locais repõem a confirmação. A página de tempos usa datas/horas UTC com milissegundos, rascunhos após recarga e proteção contra troca de conta. A memória genérica do formulário não repõe consentimentos deste editor.

Uma resposta perdida conserva o pedido e permite recuperar o resultado por consulta, sem novo POST. Propostas adulteradas e provas financeiras com hashes recalculados mas dados incompatíveis são recusadas. O contraste dos campos no modo escuro foi revisto; a navegação identifica a página em português.

## Validação local

- 513 testes unitários em 74 ficheiros e quatro testes técnicos; sintaxe 617 backend / 216 frontend / 62 scripts inline.
- Novo grupo integrado com API e dois processos HTTP: permissões, intervalos inválidos, sobreposições, original intacto, completamento de tempo em falta com origem técnica, proteção contra reatribuição, histórico/recibo danificados, recuperação exata, anulação, propostas concorrentes, concorrência financeira e rollback de recibo/histórico/auditoria.
- Caso financeiro de 100 cêntimos/12 segundos: parcela original de 8 cêntimos por um segundo; correção para 250 milissegundos; saldo antigo conservado até à anulação; nova parcela de 2 cêntimos vinculada à prova administrativa. Nova correção assinala essa parcela sem a reescrever. O comprovativo técnico original continua recuperável.
- Navegador real: prova financeira administrativa, adulteração semântica com hashes recalculados, rascunho após recarga, adicionar/remover intervalos, custos afetados, confirmação dupla, resposta perdida e recuperação por consulta, limpeza de sessão, larguras 320/390/1440 e modo escuro. Capturas inspecionadas.
- Cinco regressões dirigidas: tempo de equipamento, múltiplos intervalos, correção de materiais no editor partilhado, repartição financeira do trabalho e intervalos dos lembretes associados.
Código publicado `ad8c81a0299fd3f672c627a690727f6963af751a`, árvore `b53867b93f8a0dd8a9bf653393ee81d658546aa3`, igual à validada localmente. [CI 36024090516](https://github.com/ts7520305-svg/cristalwater/actions/runs/36024090516), job `107716065271`, aprovado entre 2026-09-24T15:58:45Z e 2026-09-24T16:30:43Z (31m58s): 17 etapas, 224/224 grupos previstos distintos, sem falhas, faltas, entradas inesperadas ou duplicações; 513 unitários/74 ficheiros, quatro técnicos, gate geral de navegador, sintaxe 617/216/62 e 39 migrações. Restauro PostgreSQL 16 de 127 tabelas/46 ficheiros, com linhas e hashes iguais. Evidência [evidence/20260924_task321_ci.json](evidence/20260924_task321_ci.json). Cache v136, sem novas migrações/tabelas/dependências. O fecho posterior altera apenas documentação; a aprovação refere-se ao código e árvore acima.

## Limites e continuação

Não atribui autoria técnica a registos históricos sem prova, altera a conclusão original nem muda automaticamente o valor de uma despesa. A repartição continua limitada ao mesmo mês UTC; divisão entre meses e reconciliação histórica sem comprovativo verificável permanecem abertas. Receita/custo integrais, lucro, produção, fornecedores reais e piloto físico continuam por concluir.
