// End-to-end login test against the real project, through the deployed server functions.
// Makes a fake coach, student and parent, tries to cheat every step, then deletes everything it made.
// Needs: SUPABASE_PROJECT_REF, and access to api.supabase.com (SUPABASE_ACCESS_TOKEN where the
// environment does not inject it). Keys are fetched at run time and never printed.
// Run: node supabase/tests/logins.e2e.mjs      Look for: EMMA_LOGIN_E2E result=PASS
import crypto from "node:crypto";

const REF = process.env.SUPABASE_PROJECT_REF;
if (!REF) throw new Error("set SUPABASE_PROJECT_REF");
const MGMT = `https://api.supabase.com/v1/projects/${REF}`;
const MAUTH = process.env.SUPABASE_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` } : {};
const URL_ = `https://${REF}.supabase.co`;

async function mgmt(path, init = {}) {
  const r = await fetch(MGMT + path, { ...init, headers: { "Content-Type": "application/json", ...MAUTH, ...(init.headers ?? {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`management ${path} ${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}
const sql = (query) => mgmt("/database/query", { method: "POST", body: JSON.stringify({ query }) });
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

const keys = await mgmt("/api-keys?reveal=true");
const ANON = keys.find((k) => k.name === "anon").api_key;
const SERVICE = keys.find((k) => k.name === "service_role").api_key;

async function call(fn, body, token) {
  const r = await fetch(`${URL_}/functions/v1/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${token ?? ANON}` },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function rest(path, token, init = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    ...init, headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}
async function gotrue(path, token, body) {
  const r = await fetch(`${URL_}/auth/v1/${path}`, {
    method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${token ?? ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

function totp(secretB32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secretB32.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const h = crypto.createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0");
}
const aalOf = (tok) => JSON.parse(Buffer.from(tok.split(".")[1], "base64url").toString()).aal;
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

const results = [];
const check = (name, ok, detail = "") => results.push({ ok: !!ok, name, detail });
const run = crypto.randomBytes(3).toString("hex");
const U = { coach: `e2e_coach_${run}`, kid: `e2e_kid_${run}`, parent: `e2e_parent_${run}` };
const PW = { coach: `coach-pass-${run}-x`, kid: `kid-pass-${run}-x`, parent: `parent-pass-${run}-x` };
const made = [];

const startedAt = (await sql("select now()::text t"))[0].t;

try {
  // 1. A coach invite exists only through the developer path.
  const coachCode = "TEST" + crypto.randomBytes(4).toString("hex").toUpperCase();
  await sql(`select * from public.account_invite_create(null, 'coach', 'E2ecoach', null, ${lit(sha(coachCode))}, 1)`);

  const peek = await call("account-public", { action: "peek_invite", code: coachCode.toLowerCase() });
  check("an invite code greets the person by first name (and ignores letter case)", peek.body.first_name === "E2ecoach", JSON.stringify(peek.body));
  const bad = await call("account-public", { action: "peek_invite", code: "NOPE-NOPE-NOPE" });
  check("a made-up invite code is refused kindly", bad.status === 400 && bad.body.error === "invite_not_valid");

  const signup = await gotrue("signup", null, { email: `x${run}@example.com`, password: "whatever-123" });
  check("public sign-up is off", signup.status >= 400, `status=${signup.status}`);

  const weak = await call("account-public", { action: "claim_invite", code: coachCode, username: U.coach, password: "short", email: "e2e-coach@example.com" });
  check("a password under 8 characters is refused", weak.body.error === "weak_password");
  const badUser = await call("account-public", { action: "claim_invite", code: coachCode, username: "No Spaces!", password: PW.coach, email: "e2e-coach@example.com" });
  check("a username with spaces is refused", badUser.body.error === "bad_username");
  const badEmail = await call("account-public", { action: "claim_invite", code: coachCode, username: U.coach, password: PW.coach, email: "nope" });
  check("a bad recovery email is refused", badEmail.body.error === "bad_email");

  const coachClaim = await call("account-public", { action: "claim_invite", code: coachCode, username: U.coach, password: PW.coach, email: "e2e-coach@example.com" });
  check("the coach uses her invite, chooses her password and is signed in", coachClaim.status === 200 && coachClaim.body.session?.access_token, JSON.stringify(coachClaim.body).slice(0, 200));
  const coachId = coachClaim.body.session?.user?.id; if (coachId) made.push(coachId);
  let coachTok = coachClaim.body.session.access_token;
  check("her first session is password-only (aal1)", aalOf(coachTok) === "aal1");

  const reuse = await call("account-public", { action: "claim_invite", code: coachCode, username: U.coach + "b", password: PW.coach, email: "e2e-coach@example.com" });
  check("an invite cannot be used twice", reuse.body.error === "invite_not_valid");

  const early = await call("account-admin", { action: "create_invite", role: "student", first_name: "E2eearly" }, coachTok);
  check("a coach without the authenticator step cannot make invites", early.status === 403 && early.body.error === "needs_code");

  // 2. Two-factor.
  const enroll = await gotrue("factors", coachTok, { factor_type: "totp", friendly_name: `e2e-${run}` });
  check("the coach can add an authenticator", enroll.status === 200 && enroll.body.totp?.secret, JSON.stringify(enroll.body).slice(0, 200));
  const fid = enroll.body.id;
  const wrongCode = await gotrue(`factors/${fid}/verify`, coachTok, {
    challenge_id: (await gotrue(`factors/${fid}/challenge`, coachTok)).body.id, code: "000000",
  });
  check("a wrong authenticator code is refused", wrongCode.status >= 400);
  // Supabase requires the challenge and the code to come from the same network address. This test
  // machine's outgoing address can change between requests (a phone's does not), so retry a few times.
  let ver;
  for (let i = 0; i < 10; i++) {
    const ch = await gotrue(`factors/${fid}/challenge`, coachTok);
    ver = await gotrue(`factors/${fid}/verify`, coachTok, { challenge_id: ch.body.id, code: totp(enroll.body.totp.secret) });
    if (ver.body.error_code !== "mfa_ip_address_mismatch") break;
  }
  check("the right code upgrades the session (aal2)", ver.status === 200 && aalOf(ver.body.access_token) === "aal2", JSON.stringify(ver.body).slice(0, 200));
  coachTok = ver.body.access_token;

  // 3. Invites made on the Yoda screen.
  const inv = await call("account-admin", { action: "create_invite", role: "student", first_name: "E2ekid" }, coachTok);
  check("the coach makes a student invite with a link", inv.status === 200 && /\/invite\?code=/.test(inv.body.link ?? ""), JSON.stringify(inv.body).slice(0, 200));
  const stored = await sql(`select count(*)::int n from public.invites where code_hash = ${lit(sha(inv.body.code.replace(/-/g, "")))}`);
  const plain = await sql(`select count(*)::int n from public.invites where code_hash = ${lit(inv.body.code)} or code_hash = ${lit(inv.body.code.replace(/-/g, ""))}`);
  check("only the code's hash is stored", stored[0].n === 1 && plain[0].n === 0);
  const list = await call("account-admin", { action: "list_invites" }, coachTok);
  check("the coach sees the waiting invite", list.body.invites?.some((i) => i.id === inv.body.id));

  const kidClaim = await call("account-public", { action: "claim_invite", code: inv.body.code, username: U.kid, password: PW.kid, email: "e2e-grownup@example.com" });
  check("the student chooses her username and password and is signed in", kidClaim.status === 200 && kidClaim.body.role === "student" && kidClaim.body.session?.access_token, JSON.stringify(kidClaim.body).slice(0, 200));
  const kidId = kidClaim.body.session?.user?.id; if (kidId) made.push(kidId);
  const kidTok = kidClaim.body.session.access_token;
  const kidRefresh = kidClaim.body.session.refresh_token;

  const taken = await call("account-admin", { action: "create_invite", role: "student", first_name: "E2eother" }, coachTok);
  const takenClaim = await call("account-public", { action: "claim_invite", code: taken.body.code, username: U.kid.toUpperCase(), password: PW.kid, email: "a@example.com" });
  check("a taken username is refused (any letter case)", takenClaim.body.error === "username_taken");
  const cancel = await call("account-admin", { action: "cancel_invite", id: taken.body.id }, coachTok);
  const cancelledUse = await call("account-public", { action: "claim_invite", code: taken.body.code, username: `e2e_late_${run}`, password: PW.kid, email: "a@example.com" });
  check("a cancelled invite cannot be used", cancel.status === 200 && cancelledUse.body.error === "invite_not_valid");

  const pInv = await call("account-admin", { action: "create_invite", role: "parent", first_name: "E2eparent", student_id: kidId }, coachTok);
  const parentClaim = await call("account-public", { action: "claim_invite", code: pInv.body.code, username: U.parent, password: PW.parent, email: "e2e-parent@example.com" });
  check("a parent invite links the parent to that child", parentClaim.body.role === "parent", JSON.stringify(parentClaim.body).slice(0, 200));
  const parentId = parentClaim.body.session?.user?.id; if (parentId) made.push(parentId);
  const parentTok = parentClaim.body.session.access_token;

  const pInvOther = await call("account-admin", { action: "create_invite", role: "parent", first_name: "E2esneaky", student_id: "00000000-0000-4000-8000-000000000000" }, coachTok);
  check("a coach cannot invite a parent for a child she does not coach", pInvOther.status === 403);
  const kidInvites = await call("account-admin", { action: "create_invite", role: "student", first_name: "E2efriend" }, kidTok);
  const parentInvites = await call("account-admin", { action: "create_invite", role: "student", first_name: "E2esibling" }, parentTok);
  check("a student cannot make invites", kidInvites.status === 403);
  check("a parent cannot make invites (coach only for now)", parentInvites.status === 403);
  const noLogin = await call("account-admin", { action: "list_invites" });
  check("the Yoda functions refuse someone signed out", noLogin.status === 401);

  // 4. What each one can see.
  const kidLinks = await rest("student_links?select=relation", kidTok);
  check("the student sees her coach and parent links", kidLinks.body?.length === 2, JSON.stringify(kidLinks.body));
  const parentKids = await rest(`student_settings?select=student_id`, parentTok);
  check("the parent sees only their child's settings", parentKids.body?.length === 1 && parentKids.body[0].student_id === kidId);
  const coachAal1 = (await call("account-public", { action: "sign_in", username: U.coach, password: PW.coach })).body.session.access_token;
  const coachSeesAal1 = await rest(`profiles?select=id&id=eq.${kidId}`, coachAal1);
  const coachSeesAal2 = await rest(`profiles?select=id&id=eq.${kidId}`, coachTok);
  check("the coach sees her student only after the authenticator step", coachSeesAal1.body?.length === 0 && coachSeesAal2.body?.length === 1);
  const direct = await rest("invites", kidTok, { method: "POST", body: JSON.stringify({ code_hash: "x", role: "coach", first_name: "Me", expires_at: "2099-01-01" }) });
  check("a student cannot write an invite directly", direct.status >= 400);
  const rpc = await rest("rpc/account_invite_create", kidTok, { method: "POST", body: JSON.stringify({ p_actor: null, p_role: "coach", p_first_name: "Me", p_student: null, p_code_hash: "x", p_days: 7 }) });
  check("a student cannot call the invite function directly", rpc.status >= 400);
  const rpcEmail = await rest("rpc/account_login_email", ANON, { method: "POST", body: JSON.stringify({ p_username: U.kid }) });
  check("nobody can look up the hidden sign-in address", rpcEmail.status >= 400);

  // 5. Sign in and the lockout.
  const good = await call("account-public", { action: "sign_in", username: ` ${U.kid.toUpperCase()} `, password: PW.kid });
  check("the student signs in with her username (spaces and case ignored)", good.status === 200 && good.body.role === "student");
  const ghost = await call("account-public", { action: "sign_in", username: `nobody_${run}`, password: "whatever-123" });
  const wrong = await call("account-public", { action: "sign_in", username: U.parent, password: "wrong-password" });
  check("a wrong password and an unknown username give the same message", ghost.status === 401 && wrong.status === 401 && ghost.body.message === wrong.body.message);
  for (let i = 0; i < 4; i++) await call("account-public", { action: "sign_in", username: U.parent, password: "wrong-password" });
  const locked = await call("account-public", { action: "sign_in", username: U.parent, password: PW.parent });
  check("after 5 wrong passwords even the right one waits 15 minutes", locked.status === 429 && locked.body.error === "locked");
  const otherOk = await call("account-public", { action: "sign_in", username: U.kid, password: PW.kid });
  check("the lock does not affect other usernames", otherOk.status === 200);

  // 5b. Coach invites can only be sent with the server key.
  const ci = { action: "send_coach_invite", first_name: "E2ehacker", email: "e2e-hacker@example.com" };
  const ciAnon = await call("account-public", ci);
  const ciKid = await call("account-public", ci, kidTok);
  const ciCoach = await call("account-public", ci, coachTok);
  check("nobody in the app can send a coach invite (signed out, student or coach)", ciAnon.status === 403 && ciKid.status === 403 && ciCoach.status === 403);
  const ciServer = await call("account-public", { ...ci, first_name: "E2eserver" }, SERVICE);
  check("the developer script (server key) is accepted", ciServer.status === 200 || ciServer.body.error === "email_not_set_up", JSON.stringify(ciServer.body));

  // 6. Reset links. Email sending is checked separately once the email key exists.
  const emailOn = (await mgmt("/secrets")).some((s) => s.name === "RESEND_API_KEY");
  const forgot = await call("account-public", { action: "forgot", username: U.kid });
  const yodaReset = await call("account-admin", { action: "send_reset", user_id: kidId }, coachTok);
  if (emailOn) {
    check("forgot password answers the same way and emails the link", forgot.status === 200);
    check("the coach sends a reset and sees only a masked email", yodaReset.status === 200 && yodaReset.body.sent_to === "e***@example.com", JSON.stringify(yodaReset.body));
  } else {
    check("without the email key, a reset says email is not set up (no link shown anywhere)",
      forgot.status === 503 && yodaReset.status === 503 && !JSON.stringify(yodaReset.body).includes("token"), JSON.stringify(yodaReset.body));
  }
  const kidResetsParent = await call("account-admin", { action: "send_reset", user_id: parentId }, kidTok);
  check("a student cannot reset her parent's password", kidResetsParent.status === 403);

  // The email carries a link with a one-time token; here the test plays the email by making one directly.
  const token = crypto.randomBytes(32).toString("base64url");
  await sql(`insert into public.reset_tokens (user_id, token_hash, expires_at) values (${lit(kidId)}, ${lit(sha(token))}, now() + interval '1 hour')`);
  const newPw = `new-kid-pass-${run}`;
  const reset = await call("account-public", { action: "reset", token, password: newPw });
  check("the reset link lets her choose a new password", reset.status === 200 && reset.body.username === U.kid, JSON.stringify(reset.body));
  const again = await call("account-public", { action: "reset", token, password: "another-one-123" });
  check("a reset link works only once", again.body.error === "reset_not_valid");
  const oldPw = await call("account-public", { action: "sign_in", username: U.kid, password: PW.kid });
  const newPwIn = await call("account-public", { action: "sign_in", username: U.kid, password: newPw });
  check("the old password stops working and the new one works", oldPw.status === 401 && newPwIn.status === 200);
  const oldRefresh = await gotrue("token?grant_type=refresh_token", null, { refresh_token: kidRefresh });
  check("a reset signs her out of her other devices", oldRefresh.status >= 400, `status=${oldRefresh.status}`);

  // 7. Sign out everywhere.
  const parentRefresh = parentClaim.body.session.refresh_token;
  const kidOut = await call("account-admin", { action: "sign_out_everywhere", user_id: parentId }, kidTok);
  check("a student cannot sign her parent out", kidOut.status >= 401);
  const out = await call("account-admin", { action: "sign_out_everywhere", user_id: parentId }, coachTok);
  const after = await gotrue("token?grant_type=refresh_token", null, { refresh_token: parentRefresh });
  check("the coach signs a parent out of every device", out.status === 200 && after.status >= 400, `status=${out.status}/${after.status}`);

  const audit = await sql(`select string_agg(distinct action, ',' order by action) a from public.audit_log where actor_id in (${made.map(lit).join(",")})`);
  check("invites, resets and sign-outs are in the audit log", ["invite_create", "invite_used", "invite_cancel", "sign_out_everywhere"].every((a) => (audit[0].a ?? "").includes(a)), audit[0].a);
} catch (e) {
  check("the test ran to the end", false, e.message);
} finally {
  // Clean up everything this run made.
  const ids = made.map(lit).join(",") || "null";
  const users = Object.values(U).map(lit).join(",");
  await sql(`
    delete from public.invites where created_by in (${ids}) or used_by in (${ids}) or (first_name like 'E2e%' and (created_by is null or created_by in (${ids})));
    delete from public.auth_attempts where key in (${users}) or key like 'nobody\\_%' or key like 'e2e\\_%';
    delete from public.audit_log where actor_id in (${ids}) or student_id in (${ids})
       or (action = 'invite_create' and actor_id is null and details->>'first_name' = 'E2ecoach');
    -- the wrong invite codes this run tried on purpose (they have no username, only a time)
    delete from public.auth_attempts where kind = 'invite' and key = '-' and at >= ${lit(startedAt)};
  `).catch((e) => check("cleanup step 1", false, e.message));
  for (const id of [...made].reverse()) {   // children first: their theme points at the coach
    const r = await fetch(`${URL_}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
    if (!r.ok) check("cleanup: delete fake user", false, `status ${r.status}`);
  }
  await sql(`delete from public.audit_log where actor_id in (${ids}) or student_id in (${ids}) or row_id in (${made.map((m) => lit(m)).join(",") || "null"});`).catch(() => {});
  const left = await sql(`select (select count(*) from public.profiles where id in (${ids}))::int p,
                                 (select count(*) from auth.users where id in (${ids}))::int u,
                                 (select count(*) from public.invites where first_name like 'E2e%')::int i`);
  check("cleanup left no fake users, profiles or invites behind", left[0].p === 0 && left[0].u === 0 && left[0].i === 0, JSON.stringify(left[0]));
}

const fail = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "pass" : "FAIL"}  ${r.name}${r.ok ? "" : "   <-- " + r.detail}`);
console.log(`EMMA_LOGIN_E2E result=${fail.length ? "FAIL" : "PASS"} passed=${results.length - fail.length} failed=${fail.length}`);
process.exit(fail.length ? 1 : 0);
