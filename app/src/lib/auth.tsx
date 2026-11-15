// Who is signed in, their role, and whether a coach has done the authenticator step.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type Profile = { id: string; role: "coach" | "student" | "parent"; first_name: string; username: string | null };

type AuthState = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  aal: "aal1" | "aal2" | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [aal, setAal] = useState<"aal1" | "aal2" | null>(null);

  const load = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) {
      setProfile(null);
      setAal(null);
      setLoading(false);
      return;
    }
    const [{ data: prof }, { data: level }] = await Promise.all([
      supabase.from("profiles").select("id, role, first_name, username").eq("id", s.user.id).maybeSingle(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    setProfile((prof as Profile) ?? null);
    setAal((level?.currentLevel as "aal1" | "aal2") ?? "aal1");
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Token refreshes do not change who is signed in; everything else is reloaded.
      if (event !== "TOKEN_REFRESHED") setTimeout(() => load(s), 0);
      else setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await load(data.session);
  }, [load]);

  // Signs out on this device only. "Sign out everywhere" is a separate button on the Yoda screen.
  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: "local" });
  }, []);

  return <Ctx.Provider value={{ loading, session, profile, aal, refresh, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}

// Where a signed-in person belongs.
export function homeFor(a: Pick<AuthState, "session" | "profile" | "aal">): "/sign-in" | "/two-factor" | "/yoda" | "/home" {
  if (!a.session || !a.profile) return "/sign-in";
  if (a.profile.role === "coach") return a.aal === "aal2" ? "/yoda" : "/two-factor";
  return "/home";
}
