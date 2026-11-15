// Which data source the app uses. Demo mode exists only in development builds and only when asked for
// with EXPO_PUBLIC_DEMO=1. In a production build `__DEV__` is false, so the demo code is removed and
// there is no way to switch it on.
import { supabaseRepo, type Repo } from "./repo";

export type Student = { id: string; firstName: string };

export const DEMO: boolean = __DEV__ && process.env.EXPO_PUBLIC_DEMO === "1";

let repo: Repo = supabaseRepo;
let demoStudent: Student | null = null;
if (__DEV__ && process.env.EXPO_PUBLIC_DEMO === "1") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const demo = require("./demo");
  repo = demo.makeDemoRepo();
  demoStudent = demo.DEMO_STUDENT;
}

export const getRepo = (): Repo => repo;
export const getDemoStudent = (): Student | null => demoStudent;
