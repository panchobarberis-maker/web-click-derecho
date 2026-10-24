import Link from "next/link";
import { sql } from "@/lib/db";
import { activeFirm } from "@/lib/tenancy";
import { totals, series, abandoned, type Range } from "@/lib/analytics";
import { LineChart, Tile } from "@/components/Charts";
import { RangePicker } from "@/components/RangePicker";
import { fmtShort, fmtNum } from "@/lib/format";
import { t as textos } from "@/lib/i18n";
import { baseUrl } from "@/lib/base-url";
import { Onboarding } from "@/components/Onboarding";
import { estadoDe, pasosDe } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const range = (((await searchParams).r as Range) ?? "30d") satisfies Range;

  // Sin try/catch: activeFirm redirige a /login o /sin-acceso lanzando, y
  // atraparlo se comería el redirect.
  const { firm } = await activeFirm();

  const [t, s, pendientes, [nuevas], estado] = await Promise.all([
    totals(firm.id, range),
    series(firm.id, range),
    abandoned(firm.id, 5),
    sql<{ n: number }[]>`select count(*) as n from sessions
      where firm_id = ${firm.id} and submitted_at is not null and read_at is null`,
    estadoDe(firm.id),
  ]);

  const pasos = pasosDe(estado, firm.slug, firm.lang);
  const base = baseUrl();
  const x = textos(firm.lang).panel;
  const lang = firm.lang;

  return (
    <>
      <div className="head">
        <div>
          <h1>{firm.name}</h1>
          <p>
            {x.paginaPublica}{" "}
            <Link href={`/f/${firm.slug}`} style={{ color: "var(--accent)", fontWeight: 600 }}>
              {base.replace(/^https?:\/\//, "")}/f/{firm.slug}
            </Link>
          </p>
        </div>
        <RangePicker current={range} lang={firm.lang} />
      </div>

      <Onboarding pasos={pasos} lang={firm.lang} />

      <div className="grid cols-4" style={{ marginBottom: "1rem" }}>
        <Tile label={x.visitas} value={fmtNum(t.visits, lang)} sub={x.empezaron(t.starts)} />
        <Tile label={x.consultasEnviadas} value={fmtNum(t.responses, lang)} sub={x.sinLeerN(Number(nuevas?.n ?? 0))} />
        <Tile label={x.conversion} value={`${t.conversion}%`} meter={t.conversion} sub={x.sobreVisitas} />
        <Tile
          label={x.abandonos}
          value={fmtNum(t.startedNotFinished, lang)}
          sub={x.dejaronMail}
        />
      </div>

      <div className="grid cols-2-1">
        <div className="card">
          <h3>{x.visitasYConsultas}</h3>
          <LineChart
            lang={firm.lang}
            data={s.map((row) => ({
              label: fmtShort(row.bucket, lang),
              visits: Number(row.visits),
              responses: Number(row.responses),
            }))}
          />
        </div>

        <div className="card">
          <h3>{x.paraRecuperar}</h3>
          {pendientes.length === 0 ? (
            <p className="empty">{x.sinAbandonos}</p>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: ".9rem" }}>
                {pendientes.map((p) => (
                  <div key={p.id} style={{ fontSize: ".88rem" }}>
                    <strong>{p.full_name ?? p.email}</strong>
                    <div className="muted" style={{ fontSize: ".82rem" }}>
                      {p.funnel} · {x.seFueEnPaso(p.max_step)}
                      {p.recovery_sent_at ? (lang === "en" ? " · already contacted" : " · ya contactado") : ""}
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/responses?tab=abandonadas" className="btn ghost" style={{ marginTop: "1.2rem", display: "inline-block" }}>
                {x.verTodos}
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
