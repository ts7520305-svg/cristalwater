# TASK108 — Configuração de manutenção preventiva

A secção Manutenção preventiva integra a central de configurações existente. O administrador escolhe a piscina, cria um plano identificado pelo componente e título, define instruções, intervalo em dias/meses e próxima revisão. Não há intervalos de limpeza predefinidos que substituam as instruções do fabricante ou o estado observado. A pausa conserva o plano e o histórico.

A edição usa a versão carregada para evitar sobrepor alterações de outra sessão ou uma conclusão em campo. Uma gravação incerta ou rejeitada limpa o editor e exige atualização da lista antes de nova tentativa. Não há envio automático de alterações nem informação de outra conta após mudança de sessão. Planos têm nomes distintos por piscina, por exemplo filtro principal e filtro infantil.

Teste scripts/test-equipment-admin-browser.js verifica criação explícita, pausa, versão, rejeição de edição desatualizada, texto não interpretado como HTML, larguras 320/390/1280 e resposta atrasada após mudança de conta. Integração real entre formulário, API e técnico é coberta em teste separado.

Limites: seleção usa as primeiras 1000 piscinas ativas da API existente. O plano identifica o componente pelo título e tipo; não se assume ligação automática ao número de série do cadastro. Os novos textos desta secção estão em português.
