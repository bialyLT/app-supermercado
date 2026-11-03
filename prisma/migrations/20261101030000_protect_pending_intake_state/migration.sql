-- Pending intake cases are append-only: the only permitted UPDATE is the
-- single transition to a terminal state with review metadata.
CREATE OR REPLACE FUNCTION prevent_resolved_intake_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD."status" <> 'PENDING_REVIEW' THEN
    RAISE EXCEPTION 'INTAKE_REVIEW_IMMUTABLE';
  END IF;
  IF NEW."status" NOT IN ('CONFIRMED', 'CORRECTED', 'REJECTED')
    OR NEW."reviewedBy" IS NULL OR NEW."reviewedAt" IS NULL
    OR (NEW."status" = 'CORRECTED' AND NEW."correctionQuantity" IS NULL)
    OR (NEW."status" <> 'CORRECTED' AND NEW."correctionQuantity" IS NOT NULL)
    OR (to_jsonb(NEW) - 'status' - 'correctionQuantity' - 'reviewedBy' - 'reviewedAt')
      IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'correctionQuantity' - 'reviewedBy' - 'reviewedAt') THEN
    RAISE EXCEPTION 'INTAKE_REVIEW_STATE_TRANSITION_INVALID';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

REVOKE DELETE, TRUNCATE ON "UnverifiedIntakeReview" FROM supermercado_app;
