# TASK373 — Atribuição de técnicos a viaturas

## Comportamento

`/vehicle-assignment` oferece à administração uma revisão própria para atribuir, mudar ou retirar a viatura de um técnico. A entrada existe na frota e em cada cartão da gestão de técnicos. As listas são paginadas, a viatura escolhida permanece identificada ao pesquisar e o formulário exige uma escolha explícita e um motivo.

- A revisão mostra o técnico, as viaturas anterior/seguinte, o registo aberto a fechar, a criação do novo intervalo, obras abertas na viatura seguinte e leituras anteriores/finais.
- Vários técnicos podem partilhar a mesma viatura. Qualquer obra aberta do técnico bloqueia a mudança ou remoção; a página liga ao fecho revisto existente. Obras de outro técnico na viatura seguinte são identificadas, conservadas e não são transferidas.
- A escolha «Manter leitura» conserva também nulo. «Indicar leitura observada» aceita zero e até três casas decimais, sem coerção de formatos ou diminuição do valor atual. Só esta escolha altera o conta-quilómetros da viatura seguinte. A viatura anterior conserva a leitura.
- Uma atribuição inalterada é recusada para evitar novos intervalos redundantes. Atribuir exige técnico e destino ativos e não arquivados; retirar a atribuição também é possível para um técnico inativo, depois de fechar as suas obras.
- Técnico, fecho do intervalo anterior, novo intervalo, eventual leitura, auditoria autenticada e comprovativo são gravados na mesma transação. Os contactos, credenciais, custos, sessões, visitas, obras, materiais e documentos existentes permanecem intactos.
- Conserva-se a data inicial exata do intervalo fechado. Fecho e abertura usam o mesmo instante real de confirmação. A remoção fecha o intervalo sem criar um registo com viatura nula.
- Mais de um intervalo aberto, viatura incompatível, intervalo aberto sobreposto ao último fecho ou datas futuras bloqueiam a operação. Quando a atribuição atual não tem intervalo aberto, a revisão expõe a lacuna: o início anterior continua desconhecido e não é inventado. O lote não reconcilia todos os intervalos históricos fechados.

A edição normal do técnico conserva a viatura e encaminha para esta revisão própria; o servidor recusa tentativas de mudar a relação nesse percurso. A criação de um técnico com viatura inicial insere agora o respetivo histórico na mesma transação de criação/auditoria/comprovativo. O POST antigo de atribuição devolve 409. As simulações de mês e de dois anos passaram a exercitar o percurso revisto, sem voltar ao escritor antigo.

## Concorrência e recuperação

Prova assinada de cinco minutos, vinculada à conta, UUID, proposta e estado revisto. Confirmação verifica novamente técnico, ambas as viaturas, histórico e obras. A ordem de bloqueios acompanha a abertura/fecho de guias: bloqueios de viatura por ID ordenado, obras, técnico, viaturas e histórico. Uma alteração concorrente obriga a rever novamente; uma abertura elegível de obra e uma reatribuição não podem confirmar em simultâneo.

Perda de resposta, reinício e repetição concorrente devolvem o comprovativo original. A referência mínima fica no separador por conta; motivo, leitura e prova ficam em memória. Anulação persistente impede confirmação tardia. A página recusa respostas incompletas, origem/proprietário incoerentes, referências ilegíveis, falhas de armazenamento e sessões trocadas ou expiradas. Recuperação compara o conteúdo JSON sem depender da ordem das chaves devolvidas pelo PostgreSQL.

## Validação

889 testes unitários em 110 ficheiros, incluindo 14 novos; quatro testes técnicos; sintaxe de 675 scripts backend, 285 frontend e 44 inline. Dez grupos locais distintos aprovados:

1. Atribuição API: permissões, validação explícita, seis reversões SQL, intervalos exatos, nulo/zero, partilha de viatura, obras abertas, duas confirmações concorrentes, abertura real elegível de obra, estado/histórico alterados, perda/reinício/repetição/anulação, paginação e preservação dos ficheiros oficiais.
2. Atribuição no navegador: entradas reais da frota e técnicos, bloqueio/ligação da obra aberta, revisão/remoção, seleção conservada nas pesquisas, dados escapados, duplo clique, perda de resposta, offline/recarregar, troca de sessão, expiração e armazenamento indisponível/corrompido.
3. Técnicos API: atribuição conservada ao editar; histórico inicial criado uma vez; falha de inserção desse histórico reverte a criação inteira; restantes permissões, contactos, credenciais e recuperações preservados.
4. Técnicos no navegador.
5. Frota API.
6. Frota no navegador.
7. Criação de guias de transporte API.
8. Fecho de obra API.
9. Simulação mensal pela API.
10. Simulação acelerada de dois anos pela API.

Dezoito capturas da atribuição em português, inglês, francês, espanhol e alemão, larguras 320/390/1440 e controlos de 44 px. Revistas visualmente `de-320.png` e `review-pt-1440.png`. A primeira revisão visual detetou uma frase herdada do consumo; corrigidos os textos próprios e repetido integralmente o grupo de navegador. O texto completo da opção de quilometragem também está visível fora do seletor móvel.

QA isolada com dados sintéticos, PGlite 0.5.8/socket 0.2.11 e Chromium 153. Nenhuma migração nova; 43 migrações aditivas existentes aplicadas e 128 tabelas esperadas. Os ensaios locais de concorrência não substituem PostgreSQL nativo. Evidência: `evidence/20260926_task373_local.json`. Inventário: 123 HTML, 116 de raiz e sete auxiliares, 111 com referência literal em 303 scripts ativos, 12 sem referência literal; nenhum recurso em falta e dois recursos rastreados indisponíveis na cópia local.

## Publicação e próximo ponto

Publicado em `81c6feb4c166db33de227b3456f41843ff7c85ff`, árvore `6eebdb979f68ea7c5d5273a22e06c0588b2a3d97`, na branch `work/field-readiness-20260915-simulation`; árvore remota idêntica à preparada localmente. [CI 36218570468](https://github.com/ts7520305-svg/cristalwater/actions/runs/36218570468), job `108339358313`, em execução. Runner com 282 grupos; cache v184. Gate PostgreSQL nativo e restauro deste lote ainda não confirmados. Sem merge, deploy ou contactos externos.

TASK372: [CI 36217019968](https://github.com/ts7520305-svg/cristalwater/actions/runs/36217019968), job `108334888707`, ainda em execução na última consulta; 280 grupos e restauro pendentes de confirmação. Último gate integral confirmado: TASK371, 278/278 e restauro de 128 tabelas/47 ficheiros com linhas e hashes iguais.

Continuar nos presets de materiais da frota: `saveVehicleStockPreset` grava `SystemSetting` e auditoria separadamente; leitura inválida pode surgir como lista vazia e a normalização antiga aceita alterações implícitas de unidades/quantidades. Rever origem, preservação, validação, concorrência com abertura de obra e recuperação. Regras de alerta e quilometragem na abertura antiga de obra continuam por rever. Conciliação histórica, volume real, arquivo/cópias operacionais, VPS e piloto físico permanecem abertos; aplicação não declarada completa.
