import { sql } from "@/lib/db";
import { activeFirm } from "@/lib/tenancy";
import { campanas, type Range } from "@/lib/analytics";
import { libroXlsx, type Celda } from "@/lib/xlsx";
import { sourceLabel } from "@/lib/format";
import { slugUrl } from "@/lib/forms";

export const dynamic = "force-dynamic";

const RANGOS: Record<string, string> = {
  "7d": "últimos 7 días", "30d": "últimos 30 días", "90d": "últimos 90 días", all: "todo",
};

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

const SUPERFICIES: Record<string, string> = {
  page: "Página de consultas", popup: "Pop-up", clip: "Clip de video",
};

const fecha = (d: Date | null) =>
  d ? new Date(d).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

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
    "Fecha", "Estado", "Nombre", "Email", "Teléfono", "Acepta contacto",
    "Área", "Caso", "Origen", "Campaña", "Medio", "Contenido",
    "Entró por", "Paso alcanzado", "Enviada el", "Recordatorio enviado",
    "Página donde se abrió", ...extra.map((k) => etiquetas.get(k) ?? k),
  ];

  const consultas: Celda[][] = [
    encabezado,
    ...filas.map((f): Celda[] => [
      fecha(f.created_at),
      f.submitted_at ? "Enviada" : "Abandonada",
      f.full_name ?? "",
      f.email ?? "",
      f.phone ?? "",
      f.consent ? "Sí" : "No",
      f.funnel,
      f.workflow,
      sourceLabel(f.source ?? "direct"),
      f.utm?.utm_campaign ?? "",
      f.utm?.utm_medium ?? "",
      f.utm?.utm_content ?? "",
      SUPERFICIES[f.surface] ?? f.surface,
      f.max_step,
      fecha(f.submitted_at),
      fecha(f.recovery_sent_at),
      f.landing_page ?? "",
      ...extra.map((k) => f.data?.[k] ?? ""),
    ]),
  ];

  const porCampana: Celda[][] = [
    ["Fuente", "Medio", "Campaña", "Visitas", "Consultas", "Conversión %"],
    ...camps.map((c): Celda[] => [
      sourceLabel(c.fuente), c.medio, c.campana,
      Number(c.visitas), Number(c.consultas), Number(c.conversion),
    ]),
  ];

  const libro = libroXlsx([
    {
      nombre: "Consultas",
      filas: consultas,
      anchos: [17, 12, 22, 28, 16, 14, 18, 22, 14, 20, 14, 16, 18, 14, 17, 17, 34, ...extra.map(() => 26)],
    },
    { nombre: "Campañas", filas: porCampana, anchos: [16, 16, 24, 10, 12, 13] },
  ]);

  const hoy = new Date().toISOString().slice(0, 10);
  const archivo = `consultas-${slugUrl(firm.name)}-${hoy}.xlsx`;

  return new Response(new Uint8Array(libro), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${archivo}"`,
      // Es un recorte del momento: que no quede en ningun cache intermedio.
      "Cache-Control": "no-store, private",
      "X-Rango": RANGOS[rango] ?? rango,
    },
  });
}
