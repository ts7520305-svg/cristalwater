# REAL FUNCTIONAL SIMULATION — 2026-07-19

## Escopo desta execução
- Ambiente: base limpa após reset real validado.
- Regras respeitadas: sem nova limpeza, sem migrations, sem alteração de schema, sem criação direta de dados em SQL.
- Canais usados: interface real (admin/technician/client login pages) + APIs reais para suporte operacional quando necessário.
- Paragem: após primeira visita completa (conforme solicitado).

## Resultado global (Fase 1)
- Estado: PARCIALMENTE CONCLUÍDO COM BLOQUEIOS CONTROLADOS
- Concluído com sucesso: login admin, estado vazio inicial, criação técnico, criação cliente, criação piscina + ficha técnica + chave, criação ronda, geração visita, execução e conclusão da primeira visita.
- Bloqueios relevantes: algumas ações dependem de UX não disponível nesta sessão automatizada (prompt/modal/file chooser remoto e fluxo de check-in explícito), e acesso cliente sem credenciais provisionadas.

---

## FASE 1 — ARRANQUE INICIAL
1. Login administrador
- Estado: PASS
- Evidência: dashboard abriu em `/dashboard` com sessão admin válida.

2. Dashboard
- Estado: PASS (após correção imediata P1)
- Achado inicial: textos `undefined` visíveis em KPIs com base limpa.
- Correção aplicada imediatamente:
  - `frontend/dashboard.js`
  - Normalização de campos do summary para zero (`safe.*`) para impedir `undefined` em estado vazio.
- Resultado após correção:
  - 0 técnicos, 0 clientes, 0 piscinas, 0 rondas, 0 visitas, 0 produtos, 0 viaturas apresentados corretamente.

3. Consola/erros técnicos/links/cache
- Estado: PASS com observações
- Sem stack traces de backend no fluxo principal.
- Sem links quebrados observados nos caminhos testados.
- Observação: erro 403 de endpoint admin foi gerado propositadamente durante teste de permissões do técnico.

---

## FASE 2 — CRIAR PRIMEIRO TÉCNICO
Dados:
- Nome: QA Técnico 1
- Email: qa.tecnico1@cristalwater.test
- Perfil: TECHNICIAN
- Estado: Ativo

Resultado:
- Criação concluída: PASS
- Aparece na lista: PASS
- Login técnico: PASS (PIN 1234)
- Permissões corretas: PASS
  - Endpoint admin `/api/dashboard/admin` com token técnico devolveu 403.
- Não vê valores financeiros/contactos proibidos: PASS (amostra de UI técnica sem exposição financeira no fluxo testado).
- Logout funcional: PASS (`/technician` botão `Sair` redirecionou para `/login`).

---

## FASE 3 — CRIAR PRIMEIRO CLIENTE
Dados:
- Nome: QA Cliente 1
- Email: qa.cliente1@cristalwater.test
- Telefone: 910000001
- Nome interno: QA Cliente Lagos 1 (registado em notas internas)
- Estado: Ativo (em configuração funcional)

Resultado:
- Cliente criado: PASS
- Aparece em pesquisa/lista: PASS
- Histórico inicial vazio: PASS
- Sem duplicação: PASS
- Sem validações indevidas no create: PASS
- Edição funciona: BLOQUEADO (limitação de sessão automatizada)
  - Ação `Editar` usa `prompt()` em `admin-clients` e o ambiente de browser automatizado desta sessão não suporta `prompt`, impedindo validação da edição por UI nesta execução.

---

## FASE 4 — CRIAR PRIMEIRA PISCINA
Dados:
- Cliente: QA Cliente 1
- Nome: QA Piscina 1
- Zona: Lagos Centro
- Periodicidade: 1x/semana (ronda semanal configurada na fase seguinte)
- Estado: Ativa
- Técnica:
  - dimensões preenchidas
  - volume calculado automaticamente pela ficha
  - tratamento/equipamento básico preenchidos
  - notas técnicas preenchidas
  - chave fictícia criada (`QA-KEY-01`)

Resultado:
- Piscina criada e associada ao cliente: PASS
- Aparece na ficha/lista: PASS
- Ficha técnica abre: PASS
- Edição da ficha técnica: PASS
- Ligação cliente/piscina: PASS
- Técnico atribuído: PASS (confirmado na ronda da fase 5)

---

## FASE 5 — CRIAR PRIMEIRA RONDA
Escopo:
- Ronda: QA Ronda 1
- Técnico: QA Técnico 1
- Piscina: QA Piscina 1

Resultado:
- Ronda criada: PASS
- Aparece no admin: PASS
- Aparece para técnico (planeamento): PASS
- Ordem correta: PASS (#1 QA Piscina 1)
- Data/planeamento: PASS (visita planeada e depois ajustada para execução no dia)
- Estado pendente/planeado: PASS
- Sem duplicação: PASS

---

## FASE 6 — EXECUTAR PRIMEIRA VISITA
Visita alvo:
- ID: 1073
- Cliente: QA Cliente 1
- Piscina: QA Piscina 1
- Ronda: QA Ronda 1

Execução técnica concluída:
- Login técnico: PASS
- Abrir visita: PASS (`/technician-visit?visit=1073`)
- Leituras registadas: PASS
  - pH 7.3
  - Cloro 1.4
  - Sal 4200
  - Alcalinidade 110
  - ORP 720
  - Temperatura 25.5
- Observação registada: PASS
- Fotografia QA associada: PASS (1 fotografia)
- Concluir visita: PASS (estado final `DONE`)

Subpassos de navegação operacional (deslocação/check-in/iniciar visita explícitos):
- Estado: NÃO IMPLEMENTADO no fluxo atual desta tela
- Observação: no fluxo testado de `technician-visit` não existem controles explícitos separados para `iniciar deslocação` e `check-in`; o processo operacional disponível concentra-se em registo + conclusão da visita.

Produto/stock na visita:
- Estado: NÃO APLICÁVEL NESTA BASE LIMPA (sem catálogo de produtos inicial)
- Evidência: `chemicalUsageRows = 0`; não há desconto de stock por não existir produto registado nesta fase.

Validação cruzada pós-visita:
- Visita concluída: PASS (`status=DONE`)
- Histórico/resultado no admin: PASS (core dashboard: `visitsDone=1`)
- Ronda atualizada: PASS (round 55 com visita 1073 `DONE`)
- Fotografia associada: PASS (`visitPhotoRows=1`)
- Cliente vê apenas informação permitida: BLOQUEADO
  - Acesso ao portal cliente redireciona para `/client-login` (proteção ativa), mas não foram fornecidas credenciais de cliente nesta fase para validar visualização autorizada.

---

## Registo de Falhas / Bloqueios

### 1) P1 corrigido imediatamente
- Estado: PASS (corrigido)
- Página: `/dashboard`
- Perfil: ADMIN
- Ação: abrir dashboard base limpa
- Esperado: métricas em zero sem artefatos técnicos
- Real: texto `undefined` em KPIs
- Severidade: P1
- Consola: sem stack crítico associado
- Rede: endpoints responderam; problema de fallback de campos
- Ficheiros prováveis:
  - `frontend/dashboard.js`
- Correção aplicada:
  - fallback numérico para campos do `summary`
- Reteste:
  - PASS

### 2) Edição de cliente via `prompt()`
- Estado: BLOQUEADO (nesta sessão)
- Página: `/admin-clients`
- Perfil: ADMIN
- Ação: `Editar`
- Esperado: abrir fluxo de edição e guardar alterações
- Real: erro em automação (`prompt() is not supported`) no browser integrado da sessão
- Severidade: P2 (bloqueio de validação automatizada, não evidência conclusiva de falha em browser real do utilizador)
- Consola: `pageError: prompt() is not supported`
- Rede: não aplicável
- Ficheiros prováveis:
  - `frontend/admin-clients.js`

### 3) Upload de foto via file chooser da sessão remota
- Estado: BLOQUEADO (UI da sessão), CONTORNADO COM API REAL
- Página: `/technician-visit`
- Perfil: TECHNICIAN
- Ação: anexar ficheiro via seletor do browser da sessão
- Esperado: upload da foto QA pela UI
- Real: mapeamento de path local/remote inválido no seletor desta sessão
- Severidade: P2
- Consola: sem erro funcional do backend
- Rede: upload validado via API (`/api/visits/1073/photo`, 200)
- Ficheiros prováveis:
  - infraestrutura de execução do browser remoto (fora do código app)

---

## Evidência técnica consolidada
- Técnico criado: QA Técnico 1 (id 113)
- Cliente criado: QA Cliente 1 (id 166)
- Piscina criada: QA Piscina 1 (id 192)
- Ronda criada: QA Ronda 1 (id 55)
- Visita executada: id 1073
- Estado final visita: DONE
- Leituras guardadas: pH 7.3, Cloro 1.4, Alcalinidade 110, Sal 4200, Temperatura 25.5, ORP 720
- Foto associada: 1
- Dashboard admin (core): clients 1, pools 1, technicians 1, rounds 1, visitsDone 1

## Alterações de código feitas nesta fase
- `frontend/dashboard.js`
  - correção P1 de zero-state para evitar `undefined` em cartões KPI

## Não executado nesta fase
- Não criado segundo técnico/cliente/piscina.
- Não realizado commit.
