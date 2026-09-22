import Anthropic from "@anthropic-ai/sdk";
import type { Lang } from "./i18n";

/**
 * Lee una consulta y dice si conviene llamar primero.
 *
 * Esto es lo que diferencia al panel de una planilla: el estudio no necesita
 * otra lista ordenada por fecha, necesita saber a quien llamar hoy. Un puntaje
 * solo no sirve —"78" no le dice nada a nadie—; lo que sirve es la frase que
 * lo acompana, que es lo que escribiria un pasante despues de leer el caso.
 *
 * Tres reglas que estan en el prompt y conviene no aflojar:
 *
 *  - **Ordena, no descarta.** El correo dice "mira estos primero", nunca
 *    "estos son los buenos". Un caso mal puntuado que nadie abre puede ser un
 *    caso perdido con un plazo vencido, y eso es responsabilidad del estudio,
 *    no del modelo.
 *  - **No inventa.** Juzga con lo que la persona escribio y nada mas. Si falta
 *    un dato, va en `preguntar`, no se supone.
 *  - **No es asesoramiento legal.** Es orden de atencion. El prompt lo dice y
 *    el mail lo repite.
 *
 * El criterio de cada estudio vive en firms.triage_contexto, escrito por el
 * estudio con sus palabras. Sin eso el modelo puntua en el vacio; con eso cada
 * cliente de la agencia tiene el suyo sin tocar una linea de codigo.
 */

export type Triage = {
  puntaje: number;            // 0-100, solo para ordenar
  titular: string;            // el caso en una linea
  motivo: string;             // por que conviene (o no) llamar primero
  alerta: string | null;      // algo que corre: un plazo, un hecho viejo
  preguntar: string[];        // que falta averiguar en la llamada
  encaja: boolean;            // cae dentro de lo que el estudio toma
};

export type ConsultaParaTriage = {
  id: string;
  area: string | null;        // funnel
  caso: string | null;        // workflow
  respuestas: [string, string][];
  tieneEmail: boolean;
  tieneTelefono: boolean;
  consent: boolean;
  completo: boolean;          // llego hasta el final o abandono
  pasos: number;
  origen: string | null;
  hace: string;               // "hace 2 dias", legible
};

const MODELO = "claude-opus-5";

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["puntaje", "titular", "motivo", "alerta", "preguntar", "encaja"],
  properties: {
    puntaje: {
      type: "integer", minimum: 0, maximum: 100,
      description: "Que tan prioritaria es esta llamada hoy. No es la calidad del caso ni su valor legal.",
    },
    titular: {
      type: "string",
      description: "El caso en una linea corta, como lo diria alguien del estudio. Sin adjetivos.",
    },
    motivo: {
      type: "string",
      description: "Una sola frase: por que conviene llamar primero, o por que puede esperar.",
    },
    alerta: {
      type: ["string", "null"],
      description: "Solo si hay algo que corre: un hecho de hace mucho, un plazo que puede estar por vencer, una urgencia que la persona menciona. Si no hay nada, null.",
    },
    preguntar: {
      type: "array", maxItems: 3, items: { type: "string" },
      description: "Lo que falta saber y hay que preguntar en la llamada. Vacio si no falta nada.",
    },
    encaja: {
      type: "boolean",
      description: "Si cae dentro de lo que el estudio dijo que toma.",
    },
  },
} as const;

const INSTRUCCIONES = `Sos el asistente de admision de un estudio de abogados. Leés las consultas que entran por el formulario del sitio y decidís a quién conviene llamar primero.

Lo que hacés es ORDENAR LA ATENCIÓN, no evaluar casos. Nunca opines sobre si un caso se gana, cuánto vale, ni qué corresponde hacer legalmente: eso lo decide el abogado. Tu trabajo es que no se le pase de largo alguien que había que llamar hoy.

Reglas:

1. Juzgá con lo que la persona escribió y nada más. No completes, no supongas, no infieras hechos que no están. Lo que falta va en "preguntar".
2. El puntaje mide urgencia y posibilidad de contacto, no mérito. Sube cuando: el relato es concreto y detallado, dejó teléfono además de mail, aceptó que lo contacten, el hecho es reciente, y el caso es de lo que el estudio dijo que toma. Baja cuando: el relato es vago o de una línea, no hay forma de contactarlo, o es claramente otra cosa.
3. "alerta" es solo para lo que corre: un hecho de hace mucho tiempo donde puede haber un plazo en juego, o una urgencia que la persona menciona explícitamente. No inventes plazos ni cites normas: describí el hecho y que conviene mirarlo. Si no hay nada que corra, null.
4. Una consulta abandonada a mitad de camino puede ser tan buena como una completa. Lo que importa es si se puede contactar y qué contó, no si apretó el último botón.
5. "titular" y "motivo" los lee alguien apurado entre dos audiencias. Cortos, concretos, sin adjetivos de vendedor.
6. Si no encaja con lo que el estudio toma, decilo en "motivo" y bajá el puntaje. No lo descartes: el estudio decide.`;

let cliente: Anthropic | null = null;
const anthropic = () => (cliente ??= new Anthropic());

/** Si no hay clave, el triage se saltea y el resumen sale igual sin el. */
export const hayTriage = () => Boolean(process.env.ANTHROPIC_API_KEY);

function contexto(o: { estudio: string; areas: string[]; criterio: string | null; lang: Lang }) {
  const idioma = o.lang === "en" ? "inglés" : "castellano";
  return `${INSTRUCCIONES}

## El estudio

Nombre: ${o.estudio}
Áreas que atiende: ${o.areas.join(", ") || "no especificadas"}

${o.criterio?.trim()
    ? `Lo que el estudio dice sobre los casos que quiere:\n\n${o.criterio.trim()}`
    : `El estudio todavía no describió qué casos busca. Guiate por las áreas de arriba y sé prudente con "encaja": ante la duda, true.`}

Escribí "titular", "motivo", "alerta" y "preguntar" en ${idioma}.`;
}

function describir(c: ConsultaParaTriage): string {
  const contacto = [
    c.tieneEmail ? "dejó email" : "no dejó email",
    c.tieneTelefono ? "dejó teléfono" : "no dejó teléfono",
    c.consent ? "aceptó que lo contacten" : "no marcó que acepta contacto",
  ].join(", ");

  const respuestas = c.respuestas.length
    ? c.respuestas.map(([k, v]) => `- ${k}: ${v}`).join("\n")
    : "(no respondió ninguna pregunta)";

  return `Consulta recibida ${c.hace}.

Área: ${c.area ?? "sin área"}
Tipo de caso: ${c.caso ?? "sin especificar"}
Estado: ${c.completo ? "completó el formulario" : `abandonó en el paso ${c.pasos}`}
Contacto: ${contacto}
Origen: ${c.origen ?? "desconocido"}

Lo que respondió:

${respuestas}`;
}

/**
 * Puntua una consulta. Devuelve null si no se pudo —sin clave, por un error de
 * la API, o porque el modelo no contesto con la herramienta—, y el que llama
 * sigue sin ella: un resumen con catorce consultas puntuadas y una sin puntuar
 * es util; uno que no sale porque fallo una, no.
 */
export async function triarConsulta(
  consulta: ConsultaParaTriage,
  estudio: { estudio: string; areas: string[]; criterio: string | null; lang: Lang },
): Promise<Triage | null> {
  if (!hayTriage()) return null;

  try {
    const r = await anthropic().messages.create({
      model: MODELO,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      // Las instrucciones y el criterio del estudio se repiten en cada consulta
      // del lote: cachearlas es gratis si no entra y barato si entra.
      system: [{ type: "text", text: contexto(estudio), cache_control: { type: "ephemeral" } }],
      tools: [{
        name: "triage",
        description: "Registra el veredicto sobre esta consulta.",
        input_schema: ESQUEMA as unknown as Anthropic.Tool.InputSchema,
        strict: true,
      }],
      tool_choice: { type: "tool", name: "triage" },
      messages: [{ role: "user", content: describir(consulta) }],
    });

    const bloque = r.content.find((b) => b.type === "tool_use" && b.name === "triage");
    if (!bloque || bloque.type !== "tool_use") {
      console.error(`triage ${consulta.id}: el modelo no uso la herramienta (${r.stop_reason})`);
      return null;
    }
    return normalizar(bloque.input);
  } catch (e) {
    // Un fallo acá no puede tumbar el resumen del estudio.
    if (e instanceof Anthropic.AuthenticationError) console.error("triage: ANTHROPIC_API_KEY invalida");
    else if (e instanceof Anthropic.RateLimitError) console.error("triage: rate limit");
    else if (e instanceof Anthropic.APIError) console.error(`triage: API ${e.status}`, e.message);
    else console.error("triage:", e);
    return null;
  }
}

/** `strict: true` ya garantiza la forma, pero esto viene de afuera igual. */
function normalizar(input: unknown): Triage | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  if (typeof o.puntaje !== "number" || typeof o.titular !== "string") return null;
  return {
    puntaje: Math.max(0, Math.min(100, Math.round(o.puntaje))),
    titular: o.titular,
    motivo: typeof o.motivo === "string" ? o.motivo : "",
    alerta: typeof o.alerta === "string" && o.alerta.trim() ? o.alerta : null,
    preguntar: Array.isArray(o.preguntar) ? o.preguntar.filter((x): x is string => typeof x === "string").slice(0, 3) : [],
    encaja: o.encaja !== false,
  };
}
