import { Redirect } from "expo-router";
import { homeFor, useAuth } from "@/lib/auth";
import { Loading } from "@/lib/ui";

// Sends each person to the right place: sign in, the authenticator step, the Yoda screen, or home.
export default function Index() {
  const auth = useAuth();
  if (auth.loading) return <Loading />;
  return <Redirect href={homeFor(auth)} />;
}
