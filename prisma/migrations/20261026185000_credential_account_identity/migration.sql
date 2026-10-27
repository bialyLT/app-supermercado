-- Better Auth 1.7 credential accounts identify the user by id, not email.
-- Preserve credential hashes and provider links; do not delete duplicate accounts.
UPDATE "Account" AS account
SET "accountId" = account."userId"::text
FROM "User" AS app_user
WHERE account."userId" = app_user."id"
  AND account."providerId" = 'credential'
  AND account."accountId" = app_user."email";
