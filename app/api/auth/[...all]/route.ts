import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "../../../../src/auth/config";
import { checkRateLimit } from "../../../../src/server/rate-limit";
import { getServerIdentity } from "../../../../src/auth/session";
import { appendAuditLog } from "../../../../src/server/audit";

const handler = toNextJsHandler(auth);

export const GET = handler.GET;
export async function POST(request: Request) {
  const pathname = new URL(request.url).pathname;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (pathname.endsWith("/sign-in/email")) {
    if (!checkRateLimit(`login:${ip}`, 5, 15 * 60 * 1000)) {
      return Response.json({ error: "TOO_MANY_REQUESTS" }, { status: 429 });
    }
  }
  if (pathname.endsWith("/sign-out")) {
    if (!checkRateLimit(`logout:${ip}`, 30, 60 * 1000)) {
      return Response.json({ error: "TOO_MANY_REQUESTS" }, { status: 429 });
    }
    const identity = await getServerIdentity();
    const response = await handler.POST(request);
    if (identity) {
      await appendAuditLog({
        tenantId: identity.tenantId,
        actorUserId: identity.userId,
        action: "auth.logout",
        entityType: "Session",
        ipAddress: ip,
      });
    }
    return response;
  }
  const response = await handler.POST(request);
  if (pathname.endsWith("/sign-in/email") && response.ok) {
    const setCookie = response.headers.get("set-cookie");
    const identity = setCookie
      ? await auth.api.getSession({
          headers: new Headers({ cookie: setCookie.split(";")[0] }),
        }).then(async (session) => {
          if (!session?.user) return null;
          return {
            userId: session.user.id,
            tenantId: String(session.user.tenantId),
          };
        })
      : await getServerIdentity();
    if (identity) {
      await appendAuditLog({
        tenantId: identity.tenantId,
        actorUserId: identity.userId,
        action: "auth.login",
        entityType: "Session",
        ipAddress: ip,
      });
    }
  }
  return response;
}
