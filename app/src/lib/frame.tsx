// What the checklist pages share: the board's state, a place for the page to set the small label
// above the title, and a way to show a short message.
import { createContext, useContext } from "react";
import type { useBoard } from "@/data/useBoard";

export type FrameCtx = {
  board: ReturnType<typeof useBoard>;
  setKicker: (s: string) => void;
  say: (key: string) => void;   // show one of the theme's short messages at the bottom
};
export const FrameContext = createContext<FrameCtx | null>(null);
export function useFrame(): FrameCtx {
  const v = useContext(FrameContext);
  if (!v) throw new Error("useFrame outside the student pages");
  return v;
}
