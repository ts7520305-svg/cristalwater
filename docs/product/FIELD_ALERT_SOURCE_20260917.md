# TASK221 — Alertas derivados da causa real

## Falhas reproduzidas

O botão genérico «Resolver» escrevia RESOLVED num estado local global e retirava o alerta do painel, sem fechar o lembrete real de água/bomba. O histórico e uma fila local de «comandos» também eram partilhados entre contas; não foi encontrado um consumidor dessa fila que confirmasse envio. O painel lia sinais antigos de equipamento para a bomba, mas não os lembretes reais do módulo atual.

`run-1789637966584` reproduziu a ausência da bomba real no painel. `run-1789638096509` reproduziu a ocultação de água aberta depois de «Resolver», com o registo ainda ativo. Estes ensaios ocorreram antes da recuperação do ambiente.

## Correção

- O painel e os indicadores derivam das causas ativas. «Tratar causa» abre o controlo correspondente; assumir ou confirmar leitura mantém o alerta visível. O fecho físico continua pelo módulo de água/bomba e respetiva confirmação no servidor.
- Lembretes reais de bomba entram no painel com identidade do tipo de visita e lembrete. O sinal antigo do equipamento continua visível se não houver um lembrete equivalente. Dados de lembretes ilegíveis apresentam água/bombas por confirmar.
- O diário de leitura é separado por conta tipada, papel e dia. Histórico e estado derivam de um único registo, com Web Locks e leitura de confirmação. Duas janelas não duplicam a confirmação nem fazem CONFIRMED recuar para ASSUMED. Mudança de conta/dia invalida escritas pendentes.
- Quota, corrupção, falta de Web Locks e gravação sem efeito dão aviso. Os alertas continuam visíveis. Chaves antigas de estado/histórico/comandos são conservadas sem importação automática nem exibição de dados de outra conta.
- A interface identifica a leitura como local ao dispositivo. Não simula resolução nem entrega a um centro externo. O service worker v50 inclui o diário para recarga offline.
- Atualizar passagens sincroniza os lembretes antes de apresentar a conclusão da consulta. O E2E aguarda essa conclusão, em vez de considerar a lista temporariamente limpa como resposta final.

## Validação

| Evidência | Resultado e limite |
|---|---|
| `run-1789638302898` | Novo grupo inicial e regressão completa de água/bomba EXTRA aprovados |
| `run-1789638468519` | Grupo ampliado de alertas e recuperação documental aprovados; E2E detetou aviso antigo após passagem de responsabilidade, corrigido na atualização conjunta |
| Ambiente recuperado | `run-1789640745090`: grupo final de alertas aprovado. `run-1789640852461`: E2E completo e recuperação documental aprovados. 388 unitários, quatro técnicos, 17 scripts de navegador e sintaxe de 539 ficheiros aprovados |
| CI nativo | Commit `cda7aac67b9faa28eabc4fc65477c91a67e6e4df`, árvore `4eec75d434c917e97dfdc024a8b1f0e577666e8f`, execução `35210811898` aprovada: 124/124 grupos, 388 unitários/quatro técnicos, 17 scripts de navegador, 20 migrações e sintaxe de 539 ficheiros. Restauro de 110 tabelas e 32 ficheiros com linhas/hashes iguais em PostgreSQL 16 |

O grupo novo usa API/base reais e Chromium: água/bomba efetivas, histórico legado de outra conta, duas janelas, falhas de gravação, corrupção, recarga offline, 320/390/1440 px, fecho físico no servidor, mudança de sessão com bloqueio pendente e mudança de dia. A leitura local nunca altera o estado físico na base.

A recuperação do ambiente exigiu reinstalar o runtime e reaplicar os ficheiros locais. O primeiro adaptador PGlite reconstruído falhou por colisão de prepared statements antes das fixtures. A configuração do pooler/cache de statements no adaptador foi corrigida e os grupos finais passaram; isso não substitui a confirmação em PostgreSQL 16 nativo.

## Limites

O diário de leitura não é uma auditoria central nem transfere responsabilidade. Água/bomba, passagens e notificações conservam os seus mecanismos próprios de persistência no servidor. O botão local antigo não prova qualquer resolução física passada; os registos antigos ficam conservados para revisão.

O relatório histórico FCS Block 2 de julho e a respetiva asserção local RESOLVED não são critérios atuais de fecho físico. Este lote não acrescenta entregas externas, push em dispositivo real, migração de schema, main ou deploy. A modificação PNG preexistente não publicada no ambiente anterior não foi recuperada e não faz parte deste lote.
