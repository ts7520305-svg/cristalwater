# GROUP6_PRECHECK

Data: 2026-07-20
Objetivo: decidir entre abertura de Grupo 6 ou entrada direta em testes de campo.
Estado: CONCLUIDO

## Metodo usado
- Inventario de paginas HTML ativas em frontend.
- Cruzamento com freeze oficial dos Grupos 1-5.
- Classificacao do remanescente em: Grupo 6 potencial, legacy, utilitario/validar, fora de escopo.

## Resultado consolidado
- Total de paginas HTML no frontend: 93
- Paginas congeladas (Grupos 1-5): 67
- Fora do freeze: 26

Distribuicao do fora-freeze:
- Grupo 6 potencial (utilitario/validar): 14
- Legacy: 2
- Fora de escopo (auth/indice/suporte): 10

## Legacy (excluir)
- alerts.html
- alerts-financial.html

## Fora de escopo (nao abrir Grupo 6 por padrao)
- admin-login.html
- admin-test-center.html
- client-login.html
- login.html
- splash.html
- crystal-os-v2-route-index.html
- technician-login.html
- technician-chat.html
- technician-history.html
- technician-profile.html

## Utilitario/validar (candidatos para triagem, nao necessariamente Grupo 6)
- billing-extras.html
- billing-history.html
- client-menu.html
- client_tech.html
- config-notifications.html
- map.html
- metrics.html
- multi-map.html
- profit-map.html
- ranking.html
- report-center.html
- settings.html
- technician-profit.html
- technician-profit-dashboard.html

## Conclusao objetiva
- Nao existe, neste momento, um Grupo 6 core evidente com o mesmo perfil dos Grupos 1-5.
- O remanescente e majoritariamente utilitario/suporte, com parte legacy e auth/index fora de escopo de migracao principal.
- Recomendacao: entrar em validacao global e testes de campo agora.

## Condicao para abrir Grupo 6
Abrir Grupo 6 apenas se a triagem funcional em campo comprovar que parte dos 14 utilitarios/validar e:
- critica para operacao diaria;
- usada com frequencia real;
- candidata a padrao visual/UX igual ao escopo principal.
