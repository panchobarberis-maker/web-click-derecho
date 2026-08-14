import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { activeFirm, requireOwner } from "@/lib/tenancy";
import { slugUrl } from "@/lib/forms";
import { t as textos } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const COLORES = ["#c9a227", "#b05c3c", "#4b7a68", "#7a5c9e", "#3c6fb0", "#8a6f4e"];

async function crearArea(formData: FormData) {
  "use server";
  const { firm } = await requireOwner();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  // El slug va en la URL pública, así que tiene que ser único dentro del estudio.
  const base = slugUrl(name);
  let slug = base;
  for (let i = 2; ; i++) {
    const [existe] = await sql`select 1 from funnels where firm_id = ${firm.id} and slug = ${slug}`;
    if (!existe) break;
    slug = `${base}-${i}`;
  }

  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from funnels where firm_id = ${firm.id}`;

  await sql`
    insert into funnels (firm_id, name, slug, color, sort_order)
    values (${firm.id}, ${name}, ${slug}, ${COLORES[n % COLORES.length]}, ${n})`;

  revalidatePath("/funnels");
  redirect(`/funnels/${slug}`);
}

type Row = {
  id: string;
  name: string;
  slug: string;
  color: string;
  active: boolean;
  formularios: number;
  consultas: number;
};

export default async function Funnels() {
  const { firm } = await activeFirm();
  const puedeEditar = firm.role !== "member";
  const x = textos(firm.lang).areas;

  const rows = await sql<Row[]>`
    select f.id, f.name, f.slug, f.color, f.active,
      (select count(*)::int from workflows w where w.funnel_id = f.id) as formularios,
      (select count(*)::int from sessions s where s.funnel_id = f.id and s.submitted_at is not null) as consultas
    from funnels f
    where f.firm_id = ${firm.id}
    order by f.sort_order, f.name`;

  return (
    <>
      <div className="head">
        <div>
          <h1>{x.titulo}</h1>
          <p>
            {x.bajada1} <strong>{x.bajada2}</strong> {x.bajada3}
          </p>
        </div>
        <Link href={`/f/${firm.slug}`} className="btn ghost" target="_blank">
          {x.verPublica}
        </Link>
      </div>

      {rows.length === 0 && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <p className="muted">{x.sinAreas}</p>
        </div>
      )}

      <div className="grid cols-3">
        {rows.map((f) => (
          <Link className="card area" key={f.id} href={`/funnels/${f.slug}`}>
            <span className="pill" style={{ background: `${f.color}1f`, color: f.color }}>{f.name}</span>
            <div className="area-datos">
              <span>{f.formularios} {f.formularios === 1 ? x.unCaso : x.variosCasos}</span>
              <span>{f.consultas} {f.consultas === 1 ? x.unaConsulta : x.variasConsultas}</span>
            </div>
            {!f.active && <span className="muted" style={{ fontSize: ".8rem" }}>{x.desactivada}</span>}
          </Link>
        ))}

        {puedeEditar && (
          <form action={crearArea} className="card nueva">
            <label htmlFor="name" className="lbl">{x.areaNueva}</label>
            <input id="name" name="name" placeholder={x.ejemploArea} required />
            <button type="submit" className="btn" style={{ marginTop: ".75rem" }}>{x.crearArea}</button>
          </form>
        )}
      </div>
    </>
  );
}
