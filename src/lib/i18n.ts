/**
 * Los textos de la aplicacion, en los dos idiomas.
 *
 * El idioma vive en el estudio (`firms.lang`), no en una configuracion global
 * ni en el usuario: un estudio argentino y uno de Estados Unidos comparten la
 * misma instalacion, y lo que manda es a quien le habla el formulario —el
 * cliente del estudio— antes que quien administra el panel.
 *
 * `en` esta tipado contra `es`, asi que olvidarse una traduccion no compila.
 * Es a proposito: un texto que se escapa no se nota mirando, se nota cuando un
 * abogado de Texas ve "Enviar consulta" en medio de su formulario.
 */

export type Lang = "es" | "en";

export const IDIOMAS: { code: Lang; nombre: string }[] = [
  { code: "es", nombre: "Castellano" },
  { code: "en", nombre: "English" },
];

export const esLang = (v: unknown): v is Lang => v === "es" || v === "en";

/**
 * El idioma de quien mira, cuando todavia no sabemos de que estudio es.
 *
 * Lo usan las pantallas anteriores a la sesion —entrar, recuperar la
 * contraseña, aceptar una invitacion—, donde no hay estudio del cual sacarlo.
 * Sin esto, alguien de un estudio de Estados Unidos se encontraba la pantalla
 * de login en castellano.
 */
export function langDeCabecera(accept: string | null | undefined): Lang {
  if (!accept) return "es";
  // "en-US,en;q=0.9,es;q=0.8" -> gana el de mayor q, empate al primero
  const preferencias = accept
    .split(",")
    .map((p) => {
      const [tag, ...resto] = p.trim().split(";");
      const q = resto.find((r) => r.trim().startsWith("q="));
      return { base: tag.trim().slice(0, 2).toLowerCase(), q: q ? Number(q.split("=")[1]) || 0 : 1 };
    })
    .filter((p) => p.base === "es" || p.base === "en")
    .sort((a, b) => b.q - a.q);

  return preferencias[0]?.base === "en" ? "en" : "es";
}

const es = {
  // ---------------------------------------------------------- formulario
  form: {
    paso: (n: number, total: number, area: string) => `Paso ${n} de ${total} · ${area}`,
    atras: "← Atrás",
    continuar: "Continuar",
    enviar: "Enviar consulta",
    enviando: "Enviando…",
    elegir: "Elegí una opción…",
    sinPreguntas: "Este formulario todavía no tiene preguntas.",
    nota: "Tus datos van directo al estudio y se usan solo para responder esta consulta.",
    volver: "← Volver",

    // validacion
    requerido: "Completá este campo",
    emailInvalido: "Revisá el email",
    consentimiento: "Necesitamos tu confirmación para seguir",

    // pantalla final
    graciasTitulo: "Recibimos tu consulta",
    graciasCuerpo: (estudio: string) => `Un abogado de ${estudio} la va a revisar y te contacta`,
    graciasEmail: "Si es urgente, respondé el mail que te acabamos de mandar.",

    // portada y eleccion
    comoAyudar: "¿Cómo podemos ayudarte?",
    contanos: "Contanos tu caso. Tocá la opción que mejor lo describa:",
    cualSituacion: "¿Cuál es tu situación?",
    elegiParecida: "Elegí la opción más parecida a tu caso. Así te preguntamos solo lo que hace falta.",
  },

  // ---------------------------------------------------------- widget
  widget: {
    cerrar: "Cerrar",
    tituloIframe: "Formulario de consulta",
    ctaDefecto: "Consultá tu caso",
    pausar: "Pausar",
    reproducir: "Reproducir",
    activarSonido: "Activar sonido",
    silenciar: "Silenciar",
    cerrarVideo: "Cerrar el video",
  },

  // ---------------------------------------------------------- mails
  mail: {
    // aviso al estudio
    leadAsunto: (area: string, nombre: string) => `Nueva consulta: ${area} — ${nombre}`,
    leadTitulo: "Tenés una consulta nueva",
    leadBajada: (area: string) => `Entró una consulta por ${area}. Los datos de contacto están abajo.`,
    leadContacto: "Datos de contacto",
    leadRespuestas: "Respuestas del formulario",
    leadVer: "Ver la consulta",
    sinNombre: "Consulta sin nombre",
    campos: {
      nombre: "Nombre",
      apellido: "Apellido",
      email: "Email",
      telefono: "Teléfono",
      consent: "¿Aceptó que lo contacten?",
      area: "Área",
      caso: "Tipo de caso",
      origen: "Origen",
      si: "Sí",
      no: "No",
    },

    // recuperacion de abandono
    recuperarAsunto: (estudio: string) => `Tu consulta en ${estudio} quedó a mitad de camino`,
    recuperarHola: (nombre: string) => `Hola${nombre ? ` ${nombre}` : ""},`,
    recuperarCuerpo: (area: string) =>
      `Empezaste una consulta por ${area} y quedó sin terminar. Podés retomarla donde la dejaste, no hace falta volver a escribir nada.`,
    recuperarBoton: "Retomar mi consulta",
    recuperarResponder: "Si preferís, respondé este mail y te contactamos nosotros.",
    pieEstudio:
      "Recibís este mail porque dejaste tus datos en nuestro formulario de consulta. Si fue un error, ignoralo y no volvemos a escribirte.",
  },
};

const en: typeof es = {
  form: {
    paso: (n, total, area) => `Step ${n} of ${total} · ${area}`,
    atras: "← Back",
    continuar: "Continue",
    enviar: "Send my request",
    enviando: "Sending…",
    elegir: "Choose one…",
    sinPreguntas: "This form doesn't have any questions yet.",
    nota: "Your information goes straight to the firm and is only used to answer this request.",
    volver: "← Back",

    requerido: "Please fill this in",
    emailInvalido: "Check the email address",
    consentimiento: "We need your confirmation to continue",

    graciasTitulo: "We got your request",
    graciasCuerpo: (estudio) => `An attorney at ${estudio} will review it and get back to you`,
    graciasEmail: "If it's urgent, just reply to the email we sent you.",

    comoAyudar: "How can we help?",
    contanos: "Tell us about your case. Pick the option that fits best:",
    cualSituacion: "What's your situation?",
    elegiParecida: "Pick the closest match. That way we only ask what actually matters.",
  },

  widget: {
    cerrar: "Close",
    tituloIframe: "Contact form",
    ctaDefecto: "Talk to an attorney",
    pausar: "Pause",
    reproducir: "Play",
    activarSonido: "Unmute",
    silenciar: "Mute",
    cerrarVideo: "Close the video",
  },

  mail: {
    leadAsunto: (area, nombre) => `New request: ${area} — ${nombre}`,
    leadTitulo: "You have a new request",
    leadBajada: (area) => `A request came in for ${area}. Contact details are below.`,
    leadContacto: "Contact details",
    leadRespuestas: "Form answers",
    leadVer: "Open the request",
    sinNombre: "Request without a name",
    campos: {
      nombre: "First name",
      apellido: "Last name",
      email: "Email",
      telefono: "Phone",
      consent: "Agreed to be contacted?",
      area: "Practice area",
      caso: "Case type",
      origen: "Source",
      si: "Yes",
      no: "No",
    },

    recuperarAsunto: (estudio) => `Your request at ${estudio} is half finished`,
    recuperarHola: (nombre) => `Hi${nombre ? ` ${nombre}` : ""},`,
    recuperarCuerpo: (area) =>
      `You started a request about ${area} and didn't finish it. You can pick up right where you left off — nothing to retype.`,
    recuperarBoton: "Finish my request",
    recuperarResponder: "If you'd rather, just reply to this email and we'll reach out.",
    pieEstudio:
      "You're getting this email because you left your details in our contact form. If that wasn't you, ignore it and we won't write again.",
  },
};

const TEXTOS = { es, en };

/** Los textos del idioma pedido. */
export const t = (lang: Lang) => TEXTOS[lang];
