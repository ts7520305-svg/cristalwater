# TASK363 — fornecedores e credenciais com gravação recuperável

## Problema e âmbito

A página `/admin-suppliers` usava `event.currentTarget` depois de um `await`: uma criação concluída podia terminar como erro de formulário, convidando a repetir e duplicar o registo. O normalizador retirava espaços da palavra-passe, não havia bloqueio de envios concorrentes nem recuperação após perda da resposta, e uma pesquisa reconstruía a escolha do fornecedor associado ao atalho. Respostas antigas ou de uma sessão anterior podiam voltar a preencher a página. O PUT aceitava campos internos e relações diretamente; a consulta da credencial atualizava a data antes de saber se conseguia decifrá-la.

Este lote corrige o diretório administrativo de fornecedores/atalhos e os respetivos endpoints, preservando os registos existentes. A abertura de um portal continua a ser uma navegação explícita do utilizador, sem encomenda automática, autenticação automática ou contacto com fornecedores.

## Alteração

- **Criação recuperável por conta e pedido:** fornecedor/atalho, auditoria e comprovativo são gravados na mesma transação. O mesmo UUID e conteúdo devolvem o mesmo comprovativo; reutilização com conteúdo diferente é recusada. Bloqueio transacional coordena processos distintos. O resumo do pedido usa HMAC, sem palavra-passe, campos do formulário ou cifra no comprovativo.
- A página conserva apenas `{version, owner, kind, requestId}` no `sessionStorage` do separador. A referência é escrita e relida antes do POST; quota e escritas ignoradas bloqueiam o envio. Formulários e credenciais ficam em memória, com aviso de limpeza ao sair/recarregar. Após resposta perdida, um GET recupera o comprovativo; a repetição explícita usa o corpo original enquanto existe em memória. Não há POST automático no arranque, regresso ou recarregamento.
- **Encerrar tentativa** consulta o resultado sob o mesmo bloqueio. Se a gravação já existir, devolve esse comprovativo; caso contrário, conserva uma anulação que impede uma criação tardia com aquele pedido. Assim, perder o formulário antes da confirmação não obriga a repetir uma criação incerta. A ação não apaga fornecedores nem atalhos.
- Escolha do fornecedor para um atalho a partir do cartão, com ID/nome visíveis e versão verificada na gravação. Pesquisas, filtros e mudança de idioma conservam esta escolha e os campos pendentes. Fornecedor entretanto alterado/inativo exige nova escolha após encerrar a tentativa. Atalhos sem fornecedor continuam permitidos.
- Listas reais com total, páginas de 25, ordenação determinística e filtros explícitos. Erro parcial, pacote truncado ou origem incoerente recusam o conjunto. A última pesquisa válida é a única que pode preencher o diretório. Texto de dados é inserido com `textContent`.
- URLs novas limitadas a HTTP/HTTPS absolutos, sem credenciais incorporadas. Endereços antigos incompatíveis são mostrados como texto e preservados. Ligações usam `noopener noreferrer` e `no-referrer`; registos inativos não oferecem abertura/cópia da credencial.
- **Palavra-passe exata:** conserva espaços, Unicode e restantes caracteres admitidos. O formato AES-GCM e a escolha da chave já existentes mantêm-se. Credencial ilegível não é apagada, substituída nem marcada como consultada. O botão verifica a versão do fornecedor; leitura decifrada, auditoria e data de consulta são atómicas. A data descreve consulta da credencial, não um login no portal nem sucesso da cópia.
- A cópia usa apenas a API de área de transferência; não cria um `textarea` secreto nem anuncia sucesso quando a permissão é recusada. Resposta após troca/expiração da sessão não é copiada. O sistema operativo controla a área de transferência depois de uma cópia autorizada; não é prometida limpeza posterior.
- PUT exige versão e uma lista explícita de campos; rejeita IDs, cifras, datas internas e relações fornecidos pelo chamador. Omissão de palavra-passe conserva a cifra; remoção exige campo vazio explícito. A API mantém os dois prefixos montados, `/api/suppliers` e `/api/quick-links`, com respostas privadas sem cache. Clientes antigos sem identificador/versão recebem 409.
- O leitor partilhado do fluxo de administração passou a selecionar apenas metadados comerciais necessários; novas cópias desse fluxo deixam de propagar cifra, utilizador, URL de login ou dica. **Não foram reescritos snapshots/auditorias históricos** eventualmente produzidos pela versão anterior.
- Conteúdo próprio em PT/EN/FR/ES/DE. Diretório primeiro; formulários abrem por ação explícita. Guardas ADMIN, limpeza na suspensão/troca de conta, referência por proprietário, estados de erro e controlos de pelo menos 44 px. A memória genérica antiga da página não é lida nem reescrita. A navegação comum mantém o seu âmbito de tradução anterior.

## Validação

**733 testes unitários em 100 ficheiros**, incluindo 13 novos, e quatro testes técnicos aprovados. Sintaxe: 643 backend, 256 frontend e 44 scripts inline. Modelo/cópia e sintaxe dos ficheiros alterados por último voltaram a ser verificados. Sem novas dependências, tabelas ou migrações; 41 migrações existentes aplicadas no runtime isolado.

Quatro grupos distintos aprovados na versão final:

1. `test-field-supplier-hub.js`: API real, dois processos HTTP e reinício, perda de resposta após commit, seis repetições concorrentes, conflito de conteúdo/proprietário, rollback ao falhar auditoria/comprovativo, anulação e corrida anulação/criação, URLs/tipos/IDs, versões, projeções mínimas, 25 registos por página, fornecedores inativos e cifra antiga inválida preservada. Consulta dos dois prefixos; acesso ADMIN obrigatório.
2. `test-field-supplier-hub-ui.js`: página/API reais, duplo submit uma vez, seleção conservada durante pesquisa, HTML literal, respostas atrasadas/parciais, resultado perdido e recuperação só com referência, envio offline e repetição exata, anulação persistente, quota/escritas ignoradas/bytes inválidos, suspensão/regresso, troca de conta numa segunda janela durante resposta da credencial e expiração. A área de transferência usa um adaptador de teste para confirmação e recusa; não se confunde com validação física do sistema operativo.
3. `test-administration-os-operational.js`: fluxo administrativo, fornecedores, compras, notificações internas e fecho operacional preservados.
4. `test-shared-navigation-browser.js`: oito páginas, quatro larguras e ADMIN/CLIENT/TECHNICIAN/TEAM_LEADER, incluindo gaveta, foco, teclado, pesquisa e indicação offline.

O primeiro ensaio de navegador detetou um problema na construção do formulário e na gestão automática do estado. A construção passou a definir `type` apenas em `input`, e a página passou a gerir explicitamente o próprio estado. A versão corrigida passou; os quatro grupos acima foram executados novamente após os ajustes finais, sem retirar verificações.

Dezoito capturas em `reports/field-visual/supplier-hub/`: cinco idiomas × 320/390/1440 no formulário, mais três vistas do diretório. Revistas PT 390/1440 e DE 320 nos dois estados. Zero alterações de clientes, piscinas, faturas, pagamentos, emails, chat ou compras nos ensaios próprios; dados e contactos são sintéticos. Nenhum fornecedor real foi aberto/contactado. Dois recursos binários comuns não materializados localmente continuam como limitação visual conhecida; não houve piloto físico iPhone/Android.

Runtime PGlite isolado e Chromium com múltiplos processos/segurança web ativa. Cache **v174**; runner **262 grupos distintos**. Inventário: 115 HTML, 101 referenciados em 283 scripts ativos, **14 na fila**, zero recursos ausentes do repositório e zero diferenças de guardas. Referência literal não certifica conclusão do módulo.

## CI e publicação

Publicada em `c564ca08a91e069362e9e1c623fd0538d4750a96`, árvore `fc33ddb671a49e3aebb6134cdedbb8b49b7d413a`, idêntica à preparada e validada localmente. [CI 36154446240](https://github.com/ts7520305-svg/cristalwater/actions/runs/36154446240), job `108135454917`, aprovado: 262/262 grupos esperados distintos, 17 etapas, 41 migrações e restauro de 127 tabelas/47 ficheiros com linhas e hashes iguais, em 40m50s. [Evidência nativa](evidence/20260925_task363_ci.json).

TASK362 confirmada: [CI 36150863744](https://github.com/ts7520305-svg/cristalwater/actions/runs/36150863744), job `108123470461`, aprovado: 260/260 grupos esperados distintos, 17 etapas, 41 migrações e restauro de 127 tabelas/47 ficheiros com linhas e hashes iguais, em 42m54s. [Evidência nativa](evidence/20260925_task362_ci.json).

## Retoma e limites

CI/restauro da TASK362 confirmado; confirmar TASK363. Próxima inspeção da fila: `/admin-technicians`. O lote não cria um novo editor visual de fornecedores, gestão de encomendas ou integração com portais externos; a edição API existente fica protegida. Snapshots antigos, rotação de chaves e credenciais históricas ilegíveis precisam de revisão própria, sem recuperação destrutiva automática. Conciliação histórica, volume de produção, VPS, cópias operacionais e piloto físico continuam pendentes. Sem merge, deploy ou contactos reais; aplicação não declarada completa.
