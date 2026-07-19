# PRE RESET BACKUP VALIDATION - 2026-07-19

## Status

BACKUP RESTAURAVEL VALIDADO

## PostgreSQL Client Versions

- pg_dump: PostgreSQL 17.10 (Ubuntu 17.10-1.pgdg22.04+1)
- pg_restore: PostgreSQL 17.10 (Ubuntu 17.10-1.pgdg22.04+1)

## Dump Artifact

- Path: backups/pre-client-domain-reset-20260719.dump
- Format: custom (-Fc)
- Size: 654504 bytes
- SHA-256: 2bdad5b5263bd6009dc22cfac081a42c5106834ac57e417f7318af3cdf8df2b5

## Validation

- pg_restore --list: PASS
- TOC lines in list file: 1118
- TOC Entries declared by archive: 1107

## Critical Tables Present

- Client: present
- Pool: present
- ServiceVisit: present
- Invoice: present
- User: present
- SystemSetting: present

Confirmed from pg_restore list:

- TABLE public Client
- TABLE public Pool
- TABLE public ServiceVisit
- TABLE public Invoice
- TABLE public User
- TABLE public SystemSetting
- TABLE DATA public Client
- TABLE DATA public Pool
- TABLE DATA public ServiceVisit
- TABLE DATA public Invoice
- TABLE DATA public User
- TABLE DATA public SystemSetting

## Source Admin Preservation Check

- Canonical admin email: cristal.water@sapo.pt
- Admin present in source: yes
- Role: ADMIN
- Active: true
- Name: Cristal Water Admin

## Companion JSON Backup

- Path: backups/pre-client-domain-reset-20260719-admin-config.json
- Purpose: preserve canonical admin metadata and system settings without plaintext password disclosure

## Notes

- The dump was created with PostgreSQL 17 client binaries after sanitizing incompatible connection URL parameters for pg_dump.
- No credentials were printed during backup creation or validation.
- No cleanup execution was performed.