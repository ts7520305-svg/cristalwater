# GLOBAL_VALIDATION_PHASE_PLAN

Data: 2026-07-20
Fase: Estabilizacao e validacao global apos fecho dos Grupos 1-5
Estado: PRONTO PARA EXECUCAO

## Objetivo
Executar validacao real do produto sem ampliar escopo funcional: estabilizar, testar em campo, corrigir apenas bugs reais e preparar release.

## Escopo desta fase
- Grupos 1-5 permanecem congelados.
- Nao criar novas paginas.
- Nao fazer redesign.
- Nao adicionar funcionalidades.

## Blocos de execucao
1. Testes funcionais em ambiente real
- Admin: operacao diaria, dashboards, cobranca, notificacoes, configuracoes.
- Tecnico: agenda, rota, GPS, visita, registo de trabalho.
- Cliente: portal, historico, pagamentos, notificacoes.

2. Testes de campo
- Uso real por tecnicos (janela recomendada: 5 a 7 dias).
- Sincronizacao online/offline.
- GPS e trajetos.
- Captura de fotografias e anexos.
- Latencia e desempenho em uso continuo.

3. Correcao de bugs reais
- Corrigir apenas defeitos reproduziveis com impacto real.
- Proibido: feature nova, ajuste cosmetico sem defeito, nova superficie.
- Toda correcao deve ter evidencia de reproducao + verificacao pos-fix.
- Priorizacao operacional durante campo:
	- P0/P1: correcao imediata;
	- P2/P3: apenas registro durante a janela de campo; correcao no fecho da validacao.

4. Decisao pos-validacao
- Reavaliar os 14 utilitarios/validar apenas com dados de uso real.
- Abrir Grupo 6 somente se houver criticidade operacional comprovada.
- Caso contrario, manter fora do core e seguir para release.

## Criticos de qualidade (go/no-go)
- Sem bloqueadores P0/P1 em fluxos Admin/Tecnico/Cliente.
- Sem regressao funcional nos fluxos certificados.
- Integracoes estaveis em cenarios reais.
- Evidencia de campo documentada.

## Criterio de saida para release
- P0 = 0
- P1 = 0
- Sincronizacao estavel
- GPS estavel
- Offline/online validado
- Upload de fotografias validado
- Tecnicos operam 1 semana sem bloqueios
- Clientes usam o portal sem problemas criticos

## Artefatos obrigatorios
- Relatorio de testes funcionais reais (Admin/Tecnico/Cliente).
- Relatorio de testes de campo (incidentes, severidade, reproducao).
- Registro de correcoes aplicadas e retestes.
- Decisao final: Grupo 6 (sim/nao) com justificativa objetiva.
- Tracker ativo com registo minimo por incidente: perfil, acao, resultado esperado, resultado real, hora, dispositivo, evidencia e severidade.

## Referencias existentes
- docs/product/GROUP6_PRECHECK.md
- docs/product/CRYSTAL_WATER_RELEASE_CHECKLIST.md
- docs/product/FINAL_REAL_SYSTEM_VALIDATION_20260719.md
- docs/product/UI_UX_VALIDATION_REPORT.md
