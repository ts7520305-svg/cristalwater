# TASK107 — Revisões preventivas no ecrã do técnico

A área Agora integra revisões dos equipamentos da visita selecionada. O render principal comunica apenas visitId através de `cw:field-visit-selected`; o módulo consulta a API autorizada. Planos pausados não aparecem, e planos ativos surgem por data prevista, com indicação de atraso/hoje/próxima revisão, instruções e última execução. Não altera o fluxo principal de conclusão de visitas.

Para registar é necessário escrever pelo menos três caracteres nas observações e confirmar a execução numa caixa de seleção. A ação usa UUID e versão do plano. Só uma resposta de sucesso do servidor apresenta revisão registada.

Uma resposta perdida ou erro transitório deixa o resultado incerto. Atualizar consulta o estado atual; se a versão avançou, termina a pendência. Se não avançou, pode repetir explicitamente a mesma confirmação com o mesmo UUID e payload, beneficiando da idempotência do backend. Não existe reenvio automático, armazenamento persistente nem sincronização de conclusões em background. Pendências incertas são conservadas apenas na memória da página e por plano/visita. Depois de fechar/reabrir, consultar o estado antes de registar de novo.

Sem ligação, a última consulta em memória pode continuar visível, identificando visita e hora da consulta, sem ações de conclusão. Trocar visita limpa a apresentação imediatamente. Token, visita e revisão são verificados antes/depois dos pedidos; resposta antiga não preenche a nova visita. Trocar conta oculta e limpa a área.

## Testes

`CW_CHROMIUM_PATH=... node scripts/test-field-equipment-browser.js`

PASS: plano pausado excluído, atraso, XSS inerte, notas/checkbox obrigatórias, nenhum POST automático, erro 503 e repetição idêntica UUID/payload, sucesso confirmado pelo servidor, consulta offline datada sem ações, resposta atrasada após troca de visita, troca de conta e larguras 320/390/1280. Harness usa HTML/script reais com API simulada; teste integrado com backend e telemóveis físicos são gates separados.
