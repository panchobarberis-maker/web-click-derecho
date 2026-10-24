import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, type Funnel, type Step, type Workflow } from "@/lib/db";
import { activeFirm, requireOwner } from "@/lib/tenancy";
import { validarFormulario } from "@/lib/forms";
import { FormEditor } from "@/components/FormEditor";
import { t as textos } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function EditarCaso({
  params,
}: {
  params: Promise<{ funnel: string; caso: string }>;
}) {
  const { funnel: fSlug, caso: cSlug } = await params;
  const { firm } = await activeFirm();
  const x = textos(firm.lang).areas;

  const [funnel] = await sql<Funnel[]>`
    select * from funnels where firm_id = ${firm.id} and slug = ${fSlug}`;
  if (!funnel) notFound();

  const [caso] = await sql<Workflow[]>`
    select * from workflows where funnel_id = ${funnel.id} and slug = ${cSlug}`;
  if (!caso) notFound();

  const [stats] = await sql<{ visitas: number; enviadas: number }[]>`
    select count(*)::int as visitas,
           count(*) filter (where submitted_at is not null)::int as enviadas
    from sessions where workflow_id = ${caso.id}`;

  /**
   * Guarda los pasos. Vuelve a validar del lado del servidor: el editor ya
   * valida, pero el server action es una entrada más y no puede confiar en
   * que lo que llega pasó por ahí.
   */
  async function guardar(steps: Step[]): Promise<{ ok: boolean; problemas?: string[] }> {
    "use server";
    const { firm: f } = await requireOwner();

    const problemas = validarFormulario(steps, f.lang);
    if (problemas.length) return { ok: false, problemas };

    const r = await sql`
      update workflows w set steps = ${sql.json({ steps })}
      from funnels fu
      where w.id = ${caso.id} and w.funnel_id = fu.id and fu.firm_id = ${f.id}`;
    if (r.count === 0) return { ok: false, problemas: [textos(f.lang).editor.noSeEncontro] };

    revalidatePath(`/funnels/${fSlug}/${cSlug}`);
    return { ok: true };
  }

  return (
    <>
      <div className="head">
        <div>
          <Link href={`/funnels/${funnel.slug}`} className="muted" style={{ fontSize: ".88rem", textDecoration: "none" }}>
            ← {funnel.name}
          </Link>
          <h1 style={{ marginTop: ".5rem" }}>{caso.name}</h1>
          <p>{x.editarBajada}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="muted" style={{ fontSize: ".82rem" }}>
            {x.terminaron(stats.enviadas, stats.visitas)}
          </div>
        </div>
      </div>

      <FormEditor
        inicial={caso.steps?.steps ?? []}
        guardar={guardar}
        verUrl={`/f/${firm.slug}/${funnel.slug}/${caso.slug}`}
        lang={firm.lang}
      />
    </>
  );
}
