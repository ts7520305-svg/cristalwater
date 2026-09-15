# TASK124 — Instruções completas antes de iniciar a visita

As notas da piscina passam a aparecer no cartão existente de acesso/instruções e no aviso da piscina selecionada. O texto conserva parágrafos e é apresentado como texto, sem interpretar HTML nem traduzir automaticamente o conteúdo escrito pelo administrador. Os lembretes concluídos também são excluídos defensivamente no navegador.

A repetição deixa de ser confundida com uma nota permanente: um lembrete recorrente vencido aparece como atrasado. Escrever «permanente» no título não altera o estado nem oculta o atraso. Lembretes pontuais futuros continuam distintos. As notas fixas da piscina permanecem até edição; ultrapassar o vencimento não resolve nem elimina uma tarefa.

A confirmação de início deixa de cortar a informação aos 700 caracteres. Mostra as notas e cada aviso em blocos legíveis, com deslocação vertical em ecrãs pequenos. Cancelar não inicia a visita. O retrato revisto inclui a sessão, visita/tipo/piscina e instruções; mudar qualquer desses elementos invalida a confirmação aberta. Uma confirmação tardia, repetida ou com o botão de início desativado não desencadeia outro início. A confirmação continua a ser uma revisão no dispositivo; o resultado do início depende da resposta e das regras já existentes no servidor.

Foi corrigida uma falha adicional: a interceção do botão dependia do rótulo português «Iniciar visita». Agora o modo de campo fornece o estado operacional e o destino ao controlo de confirmação, independentemente do texto traduzido. As etiquetas novas e os textos da confirmação têm traduções EN/FR/ES/DE, mantendo PT. Notas, nomes e títulos de lembretes não são alterados pelo tradutor. A cobertura linguística integral de todos os textos antigos continua fora deste lote.

## Testes

- Sete cenários de navegador: texto longo/seguro e larguras 320/390/1280, cancelamento, troca de visita, instruções alteradas, troca de sessão, visitas regular/extra com o mesmo ID numérico e início desativado. Exige uma única ação após confirmação explícita.
- `test-field-visit-briefing.js` usa páginas e APIs reais de QA: notas iguais às da piscina, HTML literal, lembrete recorrente atrasado, palavra «permanente» sem efeito no estado, exclusão de concluído, instrução final além de 700 caracteres, cancelamento sem escrita e início confirmado na base de dados. Verifica atualização das notas e confirmação obrigatória em PT/EN/FR/ES/DE. Captura o ecrã móvel em `reports/field-visual/visit-briefing-<timestamp>/`.
- O novo teste de navegador integra `npm run test:field-browser` (17 scripts); o percurso real integra a bateria de 33 grupos. As contagens finais e o workflow de PostgreSQL 16/restauro são verificados no commit entregue.

## Ficheiros e limites

Ficheiros: `frontend/technician-field-mode.js`, `frontend/crystal-os-v2-shell.js`, `frontend/cw-i18n.js`, `scripts/test-field-briefing-browser.js`, `scripts/test-field-visit-briefing.js`, `package.json`, este relatório e `CURRENT_WORK_CHECKPOINT.md`.

Sem migrações, novos módulos de navegação ou envios externos. O teste é simulação em navegador; ensaio físico e VPS continuam pendentes. Esta tarefa não altera a semântica das filas antigas nem implementa expiração automática de notas ou prova auditável de leitura humana. Conteúdo guardado offline continua sujeito à atualização da rota quando existe ligação.

Validação local final: 218 testes unitários em 50 ficheiros, 4 testes de técnicos, 17 scripts de navegador e 33 grupos integrados aprovados. Sintaxe aprovada em 485 ficheiros backend e nos JavaScript alterados. Evidência: `reports/field-suite/1789468180539/results.json`; imagem do percurso real: `reports/field-visual/visit-briefing-1789468325934/technician-briefing-mobile.png`. Base PGlite descartável; o workflow do commit final confirma separadamente PostgreSQL 16/migrações/restauro.
