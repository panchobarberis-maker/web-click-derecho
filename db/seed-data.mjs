// Datos de ejemplo. Cada estudio define sus propias areas y sus propios forms:
// esto es solo una plantilla para arrancar, no un esquema fijo.

// Paso 1 siempre pide contacto. Es lo que habilita recuperar los abandonos:
// si el visitante deja el mail y se va en el paso 3, igual lo podemos contactar.
const contacto = {
  title: "¿Con quién hablamos?",
  subtitle: "Con esto ya podemos abrir la consulta y contactarte.",
  fields: [
    { key: "first_name", label: "Nombre", type: "text", required: true },
    { key: "last_name", label: "Apellido", type: "text", required: true },
    { key: "email", label: "Email", type: "email", required: true },
    { key: "phone", label: "Teléfono / WhatsApp", type: "tel", required: false },
    // Opt-in explicito. No bloquea el envio: responder la consulta ya esta
    // cubierto por la finalidad con la que dejo el dato.
    {
      key: "consent",
      label: "Quiero que me contacten por email y WhatsApp sobre mi consulta",
      type: "checkbox",
      required: false,
    },
  ],
};

// Ultimo paso de todos los formularios. Va al final y no en el paso 1 a
// proposito: son preguntas de coordinacion, y meterlas al principio alarga el
// paso que decide si la persona empieza o se va.
//
// La urgencia y el "ya tenes abogado" no son burocracia: son lo que le permite
// al estudio decidir a quien llama primero y detectar un conflicto de interes
// antes de sentarse a escuchar el caso.
const coordinar = {
  title: "Para coordinar",
  subtitle: "Lo último: cómo y cuándo te viene bien que te contactemos.",
  fields: [
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

// Empleado o empleador cambia todo: el encuadre, los plazos y hasta si el
// estudio toma el caso. Va en los formularios laborales.
const rolLaboral = {
  key: "rol",
  label: "¿Consultás como...?",
  type: "radio",
  required: true,
  options: ["Empleado/a", "Empleador/a o empresa"],
};

export const firm = {
  name: "Alzogaray & Serrano",
  slug: "alzogaray-serrano",
  notify_email: "consultas@alzogarayserrano.com.ar",
  accent: "#8a6f4e",
  logo_url: null,
  // Imagen propia por defecto: el estudio la reemplaza por la suya.
  hero_url: "/hero-default.svg",
  intro:
    "Tu privacidad nos importa. Todo lo que compartas en este formulario es estrictamente confidencial y se usa únicamente para evaluar tu caso. Nunca compartimos tu información con terceros sin tu consentimiento.",
};

const AREAS = [
  {
    name: "Derecho Laboral",
    slug: "laboral",
    color: "#c9a227",
    workflows: [
      {
        name: "Despido sin causa",
        slug: "despido-sin-causa",
        steps: [
          contacto,
          {
            title: "Sobre tu trabajo",
            fields: [
              rolLaboral,
              { key: "empresa", label: "Empresa donde trabajabas", type: "text", required: true },
              {
                key: "antiguedad",
                label: "Antigüedad",
                type: "select",
                required: true,
                options: ["Menos de 3 meses", "3 a 12 meses", "1 a 3 años", "3 a 10 años", "Más de 10 años"],
              },
              { key: "sueldo", label: "Último sueldo bruto aproximado", type: "text", required: false },
            ],
          },
          {
            title: "Sobre el despido",
            fields: [
              { key: "fecha_despido", label: "Fecha del despido", type: "date", required: true },
              {
                key: "registrado",
                label: "¿Estabas registrado (en blanco)?",
                type: "radio",
                required: true,
                options: ["Sí, todo en blanco", "Parcialmente en negro", "Todo en negro", "No sé"],
              },
              {
                key: "telegrama",
                label: "¿Recibiste telegrama de despido?",
                type: "radio",
                required: true,
                options: ["Sí", "No", "No sé"],
              },
            ],
          },
          {
            title: "Contanos el caso",
            fields: [
              { key: "detalle", label: "¿Qué pasó?", type: "textarea", required: false },
              {
                key: "hace_cuanto",
                label: "¿Hace cuánto ocurrió?",
                type: "select",
                required: true,
                options: ["Esta semana", "Este mes", "Hace 2 a 6 meses", "Hace más de 6 meses", "Hace más de 2 años"],
              },
            ],
          },
        ],
      },
      {
        name: "Trabajo no registrado (en negro)",
        slug: "trabajo-no-registrado",
        steps: [
          contacto,
          {
            title: "Sobre la relación laboral",
            fields: [
              rolLaboral,
              { key: "empresa", label: "Empresa o empleador", type: "text", required: true },
              { key: "tarea", label: "¿Qué tareas hacías?", type: "text", required: true },
              {
                key: "antiguedad",
                label: "¿Cuánto tiempo trabajaste ahí?",
                type: "select",
                required: true,
                options: ["Menos de 6 meses", "6 a 12 meses", "1 a 3 años", "Más de 3 años"],
              },
            ],
          },
          {
            title: "Pruebas",
            fields: [
              {
                key: "pruebas",
                label: "¿Con qué contás?",
                type: "select",
                required: true,
                options: ["Recibos o transferencias", "Mensajes de WhatsApp", "Testigos", "Nada por ahora"],
              },
              { key: "vinculo_actual", label: "¿Seguís trabajando ahí?", type: "radio", required: true, options: ["Sí", "No"] },
            ],
          },
        ],
      },
      {
        name: "Accidente de trabajo / ART",
        slug: "accidente-laboral",
        steps: [
          contacto,
          {
            title: "El accidente",
            fields: [
              { key: "fecha", label: "Fecha del accidente", type: "date", required: true },
              { key: "lesion", label: "¿Qué lesión tuviste?", type: "text", required: true },
              { key: "denuncia_art", label: "¿Se denunció a la ART?", type: "radio", required: true, options: ["Sí", "No", "No sé"] },
            ],
          },
          {
            title: "Estado actual",
            fields: [
              { key: "alta", label: "¿Te dieron el alta médica?", type: "radio", required: true, options: ["Sí", "No", "Todavía en tratamiento"] },
              { key: "secuelas", label: "¿Te quedaron secuelas?", type: "textarea", required: false },
            ],
          },
        ],
      },
      // Sin esto, el que tiene un tema laboral que no entra en los tres de
      // arriba —licencias, acoso, diferencias salariales, un convenio— cierra
      // la pagina y se pierde. Es la consulta mas barata de capturar.
      {
        name: "Otro tema laboral",
        slug: "otro-tema-laboral",
        steps: [
          contacto,
          {
            title: "Contanos tu situación",
            fields: [
              rolLaboral,
              {
                key: "tema",
                label: "¿De qué se trata?",
                type: "select",
                required: true,
                options: [
                  "Licencias o vacaciones",
                  "Acoso o maltrato laboral",
                  "Diferencias salariales",
                  "Cambio de tareas u horario",
                  "Renuncia o acuerdo de desvinculación",
                  "Encuadre en el convenio",
                  "Otro",
                ],
              },
              { key: "empresa", label: "Empresa o empleador", type: "text", required: false },
              { key: "detalle", label: "Contanos qué pasó", type: "textarea", required: true },
              { key: "vinculo_actual", label: "¿Seguís trabajando ahí?", type: "radio", required: true, options: ["Sí", "No"] },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Accidentes de Tránsito",
    slug: "accidentes-transito",
    color: "#b05c3c",
    workflows: [
      {
        name: "Choque con lesiones",
        slug: "choque-con-lesiones",
        steps: [
          contacto,
          {
            title: "El siniestro",
            fields: [
              { key: "fecha", label: "Fecha del accidente", type: "date", required: true },
              {
                key: "rol",
                label: "¿Vos qué eras?",
                type: "radio",
                required: true,
                options: ["Conductor", "Acompañante", "Peatón", "Ciclista o motociclista"],
              },
              { key: "lugar", label: "¿Dónde ocurrió?", type: "text", required: false },
            ],
          },
          {
            title: "Lesiones y cobertura",
            fields: [
              { key: "lesiones", label: "¿Qué lesiones sufriste?", type: "textarea", required: true },
              { key: "hospital", label: "¿Te atendieron en un hospital?", type: "radio", required: true, options: ["Sí", "No"] },
              { key: "seguro_tercero", label: "¿El tercero tenía seguro?", type: "radio", required: true, options: ["Sí", "No", "No sé"] },
            ],
          },
          {
            title: "Último paso",
            fields: [
              { key: "denuncia_policial", label: "¿Hubo denuncia policial?", type: "radio", required: true, options: ["Sí", "No", "No sé"] },
              { key: "detalle", label: "Contanos brevemente qué pasó", type: "textarea", required: false },
            ],
          },
        ],
      },
      {
        name: "Daños materiales",
        slug: "danos-materiales",
        steps: [
          contacto,
          {
            title: "El siniestro",
            fields: [
              { key: "fecha", label: "Fecha del accidente", type: "date", required: true },
              { key: "vehiculo", label: "Vehículo dañado", type: "text", required: true },
              { key: "presupuesto", label: "¿Tenés presupuesto de reparación?", type: "radio", required: true, options: ["Sí", "No"] },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Familia",
    slug: "familia",
    color: "#4b7a68",
    workflows: [
      {
        name: "Divorcio",
        slug: "divorcio",
        steps: [
          contacto,
          {
            title: "Situación",
            fields: [
              { key: "acuerdo", label: "¿Hay acuerdo entre las partes?", type: "radio", required: true, options: ["Sí, de común acuerdo", "No", "No sé"] },
              { key: "hijos", label: "¿Tienen hijos menores?", type: "radio", required: true, options: ["Sí", "No"] },
              { key: "bienes", label: "¿Hay bienes a dividir?", type: "radio", required: true, options: ["Sí", "No", "No sé"] },
            ],
          },
        ],
      },
      {
        name: "Cuota alimentaria",
        slug: "cuota-alimentaria",
        steps: [
          contacto,
          {
            title: "Situación",
            fields: [
              { key: "rol", label: "¿Qué necesitás?", type: "radio", required: true, options: ["Reclamar una cuota", "Que me la reduzcan", "Ejecutar una cuota impaga"] },
              { key: "hijos_cantidad", label: "¿Cuántos hijos involucra?", type: "select", required: true, options: ["1", "2", "3 o más"] },
              { key: "cuota_actual", label: "¿Hay cuota fijada hoy?", type: "radio", required: true, options: ["Sí", "No"] },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Sucesiones",
    slug: "sucesiones",
    color: "#7a5c9e",
    workflows: [
      {
        name: "Iniciar una sucesión",
        slug: "iniciar-sucesion",
        steps: [
          contacto,
          {
            title: "Sobre la sucesión",
            fields: [
              { key: "vinculo", label: "Tu vínculo con el causante", type: "select", required: true, options: ["Hijo/a", "Cónyuge", "Hermano/a", "Otro"] },
              { key: "testamento", label: "¿Hay testamento?", type: "radio", required: true, options: ["Sí", "No", "No sé"] },
              { key: "bienes", label: "¿Qué bienes hay?", type: "textarea", required: false },
              { key: "herederos", label: "¿Cuántos herederos son?", type: "select", required: true, options: ["1", "2", "3", "4 o más"] },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Defensa del Consumidor",
    slug: "defensa-consumidor",
    color: "#3c6fb0",
    workflows: [
      {
        name: "Problema con banco o tarjeta",
        slug: "banco-tarjeta",
        steps: [
          contacto,
          {
            title: "El problema",
            fields: [
              { key: "entidad", label: "Banco o entidad", type: "text", required: true },
              { key: "problema", label: "¿Qué pasó?", type: "select", required: true, options: ["Consumos que no reconozco", "Estafa / phishing", "Cobros indebidos", "Reporte al Veraz", "Otro"] },
              { key: "monto", label: "Monto aproximado involucrado", type: "text", required: false },
              { key: "reclamo_previo", label: "¿Reclamaste a la entidad?", type: "radio", required: true, options: ["Sí", "No"] },
            ],
          },
        ],
      },
    ],
  },
];

/**
 * Todos los formularios terminan igual.
 *
 * El paso de coordinacion se agrega aca y no copiado en cada uno: son once
 * formularios, y once copias de lo mismo se desincronizan la primera vez que
 * alguien cambia una opcion.
 */
export const funnels = AREAS.map((area) => ({
  ...area,
  workflows: area.workflows.map((w) => ({ ...w, steps: [...w.steps, coordinar] })),
}));
