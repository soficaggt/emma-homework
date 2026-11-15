// The calm baseline used when a student has no theme yet, or only wants her rewards themed
// (theming_depth "rewards_only"). Its colors carry no meaning.
import type { Theme } from "./types";

export const NEUTRAL_WORDING: Record<string, string> = {
  title: "{name}'s homework",
  range_today: "Today", range_3: "3 days", range_week: "Week", range_label: "{from} to {to}",
  today_tag: "Today", earlier: "Still to do from earlier", pile: "Not today",
  pile_open: "Open", pile_close: "Close", pile_hint: "Drop things here",
  pile_empty: "Nothing here. Tap the arrow on a task to put it here.",
  add: "+ Add", add_placeholder: "What is it?", add_save: "Add", nothing_planned: "Nothing planned. Tap + Add.",
  next_up: "Next up", next_none: "Nothing planned for today.", next_all_done: "Everything for today is done.",
  first_step: "First step", first_step_ask: "What is a tiny first step? About two minutes.",
  first_step_placeholder: "Like: open the book to page 40", first_step_save: "Save",
  first_step_ideas: "Open the book|Get a pencil|Read the first line|Set a 2 minute timer",
  check_soon: "Checking off is coming soon.",
  delete_title: "Delete \"{title}\"?", delete_msg: "It will be gone from the plan.", delete_yes: "Delete", cancel: "Cancel", close: "Close",
  do_today: "Do today", from_day: "from {day}", working_on: "Working on this",
  due_tonight: "Due tonight", due_today: "Due today", was_due: "Was due {day}", due_on: "Due {day}",
  show_times: "Show how long things take", hide_times: "Hide how long things take",
  details_title: "Details", details_color: "Color", details_auto: "Let it pick for me", details_auto_now: "It is picking for you ({meaning})",
  details_due: "Due", details_none: "None", details_note: "Note", details_minutes: "How long (minutes)", details_type: "Type",
  details_first_step: "Tiny first step", details_move: "Move to", details_up: "Move up", details_down: "Move down",
  set_by: "{who} set this one, so only they can change it.", save_failed: "That did not save. Please try again.",
  forbidden: "That one cannot be changed here.", loading: "Loading", load_failed: "Could not load the plan. Check the internet and try again.",
  retry: "Try again", sign_out: "Sign out",
  waiting: "waiting", coins_label: "{n} {currency}", coins_open_shop: "{currency}, open the shop",
  coming_soon: "This page is coming soon.",
};

export const NEUTRAL: Theme = {
  name: "Neutral",
  depth: "whole_app",
  palette: {
    light: { bg: "#f7f6fb", bg2: "#efeafd", card: "#ffffff", fg: "#24212e", muted: "#5d5870", line: "#d9d5e6",
      accent: "#5b4bb7", accentInk: "#ffffff", good: "#1f7a5c", alert: "#a3334f", alertInk: "#ffffff", ledge: "#d9d5e6",
      tintL: 92, tintS: 40, strongL: 40, strongS: 50 },
    dark: { bg: "#17151d", bg2: "#221f2b", card: "#221f2b", fg: "#f1eff7", muted: "#b9b4c9", line: "#3a3548",
      accent: "#a99cf0", accentInk: "#17151d", good: "#4fdcaa", alert: "#ff8aa3", alertInk: "#17151d", ledge: "#0f0d14",
      tintL: 24, tintS: 30, strongL: 70, strongS: 55 },
  },
  fonts: { display: "system", body: "system" },
  shapes: { card: 20, task: 14, pill: 99, check: 8, ledge: 4 },
  wording: NEUTRAL_WORDING,
  pageNames: { days: "Days", calendar: "Calendar", collection: "Collection", shop: "Shop" },
  currency: { name: "coins", look: "gold" },
  colorSystem: {
    mode: "none", steps: [],
    rules: { byGap: [], plan: null, flex: null, noDue: null, noDueTest: null },
    shades: [], typeSteps: {}, subjects: [],
  },
};
