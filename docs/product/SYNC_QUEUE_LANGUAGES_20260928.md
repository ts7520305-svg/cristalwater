# Idiomas da fila de sincronização — TASK416 / C06

A fila de visitas passa a apresentar os seus avisos e ações em **PT, EN, FR, ES e DE**. A reprodução anterior mostrava “Confirmar envio guardado” mesmo com inglês selecionado. O lote altera apenas a apresentação da fila e a disponibilidade do botão durante um envio; o protocolo de pedidos e as regras do servidor continuam iguais.

São19 chaves/95 valores: espera/confirmação, ausência de ligação, sessão expirada, alteração de atribuição, conflito, correção recusada e histórico antigo/ilegível. O idioma atualiza pela escolha explícita e pela preferência carregada silenciosamente. Os nomes/rótulos guardados e as mensagens originais do servidor continuam literais, apresentados como texto; o tradutor genérico não os reescreve.

A mudança de idioma durante uma resposta pendente mantém o botão desativado. Ao renovar a sessão, o pedido antigo é interrompido e o botão volta a ficar disponível para a conta atual. Nenhuma mudança de idioma inicia um envio.

## Prova local

- Novo teste com Chromium, autenticação e IndexedDB reais; respostas HTTP controladas em ambiente isolado.
- Cinco idiomas ×320/390/1440: controlos ≥44px, sem largura excedida, notas/nomes preservados e marcação literal sem execução.
- Snapshots integrais da outbox iguais após mudar idioma, recarregar e alternar contas; zero pedidos operacionais durante escolhas de idioma.
- 401/403/404/409 localizados;503 mantém mensagem original. Resposta atrasada confirma uma vez o mesmo UUID/payload/hash. Renovação de credencial conserva o pedido e liberta o controlo.
- Recusa de correção: texto envolvente e ação localizados, mensagem/recibo originais conservados; tomar conhecimento só acrescenta `reviewedAt`, sem novo pedido ao servidor.
- Histórico ilegível: alerta em cinco idiomas, bytes originais conservados. Imagem alemã a320px revista com o encaixe do seletor usado no cabeçalho do modo de campo.
- Regressão de sessão e regressão comum de idiomas aprovadas;1 327 testes unitários/136 ficheiros, quatro técnicos, sintaxe695/307/44 e318 scripts únicos/existentes.

[Reprodução, hashes, marcadores e fecho das entradas C05](evidence/20260928_task416_local.json). Cache208, componente já pertencente ao conjunto offline; nenhuma dependência ou alteração de esquema.

## Continuidade

C06 permanece em execução. O teste aprova o componente da fila; não transforma a página técnica antiga ou outros componentes de campo numa interface totalmente traduzida. TASK417 trata `technician.html`/`technician.js` a partir das entradas do inventário, com preservação de rascunhos/valores/recibos. Visita/mensal em DE continuam em C09.

O snapshot C05 conserva a fotografia da base3c3e65. Este lote fecha as19 entradas de origem desta fila com17 textos de aplicação localizados, um marcador interno e um rótulo original preservado; não regenera nem declara resolvidos os restantes candidatos. CI nativo/restauro pendentes; o runner atual contém318 grupos.

**Publicação TASK416:** commit `e1306ecd5991b7a1266ec67fbe7c8967cfa7497c`, árvore `6ebf796ddcabfdb0808fbd34ff9169b267330b3e`, igual à preparada/testada; branch `work/field-readiness-20260915-simulation`. [CI 36495253808](https://github.com/ts7520305-svg/cristalwater/actions/runs/36495253808), job109173198905, em execução após seis etapas aprovadas. Exigir318 grupos exatos/restauro; TASK413/TASK414 ainda na suite com dez etapas aprovadas na última leitura. Próximo TASK417/C06: página técnica antiga.
