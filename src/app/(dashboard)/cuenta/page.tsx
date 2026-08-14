import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import {
  createSession, destroyAllSessions, hashPassword, revisarContrasena, verifyPassword,
} from "@/lib/auth";
import { activeFirm, requireUser } from "@/lib/tenancy";
import { fmtFecha } from "@/lib/format";
import { t as textos } from "@/lib/i18n";

export const dynamic = "force-dynamic";

async function guardarNombre(formData: FormData) {
  "use server";
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  await sql`update users set name = ${name || null} where id = ${user.id}`;
  revalidatePath("/", "layout");
  redirect("/cuenta?ok=nombre");
}

async function guardarContrasena(formData: FormData) {
  "use server";
  const user = await requireUser();
  const lang = (await activeFirm()).firm.lang;
  const x = textos(lang).cuenta;

  const [fila] = await sql<{ password_hash: string | null }[]>`
    select password_hash from users where id = ${user.id}`;

  // Quien entró con Google todavía no tiene contraseña: en ese caso no hay
  // "la actual" que pedir, está eligiendo la primera.
  if (fila?.password_hash) {
    const actual = String(formData.get("actual") ?? "");
    if (!(await verifyPassword(actual, fila.password_hash))) {
      redirect("/cuenta?e=" + encodeURIComponent(x.claveMal));
    }
  }

  const nueva = String(formData.get("password") ?? "");
  const problema = revisarContrasena(nueva, String(formData.get("password2") ?? ""), lang);
  if (problema) redirect("/cuenta?e=" + encodeURIComponent(problema));

  await sql`update users set password_hash = ${await hashPassword(nueva)} where id = ${user.id}`;

  // Se cierran todas las sesiones —incluida esta— y se abre una nueva acá. Si
  // la contraseña se cambia porque alguien más la sabía, ese alguien queda
  // afuera; y quien la cambió no tiene que volver a entrar.
  await destroyAllSessions(user.id);
  await createSession(user.id);

  redirect("/cuenta?ok=clave");
}

export default async function Cuenta({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const { ok, e } = await searchParams;
  const { user, firm } = await activeFirm();
  const x = textos(firm.lang).cuenta;
  const avisos: Record<string, string> = { nombre: x.okNombre, clave: x.okClave };

  const [fila] = await sql<{ password_hash: string | null; created_at: Date }[]>`
    select password_hash, created_at from users where id = ${user.id}`;
  const tieneClave = !!fila?.password_hash;

  return (
    <>
      <div className="head">
        <div>
          <h1>{x.titulo}</h1>
          <p>{x.bajada}</p>
        </div>
      </div>

      {ok && avisos[ok] && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <span className="pill good">{avisos[ok]}</span>
        </div>
      )}
      {e && (
        <div className="problemas" style={{ marginBottom: "1rem" }}>{e}</div>
      )}

      <div className="grid cols-2-1">
        <div className="card">
          <h3>{tieneClave ? x.cambiarClave : x.ponerClave}</h3>

          {!tieneClave && (
            <p className="muted" style={{ fontSize: ".86rem", marginBottom: ".5rem", lineHeight: 1.55 }}>
              {x.sinClaveAyuda}
            </p>
          )}

          <form action={guardarContrasena} className="ajustes">
            {tieneClave && (
              <>
                <label className="lbl" htmlFor="actual">{x.claveActual}</label>
                <input id="actual" name="actual" type="password" autoComplete="current-password" required />
              </>
            )}

            <label className="lbl" htmlFor="password">{x.claveNueva}</label>
            <input id="password" name="password" type="password" autoComplete="new-password"
                   minLength={10} required />

            <label className="lbl" htmlFor="password2">{x.repetila}</label>
            <input id="password2" name="password2" type="password" autoComplete="new-password"
                   minLength={10} required />

            <button type="submit" className="btn" style={{ width: "100%", marginTop: ".9rem" }}>
              {x.guardar}
            </button>
          </form>

          <p className="muted" style={{ fontSize: ".8rem", marginTop: "1rem", lineHeight: 1.55 }}>
            {x.clavePie}
          </p>
        </div>

        <div className="card">
          <h3>{x.tusDatos}</h3>
          <form action={guardarNombre} className="ajustes">
            <label className="lbl" htmlFor="name">{x.nombre}</label>
            <input id="name" name="name" defaultValue={user.name ?? ""} placeholder={x.comoTeLlamas} />
            <button type="submit" className="btn ghost" style={{ width: "100%", marginTop: ".9rem" }}>
              {x.guardar}
            </button>
          </form>

          <ul className="ayuda" style={{ marginTop: "1.5rem" }}>
            <li><strong>{x.email}</strong> — {user.email}. {x.emailAyuda}</li>
            <li><strong>{x.tipoCuenta}</strong> — {user.is_staff ? x.tipoAgencia : x.tipoEstudio}.</li>
            <li>
              <strong>{x.desde}</strong> —{" "}
              {fila?.created_at ? fmtFecha(fila.created_at, firm.lang) : "—"}.
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
