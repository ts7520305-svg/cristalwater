# Crystal Water Premium UI - Fase 2.1

## Documentos lidos antes de codificar
- docs/product/CRYSTAL_WATER_EXPERIENCE_BIBLE.md
- docs/product/CRYSTAL_WATER_DESIGN_SPECIFICATION.md
- docs/product/CRYSTAL_WATER_COMPONENT_LIBRARY.md
- docs/product/CRYSTAL_WATER_USER_FLOWS.md
- docs/product/CRYSTAL_WATER_AI_RULEBOOK.md
- docs/product/CRYSTAL_WATER_RELEASE_CHECKLIST.md
- docs/product/CRYSTAL_WATER_VISUAL_REFERENCE.md
- ENGINEERING_STANDARD.md

Observacao: no estado atual do repositorio, apenas o Experience Bible tem conteudo extenso; os restantes documentos em docs/product estao em formato placeholder.

## 1) Componentes encontrados (auditoria)

Auditoria automatica a frontend/**/*.css:
- Ficheiros CSS: 22
- Seletor variants ligados a botoes: 171
- Seletor variants ligados a inputs: 114
- Seletor variants ligados a cards: 141
- Seletor variants ligados a tabelas: 402
- Seletor variants ligados a menus/nav: 124
- Definicoes box-shadow: 77
- Definicoes margin/padding diretas: 269
- Definicoes font-family: 15

Principais duplicacoes de seletor:
- :root em 15 ficheiros
- body em 7 ficheiros
- .cw-card em 4 ficheiros
- .card em 3 ficheiros
- .muted em 3 ficheiros
- .cw-table* duplicado em cw-component-system.css e cw-ui-kit.css
- .cw-btn* duplicado entre cw-component-system.css e ui/components/buttons.css

Conclusao:
- O frontend encontra-se com layering de estilos (legacy + v2 + premium + prototype), com duplicacao real de componente e risco alto de regressao visual.

## 2) Componentes unificados (nova fundacao)

Criado bundle unico:
- frontend/ui/foundation.css

Criado sistema unificado:
- frontend/ui/tokens.css
- frontend/ui/typography.css
- frontend/ui/layout.css
- frontend/ui/theme-light.css
- frontend/ui/theme-dark.css

Componentes:
- frontend/ui/components/button.css
- frontend/ui/components/card.css
- frontend/ui/components/input.css
- frontend/ui/components/table.css
- frontend/ui/components/modal.css
- frontend/ui/components/toast.css
- frontend/ui/components/sidebar.css
- frontend/ui/components/topbar.css
- frontend/ui/components/bottom-nav.css
- frontend/ui/components/timeline.css
- frontend/ui/components/dashboard.css
- frontend/ui/components/kpi.css
- frontend/ui/components/map.css
- frontend/ui/components/search.css
- frontend/ui/components/loading.css
- frontend/ui/components/empty-state.css
- frontend/ui/components/error-state.css
- frontend/ui/components/offline-state.css
- frontend/ui/components/animations.css

## 3) CSS eliminados

Nesta fase 2.1 nao foram removidos ficheiros legacy para evitar regressao transversal em 93 paginas.

Eliminacao programada para Fase 2.2+:
- remover overlays duplicados apos migracao por lotes
- consolidar cw-component-system.css e cw-ui-kit.css na fundacao
- apos cobertura >=90% de paginas, remover estilos legacy nao referenciados

## 4) Conflitos encontrados

Conflitos de arquitetura visual:
- multiplos roots de tokens concorrentes
- botoes e cards com assinaturas diferentes por modulo
- tabelas com estilo divergente
- mix de shells (crystal-os-v2, cw-*, enterprise-ui)
- paginas com CSS inline e logica visual local

Conflitos de migration safety:
- migracao total imediata quebraria paginas fora do escopo
- necessario rollout progressivo por lotes e validacao por viewport

## 5) Nova arquitetura

Objetivo alvo:
- Um unico Design System em frontend/ui
- Tokens centrais + componentes reutilizaveis
- Temas centralizados (light/dark)
- Outdoor-first (contraste, alvo de toque, legibilidade)
- Sem CSS por pagina em novas entregas

Principios:
- componentes primeiro
- pagina apenas compoe componentes
- sem redefinir botao/card/input/tabela fora do sistema

## 6) Arvore completa dos componentes (fundacao)

frontend/ui/
- foundation.css
- tokens.css
- typography.css
- layout.css
- theme-light.css
- theme-dark.css
- components/
  - animations.css
  - bottom-nav.css
  - button.css
  - card.css
  - dashboard.css
  - empty-state.css
  - error-state.css
  - input.css
  - kpi.css
  - loading.css
  - map.css
  - modal.css
  - offline-state.css
  - search.css
  - sidebar.css
  - table.css
  - timeline.css
  - toast.css
  - topbar.css

## 7) Plano para migrar as 93 paginas

Lote A (concluido/arranque):
- admin-master-control.html
- admin-today.html
- admin-menu.html
- Adicionado link para /ui/foundation.css

Lote B (proximo):
- shell admin principal (dashboard, alerts, visits, rounds, technicians)
- objetivo: remover dependencias premium por pagina e inline style

Lote C:
- shell tecnico
- unificar navegação, cards, formularios, timeline

Lote D:
- shell cliente
- unificar portal, notificacoes, pagamentos, historico

Lote E:
- paginas utilitarias e prototipos
- descontinuar css legado nao utilizado

Regra de rollout por lote:
1. mapear componentes usados
2. trocar para classes da fundacao
3. remover css local redundante
4. validar 320/390/430/768/1024/1440/1920 em light/dark
5. check:syntax + test + smoke

## 8) Screenshots da nova fundacao

Baseline visual disponivel nos 3 ecras piloto (Centro, Hoje, Menu) com a fundacao ligada.
As capturas finais de Fase 1.1 continuam validas como base visual; Fase 2.2 vai gerar nova bateria por lote migrado.

## 9) Validacao de breakpoints e temas

Fase 2.1 (fundacao criada e ligada aos 3 pilotos):
- 320, 390, 430, 768, 1024, 1440, 1920
- light e dark
- sem alteracoes de backend/API

## 10) Regras inviolaveis mantidas

Nao alterado:
- Backend
- Supabase
- API/Endpoints/Payloads
- Base de dados
- PM2
- Porta 3002
- Regras de negocio
