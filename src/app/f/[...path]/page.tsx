import Link from "next/link";
import { notFound } from "next/navigation";
import { sql, type Firm, type Funnel, type Workflow } from "@/lib/db";
import { FormRunner } from "@/components/FormRunner";
import { ViewTracker } from "@/components/ViewTracker";
import { sobreElColor } from "@/lib/color";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type Params = { path: string[] };
type Search = { [k: string]: string | undefined };

/**
 * Conserva los parametros al navegar entre las pantallas del formulario.
 *
 * El widget pone en la URL del iframe de donde viene la visita —surface, sid,
 * los utm_, el referrer y la pagina madre— y hasta ahora un click en un area
 * los tiraba: la pantalla siguiente arrancaba sin contexto. Se sostenia porque
 * la sesion ya estaba abierta y guardada en el navegador, pero cualquier cosa
 * que bloquee el almacenamiento local rompia la atribucion en silencio.
 *
 * `retomar` no se propaga a proposito: es de un solo uso, para volver desde el
 * link del mail, y arrastrarlo reabriria la misma sesion en cada pantalla.
 */
function conParams(href: string, search: Search): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(search)) {
    if (v && k !== "retomar") q.set(k, v);
  }
  const cola = q.toString();
  return cola ? `${href}?${cola}` : href;
}

/**
 * Landing partida: foto a la izquierda, contenido del estudio a la derecha.
 *
 * Dentro de un widget la foto no va: en el pop-up se comeria un cuarto del
 * ancho. Se decide por la superficie y no por el ancho de la ventana —antes
 * dependia de una media query de 900px y el panel del pop-up mide 920, asi que
 * la foto aparecia igual—.
 */
function Landing({
  firm,
  embebido,
  children,
  back,
}: {
  firm: Firm;
  embebido?: boolean;
  children: React.ReactNode;
  back?: React.ReactNode;
}) {
  return (
    <div className={embebido ? "land embebido" : "land"}>
      <div className="land-hero" style={firm.hero_url ? { backgroundImage: `url(${firm.hero_url})` } : undefined} />

      {/* Sin la foto lateral el pop-up quedaba todo blanco. La banda le pone el
          color del estudio y ademas dice de quien es el formulario, que es lo
          que hacia la foto. */}
      {embebido && (
        <div className="land-banda">
          <span className="land-banda-marca">{firm.name}</span>
        </div>
      )}

      <div className="land-body">
        {!embebido && firm.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="land-logo" src={firm.logo_url} alt={firm.name} />
        ) : null}
        <div className="land-inner">
          {back}
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Los pasos del formulario, con la misma banda que la portada.
 *
 * Sin esto el pop-up arrancaba con el color del estudio y al tocar un area se
 * volvia blanco, como si hubiera cambiado de sitio.
 */
function Paso({
  firm,
  embebido,
  accent,
  children,
}: {
  firm: Firm;
  embebido?: boolean;
  accent: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div style={accent}>
      {embebido && (
        <div className="land-banda">
          <span className="land-banda-marca">{firm.name}</span>
        </div>
      )}
      <div className="fwrap">{children}</div>
    </div>
  );
}

export default async function PublicForm({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { path } = await params;
  const qs = await searchParams;
  const [firmSlug, funnelSlug, workflowSlug] = path;

  const [firm] = await sql<Firm[]>`select * from firms where slug = ${firmSlug}`;
  if (!firm) notFound();

  const accent = {
    "--accent": firm.accent,
    "--sobre-acento": sobreElColor(firm.accent),
  } as React.CSSProperties;

  // Sin surface es la pagina suelta que abre la gente por su cuenta; con
  // surface viene dentro de un pop-up, un clip o un bloque embebido.
  const embebido = Boolean(qs.surface) && qs.surface !== "page";
  const x = t(firm.lang).form;

  // Nivel 1: elegir area de practica.
  if (!funnelSlug) {
    const funnels = await sql<Funnel[]>`
      select f.* from funnels f
      where f.firm_id = ${firm.id} and f.active and f.on_storefront
      order by f.sort_order`;

    return (
      <div style={accent}>
        <ViewTracker firmSlug={firm.slug} search={qs} />
        <Landing firm={firm} embebido={embebido}>
          {/* El nombre del estudio ya lo dice la banda cuando esta embebido. */}
          {!embebido && <p className="land-marca">{firm.name}</p>}
          <h1 className="land-title">{x.comoAyudar}</h1>
          <p className="land-ask">{x.contanos}</p>
          <div className="land-pills">
            {funnels.map((f) => (
              <Link key={f.id} className="pill-btn" href={conParams(`/f/${firm.slug}/${f.slug}`, qs)}>
                {f.name}
              </Link>
            ))}
          </div>
          {/* La privacidad va despues de las opciones: es lo que tranquiliza al
              que duda, no lo primero que hay que leer para empezar. */}
          {firm.intro && <p className="land-intro">{firm.intro}</p>}
        </Landing>
      </div>
    );
  }

  const [funnel] = await sql<Funnel[]>`
    select * from funnels where firm_id = ${firm.id} and slug = ${funnelSlug} and active`;
  if (!funnel) notFound();

  // Nivel 2: elegir el caso concreto.
  if (!workflowSlug) {
    const workflows = await sql<Workflow[]>`
      select * from workflows where funnel_id = ${funnel.id} and active order by sort_order`;

    // Con un solo caso no tiene sentido hacer elegir: se muestra el form directo.
    if (workflows.length === 1) {
      return (
        <Paso firm={firm} embebido={embebido} accent={accent}>
          <FormRunner firm={firm} funnel={funnel} workflow={workflows[0]} search={qs} />
        </Paso>
      );
    }

    return (
      <div style={accent}>
        <ViewTracker firmSlug={firm.slug} funnelId={funnel.id} search={qs} />
        <Landing
          firm={firm}
          embebido={embebido}
          back={
            <Link className="fback" href={conParams(`/f/${firm.slug}`, qs)}>
              {x.volver}
            </Link>
          }
        >
          <p className="land-eyebrow">{funnel.name}</p>
          <h1 className="land-title sm">{x.cualSituacion}</h1>
          <p className="land-ask">{x.elegiParecida}</p>
          <div className="land-pills">
            {workflows.map((w) => (
              <Link key={w.id} className="pill-btn" href={conParams(`/f/${firm.slug}/${funnel.slug}/${w.slug}`, qs)}>
                {w.name}
              </Link>
            ))}
          </div>
        </Landing>
      </div>
    );
  }

  // Nivel 3: el formulario.
  const [workflow] = await sql<Workflow[]>`
    select * from workflows where funnel_id = ${funnel.id} and slug = ${workflowSlug} and active`;
  if (!workflow) notFound();

  return (
    <Paso firm={firm} embebido={embebido} accent={accent}>
      <FormRunner firm={firm} funnel={funnel} workflow={workflow} search={qs} />
    </Paso>
  );
}
