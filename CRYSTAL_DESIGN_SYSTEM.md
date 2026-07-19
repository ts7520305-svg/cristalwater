# CRYSTAL DESIGN SYSTEM

Mission ID: UX-REBUILD-MASTER
Status: Strategy only. No implementation.

## Purpose
Create one visual and interaction language for Crystal OS so every role sees a calm, premium, action-oriented operational system.

## Product Principles
- Clarity over decoration.
- Action over information dump.
- Consistency over per-page creativity.
- Speed over visual noise.
- Focus over choice overload.
- Accessibility by default.

## Inspiration Synthesis (2023-2026)
- Linear: calm density, purposeful workflows, speed as a feature.
- Stripe Dashboard: operational trust, risk-forward hierarchy, clear financial states.
- Vercel Geist: strict tokenization, spacing rhythm, restrained motion, content precision.
- Notion: universal search, command-first operations, composable workspace.
- Raycast: keyboard-first command palette, low friction action model.
- Atlassian + Fluent + Apple HIG: design systems discipline, accessibility, semantic states.
- Figma + Framer: component rigor, rapid iteration without inconsistency.
- Slack + ClickUp + Monday: collaboration context, but avoid overcrowded ERP-style navigation.

## Experience North Star
Every screen must answer in under 2 seconds:
1. Where am I?
2. What requires my attention?
3. What is my next action?

## Visual Foundations

## Color Model
- Base: neutral, high-contrast, low-saturation surfaces.
- Semantic accents only:
  - Critical: red
  - Warning: amber
  - Positive: green
  - Focus/primary action: blue-cyan
- Rule: color signals meaning, never decoration.

## Typography System
- One type family for UI and one mono companion for IDs/data.
- Three readability tiers:
  - Display (screen purpose)
  - Action (buttons/nav/table headers)
  - Body (support text)
- Technician mode uses larger default text scale than admin/customer.

## Spacing System
- 4px base scale.
- Canonical rhythm:
  - 8px inside a micro-group
  - 16px between controls
  - 24px between blocks
  - 32-40px between sections
- No arbitrary spacing values.

## Shape and Elevation
- Radius family: 6 / 12 / 16 / full-pill only.
- Elevation by surface contrast first, shadows second.
- Interactive boundaries always visible in sunlight and low-end screens.

## Icon Language
- One icon set only.
- Outline style for neutral actions, filled style for active/critical actions.
- Icons always paired with text for critical operations.

## Motion System
- Motion is functional, not decorative.
- Default transitions 120-180ms.
- No looping motion in operational views.
- Respect reduced-motion preference.

## Component Semantics
- Primary action: one per view.
- Secondary actions: grouped and de-emphasized.
- Destructive actions: isolated and explicit.
- Status objects must include text + color + icon.

## Accessibility Baseline
- WCAG AA minimum.
- Touch targets >= 44px (Admin/Secretary/Customer), >= 56px (Technician).
- Strong focus-visible states.
- High-contrast technician field mode for sunlight.
- Reduced typing pathways (especially technician).

## Role Surface Modes
- Admin: decision mode (risk, SLA, exceptions).
- Secretary: throughput mode (search, shortcuts, rapid forms).
- Technician: field mode (large controls, one-thumb, offline-ready behavior).
- Customer: trust mode (premium, concise, reassuring).

## Content and Voice
- Labels are verb + object (for actions).
- No vague CTA text (avoid "Confirm", "OK", "Proceed").
- Empty states always include first next step.
- Error messages include action guidance.

## Anti-Patterns (Forbidden)
- Decorative KPI cards without actions.
- Duplicate navigation paradigms.
- More than one primary CTA in same context block.
- Overloaded tables as default home screens.
- Hidden critical alerts behind secondary tabs.

## Governance
- Any new UI must declare:
  - workflow owner
  - role
  - primary action
  - semantic state mapping
  - token compliance
