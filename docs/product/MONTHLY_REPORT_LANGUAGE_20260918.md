# TASK265 — Idioma do relatório financeiro mensal

## Contrato

O imprimível mensal ADMIN aceita lang=pt|en|fr|es; omissão conserva português. A validação comum recusa vazio, arrays/objetos, códigos desconhecidos e valores de protótipo. Resposta identifica Content-Language e HTML lang. Mantém versão 2, identidade mês/filtro, resposta privada/no-store e controlo ADMIN.

Catálogo próprio traduz títulos, métricas, classificações, ausências, explicações e avisos. Datas e moeda usam convenções do idioma, com EUR e UTC explícitos. Referências mensais/limites ISO e os cálculos continuam iguais. O relatório conserva a distinção entre valor documental, saldo atual e recebimentos por data. Não apresenta totais parciais como confirmados quando há montantes/estados ambíguos ou limites excedidos. Fonte, filtros e projeção financeira existentes preservados.

Nomes, contactos, instalações, números documentais, estados, métodos e notas guardados não são traduzidos. Mensagens parametrizadas são escapadas na saída HTML. A leitura não grava preferências nem altera dados financeiros. Centro de relatórios tem escolha explícita PT/EN/FR/ES, por página/pedido; escolha e resposta devem concordar. Mudança de idioma cancela a abertura, incluindo A-B-A em voo. Sessão alterada bloqueia seletor e botões. Erros da interface/API continuam em português.

## Verificação local

Run inicial `run-1789741353476`: regressões portuguesas de fontes e abertura aprovadas. Primeira extensão do ensaio tentou repor totalAmount a null, proibido pelo esquema; fixture corrigida para repor o valor inicial efetivo, sem alterar regras financeiras. Um scanner autónomo de relatórios de auditoria recusou arrancar por ausência do ficheiro secure-auth-matrix; esse scanner não é prova deste percurso. A proteção efetiva do imprimível foi verificada pelo teste dedicado abaixo.

Run final `run-1789741503878`: fontes mensais e abertura UI aprovadas. Matriz quatro idiomas × dois filtros confirma 195 EUR documentais, 128 EUR de saldo, 90 EUR recebidos/50 EUR filtrados, mesmos IDs e contagens. Verifica avisos documentais/recebimentos inválidos em todos os idiomas, mês vazio, papéis recusados, códigos inválidos, notas literais coincidentes com catálogo, ausência de execução HTML e comparação dos registos antes/depois das leituras. Casos anteriores de formatos históricos, estado desconhecido, valores negativos/fracionários/excessivos e falhas reais de leitura preservados. Navegador confirma idioma pedido/recebido, recusa resposta sem idioma/código errado, seleção inválida sem pedido, cancelamento A-B-A e sessão alterada.

Run `run-1789741538512`: acesso/escape HTML do imprimível e regressão visual com nomes/notas longos aprovados. 396 unitários/63 ficheiros e quatro técnicos aprovados; sintaxe 557 backend/182 frontend/56 inline. Runner 151 e 21 migrações mantidos. Cache v85; sem dependências/esquema novos.

Evidência `reports/field-visual/monthly-language-1789741509131`: cinco PDFs de seis páginas (PT/EN/FR/ES normais e francês com totais por rever), todas as 30 páginas revistas com Poppler. Extração independente pdfplumber confirmou notas até NOTE_END, texto literal, rodapés, margens e ausência de glifos NUL. Interface em `report-opening-1789741512522`, 320/390/1440 px. Dados sintéticos, sem clientes reais.

## Âmbito e retoma

Dez ficheiros: monthlyReportLanguage.js, monthlyPrintableReportService.js, reportController.js, report-center.html, report-center.js, sw.js, test-field-monthly-print.js, test-field-report-opening-ui.js e dois documentos de checkpoint.

CI nativo/restauro aprovados no registo abaixo. Próximo percurso: preferência explícita de idioma por cliente para relatórios individuais, sem inferir idioma pelo nome nem traduzir automaticamente notas. Outros documentos e referências fotográficas históricas não canónicas mantêm o âmbito anteriormente registado. Frequência por cliente/época/instalação preservada, três ou mais visitas conforme cada caso. Publicação só na branch de trabalho autorizada, sem merge/deploy.

## Aprovação nativa

Commit `2a3b4d643f1c6dbef81ebfa4bcc498f702d95a2d`, árvore `3d6964f98d28ed32ca65b294bc6a213906524ba0`, [CI 35356470158](https://github.com/ts7520305-svg/cristalwater/actions/runs/35356470158), job `105636935471`, concluído em 18/09/2026 às 14:45:26 UTC. 151/151 grupos distintos com código zero e sem sinal, 396 unitários/63 ficheiros, quatro técnicos, gate de navegador, 21 migrações aditivas e sintaxe 557/182/56. Fontes/idiomas mensais: 2544 ms; abertura autenticada UI: 10057 ms. Restauro isolado de 110 tabelas/46 ficheiros, com linhas e hashes iguais. Cache v85. Esta atualização posterior altera apenas documentação e conserva o código/testes validados. Publicação na branch autorizada, sem merge/deploy. Backup `backup/monthly-language-local-20260918`.
