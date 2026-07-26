# CRYSTAL OS State Catalog

Data: 2026-07-26
Estado: catálogo oficial de estados operacionais.
Objetivo: garantir nomenclatura e semântica única em todo o sistema.

## 1) Piscina (estado operacional universal)

| Estado | Cor | Significado |
|---|---|---|
| Por iniciar | Branco | Ainda não iniciada no dia. |
| A caminho | Azul | Deslocação confirmada para a piscina. |
| Em intervenção | Verde | Trabalho ativo em curso na piscina. |
| Água aberta | Amarelo | Evento ativo de água aberta com ação pendente. |
| A aguardar material | Laranja | Operação bloqueada por material/logística. |
| Alerta crítico | Vermelho | Risco elevado que exige ação imediata. |
| Concluída | Verde escuro | Trabalho finalizado no ciclo atual. |

## 2) Visita

| Estado | Cor | Significado |
|---|---|---|
| Agendada | Azul claro | Planeada e ainda não iniciada. |
| Check-in | Azul | Técnico chegou e iniciou execução. |
| Em execução | Verde | Atividades técnicas em progresso. |
| Em bloqueio | Laranja | Execução parada por dependência/risco. |
| Concluída | Verde escuro | Visita encerrada com sucesso. |
| Não concluída | Vermelho | Encerrada sem conclusão plena, com motivo obrigatório. |
| Cancelada | Cinzento | Não será executada neste ciclo. |

## 3) Problema

| Prioridade | Cor | Significado |
|---|---|---|
| P1 | Vermelho | Crítico, impacto imediato na operação/segurança. |
| P2 | Laranja | Alto impacto, resolução prioritária. |
| P3 | Amarelo | Médio impacto, resolução programada. |
| P4 | Azul | Baixo impacto, acompanhamento controlado. |

| Estado do problema | Cor | Significado |
|---|---|---|
| Aberto | Vermelho | Criado e sem tratamento. |
| Em tratamento | Laranja | Ações de correção em curso. |
| Aguardando validação | Amarelo | Correção aplicada, pendente validação. |
| Resolvido | Verde | Encerrado com evidência. |
| Reaberto | Roxo | Reincidência após resolução anterior. |

## 4) Alerta (Motor Central)

| Estado | Cor | Significado |
|---|---|---|
| Novo | Vermelho | Evento recém-criado, ainda sem owner ativo. |
| Atribuído | Laranja | Responsável atual definido. |
| Confirmado | Amarelo | Responsável confirmou receção e plano. |
| Em mitigação | Azul | Ação corretiva em execução. |
| Escalado | Roxo | Subiu de nível por SLA/criticidade. |
| Resolvido | Verde | Condição mitigada e validada. |
| Encerrado | Verde escuro | Ciclo concluído com trilho completo. |

## 5) Água aberta

| Estado | Cor | Significado |
|---|---|---|
| Aberta | Amarelo | Evento ativo em campo. |
| Em fecho | Azul | Processo de fecho em execução. |
| Fechada | Verde | Fecho concluído e auditado. |
| Escalada | Vermelho | SLA excedido ou risco elevado. |

## 6) Bomba manual

| Estado | Cor | Significado |
|---|---|---|
| Manual ativa | Vermelho | Bomba em modo manual com risco operacional. |
| Em validação | Laranja | Estado a ser validado pelo responsável. |
| Normalizada | Verde | Retorno confirmado ao estado esperado. |
| Escalada | Roxo | Não normalizada no SLA definido. |

## 7) Guia operacional

| Estado | Cor | Significado |
|---|---|---|
| Pendente abertura | Cinzento | Ainda não iniciada para o ciclo atual. |
| Ativa | Azul | Guia aberta para uso operacional. |
| Em consumo | Amarelo | Há registos ativos de consumo. |
| Encerrada | Verde | Guia finalizada sem pendência. |
| Bloqueada | Vermelho | Impedida por falta documental ou regra. |

## 8) Documento

| Estado | Cor | Significado |
|---|---|---|
| Válido | Verde | Em conformidade temporal e de escopo. |
| A vencer | Amarelo | Próximo do limite de validade. |
| Vencido | Vermelho | Fora de validade, pode bloquear operação. |
| Indisponível | Laranja | Não encontrado/associado no contexto atual. |
| Em revisão | Azul | Atualização em curso pela administração. |

## Regras de consistência

1. Estados e cores são canónicos e não podem ser redefinidos por módulo.
2. Qualquer novo estado exige atualização deste catálogo antes de implementação.
3. UI, alertas, histórico e IA devem consumir estes estados sem tradução paralela.
4. Divergência de nome/cor entre páginas é considerada regressão de arquitetura.
