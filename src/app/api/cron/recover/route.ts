import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { recoveryEmail, sendMail } from "@/lib/mailer";
import { baseUrl } from "@/lib/base-url";
import type { Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

// Espera antes de escribir: si mandas el mail a los 2 minutos, la persona
// probablemente siga en la pagina y queda raro.
const ESPERA_MIN = 45;

/**
 * Manda el recordatorio a los que dejaron el mail y no terminaron.
 * Se corre desde Vercel Cron (o cualquier scheduler) cada 15 minutos.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const base = baseUrl();

  const pendientes = await sql<
    { id: string; email: string; full_name: string | null; firm: string; slug: string; accent: string; notify_email: string | null; funnel: string; lang: Lang }[]
  >`
    select s.id, s.email, s.full_name,
           fi.name as firm, fi.slug, fi.accent, fi.notify_email, fi.lang,
           coalesce(f.name, 'tu consulta') as funnel
    from sessions s
    join firms fi on fi.id = s.firm_id
    left join funnels f on f.id = s.funnel_id
    where s.submitted_at is null
      and s.recovery_sent_at is null
      and s.email is not null and s.email <> ''
      and s.updated_at < now() - ${`${ESPERA_MIN} minutes`}::interval
      -- no perseguir formularios de hace un mes
      and s.updated_at > now() - interval '7 days'
    limit 200`;

  let enviados = 0;
  for (const p of pendientes) {
    const mail = recoveryEmail({
      name: p.full_name,
      firm: p.firm,
      accent: p.accent,
      area: p.funnel,
      url: `${base}/f/${p.slug}?retomar=${p.id}`,
      lang: p.lang,
    });

    const ok = await sendMail({ to: p.email, ...mail, replyTo: p.notify_email ?? undefined });
    if (ok) {
      await sql`update sessions set recovery_sent_at = now() where id = ${p.id}`;
      enviados++;
    }
  }

  return NextResponse.json({ candidatos: pendientes.length, enviados });
}
