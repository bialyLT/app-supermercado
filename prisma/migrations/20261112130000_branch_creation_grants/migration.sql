-- KAN-17: the "create branch" flow is the only write the application needs on
-- these two tables. Both stay tenant-scoped by the existing RLS policies
-- (Branch.tenantId = app_tenant(), Tenant.id = app_tenant()); tenant creation
-- remains a privileged, out-of-band operation.
GRANT INSERT ON "Branch" TO supermercado_app;
GRANT UPDATE ("operationalMode") ON "Tenant" TO supermercado_app;
