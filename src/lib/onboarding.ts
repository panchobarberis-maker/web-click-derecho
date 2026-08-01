import { sql } from "./db";

/**
 * Estado de puesta en marcha de un estudio.
 *
 * Se lee del estado real de la base y no de una tabla de "pasos completados":
 * si alguien borra sus formularios, el paso vuelve a aparecer pendiente.
 */
export type Estado = {
  firm_id: string;
  marca: boolean;    // logo, color y texto de privacidad cargados
  areas: number;
  casos: number;
  widgets: number;   // pop-ups y clips activos
  equipo: number;
  visitas: number;   // visitas reales, sin contar las de demostracion
};

export type Paso = {
  titulo: string;
  detalle: string;
  href: string;
  accion: string;
  listo: boolean;
};

/**
 * Un solo query para todos los estudios o para uno.
 *
 * El parametro va casteado a uuid para que Postgres sepa el tipo cuando viene
 * en null, que es como pedimos "todos".
 */
function contar(firmId: string | null) {
  return sql<Estado[]>`
    select
      f.id as firm_id,
      (f.logo_url is not null and f.intro is not null) as marca,
      (select count(*)::int from funnels where firm_id = f.id) as areas,
      (select count(*)::int from workflows w
        join funnels fu on fu.id = w.funnel_id where fu.firm_id = f.id) as casos,
      (select count(*)::int from popups where firm_id = f.id and active)
      + (select count(*)::int from clips where firm_id = f.id and active) as widgets,
      (select count(*)::int from memberships where firm_id = f.id) as equipo,
      (select count(*)::int from sessions
        where firm_id = f.id and data->>'_demo' is null) as visitas
    from firms f
    where ${firmId}::uuid is null or f.id = ${firmId}::uuid`;
}

export async function estadoDe(firmId: string): Promise<Estado> {
  const [e] = await contar(firmId);
  return e;
}

/** Indexado por firm_id, para la lista de estudios de la agencia. */
export async function estadoDeTodos(): Promise<Map<string, Estado>> {
  const filas = await contar(null);
  return new Map(filas.map((e) => [e.firm_id, e]));
}

/**
 * El checklist. El primer paso ya no es "crear el estudio": si se esta viendo
 * esto, el estudio existe. Lo que falta es que tenga cara propia.
 */
export function pasosDe(e: Estado, firmSlug: string): Paso[] {
  return [
    {
      titulo: "Ponerle la marca del estudio",
      detalle: "Logo, color y el texto de privacidad que ve la persona antes de escribir.",
      href: "/ajustes", accion: "Cargar", listo: e.marca,
    },
    {
      titulo: "Cargar las áreas de práctica",
      detalle: "Los temas que atiende el estudio: laboral, familia, sucesiones.",
      href: "/funnels", accion: "Cargar áreas", listo: e.areas > 0,
    },
    {
      titulo: "Armar los formularios",
      detalle: "Un caso concreto por área, con sus preguntas propias.",
      href: "/funnels", accion: "Armar", listo: e.casos > 0,
    },
    {
      titulo: "Instalarlo en el sitio del estudio",
      detalle: "Un pop-up o un clip, con una línea de código.",
      href: "/popups", accion: "Crear un pop-up", listo: e.widgets > 0,
    },
    {
      titulo: "Dar acceso al estudio",
      detalle: "Invitar a quien va a atender las consultas.",
      href: "/equipo", accion: "Invitar", listo: e.equipo > 0,
    },
    {
      titulo: "Recibir la primera consulta real",
      detalle: "Probá el formulario vos mismo para ver el circuito completo.",
      href: `/f/${firmSlug}`, accion: "Probar el formulario", listo: e.visitas > 0,
    },
  ];
}

/** Cuántos pasos van hechos, para mostrarlo en la lista de estudios. */
export const hechos = (pasos: Paso[]) => pasos.filter((p) => p.listo).length;
