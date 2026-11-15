// Using an invite, one question per screen: code, username, password, reset email.
// She chooses her own username and password here. No grown-up ever sees or sets them.
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Body, Button, Card, Field, LinkText, Note, Screen, Title } from "@/lib/ui";

type Step = "code" | "username" | "password" | "email";

export default function Invite() {
  const auth = useAuth();
  const params = useLocalSearchParams<{ code?: string }>();
  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState(String(params.code ?? ""));
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const stepNo = { code: 1, username: 2, password: 3, email: 4 }[step];

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMsg("");
    try {
      await fn();
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      setMsg(err?.message ?? "Something went wrong. Please try again.");
      if (err?.code === "username_taken" || err?.code === "bad_username") setStep("username");
      if (err?.code === "weak_password") setStep("password");
      if (err?.code === "invite_not_valid") setStep("code");
    } finally {
      setBusy(false);
    }
  }

  const checkCode = () => run(async () => {
    const r = await api.peekInvite(code);
    setName(r.first_name);
    setStep("username");
  });

  const nextUsername = () => {
    const u = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(u)) {
      setMsg("Usernames use 3 to 30 letters, numbers or _ (no spaces).");
      return;
    }
    setMsg("");
    setUsername(u);
    setStep("password");
  };

  const nextPassword = () => {
    if (password.length < 8) {
      setMsg("Your password needs at least 8 characters.");
      return;
    }
    setMsg("");
    setStep("email");
  };

  const finish = () => run(async () => {
    await api.claimInvite(code, username, password, email);
    await auth.refresh();
    router.replace("/");
  });

  return (
    <Screen>
      <Title>{name ? `Hi ${name}!` : "Use your invite"}</Title>
      <Body soft>{`Step ${stepNo} of 4`}</Body>
      <Card>
        {step === "code" && (
          <>
            <Field label="Invite code" hint="A grown-up gave you this code." value={code} onChangeText={setCode}
              autoCapitalize="characters" returnKeyType="next" onSubmitEditing={checkCode} />
            <Note>{msg}</Note>
            <Button title="Next" onPress={checkCode} busy={busy} disabled={!code.trim()} />
          </>
        )}
        {step === "username" && (
          <>
            <Field label="Choose a username" hint="Letters, numbers or _. You will type this to sign in."
              value={username} onChangeText={setUsername} autoComplete="username" textContentType="username"
              returnKeyType="next" onSubmitEditing={nextUsername} />
            <Note>{msg}</Note>
            <Button title="Next" onPress={nextUsername} disabled={!username.trim()} />
          </>
        )}
        {step === "password" && (
          <>
            <Field label="Choose a password" hint="At least 8 characters. Only you know it. Save it wherever you like."
              value={password} onChangeText={setPassword} secret autoComplete="new-password"
              textContentType="newPassword" returnKeyType="next" onSubmitEditing={nextPassword} />
            <Note>{msg}</Note>
            <Button title="Next" onPress={nextPassword} disabled={!password} />
            <LinkText title="Back" onPress={() => setStep("username")} />
          </>
        )}
        {step === "email" && (
          <>
            <Field label="Email for password resets" hint="Yours or a grown-up's. If you forget your password, a link goes here."
              value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email"
              textContentType="emailAddress" returnKeyType="done" onSubmitEditing={finish} />
            <Note>{msg}</Note>
            <Button title="Finish" onPress={finish} busy={busy} disabled={!email.trim()} />
            <LinkText title="Back" onPress={() => setStep("password")} />
          </>
        )}
      </Card>
      <LinkText title="I already have an account" onPress={() => router.replace("/sign-in")} />
    </Screen>
  );
}
