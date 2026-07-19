# CRYSTAL TECHNICIAN EXPERIENCE

Mission ID: UX-REBUILD-MASTER
Status: Strategy only. No implementation.
Priority: Highest

## Field Reality Assumptions
- Sunlight
- Wet hands
- Gloves
- One-handed use
- Stress and interruptions
- Poor internet
- Standing near pool equipment

## Experience Goal
The technician always knows, instantly:
- Current pool
- Next task
- Urgent alerts
- Required products
- Required tools
- Evidence required
- Completion state

## Field UX Principles
- Tap-first, not type-first.
- Giant controls and huge spacing.
- High contrast in all states.
- One-thumb reach critical actions.
- Voice-ready where typing is painful.
- Offline-safe with explicit sync state.

## Technician Home (Field Command)
- Current Job Hero
- Next Job Preview
- Urgent Alert Strip
- Required Product/Tool checklist
- One primary action: Start/Continue task

## Screen Contract
- Where am I?
  - Operations > Service Execution > Current Job
- What requires my attention?
  - urgent alerts + must-complete checklist items
- What is my next action?
  - single large CTA (Start/Continue/Complete)

## Daily Workflow
1. Start-of-day readiness check
2. Open current pool context
3. Execute task checklist
4. Capture measurements and photos
5. Trigger repair/escalation if needed
6. Complete visit and sync
7. Move to next task

## Primary Actions (Large Buttons)
- Start visit
- Complete checklist
- Add photo/evidence
- Report issue/repair
- Complete visit

## Secondary Actions
- Add note (voice/text)
- Request additional products
- Mark access blocked

## Input Model
- Zero unnecessary typing.
- Pre-filled values from prior visit.
- Voice note and quick tags.
- Number pads for chemistry values.

## Visual Rules for Field Mode
- Minimum touch target: 56px
- Primary CTA height: 64px+
- Critical text size larger than office roles
- Semantic status chips with icon + label
- No tiny links for mission-critical actions

## Offline and Resilience
- Persistent sync bar (Synced / Pending / Failed)
- Queue writes locally when offline
- Show unsynced item count
- Block destructive exits if critical evidence missing

## Urgent Alert Model
- Alert always anchored top of screen
- Contains:
  - severity
  - required response
  - due now indicator
- One tap to escalate or acknowledge

## Technician End-of-Day Flow
1. Verify all started visits are closed or flagged
2. Submit unresolved blockers
3. Reconcile product/tool usage
4. Confirm sync complete
5. End shift

## Device Behavior
- Mobile is primary platform and reference design.
- Tablet supports expanded checklist and media review.
- Desktop is supervisor review mode, not field default.

## Quality Gates
- Can complete standard visit with minimal typing.
- Can complete urgent repair path in <= 2 major navigation steps.
- Can operate with one hand under sunlight.
