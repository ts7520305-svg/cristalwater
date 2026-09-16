# TASK197 — Gravação e revisão de propostas técnicas

## Falha reproduzida

Em `field-qa-runtime/run-1789564844003`, um trigger PostgreSQL recusou o evento inicial de workflow. A API respondeu 201 e conservou a proposta e a propagação sem o evento obrigatório. O autor devolvido era `FORGED HEADER`, obtido de `x-user-email`. As transições atualizavam a proposta antes de tentar guardar histórico/notificações, sem transação ou bloqueio.

## Correção

- As seis rotas existentes partilham `TechnicalProposalBusiness` e `TechnicalProposalContract`. Não foi criado outro módulo funcional, endpoint alternativo ou tabela.
- Criação e cada decisão gravam proposta, evento encadeado, propagação e notificações obrigatórias numa transação. O bloqueio começa pela piscina, na mesma ordem dos editores existentes. Os eventos/índices opcionais em memória só são emitidos após commit.
- A revisão relê a proposta depois do bloqueio. O ecrã administrativo envia a versão opaca que o revisor viu; uma versão obsoleta recebe 409. Chamadores antigos sem versão mantêm as transições legais, serializadas sobre o estado atual.
- A identidade vem da sessão autenticada. Técnicos e chefes de equipa apenas consultam as próprias propostas de piscinas com visita atribuída não cancelada, ou criadas por eles no intake. A autoria histórica não é deduzida de nomes. ADMIN conserva a revisão global. Preços só podem ser propostos/lidos pela administração.
- A decisão dirigida a um técnico leva o seu identificador de destinatário; propostas antigas sem autoria comprovada geram aviso administrativo. Não há difusão da decisão a todos os técnicos.
- Lotes conservam a semântica de resultado por proposta: cada item confirma ou reverte por inteiro; mesmo uma falha SQL intermédia devolve os resultados anteriores e posteriores. O ecrã conserva os itens falhados selecionados, verifica a resposta completa e impede duplo clique.
- A rotina antiga de apresentação escondia o painel de documentos/propostas mesmo no separador correto. Passa a respeitar os painéis controlados pela navegação de campo; o teste exerce o formulário visível através do botão real de navegação.
- O técnico conserva os campos perante resposta incompleta e só os limpa após confirmação da proposta, piscina, estado, motivo, alterações e fotos. Trocar de sessão/piscina invalida respostas tardias; erros de leitura deixam de ser apresentados como uma lista vazia.
- Campos desconhecidos/repetidos, valores estruturados e ligações de fotos inseguras são recusados. O risco declarado não reduz o risco inferido. A comparação distingue notas gerais, de equipamento e da sala técnica; o valor original, incluindo vazio, fica capturado.
- Histórico e pendências deixam de desaparecer após 500 eventos/100 propostas. As leituras são consistentes e sem cache. O encadeamento verifica hashes e continuidade dos estados. Histórico ausente/incoerente bloqueia novas decisões com 409; não é reconstruído inventando eventos. A cadeia permite verificar integridade, não é uma garantia contra um administrador que reescreva a base de dados inteira.

## Verificação

- O novo grupo `test-field-technical-proposals.js` exercita falhas SQL na criação e nas decisões, isolamento de proprietários/destinatários, campos privados, risco, concorrência entre dois processos, versões, baseline vazio, histórico prolongado, histórico alterado/ausente, lote parcialmente falhado e os formulários reais ADMIN/TECHNICIAN.
- Primeiro ensaio do novo grupo: `run-1789565379972`, aprovado antes de acrescentar os ensaios do formulário técnico e do segundo processo.
- Regressões existentes: `run-1789565544031` aprovou Sprint 4.2, 4.3, 4.4, T1 e recuperação da ficha técnica. Os primeiros ensaios dos scripts antigos não encontravam o Chromium no caminho padrão; corrigida apenas a ligação local para o navegador instalado. Os testes mantiveram todas as asserções.
- Ensaio final completo, incluindo dois processos e os dois formulários reais: `run-1789566035188`, aprovado. Os ensaios intermédios identificaram a ocultação do painel e a necessidade de esperar pela conclusão do refresh do lote antes de verificar a seleção. Nenhuma asserção foi retirada.
- 324 unitários, quatro testes técnicos, 17 scripts de navegador e sintaxe de 529 ficheiros backend aprovados. O runner integrado passa a 99 grupos. Sem migração nova: continuam dezasseis migrações aditivas e 107 tabelas.
- Este relatório antecede a publicação. Confirmar CI completo e restauro na árvore publicada antes de declarar esta etapa verificada.

## Limites e continuação

APPROVED continua a registar uma decisão; não aplica automaticamente os valores à ficha. O ecrã agora explica que os valores devem ser revistos e guardados na ficha técnica. A aplicação vinculada à proposta ainda requer validação tipada, revisão de divergências, versão da ficha e uma confirmação transacional própria.

As propostas ainda não têm pedido persistente com UUID/recibo imutável e recuperação após resposta perdida. O bloqueio de duplo clique e a verificação da resposta não substituem essa garantia. Próximo trabalho: completar esse contrato de recuperação e a aplicação explícita, sem duplicar os editores existentes. A conclusão global, o inventário visual e restantes escritas antigas continuam pendentes. Sem main, deploy, fornecedores reais ou emissão fiscal.
