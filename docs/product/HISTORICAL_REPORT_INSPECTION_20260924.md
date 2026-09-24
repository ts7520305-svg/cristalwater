# TASK334 — Consulta administrativa de visitas com cliente divergente

## Problema e âmbito

Os relatórios individuais recusavam a consulta quando `visit.clientId` diferia de `pool.clientId`, incluindo a administração. A recusa conservadora protege os clientes, mas impedia o escritório de consultar os registos necessários à revisão. A diferença de IDs, por si só, não demonstra uma transferência legítima nem permite escolher automaticamente um titular.

A TASK334 acrescenta uma consulta administrativa explícita, sem alterações à visita, ao cliente, aos comprovativos, aos custos ou às permissões de partilha. Abrange REGULAR/EXTRA, PDF/HTML e PT/EN/FR/ES.

## Comportamento

- Na configuração dos relatórios, carregar o cliente registado na visita e escolher **Consultar visita histórica — só administração**. O cliente pode estar arquivado; a consulta não o reativa.
- A API exige ADMIN, `view=admin`, `history=review`, cliente original selecionado e versão atual das configurações. Parâmetros duplicados/malformados, contexto incompleto, configurações antigas, cliente diferente ou ausência da divergência são recusados.
- O documento assinala **Origem por rever**. Mostra o ID do cliente inscrito na visita e o nome da sua ficha atual, identificado como tal, além do ID da instalação, dos registos técnicos, notas e fotografias da visita.
- Nome/morada/zona/equipamento/casa técnica atuais da instalação são omitidos, assim como a morada/zona atuais do cliente original. O nome atual do técnico EXTRA também não é apresentado como histórico.
- Mantêm-se a autenticação e verificação das fotografias, o escape de HTML, as fontes Unicode, a paginação e o idioma. O ficheiro, o título, o rodapé e o cabeçalho `X-CW-Report-Origin: historical-review` distinguem a consulta do relatório normal.
- O navegador confere a identidade da resposta antes de abrir o PDF, cancela respostas antigas quando muda o idioma/visita/cliente/sessão e permite repetir uma leitura após falha de rede. Não existem novos pedidos de escrita nem reenvios automáticos.

## Validação

Base: `a153c45518d07088466544177fdfa63d1ee20775`, após a confirmação documental da TASK328. Implementação isolada num worktree para conservar a cópia de retoma.

- 576 testes unitários em 78 ficheiros e quatro testes técnicos aprovados.
- Sintaxe: 622 ficheiros backend, 218 frontend e 62 scripts inline.
- PGlite local isolado com protocolo PostgreSQL, 40 migrações aditivas e Chromium: `test-field-visit-report.js`, `test-field-report-history-review.js`, `test-field-extra-report.js` e `test-field-report-opening-ui.js` aprovados em sequência.
- Novo grupo: recusa para ambos os clientes/técnico/sem sessão, versão obsoleta, IDs/consultas inválidos, cliente ausente ou arquivado, volta ao titular original, dados atuais omitidos, fotografias, quatro idiomas, ausência de escritas e conservação das visitas. Navegador em 320/390/1440 px, origem de resposta falsificada, mudança durante a leitura, recuperação offline e mudança de conta.
- Inspeção visual: duas páginas do PDF REGULAR português e duas do EXTRA francês, além dos controlos em ecrãs estreito/largo. Sem cortes ou sobreposições nos documentos. Não representa auditoria visual integral da aplicação.
- O runner passa de 230 para 231 grupos distintos. Evidência local e hashes: [20260924_task334_local.json](evidence/20260924_task334_local.json).

Uma primeira asserção final comparava `updatedAt` com o valor anterior a uma mudança deliberada de cliente feita pelo próprio teste. Passa a comparar o estado imediatamente anterior às consultas do navegador; a verificação de ausência de escritas conserva `updatedAt`. Os dados EXTRA do novo teste usam a sequência normal, evitando colisões com os grupos seguintes. Estas correções não alteram as proteções da aplicação.

## Limites e retoma

Esta consulta não atesta a titularidade histórica, não corrige/atribui o cliente e não desbloqueia o relatório para clientes ou técnicos. A eventual confirmação administrativa da origem e uma disponibilização posterior ao cliente exigem um fluxo próprio, com evidência, histórico e tratamento explícito das contradições. Visitas sem cliente confirmado continuam bloqueadas.

Sem novas tabelas, migrações ou dependências. Cache v148. Confirmar o CI completo e restauro PostgreSQL 16 do commit publicado; os ensaios locais e o sucesso de versões anteriores não substituem essa confirmação. Sem merge, deploy ou contactos reais.

## Publicação

Código `93fb9aa452017b0391b4116c204c58256711ba1f`, árvore `2a6cc16c4e84e18965a24e132a57e19b3917ad65`, igual à preparada localmente. Publicado sem force na branch de trabalho existente. [CI 36045589129](https://github.com/ts7520305-svg/cristalwater/actions/runs/36045589129) iniciado; conclusão/restauro pendentes. Branch principal conservada em `6f27081e1d183ff584a62255b016b373836734db`.
