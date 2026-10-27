-- Additive enum change must commit before the new value is used.
ALTER TYPE "ReviewStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW';
