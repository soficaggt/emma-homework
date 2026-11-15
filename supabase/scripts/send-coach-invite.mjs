// Emails a one-time coach invite. Coach accounts can only be made this way (never from the app).
// The invite code goes only into the email: this script never prints it.
// Usage: node supabase/scripts/send-coach-invite.mjs <first name> <email>
// Needs SUPABASE_PROJECT_REF, and SUPABASE_ACCESS_TOKEN where the environment does not inject it.
const [firstName, email] = process.argv.slice(2);
const REF = process.env.SUPABASE_PROJECT_REF;
if (!REF || !firstName || !email) throw new Error("usage: SUPABASE_PROJECT_REF=... node send-coach-invite.mjs <first name> <email>");
const auth = process.env.SUPABASE_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` } : {};
const keys = await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, { headers: auth })).json();
const service = keys.find((k) => k.name === "service_role").api_key;
const r = await fetch(`https://${REF}.supabase.co/functions/v1/account-public`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${service}`, apikey: service },
  body: JSON.stringify({ action: "send_coach_invite", first_name: firstName, email }),
});
const body = await r.json();
console.log(r.ok ? `Invite emailed. It works until ${body.expires_at}.` : `Not sent: ${body.message ?? r.status}`);
