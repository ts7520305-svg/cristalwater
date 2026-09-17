# TASK223 — Saída administrativa sem apagar trabalho guardado

## Falha e correção

Depois da correção da guarda CLIENT, a pesquisa no frontend encontrou outra chamada direta a `localStorage.clear()`: o botão Sair de `/admin-visits-dashboard`. A reprodução anterior ao ajuste apagou uma fila de visitas e uma guia guardada. Ambas as leituras passaram a `null` após o clique.

O botão usa agora `data-cw-logout`, já suportado por `cw-auth.js`. Foi removido o listener próprio que apagava todo o armazenamento. A saída comum retira as sete chaves de sessão/identificação, encerra os sockets privados e aguarda a tentativa de limpeza da subscrição antes de navegar. Durante a ação, o botão fica desativado e assinalado como ocupado; cliques repetidos não iniciam outra saída. Rascunhos, filas, documentos e bytes antigos ficam conservados. Service worker v52.

## Validação

- O grupo `test-auth-entry-browser.js` carrega o HTML, a guarda e os scripts reais do painel administrativo. A consulta de visitas e a limpeza da subscrição são controladas no ensaio. O teste aguarda o estado vazio, clica em Sair, tenta repetir a ação, liberta a limpeza pendente e verifica uma única navegação, sete chaves de identidade removidas e todos os bytes de trabalho conservados.
- O grupo ampliado aprovou juntamente com os 24 casos da guarda CLIENT, login repetido, troca de sessão, sockets entre janelas e saída na página técnica. A primeira fixture administrativa usava um token sem estrutura JWT e foi corretamente recusada; foi substituída por uma credencial de teste com payload e expiração coerentes, sem alterar a guarda para aceitar esse token inválido.
- 388 testes unitários e quatro técnicos aprovados localmente. A pesquisa literal no frontend já não encontra `localStorage.clear()` nem `sessionStorage.clear()`; isto não é uma prova de todos os caminhos possíveis de armazenamento.
- O primeiro CI da TASK222 (`35214915817`, commit `fec41686ad54124290514701341b9ac6d2b22f91`) falhou em dois testes unitários antigos antes da integração/restauro. O harness de pré-visualização foi atualizado com documento, aliases coerentes e payload com expiração. As asserções continuam a exigir redirecionamento correto, nenhuma perda de sessão e nenhuma atribuição do ID administrativo ao cliente; verifica-se também a conservação integral dos registos.
- Publicar e confirmar a árvore conjunta TASK222–223 com 124 grupos, 17 scripts de navegador, 20 migrações existentes e restauro em PostgreSQL 16. O CI anterior falhado não conta como aprovação.

## Próxima revisão identificada no inventário

As 19 diferenças de catálogo incluem oito páginas CLIENT onde o catálogo ainda promete ADMIN; seis páginas técnicas cujo catálogo omite TEAM_LEADER ou promete ADMIN; duas páginas de rentabilidade com guarda ADMIN mas nome/menu técnicos; e três entradas de ajuda/configurações. A lista exata de páginas está no inventário TASK222.

O código de `/settings` consulta uma tabela de preferências pertencente a `User`, enquanto a página usa guarda CLIENT. A API recusa corretamente a identidade CLIENT/PIN com o mesmo ID numérico; rever o destino e a experiência da página, preservando essa separação. `/config-notifications` guarda preferências locais antigas e não implementa o título «Modelos e regras» usado no menu ADMIN. `/help-center` tem conteúdo/navegação administrativos e guarda CLIENT. Estes percursos ainda precisam de correção própria; não foram declarados funcionais por um teste com respostas de API simuladas.

Sem alterações às APIs, permissões, schema, main, deploy, serviços externos ou ao PNG não publicado perdido no ambiente anterior.
