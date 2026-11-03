-- Permit only the reviewed terminal-transition fields; the trigger rejects every other mutation.
GRANT UPDATE ("status", "correctionQuantity", "reviewedBy", "reviewedAt")
  ON "UnverifiedIntakeReview" TO supermercado_app;
