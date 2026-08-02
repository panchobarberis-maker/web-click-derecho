import Link from "next/link";
import { sql } from "@/lib/db";
import "./home.css";

export const dynamic = "force-dynamic";

/**
 * Home publica de Click Derecho.
 *
 * Los nombres de la cinta salen de la tabla de estudios, no de una lista
 * escrita a mano: poner nombres inventados en una pagina de venta es decir que
 * tenemos clientes que no tenemos, y una lista a mano se desactualiza el dia
 * que entra el segundo cliente.
 */
async function estudios(): Promise<string[]> {
  try {
    const filas = await sql<{ name: string }[]>`select name from firms order by created_at`;
    return filas.map((f) => f.name);
  } catch {
    // Una home que no abre porque la base no responde es peor que una home sin
    // la cinta: esto es lo primero que ve alguien que nos esta evaluando.
    return [];
  }
}

const PASOS = [
  {
    t: "Elegimos las preguntas",
    d: "Con vos armamos un formulario por tipo de caso. El que consulta por un despido no responde lo mismo que el que consulta por una sucesión.",
  },
  {
    t: "Se instala en tu sitio",
    d: "Una línea de código y listo. Puede ser una página propia, un pop-up sobre tu web o un video corto en una esquina.",
  },
  {
    t: "Las consultas te llegan por mail",
    d: "Con el nombre, el teléfono, el tipo de caso, la urgencia, cómo prefiere que lo contactes y de qué campaña vino.",
  },
];

const LO_QUE_HACE = [
  {
    t: "Recupera al que abandona",
    d: "El formulario pide el mail en el primer paso y guarda cada respuesta a medida que la escriben. Al que se va por la mitad le llega un recordatorio para retomar donde dejó. Ese es el grueso de lo que hoy se pierde.",
  },
  {
    t: "Te dice qué campaña trae casos",
    d: "Cada consulta guarda de dónde vino, incluso con el formulario embebido en tu sitio. No clics: consultas. Así sabés qué pauta sostener y cuál cortar.",
  },
  {
    t: "Muestra en qué paso se caen",
    d: "Si el 60% abandona cuando le pedís la fecha exacta del despido, esa pregunta se cambia. Sin esto es adivinar.",
  },
  {
    t: "Ordena la atención",
    d: "Cada consulta llega con su urgencia y si ya consultó con otro abogado. Sabés a quién llamar primero y detectás un conflicto antes de sentarte a escuchar el caso.",
  },
];

const PREGUNTAS = [
  {
    q: "¿Reemplaza mi sitio web?",
    r: "No. Se suma al que ya tenés. El formulario puede vivir en una página propia con tu logo y tus colores, o aparecer sobre tu sitio actual como pop-up. Tu web queda igual.",
  },
  {
    q: "¿Qué pasa con la confidencialidad de las consultas?",
    r: "Cada estudio ve únicamente lo suyo: los datos están separados por estudio y verificamos que no haya forma de leer las consultas de otro. El formulario avisa antes de empezar que lo que se escribe es confidencial, y pide consentimiento explícito para contactar.",
  },
  {
    q: "¿Necesito saber de tecnología?",
    r: "No. Nosotros dejamos todo armado. Después, si querés cambiar una pregunta o el texto de un pop-up, lo hacés desde el panel sin tocar código.",
  },
  {
    q: "¿Cuánto tarda en estar funcionando?",
    r: "Un día. Lo más largo es decidir qué preguntas hacer en cada tipo de caso, y eso lo resolvemos en una reunión.",
  },
];

export default async function Home() {
  const firmas = await estudios();

  return (
    <div className="home">
      <header className="home-top">
        <Link href="/" className="home-marca">Click Derecho</Link>

        <nav className="home-links">
          <a href="#como">Cómo funciona</a>
          <a href="#que-hace">Qué hace</a>
          <a href="#preguntas">Preguntas</a>
        </nav>

        <div className="home-acceso">
          <Link href="/login" className="home-btn claro">Ingresar</Link>
          <a href="mailto:hola@clickderecho.com?subject=Quiero%20ver%20una%20demo" className="home-btn">
            Pedir una demo
          </a>
        </div>
      </header>

      <section className="home-hero">
        <h1>Dejá de perder las consultas que <em>ya pagaste</em>.</h1>
        <p className="bajada">
          Tu pauta trae gente a tu web. Un formulario de contacto común pierde a casi todos: los que no
          lo terminan no dejan rastro, y de los que sí, nunca sabés de qué campaña vinieron.
          Click Derecho arregla las dos cosas.
        </p>
        <div className="home-cta">
          <a href="mailto:hola@clickderecho.com?subject=Quiero%20ver%20una%20demo" className="home-btn">
            Pedir una demo
          </a>
          <a href="#como" className="home-btn claro">Ver cómo funciona</a>
        </div>
      </section>

      <Cinta nombres={firmas} />

      <section className="home-seccion" id="que-hace">
        <h2>Un formulario de contacto no alcanza</h2>
        <p className="intro">
          El formulario de &ldquo;nombre, mail y mensaje&rdquo; que trae cualquier web es un buzón. No sabe
          quién se fue a la mitad, no sabe de dónde vino nadie, y le pide al que consulta que resuma en
          un renglón algo que no sabe cómo resumir.
        </p>

        <div className="home-grid dos">
          {LO_QUE_HACE.map((f) => (
            <div className="home-card" key={f.t}>
              <h3>{f.t}</h3>
              <p>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="home-seccion arena" id="como">
        <div className="adentro">
          <h2>Cómo funciona</h2>
          <p className="intro">Lo dejamos andando nosotros. Vos recibís las consultas.</p>

          <div className="home-grid tres">
            {PASOS.map((p, i) => (
              <div className="home-card" key={p.t}>
                <span className="paso">{i + 1}</span>
                <h3>{p.t}</h3>
                <p>{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-seccion">
        <h2>Lo que ve el estudio</h2>
        <p className="intro">
          Un panel con las consultas que entraron, cuántas se completaron y de dónde vinieron. Nada de
          exportar planillas.
        </p>

        <div className="home-numeros">
          <div>
            <strong>Consultas</strong>
            <span>Cada una con su contacto, su caso y su origen</span>
          </div>
          <div>
            <strong>Abandonos</strong>
            <span>Quiénes empezaron y no terminaron, para recuperarlos</span>
          </div>
          <div>
            <strong>Campañas</strong>
            <span>Qué pauta trae consultas y a qué costo</span>
          </div>
        </div>
      </section>

      <section className="home-seccion arena" id="preguntas">
        <div className="adentro">
          <h2>Preguntas</h2>
          <div className="home-faq">
            {PREGUNTAS.map((p) => (
              <details key={p.q}>
                <summary>{p.q}</summary>
                <p>{p.r}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="home-cierre">
        <h2>Veamos cuántas consultas estás perdiendo</h2>
        <p className="intro">
          Una reunión de veinte minutos. Miramos tu sitio y tu pauta actual, y te decimos qué se puede
          recuperar antes de que contrates nada.
        </p>
        <div className="home-cta">
          <a href="mailto:hola@clickderecho.com?subject=Quiero%20ver%20una%20demo" className="home-btn">
            Pedir una demo
          </a>
        </div>
      </section>

      <footer className="home-pie">
        <span>© {new Date().getFullYear()} Click Derecho</span>
        <span>
          <a href="mailto:hola@clickderecho.com">hola@clickderecho.com</a> · <Link href="/login">Ingresar</Link>
        </span>
      </footer>
    </div>
  );
}

/**
 * Cinta de estudios que corre de izquierda a derecha.
 *
 * La lista va duplicada y la animacion recorre exactamente la mitad del ancho,
 * asi el salto del final al principio cae en un punto identico y no se ve el
 * corte. Con pocos estudios se repite mas veces para que la cinta llene el
 * ancho de la pantalla en vez de quedar un hueco girando.
 */
function Cinta({ nombres }: { nombres: string[] }) {
  if (nombres.length === 0) return null;

  const veces = Math.max(2, Math.ceil(8 / nombres.length));
  const grupo = Array.from({ length: veces }, () => nombres).flat();

  return (
    <section className="home-cinta">
      <p className="rotulo">Estudios que ya trabajan con Click Derecho</p>
      <div className="cinta-marco">
        <div className="cinta-pista">
          {[0, 1].map((copia) => (
            <div className="cinta-grupo" key={copia} aria-hidden={copia === 1}>
              {grupo.map((n, i) => (
                <span key={`${copia}-${i}`}>{n}</span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
