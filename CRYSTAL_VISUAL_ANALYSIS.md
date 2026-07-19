# CRYSTAL VISUAL ANALYSIS

Mission ID: CRYSTAL-OS-V2-AUDIT
Date: 2026-07-11
Scope: Visual quality audit against modern SaaS standards.

## 1. Benchmark Targets

Benchmarks requested:
- Linear
- Stripe
- Vercel
- Apple HIG
- Microsoft Fluent
- Notion
- Skimmer
- Jobber
- Housecall Pro

## 2. Current Visual Maturity Assessment

Overall: inconsistent mid-level maturity, not premium.

### Strong areas
- Some enterprise admin screens have clear card hierarchy and strong dark visual identity.
- Technician field mode shows intent for larger touch targets.

### Weak areas
- Multiple conflicting visual systems in production.
- Inconsistent type scale and spacing rhythms.
- Button/card/form language changes by module.
- Inconsistent tokenization and low component reuse.

## 3. Why the UI still feels like ERP

1. Module-first architecture dominates over task-first workflows.
2. High density of controls, filters, and management lists.
3. Repeated table/list management patterns with limited contextual prioritization.
4. Navigation exposes many modules equally instead of guiding next best action.
5. Visual hierarchy often emphasizes administration breadth over operational focus.

Evidence screens:
- [frontend/admin-dashboard.html](frontend/admin-dashboard.html)
- [frontend/admin-master-control.html](frontend/admin-master-control.html)
- [frontend/admin-rounds.html](frontend/admin-rounds.html)
- [frontend/admin-clients.html](frontend/admin-clients.html)

## 4. Benchmark Gap Analysis

### Linear-style clarity and restraint
Gap:
- Too many visual variants and mixed component styles.
- Inconsistent spacing rhythm and card density.

### Stripe-style hierarchy and information architecture
Gap:
- Structural hierarchy is broad but not consistently progressive.
- Context resets between modules.

### Vercel-style focus and calm
Gap:
- Frequent visual noise from many action clusters.
- High style variance across adjacent pages.

### Apple HIG (clarity, deference, depth)
Gap:
- Clarity is uneven; action prominence often overloaded.
- Depth cues are inconsistent because many pages define custom card/shadow systems.

### Microsoft Fluent (coherent system behavior)
Gap:
- Component behavior and visual semantics are not centralized.
- Runtime injection layers override page styles unpredictably.

### Notion simplicity and composability
Gap:
- Interactions are not composable across modules.
- Role context is fragmented.

### Skimmer / Jobber / Housecall Pro (field-service centric)
Gap:
- Technician experience is split between modern field mode and legacy technician pages.
- End-to-end field journey is not unified into one cockpit.

## 5. Visual Consistency Findings

### Typography
- Mixed stacks: Arial-only, Inter stacks, Sora/IBM Plex in separate layers.
- Headline/body scale inconsistent by page.

### Color system
- Multiple palettes coexist: dark enterprise, light legacy blue, v25/v26 token sets.
- Semantic meanings (warn/danger/success) vary in tone and contrast.

### Spacing and shape
- Radius scales vary from 4 to 24 px.
- Vertical rhythm changes between modules.

### Components
- Button variants are locally redefined repeatedly.
- Cards are not standardized in spacing, shadow, border tone.
- Forms and tables have multiple independent implementations.

## 6. Accessibility and Perception

- Contrast quality is uneven between custom dark themes and light legacy pages.
- Reliance on color-coded states without consistent icon/text redundancy.
- Keyboard/focus behavior is inconsistent due to layered CSS systems.

## 7. Visual Risk Register

Critical:
1. Multi-era style stack in production.
2. Runtime UI mutation via injected shells and overlays.

High:
1. Typography and component inconsistency.
2. Fragmented role visual identity.

Medium:
1. Legacy prototype assets present in same frontend tree.
2. Inconsistent responsive behaviors.

## 8. Visual Direction Recommendation (non-implementation)

- Adopt one canonical token system and one component layer.
- Remove style-system parallelism from runtime path.
- Define per-role shells with shared primitives and role accents.
- Enforce strict design QA gates per phase.

Status: Visual audit complete. Waiting CTO approval before implementation.
