import { useState } from "react";
import { router } from "expo-router";
import { api, ApiError } from "@/lib/api";
import { Body, Button, Card, Field, LinkText, Note, Screen, Title } from "@/lib/ui";

export default function Forgot() {
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit() {
    setBusy(true);
    setMsg("");
    try {
      const r = await api.forgot(username);
      setMsg(r.message);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Forgot your password?</Title>
      <Body soft>No problem. We will email a link to the address saved for your account.</Body>
      <Card>
        <Field label="Username" value={username} onChangeText={setUsername} autoComplete="username"
          textContentType="username" returnKeyType="send" onSubmitEditing={submit} />
        <Note>{msg}</Note>
        <Button title="Send the link" onPress={submit} busy={busy} disabled={!username.trim()} />
      </Card>
      <LinkText title="Back to sign in" onPress={() => router.replace("/sign-in")} />
    </Screen>
  );
}
