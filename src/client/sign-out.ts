import { apiFetch, errorMessage } from "./api-fetch";

/**
 * Better Auth rejects a bodyless POST to /api/auth/sign-out with 415, which
 * silently left the session cookie alive. Always send a JSON payload.
 */
export const SIGN_OUT_INIT: RequestInit = {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}",
};

export type SignOutResult = { readonly ok: true } | { readonly ok: false; readonly message: string };

/**
 * Never throws: the caller decides whether it is safe to navigate away.
 * Navigating on a failed request is what made the session look closed while
 * it was still valid.
 */
export async function signOut(fetcher: typeof apiFetch = apiFetch): Promise<SignOutResult> {
  try {
    await fetcher("/api/auth/sign-out", SIGN_OUT_INIT);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}
