# CRYSTAL OS ENGINEERING STANDARD

## Every implementation must follow:

Architecture
↓

Tests
↓

Documentation
↓

Review
↓

Approval
↓

Commit

Never change this order.

---

## Every TASK

TASK Size

Nível 1 — Hotfix
1–5 ficheiros

Utilização:
- bugs críticos
- regressões
- correções urgentes

---

Nível 2 — Business Capability (Padrão)

5–20 ficheiros

Utilização:
- uma capacidade completa
- um fluxo de negócio
- uma funcionalidade operacional

Este passa a ser o tamanho normal das TASKs.

---

Nível 3 — Epic Integration

20–50 ficheiros

Apenas permitido quando:

- todos os testes passam;
- arquitetura estável;
- documentação atualizada;
- aprovado explicitamente.

---

Nova regra:

Prefer Business Capability TASKs (5–20 ficheiros).

Só utilizar Hotfix TASKs quando existir um problema específico.

Antes de iniciar qualquer TASK superior a 20 ficheiros:

Parar.

Explicar.

Pedir aprovação.

One responsibility.

One Business objective.

No duplicated code.

No hidden behaviour changes.

---

## Every EPIC

Must finish with:

- Tests green
- Documentation updated
- Roadmap updated
- Changelog updated
- ADR updated
- Report generated

---

## Code Quality

Prefer refactor over rewrite.

Prefer reuse over duplication.

Prefer simplicity over cleverness.

---

## Documentation

Every architectural decision
must be recorded.

Every business rule
must be documented.

Every new module
must have a report.

---

## Review Checklist

Before commit confirm:

□ Tests pass

□ Architecture respected

□ Crystal Kernel respected

□ Permissions respected

□ Performance acceptable

□ Documentation updated

□ No regressions

---

## Crystal Principle

The best code
is the code that
reduces human work.