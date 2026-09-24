# TASK330 — Verificação do preço original por visita

Preparação da cobrança por visita: a origem financeira exige a versão exata do acordo, a confirmação administrativa recuperável, o cliente original, o horário acordado e o preço confirmado. A visita transporta a identificação do acordo e da época; o objeto de proveniência técnica não contém valores monetários.

A verificação inclui exceções datadas da TASK328: o horário e o motivo têm de corresponder à exceção original e pode tratar-se de uma instalação sem calendário recorrente nessa época. Alterações de preço, origem, atribuição original ou recibo exigem revisão. Uma atribuição posterior do técnico não reescreve o preço original. Visitas incluídas na mensalidade continuam fora da cobrança unitária.

O serviço contém operações partilhadas para selecionar visitas concluídas pelo mês UTC de conclusão, verificar reservas documentais, confirmar a marcação de cobrança e validar linhas manuais. A integração nos cinco percursos financeiros e no editor é a tarefa seguinte; esta preparação não disponibiliza por si só o novo modo ao utilizador.

Seis testes determinísticos verificam origem/valor, adulterações e confirmações duplicadas, pertença e horário, exceções, mensalidades e ausência de valores na proveniência. A aprovação completa do novo modo depende ainda dos ensaios integrados e de navegador da integração.
