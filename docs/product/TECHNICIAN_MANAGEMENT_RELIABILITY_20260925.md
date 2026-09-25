# TASK364 — gestão de técnicos e preservação do acesso

## Problema e âmbito

Em `/admin-technicians`, alterar apenas PIN ou atividade usava o mesmo normalizador da criação: email, telefone e zona omitidos eram substituídos por valores vazios e a atividade podia voltar a verdadeiro. A página mostrava e pesquisava PINs, usava `1234` por omissão e permitia repetir gravações sem comprovativo. O caminho de eliminação verificava apenas parte das relações. Sessões existentes não eram revogadas de forma persistente após mudar PIN ou desativar/reativar o técnico.

O lote corrige identidade/contactos, associação explícita de viatura, PIN, ativação, desativação e arquivo do técnico. Rondas, visitas, custos, histórico e contas User continuam nos respetivos módulos. Os avisos antigos desta página, que convertiam falhas de leitura em listas vazias, dão lugar a ligações para a frota e o painel operacional; estes módulos não são declarados reavaliados por esta mudança.

## Comportamento

- Cada operação tem campos permitidos próprios. Mudar PIN ou atividade preserva os contactos, custos e restantes atributos. Editar dados permite retirar a viatura com escolha explícita. Arquivar conserva a linha e as relações; reativar conserva o histórico. A página não cria contas User, não altera papéis nem reatribui rondas/visitas.
- Revisão anterior à gravação mostra ID/nome, estado atual, proposta, eventual conta com o mesmo email e efeito nas sessões. Prova assinada de cinco minutos liga administrador, pedido, campos e versão dos registos consultados. Mudança entretanto ocorrida exige nova revisão. A gravação bloqueia o técnico e a viatura consultada, serializa os escritores deste fluxo e confirma alteração, auditoria e comprovativo na mesma transação.
- UUID por administrador com comprovativo recuperável por GET. Resposta perdida, reinício e repetições concorrentes devolvem o mesmo resultado. Conteúdo ou proprietário diferentes são recusados. Encerrar uma tentativa conserva uma anulação que impede gravação tardia; se já tiver sido concluída, devolve o comprovativo existente. O registo genérico de pedidos oculta credenciais também em objetos e listas internos, com profundidade limitada, sem alterar o pedido real. Auditoria e comprovativo não contêm PIN nem os campos secretos do pedido; o resumo usa HMAC.
- Formulário, PIN e prova ficam apenas em memória. Só `{version, owner, operation, technicianId, requestId}` permanece no `sessionStorage` do mesmo separador e conta. A referência é escrita e relida antes do envio. Quota, escrita ignorada e bytes ilegíveis impedem novo envio; os bytes anteriores são conservados. Arranque, regresso e recarregamento não reenviam operações. Sem o corpo original em memória, só há consulta/anulação da tentativa.
- A escolha do técnico permanece estável durante pesquisa, paginação e mudança de idioma. Trocar de preparação exige descartar explicitamente a atual. Suspensão, expiração e mudança real de conta limpam formulário, prova e listas e impedem respostas atrasadas de os repor. Texto dos dados usa `textContent`.
- Novos PINs exigem 6–12 algarismos e repetição, conservando zeros iniciais. Criar sem PIN é permitido; não há valor predefinido. Novos PINs são guardados com bcrypt de custo 12. PINs históricos em texto permanecem utilizáveis e não são reescritos no login. PIN duplicado é recusado nas novas gravações; login legado ambíguo não escolhe arbitrariamente uma identidade. Listas antigas e novas deixam de expor o campo PIN.
- A nova coluna `Technician.authVersion`, inicializada a zero, invalida JWTs técnicos e JWTs User associados após mudança de PIN, email de associação, ativação, desativação ou arquivo. Tokens sem a coluna de versão são tratados como versão zero e deixam de funcionar após a primeira alteração. Reativar não recupera tokens antigos. Editar contactos/nome/viatura não termina sessões.
- O estado da conta User não é alterado. Após desativar o técnico, o seu PIN não autentica e os JWTs associados anteriores são recusados. O login próprio da conta User e o acesso existente ao workday sem perfil de campo associado mantêm as regras anteriores; a gestão dessa conta continua em `/admin-security`.
- Diretório com total, páginas de 25 e filtros de nome/email/telefone/zona/atividade. Erro, pacote parcial ou resposta de proprietário incoerente não são apresentados como lista vazia válida. Apenas a pesquisa mais recente pode preencher o diretório. Os leitores antigos conservam os formatos de resposta necessários aos módulos existentes; os escritores antigos recebem 409 e exigem revisão no novo fluxo.
- Conteúdo próprio em PT/EN/FR/ES/DE, estados explícitos e controlos de pelo menos 44 px, com exceção da caixa de confirmação de 24 px integrada numa etiqueta clicável. A navegação comum conserva as traduções existentes. A memória genérica antiga não é importada nem reescrita.

## Validação

**745 testes unitários em 101 ficheiros**, incluindo doze novos, e quatro testes técnicos aprovados. Sintaxe: 646 backend, 258 frontend e 44 scripts inline. Prisma validado e cliente gerado. Sem novas dependências ou tabelas; **42 migrações aditivas**, incluindo uma nova coluna com restrição de valor não negativo.

O ensaio SQL aplicou as 41 migrações anteriores, criou um técnico legado, aplicou a nova migração e comparou todos os seus atributos, incluindo PIN, contactos, custo e histórico: iguais, com versão zero. Valor negativo recusado. O gate de migração nativo foi atualizado para esta preservação e será executado no CI; este ensaio local usa PGlite e não é apresentado como PostgreSQL nativo.

Nove grupos distintos aprovados:

1. `test-field-technician-management.js`: API real, autorização, lista privada sem PIN, versões/campos/proprietário, hash e compatibilidade legada, dois processos e reinício após resposta perdida, cinco repetições concorrentes, rollback de auditoria/comprovativo, PIN duplicado/ambíguo, sessões PIN/User, arquivo sem eliminação, veículo removido explicitamente, prova caducada/alterada, anulação e paginação.
2. `test-field-technician-management-ui.js`: página/API reais, confirmação explícita e duplo clique uma vez, preservação dos campos, PIN repetido e hash, ativação/desativação, respostas perdidas, recuperação só com referência, envio offline/repetição exata, anulação, revisão alterada/caducada, quota/escrita ignorada/bytes inválidos, pacote parcial, pesquisas concorrentes, suspensão e duas contas reais em separadores durante respostas atrasadas de revisão e gravação. Expiração limpa PIN. Repetido após ajuste do título alemão e captura dos cartões.
3. `test-fcs-sec-tech-auth.js`: 22 verificações de autenticação/autorização existentes.
4. `test-field-account-access.js`: proteção de contas, palavras-passe, identidade e auditoria pelo administrador autenticado.
5. `test-shared-navigation-browser.js`: oito páginas, quatro larguras e os quatro perfis existentes, com gaveta, foco, teclado, pesquisa e indicação offline.
6. `test-real-month-flow-api.js`: cinco clientes, nove piscinas/jacuzzis, três técnicos/viaturas, 54 visitas, químicos, reparações, faturação/pagamentos e mensagens sintéticas.
7. `test-field-two-year-api.js`: simulação acelerada de 731 datas, 312 visitas, 24 meses de faturação, 72 faturas, 144 pagamentos parciais concorrentes e histórico GPS. Não representa dois anos de funcionamento contínuo.
8. `test-visit-os-operational.js`: percurso operacional de visita e relações existentes.
9. `test-route-os-acceptance.js`: percurso de ronda, PIN, workday, atribuição/cobertura e recorrência existentes.

Os quatro grupos que criavam técnicos pelos escritores antigos usam agora um auxiliar de revisão/commit pela API. O auxiliar verifica o comprovativo e, quando disponível, o estado HTTP 200 real; as verificações operacionais mantêm-se. Scripts históricos fora do runner que ainda usam os escritores antigos necessitam de adaptação antes de serem retomados; a API recusa-os de forma explícita.

Vinte e quatro capturas em `reports/field-visual/technician-management/`: cinco idiomas × três larguras (320/390/1440), três revisões, três diretórios e três cartões. Revistos formulário, revisão e cartões em móvel/desktop. Texto HTML literal permanece inerte. Os ensaios próprios confirmam zero alterações nos contadores de clientes, piscinas, visitas, faturas, pagamentos, chat, email, rondas e guias; conta User e viatura mantêm os seus atributos. Dados sintéticos e saídas externas desligadas. Dois recursos binários comuns não materializados localmente continuam como limitação visual conhecida; não houve piloto físico iPhone/Android.

Runtime PGlite 0.5.8/pglite-socket 0.2.11 isolado; Chromium 153 com múltiplos processos e segurança web ativa. Cache **v175**, runner **264 grupos distintos**. Inventário: 115 HTML, 102 referenciados em 285 scripts ativos, **13 na fila**; zero recursos ausentes do repositório ou diferenças de guardas. Referência literal não certifica conclusão do módulo.

## CI e publicação

TASK362 confirmada em [260/260 grupos e restauro nativo](evidence/20260925_task362_ci.json), 17 etapas, 41 migrações e 42m54s. Restauro de 127 tabelas/47 ficheiros com linhas e hashes iguais. No último controlo, [CI TASK363 36154446240](https://github.com/ts7520305-svg/cristalwater/actions/runs/36154446240), job `108135454917`, permanecia em execução; 262 grupos/restauro por confirmar.

TASK364 preparada para publicação na branch de trabalho. Os 264 grupos completos, atualização nativa e restauro deste lote aguardam CI. A evidência local identifica fontes, capturas, testes e limites; a aprovação anterior não aprova este código.

## Retoma e limites

Confirmar CIs TASK363/364 e retomar `/admin-vehicles`, próxima página da fila finita. A verificação bcrypt percorre PINs existentes por páginas; custo e latência com volume de produção precisam de medição própria. Não se migram PINs históricos, não se revogam todas as contas User por implicação e não se reconcilia o histórico de custos, rondas ou viaturas neste lote. Logs históricos não são reescritos por esta correção. Interfaces clássicas e scripts históricos não constituem vias alternativas de gravação. Conciliação histórica, volume, VPS, cópias operacionais e piloto físico continuam pendentes. Sem merge, deploy ou contactos reais; aplicação não declarada completa.
