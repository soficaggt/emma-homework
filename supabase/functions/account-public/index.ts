// Login actions that work without being signed in: look at an invite, use an invite,
// sign in with a username, forgot password, and choose a new password from a reset link.
// Nobody can sign up without an invite (public sign-up is off in Supabase Auth).
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import {
  adminClient, appName, appUrl, checkPassword, clientIp, EMAIL_RE, emailReady, env, json, newInviteCode,
  newResetToken, normalizeCode, normalizeUsername, publicClient, Refusal, sendEmail, sendResetEmail, serve,
  sha256Hex, USERNAME_RE,
} from "../_shared/util.ts";

const NOT_VALID = new Refusal("invite_not_valid", "That invite code does not work. It may be used up or too old. Ask a grown-up for a new one.");
const LOCKED = new Refusal("locked", "Too many tries. Take a short break and try again in 15 minutes.", 429);
const WRONG = new Refusal("wrong_login", "That username and password do not match. Try again.", 401);

serve(async (req, body) => {
  const admin = adminClient();
  const ip = clientIp(req);
  const action = String(body.action ?? "");

  async function blocked(kind: string, key: string): Promise<boolean> {
    const { data, error } = await admin.rpc("auth_attempt_blocked", { p_kind: kind, p_key: key, p_ip: ip });
    if (error) throw error;
    return data === true;
  }
  async function record(kind: string, key: string, ok: boolean) {
    await admin.rpc("auth_attempt_record", { p_kind: kind, p_key: key, p_ip: ip, p_ok: ok });
  }

  async function signIn(username: string, password: string) {
    const { data: email } = await admin.rpc("account_login_email", { p_username: username });
    if (!email) return null;
    const { data, error } = await publicClient().auth.signInWithPassword({ email, password });
    if (error || !data.session) return null;
    return data.session;
  }

  async function profileOf(id: string) {
    const { data } = await admin.from("profiles").select("role, first_name").eq("id", id).single();
    return data;
  }

  // Look at an invite before using it, to greet the person.
  if (action === "peek_invite") {
    if (await blocked("invite", "-")) throw LOCKED;
    const { data } = await admin.rpc("account_invite_peek", { p_code_hash: await sha256Hex(normalizeCode(body.code)) });
    if (!data || data.length === 0) {
      await record("invite", "-", false);
      throw NOT_VALID;
    }
    return json({ first_name: data[0].first_name, role: data[0].role });
  }

  // Use an invite: she chooses her own username and password here. No adult sees either.
  if (action === "claim_invite") {
    if (await blocked("invite", "-")) throw LOCKED;
    const hash = await sha256Hex(normalizeCode(body.code));
    const username = normalizeUsername(body.username);
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!USERNAME_RE.test(username)) {
      throw new Refusal("bad_username", "Usernames use 3 to 30 letters, numbers or _ (no spaces).");
    }
    const password = checkPassword(body.password, username);
    if (!EMAIL_RE.test(email) || email.length > 254) {
      throw new Refusal("bad_email", "That email does not look right. Check it and try again.");
    }
    const { data: peek } = await admin.rpc("account_invite_peek", { p_code_hash: hash });
    if (!peek || peek.length === 0) {
      await record("invite", "-", false);
      throw NOT_VALID;
    }
    const { data: taken } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
    if (taken) throw new Refusal("username_taken", "That username is taken. Try another one.");

    // The sign-in address is random and hidden. No real email is needed for the login itself.
    const hidden = `u-${crypto.randomUUID()}@accounts.emma-homework.invalid`;
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: hidden, password, email_confirm: true,
    });
    if (cErr || !created.user) {
      console.error("create user failed", cErr?.message);
      throw new Refusal("weak_password", "That password did not work. Try a longer or different one.");
    }
    const uid = created.user.id;
    const { data: fin, error: fErr } = await admin.rpc("account_invite_finish", {
      p_code_hash: hash, p_user: uid, p_username: username, p_email: email,
    });
    if (fErr || !fin || fin.length === 0) {
      await admin.auth.admin.deleteUser(uid);
      if (fErr?.code === "23505") throw new Refusal("username_taken", "That username is taken. Try another one.");
      throw NOT_VALID;
    }
    const session = await signIn(username, password);
    await record("sign_in", username, true);
    return json({ role: fin[0].role, first_name: fin[0].first_name, session });
  }

  // Sign in with a username. Five wrong tries locks that username for 15 minutes.
  if (action === "sign_in") {
    const username = normalizeUsername(body.username);
    const password = String(body.password ?? "");
    if (!username || !password) throw WRONG;
    if (await blocked("sign_in", username)) throw LOCKED;
    const session = await signIn(username, password);
    await record("sign_in", username, !!session);
    if (!session) throw WRONG;
    const prof = await profileOf(session.user.id);
    return json({ role: prof?.role, first_name: prof?.first_name, session });
  }

  // Forgot password: a one-time link is emailed to the address saved for that username.
  // The answer is the same whether or not the username exists.
  if (action === "forgot") {
    const username = normalizeUsername(body.username);
    const same = json({ ok: true, message: "If that username exists, we sent a link to the email saved for it. It works for 1 hour." });
    if (!emailReady()) throw new Refusal("email_not_set_up", "Email is not set up yet. Ask a grown-up to help.", 503);
    if (!USERNAME_RE.test(username)) return same;
    if (await blocked("forgot", username)) return same;
    await record("forgot", username, false);   // counts toward the limit either way
    const { data: prof } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
    if (!prof) return same;
    const token = newResetToken();
    const { data, error } = await admin.rpc("account_reset_create", {
      p_actor: null, p_user: prof.id, p_token_hash: await sha256Hex(token),
    });
    if (error || !data || data.length === 0) return same;   // no email saved, or the hourly limit
    await sendResetEmail(data[0].recovery_email, data[0].first_name, token);
    return same;
  }

  // Choose a new password from a reset link. The link works once, for 1 hour.
  if (action === "reset") {
    const token = String(body.token ?? "");
    const password = checkPassword(body.password);
    if (await blocked("invite", "-")) throw LOCKED;
    const { data: uid } = await admin.rpc("account_reset_use", { p_token_hash: await sha256Hex(token) });
    if (!uid) {
      await record("invite", "-", false);
      throw new Refusal("reset_not_valid", "That link does not work any more. Ask for a new one.");
    }
    const { error } = await admin.auth.admin.updateUserById(uid, { password });
    if (error) throw new Refusal("weak_password", "That password did not work. Ask for a new link and try a different one.");
    await admin.rpc("account_end_sessions", { p_actor: null, p_user: uid });
    const { data: prof } = await admin.from("profiles").select("username").eq("id", uid).single();
    if (prof?.username) await record("sign_in", prof.username, true);   // clears a lockout
    return json({ ok: true, username: prof?.username });
  }

  // Developer only: email a coach invite. Needs the server key, which the app never has, so nobody
  // in the app can make a coach. The code goes only into the email; nobody else sees it.
  if (action === "send_coach_invite") {
    const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!(await isServerKey(bearer))) throw new Refusal("not_allowed", "Not allowed.", 403);
    const firstName = String(body.first_name ?? "").trim();
    const to = String(body.email ?? "").trim();
    if (!firstName || !EMAIL_RE.test(to)) throw new Refusal("bad_request", "first_name and email are needed.");
    if (!emailReady()) throw new Refusal("email_not_set_up", "Email is not set up yet.", 503);
    const code = newInviteCode();
    const { data, error } = await admin.rpc("account_invite_create", {
      p_actor: null, p_role: "coach", p_first_name: firstName, p_student: null,
      p_code_hash: await sha256Hex(normalizeCode(code)), p_days: 7,
    });
    if (error || !data?.length) throw new Refusal("server_error", "Could not make the invite.", 500);
    await sendEmail(to, `${appName()}: your coach account`, [
      `Hi ${firstName},`,
      "",
      `Here is your one-time invite to set up your coach account for ${appName()}.`,
      `Open this link: ${appUrl()}/invite?code=${code}`,
      `Or type this code on the invite page: ${code}`,
      "",
      "You will choose your own username and password, then add an authenticator app.",
      "The invite works once and stops working in 7 days.",
    ].join("\n"));
    return json({ ok: true, expires_at: data[0].expires_at });
  }

  throw new Refusal("unknown_action", "Unknown action.");
});

// True only for a key with server rights: Supabase Auth lets only those list accounts.
async function isServerKey(key: string): Promise<boolean> {
  if (!key) return false;
  const c = createClient(env("SUPABASE_URL"), key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.admin.listUsers({ page: 1, perPage: 1 });
  return !error;
}
