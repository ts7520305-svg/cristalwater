# TASK102 — Portal de decisão de orçamentos

## Comportamento

- O administrador publica explicitamente a versão guardada do orçamento. Alterações por guardar impedem a publicação; confirmação apresenta versão e total com IVA. A ação publica no portal, sem prometer envio de email/SMS/WhatsApp.
- O cliente vê apenas os dados comerciais apresentados pela API: piscina, problema, versão, validade, linhas, desconto, IVA, total e condições. Conteúdo inserido por utilizadores é apresentado com textContent; não executa HTML e não sofre tradução automática das condições.
- Aprovação e recusa requerem leitura confirmada por caixa de seleção e confirmação com versão/total/IVA. Apenas PENDING permite decidir. Administrador tem pré-visualização sem botões de decisão.
- Pedidos capturam token, cliente e revisão de seleção; respostas antigas não preenchem outro cliente/conta. Troca de sessão oculta e limpa o módulo.
- Falhas de rede/408/409 não apresentam sucesso nem repetem automaticamente decisões. O cliente atualiza para consultar o estado efetivamente registado antes de voltar a decidir.
- Os orçamentos são consultados com pedido próprio ao carregar a página ou ao atualizar; não existe polling contínuo ao servidor. Uma verificação local acompanha a seleção de cliente e sessão.

## Validação

`node scripts/test-client-quotes-browser.js` com Chromium: confirma aprovação/recusa, confirmação obrigatória, ausência de POST automático, falhas 408/409 sem falso sucesso, pré-visualização admin, XSS inerte, larguras 320/390/1280 e resposta atrasada após troca de conta.

`node scripts/test-commercial-quotes-browser.js`: versão por guardar bloqueia publicação, publicação guardada funciona e conflito 409 fica visível; mantém testes existentes de cálculo, gravação, aprovação administrativa, layout e sessão.

Os testes de navegador usam HTML/script reais e APIs simuladas. Autorização real, concorrência e persistência são cobertas separadamente pela TASK101 de backend. Textos deste módulo estão em português; localização completa e entrega externa não estão incluídas nesta TASK.
