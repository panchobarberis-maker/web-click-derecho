import Link from "next/link";
import { notFound } from "next/navigation";
import { sql, type Firm, type Funnel, type Workflow } from "@/lib/db";
import { FormRunner } from "@/components/FormRunner";
import { ViewTracker } from "@/components/ViewTracker";

export const dynamic = "force-dynamic";

type Params = { path: string[] };
type Search = { [k: string]: string | undefined };

/**
 * Landing partida: foto a la izquierda, contenido del estudio a la derecha.
 * Dentro del iframe del pop-up la foto se oculta y queda solo la columna de
 * contenido, sin necesidad de una plantilla aparte.
 */
function Landing({
  firm,
  children,
  back,
}: {
  firm: Firm;
  children: React.ReactNode;
  back?: React.ReactNode;
}) {
  return (
    <div className="land">
      <div className="land-hero" style={firm.hero_url ? { backgroundImage: `url(${firm.hero_url})` } : undefined} />
      <div className="land-body">
        {firm.logo_url ? (
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

  const accent = { "--accent": firm.accent } as React.CSSProperties;

  // Nivel 1: elegir area de practica.
  if (!funnelSlug) {
    const funnels = await sql<Funnel[]>`
      select f.* from funnels f
      where f.firm_id = ${firm.id} and f.active and f.on_storefront
      order by f.sort_order`;

    return (
      <div style={accent}>
        <ViewTracker firmSlug={firm.slug} search={qs} />
        <Landing firm={firm}>
          <h1 className="land-title">{firm.name}</h1>
          {firm.intro && <p className="land-intro">{firm.intro}</p>}
          <p className="land-ask">Tocá la opción que mejor describa tu caso:</p>
          <div className="land-pills">
            {funnels.map((f) => (
              <Link key={f.id} className="pill-btn" href={`/f/${firm.slug}/${f.slug}`}>
                {f.name}
              </Link>
            ))}
          </div>
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
        <div className="fwrap" style={accent}>
          <FormRunner firm={firm} funnel={funnel} workflow={workflows[0]} search={qs} />
        </div>
      );
    }

    return (
      <div style={accent}>
        <ViewTracker firmSlug={firm.slug} funnelId={funnel.id} search={qs} />
        <Landing
          firm={firm}
          back={
            <Link className="fback" href={`/f/${firm.slug}`}>
              ← Volver
            </Link>
          }
        >
          <p className="land-eyebrow">{funnel.name}</p>
          <h1 className="land-title sm">¿Cuál es tu situación?</h1>
          <p className="land-ask">Elegí la opción más parecida a tu caso. Así te preguntamos solo lo que hace falta.</p>
          <div className="land-pills">
            {workflows.map((w) => (
              <Link key={w.id} className="pill-btn" href={`/f/${firm.slug}/${funnel.slug}/${w.slug}`}>
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
    <div className="fwrap" style={accent}>
      <FormRunner firm={firm} funnel={funnel} workflow={workflow} search={qs} />
    </div>
  );
}
