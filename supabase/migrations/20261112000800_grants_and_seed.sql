-- Step 2, part 8: who may call what, shared economy numbers, the item list, and live updates.
-- Row Level Security (above) decides which rows. These grants decide which tables at all.
-- Anything not granted here is closed to the app and can only be reached by server code.

-- 1. Start from nothing for the signed-out role and the signed-in role.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- 2. Reading. Row Level Security still limits every read to the right people.
grant select on all tables in schema public to authenticated;
revoke select on public.adhd_profiles from authenticated;       -- reached only through read_adhd_profile()
revoke select on public.automation_keys from authenticated;
grant select (id, student_id, name, created_at, revoked_at, last_used_at) on public.automation_keys to authenticated;  -- never the hash

-- 3. Writing. Deliberately short. Everything else (coins, done-state, boxes, purchases, proof checks,
--    verified status, notifications, orders) has no write access at all from the app.
grant insert, update, delete on
  public.template_items, public.student_settings, public.bring_home, public.projects, public.reward_catalog,
  public.themes, public.reward_packs, public.catalog_items, public.student_setup, public.helper_characters,
  public.profile_settings, public.tutor_settings, public.helper_settings, public.prize_settings,
  public.connections, public.notification_prefs, public.push_tokens
  to authenticated;
grant insert, update on public.tasks to authenticated;           -- narrowed by policies and by guard_columns
grant update on public.profiles, public.collection, public.notifications, public.plan_changes,
                public.profile_suggestions, public.tutor_flags, public.integrity_flags to authenticated;
grant insert on public.walkthroughs to authenticated;

-- 4. Functions the app may call.
grant execute on function
  public.app_role(), public.is_coach_of(uuid), public.is_parent_of(uuid), public.can_read_student(uuid),
  public.visible_profile(uuid), public.read_adhd_profile(uuid),
  public.save_adhd_profile(uuid, jsonb, boolean, boolean, text),
  public.create_automation_key(uuid, text), public.revoke_automation_key(uuid), public.authorize_photo_open(text)
  to authenticated;
-- Functions only server code may call (with the server key).
grant execute on function
  public.automation_student_for_key(text),
  public.automation_upsert_task(text, text, text, text, date, date, text, integer, boolean, jsonb)
  to service_role;

-- 5. The one shared economy (PRD 3a). Only a developer changes these, by migration.
insert into public.economy_config (key, value, note) values
  ('box_odds', '{"normal":{"legendary":0.02,"rare":0.10,"uncommon":0.28,"common":0.60},"sparkle":{"legendary":0.15,"rare":0.35,"uncommon":0.30,"common":0.20}}', 'Boxes never give a duplicate'),
  ('mini_box', '{"rarities":["common"],"coins":0}', 'A mini box gives common items only and no coins'),
  ('box_rules', '{"full_box_min_share_checked":0.5,"dinner_excluded":true,"sparkle_previous_full_days":2,"moved_counts_as_not_today":true}', 'Plans (type fixed) are never checkable'),
  ('task_coins', '{"min":0,"max":6,"default":3,"dinner":1}', 'Per finished task'),
  ('egg_coins', '1', 'Start then finish the same task'),
  ('shop', '{"prices":{"common":25,"uncommon":45},"per_category_per_week":6,"categories":["shelf","slime"],"refresh_day":"monday","owned_items_hidden":true}', 'Only common and uncommon are for sale'),
  ('review', '{"window_hours":24,"auto_confirm_hours":24}', 'Reversal window and auto-confirm are fixed for everyone'),
  ('real_pick', '{"rule":"every day that had homework in a Monday to Sunday week earned a box"}', null);

-- 6. The item list from the old Code.gs (53 items). The audit trigger is paused so the seed does not fill the log.
alter table public.reward_catalog disable trigger t4_audit;
insert into public.reward_catalog (id, name, kind, color, rarity, texture, price_usd, cat) values
  ('five-below-glitter-dumpling', 'Glitter Dumpling Mystery Squishy (Five Below)', 'dumpling', 'white', 'common', 'gel', 5, 'shelf'),
  ('slow-rise-butter', 'Slow-Rising Butter Squishy', 'butter', 'yellow', 'common', 'foam', 9, 'shelf'),
  ('slow-rise-bread', 'Slow-Rising Bread Squishy', 'bread', 'brown', 'common', 'foam', 9, 'shelf'),
  ('glitter-gummee-ball', 'Glittery Gummee Ball', 'ball', 'pink', 'common', 'gel', 8, 'shelf'),
  ('bubble-sugar-cube', 'Bubble Sugar Squisher Cube', 'cube', 'sky', 'common', 'dough', 6, 'shelf'),
  ('axolotl-glitter', 'Axolotl Glitter Squishy', 'axolotl', 'pink', 'common', 'gel', 7, 'shelf'),
  ('kawaii-mochi-cat', 'Kawaii Mochi Cat Squishy', 'cat', 'lavender', 'common', 'foam', 3, 'shelf'),
  ('spiky-smoosh-ball', 'Spiky Smoosh Ball', 'spiky', 'lime', 'common', 'gel', 5, 'shelf'),
  ('smushmart-pickle', 'RMS SmushMart Giant 15" Pickle', 'pickle', 'green', 'uncommon', 'squeeze', 20, 'shelf'),
  ('smushmart-banana', 'RMS SmushMart Giant Banana', 'banana', 'yellow', 'uncommon', 'squeeze', 20, 'shelf'),
  ('crazy-fun-dumpling', 'RMS Crazy Fun Mystery Dumpling', 'dumpling', 'white', 'uncommon', 'gel', 10, 'shelf'),
  ('taba-butter-stick', 'Taba Slow-Rising Butter Stick', 'butter', 'yellow', 'uncommon', 'silicone', 10, 'shelf'),
  ('taba-mochi-cat', 'Taba Handmade Mochi Cat', 'cat', 'pink', 'uncommon', 'silicone', 15, 'shelf'),
  ('taba-cat-paw', 'Taba Cat Paw', 'paw', 'pink', 'uncommon', 'silicone', 12, 'shelf'),
  ('crazy-aarons-shortcake', 'Crazy Aaron''s Strawberry Shortcake SCENTsory Putty', 'tin', 'pink', 'uncommon', 'putty', 15, 'shelf'),
  ('needoh-nice-cube', 'NeeDoh Nice Cube', 'cube', 'sky', 'rare', 'dough', 6, 'shelf'),
  ('needoh-gumdrop', 'NeeDoh Gumdrop', 'gumdrop', 'pink', 'rare', 'gel', 8, 'shelf'),
  ('needoh-dohnut', 'NeeDoh Dohnut', 'donut', 'pink', 'rare', 'gel', 8, 'shelf'),
  ('needoh-groovy-glob', 'NeeDoh Groovy Glob', 'glob', 'teal', 'rare', 'gel', 6, 'shelf'),
  ('needoh-gummy-bear', 'NeeDoh Gummy Bear', 'gummybear', 'orange', 'rare', 'gel', 8, 'shelf'),
  ('needoh-nice-cream', 'NeeDoh Nice Cream', 'icecream', 'pink', 'rare', 'dough', 8, 'shelf'),
  ('taba-crystal', 'Taba Crystal Clear Squishy', 'ball', 'sky', 'rare', 'silicone', 25, 'shelf'),
  ('taba-flocked-bunny', 'Taba Flocked Bunny', 'bunny', 'lavender', 'rare', 'silicone', 20, 'shelf'),
  ('needoh-ice-baby', 'NeeDoh Nice Ice Baby', 'minicube', 'sky', 'legendary', 'dough', 10, 'shelf'),
  ('needoh-niceberg-glow', 'NeeDoh Glitter & Glow Niceberg', 'cube', 'lavender', 'legendary', 'gel', 15, 'shelf'),
  ('needoh-jelly-squish', 'NeeDoh Jelly Squish', 'jelly', 'pink', 'legendary', 'gel', 10, 'shelf'),
  ('crazy-fun-diamond', 'RMS Crazy Fun Mystery Dumpling, Diamond Edition', 'dumpling', 'sky', 'legendary', 'gel', 29, 'shelf'),
  ('dope-cloud', 'Dope Slimes Cloud Slime', 'jar', 'lavender', 'common', 'slime', 10, 'slime'),
  ('slime-charms', 'Slime Charms Pack', 'kit', 'pink', 'common', 'slime', 8, 'slime'),
  ('slime-kit', 'Slime Supply Kit (glue + activator)', 'kit', 'sky', 'common', 'slime', 12, 'slime'),
  ('peachybbies-butter', 'Peachybbies Butter Slime', 'jar', 'yellow', 'uncommon', 'slime', 14, 'slime'),
  ('snoop-cloud', 'Snoop Slimes Cloud Slime', 'jar', 'sky', 'uncommon', 'slime', 15, 'slime'),
  ('momo-glossy', 'Momo Slimes Glossy Slime', 'jar', 'pink', 'uncommon', 'slime', 15, 'slime'),
  ('rodem-crunchy', 'Rodem Crunchy Slime', 'jar', 'teal', 'rare', 'slime', 16, 'slime'),
  ('glitter-bingsu', 'Glitter Slimes Bingsu Slime', 'jar', 'purple', 'rare', 'slime', 16, 'slime'),
  ('elmers-clear-glue', 'Elmer''s Clear School Glue (5 oz)', 'bottle', 'sky', 'common', 'slime', 3, 'slime'),
  ('elmers-magical-liquid', 'Elmer''s Magical Liquid Slime Activator', 'bottle', 'teal', 'common', 'slime', 5, 'slime'),
  ('elmers-glow-glue', 'Elmer''s Glow-in-the-Dark Glue', 'bottle', 'lime', 'uncommon', 'slime', 6, 'slime'),
  ('elmers-color-glue', 'Elmer''s Pastel Color Glue', 'bottle', 'purple', 'common', 'slime', 4, 'slime'),
  ('pigment-drops', 'Pastel Slime Pigment Drops', 'bottle', 'pink', 'common', 'slime', 6, 'slime'),
  ('pastel-foam-beads', 'Pastel Foam Beads (floam)', 'beads', 'pink', 'common', 'slime', 5, 'slime'),
  ('fishbowl-beads', 'Clear Fishbowl Beads', 'beads', 'sky', 'common', 'slime', 5, 'slime'),
  ('slushee-beads', 'Slushee Beads', 'beads', 'lavender', 'common', 'slime', 6, 'slime'),
  ('bingsu-beads', 'Bingsu Beads', 'beads', 'yellow', 'common', 'slime', 6, 'slime'),
  ('crunchy-foam-cubes', 'Crunchy Foam Cubes', 'beads', 'teal', 'uncommon', 'slime', 6, 'slime'),
  ('instant-snow', 'Instant Snow Powder (for cloud slime)', 'beads', 'white', 'common', 'slime', 6, 'slime'),
  ('daiso-soft-clay', 'Daiso Soft Clay (for butter slime)', 'clay', 'yellow', 'uncommon', 'slime', 4, 'slime'),
  ('iridescent-glitter', 'Iridescent Chunky Glitter', 'shaker', 'lavender', 'common', 'slime', 4, 'slime'),
  ('holo-star-sprinkles', 'Holographic Star Sprinkles', 'shaker', 'yellow', 'common', 'slime', 4, 'slime'),
  ('rainbow-sugar-sprinkles', 'Rainbow Sugar Sprinkles', 'shaker', 'pink', 'common', 'slime', 3, 'slime'),
  ('fruit-slice-charms', 'Mini Fruit Slice Charms (polymer clay)', 'kit', 'orange', 'common', 'slime', 5, 'slime'),
  ('kawaii-food-charms', 'Kawaii Food Resin Charms (20 pack)', 'kit', 'pink', 'common', 'slime', 7, 'slime'),
  ('slime-storage-jars', 'Empty Slime Storage Jars (6 pack)', 'jar', 'white', 'common', 'slime', 6, 'slime');
alter table public.reward_catalog enable trigger t4_audit;

-- 7. Live updates (Sofia watching a Start or a finished task). Row Level Security still applies to what each person receives.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.tasks, public.work_sessions, public.notifications, public.plan_changes;
  end if;
end $$;
