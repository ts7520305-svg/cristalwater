# TASK329 — Cópia SQL agendada e estado de falhas

O comando `node scripts/run-scheduled-backup.js` exige `SCHEDULED_BACKUP_ENABLED=true`. Executa a cópia local existente, confirma um ficheiro SQL regular, não vazio e na pasta configurada, calcula SHA-256 e guarda o resultado por escrita atómica, com permissões 0600. Uma exportação JSON de recurso fica conservada mas é sinalizada como falha do objetivo SQL. Erros não incluem credenciais, comandos ou mensagens do fornecedor no novo registo.

Um bloqueio por diretório impede duas execuções simultâneas. Falha, execução em curso, interrupção e resultado ilegível aparecem na verificação de backups do painel administrativo, mesmo quando há um SQL anterior recente. Um processo terminado à força pode deixar o bloqueio: a recuperação exige confirmar que já não existe processo ativo antes de o remover. O sistema não apaga esse bloqueio automaticamente nem elimina cópias antigas.

## Preparação do VPS

Os ficheiros em `deploy/systemd/` são modelos, não foram instalados ou ativados no servidor. Pressupõem o utilizador/grupo `cristalwater`, Node disponível no PATH do serviço e a estrutura `/opt/cristalwater/current` e `/opt/cristalwater/shared`. Rever estes caminhos antes da instalação.

1. Preparar `/opt/cristalwater/shared/backups`, pertencente ao utilizador do serviço e com modo 0700. Manter o `.env` protegido e incluir `BACKUP_DIRECTORY=/opt/cristalwater/shared/backups` tanto no backend como no serviço. Verificar que o `.env` da release usa essa configuração; o carregador existente pode prevalecer sobre variáveis do processo.
2. Instalar PostgreSQL 16 client e confirmar acesso de leitura para `pg_dump`, incluindo os certificados configurados. O serviço usa o mesmo ambiente da aplicação; não copiar credenciais para estes modelos.
3. Copiar os dois modelos para `/etc/systemd/system/`, executar `systemctl daemon-reload` e ensaiar `systemctl start cristalwater-backup.service`. Conferir `systemctl status` e `journalctl -u cristalwater-backup.service`, o resultado protegido e o ficheiro SQL.
4. Só após o ensaio e uma prova de restauro isolado, ativar `systemctl enable --now cristalwater-backup.timer`. A agenda é diária às 03:30 de Lisboa, com atraso aleatório até dez minutos; uma execução perdida é recuperada no próximo arranque. Um serviço tem limite de dez minutos; após quinze minutos sem conclusão, o painel indica interrupção.
5. Confirmar o resultado no painel «Proteção de dados». Uma falha requer inspeção; a indicação no painel não equivale a um email ou push entregue ao responsável.

## Validação e limites

563 testes unitários/77 ficheiros, quatro técnicos e sintaxe 621 backend / 217 frontend / 62 scripts inline aprovados. Quatro novos ensaios verificam sucesso/ficheiro/hash/permissões, erro sem credenciais apesar de SQL anterior recente, exportação de recurso/saídas inválidas e exclusão concorrente/estado interrompido. O comando desligado devolve `NOT_ENABLED` e código 2, sem iniciar backup. Os modelos passaram `systemd-analyze verify`; foi usada resolução de Node por `/usr/bin/env` para não depender de um caminho de binário ausente neste ambiente.

Esta entrega cobre apenas a base de dados local e a preparação do agendamento. Não inclui uploads, cópia externa, entrega de alertas a fornecedores, instalação no VPS ou restauro operacional real. O painel mantém essas coberturas como não verificadas.

CI completo aprovado para `fa1230f9ddd39031eb3476dc0a56a39560dd5ffb`, árvore `0fe31a9abfc584f5bcabce24c643ad76cebd11e2`: [36040579488](https://github.com/ts7520305-svg/cristalwater/actions/runs/36040579488), job `107771457529`, 17 etapas e 229 grupos distintos sem falhas, 563 unitários/quatro técnicos. Restauro isolado PostgreSQL 16 de 127 tabelas/46 ficheiros com linhas e hashes iguais, concluído às 18:49:51Z de 24/09/2026. [Evidência](evidence/20260924_task329_ci.json). Este restauro da suíte não equivale à ativação da cópia agendada no VPS nem altera os limites de cobertura acima.
