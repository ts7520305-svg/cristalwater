# RC1 SAFE IMPLEMENTATION PLAN

Date: 2026-07-07
Context: RC1 / Field Validation
Mode: Planning only (no implementation yet)

## Goal

Select only backlog items that are safe for RC1 Field Validation under CTO constraints.

Allowed scope:
- Documentation
- Labels/text improvements
- UX clarity
- Field feedback capture
- No-risk layout improvements

Not allowed in this plan:
- New modules
- New database schema
- New AI systems
- New financial logic
- New permissions engine
- Large refactors

## RC1-Safe Items Selected

### A) Documentation and Knowledge Clarity (Safe)

1. Crystal OS is the living memory of Cristal Water
- Safe action: reinforce wording in strategic and operational docs.
- Type: Documentation
- Risk: Low

2. System preserves operational knowledge
- Safe action: standardize terminology in user-facing guides and internal docs.
- Type: Documentation
- Risk: Low

3. Every visit teaches the company something
- Safe action: add explicit feedback capture checklist in field validation docs.
- Type: Field feedback capture
- Risk: Low

4. Radical simplicity for non-technical employees
- Safe action: revise UI microcopy guidelines (short actions, plain language).
- Type: Labels/text improvements
- Risk: Low

5. Role-based human simulations before releases
- Safe action: create and maintain role simulation scripts/checklists in docs.
- Type: Documentation + field feedback capture
- Risk: Low

6. Professional branded reports with Cristal Water logo
- Safe action: text/template consistency checklist (titles, footer, labeling) without logic changes.
- Type: Labels/text improvements
- Risk: Low

7. Technician portal access to transport guides, work guides and intervention states
- Safe action: terminology clarity and navigation-label consistency audit only.
- Type: UX clarity + labels/text improvements
- Risk: Low

8. Guided alert resolution (documentation-first subset)
- Safe action: write operator runbook for alert triage steps using existing flows.
- Type: Documentation
- Risk: Low

9. Operational pending-tasks center (documentation-first subset)
- Safe action: define pending-task taxonomy and naming standards for current views.
- Type: Documentation + labels/text improvements
- Risk: Low

10. Pool Memory / Client Memory / Equipment Memory / Technician Memory / Company Memory (documentation-first subset)
- Safe action: define memory taxonomy, naming conventions, and evidence standards in docs.
- Type: Documentation
- Risk: Low

11. Official best practices / Validated knowledge / Rejected knowledge
- Safe action: create governance template and review workflow in docs.
- Type: Documentation
- Risk: Low

12. Living technical manual and case library (foundation only)
- Safe action: define structure, metadata, and contribution rules without new systems.
- Type: Documentation
- Risk: Low

## RC1-Safe UX / Layout Improvements (No-Risk Only)

Allowed only if strictly cosmetic and non-functional:

1. Label clarity pass
- Replace ambiguous labels with plain-language action verbs.
- No route change, no behavior change.

2. Status text normalization
- Standardize status wording across existing pages (same status -> same phrase).
- No API or logic impact.

3. Section hierarchy cleanup
- Improve headings, grouping and spacing using existing layout structure.
- No structural rewrite.

4. Field hint consistency
- Align helper text and placeholders with operational terminology.
- No validation or backend change.

5. Feedback capture prompts in UI copy
- Add explicit prompts that help capture what was learned in visits (copy only).
- No persistence change.

## Explicitly Excluded from RC1 Safe Plan

The following remain out of scope now due to CTO constraints:

1. Customer onboarding by activation link via WhatsApp / Email / SMS
- Excluded reason: likely requires new flow/module integration.

2. Flexible commercial contracts and seasonal pricing
- Excluded reason: new financial logic and likely schema impact.

3. Manual invoice sending by WhatsApp / Email (feature extension)
- Excluded reason: can imply logic/channel expansion; keep only copy/documentation updates.

4. Granular permissions engine evolution
- Excluded reason: permissions logic changes are not allowed.

5. Technician career progression with controlled access
- Excluded reason: role/access model changes beyond RC1-safe scope.

6. Expense register monthly / annual
- Excluded reason: new financial data flow risk.

7. Crystal Assistant / Crystal Companion
- Excluded reason: new AI system scope.

8. Voice interaction
- Excluded reason: new interaction subsystem.

9. External AI analysis for images/videos
- Excluded reason: new AI integration.

10. Videos as operational memory
- Excluded reason: new storage/media flow.

11. Any advanced Vision AI in core
- Excluded reason: explicitly deferred by strategy.

## Execution Order (When Approved)

1. Documentation baseline lock
- Align COMPANY_BRAIN, VISION, PROJECT_MANIFEST, and operational handbooks.

2. Field simulation packs
- Publish role-based validation scripts/checklists and feedback capture forms.

3. UX copy pass
- Apply label/status/helper text normalization in existing pages only.

4. No-risk layout pass
- Apply spacing/hierarchy readability improvements with zero functional changes.

5. Validation pass
- Confirm no API/schema/logic changes and preserve current behavior.

## Acceptance Criteria for RC1-Safe Execution

1. All changes are documentation, copy, or cosmetic layout only.
2. No backend logic changes.
3. No Prisma/schema changes.
4. No new modules.
5. No new AI systems.
6. No financial logic changes.
7. No permissions engine changes.
8. No large refactors.

## Status

Plan generated.

No implementation performed.

Waiting for CTO approval.
