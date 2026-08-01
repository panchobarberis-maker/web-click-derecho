import type { Field, Step } from "./db";

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

/** Paso de contacto sugerido al crear un formulario nuevo. */
export function pasoDeContacto(): Step {
  return {
    title: "¿Con quién hablamos?",
    subtitle: "Con esto ya podemos abrir la consulta y contactarte.",
    fields: [
      { key: "first_name", label: "Nombre", type: "text", required: true },
      { key: "last_name", label: "Apellido", type: "text", required: true },
      { key: "email", label: "Email", type: "email", required: true },
      { key: "phone", label: "Teléfono / WhatsApp", type: "tel", required: false },
      {
        key: "consent",
        label: "Quiero que me contacten por email y WhatsApp sobre mi consulta",
        type: "checkbox",
        required: false,
      },
    ],
  };
}
