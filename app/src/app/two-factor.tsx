// The coach's second step: a 6-digit code from an authenticator app. The first time, she adds the app.
import { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { SvgXml } from "react-native-svg";
import { supabase } from "@/lib/supabase";
import { homeFor, useAuth } from "@/lib/auth";
import { Body, Button, Card, Field, LinkText, Loading, Note, Screen, Title, useColors } from "@/lib/ui";

type Setup = { factorId: string; qrSvg: string; secret: string };

export default function TwoFactor() {
  const auth = useAuth();
  const c = useColors();
  const [mode, setMode] = useState<"loading" | "enroll" | "verify">("loading");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const isCoachNeedingCode = auth.profile?.role === "coach" && auth.aal !== "aal2";

  useEffect(() => {
    if (!isCoachNeedingCode) return;
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp?.find((f) => f.status === "verified");
      if (verified) {
        setFactorId(verified.id);
        setMode("verify");
        return;
      }
      // Clear any half-finished setup, then start a new one.
      for (const f of data?.all ?? []) {
        if (f.factor_type === "totp" && f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: en, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${Date.now()}` });
      if (error || !en) {
        setMsg("Could not start the setup. Please try again.");
        return;
      }
      const raw = en.totp.qr_code;
      const svg = raw.startsWith("data:") ? decodeURIComponent(raw.slice(raw.indexOf(",") + 1)) : raw;
      setSetup({ factorId: en.id, qrSvg: svg, secret: en.totp.secret });
      setFactorId(en.id);
      setMode("enroll");
    })();
  }, [isCoachNeedingCode]);

  if (auth.loading) return <Loading />;
  if (!isCoachNeedingCode) return <Redirect href={homeFor(auth)} />;

  async function submit() {
    setBusy(true);
    setMsg("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setBusy(false);
    if (error) {
      setMsg("That code did not work. Codes change every 30 seconds, so try the newest one.");
      return;
    }
    await auth.refresh();
    router.replace("/");
  }

  return (
    <Screen>
      <Title>{mode === "enroll" ? "Add your authenticator" : "Enter your code"}</Title>
      {mode === "loading" ? <Note>{msg || "One moment..."}</Note> : null}
      {mode === "enroll" && setup ? (
        <Card>
          <Body>1. Open an authenticator app (for example Google Authenticator or 1Password) and add a new account.</Body>
          <Body>2. Scan this picture, or type the key below.</Body>
          <View style={{ alignSelf: "center", backgroundColor: "#ffffff", padding: 12, borderRadius: 12 }}>
            <SvgXml xml={setup.qrSvg} width={200} height={200} />
          </View>
          <Text selectable style={{ fontSize: 16, color: c.text, textAlign: "center", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>
            {setup.secret}
          </Text>
          <LinkText title="Copy the key" onPress={() => Clipboard.setStringAsync(setup.secret)} />
          <Body>3. Type the 6-digit code the app shows.</Body>
        </Card>
      ) : null}
      {mode !== "loading" ? (
        <Card>
          <Field label="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad"
            autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} returnKeyType="done" onSubmitEditing={submit} />
          <Note>{msg}</Note>
          <Button title="Continue" onPress={submit} busy={busy} disabled={code.trim().length !== 6} />
        </Card>
      ) : null}
      <LinkText title="Sign out" onPress={auth.signOut} />
    </Screen>
  );
}
