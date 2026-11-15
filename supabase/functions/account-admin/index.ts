// Account actions for signed-in adults (the Yoda screen): make, list and cancel invites,
// email someone a reset link, and sign someone out of every device.
// A coach must have done the authenticator step (two-factor) for any of these.
import {
  adminClient, appUrl, getCaller, json, maskEmail, newInviteCode, newResetToken, normalizeCode,
  Refusal, sendResetEmail, serve, sha256Hex,
} from "../_shared/util.ts";

const NOT_ALLOWED = new Refusal("not_allowed", "You cannot do that for this account.", 403);

serve(async (req, body) => {
  const admin = adminClient();
  const caller = await getCaller(req, admin);
  if (!caller) throw new Refusal("signed_out", "Please sign in again.", 401);
  if (caller.role === "coach" && caller.aal !== "aal2") {
    throw new Refusal("needs_code", "Enter the code from your authenticator app first.", 403);
  }
  const action = String(body.action ?? "");
  const isCoach = caller.role === "coach";

  // Only the coach makes invites for now (decided Nov 12).
  if (action === "create_invite") {
    if (!isCoach) throw NOT_ALLOWED;
    const role = String(body.role ?? "");
    const firstName = String(body.first_name ?? "").trim();
    if (!["student", "parent"].includes(role)) throw new Refusal("bad_role", "Choose student or parent.");
    if (firstName.length < 1 || firstName.length > 40) throw new Refusal("bad_name", "Type a first name (up to 40 letters).");
    const code = newInviteCode();
    const { data, error } = await admin.rpc("account_invite_create", {
      p_actor: caller.id, p_role: role, p_first_name: firstName,
      p_student: role === "parent" ? body.student_id : null,
      p_code_hash: await sha256Hex(normalizeCode(code)), p_days: 7,
    });
    if (error || !data || data.length === 0) throw NOT_ALLOWED;
    // The code is shown once, to the coach, to hand over. Only its hash is stored.
    return json({ id: data[0].id, code, link: `${appUrl()}/invite?code=${code}`, expires_at: data[0].expires_at });
  }

  if (action === "list_invites") {
    if (!isCoach) throw NOT_ALLOWED;
    const { data, error } = await admin.rpc("account_invite_list", { p_actor: caller.id });
    if (error) throw error;
    return json({ invites: data ?? [] });
  }

  if (action === "cancel_invite") {
    if (!isCoach) throw NOT_ALLOWED;
    const { data } = await admin.rpc("account_invite_cancel", { p_actor: caller.id, p_invite: body.id });
    if (data !== true) throw new Refusal("not_found", "That invite is already used or cancelled.");
    return json({ ok: true });
  }

  // Email a one-time reset link to the account's saved email. Nobody sees the link on screen.
  if (action === "send_reset") {
    const target = String(body.user_id ?? "");
    const token = newResetToken();
    const { data, error } = await admin.rpc("account_reset_create", {
      p_actor: caller.id, p_user: target, p_token_hash: await sha256Hex(token),
    });
    if (error) {
      if (error.message.includes("rate_limited")) {
        throw new Refusal("rate_limited", "A few reset emails were already sent this hour. Try again later.", 429);
      }
      if (error.message.includes("no_email")) throw new Refusal("no_email", "This account has no email saved for resets.");
      throw NOT_ALLOWED;
    }
    await sendResetEmail(data[0].recovery_email, data[0].first_name, token);
    return json({ ok: true, sent_to: maskEmail(data[0].recovery_email) });
  }

  if (action === "sign_out_everywhere") {
    const target = String(body.user_id ?? "");
    const { error } = await admin.rpc("account_end_sessions", { p_actor: caller.id, p_user: target });
    if (error) throw NOT_ALLOWED;
    return json({ ok: true });
  }

  throw new Refusal("unknown_action", "Unknown action.");
});
