# FCS Operational UX Blueprint - Técnico

Data: 2026-07-26
Fase: Blueprint funcional e estrutural (sem implementação visual/código nesta etapa).
Pré-requisito cumprido: segurança técnica fechada (auth, ownership, financeiro bloqueado ao técnico, workday/admin corrigido).

## 1) Objetivo do blueprint

Definir o desenho definitivo do Centro Operacional do Técnico com:
- entrada única e clara para execução diária;
- prioridades operacionais visíveis em menos de 3 segundos;
- continuidade mobile-first de ponta a ponta;
- integração progressiva sem reescrever todas as páginas ao mesmo tempo.

## 2) Princípios de desenho

1. Um núcleo operacional único: o técnico começa e termina o dia no mesmo ecrã.
2. Prioridade por risco real: segurança da água, incidentes e bloqueios de serviço vêm antes de produtividade.
3. Ação imediata: cada cartão prioritário deve ter CTA direto (sem navegação longa).
4. Sem financeiro no universo técnico: nenhuma métrica de lucro/faturação/dívida no centro técnico.
5. Subfluxos vivos: mapas, documentos e detalhe de visita permanecem como subfluxos especializados.

## 3) Ecrã inicial (Home operacional)

Nome de produto: Centro Operacional do Técnico.
Base canónica: `/technician-field-mode`.

Composição do ecrã inicial (ordem vertical):
1. Cabeçalho de turno (Agora):
- estado da jornada (iniciada/pausada/fechada), hora, última sincronização, qualidade de sinal.
- CTAs: Iniciar jornada, Encerrar jornada.

2. Barra de prioridade do dia:
- contadores em tempo real: alertas críticos, águas abertas, bombas em manual, problemas pendentes, documentos pendentes.
- toque em cada contador abre lista filtrada.

3. Piscinas do dia:
- lista sequencial de paragens com estado (por fazer, em curso, bloqueada, concluída).
- CTA primário por item: Abrir visita.
- CTA secundário: Ver rota no mapa.

4. Cartão Agora (foco de execução):
- visita ativa + próxima ação recomendada (ex.: recolher leitura, registar problema, anexar foto, concluir).
- painel de bloqueios (ex.: documento obrigatório em falta).

5. Feed de risco operacional:
- alertas persistentes não resolvidos.
- incidentes que afetam execução do dia.

## 4) Ordem de prioridades operacionais

Prioridade P0 (bloqueia operação):
- águas abertas;
- bomba em manual sem validação;
- problema crítico em visita ativa;
- documento obrigatório vencido/ausente quando impede execução.

Prioridade P1 (alto impacto):
- visitas atrasadas do dia;
- problema não crítico sem resolução;
- guia/seguro necessário para deslocação/obra no dia.

Prioridade P2 (produtividade):
- otimização de sequência/rota;
- notas e pendências administrativas não bloqueantes.

## 5) Módulos funcionais obrigatórios no núcleo

### 5.1 Piscinas do dia

Objetivo:
- dar ao técnico visão completa e ordenada das visitas.

Regras de UX:
- uma linha por piscina com estado, janela horária, distância e risco.
- filtros rápidos: Todas, Em curso, Atrasadas, Críticas.
- atualização otimista com reconciliação em background.

Origem atual:
- integra capacidades de `/technician-route`.

### 5.2 Agora

Objetivo:
- mostrar a ação mais importante neste instante.

Regras de UX:
- sempre existe uma próxima ação recomendada.
- se houver bloqueio, mostrar motivo e ação de desbloqueio no mesmo cartão.
- manter histórico curto de últimos eventos para contexto.

Origem atual:
- consolida o foco operacional já existente em `/technician-field-mode`.

### 5.3 Alertas persistentes

Objetivo:
- impedir esquecimento de riscos até resolução explícita.

Regras de UX:
- alerta só sai do topo ao ser resolvido ou reclassificado por regra.
- cada alerta indica impacto, prazo e responsável.
- CTA direto para resolver no local correto.

### 5.4 Águas abertas

Objetivo:
- fechar rapidamente situações com risco técnico/sanitário.

Regras de UX:
- bloco dedicado no topo enquanto existir item aberto.
- ação de fecho com confirmação e trilho auditável.
- escalonamento visível quando ultrapassa SLA.

### 5.5 Bomba em manual

Objetivo:
- reduzir risco de operação fora do modo esperado.

Regras de UX:
- cartão de exceção com origem, duração e contexto.
- CTA: validar estado, anexar evidência e normalizar/justificar.
- sem resolução, mantém-se como alerta persistente P0.

### 5.6 Problemas

Objetivo:
- garantir registo e encerramento de anomalias por visita.

Regras de UX:
- criação rápida com categorias e severidade.
- visualização por estado: aberto, em tratamento, resolvido.
- vínculo explícito à visita/piscina correspondente.

### 5.7 Documentos

Objetivo:
- dar acesso operacional a guias, PDFs e seguros sem fricção.

Regras de UX:
- ponto único de entrada para documentos do dia.
- estados: válido, pendente, vencido, indisponível.
- download/visualização e ação recomendada quando houver bloqueio.

Origem atual:
- incorpora subfluxo funcional de `/technician-guide`.

### 5.8 Ficha técnica com aprovação

Objetivo:
- permitir alterações em campo com governança.

Regras de UX:
- alteração proposta gera diff claro (antes/depois).
- estados: rascunho, submetido, aprovado, rejeitado, reaberto.
- feedback de aprovação visível ao técnico no centro operacional.

Origem atual:
- evolui o fluxo de intake (`/technician-new-client`) para governança explícita.

## 6) Navegação mobile (estrutura alvo)

Padrão primário: barra inferior com 5 entradas.
1. Hoje (home operacional)
2. Mapa
3. Visita
4. Documentos
5. Mais

Regras:
- manter "Hoje" sempre acessível com um toque.
- estados críticos (P0) aparecem como badge global persistente.
- ações de segurança nunca ficam escondidas em menus profundos.

## 7) Integração vs subfluxo (decisão arquitetural de UX)

Integrado no núcleo (renderizado dentro de Hoje):
- Agora
- Piscinas do dia
- Alertas persistentes
- Águas abertas
- Bomba em manual
- Problemas
- Resumo de documentos pendentes
- Ficha técnica (estado e pendências)

Permanece como subfluxo especializado (abre por drill-down):
- Mapa detalhado: base em `/technician-map`
- Detalhe técnico da visita: base em `/technician-visit`
- Gestão documental completa: base em `/technician-guide`
- Novo cliente / alteração de cadastro com aprovação: base em `/technician-new-client`

Fora do universo técnico (continua bloqueado):
- `/technician-profit`
- `/technician-profit-dashboard`

## 8) Sequência de implementação recomendada (sem big-bang)

Fase UX-T1 (estrutura e priorização):
- montar shell do Centro Operacional no ecrã Hoje;
- introduzir barra de prioridade e blocos P0/P1/P2;
- sem remover subfluxos existentes.

Fase UX-T2 (integração progressiva):
- integrar lista "Piscinas do dia" e cartão "Agora";
- ligar CTAs para visita, mapa e resolução de alertas.

Fase UX-T3 (governança operacional):
- inserir bloco de documentos pendentes;
- inserir estado de ficha técnica com aprovação e feedback.

Fase UX-T4 (limpeza de superfície):
- reduzir redundâncias visuais;
- manter subfluxos apenas onde houver ganho real de especialização.

## 9) Critérios de aceitação do blueprint (antes de implementação)

1. O técnico identifica prioridade do dia em até 3 segundos.
2. Todos os itens P0 são visíveis sem scroll longo.
3. Toda ação crítica tem CTA direto no próprio contexto.
4. Não há exposição financeira no fluxo técnico.
5. Mobile mantém operação com uma mão em cenários de campo.
6. Subfluxos continuam acessíveis sem quebra de jornada.

## 10) Estado desta entrega

- Blueprint funcional do Centro Operacional do Técnico definido.
- Sem alterações de UX implementadas nesta fase.
- Pronto para abrir fase de implementação incremental controlada.
