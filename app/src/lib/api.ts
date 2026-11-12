// Calls to the login server functions. They decide everything; the app only shows the result.
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase";

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

async function call<T>(fn: "account-public" | "account-admin", body: Record<string, unknown>): Promise<T> {
  let token = SUPABASE_ANON_KEY;
  if (fn === "account-admin") {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token ?? SUPABASE_ANON_KEY;
  }
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("offline", "Could not reach the server. Check the internet and try again.");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.error ?? "server_error", json.message ?? "Something went wrong. Please try again.");
  return json as T;
}

type SessionPayload = { access_token: string; refresh_token: string };

async function keep(session: SessionPayload | null | undefined) {
  if (!session) throw new ApiError("server_error", "Something went wrong. Please try signing in.");
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) throw new ApiError("server_error", "Something went wrong. Please try signing in.");
}

export const api = {
  peekInvite: (code: string) => call<{ first_name: string; role: string }>("account-public", { action: "peek_invite", code }),

  async claimInvite(code: string, username: string, password: string, email: string) {
    const r = await call<{ role: string; session: SessionPayload }>("account-public", {
      action: "claim_invite", code, username, password, email,
    });
    await keep(r.session);
    return r;
  },

  async signIn(username: string, password: string) {
    const r = await call<{ role: string; session: SessionPayload }>("account-public", { action: "sign_in", username, password });
    await keep(r.session);
    return r;
  },

  forgot: (username: string) => call<{ message: string }>("account-public", { action: "forgot", username }),
  reset: (token: string, password: string) =>
    call<{ ok: true; username: string }>("account-public", { action: "reset", token, password }),

  createInvite: (role: "student" | "parent", first_name: string, student_id?: string) =>
    call<{ id: string; code: string; link: string; expires_at: string }>("account-admin", {
      action: "create_invite", role, first_name, student_id,
    }),
  listInvites: () =>
    call<{ invites: { id: string; role: string; first_name: string; student_id: string | null; expires_at: string }[] }>(
      "account-admin", { action: "list_invites" }),
  cancelInvite: (id: string) => call<{ ok: true }>("account-admin", { action: "cancel_invite", id }),
  sendReset: (user_id: string) => call<{ sent_to: string }>("account-admin", { action: "send_reset", user_id }),
  signOutEverywhere: (user_id: string) => call<{ ok: true }>("account-admin", { action: "sign_out_everywhere", user_id }),
};
