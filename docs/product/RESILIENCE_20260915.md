# TASK100 — Concorrência e recuperação de falhas de comunicação

## Objetivo

Validar que o trabalho de vários técnicos e os reenvios após falha de ligação preservam a atribuição das piscinas, as notificações e o consumo de produtos. O ensaio usa o backend real e verifica os efeitos diretamente na base de dados isolada.

## Execução

`scripts/test-field-resilience.js` exige simultaneamente `NODE_ENV=test`, `QA_MODE=true`, `QA_ENVIRONMENT_SAFE=true` e um `CW_BASE_URL` HTTP local. Requer o esquema instalado, o backend QA já iniciado e as credenciais `ADMIN_EMAIL`/`ADMIN_PASSWORD` desse ambiente. Não inicia nem reinicia o servidor principal. O proxy de falhas escuta exclusivamente em `127.0.0.1`, numa porta livre atribuída pelo sistema, e aceita apenas a conclusão da visita criada pelo próprio ensaio.

O ensaio cria dados QA próprios e preserva-os para inspeção e para o teste de restauro posterior. Não deve ser executado contra dados reais.

## Cenários e critérios

1. Doze técnicos enviam localizações em paralelo. Cada técnico repete o mesmo ponto quatro vezes: 48 pedidos devem resultar em 12 pontos de histórico e 12 avisos de proximidade, um por visita atribuída.
2. Seis vagas de 12 técnicos consultam rota, histórico GPS e contador de notificações: 216 leituras. Cada consulta de rota tenta incluir o identificador de outro técnico; o backend deve usar a identidade autenticada e devolver apenas a piscina atribuída. Cada histórico deve conter apenas o ponto do respetivo técnico.
3. Depois da carga, pedidos sem autenticação e acesso/escrita ao GPS de outro técnico continuam recusados, sem alterações no histórico.
4. O proxy devolve 503 antes de encaminhar uma conclusão. A visita deve continuar planeada e o consumo deve permanecer a zero.
5. Na segunda tentativa, o proxy encaminha a conclusão, aguarda a resposta completa do backend e destrói a ligação sem a entregar ao cliente. Confirma-se na base de dados que o backend efetivamente concluiu a visita.
6. O mesmo identificador de operação e conteúdo são reenviados oito vezes em paralelo. A visita deve ter um único consumo químico, um único movimento de stock e exatamente 0,5 kg consumidos.
7. O backend continua a responder ao controlo de saúde após o ensaio.

## Evidência

O relatório `reports/field-suite/resilience-<timestamp>.json` contém estado PASS/FAIL, critérios concluídos e latências p50/p95/máxima por endpoint normalizado. Não contém tokens nem palavras-passe. Uma falha gera código de saída diferente de zero. O invólucro QA deve verificar o resultado do processo filho, não apenas o seu próprio código de saída.

As latências são observações do ambiente QA, sem limiar comercial ou afirmação de capacidade de produção. A concorrência máxima principal é de 12 clientes; os três pedidos de leitura de cada cliente são sequenciais.

## Limites

Este teste verifica repetição segura de operações e recuperação de falhas de transporte controladas. Não prova alta disponibilidade, redundância entre servidores, failover da base de dados, recuperação de uma queda de energia, receção de push num telemóvel fechado, nem capacidade máxima de utilizadores. Essas verificações exigem infraestrutura e dispositivos representativos. O restauro de base de dados e ficheiros é coberto pelo ensaio de backup/restauro existente, separadamente.
