# Neon/Vercel release and backup runbook

## Approved target

- PostgreSQL: Neon Free, São Paulo (`aws-sa-east-1`).
- Application: Vercel, provider subdomain initially; São Paulo functions when
  the project plan supports selecting `gru1`.
- Production deployment: **not executed by this epic**.
- CI policy: pull request required; merge to the protected default branch is the
  only release candidate. Vercel production deployment remains a separate owner
  action.
- No secrets, connection strings or personal data belong in Git.

## Required configuration

Configure these as encrypted environment variables in the temporary owner
account or deployment provider:

- `DATABASE_URL`: application/runtime Neon connection string.
- `AUTH_DATABASE_URL`: Better Auth connection string.
- `MIGRATION_DATABASE_URL`: migration-owner connection string, used only by the
  migration workflow or an operator.
- `BACKUP_DIR`: local encrypted backup directory on the business workstation.
- `BACKUP_OFFSITE_DIR`: second encrypted/offline or separately mounted copy.
- `BACKUP_RETENTION_DAYS`: explicit business retention policy; the script defaults
  to 30 days until the business chooses another value.

## Backup procedure

Run `scripts/backup-postgres.sh` from a machine with `pg_dump` installed. Set
`PG_DUMP_BIN` when the client is not on `PATH`. The script fails closed unless
both local and offsite destinations are configured.
It creates a custom-format dump, restricts permissions to the operator, copies
it to both destinations, and removes files older than the configured retention.
Schedule it daily with Windows Task Scheduler or Linux `cron`. Do not print the
connection string or dump contents in logs.

A local workstation is not a sufficient single copy: keep the second copy on a
separate encrypted disk, NAS, or business-controlled storage account.

## Restore drill

1. Select the newest dump and record its timestamp.
2. Provision an empty disposable PostgreSQL database.
3. Set `BACKUP_FILE`, `RESTORE_DATABASE_URL` to that disposable target, and
   `ALLOW_RESTORE=YES`. Set `PG_RESTORE_BIN` when the client is not on `PATH`.
4. Run `scripts/restore-postgres-backup.sh` and record elapsed time.
5. Reapply runtime role grants and verify RLS before application checks. The dump
   intentionally excludes ACLs; run the repository's role-provisioning/migration
   procedure against the restored target rather than granting the app owner role.
6. Run Prisma validation, a read-only smoke query, ledger reconciliation and the
   report smoke test against the restored target.
7. Record RPO (dump age) and RTO (restore plus checks) in the epic report.

Never point `RESTORE_DATABASE_URL` at production during a drill. The script
requires the explicit `ALLOW_RESTORE=YES` confirmation because `pg_restore
--clean` overwrites objects in the target.

## Release checklist

- [ ] Owner transfers Neon/Vercel/GitHub temporary account access before closure.
- [ ] Neon project is created in São Paulo and runtime/migration roles are
      least-privilege; no owner connection string is used by the app.
- [ ] Vercel project uses the provider subdomain and encrypted environment vars.
- [ ] GitHub default branch protection requires pull request and green CI.
- [ ] CI runs generate, validate, migration, tests, coverage, ledger, build and
      E2E gates; no workflow deploys production automatically.
- [ ] Daily backup task is installed and its first local/offsite copies exist.
- [ ] Restore drill is completed and timed on a disposable database.
- [ ] Production activation is separately approved by the owner.
