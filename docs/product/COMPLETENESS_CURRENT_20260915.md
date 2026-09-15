# Cristal Water — matriz atual de conclusão

Atualizada após TASK175 em 15/09/2026. Substitui a fotografia inicial da TASK82 para decidir o próximo trabalho, preservando esse diagnóstico em `COMPLETENESS_20260915.md`. Esta matriz cruza os relatórios posteriores e as rotas atualmente revistas; não constitui auditoria exaustiva de todas as páginas/APIs nem conclusão a 100%.

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
| Identidades e acessos | ADMIN ativo nas entradas antigas revistas; atribuição nos chats por recurso; perfil próprio e rota limitada a cada técnico; conversa CLIENT restrita por REST/Socket.IO | TASK161–175. Novas rotas ou aliases continuam a exigir revisão própria. Anexos antigos do chat ainda por proteger. |
| Idiomas/configurações | PT/EN/FR/ES/DE no dicionário e percursos operacionais ensaiados; capacidades fixas são apresentadas como tal | TASK84, 95, 99, 132. Tradução e apresentação de todos os textos/PDFs ainda não auditadas integralmente. |
| Retenção/backup | Pré-visualização e limpeza manual controlada de GPS; monitorização de idade da cópia local; restauro em QA | TASK96–98 e CI. Cópia externa, agendamento e alerta real de falha no VPS pendentes. Não há eliminação automática de histórico crítico. |
| IA e evoluções avançadas | Sugestões e controlos humanos existentes | Aprendizagem validada por piscina, assistente generativo offline e vídeo completo continuam sem evidência de implementação integral. Não declarar estes pontos concluídos. |

## Próximo trabalho no código

1. Proteger os anexos de conversa CLIENT: `clientMessageRoutes` grava na área servida por `express.static(uploadsPath)`. Criar download autenticado por titularidade e proteger as referências antigas, conservando ficheiros/histórico e sem quebrar fotos de campo. Reproduzir primeiro a leitura anónima do anexo criado em QA.
2. Consolidar `/api/chat/internal` (lista vazia) e `/api/internal-chat/messages` (JSON), definir armazenamento transacional para concorrência entre processos e repetição segura. O histórico antigo não pode ser apagado nem atribuído a outro autor por suposição.
3. Rever individualmente as escritas antigas protegidas na TASK170: ter autenticação não garante atomicidade, versão ou recuperação de reenvio. Priorizar as rotas realmente utilizadas pelos ecrãs.
4. Concluir inventário visual por perfil de páginas, erros, carregamento, vazio, traduções e PDFs. Os ecrãs já ensaiados não equivalem à revisão de todas as páginas.
5. Tratar vídeo, custos reais de rentabilidade e IA offline/aprendizagem como requisitos próprios com critérios verificáveis, reutilizando os módulos existentes.

## Dependências de ambiente

- VPS: instalação, HTTPS, processos/arranque, supervisão, backup externo e restauro operacional.
- iPhone/Android: aplicação instalada, offline prolongado, fotografia, GPS, bateria e push após fechar a aplicação.
- Fornecedores: SMTP/WhatsApp, pagamentos/retornos, reconciliação e fiscalidade; ensaios reais não ocorreram neste lote.
- Carga e redundância: concorrência controlada em QA é evidência funcional, não dimensionamento ou failover de produção.

## Regra de evidência

Base remota TASK171: `90c4d01a7d80f7a0c5aee3cb4de33a13a994d2bf`, árvore `d0b68aebfa750605f26a377367d331e4afec536c`, workflow `35026498860` aprovado com 75 grupos, unitários/navegador e restauro em PostgreSQL 16. TASK172–175 acrescentam quatro grupos; validação local detalhada em `ACCESS_AND_REMINDERS_20260915.md`. A aprovação dessa base não substitui a verificação da árvore nova publicada. Não atribuir percentagem global sem um inventário fechado de critérios de aceitação.
