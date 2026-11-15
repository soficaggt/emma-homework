// A page that exists but is built in a later step. It only says so, kindly.
import { LedgeCard, Txt } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

export default function Page() {
  const t = useTheme();
  return (
    <LedgeCard>
      <Txt kind="display" w={700} size={22}>{t.theme.pageNames.collection}</Txt>
      <Txt color={t.p.muted} style={{ marginTop: 6 }}>{t.say("coming_soon")}</Txt>
    </LedgeCard>
  );
}
