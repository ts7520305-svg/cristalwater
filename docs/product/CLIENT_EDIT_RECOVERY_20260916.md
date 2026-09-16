# TASK190–191 — Edição de clientes com versão e recuperação

## Problema e comportamento

A preservação dos campos omitidos da TASK188 não impedia uma janela antiga de substituir dados mais recentes, nem permitia distinguir uma resposta perdida de uma alteração não executada. O editor enviava todos os campos e fechava após uma resposta HTTP sem confirmar a identidade da alteração.

Os dois aliases de edição de clientes partilham agora um contrato de versão, UUID, auditoria e confirmação imutável. O formulário administrativo guarda apenas os campos alterados, conserva os pedidos sem confirmação e apresenta uma revisão por campo quando encontra dados mais recentes.

## Servidor

- `GET /api/core/clients/:id/edit-state` e `GET /api/clients/:id/edit-state` devolvem os dados permitidos e uma versão opaca. As guardas dos aliases continuam a exigir os perfis autorizados.
- A versão é um HMAC do estado completo da linha Client, incluindo alterações efetuadas por escritores antigos, mesmo que `updatedAt` seja conservado. Não revela os hashes das credenciais.
- `requestId` e `expectedVersion` são obrigatórios quando o chamador usa o novo protocolo. Um UUID identifica cliente, versão inicial, alterações normalizadas e intenção de alterar password/PIN, dentro da identidade autenticada.
- O bloqueio do pedido precede o bloqueio da linha. Cliente, auditoria e comprovativo são gravados na mesma transação. Uma falha em qualquer gravação reverte a operação inteira.
- A confirmação persistida é consultada antes da versão atual. Repetir o pedido confirmado devolve o seu resultado original, mesmo após outra edição, reinício do processo ou remoção posterior da linha de auditoria. Não reaplica alterações.
- Uma versão obsoleta devolve `CLIENT_VERSION_CONFLICT`; reutilizar um UUID para outro cliente, conteúdo ou credencial devolve `CLIENT_EDIT_REQUEST_REUSED`.
- A password/PIN não entra no conteúdo público assinado nem em respostas/auditorias. O comprovativo contém provas HMAC por credencial, limitadas à identidade/pedido/campo e nunca devolvidas ao navegador. O replay pode omitir as credenciais. Se a alteração ainda não foi executada, a intenção sem o valor devolve `CLIENT_EDIT_CREDENTIAL_REQUIRED`, sem gravação.
- Chamadas antigas sem UUID continuam disponíveis, com preservação e auditoria transacionais, mas sem garantia de conflito ou deduplicação própria. A alteração feita por essas chamadas invalida as versões apresentadas ao editor novo.

## Formulário administrativo

- Rascunho por conta/cliente em sessionStorage; pedido pendente e última confirmação em IndexedDB. Password/PIN nunca são incluídos nesses registos.
- O pedido é persistido e relido antes do transporte. Não há envio automático ao abrir/recarregar a página. O botão de confirmação repete o UUID e os dados públicos originais.
- Uma confirmação só é aceite com estado HTTP final, identidade, cliente, UUID, versão inicial/final, assinatura do conteúdo, identificador de auditoria, intenções de credenciais e valores alterados corretos. Respostas vazias, incompletas, intermédias ou trocadas deixam o pedido pendente.
- Um pedido com password recuperado após reload pode ser confirmado sem a password se já foi executado. Se ainda não foi, o campo é reaberto para introdução explícita, conservando o UUID.
- Web Locks e IndexedDB coordenam duas janelas da mesma conta/cliente. Uma janela conserva o seu rascunho distinto enquanto confirma o pedido da outra. A confirmação não faz reaparecer pedidos anteriores.
- Uma resposta atrasada aplica-se apenas ao editor original. Fechar o cliente A e abrir B conserva o rascunho de B. Uma mudança de token/conta limpa dados visíveis e impede que o pedido antigo use a nova sessão.
- Conflitos apresentam os valores atuais, do rascunho e, quando distinto, do pedido pendente. Alterações não sobrepostas são propostas; conflitos reais exigem escolha. Preparar a revisão não grava no servidor. Só o próximo Guardar cria outro UUID sobre a versão revista.
- Um pedido incerto só é substituído depois de o servidor confirmar a rejeição por versão. A revisão é persistida antes de remover essa pendência. Falhas/corrupção de armazenamento não são tratadas como confirmação.
- PT/EN/FR/ES/DE, texto de utilizador literal, controlos adequados ao toque e largura de 320/390/1440 px ensaiados. O editor possui os seus próprios estados e traduções. Nomes, referências, contactos e designações de piscinas na lista também são excluídos da tradução automática; nomes coincidentes com rótulos, como “Pago” e “Urgente”, permanecem literais nos cinco idiomas.

## Interação com a memória antiga da página

O ensaio real encontrou a password em `cw:ctx:/admin-clients`: o mecanismo geral de navegação recolhia todos os inputs. O editor foi marcado como responsável pela sua própria memória, e o contexto geral exclui os seus campos e as credenciais, tanto ao guardar como ao restaurar. As cópias antigas desses campos são retiradas do contexto desta página.

O mecanismo genérico `cw-flow-shell` também passou a excluir credenciais e a respeitar formulários com memória própria. O snapshot antigo `cw:lastform:editClientForm`, sem conta/cliente, é removido; não pode ser usado para substituir o formulário novo. Os testes verificam estes dois mecanismos, incluindo valores históricos já guardados.

## Validação e publicação

- `test-field-client-edit-recovery.js`: concorrência entre dois processos, versões obsoletas, UUID reutilizado, credenciais, resposta perdida, reinício, comprovativo imutável, falhas na auditoria/confirmação, acessos e preservação de contrato/saldo/arquivo.
- `test-field-client-edit-recovery-ui.js`: página administrativa real em Chromium, confirmação exata, falhas antes/depois do commit, reload, duas janelas com rascunhos distintos, revisão de conflito, resposta de outro cliente, quotas/corrupção, leitura incompleta, validação, memória genérica, cinco idiomas e mudança de conta.
- `field-qa-runtime/run-1789553091646`: recuperação API/UI, preservação de clientes e ativação aprovadas. A regressão de piscinas encontrou um erro de ligação do adaptador local PGlite durante injeção de falha; foi repetida numa instância nova, sem relaxar asserções.
- `field-qa-runtime/run-1789553266343`: piscinas, editor novo e percurso E2E completo aprovados. Capturas em `reports/field-visual/client-edit/` revistas; superfície/contraste e ações do modal corrigidos.
- Revisão final dos dois grupos em `field-qa-runtime/run-1789553370683`; editor e nomes literais nos cinco idiomas aprovados em `run-1789554020061`. 324 unitários, quatro testes de técnicos, validação Prisma e sintaxe de 526 ficheiros backend. Os 17 scripts de navegador passaram com o Chromium local configurado; a tentativa inicial sem esse caminho não encontrou o executável.
- Runner passa de 91 para 93 grupos. A migração aditiva `20260916130000_client_edit_requests` acrescenta uma tabela, chave composta e índice. O teste de upgrade aplica catorze migrações e verifica a conservação dos dados antigos; o restauro deverá abranger 105 tabelas.
- Base remota confirmada: TASK189, commit `20001585bed6e8384325bc25f6d4cbac90314104`, workflow `35078224632`, com 91 grupos e restauro de 104 tabelas/22 ficheiros. A confirmação nativa desta alteração deve ser consultada no workflow associado ao seu próprio commit; o êxito da base não a substitui.

## Limites e próxima etapa

Atualização TASK193: a base acima foi confirmada no workflow `35084563824`, commit `a8fd7656cbcbfd23222cb9803024319bade4a440`, com 93 grupos e restauro de 105 tabelas/22 ficheiros. A revisão posterior de piscinas reproduziu também neste editor uma regra geral que tornava o modal relativo e o deixava fora do ecrã após redimensionar. A posição/camada e o espaço do seletor de idioma foram corrigidos; o teste agora exige visibilidade à frente da página e limites verticais. Ver `POOL_EDIT_RECOVERY_20260916.md` para a reprodução e validação desta correção visual.

O rascunho não enviado dura na sessão da janela; o pedido já persistido em IndexedDB pode ser recuperado após reload/reabertura com a conta original. Limpar os dados do navegador remove esses registos. Não há promessa de recuperação de password: quando necessária, é reintroduzida.

Uma mudança em qualquer campo da linha Client pode exigir revisão, mesmo que o campo não apareça neste formulário. Uma rotação da chave de assinatura também invalida versões ainda não executadas. Não se trata de sincronização automática nem de histórico editável de versões.

TASK192–193 implementam a versão/recuperação do editor geral de piscinas. Continuam por tratar a rota específica da ficha técnica e propostas técnicas, outras escritas antigas e o inventário visual global. Sem merge em main, deploy/VPS, fornecedores reais ou emissão fiscal neste lote. Não demonstra prontidão integral de produção.
