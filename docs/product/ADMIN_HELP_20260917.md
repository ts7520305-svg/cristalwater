# TASK231 — Ajuda administrativa em cinco idiomas

## Alteração

O catálogo administrativo antigo continha instruções apenas em português, destinos desatualizados e descrições de funcionalidades futuras. Os 21 guias administrativos foram revistos e traduzidos para PT/EN/ES/FR/DE, com títulos, resumo, instrução e destino existente. Os 19 comandos rápidos usam as mesmas traduções. Os tópicos antigos `ai` e `aiOps` continuam a abrir o guia do assistente, sem o duplicar nas listas.

Os textos distinguem propostas de ações confirmadas, leitura de alertas de resolução, cópias guardadas de informação atual e preferências de som de entrega efetiva. Prioridades aponta para o editor confirmado na TASK230. O guia de apoio ao cliente abre a ficha interna, sem presumir uma sessão do cliente.

A lista de tópicos tem altura limitada e deslocação própria. No telemóvel, selecionar um tópico coloca o foco e desloca a página até à explicação. Mantêm-se a pesquisa, os estados de sessão e a separação dos quatro perfis da TASK226.

## Validação

- `scripts/test-role-help-browser.js`: quatro perfis, cinco idiomas e 320/390/1440 px; títulos administrativos traduzidos, todos os destinos existentes, comandos coerentes, aliases, pesquisa, teclado e mudança de conta. O teste verifica que a explicação móvel fica abaixo do cabeçalho.
- Capturas revistas em `reports/field-visual/role-help-1789661515658`, incluindo ADMIN em 320 e 1440 px.
- Os 21 scripts de navegador passaram em `/tmp/task231-browser-final.log`; a versão final do comportamento móvel voltou a passar em `/tmp/task231-help-layout.log`.
- `run-1789661443707`: entrada real TEAM_LEADER, ajuda e regresso ao trabalho com sessão e rascunho preservados.
- Inventário atualizado: 101 HTML, 48 páginas com referências literais em 146 scripts ativos, zero recursos locais em falta e zero divergências catálogo/guarda. Referências estáticas não comprovam cobertura completa.

O lote conjunto TASK231–232 usa cache v60, sem migração. A tradução desta ajuda não demonstra tradução integral dos módulos/PDFs. CI `35246742375` aprovado no commit `e1b9ddc4353781de43d04f716ae725bea47dc306`, árvore `a2e1ff48ed352cf5b42d39770a628178efc051ab`: 125/125 grupos, 388 unitários/quatro técnicos, 21 scripts de navegador, 20 migrações, sintaxe de 539 JS backend/171 frontend/66 inline e restauro de 110 tabelas/32 ficheiros com linhas/hashes iguais em PostgreSQL 16.
