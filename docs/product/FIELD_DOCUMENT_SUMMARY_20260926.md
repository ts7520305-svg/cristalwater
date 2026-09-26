# Resumo documental do modo de campo — TASK380

O separador Viatura de `/technician-field-mode` identifica agora os últimos oito consumos como um resumo, mostra a quantidade disponível e dá acesso à consulta completa dos movimentos da obra atual. Cada cartão identifica a sua origem e a data da consulta. Uma secção indisponível já não aparece como uma guia ou um seguro em falta.

## Contagem e consulta completa

O resumo contém apenas consumos da obra do próprio técnico, ordenados por criação e ID, dos mais recentes para os mais antigos. Apresenta oito de um total confirmado na consulta, ou todos quando existem menos de oito. Zero consumos tem texto próprio. Quantidades negativas, zero, unidades ausentes, unidades literais, notas e datas são conservados; as datas são apresentadas no horário de Lisboa.

A ligação «Consultar movimentos da obra atual» abre `/technician-guide#movementPanel`, onde a consulta paginada inclui também os outros tipos de movimento. Essa página volta a consultar a atribuição e a obra aberta atuais. A ligação não promete reabrir uma obra antiga que entretanto tenha sido fechada. A lista completa e os PDFs precisam de ligação.

A API de stock inclui `consumptionCount` quando devolve os consumos. Com `includeMovements=false`, conserva a lista vazia e indica `consumptionCount:null`; essa resposta não pode ser usada como uma lista documental completa. O cliente verifica contagens, cardinalidade, unicidade, ordem, tipo de movimento, identidade, quantidades e correspondência dos materiais. As consultas atuais também exigem o âmbito da conta e os cabeçalhos privados do leitor.

## Origem e recuperação

Guia AT, guia de obra e seguro/inspeção mostram separadamente «Consultado online», «Cópia guardada» ou «Consulta indisponível». Uma atualização parcial conserva a data original da secção recuperada. Consultar as outras secções não torna essa cópia atual. A cópia avisa que pode não incluir alterações posteriores.

Uma ausência confirmada pelo servidor continua distinta da falha de consulta. O estado de carregamento aplica-se aos três cartões. Uma recusa 401/403 continua a impedir a apresentação de todos os documentos operacionais guardados, preservando os bytes locais. As regras de sessão, conta, viatura, dia e início de visita mantêm os bloqueios existentes.

As cópias documentais v3 anteriores são preservadas e continuam utilizáveis dentro do respetivo âmbito. Quando não contêm metadados de contagem, a interface diz quantos consumos estão disponíveis na cópia e que o total da guia está por confirmar. Não converte o comprimento dessa lista num total confirmado. Metadados novos incoerentes, contagem truncada e cópias adulteradas são recusados sem destruir os bytes guardados. Sem rede não é possível descobrir uma reatribuição ou alteração posterior no servidor.

Os novos textos de origem, contagem, indisponibilidade, ligação e unidades ausentes estão disponíveis em português, inglês, francês, espanhol e alemão. Mudar o idioma conserva a data, os registos e a cópia. O restante modo de campo conserva o seu âmbito de tradução existente; nomes, locais e notas operacionais são apresentados literalmente.

## Validação

- 982 testes unitários em 117 ficheiros, 17 novos; quatro testes técnicos. Sintaxe: 689 scripts backend, 301 frontend e 44 inline.
- Dez grupos locais distintos aprovados: leitores de campo API; novo resumo no navegador; recuperação documental; âmbito documental no navegador; leitor completo no navegador; abertura autenticada; fecho de obra no navegador; entrada TEAM_LEADER; navegação/preferências; simulação mensal.
- O novo ensaio confirmou oito de 105 consumos e a ligação real aos 209 movimentos da obra. Verificou quantidades negativas/zero, unidade nula/literal, notas escapadas, contagens truncadas, duplicados, tipo errado, omissão de movimentos, âmbito e cabeçalhos incorretos, ausência confirmada, zero confirmado e falhas parciais.
- Recarregamento offline a frio, cópia v3 antiga, bytes adulterados preservados, ausência de cópia, regresso à rede, falha de gravação, respostas atrasadas, mudança de conta/viatura/dia e bloqueios operacionais cobertos pelos grupos novos e existentes.
- Comparação de 19 modelos durante as leituras da API e 13 no novo percurso do navegador; zero escritas de API na consulta e bytes do ficheiro AT original conservados. TECHNICIAN/TEAM_LEADER por PIN e User continuam verificados no grupo de âmbito.
- Dezoito capturas finais do novo resumo e estados, com textos em cinco idiomas e larguras 320/390/1440. Controlos de pelo menos 44 px, sem obstrução depois de deslocar a página, sem deslocação horizontal e contraste mínimo de 4,5:1 nos elementos revistos. As capturas de secções compridas usam uma janela mais alta para conservar a navegação fixa fora da secção, sem a ocultar.
- A inspeção visual levou a separar o local numa linha própria. O grupo integral foi repetido depois desse ajuste. O primeiro teste de datas assumia um zero inicial em todos os idiomas; passou a aceitar as duas representações locais da mesma hora de Lisboa. O log inicial está identificado na evidência.
- A simulação mensal voltou a criar cinco clientes, nove equipamentos, 54 visitas, 60 consumos, seis reparações e cinco faturas. O dashboard inclui também os dados sintéticos dos grupos anteriores.

[Evidência local](evidence/20260926_task380_local.json). QA local com PGlite 0.5.8/pglite-socket 0.2.11 e dados sintéticos, sem equivalência declarada ao PostgreSQL nativo. Nenhuma migração nova; 43 migrações aditivas existentes e 128 tabelas esperadas. Cache de aplicação v191; formato documental v3 conservado. Runner de 294 grupos distintos. Inventário: 126 HTML, 114 com referências literais em 315 scripts ativos, 12 sem referência literal, zero recursos ausentes e duas referências Git indisponíveis nesta cópia.

## Publicação e validação nativa

PUBLICATION_TASK380_PENDING

TASK378 e TASK379 permanecem em execução na última consulta, com dez etapas concluídas; os respetivos conjuntos de 292/293 scripts e restauro ainda não estão confirmados. TASK377 mantém o estado de interrupção, com 283/290 scripts concluídos e restauro ignorado. TASK376 conserva a confirmação de 288/288 e restauro de 128 tabelas/47 ficheiros. O orçamento do job continua a ser de 70 minutos, conservando os testes e o restauro.

## Retoma

Rever a apresentação de materiais e totais no modo de campo: `renderItems`, `renderUsage` e `totalByUnit` ainda substituem unidades ausentes por `UN`, juntam unidades após conversão para maiúsculas e excluem correções negativas do quadro de utilização. Confirmar o significado de «Usado hoje», duplicados, ausências, unidades e totais sem alterar saldos ou movimentos. A confirmação nativa da TASK380 e dos trabalhos anteriores continua pendente até obter o conjunto exato de scripts e o restauro.

Escala real dos materiais/obras, conciliação histórica, limites dos alertas, política operacional de cópias, VPS e piloto físico permanecem abertos. Sem merge, deploy ou contactos reais; aplicação não declarada completa.
