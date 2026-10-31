import type { Page } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import type { RoleName } from "@prisma/client";
import { admin, enabled, fixture } from "../../integration/fixtures";

export { admin, enabled, fixture };

export const DEFAULT_E2E_PASSWORD = "Synthetic-gate-only-2026!";

export interface AuthenticatedAdminSession {
  fixture: Awaited<ReturnType<typeof fixture>>;
  user: Awaited<ReturnType<typeof admin.user.findUniqueOrThrow>>;
  password: string;
}

/**
 * Seeds a real tenant, actor with the given role, and a credential account
 * in the gate database.
 */
export async function seedAdminIdentity(
  role: RoleName = "ADMIN",
  options: Parameters<typeof fixture>[1] = {}
): Promise<AuthenticatedAdminSession> {
  const f = await fixture(role, options);
  const user = await admin.user.findUniqueOrThrow({ where: { id: f.actor.userId } });
  const password = DEFAULT_E2E_PASSWORD;
  await admin.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: await hashPassword(password),
    },
  });
  return { fixture: f, user, password };
}

/**
 * Signs in through the Better Auth credential endpoint (/api/auth/sign-in/email)
 * using the browser page context so session cookies are stored in Playwright.
 */
export async function signInViaEmail(
  page: Page,
  email: string,
  password: string = DEFAULT_E2E_PASSWORD
): Promise<void> {
  await page.goto("/");
  const loginStatus = await page.evaluate(
    async ({ email, password: value }) => {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: window.location.origin,
          "x-forwarded-for": crypto.randomUUID(),
        },
        body: JSON.stringify({ email, password: value }),
      });
      return response.status;
    },
    { email, password }
  );

  if (loginStatus !== 200) {
    throw new Error(`Failed to sign in via /api/auth/sign-in/email: status ${loginStatus}`);
  }
}

/**
 * Convenient helper to seed an admin identity and sign in on the provided page.
 */
export async function authenticateAdmin(
  page: Page,
  role: RoleName = "ADMIN",
  options: Parameters<typeof fixture>[1] = {}
): Promise<AuthenticatedAdminSession> {
  const session = await seedAdminIdentity(role, options);
  await signInViaEmail(page, session.user.email, session.password);
  return session;
}
