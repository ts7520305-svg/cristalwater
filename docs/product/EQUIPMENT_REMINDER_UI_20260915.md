# TASK113 — Configuração de avisos de manutenção preventiva

A configuração está integrada no módulo de manutenção preventiva das configurações operacionais. Abertura da página faz somente GET de configuração. Ativar/desativar exige alteração da caixa e Guardar; a verificação manual dos vencimentos tem botão separado. Verificar fica indisponível enquanto há alterações por guardar.

O estado da verificação automática é apresentado conforme o servidor, incluindo indicação explícita quando está desligada. O texto distingue avisos internos, push dependente de permissões/configuração e ausência de email/SMS/WhatsApp na verificação manual.

Os controlos ficam bloqueados durante pedidos. O editor de planos não pode desbloquear controlos deste componente. Respostas JSON incompletas ou inválidas não são consideradas sucesso. Após erro o valor visual volta ao último estado confirmado e é exigido GET de atualização antes de outra ação. Após PUT bem sucedido, novo GET confirma o valor efetivo. Pedidos capturam a credencial original e rejeitam resposta após troca de conta; a área é limpa/ocultada.

## Testes

`CW_CHROMIUM_PATH=... node scripts/test-equipment-reminders-browser.js`

PASS com scripts/HTML reais e API simulada: zero escritas/verificações automáticas ao abrir, GET 503 com controlos bloqueados, isolamento do editor de planos, ativação e gravação explícitas, verificação e contagens, resposta não JSON sem falso sucesso, reversão visual e atualização obrigatória, resposta PUT atrasada após troca de conta, larguras 320/390/1280. Testes de autorização, scheduler e entrega real são realizados separadamente no backend/servidor.
