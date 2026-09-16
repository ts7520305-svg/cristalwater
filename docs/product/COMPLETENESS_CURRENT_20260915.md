# Cristal Water — matriz atual de conclusão

Atualizada após TASK185 em 16/09/2026. Substitui a fotografia inicial da TASK82 para decidir o próximo trabalho, preservando esse diagnóstico em `COMPLETENESS_20260915.md`. Esta matriz cruza os relatórios posteriores e as rotas atualmente revistas; não constitui auditoria exaustiva de todas as páginas/APIs nem conclusão a 100%.

## Implementação e evidência atual

| Área | Estado demonstrado | Evidência / limite |
|---|---|---|
| Operação do técnico | Percursos de rota, jornada, checklist, consumos, água/bomba, retornos, notas e confirmação de início implementados/testados | TASK123–124, relatórios de retornos e simulação. Telefone e receção persistente de push em campo pendentes. |
| Offline, sessão e concorrência | GPS antigo corrigido; filas por identidade, recuperação de resposta perdida, logout e idioma persistente ensaiados | TASK83, 99, 100, 132; `RESILIENCE_20260915.md`. Não demonstra redundância de servidores ou autonomia real do dispositivo. |
| Equipamentos e stock | Preventivos, recorrência, execução, lembretes, atribuição, contagem e escrita recuperável implementados/testados | TASK106–122 e relatórios de equipamento/inventário. Inventário físico continua externo. |
| Lembretes operacionais/alertas | Consultas completas, prioridade crítica, criação/conclusão/eliminação recuperáveis e resolução vinculada ao estado físico | TASK125–135. Confirmação física é um ato do técnico, não uma conclusão automática dos testes. |
| Orçamentos e contratos | Materiais/MO/margem/IVA, versões, aprovação no portal, conversão e preços por vigência implementados/testados | TASK86–94, 101–102, 148, 153–154; relatórios do portal e ativação. Não usar o antigo diagnóstico “estimativa fixa apenas” como estado atual. |
| Financeiro interno | Emissão interna, cancelamento, notas de crédito, pagamentos, excedentes, crédito e recebimentos com transações/reenvios ensaiados | TASK136–169 e relatórios financeiros. Emissão interna não comprova certificação fiscal nem integração AT. |
| Cobranças agendadas | Preparação mensal de rascunhos e lembretes no portal após vencimento +7 dias, com deduplicação e exclusão de pausas | TASK85 e alinhamentos posteriores dos preços/crédito. Não confundir aviso no portal com email/WhatsApp entregue. |
| Envio de documentos/lembrete manual | Documento autenticado, publicação no chat, preparação e estados verdadeiros de transporte; manual por UUID/canal | TASK160–167 e 174. Fornecedores simulados; canais externos e confirmação final de entrega pendentes. |
| Identidades e acessos | ADMIN ativo nas entradas antigas revistas; atribuição nos chats por recurso; perfil próprio e rota limitada a cada técnico; conversa CLIENT restrita por REST/Socket.IO; anexos novos e históricos com titularidade; destinatários User/Technician separados nas notificações | TASK161–181. Novas rotas ou aliases continuam a exigir revisão própria. Sem revogação de cópias previamente descarregadas. |
| Chat da equipa | APIs consolidadas e armazenamento transacional; ecrã partilhado por técnicos/chefes/ADMIN, rascunho e pedido por conta, confirmação validada e recuperação sem duplicar | TASK177–178; `INTERNAL_CHAT_20260916.md` e `STAFF_CHAT_UI_20260916.md`. Mobile/desktop, cinco idiomas e falhas ensaiados. Reenvio explícito; identidade histórica não presumida. Não demonstra operação prolongada num telefone real. |
| Conversas CLIENT/ADMIN | APIs atuais e aliases antigos usam a conversa persistida; pedido/anexo recuperáveis, leitura partilhada e arquivo integral do JSON com autoria histórica não presumida | TASK182–185; `CLIENT_CHAT_RECOVERY_20260916.md` e `CLIENT_CHAT_CONSOLIDATION_20260916.md`. Concorrência entre processos, importação/reversão e três ecrãs em cinco idiomas ensaiados. Chamadas sem UUID não têm deduplicação; registos não associáveis ficam arquivados. |
| Notificações | Lista completa e prioridade crítica, leitura atómica com confirmação exata, primeira data conservada e lote limitado aos avisos apresentados; estado conservado em falhas nos três ecrãs | TASK179–181; `NOTIFICATION_CONFIRMATION_20260916.md`. Ler não resolve água/bomba. CLIENT usa texto literal e titularidade. Sem ensaio de volume de produção; aliases antigos não migrados conservam contrato próprio. |
| Idiomas/configurações | PT/EN/FR/ES/DE no dicionário e percursos operacionais ensaiados; capacidades fixas são apresentadas como tal | TASK84, 95, 99, 132. Tradução e apresentação de todos os textos/PDFs ainda não auditadas integralmente. |
| Retenção/backup | Pré-visualização e limpeza manual controlada de GPS; monitorização de idade da cópia local; restauro em QA | TASK96–98 e CI. Cópia externa, agendamento e alerta real de falha no VPS pendentes. Não há eliminação automática de histórico crítico. |
| IA e evoluções avançadas | Sugestões e controlos humanos existentes | Aprendizagem validada por piscina, assistente generativo offline e vídeo completo continuam sem evidência de implementação integral. Não declarar estes pontos concluídos. |

## Próximo trabalho no código

1. Garantir pedido persistente/UUID e confirmação exata nos pedidos de visita e avisos de pagamento do portal. São formulários distintos do envio de mensagens já concluído na TASK182–185; conservar a distinção entre aviso de pagamento e recebimento real.
2. Rever individualmente as escritas antigas protegidas na TASK170: ter autenticação não garante atomicidade, versão ou recuperação de reenvio. Priorizar as rotas realmente utilizadas pelos ecrãs.
3. Concluir inventário visual por perfil de páginas, erros, carregamento, vazio, traduções e PDFs. Os ecrãs já ensaiados não equivalem à revisão de todas as páginas.
4. Tratar vídeo, custos reais de rentabilidade e IA offline/aprendizagem como requisitos próprios com critérios verificáveis, reutilizando os módulos existentes.

A prioridade anterior de anexos CLIENT foi concluída na TASK176. Ver `CHAT_ATTACHMENTS_20260915.md` para os limites da proteção histórica e a evidência de conservação do acesso à fotografia de campo.

## Dependências de ambiente

- VPS: instalação, HTTPS, processos/arranque, supervisão, backup externo e restauro operacional.
- iPhone/Android: aplicação instalada, offline prolongado, fotografia, GPS, bateria e push após fechar a aplicação.
- Fornecedores: SMTP/WhatsApp, pagamentos/retornos, reconciliação e fiscalidade; ensaios reais não ocorreram neste lote.
- Carga e redundância: concorrência controlada em QA é evidência funcional, não dimensionamento ou failover de produção.

## Regra de evidência

Base remota TASK171: `90c4d01a7d80f7a0c5aee3cb4de33a13a994d2bf`, árvore `d0b68aebfa750605f26a377367d331e4afec536c`, workflow `35026498860` aprovado com 75 grupos, unitários/navegador e restauro em PostgreSQL 16. TASK172–175 acrescentam quatro grupos; validação local detalhada em `ACCESS_AND_REMINDERS_20260915.md`. A aprovação dessa base não substitui a verificação da árvore nova publicada. Não atribuir percentagem global sem um inventário fechado de critérios de aceitação.

TASK172–175 confirmadas no workflow `35028280336`, commit `05c8632a2d1c7462138b489826cff3baa3d8e15e`: 79 grupos e restauro aprovados. TASK176 confirmada no workflow `35029272245`, commit `14306f306af676bc7bfec321db9adb600b2cb546`: 80 grupos e restauro de 99 tabelas/18 ficheiros aprovados. TASK177 confirmada no workflow `35057153680`, commit `321a8fd84bbd437344495100719c3d64802fb3ed`: 81 grupos, dez migrações e restauro de 101 tabelas/18 ficheiros aprovados.

TASK178–181 confirmadas no workflow `35060119620`, commit `e48b62a818bacb13707cb0496dbd2c94c5040151`: 83 grupos e restauro de 101 tabelas/18 ficheiros aprovados. TASK182–183 acrescentam dois grupos e uma migração aditiva. Sete regressões locais em `field-qa-runtime/run-1789538958038`; revisão final de UI em `run-1789539318979` e repetição final do contrato aprovada em `run-1789539397352`. Publicar e verificar a árvore correspondente com 85 grupos, onze migrações e restauro; não usar o sucesso da base como prova da alteração nova.

TASK182–183 confirmadas no workflow `35064435656`, commit `2c7fced0599f9617b1f5dfdac274abebad53896e`: 85 grupos, onze migrações e restauro de 101 tabelas/21 ficheiros aprovados. TASK184–185 acrescentam dois grupos e a migração aditiva do arquivo CLIENT, com 324 unitários/quatro técnicos e 17 scripts de navegador aprovados localmente. Confirmar a árvore publicada com 87 grupos, doze migrações e restauro; detalhe em `CLIENT_CHAT_CONSOLIDATION_20260916.md`.
