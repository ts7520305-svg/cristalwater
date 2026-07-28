# Layout V23 Technician Task Baseline

Date: 2026-07-26
Scope: UX baseline only (no behavior changes)
Source UI: /technician-field-mode

## 1) Objective

Establish baseline interaction cost for high-frequency technician tasks.
All upcoming visual changes must reduce friction while preserving behavior.

## 2) Core Tasks (Top 8)

1. Open current visit and start intervention
2. Register water readings (pH, chlorine, alkalinity, ORP)
3. Add used product dosing
4. Capture before/after/problem photos
5. Register a problem/extra
6. Mark water open reminder and close it later
7. Conclude visit and move to next
8. Access critical documents status (transport/work guide/insurance)

## 3) Baseline Interaction Map (Current)

### Task 1 - Start intervention
Current path:
1. Enter technician field mode
2. Select pool (if not already selected)
3. Tap "Iniciar visita"
Baseline estimate:
- taps: 2 to 3
- friction points: pool selection can require scroll/context switch

### Task 2 - Register readings
Current path:
1. Open "Agora" context
2. Fill reading fields
3. Continue workflow to conclude
Baseline estimate:
- taps: 6 to 10
- friction points: many inputs in a single block, cognitive load during quick field work

### Task 3 - Add product dosing
Current path:
1. Tap "Adicionar produto"
2. Select product
3. Enter quantity/unit
4. Repeat if needed
Baseline estimate:
- taps: 4+ per product
- friction points: repeated row interactions can become heavy on mobile

### Task 4 - Capture photos
Current path:
1. Tap photo type (before/after/problem)
2. Capture image
3. Wait sync or manually sync later
Baseline estimate:
- taps: 2+ per photo
- friction points: status context competes with other content blocks

### Task 5 - Register problem
Current path:
1. Open "Extras / problemas"
2. Tap "Registar extra ou problema"
3. Fill classification + message
4. Save
Baseline estimate:
- taps: 5 to 7
- friction points: problem entry is not always the dominant action under pressure

### Task 6 - Manage water-open reminder
Current path:
1. Open "Mais"
2. Fill minutes/time
3. Tap "Marcar água aberta"
4. Later tap "Água fechada"
Baseline estimate:
- taps: 4 to 6
- friction points: reminder and closure are not always within immediate thumb zone

### Task 7 - Conclude visit
Current path:
1. Validate pending entries (photos/products/readings/problems)
2. Tap "Concluir visita"
Baseline estimate:
- taps: 1 to 3 (after prep)
- friction points: pre-conclusion checks may require jumping across sections

### Task 8 - Check documents
Current path:
1. Open "Documentos"
2. Review center/document cards
3. Return to active task
Baseline estimate:
- taps: 2 to 4
- friction points: switching contexts can break execution rhythm

## 4) UX Problems To Solve First

1. Reduce context switching between tabs during active intervention.
2. Keep primary action always visible and thumb reachable.
3. Decrease text density in high-pressure moments.
4. Improve section prominence for interruption-critical actions.
5. Improve scan speed for status cards.

## 5) Success Criteria For Next Iteration

A candidate layout iteration is accepted only if:
- no behavior contract changes
- at least 3 of top 8 tasks show lower interaction cost or faster completion path
- critical actions are visible without deep scroll in mobile viewport
- interruption handling remains obvious and immediate
