# FCS Operational UX Blueprint V2

Data: 2026-07-26
Estado: proposta para aprovação funcional final (sem implementação nesta fase).
Objetivo: fechar regras operacionais definitivas para Técnico, Administrador e Cliente antes de qualquer alteração de páginas.

## 1) Decisão de fase

- Implementação UX-T1 permanece bloqueada.
- Esta V2 substitui a aprovação parcial anterior e consolida os requisitos operacionais críticos.
- Nenhuma função atual será removida sem migração validada por cenário real.
- Após aprovação final desta V2, a arquitetura operacional fica bloqueada.

## 2) Núcleo operacional único (mantido)

- O Centro Operacional continua a ser o núcleo para operação diária.
- Mantém-se a separação entre núcleo e subfluxos especializados.
- Não serão criados módulos duplicados de capacidade já existente.

## 3) Navegação mobile fixa V2 (obrigatória)

Ordem fixa da barra inferior:
1. Hoje
2. Agora
3. Mapa
4. Documentos
5. Mais

Regras:
- Agora deixa de ser apenas cartão interno e passa a acesso direto.
- Hoje mantém visão geral do dia e priorização.
- Agora mostra execução em tempo real para técnico e administrador.

## 4) Estrutura do ecrã inicial (Hoje)

Ordem operacional do ecrã:
1. Alertas críticos no topo (P0)
2. Barra de prioridade do dia
3. Piscinas do dia com separadores por estado
4. Cartão de continuidade da jornada
5. Pendências de documentos e segurança

## 5) Taxonomia única de estado operacional da piscina

Estados operacionais universais (obrigatórios):
1. Por iniciar
2. A caminho
3. Em intervenção
4. Água aberta
5. A aguardar material
6. Alerta crítico
7. Concluída

Regras:
- Todos os módulos devem usar exatamente esta linguagem de estado.
- Não é permitido criar estados locais paralelos por módulo.

## 6) Piscinas do dia (regra fechada)

Separadores obrigatórios:
1. Por fazer
2. Em curso
3. Concluídas

Regra de visualização:
- Não misturar estados numa lista única sem filtro.
- Cada piscina deve indicar estado operacional universal e risco ativo.

## 7) Estado Em intervenção (obrigatório)

Sempre que uma piscina estiver em execução, apresentar:
- nome da piscina/local
- técnico responsável
- tempo decorrido
- tipo de trabalho
- sinais de risco ativos (ex.: água aberta)

Modelo de referência funcional:
- Villa Sol | João Silva | 32 min | Reparação | Água aberta

## 8) Motor Central de Alertas (obrigatório)

Todos os alertas passam por um motor único de classificação e prioridade.

Categorias mínimas:
1. Água aberta
2. Bomba em manual
3. Visita agendada
4. Problema
5. Documento
6. Stock
7. Segurança

Metadados obrigatórios de responsabilidade por alerta:
1. Responsável atual
2. Quem criou
3. Quem recebeu
4. Quem confirmou
5. Quem resolveu
6. Data/hora em cada transição

Regra:
- O tipo não cria sistemas diferentes; apenas muda prioridade, SLA e escalonamento.
- O mesmo evento deve manter consistência entre Técnico e Administrador.

## 9) Regra de interrupção operacional (obrigatória)

Se surgir evento crítico (ex.: bomba manual, água aberta, alerta crítico de segurança):
- o fluxo normal é interrompido;
- os cartões críticos sobem automaticamente para o topo;
- a ação de mitigação fica disponível com CTA direto;
- após mitigação, o fluxo regressa ao ponto onde foi interrompido.

## 10) Documentos dependentes da viatura (obrigatório)

Ao mudar viatura ativa do turno, o contexto documental muda automaticamente para:
- seguro
- inspeção
- documentos da viatura
- guias
- fichas de segurança

Regras:
- nunca mostrar documento de viatura diferente da ativa;
- evidenciar validade e bloqueio quando documento crítico estiver vencido/ausente.

## 11) Fluxo completo de visita (sequência fechada)

Sequência operacional padrão (sem retorno ao menu principal):
1. Hoje
2. Escolher piscina
3. Check-in
4. Leituras
5. Químicos
6. Fotografias
7. Problema (se existir)
8. Ficha técnica (se necessário)
9. Check-out
10. Próxima piscina

Regras:
- o utilizador progride em continuidade de contexto;
- interrupções críticas entram por prioridade e depois devolvem ao passo ativo.

## 12) Ficha técnica com aprovação e alterações pendentes

Fluxo obrigatório de aprovação concentrado numa única superfície:
1. Valor atual
2. Valor proposto
3. Motivo
4. Fotos
5. Aprovar ou rejeitar

Regras:
- não obrigar o administrador a abrir várias páginas para decidir;
- toda alteração pendente mantém trilho completo de decisão.

## 13) Problemas com prioridade universal

Escala universal obrigatória:
1. P1
2. P2
3. P3
4. P4

Regras:
- não é permitido cada módulo usar critérios próprios de prioridade;
- o Motor Central de Alertas deve respeitar esta escala para problemas.

## 14) Offline primeiro (obrigatório de arquitetura)

Sem internet, o técnico deve continuar a:
1. trabalhar a visita
2. ver alertas locais
3. tirar fotografias
4. registar medições
5. sincronizar automaticamente quando a rede regressar

Regras:
- offline não é apenas funcionalidade, é requisito arquitetural;
- estados de sincronização devem ser visíveis e auditáveis.

## 15) Cliente: dados permitidos e proibidos (regra explícita)

Permitido para o técnico:
- instruções de acesso
- localização
- código de portão
- notas permanentes operacionais

Proibido para o técnico:
- valores
- faturação
- dívida
- histórico financeiro

Regra de privacidade:
- mostrar apenas dados mínimos necessários à execução da visita.

## 16) Centro do Cliente simplificado (obrigatório)

O cliente vê apenas:
1. próxima visita
2. histórico
3. fotografias
4. relatórios
5. pedidos
6. pagamentos
7. mensagens

Regras:
- retirar informação técnica interna do portal do cliente;
- manter linguagem simples e orientada à confiança do serviço.

## 17) IA transversal (não modular)

Princípio:
- IA aparece como assistente transversal contextual e não como módulo isolado.

Regra operacional:
- disponibilizar ação Perguntar à IA em páginas relevantes com contexto local.

## 18) Centro Operacional do Administrador (espelho ampliado)

Princípio:
- o administrador usa estrutura quase espelho da operação técnica, com visão ampliada de coordenação.

Inclui adicionalmente:
- supervisão multi-técnico em tempo real
- fila global de alertas por prioridade
- risco agregado por zona/rota
- capacidade de reatribuição e desbloqueio operacional

## 19) Centro de Comando do Administrador (obrigatório)

O Centro de Comando é uma sala de controlo em tempo real, não apenas dashboard.

Superfícies obrigatórias:
1. técnicos em trabalho
2. piscinas em intervenção
3. águas abertas
4. bombas em manual
5. alertas
6. visitas atrasadas
7. aprovações pendentes
8. problemas críticos

Regra:
- manter semântica comum de estados e alertas entre Técnico e Administrador para evitar divergência funcional.

## 20) Centro do Cliente (fecho V2)

Escopo do cliente nesta V2:
- acompanha estado do serviço, comunicação e instruções relevantes;
- não recebe dados internos de operação técnica que exponham segurança operacional;
- continua segregado de informação financeira sensível por perfil/permissão.

## 21) Integração vs subfluxo (V2)

Integra no núcleo:
- Hoje
- Agora
- Priorização P0/P1/P2
- Piscinas do dia por estado
- Alertas persistentes
- Estado Em intervenção
- Resumo documental por viatura
- Estado da ficha técnica com aprovação

Permanece como subfluxo especializado:
- Mapa detalhado
- Detalhe técnico da visita
- Gestão documental completa
- Novo cliente/alteração cadastral com aprovação

Fora do universo técnico (bloqueado):
- qualquer funcionalidade financeira

## 22) Funções que podem desaparecer ou ficar ocultas

Podem ser ocultadas após migração validada:
- entradas redundantes para a mesma capacidade
- ecrãs duplicados que apenas repetem lista e estado já presente no núcleo

Não pode desaparecer sem migração validada:
- qualquer função que suporte execução de visita, segurança, documentação obrigatória ou aprovação técnica.

## 23) Regras de implementação obrigatórias

Antes de criar nova página, responder explicitamente:
1. Esta função já existe?
2. Pode viver dentro de outro módulo?
3. Vai obrigar o utilizador a mudar de contexto?
4. Existe forma mais simples?

Regra:
- se alguma resposta indicar duplicação ou complexidade evitável, não criar nova página.

## 24) Riscos e dependências antes de implementar

Riscos:
1. excesso de informação no topo sem boa hierarquia visual;
2. inconsistência de estados entre núcleo e subfluxos;
3. duplicidade funcional se regras de integração não forem seguidas;
4. quebra de continuidade se offline e sincronização não forem desenhados desde início.

Dependências:
1. contrato único de estados de visita e intervenção;
2. motor central de alertas com SLA e escalonamento;
3. contexto documental vinculado à viatura ativa;
4. política de dados mínimos por perfil (técnico/admin/cliente);
5. plano de migração com testes funcionais por fluxo;
6. estratégia de sincronização offline com resolução de conflitos.

## 25) Confirmações explícitas de governação

Esta V2 confirma que:
1. técnico nunca vê valores financeiros;
2. técnico não vê informação privada não operacional do cliente;
3. alertas são geridos por um sistema único e consistente, com responsabilidade rastreável;
4. não serão criados módulos duplicados;
5. nenhuma função atual será removida sem migração validada.

## 26) Gate de aprovação para iniciar implementação

A implementação só pode começar após validação explícita desta V2 para os três centros:
1. Técnico
2. Administrador
3. Cliente

Sem esta aprovação, UX-T1 permanece bloqueada.
