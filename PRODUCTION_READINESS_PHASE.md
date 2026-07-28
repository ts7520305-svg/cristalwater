# PRODUCTION_READINESS_PHASE

Date: 2026-07-26
Baseline: RC1 approved and frozen
Rule: no new functional scope in this phase

## Objective

Move the project from feature construction into production stabilization.

This phase preserves RC1 as the baseline and only allows:
- production-readiness validation
- real operational validation
- targeted defect correction
- release preparation

This phase does not allow:
- new business capabilities
- schema expansion for non-blocking improvements
- broad refactors
- opportunistic cleanup unrelated to observed production-readiness risk

## Sequence

1. PR1 - Production Readiness Gate
- Validate RC1 baseline integrity.
- Validate installation and update prerequisites.
- Validate backup generation and rollback evidence.
- Validate operational runtime health, security, and readiness artifacts.

2. Operational Validation
- Execute full scenarios with technician, administrator, and client profiles.
- Record only bugs, UX problems, and uncovered cases.
- Do not add features.

3. Corrections
- Each correction must map to an observed issue.
- Each correction must preserve RC1 baseline behavior.
- Each correction must pass RC1 plus the relevant focused gate.

4. RG1 - Release Gate
- Confirm RC1 remains intact.
- Confirm PR1 passed.
- Confirm backups and rollback plan are in place.
- Confirm evidence is archived.
- Confirm release version is identified and tagged.

5. Production
- Deploy.
- Execute hypercare observation.
- Correct only real incidents.

## Executable Gates

- PR1: `npm run test:pr1`
- RG1: `npm run test:rg1`
- Runtime health slice: `npm run test:prod-runtime`

## Approval Rules

1. Never bypass RC1 regression coverage.
2. Never dilute acceptance criteria to make PR1 or RG1 pass.
3. Every defect fix in this phase must rerun the impacted local test plus RC1.
4. If a gate fails, correct the specific cause and rerun the same gate before expanding scope.

## Evidence To Archive

- latest RC1 report
- latest PR1 report
- backup artifact reference
- rollback runbook
- production validation notes
- release tag used for RG1

## Current State

- RC1: approved
- PR1: prepared for execution
- RG1: prepared for execution after PR1 and manual release approvals