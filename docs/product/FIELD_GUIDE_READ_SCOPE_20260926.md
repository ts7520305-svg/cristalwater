# TASK378 — Leituras de campo em viaturas partilhadas

## Comportamento

As consultas antigas de `/api/guides` passam a ter um percurso de leitura próprio para TECHNICIAN e TEAM_LEADER, por PIN ou conta User ligada a um técnico. A atribuição atual, o técnico e a viatura ativos são confirmados numa transação por pedido. A filtragem anterior por viatura não bastava: movimentos, relações de obras e PDFs podiam incluir trabalho de outro técnico da mesma viatura.

Obras, stock e PDFs de obra são agora limitados ao próprio técnico na viatura atual. A lista de AT conserva as guias da viatura, mas só inclui as obras do próprio técnico. A ficha da viatura só projeta o próprio técnico e a sua última obra. Movimentos sem técnico só entram quando pertencem a uma obra do próprio; um movimento contraditório, com o técnico atual e a obra de um colega, fica excluído. Uma visita associada a outro técnico exige revisão dos dados.

Guias AT, seguro, inspeção e manutenção continuam no âmbito da viatura atual. A consulta de um PDF de obra alheia é recusada mesmo numa viatura partilhada. Os geradores existentes recebem os dados autorizados da mesma consulta; documentos oficiais e respetivos bytes são conservados. ADMIN mantém os contratos existentes e o histórico administrativo paginado da TASK377.

As respostas usam listas explícitas de campos operacionais. Contactos e credenciais do técnico, custo horário, custos da manutenção, notas privadas da viatura, autor de carregamento e chaves adicionais dos metadados não são enviados aos perfis de campo. O nome do cliente/local necessário ao movimento continua disponível apenas através de visitas próprias. Referências documentais expõem caminhos protegidos, sem URLs de armazenamento. JSON arbitrário em notas não é reenviado; o formato operacional conhecido conserva apenas texto, local e leituras permitidos. Notas textuais não interpretadas como JSON são conservadas, sem classificação semântica de dados pessoais escritos nesse texto. Os originais na base de dados não são alterados.

Listas de AT, obras, movimentos e manutenção devolvem total, limite, posição e indicação de mais resultados. O limite predefinido e máximo é 200. Filtros desconhecidos, IDs não canónicos, parâmetros repetidos e limites inválidos são recusados. Cada total/página é coerente dentro da transação; alterações entre pedidos podem mudar a paginação. A consulta de stock conserva todos os materiais e consumos próprios da obra aberta, sem um corte silencioso de movimentos.

Sem atribuição, as listas ficam vazias com âmbito explícito; pedir uma viatura concreta alheia é recusado. Técnico/viatura inativos, várias obras abertas, várias AT ativas, metadados documentais inválidos e associações incompatíveis não produzem uma confirmação operacional indevida. Falhas SQL devolvem indisponibilidade.

## Recuperação offline e apresentação

O centro documental de campo usa a mesma projeção no navegador e a cache v3, vinculada à identidade PIN/User, papel, técnico, viatura e dia. Uma resposta 200 de outro técnico não pode substituir os documentos próprios. Uma cópia atual com obra alheia ou campos privados adicionais é recusada e os bytes ficam preservados. Cópias v2 antigas também ficam preservadas, mas exigem consulta online antes de voltarem a ser usadas. Mantêm-se a origem e a data de confirmação por secção, a proteção contra respostas atrasadas, a recusa de acesso e os erros de armazenamento.

Sem rede não é possível descobrir uma reatribuição entretanto feita no servidor; a cópia conserva o âmbito e a proveniência da última consulta aceite. Uma recusa online impede a apresentação dos documentos guardados nessa consulta.

A revisão visual do separador real «Viatura» identificou ações documentais sobrepostas no estilo herdado. Metadados passam a linhas separadas e as ações têm disposição flexível, quebra de texto, separação e altura mínima de 44 px. As três capturas finais mostram os documentos efetivamente visíveis, em 320/390/1440 px; o teste confirma ausência de sobreposição das ações e a largura do cartão de obra. Não foi criada uma nova página.

## Validação

- 954 testes unitários em 115 ficheiros, incluindo dez novos; quatro testes técnicos. Sintaxe: 689 scripts backend, 298 frontend e 44 inline.
- Onze grupos locais distintos aprovados: novo âmbito API/navegador, recuperação documental, abertura autenticada, documentos AT no navegador, histórico da frota API/navegador, criação AT, abertura de obra, navegação/preferências e simulação mensal.
- Perfis TECHNICIAN/TEAM_LEADER por PIN/User, nove leitores JSON e quatro percursos PDF; mesma viatura com duas obras/técnicos, filtros alheios, identidade incoerente, reassociação, arquivo, ausência de atribuição e duplicação de obra aberta.
- Percurso completo de 207 movimentos próprios em três páginas, com IDs distintos, ordem e totais. Quatro falhas SQL reais em Vehicle, SystemSetting, WorkGuideItem e VehicleStockMovement, executadas num segundo processo com o router real.
- Comparação de 19 modelos na API e 13 no navegador; zero escritas de API no percurso de consulta e bytes oficiais inalterados. Testes de gravação adjacentes mantêm os seus cenários de transação, repetição e recuperação.
- Cache antiga e cache atual adulterada preservadas sem apresentação; recarga offline a frio, resposta do colega, recuperação online e ambos os tipos de identidade. Grupo de navegador integral repetido após a correção das capturas e da disposição das ações.
- Preparação inicial corrigida: o servidor auxiliar de falhas SQL precisava do router de guias; a fixture documental precisava de uma inspeção válida. Os grupos integrais passaram depois, sem remover essas verificações. Os dois logs iniciais estão identificados por hash na evidência.
- A simulação mensal criou cinco clientes, nove equipamentos, 54 visitas, 60 consumos, seis reparações e cinco faturas; o total de clientes do dashboard inclui também os dados de preparação dos grupos anteriores.

[Evidência local](evidence/20260926_task378_local.json). QA com PGlite 0.5.8/pglite-socket 0.2.11 e dados sintéticos, distinto do gate PostgreSQL nativo. Sem nova migração; aplicadas as 43 existentes, com 128 tabelas. Cache v189 e runner com 292 grupos distintos. Inventário: 126 HTML, 114 com referências literais em 313 scripts ativos, 12 sem referência literal, zero recursos ausentes e duas referências Git indisponíveis nesta cópia.

## Publicação e validação nativa

Publicada em `abd01eeef4ab0fd19bd7cb8af3cbc197a478a415`, árvore `b29eac80da8445daadc511bd65aa957e13405c9e`, idêntica à preparada e validada localmente, na branch `work/field-readiness-20260915-simulation`. [CI 36226988288](https://github.com/ts7520305-svg/cristalwater/actions/runs/36226988288), job `108362806296`, em execução. O gate PostgreSQL nativo de 292 grupos e restauro permanece por confirmar.

TASK376 confirmada no [CI 36223589014](https://github.com/ts7520305-svg/cristalwater/actions/runs/36223589014), job `108353287692`, código `8fb9e816311880c22696c1c695e810efa75d3af1`: 288/288 scripts esperados distintos, todos zero, 17 etapas aprovadas e restauro de 128 tabelas/47 ficheiros com linhas e hashes iguais. [Evidência nativa](evidence/20260926_task376_ci.json). TASK377, [CI 36225374723](https://github.com/ts7520305-svg/cristalwater/actions/runs/36225374723), job `108358260658`, ainda em execução na última consulta; 290 grupos e restauro por confirmar.

## Retoma

Continuar nos consumidores antigos, começando por `/technician-guide`: ainda corta os movimentos aos últimos dez, converte propriedades ausentes em listas vazias e cria ligações PDF que precisam de revisão no percurso autenticado real. Rever completude, paginação, mensagens de indisponibilidade e conservação da seleção. O âmbito dos dados destas consultas já é aplicado no servidor.

Volume real e escala da seleção de obras/movimentos, conciliação histórica, limites dos alertas, política operacional de arquivo/cópias, VPS e piloto físico continuam abertos. Sem merge, deploy ou contactos reais; aplicação não declarada completa.
