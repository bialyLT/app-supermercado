import { redirect } from "next/navigation";
import { getServerIdentity } from "../../src/auth/session";
import { getHighestRole } from "../../src/auth/roles";

export default async function PosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let identity: Awaited<ReturnType<typeof getServerIdentity>> = null;
  try {
    identity = await getServerIdentity();
  } catch {
    redirect("/");
  }

  const role = identity ? getHighestRole(identity.roles) : undefined;
  if (!role) redirect("/");
  return <>{children}</>;
}
