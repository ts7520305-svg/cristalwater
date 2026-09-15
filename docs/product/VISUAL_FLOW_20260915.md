# Evidência visual com autenticação real

`scripts/test-field-visual-flow.js` usa o servidor QA já iniciado, a base QA e Playwright. Não substitui APIs, JavaScript da aplicação nem injeta sessões. Entra pelos formulários reais de técnico (PIN), cliente e administrador.

## Proteção e execução

Exige simultaneamente `NODE_ENV=test`, `QA_MODE=true`, `QA_ENVIRONMENT_SAFE=true`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` do ambiente isolado. Nunca executar contra dados operacionais. `CW_BASE_URL` aponta para o backend (por omissão `http://127.0.0.1:3002`) e `CW_CHROMIUM_PATH` permite escolher Chromium instalado. O script não inicia o servidor nem altera configurações globais.

Cria três piscinas fictícias no Algarve, uma ronda, visitas de hoje, um técnico e um cliente de demonstração. As credenciais temporárias são geradas aleatoriamente, não são impressas nem guardadas nos resultados. Os dados criados ficam apenas na base descartável QA. O utilizador administrador existente deve também ser exclusivamente de QA.

## Verificações

- Formulário de login real, criação da sessão e redirecionamento de cada perfil.
- Piscina atribuída no ecrã técnico, nome do cliente no portal e visita no painel administrativo.
- Página visível, sem transbordo horizontal e sem erros JavaScript não tratados ou respostas API 5xx.
- Saída, remoção dos tokens locais e bloqueio do regresso à página protegida.
- Preservação exata de um registo pendente do técnico durante a saída. O registo de teste fica bloqueado para impedir o envio automático.

A saída usa o botão visível quando encontrado. O resultado indica explicitamente se foi necessário invocar a função pública `CristalAuth.logout()` por ausência de botão dedicado; isso não é apresentado como teste de usabilidade desse botão.

## Imagens e limites

Guarda páginas reais completas em `reports/field-visual/<timestamp>/`: login vazio e ecrã autenticado de cada perfil (390 × 844 móvel; 1440 × 1000 administrador), imagens de falhas e `results.json`. Antes da captura, esvazia campos de credenciais para evitar exposição mesmo numa falha do login.

As imagens mostram dados fictícios. Trata-se de um percurso visual e funcional em navegador automatizado com servidor real de QA. Não prova receção de push num telemóvel fechado, qualidade do GPS físico, funcionamento durante dias sem rede nem capacidade de produção sob carga. Testes de carga, concorrência, restauro e sincronização são complementares.

## Orçamento publicado e aprovado no portal

O cenário cria também uma reparação, grava e publica o orçamento através das APIs administrativas reais após autenticação. No portal cliente confirma o estado pendente, o bloqueio da aprovação sem reconhecimento das condições, marca a caixa, aprova no botão e aceita a confirmação do navegador. Exige `APPROVED` tanto no ecrã como na reparação persistida. Guarda imagens da secção antes e depois da decisão.

O nome da próxima piscina é verificado em `#fieldFocusNow`, o cartão visível do separador Hoje. `#nextTitle` pertence ao separador Visita e estar oculto ao entrar é comportamento legítimo; a primeira execução identificou e corrigiu esta seleção incorreta no teste.

A captura isolada da secção de orçamento usa largura móvel de 390 px e altura de 1200 px para a barra fixa de navegação não sobrepor o fundo do cartão longo na imagem. O percurso e a verificação de transbordo dos perfis móveis continuam a decorrer a 390 × 844; o HTML e CSS não são alterados para a captura.
