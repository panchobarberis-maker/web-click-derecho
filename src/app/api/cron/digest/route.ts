import { NextResponse } from "next/server";
import { sql, type Workflow } from "@/lib/db";
import { digestEmail, sendMail } from "@/lib/mailer";
import { baseUrl } from "@/lib/base-url";
import { hace, sourceLabel } from "@/lib/format";
import { hayTriage, triarConsulta, type Triage } from "@/lib/triage";
import type { Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";
// Leer consultas con el modelo lleva su tiempo. Ojo: el tope real depende del
// plan de Vercel, y si el plan lo recorta la funcion se corta a la mitad.
export const maxDuration = 300;

/**
 * El resumen diario de a quien llamar, y el triage que lo alimenta.
 *
 * Corre cada hora y hace dos cosas distintas:
 *
 *  1. **Puntua lo que falte puntuar**, de todos los estudios. Se hace seguido
 *     y de a poco, no al momento de mandar el resumen: si se dejara todo para
 *     las 8 de la manana, el correo tendria que esperar a que el modelo lea
 *     veinte consultas y la funcion se corta antes de terminar.
 *  2. **Manda el resumen** a los estudios a los que en su hora local les toca
 *     ahora. Para ese momento ya esta todo puntuado y es solo una consulta y
 *     un mail.
 *
 * La hora se resuelve en JavaScript y no en SQL a proposito: una zona horaria
 * mal escrita en un estudio hace fallar `now() at time zone`, y con eso se
 * caeria el resumen de todos los demas. Aca revienta la de ese estudio sola.
 */

const DIAS_ATRAS = 30;        // no perseguir consultas de hace meses
const POR_TANDA = 20;         // cuantas consultas se puntuan por corrida
const EN_PARALELO = 4;        // llamadas simultaneas al modelo
const EN_EL_MAIL = 5;         // cuantas van en el correo
const TOPE = 60;              // cuantas se traen para ordenar
const CONTACTO = new Set(["first_name", "last_name", "email", "phone", "consent"]);

type FilaEstudio = {
  id: string; name: string; slug: string; accent: string; lang: Lang;
  notify_email: string | null; triage_contexto: string | null;
  timezone: string; digest_hora: number; digest_dias: string;
};

type FilaConsulta = {
  id: string; full_name: string | null; email: string | null; phone: string | null;
  consent: boolean; data: Record<string, string>; max_step: number;
  submitted_at: string | null; source: string | null; created_at: string;
  triage: Triage | null; area: string | null; caso: string | null;
  steps: Workflow["steps"] | null;
};

/** Hora y dia ISO en el huso del estudio. null si la zona no existe. */
function ahoraEn(timezone: string): { hora: number; dia: number } | null {
  try {
    const partes = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone, hour: "2-digit", weekday: "short", hour12: false,
    }).formatToParts(new Date());
    const hora = Number(partes.find((p) => p.type === "hour")?.value);
    const dias = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const dia = dias.indexOf(partes.find((p) => p.type === "weekday")?.value ?? "") + 1;
    return Number.isFinite(hora) && dia > 0 ? { hora, dia } : null;
  } catch {
    console.error(`digest: zona horaria invalida "${timezone}"`);
    return null;
  }
}

/** Las respuestas del formulario con la etiqueta que vio la persona. */
function respuestas(c: FilaConsulta): [string, string][] {
  const labels = new Map<string, string>();
  for (const st of c.steps?.steps ?? []) for (const f of st.fields) labels.set(f.key, f.label);
  return Object.entries(c.data ?? {})
    .filter(([k, v]) => !k.startsWith("_") && !CONTACTO.has(k) && v)
    .map(([k, v]) => [labels.get(k) ?? k, String(v)] as [string, string]);
}

const pendientes = (firmId: string) => sql<FilaConsulta[]>`
  select s.id, s.full_name, s.email, s.phone, s.consent, s.data, s.max_step,
         s.submitted_at, s.source, s.created_at, s.triage,
         f.name as area, w.name as caso, w.steps
  from sessions s
  left join funnels f on f.id = s.funnel_id
  left join workflows w on w.id = s.workflow_id
  where s.firm_id = ${firmId}
    and s.read_at is null
    and s.created_at > now() - ${`${DIAS_ATRAS} days`}::interval
    -- sin forma de contactarlo no hay a quien llamar
    and (nullif(s.email, '') is not null or nullif(s.phone, '') is not null)
  order by s.created_at desc
  limit ${TOPE}`;

/**
 * Cuantos pendientes hay en total.
 *
 * Se cuenta aparte y no con el largo de las filas de arriba: esas vienen con
 * `limit`, y usar su largo mostraba "tenes 60 consultas sin abrir" con
 * cualquier cantidad mayor que 60. El numero que el estudio lee tiene que ser
 * el de verdad.
 */
const cuantasPendientes = (firmId: string) => sql<{ n: number }[]>`
  select count(*)::int as n
  from sessions s
  where s.firm_id = ${firmId}
    and s.read_at is null
    and s.created_at > now() - ${`${DIAS_ATRAS} days`}::interval
    and (nullif(s.email, '') is not null or nullif(s.phone, '') is not null)`;

/** Puntua de a EN_PARALELO y guarda cada veredicto en su sesion. */
async function puntuar(estudio: FilaEstudio, cola: FilaConsulta[], areas: string[]) {
  const ctx = {
    estudio: estudio.name, areas,
    criterio: estudio.triage_contexto, lang: estudio.lang,
  };

  for (let i = 0; i < cola.length; i += EN_PARALELO) {
    await Promise.all(cola.slice(i, i + EN_PARALELO).map(async (c) => {
      const v = await triarConsulta({
        id: c.id,
        area: c.area, caso: c.caso,
        respuestas: respuestas(c),
        tieneEmail: Boolean(c.email), tieneTelefono: Boolean(c.phone),
        consent: c.consent,
        completo: Boolean(c.submitted_at), pasos: c.max_step,
        origen: c.source ? sourceLabel(c.source) : null,
        hace: hace(new Date(c.created_at), estudio.lang),
      }, ctx);

      // triage_at se marca aunque no haya veredicto: sin eso, una consulta que
      // el modelo no puede leer se reintenta cada hora para siempre.
      await sql`update sessions
                set triage = ${v ? sql.json(v) : null}, triage_at = now()
                where id = ${c.id}`;
      c.triage = v;
    }));
  }
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const estudios = await sql<FilaEstudio[]>`
    select f.id, f.name, f.slug, f.accent, f.lang, f.notify_email, f.triage_contexto,
           f.timezone, f.digest_hora, f.digest_dias
    from firms f
    where nullif(f.notify_email, '') is not null`;

  const base = baseUrl();
  let puntuadas = 0, enviados = 0;

  for (const e of estudios) {
    const [{ nombres: areas }] = await sql<{ nombres: string[] }[]>`
      select coalesce(array_agg(name order by sort_order), '{}') as nombres
      from funnels where firm_id = ${e.id} and active`;

    const abiertas = await pendientes(e.id);

    // 1. Puntuar lo que falte, pase o no el resumen en esta corrida.
    if (hayTriage()) {
      const sinLeer = abiertas.filter((c) => c.triage === null).slice(0, POR_TANDA);
      if (sinLeer.length) {
        await puntuar(e, sinLeer, areas);
        puntuadas += sinLeer.length;
      }
    }

    // 2. ¿Le toca el resumen a este estudio, ahora, en su hora?
    const local = ahoraEn(e.timezone);
    if (!local) continue;
    if (local.hora !== e.digest_hora) continue;
    if (!e.digest_dias.split(",").map((d) => d.trim()).includes(String(local.dia))) continue;
    if (!abiertas.length) continue;

    // Que una reejecucion del cron no mande el mismo resumen dos veces.
    const [marcada] = await sql<{ id: string }[]>`
      update firms set digest_at = now()
      where id = ${e.id} and (digest_at is null or digest_at < now() - interval '20 hours')
      returning id`;
    if (!marcada) continue;

    const [{ n: total }] = await cuantasPendientes(e.id);

    const casos = [...abiertas]
      // Las que no se pudieron puntuar van al final, no desaparecen.
      .sort((a, b) => (b.triage?.puntaje ?? -1) - (a.triage?.puntaje ?? -1))
      .slice(0, EN_EL_MAIL)
      .map((c) => ({
        nombre: c.full_name || c.email || c.phone || "—",
        contacto: [c.email, c.phone].filter(Boolean).join(" · "),
        area: [c.area, c.caso].filter(Boolean).join(" · ") || "—",
        url: `${base}/responses/${c.id}`,
        triage: c.triage,
      }));

    const mail = digestEmail({
      firm: e.name, accent: e.accent, total,
      urlPanel: `${base}/responses`, casos, lang: e.lang,
    });

    if (await sendMail({ to: e.notify_email!, ...mail })) enviados++;
    else await sql`update firms set digest_at = null where id = ${e.id}`;  // que reintente
  }

  return NextResponse.json({ estudios: estudios.length, puntuadas, enviados });
}
