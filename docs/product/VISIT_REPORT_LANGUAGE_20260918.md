# TASK263 — Idioma explícito dos relatórios individuais

## Contrato e comportamento

PDF e HTML REGULAR/EXTRA aceitam `lang=pt|en|fr|es`; omissão conserva português. Arrays, objetos, vazio, códigos desconhecidos, variantes regionais e valores de protótipo são recusados com 400. `Content-Language` identifica a resposta; HTML declara o idioma. Datas usam a convenção do idioma escolhido mantendo Europe/Lisbon e a indicação de hora de Portugal.

Catálogo único para títulos, rótulos, sim/não, ausência/revisão de dados EXTRA, fotografias/limites e caracteres não suportados. Apenas literais gerados pelo sistema são traduzidos. Nomes, produtos, unidades, notas públicas/internas, planeamento, ocorrência e texto da casa técnica conservam o original, mesmo quando coincidem exatamente com uma mensagem traduzível. Códigos de estado e valores técnicos guardados permanecem como registados. O adaptador EXTRA recebe um tradutor opcional; os restantes consumidores conservam o português anterior.

Seletor Português/English/Français/Español nas configurações de relatórios, para pré-visualizações cliente e ADMIN, REGULAR e EXTRA. A escolha integra o contexto do pedido: mudança de idioma cancela a abertura anterior; resposta com idioma diferente é recusada. Mantêm-se sessão, conta, cliente histórico, tipo/ID, versão das configurações, permissões e cancelamentos. Escolha apenas para esta página/pedido, sem gravar uma preferência do cliente ou alterar o idioma global da aplicação. Os pontos de abertura que ainda não enviam lang conservam português.

## Validação

Run local `run-1789738019169`: relatório individual (incluindo traduções/UI), EXTRA, fotografias, abertura nas configurações/centro mensal e alertas aprovados. PT/EN/FR/ES em PDF e HTML para os dois tipos; cliente/ADMIN, texto original coincidente com catálogo, ausências e dados malformados EXTRA, avisos fotográficos, códigos inválidos, ausência de escritas e fonte intacta. Teste real do seletor, abertura nos quatro idiomas e EXTRA francês; cancelamento durante resposta em voo, recusa de Content-Language diferente e bloqueio após troca de sessão.

396 unitários/63 ficheiros e quatro técnicos aprovados; sintaxe 556 backend/182 frontend/56 inline. Runner mantém 151 grupos, 21 migrações. Cache v83. Sem dependências ou alterações de esquema.

Evidência sintética em `reports/field-visual/visit-report-1789738024059`: oito PDFs cliente de duas páginas (quatro idiomas × dois tipos) e francês ADMIN de cinco páginas com nota longa e aviso Unicode. As 21 páginas foram renderizadas por Poppler do sistema, revistas visualmente e extraídas independentemente por pdfplumber; sem glifos NUL nem texto cortado, rodapés presentes. Interface revista em 320/390/1440 px, seletor dentro do ecrã. Dados de QA, sem clientes reais.

CI nativo/restauro pendentes da publicação.

## Ficheiros e limites

Dez ficheiros: `visitReportLanguage.js`, `visitReportService.js`, `visitReportPhotoService.js`, `extraVisitReportProjection.js`, `report-settings.html`, `report-settings.js`, `sw.js`, `test-field-visit-report.js`, este documento e `CURRENT_WORK_CHECKPOINT.md`.

Não é tradução automática das notas, nem tradução integral da aplicação ou dos outros documentos. Mensagens de erro da API/interface permanecem em português. Outros pontos de abertura, preferências por cliente, restantes idiomas e referências fotográficas históricas não canónicas são percursos seguintes. Cobertura Unicode mantém os limites documentados na TASK262. Publicação apenas na branch de trabalho autorizada, sem merge/deploy. Frequência por cliente/época/instalação continua caso a caso: três ou mais visitas quando necessário.
