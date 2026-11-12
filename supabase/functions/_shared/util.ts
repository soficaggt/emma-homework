// Shared helpers for the login server functions. Runs on Supabase Edge Functions (Deno).
// Secrets come only from the environment (Supabase server secrets), never from code.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// A refusal the app can show. `code` is for the app; `message` is kind, plain words.
export class Refusal extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

export function env(name: string, fallback?: string): string {
  const v = Deno.env.get(name) ?? fallback;
  if (v === undefined) throw new Error(`missing server setting ${name}`);
  return v;
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

// Server key client: not limited by row security. Used only inside these functions.
export function adminClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), opts);
}

// Public key client: used to sign someone in with their password.
export function publicClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), opts);
}

export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Letters and digits that are hard to mix up (no 0/O, 1/I/L).
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let s = "";
  for (const b of bytes) s += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

export function normalizeCode(code: unknown): string {
  return String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function newResetToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function clientIp(req: Request): string | null {
  const xf = req.headers.get("x-forwarded-for");
  return xf ? xf.split(",")[0].trim() : null;
}

export function normalizeUsername(u: unknown): string {
  return String(u ?? "").trim().toLowerCase();
}

export const USERNAME_RE = /^[a-z0-9_]{3,30}$/;
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function checkPassword(password: unknown, username?: string): string {
  const p = String(password ?? "");
  if (p.length < 8) throw new Refusal("weak_password", "Your password needs at least 8 characters.");
  if (p.length > 72) throw new Refusal("weak_password", "That password is too long. Try a shorter one.");
  if (username && p.toLowerCase() === username) {
    throw new Refusal("weak_password", "Your password cannot be the same as your username.");
  }
  return p;
}

export function maskEmail(e: string): string {
  const [name, domain] = e.split("@");
  return `${name.slice(0, 1)}***@${domain}`;
}

export type Caller = { id: string; role: string; aal: string; firstName: string };

// Who is calling, from their login token. Null if not signed in.
export async function getCaller(req: Request, admin: SupabaseClient): Promise<Caller | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  // The token was just checked by Supabase Auth above, so reading its claims is safe.
  let aal = "aal1";
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    aal = payload.aal ?? "aal1";
  } catch { /* keep aal1 */ }
  const { data: prof } = await admin.from("profiles").select("role, first_name").eq("id", data.user.id).maybeSingle();
  if (!prof) return null;
  return { id: data.user.id, role: prof.role, aal, firstName: prof.first_name };
}

export function emailReady(): boolean {
  return !!Deno.env.get("RESEND_API_KEY") && !!Deno.env.get("EMAIL_FROM");
}

// Sends one email through Resend. Needs the RESEND_API_KEY and EMAIL_FROM server secrets.
export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  if (!emailReady()) throw new Refusal("email_not_set_up", "Email is not set up yet, so reset links cannot be sent.", 503);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env("EMAIL_FROM"), to: [to], subject, text }),
  });
  if (!r.ok) {
    console.error("email send failed", r.status);
    throw new Refusal("email_failed", "The email could not be sent. Please try again later.", 502);
  }
}

export function appUrl(): string {
  return env("APP_URL", "http://localhost:8081").replace(/\/+$/, "");
}

export function appName(): string {
  return env("APP_NAME", "Emma's Homework");
}

// The reset email. The link opens the app's reset page.
export async function sendResetEmail(to: string, firstName: string, token: string) {
  const link = `${appUrl()}/reset?token=${encodeURIComponent(token)}`;
  await sendEmail(to, `${appName()}: choose a new password`, [
    `Hi ${firstName},`,
    "",
    `Someone asked to reset the password for ${firstName}'s ${appName()} account.`,
    "Open this link within 1 hour to choose a new password:",
    link,
    "",
    "The link works only once. If nobody asked for this, you can ignore this email and the password stays the same.",
  ].join("\n"));
}

// Wraps a handler: CORS, JSON body, and turning refusals into kind messages.
export function serve(handler: (req: Request, body: Record<string, unknown>) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    try {
      const body = await req.json().catch(() => ({}));
      return await handler(req, body ?? {});
    } catch (e) {
      if (e instanceof Refusal) return json({ error: e.code, message: e.message }, e.status);
      console.error("unexpected error", e instanceof Error ? e.message : String(e));
      return json({ error: "server_error", message: "Something went wrong. Please try again." }, 500);
    }
  });
}
