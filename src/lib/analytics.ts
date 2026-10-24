import { sql } from "./db";
import { t, type Lang } from "./i18n";

export type Range = "7d" | "30d" | "90d" | "all";

/** Postgres interval para el filtro de fecha. null = todo el historico. */
function since(range: Range): string | null {
  return { "7d": "7 days", "30d": "30 days", "90d": "90 days", all: null }[range];
}

export async function totals(firmId: string, range: Range) {
  const s = since(range);
  const [row] = await sql<{ visits: number; responses: number; starts: number }[]>`
    select
      count(*) filter (where true)                as visits,
      count(*) filter (where submitted_at is not null) as responses,
      count(*) filter (where max_step > 0)        as starts
    from sessions
    where firm_id = ${firmId}
      ${s ? sql`and created_at > now() - ${s}::interval` : sql``}`;

  const visits = Number(row?.visits ?? 0);
  const responses = Number(row?.responses ?? 0);
  const starts = Number(row?.starts ?? 0);
  return {
    visits,
    responses,
    starts,
    // Igual que Lawbrokr: conversion sobre visitas, no sobre los que arrancaron.
    conversion: visits ? Math.round((responses / visits) * 100) : 0,
    // Este es el numero que justifica los mails de recuperacion.
    startedNotFinished: starts - responses,
  };
}

/** Serie temporal por dia o por semana, segun el rango. */
export async function series(firmId: string, range: Range) {
  const s = since(range);
  const bucket = range === "7d" || range === "30d" ? "day" : "week";
  return sql<{ bucket: Date; visits: number; responses: number }[]>`
    select
      date_trunc(${bucket}, created_at) as bucket,
      count(*)                                          as visits,
      count(*) filter (where submitted_at is not null)  as responses
    from sessions
    where firm_id = ${firmId}
      ${s ? sql`and created_at > now() - ${s}::interval` : sql``}
    group by 1 order by 1`;
}

export async function attribution(firmId: string, range: Range) {
  const s = since(range);
  return sql<{ source: string; n: number; consultas: number; pct: number }[]>`
    with t as (
      select coalesce(nullif(source, ''), 'direct') as source, submitted_at
      from sessions
      where firm_id = ${firmId}
        ${s ? sql`and created_at > now() - ${s}::interval` : sql``}
    )
    select source, count(*) as n,
           count(*) filter (where submitted_at is not null)::int as consultas,
           round(100.0 * count(*) / nullif(sum(count(*)) over (), 0), 1) as pct
    from t group by source order by consultas desc, n desc`;
}

export type Campana = {
  fuente: string; medio: string; campana: string;
  visitas: number; consultas: number; conversion: number;
};

/**
 * De donde vienen las consultas, al nivel de campaña.
 *
 * La tabla de arriba agrupa por origen grueso ("google", "instagram"), que
 * sirve para mirar de reojo pero no para decidir nada: dos campañas de
 * Instagram pueden rendir distinto y ahi se ven iguales. Esto abre por
 * utm_source / utm_medium / utm_campaign, que es lo que se necesita para saber
 * que pauta cortar.
 *
 * Las visitas sin utm no se descartan: caen bajo su origen resuelto (el
 * buscador, el sitio que las trajo, o directo), asi la suma sigue cerrando con
 * el total.
 */
export async function campanas(firmId: string, range: Range): Promise<Campana[]> {
  const s = since(range);
  return sql<Campana[]>`
    select
      coalesce(nullif(utm->>'utm_source', ''), nullif(source, ''), 'direct') as fuente,
      coalesce(nullif(utm->>'utm_medium', ''), '—')                          as medio,
      coalesce(nullif(utm->>'utm_campaign', ''), '—')                        as campana,
      count(*)::int                                                          as visitas,
      count(*) filter (where submitted_at is not null)::int                  as consultas,
      coalesce(round(100.0 * count(*) filter (where submitted_at is not null)
              / nullif(count(*), 0)), 0)                                     as conversion
    from sessions
    where firm_id = ${firmId}
      ${s ? sql`and created_at > now() - ${s}::interval` : sql``}
    group by 1, 2, 3
    order by consultas desc, visitas desc
    limit 40`;
}

/** Rendimiento por area de practica. */
export async function byFunnel(firmId: string, range: Range) {
  const s = since(range);
  return sql<{ id: string; name: string; color: string; visits: number; responses: number; conversion: number }[]>`
    select f.id, f.name, f.color,
      count(s.id)                                          as visits,
      count(s.id) filter (where s.submitted_at is not null) as responses,
      coalesce(round(100.0 * count(s.id) filter (where s.submitted_at is not null)
              / nullif(count(s.id), 0)), 0)                 as conversion
    from funnels f
    left join sessions s on s.funnel_id = f.id
      ${s ? sql`and s.created_at > now() - ${s}::interval` : sql``}
    where f.firm_id = ${firmId}
    group by f.id, f.name, f.color, f.sort_order
    order by f.sort_order`;
}

/** Rendimiento por superficie: pagina propia, pop-up o clip. */
export async function bySurface(firmId: string, range: Range) {
  const s = since(range);
  return sql<{ surface: string; visits: number; responses: number; conversion: number }[]>`
    select surface,
      count(*)                                          as visits,
      count(*) filter (where submitted_at is not null)  as responses,
      coalesce(round(100.0 * count(*) filter (where submitted_at is not null)
              / nullif(count(*), 0)), 0)                as conversion
    from sessions
    where firm_id = ${firmId}
      ${s ? sql`and created_at > now() - ${s}::interval` : sql``}
    group by surface order by visits desc`;
}

/**
 * Donde se cae la gente, paso por paso. Es la vista que dice que arreglar:
 * si el 60% se cae en el paso 3, ese paso sobra o esta mal preguntado.
 */
/**
 * En que paso se cae la gente.
 *
 * Una sola ida a la base: resuelve cual es el formulario, cuantos pasos tiene
 * y cuanta gente llego a cada uno. Antes eran dos consultas encadenadas —el
 * formulario primero, los pasos despues— y ademas la pantalla tenia que pedir
 * la lista de formularios antes de poder llamar a esta funcion, con lo cual
 * Analytics arrancaba con cuatro latencias en fila contra Supabase.
 *
 * Con workflowId en null toma el primero del estudio, que es lo que la
 * pantalla muestra por defecto.
 */
export async function dropoff(firmId: string, workflowId: string | null, range: Range, lang: Lang = "es") {
  const s = since(range);

  const filas = await sql<
    { name: string; steps: { steps: { title: string }[] }; step: number; reached: string }[]
  >`
    with wf as (
      select w.id, w.name, w.steps
      from workflows w join funnels f on f.id = w.funnel_id
      where f.firm_id = ${firmId}
        and (${workflowId}::uuid is null or w.id = ${workflowId}::uuid)
      order by f.sort_order, w.sort_order
      limit 1
    )
    select wf.name, wf.steps, gs.step, count(s.id) as reached
    from wf
    cross join lateral
      generate_series(0, coalesce(jsonb_array_length(wf.steps -> 'steps'), 0)) as gs(step)
    left join sessions s
      on s.workflow_id = wf.id and s.firm_id = ${firmId} and s.max_step >= gs.step
      ${s ? sql`and s.created_at > now() - ${s}::interval` : sql``}
    group by wf.name, wf.steps, gs.step
    order by gs.step`;

  if (filas.length === 0) return null;
  const tx = t(lang).stats;

  const titulos = filas[0].steps?.steps ?? [];
  const top = Number(filas[0].reached ?? 0);
  return {
    name: filas[0].name,
    steps: filas.map((r) => ({
      step: r.step,
      title: r.step === 0 ? tx.abrioFormulario : titulos[r.step - 1]?.title ?? tx.pasoN(r.step),
      reached: Number(r.reached),
      pct: top ? Math.round((Number(r.reached) / top) * 100) : 0,
    })),
  };
}

/** Los que dejaron el mail y no terminaron: la lista para recuperar. */
export async function abandoned(firmId: string, limit = 100) {
  return sql<
    { id: string; full_name: string | null; email: string; max_step: number; funnel: string; workflow: string; recovery_sent_at: Date | null; updated_at: Date }[]
  >`
    select s.id, s.full_name, s.email, s.max_step, s.recovery_sent_at, s.updated_at,
           coalesce(f.name, '—') as funnel, coalesce(w.name, '—') as workflow
    from sessions s
    left join funnels f on f.id = s.funnel_id
    left join workflows w on w.id = s.workflow_id
    where s.firm_id = ${firmId} and s.submitted_at is null
      and s.email is not null and s.email <> ''
    order by s.updated_at desc
    limit ${limit}`;
}

/** Rendimiento de cada pop-up o clip. Clicks = abrieron el formulario. */
/**
 * El embudo de cada pop-up o clip: mostrado, abierto, enviado.
 *
 * Las dos mitades se cuentan por separado y despues se juntan. Con un solo
 * left join a dos tablas, cada impresion multiplicaria a cada sesion y los
 * numeros saldrian inflados sin que se note.
 */
export async function porWidget(firmId: string, tipo: "popups" | "clips", range: Range) {
  const s = since(range);
  const surface = tipo === "popups" ? "popup" : "clip";

  return sql<{
    id: string; name: string; active: boolean;
    impresiones: number; clicks: number; responses: number;
    apertura: number; conversion: number;
  }[]>`
    with vistas as (
      select surface_id, count(*)::int as n
      from events
      where firm_id = ${firmId} and type = 'impression' and surface = ${surface}
        ${s ? sql`and created_at > now() - ${s}::interval` : sql``}
      group by surface_id
    ),
    aperturas as (
      select surface_id,
             count(*)::int                                     as n,
             count(*) filter (where submitted_at is not null)::int as enviadas
      from sessions
      where firm_id = ${firmId} and surface = ${surface} and surface_id is not null
        ${s ? sql`and created_at > now() - ${s}::interval` : sql``}
      group by surface_id
    )
    select w.id, w.name, w.active,
      coalesce(v.n, 0)         as impresiones,
      coalesce(a.n, 0)         as clicks,
      coalesce(a.enviadas, 0)  as responses,
      -- cuantos de los que lo vieron lo abrieron
      coalesce(round(100.0 * coalesce(a.n, 0) / nullif(v.n, 0)), 0)::int        as apertura,
      -- y cuantos de los que lo abrieron terminaron mandando la consulta
      coalesce(round(100.0 * coalesce(a.enviadas, 0) / nullif(a.n, 0)), 0)::int as conversion
    from ${sql(tipo)} w
    left join vistas v    on v.surface_id = w.id
    left join aperturas a on a.surface_id = w.id
    where w.firm_id = ${firmId}
    order by w.created_at desc`;
}
