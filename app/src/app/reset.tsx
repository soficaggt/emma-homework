// Opened from the reset email. The link works once, for 1 hour.
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { api, ApiError } from "@/lib/api";
import { Body, Button, Card, Field, LinkText, Note, Screen, Title } from "@/lib/ui";

export default function Reset() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState("");

  async function submit() {
    if (password.length < 8) {
      setMsg("Your password needs at least 8 characters.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const r = await api.reset(String(token ?? ""), password);
      setDone(r.username);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Screen>
        <Title>All set</Title>
        <Body>{`Your new password is saved. Sign in as ${done}.`}</Body>
        <Button title="Sign in" onPress={() => router.replace("/sign-in")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Choose a new password</Title>
      {!token ? <Note>This page needs the link from the reset email.</Note> : null}
      <Card>
        <Field label="New password" hint="At least 8 characters. Only you know it." value={password}
          onChangeText={setPassword} secret autoComplete="new-password" textContentType="newPassword"
          returnKeyType="done" onSubmitEditing={submit} />
        <Note>{msg}</Note>
        <Button title="Save" onPress={submit} busy={busy} disabled={!token || !password} />
      </Card>
      <LinkText title="Back to sign in" onPress={() => router.replace("/sign-in")} />
    </Screen>
  );
}
