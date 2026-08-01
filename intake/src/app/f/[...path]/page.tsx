import Link from "next/link";
import { notFound } from "next/navigation";
import { sql, type Firm, type Funnel, type Workflow } from "@/lib/db";
import { FormRunner } from "@/components/FormRunner";
import { ViewTracker } from "@/components/ViewTracker";

export const dynamic = "force-dynamic";

type Params = { path: string[] };
type Search = { [k: string]: string | undefined };

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
    const funnels = await sql<(Funnel & { n: number })[]>`
      select f.*, count(w.id) as n
      from funnels f left join workflows w on w.funnel_id = f.id and w.active
      where f.firm_id = ${firm.id} and f.active and f.on_storefront
      group by f.id order by f.sort_order`;

    return (
      <div className="fwrap" style={accent}>
        <ViewTracker firmSlug={firm.slug} surface={qs.surface} />
        <div className="fhead">
          <div className="eyebrow">{firm.name}</div>
          <h1>¿En qué te podemos ayudar?</h1>
          <p>Elegí el tema de tu consulta. Son unas pocas preguntas y un abogado del estudio la revisa.</p>
        </div>
        <div className="fgrid">
          {funnels.map((f) => (
            <Link key={f.id} className="fopt" href={`/f/${firm.slug}/${f.slug}`}>
              <span>
                {f.name}
                <small>{Number(f.n)} {Number(f.n) === 1 ? "tipo de caso" : "tipos de caso"}</small>
              </span>
              <span className="arrow">→</span>
            </Link>
          ))}
        </div>
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
      <div className="fwrap" style={accent}>
        <ViewTracker firmSlug={firm.slug} funnelId={funnel.id} surface={qs.surface} />
        <Link className="fback" href={`/f/${firm.slug}`}>← Volver</Link>
        <div className="fhead">
          <div className="eyebrow">{funnel.name}</div>
          <h1>¿Cuál es tu situación?</h1>
          <p>Elegí la opción más parecida a tu caso. Así te preguntamos solo lo que hace falta.</p>
        </div>
        <div className="fgrid">
          {workflows.map((w) => (
            <Link key={w.id} className="fopt" href={`/f/${firm.slug}/${funnel.slug}/${w.slug}`}>
              <span>{w.name}</span>
              <span className="arrow">→</span>
            </Link>
          ))}
        </div>
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
