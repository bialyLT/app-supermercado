-- Complete the runtime boundary for pending intake cases. This is additive
-- and safely repairs databases where the prior function-only migration ran.
DROP TRIGGER IF EXISTS "UnverifiedIntakeReview_immutable" ON "UnverifiedIntakeReview";
CREATE TRIGGER "UnverifiedIntakeReview_immutable"
  BEFORE UPDATE OR DELETE ON "UnverifiedIntakeReview"
  FOR EACH ROW EXECUTE FUNCTION prevent_resolved_intake_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON "UnverifiedIntakeReview" FROM supermercado_app;
