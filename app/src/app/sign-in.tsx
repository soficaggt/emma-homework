import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import { api, ApiError } from "@/lib/api";
import { homeFor, useAuth } from "@/lib/auth";
import { setRememberMe } from "@/lib/supabase";
import { Body, Button, Card, Field, LinkText, Loading, Note, Screen, Title, useColors } from "@/lib/ui";

export default function SignIn() {
  const auth = useAuth();
  const c = useColors();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  if (auth.loading) return <Loading />;
  if (auth.session && auth.profile) return <Redirect href={homeFor(auth)} />;

  async function submit() {
    setBusy(true);
    setMsg("");
    try {
      setRememberMe(remember);
      await api.signIn(username, password);
      await auth.refresh();
      router.replace("/");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Sign in</Title>
      <Card>
        <Field label="Username" value={username} onChangeText={setUsername}
          autoComplete="username" textContentType="username" returnKeyType="next" />
        <Field label="Password" value={password} onChangeText={setPassword} secret
          autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} />
        {Platform.OS === "web" ? (
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: remember }}
            onPress={() => setRemember(!remember)} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 }}>
            <View style={{ width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: c.accent,
              backgroundColor: remember ? c.accent : "transparent" }} />
            <Text style={{ fontSize: 18, color: c.text }}>Remember me on this browser</Text>
          </Pressable>
        ) : null}
        <Note>{msg}</Note>
        <Button title="Sign in" onPress={submit} busy={busy} disabled={!username || !password} />
      </Card>
      <LinkText title="Forgot your password?" onPress={() => router.push("/forgot")} />
      <LinkText title="I have an invite code" onPress={() => router.push("/invite")} />
      <Body soft>There is no sign-up here. A grown-up makes an invite for you.</Body>
    </Screen>
  );
}
