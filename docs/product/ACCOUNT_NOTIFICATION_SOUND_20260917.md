# TASK228 — Som de notificações ligado à conta atual

## Reprodução

O editor antigo `/config-notifications` era exclusivo de CLIENT e escrevia cinco chaves globais `sound_*`. O consumidor dessa preferência era `/notifications`, exclusivo de ADMIN. O ensaio histórico do commit `bc5e4e35efccf89c9bb085a2ff5749ecb82c4e62` confirmou som permitido após recusa da consulta de preferências: `sound_CHAT=true`, sem dono, era atribuído ao administrador seguinte no navegador. O outro ecrã administrativo tocava um ficheiro externo sem consultar a preferência.

## Comportamento implementado

- A entrada antiga, com ou sem `.html`, encaminha para `/settings`. O destino continua a validar sessão e titularidade User. CLIENT/PIN mantêm a indisponibilidade explícita. Não são criadas preferências desses perfis nem se alarga a API.
- Os bytes das antigas chaves ficam preservados. Nenhum consumidor frontend lê ou escreve `sound_*`; não se atribuem esses valores a uma conta por suposição.
- Os dois ecrãs administrativos usam o mesmo controlo: Ativar/Desativar som nesta página, Testar som e ligação às preferências. O áudio precisa de um gesto explícito e fica limitado à página aberta; recarregar não reativa automaticamente o som.
- Cada aviso elegível consulta a preferência atual da própria conta pela API, sem fallback local. Ausência, falso, recusa, falha, HTTP 202 ou resposta incoerente deixam o aviso sem som. Leituras simultâneas da mesma ativação partilham a consulta; uma ativação nova não herda uma resposta antiga.
- Conta/payload/papel/expiração e aliases da credencial têm de concordar. Troca de conta fecha o áudio, desativa controlos e ignora respostas atrasadas. Os consumidores também recusam eventos antigos antes de mostrar listas/toasts. Não são apagadas filas, fotografias ou documentos.
- Evento repetido não volta a tocar. IDs numéricos identificam um aviso; IDs antigos `chat-<cliente>` identificam uma conversa e incluem a data para distinguir mensagens. A lista antiga substitui a entrada da conversa quando chega uma mensagem nova, conservando a deduplicação de avisos normais.
- O sinal sonoro é gerado localmente, sem descarregar áudio externo. Bloqueio/suspensão do navegador tem estado visível e permite nova ativação. O botão de teste é explícito e não grava preferências.
- Controlos e estados têm PT/EN/ES/FR/DE e cabem em 320/390/1440 px. Service worker v56. Sem migração ou endpoint novo.

## Categorias

| Evento | Preferência usada |
|---|---|
| ARRIVAL, PAYMENT, DEBT, CHAT, REMINDER | A mesma categoria |
| CHAT_MESSAGE | CHAT |
| PAYMENT_CONFIRMED, PAYMENT_CONFIRMATION, REPAIR_PAYMENT_RECORDED | PAYMENT |
| OVERDUE_PAYMENT | DEBT |
| PAYMENT_REMINDER, AI_REMINDER | REMINDER |
| Outros tipos | Sem som neste controlo |

## Evidência

| Ensaio | Resultado e limite |
|---|---|
| Reprodução histórica | `CW_SOUND_BASELINE_SHA=bc5e4e35efccf89c9bb085a2ff5749ecb82c4e62 node scripts/test-notification-sound-browser.js`: preferência global sem dono foi indevidamente aplicada |
| Navegador com respostas/áudio controlados | Os dois HTML reais: ativação, teste explícito, preferências atuais, ausência/desativação, falhas/recusas, aliases, duplicados, duas mensagens da mesma conversa, troca de ativação/conta e bloqueio/suspensão do áudio aprovados; cinco idiomas/três larguras |
| Alias por perfil | Quatro perfis, duas formas do URL, sem gravação de preferências e com sessão/trabalho/valores antigos preservados |
| API/base/Chromium reais | `run-1789648885611`: os dois ecrãs consultam preferência User desativada/ativada pela API, usam AudioContext real após clique e recusam som repetido; grupo de notificações existente continua aprovado |
| Campo real | Mesmo ensaio: TEAM_LEADER entra pelo alias, vê indisponibilidade PIN e conserva sessão/rascunho; login email, preferências User, ajuda e recuperação offline aprovados |
| Primeira execução local | `run-1789648800116`: notificações aprovadas; TEAM_LEADER excedeu 10 s ao esperar pelo controlador do service worker, antes de chegar ao alias. Repetição final passou sem alterar essa espera nem retirar a asserção offline. Não contar a primeira execução como aprovação |
| Regressão local | 388 unitários/quatro técnicos, 20 scripts de navegador e sintaxe de 539 ficheiros aprovados; ensaio dirigido repetido após proteger suspensão e discordância do alias da credencial |
| CI/restauro | Publicar e confirmar a árvore final com 124 grupos, 20 scripts de navegador, 20 migrações e restauro |

Os testes de API usam contexto de áudio real em Chromium sem interface; não demonstram que um dispositivo físico foi ouvido. O teste controlado conta a tentativa de geração do som. Nenhum destes ensaios comprova push com a aplicação fechada, entrega por fornecedor, permissões/bateria de iPhone/Android ou preferências próprias CLIENT/PIN.

O inventário tem 101 HTML, 46 páginas com referências literais em 144 scripts, zero recursos locais em falta e zero divergências catálogo/guarda detetadas. O alias é identificado como encaminhamento com autorização no destino. Estes números não equivalem à revisão visual/funcional integral das páginas.
