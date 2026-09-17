# TASK232 — Tempos médios com duração e identidade verificáveis

## Reprodução

`run-1789661652308` reproduziu uma média de 7 minutos quando as duas durações válidas eram 20 e 40 minutos. O cálculo anterior contava visitas planeadas, canceladas e sem horários no denominador; somava também durações negativas. Agrupava clientes/técnicos pelo nome e atribuía o histórico ao cliente atual da piscina. A página dependia de Chart.js externo e podia indicar carregamento concluído antes de falhar a apresentação.

## Comportamento atual

- Considera visitas regulares concluídas por estado ou data final; canceladas ficam excluídas. A média divide o tempo apenas pelas visitas com início/fim válidos e fim não anterior ao início. Mostra quantas visitas têm duração válida e quantas concluídas existem.
- Sem horários válidos, a média é desconhecida (`null` / «Sem duração válida»). Uma duração registada de zero minutos continua a ser zero, distinta de desconhecida.
- Agrupa pelas identidades de cliente e técnico. Homónimos permanecem separados; nomes históricos de técnicos sem associação usam grupos próprios. O cliente é o registado na visita: trocar o titular da piscina não transfere trabalho antigo. Visitas sem cliente identificado ficam assinaladas como tal.
- API administrativa com leitura privada sem cache e HTTP 500 em falha. A página distingue carregamento, erro, vazio e mudança de sessão; as barras locais têm a mesma escala e valores textuais, sem dependência de Chart.js.
- A revisão visual detetou que o adaptador antigo convertia `aria-busy` numa classe persistente de carregamento. O controlador partilhado das três listas declara agora que gere os seus estados, evitando o indicador preso e cartões estreitos. A regressão verifica ausência da classe e largura mínima dos cartões.

## Validação

| Ensaio | Evidência |
|---|---|
| Cálculos e identidades | `run-1789662076550`: 30 minutos na fixture original; contagens conhecidas, tempos negativos/ausentes, zero explícito, homónimos, nome `__proto__`, cliente ausente e troca de titular |
| Acesso e falhas | Mesmo ensaio: TECHNICIAN/TEAM_LEADER/CLIENT recusados, regressão completa dos acessos administrativos antigos, HTTP 503/resposta malformada/vazio e nova consulta |
| Apresentação final | `run-1789662192206`: grupo completo de ranking, métricas e prioridades aprovado; cartões em 320/390/1440 px; capturas revistas em `reports/field-visual/operational-pages-1789662198286` |
| Sintaxe | 539 JS backend, 171 JS frontend e 66 scripts inline aprovados; a extração de `/metrics` reduz os inline em um |

O indicador cobre todo o histórico regular; não inclui visitas extra, qualidade, custos, rentabilidade ou intervalos escolhidos. A consulta ainda materializa o histórico; os testes não demonstram dimensionamento para produção. A interface desta página mantém português. Nenhuma migração; o grupo operacional existente mantém o runner em 125 grupos.

## Regressão do CI anterior

O CI `35244873925` aprovou 124/125 grupos. No commit `d924f8a6d1c4ea9ff68abdba15791f9d4ef7faba`, aprovou a ficha técnica corrigida e as páginas da TASK230, mas falhou no teste antigo de privacidade de propostas. A asserção procurava `9876` em todo o JSON, incluindo versões criptográficas. Foi reproduzida uma proposta estritamente técnica cuja versão válida continha esses dígitos. A asserção passa a verificar os IDs visíveis, campos/diferenças e ausência dos valores financeiros nos dados, acrescentando recusa 404 da comparação e histórico da proposta financeira. A autorização da aplicação não foi alterada por este ajuste.

A regressão completa das propostas aprovou em `run-1789662299419`, incluindo interface ADMIN/técnico, transações, conflitos e privacidade. CI `35246742375` aprovado no commit `e1b9ddc4353781de43d04f716ae725bea47dc306`, árvore `a2e1ff48ed352cf5b42d39770a628178efc051ab`: 125/125 grupos, 388 unitários/quatro técnicos, 21 scripts de navegador, 20 migrações, sintaxe de 539 JS backend/171 frontend/66 inline e restauro de 110 tabelas/32 ficheiros com linhas/hashes iguais em PostgreSQL 16. O CI anterior terminou com falha e omitiu o restauro.
