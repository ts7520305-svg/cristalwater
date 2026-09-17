# TASK222 — Entrada no portal sem perda de trabalho local

## Falha reproduzida

A guarda antiga de cliente executava `localStorage.clear()` quando o utilizador guardado era ilegível ou não tinha o papel permitido. Uma entrada acidental de um técnico em `/client-payments` apagou no Chromium a fila `cwFieldOutbox:41` e uma guia guardada. O resultado anterior à correção foi `[null, null]` para esses dois registos. A mesma instrução podia apagar rascunhos, histórico local e chaves antigas sem titularidade conhecida.

O script também declarava `user` no âmbito global; a declaração própria da página `/settings` entrava em conflito com essa variável. Faltava terminar a validação após detetar sessão ausente. Os atalhos ADMIN para guias/GPS levavam a ecrãs técnicos que recusavam esse perfil.

## Comportamento atual

- A guarda esconde a página durante a validação e mantém as variáveis num âmbito próprio. Nunca limpa o armazenamento inteiro.
- Sessão ausente, token malformado/expirado, papel discordante, identidade CLIENT discordante ou falha de armazenamento retiram apenas as sete chaves de sessão/identificação usadas pelo contrato comum. A página de entrada recebe o motivo; os bytes do trabalho guardado ficam conservados.
- TECHNICIAN e TEAM_LEADER com sessão coerente regressam a `/technician-field-mode`; ADMIN regressa ao centro administrativo. As credenciais válidas não são apagadas por essa entrada acidental.
- ADMIN conserva a pré-visualização existente em `/client-portal`. A entrada antiga `/client_chat` encaminha esse perfil para `/chat`. Nenhuma destas exceções transforma o administrador num cliente.
- Clientes válidos podem entrar com as chaves canónicas ou antigas. Os aliases são sincronizados com leitura de confirmação; o identificador usado pelo portal tem de coincidir com o token. A verificação local de estrutura/expiração não valida a assinatura nem substitui as autorizações das APIs.
- Os menus administrativos levam as guias de obra/trabalho a `/admin-vehicles#works`, as guias de transporte a `/admin-vehicles#guides` e a localização a `/admin-live-map`. A navegação técnica conserva os seus percursos. Service worker v51.

## Evidência

| Ensaio | Resultado |
|---|---|
| `test-auth-entry-browser.js` | 24 casos: sessão ausente, expiração, token/utilizador inválidos, papéis/identidades discordantes, cliente canónico/antigo, três perfis recusados, pré-visualização ADMIN e aliases, redirecionamento de chat, erro/quota/gravação sem efeito e script real de configurações. Filas/documentos/dados antigos ilegíveis ficam iguais byte a byte |
| `run-1789643619187` | Grupo ampliado TEAM_LEADER aprovado: login real PIN/email, recuperação offline e entrada acidental nas páginas reais de pagamentos/configurações/portal sem perda da sessão nem do rascunho; retorno e edição continuam funcionais |
| `run-1789642075142` | Pedidos de visita/avisos de pagamento do portal, histórico de conversas CLIENT/ADMIN e E2E completo de campo aprovados contra API/base reais |
| Regressão de navegador | Os 17 scripts de `test:field-browser` aprovados, incluindo o grupo ampliado de entrada |
| CI nativo | Primeira publicação `fec41686ad54124290514701341b9ac6d2b22f91`, árvore `9fcd6a970d4bd87be866134b6e04bd3e719cfaeb`, execução `35214915817`: falha em dois harnesses unitários antigos, antes da integração/restauro. Simulações corrigidas na TASK223; confirmar a árvore conjunta com os 124 grupos existentes, 20 migrações e restauro |

O grupo de navegador usa fixtures de payload para exercitar a guarda e falhas de armazenamento; os grupos de integração usam credenciais assinadas e APIs reais. Os grupos existentes foram ampliados, sem acrescentar migrações ou endpoints.

## Inventário e limites

`audit-field-page-inventory.js` enumera 101 HTML: 94 entradas de raiz e sete páginas auxiliares/protótipos/testes. Nenhuma referência local a script/estilo ficou sem ficheiro. Há referências literais a 42 páginas em 141 scripts ativos; isto não prova execução nem revisão visual. O relatório JSON conserva os recursos e os nomes dos scripts.

As exceções ADMIN do portal/chat são descritas separadamente. Permanecem 19 diferenças entre papéis do catálogo antigo e guardas declaradas, incluindo ajuda/configurações e páginas técnicas antigas. Exigem revisão do percurso pretendido, sem alargar acesso automaticamente. Carregamento, vazio, erro, repetição, cinco idiomas, larguras e PDFs de todas as páginas ainda não estão auditados.

Os dados já apagados pelo comportamento anterior não são recuperados por esta correção. O lote não altera main, deploy, fornecedores externos, emissão fiscal ou o PNG não publicado que se perdeu com o ambiente anterior.
