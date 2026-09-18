# TASK260 — Relatórios individuais de visitas extra

## Resultado e contrato

PDF e HTML imprimível aceitam `visitType=EXTRA` nas rotas individuais existentes. A omissão conserva REGULAR; só são aceites estes dois valores exatos. A identidade combina tipo e ID, incluindo `X-CW-Visit-Type`, `X-CW-Report-Type` e nome do PDF, evitando confundir registos de tabelas diferentes com o mesmo número. O campo de negócio ExtraVisit.visitType (por exemplo ONE_OFF) não é este discriminador.

A projeção usa apenas os campos conhecidos de execution para medições, verificações, químicos e observações. Não permite que esse JSON substitua ID, cliente ou estado. Dados ausentes são identificados como não registados e dados malformados como por confirmar; verificações ausentes não se tornam respostas negativas. Os químicos exigem nome/unidade válidos e quantidade numérica positiva. A data planeada vem de scheduledAt e o técnico é identificado explicitamente como atribuição atual.

Indicações de planeamento, ocorrência e notas internas aparecem apenas na apresentação ADMIN. A apresentação de cliente respeita as configurações guardadas e a versão confirmada. Mantêm-se titularidade histórica direta, técnico atribuído e consistência entre cliente e instalação. A leitura não escreve nem emite documentos financeiros.

Fotografias exigem extraVisitId e nome canónico extra-visit para EXTRA; REGULAR exige visitId e visit. Mesmo IDs coincidentes não permitem cruzar imagens. Mantêm-se hash, limites, descodificação, ausência de pedidos externos e mensagens de indisponibilidade descritos em VISIT_REPORT_PHOTOS_20260918.md.

Nas configurações de relatórios, o seletor Regular/Extra abre as duas apresentações por autenticação existente. Confirma os cabeçalhos da resposta e cancela a janela/pedido ao mudar tipo, visita, cliente, opções ou sessão. Popup bloqueado permite nova tentativa. Cache passa a v81.

## Verificação local

Novo grupo test-field-extra-report.js: envio e conclusão reais de uma visita extra, IDs coincidentes, isolamento de fotografias, PDF/HTML, autorização de cliente/técnico/ADMIN, configurações e versão, dados antigos ausentes/malformados, JSON com campos indevidos e contagens sem efeitos de escrita. Navegador confirma abertura autenticada de ambos os tipos, resposta de tipo errado recusada, troca durante pedido, sessão invalidada e disposição a 320/390/1440 px.

O novo grupo e regressões do relatório regular, fotografias e abertura nas configurações passaram em run-1789732329925. Evidência em reports/field-visual/extra-report-1789732338617: duas páginas cliente e três ADMIN renderizadas com Poppler e revistas, incluindo cabeçalhos, rodapés, foto e notas privadas; interface estreita revista. Fixtures são sintéticas.

395 testes unitários/63 ficheiros, quatro técnicos e sintaxe 553 backend/182 frontend/56 inline aprovados. Runner passa a 151 grupos. Sem migração: mantêm-se 21 aditivas. CI nativo e restauro PostgreSQL 16 aguardam publicação desta árvore.

## Limites e continuidade

O novo ponto de abertura é o seletor nas configurações; os alertas ainda só abrem relatórios REGULAR. O relatório mensal não foi alterado. Fontes Unicode/tradução integral e referências fotográficas históricas não canónicas continuam pendentes. Técnico/equipamento são registos atuais, não snapshots históricos. A frequência permanece individual por cliente/época/instalação: três ou mais visitas conforme o caso.

TASK limitada a dez ficheiros: dois serviços, controller, HTML/JS de configurações, cache, runner, novo teste e dois documentos. Publicação autorizada apenas na branch de trabalho, sem merge ou deploy.
