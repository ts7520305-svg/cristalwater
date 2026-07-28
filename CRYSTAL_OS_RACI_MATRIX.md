# CRYSTAL OS RACI Matrix

Data: 2026-07-26
Estado: matriz oficial de responsabilidades operacionais.
Objetivo: eliminar ambiguidades de execução entre Técnico, Administrador e Cliente.

## Legenda

- R: Responsible (executa)
- A: Accountable (responde pelo resultado final)
- C: Consulted (deve ser consultado)
- I: Informed (deve ser informado)

## Matriz de funções críticas

| Função | Técnico | Administrador | Cliente | Regra operacional |
|---|---|---|---|---|
| Água aberta | R | A | I (opcional) | Técnico regista/atualiza/fecha; admin supervisiona SLA e escalonamento. |
| Bomba em manual | R | A | - | Técnico ativa/desativa com evidência; admin valida criticidade e conformidade. |
| Alteração de ficha técnica | R | A | - | Técnico propõe; admin aprova/rejeita com trilho de decisão. |
| Problema | R | A | I (opcional) | Técnico cria e atualiza; admin atribui, escala e encerra. |
| Documento de viatura | R (consulta) | A (gestão) | - | Técnico consulta contexto da viatura ativa; admin gere validade e bloqueios. |
| Visita (execução em campo) | R | A | I | Técnico executa fluxo único; admin garante cobertura operacional. |
| Visita atrasada | R (justifica) | A (replaneia) | I | Admin decide reatribuição/prioridade; técnico atualiza estado real. |
| Alerta crítico de segurança | R (mitiga em campo) | A (escalona e fecha) | I (quando aplicável) | Interrompe fluxo normal até mitigação mínima. |
| Água aberta sem resolução em SLA | R | A | I (opcional) | Evento sobe para prioridade máxima no Centro de Comando. |
| Aprovação operacional pendente | C | A | - | Admin é dono da decisão; técnico fornece contexto e evidência. |
| Stock crítico para visita | R (reporta) | A (desbloqueia logística) | - | Técnico sinaliza impacto; admin remove bloqueio operacional. |
| Comunicação com cliente em incidente | C | A | I | Admin coordena mensagem oficial quando houver risco/atraso relevante. |

## Regras de governação da matriz

1. Se existir conflito entre módulos, esta matriz prevalece.
2. Nenhuma funcionalidade crítica pode entrar em produção sem RACI definido.
3. Alterações de RACI exigem revisão de CRYSTAL_OS_OPERATIONAL_PRINCIPLES.md.
4. Motor Central de Alertas deve persistir actor e timestamp para cada transição.
