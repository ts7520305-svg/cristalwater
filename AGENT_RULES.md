# Crystal OS - AGENT RULES

## Missão

Construir o Crystal OS sem partir funcionalidades existentes.

---

# Arquitetura

Sempre seguir esta ordem:

Controller
↓
Business
↓
Services
↓
Crystal Kernel
↓
Prisma

Nunca colocar lógica de negócio nos Controllers.

---

# Código

- Nunca duplicar lógica.
- Reutilizar Services existentes.
- Reutilizar Engines existentes.
- Respeitar Crystal Kernel.
- Respeitar Crystal Flow.
- Respeitar Crystal Brain.

---

# Segurança

Nunca executar automaticamente:

- git push
- git merge
- git rebase
- git reset --hard
- migrations destrutivas

Perguntar sempre antes.

---

# Testes

Antes de qualquer Commit executar:

node -c

npm test

Se existir Vitest:

npm run test:technician

---

# Commits

Commits pequenos.

Um objetivo.

Uma TASK.

---

# Refatoração

Nunca alterar comportamento.

Nunca alterar resposta JSON.

Nunca alterar rotas.

Nunca alterar Prisma sem necessidade.

Apenas mover lógica.

---

# Qualidade

Mostrar sempre:

- ficheiros alterados
- resumo
- testes executados
- riscos encontrados

Esperar aprovação antes do Commit.

Novo método de trabalho:

- Máximo 10 ficheiros alterados por TASK.
- Máximo 1 responsabilidade por TASK.
- Cada TASK deve ser independente.
- Cada TASK deve incluir testes obrigatórios e documentação obrigatória.
- Após cada TASK: executar testes, mostrar ficheiros alterados, resumo e riscos, esperar aprovação e só depois avançar para a próxima TASK.
- Nunca acumular 30 ou mais ficheiros numa única alteração sem aprovação intermédia.

Fonte oficial do projeto:

- PROJECT_MANIFEST.md
- PROJECT_VISION.md
- CRYSTAL_OS.md
- AGENT_RULES.md
- ROADMAP.md
- EPICS.md

Sempre que existir conflito entre o código atual e estes documentos, o agente deve:

1. apresentar o conflito;
2. explicar o impacto potencial;
3. pedir decisão antes de alterar a arquitetura;
4. validar o impacto antes de aceitar qualquer refatoração.

Nova visão de produto:

- O Crystal OS é organizado por EPICs de produto.
- Cada EPIC deve ser desenvolvido até Production Ready.
- Cada EPIC é dividido em TASKs pequenas e independentes.
- O foco é concluir produtos de negócio, não apenas módulos técnicos.

Auditoria final do Technician OS:

- Controllers apenas delegam.
- Business centraliza a lógica.
- Respostas JSON mantidas compatíveis.
- Validação final executada com sucesso.

---

# Crystal OS

Objetivo:

Menos cliques.

Mais automação.

Mais IA.

Menos trabalho humano.