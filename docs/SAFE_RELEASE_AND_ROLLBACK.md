# SAFE RELEASE AND ROLLBACK

Purpose: provide the minimum controlled release and rollback runbook required by PR1 and RG1.

## Release Preconditions

1. RC1 report is PASS.
2. PR1 report is PASS.
3. Fresh backup exists and its filename is recorded in the release notes.
4. Rollback operator is assigned.
5. Maintenance communication is prepared if the deploy affects live traffic.

## Safe Release Flow

From the backend root:

```bash
npm ci
npx prisma generate
npm run check:syntax
npx prisma validate
npm run test:fcs-rc1
npm run test:pr1
```

If all gates pass, deploy the application code using the approved VPS flow:

```bash
npm run clean:vps
npx prisma migrate deploy
npm run preflight:vps
pm2 start ecosystem.config.js --env production
pm2 save
```

## Backup Requirement Before Deploy

Generate a fresh backup immediately before the release window:

```bash
npm run backup:db
```

Record:
- backup filename
- creation timestamp
- artifact size

## Minimum Rollback Trigger

Rollback immediately if any of the following occurs:
- deploy leaves the app unavailable
- authentication fails for operational users
- critical routes return 5xx
- post-deploy smoke or PR1 slice fails
- migration introduces runtime breakage

## Rollback Procedure

1. Stop serving the faulty release.
2. Repoint process manager to the previous known-good code release.
3. Preserve shared data directories and environment files.
4. If database migration caused incompatibility, restore the verified database backup in the approved maintenance window.
5. Rerun smoke plus targeted operational checks.

## Post-Rollback Verification

Run at minimum:

```bash
npm run smoke
npm run test:prod-runtime
```

Confirm:
- admin login works
- technician route/day access works
- client portal access works
- latest invoices and notifications remain visible

## Release Evidence

Archive the following with the release record:
- RC1 report path
- PR1 report path
- backup artifact path
- release version
- git tag
- operator who executed release
- operator who validated rollback readiness