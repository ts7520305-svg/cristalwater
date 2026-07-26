# CRYSTAL OS Master Operational Flow

Data: 2026-07-26
Estado: referência operacional mestre para execução diária.
Objetivo: responder de forma direta como cada utilizador trabalha desde entrada até saída da aplicação.

## Princípios gerais

- Este documento é funcional e operacional, não técnico.
- Descreve o fluxo principal por perfil.
- Qualquer novo fluxo deve preservar esta estrutura base.

## Fluxo Mestre - Técnico

### 1) Login

- Técnico entra com credenciais operacionais.
- Sistema valida sessão e permissões de perfil.
- Ao entrar, abre diretamente no Centro Operacional.

### 2) Hoje

- Vê prioridades do dia e estado da jornada.
- Consulta Piscinas do dia por estado.
- Confirma se existem alertas críticos no topo.

### 3) Agora

- Acede ao que está a acontecer em tempo real.
- Identifica imediatamente a próxima ação operacional.
- Se houver evento crítico, este ponto torna-se prioritário.

### 4) Visita

- Seleciona piscina.
- Executa fluxo único da visita sem voltar ao menu principal.
- Regista leituras, químicos e evidências fotográficas.

### 5) Problema

- Se existir anomalia, abre problema com prioridade universal.
- Regista contexto, evidência e ação inicial.
- O problema entra no Motor Central de Alertas.

### 6) Água aberta

- Quando aplicável, regista e fecha com trilho auditável.
- Se exceder limite operacional, alerta sobe automaticamente.
- Fluxo normal é interrompido até mitigação crítica.

### 7) Check-out

- Fecha visita com estado final.
- Atualiza status da piscina.
- Continua automaticamente para a próxima piscina.

### 8) Logout

- Técnico encerra jornada e sessão.
- Sistema preserva histórico e sincronização pendente.

## Fluxo Mestre - Administrador

### 1) Login

- Administrador entra com credenciais administrativas.
- Sistema valida permissões e abre Centro de Comando.

### 2) Centro de Comando

- Observa operação global em tempo real.
- Monitoriza técnicos em trabalho, intervenções e riscos.
- Prioriza ações por criticidade e SLA.

### 3) Aprovações

- Analisa alterações pendentes (ficha técnica e afins).
- Compara valor atual, valor proposto, motivo e evidências.
- Aprova ou rejeita com registo de responsabilidade.

### 4) Alertas

- Gere fila única de alertas por prioridade.
- Atribui, reatribui e escala responsáveis.
- Confirma resolução e fecho auditável.

### 5) Equipas

- Acompanha distribuição de trabalho por técnico e zona.
- Ajusta atribuições quando há bloqueio operacional.
- Garante equilíbrio entre urgência e capacidade.

### 6) Financeiro

- Acede às funções financeiras por perfil autorizado.
- Mantém separação total entre operação técnica e financeiro.

### 7) Clientes

- Consulta e mantém contexto operacional do cliente.
- Não mistura decisões operacionais com dados desnecessários.

### 8) Encerramento do dia

- Confirma pendências críticas restantes.
- Fecha ciclo operacional diário.
- Regista desvios para ação corretiva.

## Fluxo Mestre - Cliente

### 1) Login

- Cliente entra no portal com autenticação adequada.
- Sistema abre experiência simplificada por perfil.

### 2) Próxima visita

- Cliente vê data/estado da próxima visita.
- Recebe informação clara e objetiva.

### 3) Histórico

- Consulta histórico de serviços de forma simples.
- Não vê informação técnica interna desnecessária.

### 4) Relatórios

- Acede aos relatórios partilhados.
- Visualiza evolução do serviço com linguagem compreensível.

### 5) Pedidos

- Submete solicitações operacionais.
- Acompanha estado dos pedidos sem complexidade.

### 6) Pagamentos

- Consulta e realiza operações de pagamento aplicáveis.
- Mantém separação de informação por permissão.

### 7) Mensagens

- Comunica com a operação pelos canais definidos.
- Mantém histórico de comunicação essencial.

## Regras de alinhamento

- Sempre que existir dúvida de implementação, seguir primeiro:
1. CRYSTAL_OS_OPERATIONAL_PRINCIPLES.md
2. FCS_OPERATIONAL_UX_BLUEPRINT_V2_20260726.md
3. Este documento de fluxo mestre

- Não introduzir novos caminhos principais sem validação explícita de arquitetura.
