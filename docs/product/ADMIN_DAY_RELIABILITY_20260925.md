# TASK358 — visitas do dia completas e estados distintos

## Problemas confirmados

O resumo `/admin-today` reutilizava `nextVisits` de `/api/core/dashboard`: apenas 20 visitas regulares pendentes, sem limitar o dia. Por isso, não podia apresentar o total real do dia, omitia concluídas/canceladas e não incluía extras. A classificação por `includes('done')` também tratava `NOT_DONE` como concluída. O agrupamento podia classificar uma visita cancelada como atrasada usando a data de criação, e a ligação `admin-visits?visitId=...` abria uma página que não consumia esse identificador.

## Alteração

- Nova consulta ADMIN `GET /api/core/visits/day/page`, privada antes da autenticação. Visitas regulares e extra por dia civil em **Europe/Lisbon**, com início inclusivo e fim exclusivo. Dias de mudança da hora respeitam 23/25 horas. Uma data vazia resolve hoje a partir do instante do servidor; depois da consulta, o endereço e o seletor conservam o dia confirmado.
- Nas regulares, a data planeada tem prioridade; apenas quando está ausente se usa `date`, identificado no cartão. Nos extras usa-se `scheduledAt`. Início/fim da execução são apresentados como valores registados e não mudam o dia da agenda. A página aceita dias de 2000 a 2199.
- Classificação por conjuntos explícitos de códigos, incluindo variantes históricas conhecidas. Planeadas/pendentes, em execução, concluídas, não concluídas, canceladas e outros estados têm contagens distintas. `NOT_DONE`, `INCOMPLETE` e `Não concluída` não entram nas concluídas; códigos desconhecidos conservam-se, sem inferir sucesso ou pendência. O estado original fica visível.
- Cinquenta visitas por página, ordenadas por agendamento/tipo/ID. Identidades `REGULAR:id` e `EXTRA:id` não colidem. Totais filtrados incluem todas as páginas e pertencem ao mesmo snapshot RepeatableRead. Pesquisa literal, filtros por tipo/estado e navegação no histórico/recarga.
- Cliente do registo conservado, mesmo após transferência da piscina. Associações em falta não usam o titular atual da piscina como substituto. Técnico associado, nome técnico guardado e conta do extra são campos distintos. Projeções mínimas sem contactos, PINs, palavras-passe, notas internas ou valores financeiros.
- Falha numa das consultas devolve 503 sanitizado, sem resultados parciais apresentados como dia vazio. Contrato validado no navegador: identidade, cabeçalhos, dia, limites, filtros, totais, ordem e chaves únicas. Erro, offline, timeout, sessão alterada/expirada e suspensão retiram os dados anteriores; respostas atrasadas não substituem o novo dia.
- Conteúdo próprio em PT/EN/FR/ES/DE. Totais antes dos filtros no telemóvel; explicação da base da consulta num bloco expansível. Ficha da piscina com ID explícito e revisão de registo concluído com tipo/ID, em vez da ligação antiga ignorada. A abertura real da revisão EXTRA foi verificada. Não há escritas nem notificações neste ecrã.

## Validação

676 testes unitários em 95 ficheiros, quatro técnicos e sintaxe de 638 ficheiros backend, 245 frontend e 49 scripts inline. Três grupos distintos de integração aprovados: resumo diário, acesso administrativo antigo e impedimentos/regressos de visitas extra. O grupo diário foi repetido após os ajustes finais de apresentação.

O cenário principal tem 55 visitas regulares e sete extras no dia, em páginas **50/12**: 48 planeadas/pendentes, duas em execução, três concluídas, quatro não concluídas, duas canceladas e três de outros estados. Cinco registos de outros dias são excluídos, mesmo quando a data alternativa ou a execução cai no dia escolhido. Inclui limite inicial, último milissegundo do dia, limite final excluído, mesma data/ID em tipos distintos, ausência de agenda regular, cliente antigo/piscina transferida, identidades em falta, conta antiga e pesquisa literal `50%_x`.

Ensaios adicionais de API verificam os dias 29/03/2026 e 25/10/2026, datas impossíveis/duplicadas, página inválida, autorização direta/global, erro da segunda consulta depois de ler regulares e ausência de dados sensíveis. Registos originais e contagens de visitas, extras, pagamentos, notificações, mensagens e emails conservados.

Chromium usa fuso do dispositivo **America/Los_Angeles**: o dia e as horas continuam em Lisboa. Testa páginas/totais, tipos/estados, destino EXTRA real, cinco idiomas, data escolhida pelo servidor, retorno do navegador, filtros restaurados após troca de conta, corpos/cabeçalhos falsos, 503, offline, timeout, resposta do dia anterior, suspensão e expiração. Trinta capturas regeneráveis em `reports/field-visual/admin-day/`, com página e cartão em 320/390/1440. PT390/PT1440 e DE320 revistos, incluindo cartões. A navegação comum mantém o âmbito anterior de tradução e os recursos binários ausentes apenas desta cópia mantêm a ressalva do inventário.

PGlite isolado, 40 migrações existentes, Chromium com múltiplos processos e segurança web ativa. Nenhuma dependência ou migração nova. Cache v169 e 255 grupos distintos no runner. Inventário: 115 HTML, 94 páginas referenciadas em 276 scripts ativos e 21 na fila de pesquisa. Referência literal continua a ser uma pista de cobertura, não um certificado de conclusão.

## CI e limites

TASK356 confirmada em [253/253 grupos e restauro nativo](evidence/20260925_task356_ci.json): 17 etapas e 127 tabelas/47 ficheiros com linhas e hashes iguais. Durou 38m34s, dos quais cerca de 35m na suite. O limite do workflow passa de 40 para **50 minutos** para permitir os novos grupos e o restauro; todos os testes, restrições de QA e etapas são conservados. YAML validado. TASK357 continua em execução no último controlo, ainda com o limite anterior.

Esta é a agenda das visitas regulares/extra, não a totalidade de reparações, lembretes ou alertas. Execuções com agenda noutro dia continuam nesse outro dia; não se infere atraso pelo relógio nem se certifica execução pelo estado guardado. A leitura carrega a projeção mínima das visitas do dia antes de filtrar/paginar em memória; volume de produção por medir. Não há reconciliação de dados antigos, alteração de planeamento ou mudança das APIs antigas usadas por outros ecrãs.

Lote validado localmente; publicação e CI desta alteração por confirmar. Sem merge, deploy de produção ou contactos reais. Restantes páginas, conciliação histórica, volume/VPS e piloto físico mantêm revisão própria. Aplicação não declarada completa.
