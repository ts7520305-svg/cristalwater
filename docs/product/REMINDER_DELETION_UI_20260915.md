# TASK130 — Confirmação de eliminação vinculada ao lembrete

## Alteração

A ficha da piscina e o CRM usam a mesma confirmação. O diálogo apresenta o título exato, piscina com identificador e data do lembrete. Texto introduzido pelo utilizador é mostrado como texto, sem tradução ou interpretação de HTML, separado da mensagem da operação. A confirmação destrutiva começa no botão Cancelar; Enter nesse botão cancela.

O ecrã captura o registo e a sessão antes de abrir o diálogo. Cliques repetidos não abrem outra confirmação; ações de conclusão e eliminação no mesmo lembrete ficam coordenadas. Alteração da lista ou da sessão impede o envio tardio. O pedido DELETE inclui o updatedAt apresentado, permitindo à API recusar alterações ocorridas noutra janela enquanto o diálogo esteve aberto.

Só se confirma sucesso após verificar ID, piscina, versão e confirmação da eliminação na resposta. Resposta perdida ou trocada conserva o lembrete visível para uma nova tentativa explícita. A API reconhece o resultado original sem repetir efeitos. Após confirmação válida, o registo desaparece das representações locais, incluindo a lista geral do CRM; uma falha ao reler a lista mantém a mensagem de eliminação confirmada. Respostas de uma sessão anterior não atualizam a lista atual.

Os novos textos têm traduções PT/EN/FR/ES/DE. Sem migração, fila automática de eliminação, instalação no VPS ou alteração de visitas/histórico técnico.

## Verificação

O teste integrado `scripts/test-field-reminder-delete.js` percorre ambos os ecrãs reais em Chromium: título com SQL/HTML literal, piscina exata, cinco idiomas, larguras 320/390/1280, cancelamento pelo teclado, botão antigo retido, clique duplicado, resposta perdida depois do commit e repetição, versão concluída entretanto, lista atualizada durante o diálogo, resposta com outro ID, falha de leitura após confirmação, sessão trocada antes do envio e resposta recebida depois de trocar de sessão.

Ensaio inicial aprovado em `field-qa-runtime/run-1789473531324`. A versão final, incluindo remoção da cópia geral do CRM e resposta tardia após mudança de sessão, passou na bateria `reports/field-suite/1789473623034`.

272 testes unitários e 4 testes de técnicos aprovados antes do commit. Os 17 scripts de navegador e os 36 grupos integrados passaram. A revisão final também verifica a libertação do botão de eliminação após falha de conclusão no CRM; ensaio dirigido em `field-qa-runtime/run-1789473837096`. Confirmar PostgreSQL/restauro no workflow do commit publicado.

## Limites

O comprovativo administrativo conserva a cópia do lembrete eliminado. Não existe uma interface de restauro nesta tarefa. Clientes antigos sem expectedUpdatedAt mantêm compatibilidade, mas não têm a verificação de versão dos ecrãs atualizados. A simulação não substitui ensaios em dispositivos e ligações reais.
