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

  // ---------------------------------------------------------- panel
  nav: {
    inicio: "Inicio",
    consultas: "Consultas",
    analytics: "Analytics",
    areas: "Áreas y formularios",
    popups: "Pop-ups",
    clips: "Clips",
    instalacion: "Instalación",
    cuenta: "Mi cuenta",
    ajustes: "Ajustes del estudio",
    equipo: "Equipo",
    estudios: "Estudios",
    base: "Base de datos",
    agencia: "Agencia",
    salir: "Cerrar sesión",
    cambiarEstudio: "Cambiar de estudio",
  },


  panel: {
    // Inicio
    visitas: "Visitas al formulario",
    empezaron: (n: number) => `${n} empezaron a completarlo`,
    consultasEnviadas: "Consultas enviadas",
    sinLeerN: (n: number) => `${n} sin leer`,
    conversion: "Tasa de conversión",
    sobreVisitas: "Consultas sobre visitas",
    abandonos: "Abandonos recuperables",
    dejaronMail: "Dejaron el mail y no terminaron",
    visitasYConsultas: "Visitas y consultas",
    paraRecuperar: "Para recuperar",
    sinAbandonos: "No hay formularios abandonados.",
    verTodos: "Ver todos",
    paginaPublica: "Página pública de consultas:",
    seFueEnPaso: (n: number) => `se fue en el paso ${n}`,

    // Consultas
    consultas: "Consultas",
    resumenConsultas: (sinLeer: number, aband: number) =>
      `${sinLeer} sin leer · ${aband} formularios abandonados con mail.`,
    enviadas: "Enviadas",
    abandonadas: "Abandonadas",
    nadaAca: "Todavía no hay nada acá.",
    persona: "Persona",
    area: "Área",
    caso: "Caso",
    enviada: "Enviada",
    ultimaActividad: "Última actividad",
    estado: "Estado",
    seFueEn: "Se fue en",
    anonimo: "Anónimo",
    leida: "Leída",
    nueva: "Nueva",
    pasoN: (n: number) => `Paso ${n}`,
    recordatorioEnviado: "Recordatorio enviado",
    enviarRecordatorio: "Enviar recordatorio",

    // detalle de una consulta
    completa: "Completa",
    incompleta: "Incompleta",
    respuestas: "Respuestas",
    noRespondioNada: "No llegó a responder nada.",
    contacto: "Contacto",
    telefono: "Teléfono",
    aceptoContacto: "¿Aceptó contacto?",
    si: "Sí",
    no: "No",
    origen: "Origen",
    campanaCol: "Campaña",
    entroPor: "Entró por",
    paginaCol: "Página",
    primeraVisita: "Primera visita",
    volverConsultas: "← Consultas",
    enviadaHace: (cuando: string) => `enviada ${cuando}`,
    abandonadaEnPaso: (n: number) => `abandonada en el paso ${n}`,
    superficies: {
      page: "Página de consultas",
      popup: "Pop-up",
      clip: "Clip de video",
    } as Record<string, string>,
  },


  // Analytics, widgets e instalacion
  stats: {
    analytics: "Analytics",
    analyticsBajada: "Cuánta gente llega al formulario, cuánta lo termina y en qué paso se cae.",
    exportar: "Exportar a Excel",
    visitas: "Visitas",
    empezaron: "Empezaron",
    consultasEnviadas: "Consultas enviadas",
    conversion: "Conversión",
    deLasVisitas: (p: number) => `${p}% de las visitas`,
    sobreVisitas: "Consultas sobre visitas",
    visitasYConsultas: "Visitas y consultas",
    dondeSeCae: "Dónde se cae la gente",
    elegiFormulario: "Elegí un formulario.",
    cadaBarra: "Cada barra es cuánta gente llegó hasta ahí. La caída más grande es el paso a rediseñar.",
    deDondeVienen: "De dónde vienen",
    sobreVisitasOrigen: "Consultas sobre visitas de cada origen.",
    campanas: "Campañas",
    campanasAyuda1: "Cada consulta guarda los",
    campanasAyuda2:
      "de la página donde se abrió el formulario, aunque esté embebido en el sitio del estudio. Acá se ve qué pauta trae consultas y no solo clics.",
    deTotal: (n: number, total: number) => `${n} de ${total}`,
    sinVisitas: "Todavía no hay visitas en este período.",
    fuente: "Fuente",
    medio: "Medio",
    campana: "Campaña",
    consultas: "Consultas",
    porArea: "Por área de práctica",
    area: "Área",
    porDondeEntraron: "Por dónde entraron",
    superficie: "Superficie",
    conv: "Conv.",
    abrioFormulario: "Abrió el formulario",
    pasoN: (n: number) => `Paso ${n}`,
    superficies: {
      page: "Página de consultas",
      popup: "Pop-up en el sitio",
      clip: "Clip de video",
    },
    rangos: { "7d": "7 días", "30d": "30 días", "90d": "90 días", all: "Todo" },
    sinDatos: "Todavía no hay suficientes datos para el gráfico.",
    grafico: "Visitas y consultas en el tiempo",
  },

  widgets: {
    popups: "Pop-ups",
    popupsBajada:
      "El formulario apareciendo sobre el sitio del estudio. Cada pop-up tiene su propio código y sus propias métricas, así podés comparar cuál funciona mejor.",
    clips: "Clips",
    clipsBajada:
      "Un video corto fijo en una esquina del sitio. Al tocarlo abre el formulario. Sirve para poner la cara del estudio antes de que la persona escriba nada.",
    sinPopups: "Todavía no hay pop-ups. Creá el primero acá al lado.",
    sinClips: "Todavía no hay clips. Creá el primero acá al lado.",
    activo: "Activo",
    pausado: "Pausado",
    seMostro: "se mostró",
    aperturas: "aperturas",
    consultas: "consultas",
    abre: "abre",
    convierte: "convierte",
    resumen: (n: number, que: string) =>
      `De cada 100 personas que vieron este ${que}, ${n} dejaron una consulta.`,
    unPopup: "pop-up",
    unClip: "clip",
    verComoQueda: "Ver cómo queda",
    ajustes: "Ajustes",
    nombre: "Nombre",
    ejemploNombrePopup: "Home — salida",
    ejemploNombreClip: "Home — presentación",
    cuandoAparece: "Cuándo aparece",
    disparadores: {
      "delay:12": "A los 12 segundos",
      "delay:30": "A los 30 segundos",
      "scroll:50": "A la mitad de la página",
      exit: "Cuando se va a ir (exit intent)",
      now: "Apenas carga la página",
      button: "Botón flotante (no se abre solo)",
    } as Record<string, string>,
    textoBoton: "Texto del botón",
    ctaPopupDefecto: "Consultá tu caso",
    ctaClipDefecto: "Empezar",
    video: "Video",
    portada: "Imagen de portada (opcional)",
    ayudaVideo: (mb: number) =>
      `Vertical, de 15 a 20 segundos, hasta ${mb} MB. Cuanto más liviano, más rápido arranca en el sitio del estudio.`,
    ayudaPortada: (mb: number) =>
      `Es lo que se ve mientras el video carga. Vertical, hasta ${mb} MB.`,
    abreDirectoEn: "Abre directo en",
    todasLasAreas: "Todas las áreas (menú)",
    enQuePaginas: "¿En qué páginas aparece?",
    ejemploPaginas: "Vacío = en todo el sitio\n/laboral\n/servicios/*\n!/contacto",
    ejemploPaginasCorto: "Vacío = en todo el sitio\n/laboral\n!/contacto",
    reglasAyuda: "Una dirección por línea.",
    reglasComodin: "vale por cualquier cosa",
    reglasExcluye: "Una línea que empieza con",
    reglasExcluye2: "la excluye",
    reglasVacio: "Si lo dejás vacío, aparece en todo el sitio.",
    arrancaSolo: "Arranca solo, en silencio",
    arrancaAyuda:
      "Así se ve el video andando apenas entran, que es para lo que sirve. Destildalo solo si preferís que quede quieto con un botón de play.",
    activoCheck: "Activo",
    guardar: "Guardar",
    borrar: "Borrar",
    nuevoPopup: "Nuevo pop-up",
    nuevoClip: "Nuevo clip",
    crear: "Crear",
    copiar: "Copiar",
    copiado: "Copiado",
    piePopup:
      "El código se pega una vez en el sitio del estudio. Después podés cambiar el disparador o el texto desde acá sin volver a tocarlo.",
    pieClip:
      "Subís el video y queda hospedado con nosotros. Vertical y de 15 a 20 segundos es lo que mejor funciona.",
    pieClipSinSubida:
      "La subida no está configurada en este servidor: por ahora el video lo hospedás donde quieras y pegás la dirección.",
  },

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
    si: "Sí",
    no: "No",

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
  // ---------------------------------------------------------- exportacion
  excel: {
    hojaConsultas: "Consultas",
    hojaCampanas: "Campañas",
    archivo: "consultas",
    fecha: "Fecha",
    estado: "Estado",
    enviada: "Enviada",
    abandonada: "Abandonada",
    nombre: "Nombre",
    email: "Email",
    telefono: "Teléfono",
    aceptaContacto: "Acepta contacto",
    si: "Sí",
    no: "No",
    area: "Área",
    caso: "Caso",
    origen: "Origen",
    campana: "Campaña",
    medio: "Medio",
    contenido: "Contenido",
    entroPor: "Entró por",
    pasoAlcanzado: "Paso alcanzado",
    enviadaEl: "Enviada el",
    recordatorioEnviado: "Recordatorio enviado",
    paginaDondeSeAbrio: "Página donde se abrió",
    fuente: "Fuente",
    visitas: "Visitas",
    consultas: "Consultas",
    conversionPct: "Conversión %",
    rangos: { "7d": "últimos 7 días", "30d": "últimos 30 días", "90d": "últimos 90 días", all: "todo" } as Record<string, string>,
  },

  // ---------------------------------------------------------- ajustes del estudio
  ajustes: {
    titulo: "Ajustes del estudio",
    bajada:
      "Cómo se ve el formulario y a dónde llegan las consultas. Todo esto lo ve la persona antes de escribir: es lo que hace que el formulario parezca del estudio y no de una app cualquiera.",
    verPublica: "Ver página pública",
    guardado: "Guardado",
    identidad: "Identidad",
    nombreEstudio: "Nombre del estudio",
    direccionPublica: "Dirección pública",
    slugAviso: "— si la cambiás, los links viejos dejan de andar.",
    aDondeLlegan: "A dónde llegan las consultas",
    ejemploNotify: "consultas@estudio.com.ar",
    colorPrincipal: "Color principal",
    idioma: "Idioma del formulario",
    idiomaAyuda:
      "En qué idioma le habla el formulario a los clientes del estudio, y en cuál le llegan los mails. No cambia las preguntas que cargaste vos: esas quedan como las escribiste.",
    logo: "Logo",
    logoAyuda: "Se ve arriba del formulario. Fondo transparente (png o svg) queda mejor.",
    imagenPublica: "Imagen de la página pública",
    imagenPublicaAyuda:
      "La foto grande de la izquierda. Apaisada y de buena calidad; si no cargás ninguna queda el color del estudio.",
    privacidad: "Texto de privacidad",
    privacidadEjemplo: "Lo que nos contés es confidencial y solo lo ve el estudio.",
    guardar: "Guardar",
    dondeSeUsa: "Dónde se usa cada cosa",
    usoLogo: "Logo y color",
    usoLogoDet:
      "arriba del formulario, en el pop-up y en el mail que le llega a quien abandona a mitad de camino.",
    usoNotify: "A dónde llegan las consultas",
    usoNotifyDet:
      "cada formulario completado se manda a esa dirección con los datos de contacto y el origen de la visita. Si está vacío, la consulta igual queda guardada en el panel.",
    usoImagen: "Imagen de la página pública",
    usoImagenDet: "la foto del costado en",
    usoIdioma: "Idioma",
    usoIdiomaDet:
      "el formulario público, el pop-up, el clip y los mails al cliente. El panel también lo sigue, así ves lo mismo que ve el estudio.",
    usoPrivacidad: "Texto de privacidad",
    usoPrivacidadDet:
      "el párrafo debajo del formulario. Es lo que baja la desconfianza de dejar un teléfono.",
  },

  // ---------------------------------------------------------- instalacion
  embed: {
    titulo: "Instalación",
    bajada:
      "Una sola línea en el sitio del estudio. El formulario va dentro de un iframe, así que no hereda ni rompe los estilos de la página.",
    popupTitulo: "Pop-up automático",
    popupDesc:
      'Aparece solo, a los 12 segundos. También podés usar data-trigger="scroll:50" (a la mitad de la página) o "exit" (cuando el mouse se va a cerrar la pestaña).',
    botonTitulo: "Botón flotante",
    botonDesc: "Un botón fijo abajo a la derecha en todas las páginas. El menos invasivo de los tres.",
    inlineTitulo: "Formulario embebido",
    inlineDesc: 'El formulario dentro de una sección de la página. Poné un <div id="consulta"></div> donde lo quieras.',
    clipTitulo: "Clip de video",
    clipDesc:
      "Un video corto fijo en una esquina que abre el formulario al tocarlo. Subí el mp4 donde quieras y pasá la URL.",
    areaTitulo: "Directo a un área",
    areaDesc: "Para poner en la página de una práctica específica: saltea el menú y abre ese formulario.",
    atribucion: "Atribución del origen",
    atribucion1: "El widget lee los",
    atribucion2:
      "y el referrer de la página del estudio y se los pasa al formulario. Desde adentro del iframe el referrer sería el sitio del estudio, así que sin esto todas las consultas figurarían como «referral». Se guarda en el primer aterrizaje: si alguien llega desde Instagram, navega tres páginas y recién ahí abre el formulario, el origen sigue siendo Instagram.",
    links: "Links directos",
    linksAyuda1:
      "Para mandar por WhatsApp, poner en el bio de Instagram o usar como destino de una campaña. Agregá",
    linksAyuda2: "y aparece separado en Analytics.",
    todasLasAreas: "Todas las áreas",
  },

  // ---------------------------------------------------------- mi cuenta
  cuenta: {
    titulo: "Mi cuenta",
    bajada: "Tus datos de acceso al panel. No tienen nada que ver con los del estudio.",
    okNombre: "Guardamos tu nombre.",
    okClave: "Contraseña cambiada. Se cerraron las sesiones abiertas en otros dispositivos.",
    claveMal: "La contraseña actual no es correcta.",
    cambiarClave: "Cambiar la contraseña",
    ponerClave: "Poner una contraseña",
    sinClaveAyuda:
      "Entrás con Google y todavía no tenés contraseña. Si ponés una, vas a poder entrar de las dos formas.",
    claveActual: "Contraseña actual",
    claveNueva: "Contraseña nueva",
    repetila: "Repetila",
    guardar: "Guardar",
    clavePie: "Al menos 10 caracteres. Al cambiarla se cierran las sesiones abiertas en otros dispositivos.",
    tusDatos: "Tus datos",
    nombre: "Nombre",
    comoTeLlamas: "Cómo te llamás",
    email: "Email",
    emailAyuda: "Es con el que entrás y no se puede cambiar desde acá.",
    tipoCuenta: "Tipo de cuenta",
    tipoAgencia: "agencia (ve todos los estudios)",
    tipoEstudio: "estudio",
    desde: "Desde",
  },

  // ---------------------------------------------------------- equipo
  equipo: {
    titulo: "Equipo",
    bajada: (estudio: string) =>
      `Quién puede ver las consultas de ${estudio}. El acceso es solo por invitación: no hay registro abierto.`,
    conAcceso: "Con acceso",
    persona: "Persona",
    rol: "Rol",
    ultimoIngreso: "Último ingreso",
    administra: "Administra",
    veConsultas: "Ve consultas",
    nunca: "nunca",
    quitar: "Quitar",
    pendientes: "Invitaciones pendientes",
    vence: "vence",
    cancelar: "Cancelar",
    invitar: "Invitar",
    email: "Email",
    emailEjemplo: "socio@estudio.com.ar",
    rolMiembro: "Ve las consultas",
    rolDuenio: "Administra el equipo",
    enviarInvitacion: "Enviar invitación",
    invitarPie:
      "Le llega un mail con un link que vence en 7 días. Puede entrar con Google o creando una contraseña.",
    mailAsunto: (estudio: string) => `Te invitaron al panel de ${estudio}`,
    mailHola: "Hola,",
    mailCuerpo: (quien: string, estudio: string) =>
      `<strong>${quien}</strong> te dio acceso al panel de consultas de <strong>${estudio}</strong>. Ahí ves las consultas que entran, quién dejó el formulario a medias y de dónde viene cada una.`,
    mailBoton: "Activar mi acceso",
    mailVence: "El link vence en 7 días.",
  },

  // ---------------------------------------------------------- areas y casos
  areas: {
    titulo: "Áreas y formularios",
    bajada1: "Cada",
    bajada2: "área de práctica",
    bajada3:
      "agrupa los casos que atiende el estudio, y cada caso tiene su propio formulario. La persona elige su área, después su caso, y responde solo las preguntas de ese caso.",
    verPublica: "Ver página pública",
    sinAreas:
      "Todavía no hay áreas cargadas. Empezá por una: «Derecho Laboral», «Familia», lo que atienda el estudio.",
    unCaso: "caso",
    variosCasos: "casos",
    unaConsulta: "consulta",
    variasConsultas: "consultas",
    desactivada: "Desactivada",
    areaNueva: "Área nueva",
    ejemploArea: "Derecho Laboral",
    crearArea: "Crear área",

    volverAreas: "← Áreas",
    detalleBajada: "Los casos que atiende esta área. Cada uno tiene su propio formulario, con las preguntas que correspondan.",
    verArea: "Ver esta área",
    casos: "Casos",
    sinCasos: "Todavía no hay casos. Agregá el primero: «Despido sin causa», «Divorcio», lo que corresponda.",
    caso: "Caso",
    pasos: "Pasos",
    consultas: "Consultas",
    desactivado: "Desactivado",
    borrar: "Borrar",
    ejemploCaso: "Despido sin causa",
    nombreDelCaso: "Nombre del caso",
    agregarCaso: "Agregar caso",
    ajustesArea: "Ajustes del área",
    nombre: "Nombre",
    color: "Color",
    activa: "Activa",
    visiblePublica: "Visible en la página pública",
    guardar: "Guardar",
    borrarArea: "Borrar el área",
    borrarAreaAyuda: "Se borran sus casos y formularios. Las consultas ya recibidas se conservan.",

    editarBajada:
      "Las preguntas de este caso. El primer paso pide el contacto: es lo que permite escribirle a quien abandone el formulario a mitad de camino.",
    terminaron: (enviadas: number, visitas: number) => `${enviadas} de ${visitas} visitas terminaron`,
  },

  // ---------------------------------------------------------- editor de formularios
  editor: {
    paso: (n: number) => `Paso ${n}`,
    subirPaso: "Subir el paso",
    bajarPaso: "Bajar el paso",
    borrarPaso: "Borrar paso",
    borrarElPaso: "Borrar el paso",
    tituloCampo: "Título",
    ejemploTitulo: "Sobre tu trabajo",
    aclaracion: "Aclaración (opcional)",
    ejemploAclaracion: "Una línea que ayude a responder",
    pregunta: "Pregunta",
    ejemploPregunta: "¿Cuánto tiempo trabajaste ahí?",
    tipo: "Tipo",
    subirPregunta: "Subir la pregunta",
    bajarPregunta: "Bajar la pregunta",
    borrarPregunta: "Borrar la pregunta",
    opciones: "Opciones",
    opcionN: (n: number) => `Opción ${n}`,
    borrarOpcion: "Borrar la opción",
    agregarOpcion: "+ Agregar opción",
    obligatoria: "Obligatoria",
    claveTitulo: "Con este nombre se guarda la respuesta",
    clave: "clave:",
    agregarPregunta: "+ Agregar pregunta",
    agregarPaso: "+ Agregar paso",
    agregarCoordinacion: "+ Agregar paso de coordinación",
    revisaEsto: "Revisá esto antes de guardar:",
    guardando: "Guardando…",
    guardarFormulario: "Guardar formulario",
    verComoQueda: "Ver cómo queda",
    guardado: "Guardado",
    noSePudo: "No se pudo guardar.",
    noSeEncontro: "No se encontró el formulario.",

    tipos: {
      text: "Texto corto",
      textarea: "Texto largo",
      email: "Email",
      tel: "Teléfono",
      date: "Fecha",
      select: "Lista desplegable",
      radio: "Opciones (una sola)",
      checkbox: "Casilla de confirmación",
    },

    valAlMenosUnPaso: "El formulario necesita al menos un paso.",
    valSinTitulo: (n: number) => `El paso ${n} no tiene título.`,
    valSinPreguntas: (n: number) => `El paso ${n} no tiene ninguna pregunta.`,
    valPreguntaSinTexto: (n: number) => `Hay una pregunta sin texto en el paso ${n}.`,
    valSinClave: (label: string) => `La pregunta "${label}" no tiene clave.`,
    valClaveRepetida: (clave: string) =>
      `La clave "${clave}" está repetida: cada pregunta necesita una distinta.`,
    valSinOpciones: (label: string) => `"${label}" es una lista de opciones pero no tiene ninguna cargada.`,
    valFaltaEmail:
      'Falta una pregunta de email con la clave "email". Sin eso no se puede contactar a quien abandone el formulario.',
    valEmailPasoUno:
      "El email tiene que estar en el primer paso. Si se pide más adelante, quien abandone antes de llegar ahí se pierde.",
  },

  // ---------------------------------------------------------- componentes sueltos
  comp: {
    rango7: "7 días",
    rango30: "30 días",
    rango90: "90 días",
    rangoTodo: "Todo",

    subidaNoConfigurada:
      "La subida de archivos no está configurada en este servidor. Podés pegar la dirección de un archivo hospedado en otro lado.",
    faltaNombre: "Falta el nombre del archivo.",
    tieneQueSer: (que: string) => `Tiene que ser ${que}.`,
    queVideo: "un video mp4, webm o mov",
    queImagen: "una imagen png, jpg, webp o svg",
    pesaDemasiado: (mb: number, como: string) => `El archivo no puede pesar más de ${mb} MB. ${como}`,
    adelgazarVideo: "Bajale la calidad o recortalo: 15 a 20 segundos alcanzan.",
    adelgazarImagen: "Achicala antes de subirla: 1600 píxeles de ancho sobran para cualquier pantalla.",
    subirVideo: "Subir un video",
    videoSubido: "Video subido.",
    pegarVideo: "…o pegá la dirección de un video",
    subirImagen: "Subir una imagen",
    imagenSubida: "Imagen subida.",
    pegarImagen: "…o pegá la dirección de una imagen",
    subiendo: (pct: number) => `Subiendo… ${pct}%`,
    noEmpezo: "No se pudo empezar la subida.",
    noSubio: "No se pudo subir.",
    seCorto: "Se cortó la conexión durante la subida.",
    respondio: (estado: number) => `Supabase respondió ${estado}`,
    hastaMb: (mb: number) => `Hasta ${mb} MB.`,

    puestaEnMarcha: "Puesta en marcha",
    puestaBajada: "Lo que falta para que el estudio empiece a recibir consultas.",
    deTotal: (hechos: number, total: number) => `${hechos} de ${total}`,

    pasoMarca: "Ponerle la marca del estudio",
    pasoMarcaDet: "Logo, color y el texto de privacidad que ve la persona antes de escribir.",
    pasoMarcaAcc: "Cargar",
    pasoAreas: "Cargar las áreas de práctica",
    pasoAreasDet: "Los temas que atiende el estudio: laboral, familia, sucesiones.",
    pasoAreasAcc: "Cargar áreas",
    pasoFormularios: "Armar los formularios",
    pasoFormulariosDet: "Un caso concreto por área, con sus preguntas propias.",
    pasoFormulariosAcc: "Armar",
    pasoInstalar: "Instalarlo en el sitio del estudio",
    pasoInstalarDet: "Un pop-up o un clip, con una línea de código.",
    pasoInstalarAcc: "Crear un pop-up",
    pasoEquipo: "Dar acceso al estudio",
    pasoEquipoDet: "Invitar a quien va a atender las consultas.",
    pasoEquipoAcc: "Invitar",
    pasoPrimera: "Recibir la primera consulta real",
    pasoPrimeraDet: "Probá el formulario vos mismo para ver el circuito completo.",
    pasoPrimeraAcc: "Probar el formulario",
  },

  // ---------------------------------------------------------- entrar
  auth: {
    panelDeConsultas: "Panel de consultas",
    email: "Email",
    contrasena: "Contraseña",
    entrar: "Entrar",
    entrarConGoogle: "Entrar con Google",
    o: "o",
    olvidaste: "¿Olvidaste tu contraseña?",
    loginPie:
      "El acceso es por invitación. Si tu estudio trabaja con nosotros y todavía no entrás, escribinos y te damos de alta.",
    verDiagnostico: "Ver el diagnóstico",
    freno: (min: number) =>
      `Demasiados intentos fallidos. Probá de nuevo en ${min} ${min === 1 ? "minuto" : "minutos"}.`,
    errores: {
      cred: "Email o contraseña incorrectos.",
      state: "La sesión de Google expiró. Probá de nuevo.",
      google: "No pudimos conectar con Google. Probá de nuevo en un minuto.",
      google_off: "El acceso con Google no está configurado en este servidor.",
      email_no_verificado: "Tu cuenta de Google no tiene el email verificado.",
      sin_invitacion: "Ese email no tiene acceso. Pedile una invitación al estudio.",
      db: "No se pudo conectar con la base de datos. Abrí /api/health para ver qué está fallando.",
      cambiada: "Listo, ya podés entrar con tu contraseña nueva.",
    } as Record<string, string>,

    // recuperar la contraseña
    recuperarAcceso: "Recuperar el acceso",
    mandameLink: "Mandame el link",
    recuperarPie: "Te llega un mail con un link para elegir una contraseña nueva.",
    recuperarListo: "Si ese email tiene una cuenta, ya le mandamos un link para elegir una contraseña nueva.",
    recuperarListoPie: "Vence en una hora. Si no te llega, mirá en spam o pedile al estudio que te vuelva a invitar.",
    volver: "← Volver",
    elegiClave: "Elegí tu contraseña",
    linkUsado: "Este link ya se usó o venció.",
    linkUsadoPie: "Los links valen una hora. Pedí uno nuevo y usalo apenas te llegue.",
    pedirLinkNuevo: "Pedir un link nuevo",
    claveNueva: "Contraseña nueva",
    repetila: "Repetila",
    guardar: "Guardar",
    para: "Para",
    clavePie: "Al menos 10 caracteres. Se cierran las sesiones que tengas abiertas en otros dispositivos.",
    claveCorta: "La contraseña tiene que tener al menos 10 caracteres.",
    clavesDistintas: "Las dos contraseñas no coinciden.",

    // invitacion
    invitacionVencida: "Esta invitación venció o ya fue usada. Pedile una nueva al estudio.",
    teInvitaron: "Te invitaron al panel",
    vasAEntrarComo: "Vas a entrar como",
    tuNombre: "Tu nombre",
    crearMiAcceso: "Crear mi acceso",
    googlePie: "Un click y listo. No tenés que inventar ninguna contraseña.",
    prefieroClave: "Prefiero entrar con una contraseña",

    // sin estudio asociado
    sinAcceso: "Sin acceso",
    sinAccesoCuerpo:
      "Tu cuenta existe pero todavía no está asociada a ningún estudio. Pedile a quien te invitó que te dé acceso, o escribinos.",
    cerrarSesion: "Cerrar sesión",

    // mail de recuperacion
    resetAsunto: "Recuperar el acceso al panel",
    resetHola: (nombre: string) => `Hola${nombre ? ` ${nombre}` : ""},`,
    resetCuerpo:
      "Pediste volver a entrar al panel. Este link te deja elegir una contraseña nueva y <strong>vence en una hora</strong>.",
    resetBoton: "Elegir una contraseña nueva",
    resetNoFuiste:
      "Si no lo pediste vos, no hace falta que hagas nada: tu contraseña actual sigue funcionando y este link se vence solo.",
    resetPie: "Si no pediste recuperar el acceso, ignorá este mail.",
  },
};

const en: typeof es = {
  nav: {
    inicio: "Home",
    consultas: "Requests",
    analytics: "Analytics",
    areas: "Practice areas & forms",
    popups: "Pop-ups",
    clips: "Clips",
    instalacion: "Install",
    cuenta: "My account",
    ajustes: "Firm settings",
    equipo: "Team",
    estudios: "Firms",
    base: "Database",
    agencia: "Agency",
    salir: "Sign out",
    cambiarEstudio: "Switch firm",
  },

  panel: {
    visitas: "Form visits",
    empezaron: (n) => `${n} started filling it in`,
    consultasEnviadas: "Requests sent",
    sinLeerN: (n) => `${n} unread`,
    conversion: "Conversion rate",
    sobreVisitas: "Requests out of visits",
    abandonos: "Recoverable drop-offs",
    dejaronMail: "Left an email and didn't finish",
    visitasYConsultas: "Visits and requests",
    paraRecuperar: "Worth following up",
    sinAbandonos: "No abandoned forms.",
    verTodos: "See all",
    paginaPublica: "Public request page:",
    seFueEnPaso: (n) => `left at step ${n}`,

    consultas: "Requests",
    resumenConsultas: (sinLeer, aband) =>
      `${sinLeer} unread · ${aband} abandoned forms with an email.`,
    enviadas: "Sent",
    abandonadas: "Abandoned",
    nadaAca: "Nothing here yet.",
    persona: "Person",
    area: "Practice area",
    caso: "Case",
    enviada: "Sent",
    ultimaActividad: "Last activity",
    estado: "Status",
    seFueEn: "Left at",
    anonimo: "Anonymous",
    leida: "Read",
    nueva: "New",
    pasoN: (n) => `Step ${n}`,
    recordatorioEnviado: "Reminder sent",
    enviarRecordatorio: "Send a reminder",

    completa: "Complete",
    incompleta: "Incomplete",
    respuestas: "Answers",
    noRespondioNada: "They didn't answer anything.",
    contacto: "Contact",
    telefono: "Phone",
    aceptoContacto: "Agreed to be contacted?",
    si: "Yes",
    no: "No",
    origen: "Source",
    campanaCol: "Campaign",
    entroPor: "Came in through",
    paginaCol: "Page",
    primeraVisita: "First visit",
    volverConsultas: "← Requests",
    enviadaHace: (cuando) => `sent ${cuando}`,
    abandonadaEnPaso: (n) => `abandoned at step ${n}`,
    superficies: {
      page: "Request page",
      popup: "Pop-up",
      clip: "Video clip",
    },
  },

  stats: {
    analytics: "Analytics",
    analyticsBajada: "How many people reach the form, how many finish it, and where they drop off.",
    exportar: "Export to Excel",
    visitas: "Visits",
    empezaron: "Started",
    consultasEnviadas: "Requests sent",
    conversion: "Conversion",
    deLasVisitas: (p) => `${p}% of visits`,
    sobreVisitas: "Requests out of visits",
    visitasYConsultas: "Visits and requests",
    dondeSeCae: "Where people drop off",
    elegiFormulario: "Pick a form.",
    cadaBarra: "Each bar is how many people made it that far. The biggest drop is the step to rethink.",
    deDondeVienen: "Where they come from",
    sobreVisitasOrigen: "Requests out of visits, by source.",
    campanas: "Campaigns",
    campanasAyuda1: "Every request stores the",
    campanasAyuda2:
      "from the page where the form was opened, even when it's embedded in the firm's site. This is where you see which ads bring requests and not just clicks.",
    deTotal: (n, total) => `${n} of ${total}`,
    sinVisitas: "No visits in this period yet.",
    fuente: "Source",
    medio: "Medium",
    campana: "Campaign",
    consultas: "Requests",
    porArea: "By practice area",
    area: "Practice area",
    porDondeEntraron: "Where they came in",
    superficie: "Surface",
    conv: "Conv.",
    abrioFormulario: "Opened the form",
    pasoN: (n) => `Step ${n}`,
    superficies: {
      page: "Request page",
      popup: "Pop-up on the site",
      clip: "Video clip",
    },
    rangos: { "7d": "7 days", "30d": "30 days", "90d": "90 days", all: "All time" },
    sinDatos: "Not enough data for the chart yet.",
    grafico: "Visits and requests over time",
  },

  widgets: {
    popups: "Pop-ups",
    popupsBajada:
      "The form appearing over the firm's site. Each pop-up has its own code and its own numbers, so you can compare which one works.",
    clips: "Clips",
    clipsBajada:
      "A short video pinned to a corner of the site. Tapping it opens the form. It puts a face to the firm before anyone types a word.",
    sinPopups: "No pop-ups yet. Create the first one on the right.",
    sinClips: "No clips yet. Create the first one on the right.",
    activo: "Active",
    pausado: "Paused",
    seMostro: "shown",
    aperturas: "opened",
    consultas: "requests",
    abre: "open rate",
    convierte: "converts",
    resumen: (n, que) => `Out of every 100 people who saw this ${que}, ${n} left a request.`,
    unPopup: "pop-up",
    unClip: "clip",
    verComoQueda: "See how it looks",
    ajustes: "Settings",
    nombre: "Name",
    ejemploNombrePopup: "Home — exit",
    ejemploNombreClip: "Home — intro",
    cuandoAparece: "When it shows",
    disparadores: {
      "delay:12": "After 12 seconds",
      "delay:30": "After 30 seconds",
      "scroll:50": "Halfway down the page",
      exit: "When they're about to leave (exit intent)",
      now: "As soon as the page loads",
      button: "Floating button (never opens on its own)",
    },
    textoBoton: "Button text",
    ctaPopupDefecto: "Ask about your case",
    ctaClipDefecto: "Get started",
    video: "Video",
    portada: "Cover image (optional)",
    ayudaVideo: (mb) =>
      `Vertical, 15 to 20 seconds, up to ${mb} MB. The lighter it is, the sooner it starts playing on the firm's site.`,
    ayudaPortada: (mb) => `This is what shows while the video loads. Vertical, up to ${mb} MB.`,
    abreDirectoEn: "Opens straight into",
    todasLasAreas: "All practice areas (menu)",
    enQuePaginas: "Which pages does it show on?",
    ejemploPaginas: "Empty = the whole site\n/employment\n/services/*\n!/contact",
    ejemploPaginasCorto: "Empty = the whole site\n/employment\n!/contact",
    reglasAyuda: "One address per line.",
    reglasComodin: "matches anything",
    reglasExcluye: "A line starting with",
    reglasExcluye2: "excludes it",
    reglasVacio: "Leave it empty and it shows everywhere.",
    arrancaSolo: "Starts on its own, muted",
    arrancaAyuda:
      "This way the video is already playing when they land, which is the whole point. Only untick it if you'd rather it sat still with a play button.",
    activoCheck: "Active",
    guardar: "Save",
    borrar: "Delete",
    nuevoPopup: "New pop-up",
    nuevoClip: "New clip",
    crear: "Create",
    copiar: "Copy",
    copiado: "Copied",
    piePopup:
      "The snippet goes into the firm's site once. After that you can change the trigger or the text from here without touching it again.",
    pieClip:
      "Upload the video and we host it for you. Vertical and 15 to 20 seconds is what works best.",
    pieClipSinSubida:
      "Uploads aren't set up on this server: for now host the video wherever you like and paste the address here.",
  },

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
    si: "Yes",
    no: "No",

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

  excel: {
    hojaConsultas: "Requests",
    hojaCampanas: "Campaigns",
    archivo: "requests",
    fecha: "Date",
    estado: "Status",
    enviada: "Sent",
    abandonada: "Abandoned",
    nombre: "Name",
    email: "Email",
    telefono: "Phone",
    aceptaContacto: "Agreed to contact",
    si: "Yes",
    no: "No",
    area: "Practice area",
    caso: "Case type",
    origen: "Source",
    campana: "Campaign",
    medio: "Medium",
    contenido: "Content",
    entroPor: "Came in through",
    pasoAlcanzado: "Step reached",
    enviadaEl: "Sent on",
    recordatorioEnviado: "Reminder sent",
    paginaDondeSeAbrio: "Page it was opened on",
    fuente: "Source",
    visitas: "Visits",
    consultas: "Requests",
    conversionPct: "Conversion %",
    rangos: { "7d": "last 7 days", "30d": "last 30 days", "90d": "last 90 days", all: "all time" },
  },

  ajustes: {
    titulo: "Firm settings",
    bajada:
      "How the form looks and where the requests land. People see all of this before they type a word: it's what makes the form feel like the firm's and not like some app.",
    verPublica: "See the public page",
    guardado: "Saved",
    identidad: "Identity",
    nombreEstudio: "Firm name",
    direccionPublica: "Public address",
    slugAviso: "— change it and the old links stop working.",
    aDondeLlegan: "Where the requests land",
    ejemploNotify: "intake@firm.com",
    colorPrincipal: "Main color",
    idioma: "Form language",
    idiomaAyuda:
      "What language the form speaks to the firm's clients in, and what language their emails arrive in. It doesn't touch the questions you wrote: those stay exactly as you typed them.",
    logo: "Logo",
    logoAyuda: "Shown above the form. A transparent background (png or svg) looks best.",
    imagenPublica: "Public page image",
    imagenPublicaAyuda:
      "The large photo on the left. Landscape and good quality; without one you get the firm's color instead.",
    privacidad: "Privacy line",
    privacidadEjemplo: "Whatever you tell us is confidential and only the firm sees it.",
    guardar: "Save",
    dondeSeUsa: "Where each of these shows up",
    usoLogo: "Logo and color",
    usoLogoDet:
      "above the form, in the pop-up and in the email that reaches whoever abandons it halfway.",
    usoNotify: "Where the requests land",
    usoNotifyDet:
      "every completed form is sent to that address with the contact details and the source of the visit. Leave it empty and the request is still saved in the panel.",
    usoImagen: "Public page image",
    usoImagenDet: "the photo alongside the form at",
    usoIdioma: "Language",
    usoIdiomaDet:
      "the public form, the pop-up, the clip and the emails to the client. The panel follows it too, so you see what the firm sees.",
    usoPrivacidad: "Privacy line",
    usoPrivacidadDet:
      "the paragraph under the form. It's what takes the edge off handing over a phone number.",
  },

  embed: {
    titulo: "Install",
    bajada:
      "One line in the firm's site. The form lives inside an iframe, so it neither inherits nor breaks the page's styles.",
    popupTitulo: "Automatic pop-up",
    popupDesc:
      'Opens on its own after 12 seconds. You can also use data-trigger="scroll:50" (halfway down the page) or "exit" (when the cursor heads for the tab bar).',
    botonTitulo: "Floating button",
    botonDesc: "A fixed button in the bottom right of every page. The least intrusive of the three.",
    inlineTitulo: "Embedded form",
    inlineDesc: 'The form inside a section of the page. Put a <div id="consulta"></div> wherever you want it.',
    clipTitulo: "Video clip",
    clipDesc:
      "A short video pinned to a corner that opens the form when tapped. Host the mp4 wherever you like and pass the URL.",
    areaTitulo: "Straight into one practice area",
    areaDesc: "For a specific practice page: it skips the menu and opens that form directly.",
    atribucion: "Source attribution",
    atribucion1: "The widget reads the",
    atribucion2:
      "and the referrer from the firm's page and passes them to the form. From inside the iframe the referrer would be the firm's own site, so without this every request would show up as “referral”. It's stored on the first landing: if someone arrives from Instagram, browses three pages and only then opens the form, the source is still Instagram.",
    links: "Direct links",
    linksAyuda1:
      "To send over text, put in an Instagram bio or use as a campaign destination. Add",
    linksAyuda2: "and it shows up separately in Analytics.",
    todasLasAreas: "All practice areas",
  },

  cuenta: {
    titulo: "My account",
    bajada: "Your sign-in details for the panel. Nothing to do with the firm's own settings.",
    okNombre: "Your name is saved.",
    okClave: "Password changed. Sessions open on other devices were signed out.",
    claveMal: "That current password isn't right.",
    cambiarClave: "Change your password",
    ponerClave: "Set a password",
    sinClaveAyuda:
      "You sign in with Google and don't have a password yet. Set one and you'll be able to use either.",
    claveActual: "Current password",
    claveNueva: "New password",
    repetila: "Repeat it",
    guardar: "Save",
    clavePie: "At least 10 characters. Changing it signs out sessions open on other devices.",
    tusDatos: "Your details",
    nombre: "Name",
    comoTeLlamas: "What you go by",
    email: "Email",
    emailAyuda: "It's what you sign in with and can't be changed from here.",
    tipoCuenta: "Account type",
    tipoAgencia: "agency (sees every firm)",
    tipoEstudio: "firm",
    desde: "Member since",
  },

  equipo: {
    titulo: "Team",
    bajada: (estudio) =>
      `Who can see ${estudio}'s requests. Access is by invitation only — there's no open sign-up.`,
    conAcceso: "With access",
    persona: "Person",
    rol: "Role",
    ultimoIngreso: "Last sign-in",
    administra: "Administrator",
    veConsultas: "Sees requests",
    nunca: "never",
    quitar: "Remove",
    pendientes: "Pending invitations",
    vence: "expires",
    cancelar: "Cancel",
    invitar: "Invite",
    email: "Email",
    emailEjemplo: "partner@firm.com",
    rolMiembro: "Sees the requests",
    rolDuenio: "Administers the team",
    enviarInvitacion: "Send invitation",
    invitarPie:
      "They get an email with a link that expires in 7 days. They can sign in with Google or set a password.",
    mailAsunto: (estudio) => `You've been invited to ${estudio}'s panel`,
    mailHola: "Hi,",
    mailCuerpo: (quien, estudio) =>
      `<strong>${quien}</strong> gave you access to the request panel for <strong>${estudio}</strong>. That's where you see the requests coming in, who left the form half-finished and where each one came from.`,
    mailBoton: "Activate my access",
    mailVence: "The link expires in 7 days.",
  },

  areas: {
    titulo: "Practice areas & forms",
    bajada1: "Each",
    bajada2: "practice area",
    bajada3:
      "groups the case types the firm handles, and each case type has its own form. The person picks their area, then their case, and only answers the questions for that case.",
    verPublica: "See the public page",
    sinAreas:
      "No practice areas yet. Start with one: “Employment law”, “Family law”, whatever the firm handles.",
    unCaso: "case type",
    variosCasos: "case types",
    unaConsulta: "request",
    variasConsultas: "requests",
    desactivada: "Off",
    areaNueva: "New practice area",
    ejemploArea: "Employment law",
    crearArea: "Create area",

    volverAreas: "← Practice areas",
    detalleBajada: "The case types this area handles. Each one has its own form, with the questions that belong to it.",
    verArea: "See this area",
    casos: "Case types",
    sinCasos: "No case types yet. Add the first one: “Wrongful termination”, “Divorce”, whatever fits.",
    caso: "Case type",
    pasos: "Steps",
    consultas: "Requests",
    desactivado: "Off",
    borrar: "Delete",
    ejemploCaso: "Wrongful termination",
    nombreDelCaso: "Case type name",
    agregarCaso: "Add case type",
    ajustesArea: "Area settings",
    nombre: "Name",
    color: "Color",
    activa: "Active",
    visiblePublica: "Visible on the public page",
    guardar: "Save",
    borrarArea: "Delete this area",
    borrarAreaAyuda: "Its case types and forms go with it. Requests already received are kept.",

    editarBajada:
      "The questions for this case type. The first step asks for contact details: that's what lets you write to anyone who abandons the form halfway.",
    terminaron: (enviadas, visitas) => `${enviadas} of ${visitas} visits finished`,
  },

  editor: {
    paso: (n) => `Step ${n}`,
    subirPaso: "Move step up",
    bajarPaso: "Move step down",
    borrarPaso: "Delete step",
    borrarElPaso: "Delete the step",
    tituloCampo: "Title",
    ejemploTitulo: "About your job",
    aclaracion: "Note (optional)",
    ejemploAclaracion: "A line that helps them answer",
    pregunta: "Question",
    ejemploPregunta: "How long did you work there?",
    tipo: "Type",
    subirPregunta: "Move question up",
    bajarPregunta: "Move question down",
    borrarPregunta: "Delete the question",
    opciones: "Options",
    opcionN: (n) => `Option ${n}`,
    borrarOpcion: "Delete the option",
    agregarOpcion: "+ Add option",
    obligatoria: "Required",
    claveTitulo: "The answer is stored under this name",
    clave: "key:",
    agregarPregunta: "+ Add question",
    agregarPaso: "+ Add step",
    agregarCoordinacion: "+ Add the scheduling step",
    revisaEsto: "Check this before saving:",
    guardando: "Saving…",
    guardarFormulario: "Save form",
    verComoQueda: "See how it looks",
    guardado: "Saved",
    noSePudo: "Couldn't save.",
    noSeEncontro: "That form wasn't found.",

    tipos: {
      text: "Short text",
      textarea: "Long text",
      email: "Email",
      tel: "Phone",
      date: "Date",
      select: "Dropdown",
      radio: "Options (pick one)",
      checkbox: "Confirmation checkbox",
    },

    valAlMenosUnPaso: "The form needs at least one step.",
    valSinTitulo: (n) => `Step ${n} has no title.`,
    valSinPreguntas: (n) => `Step ${n} has no questions.`,
    valPreguntaSinTexto: (n) => `There's a question with no text in step ${n}.`,
    valSinClave: (label) => `The question "${label}" has no key.`,
    valClaveRepetida: (clave) => `The key "${clave}" is repeated: every question needs its own.`,
    valSinOpciones: (label) => `"${label}" is a list of options but doesn't have any.`,
    valFaltaEmail:
      'There’s no email question with the key "email". Without it you can’t reach anyone who abandons the form.',
    valEmailPasoUno:
      "The email has to be in the first step. If it comes later, anyone who leaves before reaching it is lost.",
  },

  comp: {
    rango7: "7 days",
    rango30: "30 days",
    rango90: "90 days",
    rangoTodo: "All time",

    subidaNoConfigurada:
      "File uploads aren't configured on this server. You can paste the address of a file hosted somewhere else.",
    faltaNombre: "The file name is missing.",
    tieneQueSer: (que) => `It has to be ${que}.`,
    queVideo: "an mp4, webm or mov video",
    queImagen: "a png, jpg, webp or svg image",
    pesaDemasiado: (mb, como) => `The file can't be larger than ${mb} MB. ${como}`,
    adelgazarVideo: "Lower the quality or trim it: 15 to 20 seconds is plenty.",
    adelgazarImagen: "Shrink it before uploading: 1600 pixels wide is plenty for any screen.",
    subirVideo: "Upload a video",
    videoSubido: "Video uploaded.",
    pegarVideo: "…or paste a video address",
    subirImagen: "Upload an image",
    imagenSubida: "Image uploaded.",
    pegarImagen: "…or paste an image address",
    subiendo: (pct) => `Uploading… ${pct}%`,
    noEmpezo: "Couldn't start the upload.",
    noSubio: "Couldn't upload.",
    seCorto: "The connection dropped during the upload.",
    respondio: (estado) => `Supabase answered ${estado}`,
    hastaMb: (mb) => `Up to ${mb} MB.`,

    puestaEnMarcha: "Getting set up",
    puestaBajada: "What's left before the firm starts receiving requests.",
    deTotal: (hechos, total) => `${hechos} of ${total}`,

    pasoMarca: "Add the firm's branding",
    pasoMarcaDet: "Logo, color and the privacy line people read before they type.",
    pasoMarcaAcc: "Set it up",
    pasoAreas: "Add the practice areas",
    pasoAreasDet: "What the firm handles: employment, family, estates.",
    pasoAreasAcc: "Add areas",
    pasoFormularios: "Build the forms",
    pasoFormulariosDet: "One concrete case type per area, with its own questions.",
    pasoFormulariosAcc: "Build",
    pasoInstalar: "Install it on the firm's site",
    pasoInstalarDet: "A pop-up or a clip, with one line of code.",
    pasoInstalarAcc: "Create a pop-up",
    pasoEquipo: "Give the firm access",
    pasoEquipoDet: "Invite whoever will handle the requests.",
    pasoEquipoAcc: "Invite",
    pasoPrimera: "Receive the first real request",
    pasoPrimeraDet: "Fill in the form yourself to see the whole loop.",
    pasoPrimeraAcc: "Try the form",
  },

  auth: {
    panelDeConsultas: "Request panel",
    email: "Email",
    contrasena: "Password",
    entrar: "Sign in",
    entrarConGoogle: "Sign in with Google",
    o: "or",
    olvidaste: "Forgot your password?",
    loginPie:
      "Access is by invitation. If your firm works with us and you still can't get in, write to us and we'll set you up.",
    verDiagnostico: "See the diagnostics",
    freno: (min) => `Too many failed attempts. Try again in ${min} ${min === 1 ? "minute" : "minutes"}.`,
    errores: {
      cred: "Wrong email or password.",
      state: "The Google session expired. Try again.",
      google: "We couldn't reach Google. Try again in a minute.",
      google_off: "Signing in with Google isn't configured on this server.",
      email_no_verificado: "Your Google account doesn't have a verified email.",
      sin_invitacion: "That email doesn't have access. Ask the firm for an invitation.",
      db: "Couldn't connect to the database. Open /api/health to see what's failing.",
      cambiada: "All set — you can sign in with your new password.",
    },

    recuperarAcceso: "Recover access",
    mandameLink: "Send me the link",
    recuperarPie: "You'll get an email with a link to choose a new password.",
    recuperarListo: "If that email has an account, we've just sent it a link to choose a new password.",
    recuperarListoPie: "It expires in an hour. If it doesn't arrive, check spam or ask the firm to invite you again.",
    volver: "← Back",
    elegiClave: "Choose your password",
    linkUsado: "This link was already used, or it expired.",
    linkUsadoPie: "Links last an hour. Ask for a new one and use it as soon as it arrives.",
    pedirLinkNuevo: "Ask for a new link",
    claveNueva: "New password",
    repetila: "Repeat it",
    guardar: "Save",
    para: "For",
    clavePie: "At least 10 characters. Sessions open on your other devices will be signed out.",
    claveCorta: "The password has to be at least 10 characters.",
    clavesDistintas: "The two passwords don't match.",

    invitacionVencida: "This invitation expired or was already used. Ask the firm for a new one.",
    teInvitaron: "You've been invited to the panel",
    vasAEntrarComo: "You'll sign in as",
    tuNombre: "Your name",
    crearMiAcceso: "Create my access",
    googlePie: "One click and you're in. No password to invent.",
    prefieroClave: "I'd rather use a password",

    sinAcceso: "No access",
    sinAccesoCuerpo:
      "Your account exists but isn't linked to any firm yet. Ask whoever invited you to give you access, or write to us.",
    cerrarSesion: "Sign out",

    resetAsunto: "Recover access to the panel",
    resetHola: (nombre) => `Hi${nombre ? ` ${nombre}` : ""},`,
    resetCuerpo:
      "You asked to get back into the panel. This link lets you choose a new password and <strong>expires in an hour</strong>.",
    resetBoton: "Choose a new password",
    resetNoFuiste:
      "If it wasn't you, there's nothing to do: your current password still works and this link expires on its own.",
    resetPie: "If you didn't ask to recover access, ignore this email.",
  },

};

const TEXTOS = { es, en };

/**
 * Los textos del idioma pedido.
 *
 * Cae en castellano si llega cualquier otra cosa. Un idioma que no existe es un
 * error nuestro, pero el resultado no puede ser una pantalla en blanco: preferimos
 * que el estudio vea el panel en el idioma equivocado antes que no verlo.
 */
export const t = (lang: Lang) => TEXTOS[lang] ?? TEXTOS.es;
