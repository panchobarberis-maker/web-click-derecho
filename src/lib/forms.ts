import type { Field, Step } from "./db";
import type { Lang } from "./i18n";

export const TIPOS: { value: Field["type"]; label: string }[] = [
  { value: "text", label: "Texto corto" },
  { value: "textarea", label: "Texto largo" },
  { value: "email", label: "Email" },
  { value: "tel", label: "Teléfono" },
  { value: "date", label: "Fecha" },
  { value: "select", label: "Lista desplegable" },
  { value: "radio", label: "Opciones (una sola)" },
  { value: "checkbox", label: "Casilla de confirmación" },
];

export const CON_OPCIONES = new Set<Field["type"]>(["select", "radio"]);

/** Claves que el panel y el mail al estudio tratan de forma especial. */
export const CLAVES_CONTACTO = ["first_name", "last_name", "email", "phone", "consent"] as const;

/** Deriva una clave estable a partir de la etiqueta. */
export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/** Igual que slugify pero con guiones, para las URLs públicas. */
export const slugUrl = (texto: string) => slugify(texto).replace(/_/g, "-") || "sin-nombre";

/**
 * Revisa un formulario antes de guardarlo.
 *
 * Devuelve la lista de problemas; vacía significa que se puede guardar.
 */
export function validarFormulario(steps: Step[]): string[] {
  const problemas: string[] = [];

  if (steps.length === 0) return ["El formulario necesita al menos un paso."];

  const vistas = new Set<string>();
  let tieneEmail = false;
  let emailEnPasoUno = false;

  steps.forEach((paso, i) => {
    if (!paso.title?.trim()) problemas.push(`El paso ${i + 1} no tiene título.`);
    if (paso.fields.length === 0) problemas.push(`El paso ${i + 1} no tiene ninguna pregunta.`);

    for (const f of paso.fields) {
      if (!f.label?.trim()) problemas.push(`Hay una pregunta sin texto en el paso ${i + 1}.`);
      if (!f.key) problemas.push(`La pregunta "${f.label}" no tiene clave.`);
      else if (vistas.has(f.key)) problemas.push(`La clave "${f.key}" está repetida: cada pregunta necesita una distinta.`);
      vistas.add(f.key);

      if (CON_OPCIONES.has(f.type) && !(f.options ?? []).filter((o) => o.trim()).length) {
        problemas.push(`"${f.label}" es una lista de opciones pero no tiene ninguna cargada.`);
      }

      if (f.key === "email") {
        tieneEmail = true;
        if (i === 0) emailEnPasoUno = true;
      }
    }
  });

  // El email es la pieza de la que depende recuperar a los que abandonan:
  // sin el, una persona que se va a mitad del formulario se pierde.
  if (!tieneEmail) {
    problemas.push(
      'Falta una pregunta de email con la clave "email". Sin eso no se puede ' +
        "contactar a quien abandone el formulario.",
    );
  } else if (!emailEnPasoUno) {
    problemas.push(
      "El email tiene que estar en el primer paso. Si se pide más adelante, " +
        "quien abandone antes de llegar ahí se pierde.",
    );
  }

  return problemas;
}

/**
 * Las 24 jurisdicciones del pais.
 *
 * En Argentina el procedimiento y los plazos cambian por provincia, y hay
 * estudios que solo litigan en algunas. Preguntarlo en el paso 1 evita que el
 * estudio invierta una entrevista en un caso que no puede tomar.
 */
/**
 * Las jurisdicciones que se ofrecen por defecto.
 *
 * En Argentina el derecho cambia de provincia a provincia y en Estados Unidos
 * de estado a estado, asi que la pregunta es la misma y solo cambia la lista.
 */
export const PROVINCIAS = ["Ciudad Autónoma de Buenos Aires", "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"] as const;

export const ESTADOS_US = ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"] as const;

/**
 * Paso de cierre sugerido: como y cuando contactar, y con cuanta urgencia.
 *
 * Va al final y no en el paso 1 a proposito. El paso 1 decide si la persona
 * empieza o se va, asi que cuanto mas corto mejor; estas preguntas se
 * responden bien cuando ya conto el caso y esta invertida.
 */
export function pasoDeCoordinacion(lang: Lang = "es"): Step {
  if (lang === "en") {
    return {
      title: "Tell us more",
      subtitle: "Last one: your case in your own words, and how you'd like us to reach you.",
      fields: [
        { key: "relato", label: "What happened?", type: "textarea", required: false },
        {
          key: "urgencia",
          label: "How urgent is it?",
          type: "radio",
          required: true,
          options: [
            "Urgent — I have a deadline coming up",
            "I want it handled this month",
            "Just looking into it, no rush",
          ],
        },
        {
          key: "contacto_pref",
          label: "How would you prefer we reach you?",
          type: "radio",
          required: true,
          options: ["Phone call", "Text message", "Email", "Video call (Zoom or Meet)", "In person at the office"],
        },
        {
          key: "franja",
          label: "Best time of day?",
          type: "select",
          required: false,
          options: ["Morning (9am–1pm)", "Afternoon (1pm–6pm)", "Either works"],
        },
        {
          key: "otro_abogado",
          label: "Have you already spoken with another attorney about this?",
          type: "radio",
          required: false,
          options: ["No", "Yes, one consultation", "Yes, I have an attorney on the case"],
        },
      ],
    };
  }

  return {
    title: "Contanos y coordinamos",
    subtitle: "Lo último: tu caso en tus palabras, y cómo te viene bien que te contactemos.",
    fields: [
      {
        key: "relato",
        label: "Contanos de qué se trata",
        type: "textarea",
        required: false,
      },
      {
        key: "urgencia",
        label: "¿Qué tan urgente es?",
        type: "radio",
        required: true,
        options: [
          "Es urgente, tengo un plazo venciendo",
          "Quiero resolverlo este mes",
          "Estoy averiguando, sin apuro",
        ],
      },
      {
        key: "contacto_pref",
        label: "¿Cómo preferís que te contactemos?",
        type: "radio",
        required: true,
        options: [
          "Llamada telefónica",
          "WhatsApp",
          "Email",
          "Videollamada (Zoom o Meet)",
          "Reunión presencial en el estudio",
        ],
      },
      {
        key: "franja",
        label: "¿En qué horario?",
        type: "select",
        required: false,
        options: ["Mañana (9 a 13)", "Tarde (13 a 18)", "Indistinto"],
      },
      {
        key: "otro_abogado",
        label: "¿Ya consultaste este caso con otro abogado?",
        type: "radio",
        required: false,
        options: ["No", "Sí, hice una consulta", "Sí, tengo abogado en el caso"],
      },
    ],
  };
}

/** Paso de contacto sugerido al crear un formulario nuevo. */
export function pasoDeContacto(lang: Lang = "es"): Step {
  if (lang === "en") {
    return {
      title: "Who are we speaking with?",
      subtitle: "That's all we need to open your request and get back to you.",
      fields: [
        { key: "first_name", label: "First name", type: "text", required: true },
        { key: "last_name", label: "Last name", type: "text", required: true },
        { key: "email", label: "Email", type: "email", required: true },
        { key: "phone", label: "Phone", type: "tel", required: false },
        { key: "provincia", label: "Which state?", type: "select", required: true, options: [...ESTADOS_US] },
        {
          key: "consent",
          label: "I agree to be contacted by email and text about my request",
          type: "checkbox",
          required: false,
        },
      ],
    };
  }

  return {
    title: "¿Con quién hablamos?",
    subtitle: "Con esto ya podemos abrir la consulta y contactarte.",
    fields: [
      { key: "first_name", label: "Nombre", type: "text", required: true },
      { key: "last_name", label: "Apellido", type: "text", required: true },
      { key: "email", label: "Email", type: "email", required: true },
      { key: "phone", label: "Teléfono / WhatsApp", type: "tel", required: false },
      { key: "provincia", label: "¿En qué provincia?", type: "select", required: true, options: [...PROVINCIAS] },
      {
        key: "consent",
        label: "Quiero que me contacten por email y WhatsApp sobre mi consulta",
        type: "checkbox",
        required: false,
      },
    ],
  };
}
