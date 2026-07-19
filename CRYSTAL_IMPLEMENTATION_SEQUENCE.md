# CRYSTAL IMPLEMENTATION SEQUENCE

Mission ID: CRYSTAL-OS-V2-AUDIT
Date: 2026-07-11
Scope: Execution sequence and controls only. No implementation.

## Sequence Principles

1. Never modify backend/API/Prisma/business logic in UX phases.
2. Never execute more than one UX phase before validation.
3. Each phase must pass compile/test/smoke/flow checks.
4. CTO approval is mandatory between phases.

## Ordered Sequence

### Step 0 - Pre-Execution Lock
Actions:
- Freeze frontend baseline snapshot
- Confirm route inventory and role map
- Mark deprecated wrappers as pending removal (not removed yet)

Gate:
- CTO approval to begin phase execution

### Step 1 - Execute Phase 1 (Foundation Baseline)
Actions:
- Route policy, deprecation map, screenshot baseline
Validation commands:
- node --check
- npm test
- npm run smoke
- node scripts/test-operational-flow.js

Gate:
- CTO approval

### Step 2 - Execute Phase 2 (Global Shell)
Actions:
- Single shell contract, remove shell collisions
Validation commands:
- node --check
- npm test
- npm run smoke
- node scripts/test-operational-flow.js

Gate:
- CTO approval

### Step 3 - Execute Phase 3 (Navigation)
Actions:
- Unified nav, universal search, command palette contract
Validation commands:
- node --check
- npm test
- npm run smoke
- node scripts/test-operational-flow.js

Gate:
- CTO approval

### Step 4 - Execute Phase 4 (Typography + Tokens)
Actions:
- Unified type, spacing, color semantics
Validation commands:
- node --check
- npm test
- npm run smoke
- node scripts/test-operational-flow.js

Gate:
- CTO approval

### Step 5 - Execute Phase 5 (Components)
Actions:
- Migrate button/card/form/table/dialog primitives
Validation commands:
- node --check
- npm test
- npm run smoke
- node scripts/test-operational-flow.js

Gate:
- CTO approval

### Step 6 - Execute Phase 6 (Technician)
Actions:
- Unified field cockpit and one-hand workflows
Validation commands:
- node --check
- npm test
- npm run smoke
- node scripts/test-operational-flow.js

Gate:
- CTO approval

### Step 7 - Execute Phase 7 (Admin)
Actions:
- Canonical command center with 5-7 cards
Validation commands:
- node --check
- npm test
- npm run smoke
- node scripts/test-operational-flow.js

Gate:
- CTO approval

### Step 8 - Execute Phase 8 (Secretary)
Actions:
- Keyboard-first desk and speed workflows
Validation commands:
- node --check
- npm test
- npm run smoke
- node scripts/test-operational-flow.js

Gate:
- CTO approval

### Step 9 - Execute Phase 9 (Customer)
Actions:
- Premium customer home and consolidated timeline
Validation commands:
- node --check
- npm test
- npm run smoke
- node scripts/test-operational-flow.js

Gate:
- CTO approval

### Step 10 - Execute Phase 10 (Remaining Modules)
Actions:
- Consolidate long-tail modules and remove deprecated wrappers
Validation commands:
- node --check
- npm test
- npm run smoke
- node scripts/test-operational-flow.js

Gate:
- CTO final approval

## Validation Checklist Template (per phase)

1. Frontend changed files list
2. Screens impacted list
3. Desktop/tablet/mobile QA evidence
4. Accessibility smoke checks
5. Command outputs attached
6. Rollback instructions

## Self Validation

Confirmed during this audit delivery:
- No backend touched
- No Prisma touched
- No API touched
- No business logic touched

## Stop Condition

Audit and sequence documents produced.
No implementation performed.
Waiting CTO approval.
