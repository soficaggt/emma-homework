// The Yoda screen (coach only, after the authenticator step): students and their parents, invites,
// reset emails and signing someone out of every device. The server checks every action again.
import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Redirect } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { api, ApiError } from "@/lib/api";
import { homeFor, useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Body, Button, Card, Field, LinkText, Loading, Note, Screen, Title, useColors } from "@/lib/ui";

type Person = { id: string; first_name: string; username: string | null };
type StudentRow = Person & { parents: Person[] };
type Invite = { id: string; role: string; first_name: string; student_id: string | null; expires_at: string };
type NewInvite = { first_name: string; code: string; link: string; expires_at: string };
type Draft = { role: "student" | "parent"; student?: StudentRow };

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

export default function Yoda() {
  const auth = useAuth();
  const c = useColors();
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [firstName, setFirstName] = useState("");
  const [made, setMade] = useState<NewInvite | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const allowed = homeFor(auth) === "/yoda";

  const load = useCallback(async () => {
    const me = auth.profile?.id;
    const { data: links } = await supabase.from("student_links").select("student_id, adult_id, relation");
    const mine = (links ?? []).filter((l) => l.relation === "coach" && l.adult_id === me).map((l) => l.student_id);
    const ids = [...new Set((links ?? []).flatMap((l) => [l.student_id, l.adult_id]))];
    const { data: people } = ids.length
      ? await supabase.from("profiles").select("id, first_name, username").in("id", ids)
      : { data: [] as Person[] };
    const byId = new Map((people ?? []).map((p) => [p.id, p as Person]));
    setStudents(mine.filter((id) => byId.has(id)).map((id) => ({
      ...byId.get(id)!,
      parents: (links ?? []).filter((l) => l.relation === "parent" && l.student_id === id)
        .map((l) => byId.get(l.adult_id)).filter((p): p is Person => !!p),
    })).sort((a, b) => a.first_name.localeCompare(b.first_name)));
    try {
      setInvites((await api.listInvites()).invites);
    } catch { /* shown as an empty list */ }
  }, [auth.profile?.id]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  if (auth.loading) return <Loading />;
  if (!allowed) return <Redirect href={homeFor(auth)} />;

  async function act(fn: () => Promise<string | void>) {
    setBusy(true);
    setMsg("");
    try {
      const m = await fn();
      if (m) setMsg(m);
      await load();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  const createInvite = () => act(async () => {
    if (!draft) return;
    const r = await api.createInvite(draft.role, firstName.trim(), draft.student?.id);
    setMade({ first_name: firstName.trim(), code: r.code, link: r.link, expires_at: r.expires_at });
    setDraft(null);
    setFirstName("");
  });

  const nameOf = (id: string | null) => students?.find((s) => s.id === id)?.first_name ?? "";

  function PersonActions({ p }: { p: Person }) {
    if (confirm === p.id) {
      return (
        <View style={{ gap: 8 }}>
          <Body>{`Sign ${p.first_name} out on every device? They will need their password to come back.`}</Body>
          <Button title="Yes, sign out everywhere" busy={busy}
            onPress={() => act(async () => { await api.signOutEverywhere(p.id); return `${p.first_name} is signed out everywhere.`; })} />
          <LinkText title="No, keep them signed in" onPress={() => setConfirm(null)} />
        </View>
      );
    }
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        <LinkText title="Email a reset link" onPress={() => act(async () => {
          const r = await api.sendReset(p.id);
          return `A reset link went to ${r.sent_to}. It works once, for 1 hour.`;
        })} />
        <LinkText title="Sign out everywhere" onPress={() => setConfirm(p.id)} />
      </View>
    );
  }

  return (
    <Screen>
      <Title>{`Yoda: ${auth.profile!.first_name}`}</Title>
      <Note>{msg}</Note>

      {made ? (
        <Card>
          <Body>{`Invite for ${made.first_name}. Give them this code or link. It works once, until ${day(made.expires_at)}.`}</Body>
          <Text selectable style={{ fontSize: 28, fontWeight: "700", letterSpacing: 2, color: c.text, textAlign: "center" }}>{made.code}</Text>
          <Text selectable style={{ fontSize: 15, color: c.soft }}>{made.link}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            <LinkText title="Copy the code" onPress={() => Clipboard.setStringAsync(made.code)} />
            <LinkText title="Copy the link" onPress={() => Clipboard.setStringAsync(made.link)} />
          </View>
          <Body soft>The code is shown only now. If it gets lost, cancel it below and make a new one.</Body>
          <Button title="Done" quiet onPress={() => setMade(null)} />
        </Card>
      ) : null}

      {draft ? (
        <Card>
          <Body>{draft.role === "student" ? "New student" : `New parent for ${draft.student?.first_name}`}</Body>
          <Field label="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words"
            returnKeyType="done" onSubmitEditing={createInvite} />
          <Button title="Make the invite" onPress={createInvite} busy={busy} disabled={!firstName.trim()} />
          <LinkText title="Cancel" onPress={() => setDraft(null)} />
        </Card>
      ) : (
        <Button title="Invite a student" onPress={() => { setMade(null); setDraft({ role: "student" }); }} />
      )}

      <Title>Students</Title>
      {students === null ? <Loading /> : students.length === 0 ? <Body soft>No students yet.</Body> : students.map((s) => (
        <Card key={s.id}>
          <Body>{`${s.first_name} (${s.username})`}</Body>
          <PersonActions p={s} />
          {s.parents.map((p) => (
            <View key={p.id} style={{ gap: 4, paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: c.line }}>
              <Body>{`Parent: ${p.first_name} (${p.username})`}</Body>
              <PersonActions p={p} />
            </View>
          ))}
          <LinkText title="Invite a parent" onPress={() => { setMade(null); setDraft({ role: "parent", student: s }); }} />
        </Card>
      ))}

      <Title>Waiting invites</Title>
      {invites.length === 0 ? <Body soft>None.</Body> : invites.map((i) => (
        <Card key={i.id}>
          <Body>{`${i.first_name}, ${i.role === "parent" ? `parent of ${nameOf(i.student_id)}` : "student"}. Works until ${day(i.expires_at)}.`}</Body>
          <LinkText title="Cancel this invite" onPress={() => act(async () => { await api.cancelInvite(i.id); return "Invite cancelled."; })} />
        </Card>
      ))}

      <Button title="Sign out" quiet onPress={auth.signOut} />
    </Screen>
  );
}
