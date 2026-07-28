# CRYSTAL OS Operational Principles

Data: 2026-07-26
Estado: regras permanentes de arquitetura operacional e UX funcional.
Aplicação: obrigatório para qualquer implementação futura no Cristal Water.

## Princípios permanentes

1. Nunca duplicar módulos para a mesma capacidade.
2. Uma função crítica deve ter um fluxo principal único.
3. Centro Operacional é o núcleo diário do Técnico e do Administrador.
4. Navegação deve minimizar mudança de contexto.
5. Alertas persistentes ficam no topo até resolução explícita.
6. Eventos críticos interrompem o fluxo normal e exigem mitigação.
7. Motor Central de Alertas é único para todo o sistema.
8. Todo alerta deve ter responsabilidade rastreável ponta a ponta.
9. Estados operacionais da piscina são universais e comuns a todos os módulos.
10. Prioridade de problemas usa escala universal P1, P2, P3 e P4.
11. Offline primeiro é requisito arquitetural, não opcional.
12. Sem rede, técnico continua operação e sincroniza ao regressar conectividade.
13. Segurança vem antes da interface.
14. Técnico nunca vê valores financeiros.
15. Técnico vê apenas dados mínimos operacionais do cliente.
16. Administrador tem visão global em tempo real no Centro de Comando.
17. Documentos operacionais são sempre vinculados à viatura ativa.
18. Alterações críticas de ficha técnica exigem aprovação explícita.
19. IA é transversal e contextual, não um silo funcional.
20. Nenhuma função atual pode ser removida sem migração validada.
21. Consistência visual é obrigatória: todas as páginas seguem o mesmo design system.
22. Operação primeiro: em caso de dúvida entre mostrar mais informação ou concluir o trabalho mais rápido, vence a segunda opção.

## Regras de decisão antes de criar nova página

Antes de criar qualquer nova página, responder:
1. Esta função já existe?
2. Pode viver dentro de outro módulo?
3. Vai obrigar mudança de contexto desnecessária?
4. Existe alternativa mais simples?

Se a resposta indicar duplicação ou complexidade evitável, a nova página não deve ser criada.

## Regras de implementação faseada

1. Implementar por fases pequenas e reversíveis.
2. Testar funcionalmente cada fase antes da próxima.
3. Corrigir regressões antes de expandir escopo.
4. Não abrir nova frente sem fechar a anterior.
5. Revalidar segurança e permissões em cada entrega.

## Regra de governação final

Em caso de dúvida de implementação, este documento prevalece como constituição operacional do projeto.
