import Link from "next/link";
import { sql } from "@/lib/db";
import { activeFirm } from "@/lib/tenancy";
import { totals, series, abandoned, type Range } from "@/lib/analytics";
import { LineChart, Tile } from "@/components/Charts";
import { RangePicker } from "@/components/RangePicker";
import { fmtShort } from "@/lib/format";
import { baseUrl } from "@/lib/base-url";
import { Onboarding, type Paso } from "@/components/Onboarding";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const range = (((await searchParams).r as Range) ?? "30d") satisfies Range;

  // Sin try/catch: activeFirm redirige a /login o /sin-acceso lanzando, y
  // atraparlo se comería el redirect.
  const { firm } = await activeFirm();

  const [t, s, pendientes, [nuevas], [estado]] = await Promise.all([
    totals(firm.id, range),
    series(firm.id, range),
    abandoned(firm.id, 5),
    sql<{ n: number }[]>`select count(*) as n from sessions
      where firm_id = ${firm.id} and submitted_at is not null and read_at is null`,
    sql<{ areas: number; casos: number; widgets: number; equipo: number; visitas: number }[]>`
      select
        (select count(*)::int from funnels where firm_id = ${firm.id})                     as areas,
        (select count(*)::int from workflows w join funnels f on f.id = w.funnel_id
          where f.firm_id = ${firm.id})                                                    as casos,
        (select count(*)::int from popups where firm_id = ${firm.id} and active)
        + (select count(*)::int from clips where firm_id = ${firm.id} and active)          as widgets,
        (select count(*)::int from memberships where firm_id = ${firm.id})                 as equipo,
        (select count(*)::int from sessions where firm_id = ${firm.id}
          and data->>'_demo' is null)                                                      as visitas`,
  ]);

  const pasos: Paso[] = [
    {
      titulo: "Cargar las áreas de práctica",
      detalle: "Los temas que atiende el estudio: laboral, familia, sucesiones.",
      href: "/funnels", accion: "Cargar áreas", listo: estado.areas > 0,
    },
    {
      titulo: "Armar los formularios",
      detalle: "Un caso concreto por área, con sus preguntas propias.",
      href: "/funnels", accion: "Armar", listo: estado.casos > 0,
    },
    {
      titulo: "Instalarlo en el sitio del estudio",
      detalle: "Un pop-up o un clip, con una línea de código.",
      href: "/popups", accion: "Crear un pop-up", listo: estado.widgets > 0,
    },
    {
      titulo: "Dar acceso al estudio",
      detalle: "Invitar a quien va a atender las consultas.",
      href: "/equipo", accion: "Invitar", listo: estado.equipo > 1,
    },
    {
      titulo: "Recibir la primera consulta real",
      detalle: "Probá el formulario vos mismo para ver el circuito completo.",
      href: `/f/${firm.slug}`, accion: "Probar el formulario", listo: estado.visitas > 0,
    },
  ];

  const base = baseUrl();

  return (
    <>
      <div className="head">
        <div>
          <h1>{firm.name}</h1>
          <p>
            Página pública de consultas:{" "}
            <Link href={`/f/${firm.slug}`} style={{ color: "var(--accent)", fontWeight: 600 }}>
              {base.replace(/^https?:\/\//, "")}/f/{firm.slug}
            </Link>
          </p>
        </div>
        <RangePicker current={range} />
      </div>

      <Onboarding pasos={pasos} />

      <div className="grid cols-4" style={{ marginBottom: "1rem" }}>
        <Tile label="Visitas al formulario" value={t.visits.toLocaleString("es-AR")} sub={`${t.starts} empezaron a completarlo`} />
        <Tile label="Consultas enviadas" value={t.responses.toLocaleString("es-AR")} sub={`${Number(nuevas?.n ?? 0)} sin leer`} />
        <Tile label="Tasa de conversión" value={`${t.conversion}%`} meter={t.conversion} sub="Consultas sobre visitas" />
        <Tile
          label="Abandonos recuperables"
          value={t.startedNotFinished.toLocaleString("es-AR")}
          sub="Dejaron el mail y no terminaron"
        />
      </div>

      <div className="grid cols-2-1">
        <div className="card">
          <h3>Visitas y consultas</h3>
          <LineChart
            data={s.map((row) => ({
              label: fmtShort(row.bucket),
              visits: Number(row.visits),
              responses: Number(row.responses),
            }))}
          />
        </div>

        <div className="card">
          <h3>Para recuperar</h3>
          {pendientes.length === 0 ? (
            <p className="empty">No hay formularios abandonados.</p>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: ".9rem" }}>
                {pendientes.map((p) => (
                  <div key={p.id} style={{ fontSize: ".88rem" }}>
                    <strong>{p.full_name ?? p.email}</strong>
                    <div className="muted" style={{ fontSize: ".82rem" }}>
                      {p.funnel} · se fue en el paso {p.max_step}
                      {p.recovery_sent_at ? " · ya contactado" : ""}
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/responses?tab=abandonadas" className="btn ghost" style={{ marginTop: "1.2rem", display: "inline-block" }}>
                Ver todos
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
