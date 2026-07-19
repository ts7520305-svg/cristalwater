# PRODUCTION_BOOTSTRAP_PLAN

Date: 2026-07-07
Mission ID: PRODUCTION-004
Status: planning only, no implementation approved

## Goal

Create a brand new production database with only the minimum bootstrap data required for safe operation.

Everything outside the approved bootstrap scope must start empty.

## Approved Import Scope

Import only the following categories:

- administrator
- permissions
- settings
- templates
- products
- chemicals
- categories
- business rules

## Expected Empty State

The new production database should start empty for all other operational data, including:

- customers
- pools
- visits
- invoices
- repairs
- notifications
- technicians
- vehicles
- guides
- operational workflows
- audit history
- attachments and messages

## Schema Anchors

The current schema already confirms these persistence anchors:

- administrator accounts live in `User`
- settings live in `SystemSetting`
- inventory items live in `InventoryProduct`
- chemical usage is modeled separately in `ChemicalUsage`
- business rule entities include `SeasonalRule`, `ExtraVisitRule`, `NotificationRule`, and `VehicleAccessibilityRule`
- user notification preferences live in `UserNotificationSetting`

The exact table or model mapping for "permissions" and "templates" must be confirmed before implementation if they are not already represented by existing schema objects.

## Bootstrap Proposal

1. Create a fresh database from the production schema.
2. Seed only the approved bootstrap categories.
3. Preserve the canonical administrator account used by operations.
4. Seed baseline settings required for startup, authentication, notifications, and operational defaults.
5. Seed the minimum template catalog required by the UI and outbound workflows.
6. Seed products, chemicals, and categories that the application expects to exist at launch.
7. Seed business rules required for scheduling, notifications, seasonal behavior, and accessibility constraints.
8. Leave every customer-facing operational table empty.

## Initial Seed Boundaries

The bootstrap seed must not create any of the following:

- sample customers
- demo pools
- visits or repairs
- invoices or payments
- test notifications
- fake technicians or vehicles
- QA/stress data
- hidden operational history

## Approval Gates

This work is not approved for implementation yet.

Before any code is written, the following must be confirmed:

- the exact source of truth for permissions
- the exact source of truth for templates
- the minimum viable settings list
- the minimum viable business-rule list
- whether categories are standalone or embedded in product/chemical catalogs

## Risks

1. Seeding too little may prevent the application from starting.
2. Seeding too much may leak non-production defaults into the new database.
3. If permissions or templates are not explicit schema objects, they may need to be derived from config or code constants instead of a table seed.
4. Business rules can have hidden dependencies, so the minimal startup set must be validated before any production cutover.

## Validation Plan For A Future Implementation

If approved later, the implementation should be validated by:

- confirming the admin account exists
- confirming only the approved bootstrap categories have rows
- confirming customer and operational tables remain empty
- confirming the app starts and reaches login/dashboard paths with the seeded data

## Decision Needed

Awaiting CTO approval before any implementation work.