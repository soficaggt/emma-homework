// A simple landing page for students and parents until the checklist arrives (step 4).
import { Redirect } from "expo-router";
import { homeFor, useAuth } from "@/lib/auth";
import { Body, Button, Card, Loading, Screen, Title } from "@/lib/ui";

export default function Home() {
  const auth = useAuth();
  if (auth.loading) return <Loading />;
  if (homeFor(auth) !== "/home") return <Redirect href={homeFor(auth)} />;
  const p = auth.profile!;
  return (
    <Screen>
      <Title>{`Hi ${p.first_name}!`}</Title>
      <Card>
        <Body>{`You are signed in as ${p.username}. This device will remember you until you sign out.`}</Body>
        <Body soft>{p.role === "student" ? "Your checklist is coming soon." : "Your child's progress is coming soon."}</Body>
      </Card>
      <Button title="Sign out" quiet onPress={auth.signOut} />
    </Screen>
  );
}
