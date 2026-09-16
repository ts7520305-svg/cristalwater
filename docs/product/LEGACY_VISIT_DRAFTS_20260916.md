# Recuperação dos campos de visita antigos — TASK206

## Problema e alteração

Os seis campos do formulário antigo — observações, pH, cloro, alcalinidade, sal e produtos — só eram conservados num Map da página. Uma atualização da rota preservava o texto, mas recarregar ou fechar a página perdia o trabalho ainda não submetido. O formulário também não preenchia inicialmente os valores existentes na visita.

`cw-legacy-visit-drafts.js` guarda esses campos por identidade tipada e visita em `cwLegacyVisitDraft:v1:<conta>:<visita>`. O registo contém valores, valores de referência e instante de gravação; não inclui token. A página mostra se está a guardar, se guardou ou se ocorreu uma falha. O service worker v34 inclui o módulo para recarga offline.

A escrita local é sequenciada e coordenada por Web Locks. Antes de gravar, verifica a sessão, o conteúdo previamente observado e os pedidos de conclusão existentes. Quota, corrupção ou outra janela não permitem afirmar que o texto foi guardado. Dados ilegíveis ou de outra conta ficam intactos; o formulário bloqueia a submissão. Texto em memória continua visível após uma falha de quota, com um botão para voltar a guardar.

## Revisão e conclusão

Campos não alterados pelo técnico acompanham os valores da resposta atual da visita. Quando o servidor e o rascunho alteraram o mesmo campo de formas diferentes, o formulário apresenta ambos literalmente e exige escolher “Usar atual” ou “Manter rascunho”. Até à decisão e gravação, a conclusão fica bloqueada.

Uma alteração noutra janela bloqueia a janela desatualizada sem substituir o seu texto visível; a indicação pede para copiar esse texto antes de recarregar. Na conclusão, a página aguarda a gravação do rascunho e verifica o armazenamento partilhado de pedidos. Pedidos já preparados ou confirmados conservam o UUID e os campos originais; o rascunho fica para consulta e não reabre a conclusão como um envio novo. Mantém-se a recuperação de fotografias/conclusões das TASK201–202.

## Evidência

- `scripts/test-field-legacy-visit-drafts.js` passou integralmente em `field-qa-runtime/run-1789588488913`: seis campos e uma segunda visita após recarga realmente offline; falha de quota e repetição local; comparação por campo; duas janelas; conteúdo literal; JSON corrompido/titularidade inválida preservados; conclusão offline com o mesmo UUID após reload e uma só auditoria após recuperação; campos bloqueados após confirmação; callback tardio depois de mudar de conta.
- Revisão de largura a 320, 390 e 1440 px e captura do painel de conflitos em `reports/field-ui/VISIT_DRAFT_CONFLICTS.png`. Sem transbordo horizontal nem interpretação do texto como HTML.
- Quatro regressões dirigidas aprovadas em `run-1789587011461`: recuperação de fotografias/conclusões, recuperação da rota antiga, sugestão de rota e alerta interno. A correção final do ensaio espera pelo erro 503 e pelo fim da sincronização automática antes de testar o botão manual; não remove asserções.
- 370 unitários, quatro testes técnicos e sintaxe de 533 ficheiros backend aprovados. Runner ampliado para 110 grupos. Sem migração nova: confirmar a árvore publicada com CI nativo e restauro das 109 tabelas.

## Limites

A garantia de persistência começa quando aparece “Rascunho guardado”. Enquanto a gravação está em curso ou falhou, os campos em memória podem perder-se se o navegador for terminado à força. Há aviso de saída quando existe escrita pendente ou erro, mas o navegador controla esse aviso. Não há arquivo externo de rascunhos nem sincronização entre dispositivos.

A comparação usa os valores da última resposta recebida. Não acrescenta uma versão opaca ao contrato de conclusão e não evita todas as alterações concorrentes no servidor depois dessa leitura. Offline, a rota continua a ser uma cópia anterior e não comprova atribuição atual. Apagar os dados do navegador elimina os rascunhos locais; dados antigos já perdidos não são reconstruíveis.

Texto novo em português; revisão integral dos restantes idiomas/PDFs permanece no inventário. Sem deploy, alteração em main, fornecedores reais ou afirmação de conclusão global.
