import { betterAuth } from "better-auth";
import { env, authSecret } from "../config/env";
import { authDatabaseAdapter } from "../server/repositories/identity";

function createAuth() { return betterAuth({
  database: authDatabaseAdapter(),
  secret: authSecret(),
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  user: {
    additionalFields: {
      tenantId: { type: "string", required: true, input: false },
      displayName: { type: "string", required: true, input: false },
      active: { type: "boolean", required: true, input: false },
    },
  },
  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "strict",
      secure: env.NODE_ENV === "production",
    },
  },
}); }

let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() { return instance ??= createAuth(); }
