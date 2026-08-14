import { sql } from "@/lib/db";
import { activeFirm } from "@/lib/tenancy";
import { campanas, type Range } from "@/lib/analytics";
import { libroXlsx, type Celda } from "@/lib/xlsx";
import { fmtLong, sourceLabel } from "@/lib/format";
import { slugUrl } from "@/lib/forms";
import { t as textos, type Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const DIAS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

type Fila = {
  created_at: Date;
  submitted_at: Date | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  consent: boolean;
  funnel: string;
  workflow: string;
  source: string | null;
  surface: string;
  max_step: number;
  landing_page: string | null;
  utm: Record<string, string>;
  data: Record<string, string>;
  recovery_sent_at: Date | null;
};

const fecha = (d: Date | null, lang: Lang) => (d ? fmtLong(d, lang) : "");

/**
 * Exporta las consultas del estudio a un .xlsx.
 *
 * Va bajo (dashboard) para que el middleware la proteja igual que el resto del
 * panel, y el estudio sale de la sesion: nadie se baja las consultas de otro
 * cambiando un parametro.
 *
 * Las respuestas propias de cada formulario se abren en columnas al final. Como
 * cada caso pregunta cosas distintas, las columnas se arman con la union de las
 * claves que aparecen en el periodo exportado: si se pusiera una columna fija
 * por pregunta, un formulario nuevo no saldria en la exportacion.
 */
export async function GET(req: Request) {
  const { firm } = await activeFirm();
  const x = textos(firm.lang).excel;
  const lang = firm.lang;
  const url = new URL(req.url);
  const rango = (url.searchParams.get("r") ?? "30d") as Range;
  const dias = DIAS[rango];

  const [filas, camps] = await Promise.all([
    sql<Fila[]>`
      select s.created_at, s.submitted_at, s.full_name, s.email, s.phone, s.consent,
             coalesce(f.name, '—') as funnel, coalesce(w.name, '—') as workflow,
             s.source, s.surface, s.max_step, s.landing_page, s.utm, s.data,
             s.recovery_sent_at
      from sessions s
      left join funnels f on f.id = s.funnel_id
      left join workflows w on w.id = s.workflow_id
      where s.firm_id = ${firm.id}
        ${dias ? sql`and s.created_at > now() - ${`${dias} days`}::interval` : sql``}
      order by s.created_at desc`,
    campanas(firm.id, rango),
  ]);

  // Claves de respuestas que aparecen en el periodo, sin las de contacto (ya
  // tienen su columna) ni las internas, que empiezan con guion bajo.
  const CONTACTO = new Set(["first_name", "last_name", "email", "phone", "consent"]);
  const usadas = new Set<string>();
  for (const f of filas) {
    for (const k of Object.keys(f.data ?? {})) {
      if (!k.startsWith("_") && !CONTACTO.has(k)) usadas.add(k);
    }
  }

  // El encabezado lleva la pregunta tal como la ve quien completa, no la clave
  // interna: "hace_cuanto" no le dice nada a nadie. El orden sale del orden de
  // los formularios, porque el de un jsonb es arbitrario y cambiaria entre
  // exportaciones.
  const etiquetas = new Map<string, string>();
  const orden: string[] = [];
  if (usadas.size) {
    const forms = await sql<{ steps: { steps?: { fields: { key: string; label: string }[] }[] } }[]>`
      select w.steps from workflows w
      join funnels f on f.id = w.funnel_id
      where f.firm_id = ${firm.id}
      order by f.sort_order, w.sort_order`;

    for (const w of forms) {
      for (const paso of w.steps?.steps ?? []) {
        for (const campo of paso.fields ?? []) {
          if (!usadas.has(campo.key) || etiquetas.has(campo.key)) continue;
          etiquetas.set(campo.key, campo.label || campo.key);
          orden.push(campo.key);
        }
      }
    }
  }
  // Las que quedaron son de preguntas que ya no existen en ningun formulario:
  // las respuestas viejas no se tiran, van al final con su clave.
  const extra = [...orden, ...[...usadas].filter((k) => !etiquetas.has(k)).sort()];

  const encabezado = [
    x.fecha, x.estado, x.nombre, x.email, x.telefono, x.aceptaContacto,
    x.area, x.caso, x.origen, x.campana, x.medio, x.contenido,
    x.entroPor, x.pasoAlcanzado, x.enviadaEl, x.recordatorioEnviado,
    x.paginaDondeSeAbrio, ...extra.map((k) => etiquetas.get(k) ?? k),
  ];

  const consultas: Celda[][] = [
    encabezado,
    ...filas.map((f): Celda[] => [
      fecha(f.created_at, lang),
      f.submitted_at ? x.enviada : x.abandonada,
      f.full_name ?? "",
      f.email ?? "",
      f.phone ?? "",
      f.consent ? x.si : x.no,
      f.funnel,
      f.workflow,
      sourceLabel(f.source ?? "direct", lang),
      f.utm?.utm_campaign ?? "",
      f.utm?.utm_medium ?? "",
      f.utm?.utm_content ?? "",
      textos(lang).panel.superficies[f.surface] ?? f.surface,
      f.max_step,
      fecha(f.submitted_at, lang),
      fecha(f.recovery_sent_at, lang),
      f.landing_page ?? "",
      ...extra.map((k) => f.data?.[k] ?? ""),
    ]),
  ];

  const porCampana: Celda[][] = [
    [x.fuente, x.medio, x.campana, x.visitas, x.consultas, x.conversionPct],
    ...camps.map((c): Celda[] => [
      sourceLabel(c.fuente, lang), c.medio, c.campana,
      Number(c.visitas), Number(c.consultas), Number(c.conversion),
    ]),
  ];

  const libro = libroXlsx([
    {
      nombre: x.hojaConsultas,
      filas: consultas,
      anchos: [17, 12, 22, 28, 16, 14, 18, 22, 14, 20, 14, 16, 18, 14, 17, 17, 34, ...extra.map(() => 26)],
    },
    { nombre: x.hojaCampanas, filas: porCampana, anchos: [16, 16, 24, 10, 12, 13] },
  ]);

  const hoy = new Date().toISOString().slice(0, 10);
  const archivo = `${x.archivo}-${slugUrl(firm.name)}-${hoy}.xlsx`;

  return new Response(new Uint8Array(libro), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${archivo}"`,
      // Es un recorte del momento: que no quede en ningun cache intermedio.
      "Cache-Control": "no-store, private",
      "X-Rango": x.rangos[rango] ?? rango,
    },
  });
}
