import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import {
  createSession, destroyAllSessions, hashPassword, revisarContrasena, verifyPassword,
} from "@/lib/auth";
import { requireUser } from "@/lib/tenancy";

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

  const [fila] = await sql<{ password_hash: string | null }[]>`
    select password_hash from users where id = ${user.id}`;

  // Quien entró con Google todavía no tiene contraseña: en ese caso no hay
  // "la actual" que pedir, está eligiendo la primera.
  if (fila?.password_hash) {
    const actual = String(formData.get("actual") ?? "");
    if (!(await verifyPassword(actual, fila.password_hash))) {
      redirect("/cuenta?e=" + encodeURIComponent("La contraseña actual no es correcta."));
    }
  }

  const nueva = String(formData.get("password") ?? "");
  const problema = revisarContrasena(nueva, String(formData.get("password2") ?? ""));
  if (problema) redirect("/cuenta?e=" + encodeURIComponent(problema));

  await sql`update users set password_hash = ${await hashPassword(nueva)} where id = ${user.id}`;

  // Se cierran todas las sesiones —incluida esta— y se abre una nueva acá. Si
  // la contraseña se cambia porque alguien más la sabía, ese alguien queda
  // afuera; y quien la cambió no tiene que volver a entrar.
  await destroyAllSessions(user.id);
  await createSession(user.id);

  redirect("/cuenta?ok=clave");
}

const AVISOS: Record<string, string> = {
  nombre: "Guardamos tu nombre.",
  clave: "Contraseña cambiada. Se cerraron las sesiones abiertas en otros dispositivos.",
};

export default async function Cuenta({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const { ok, e } = await searchParams;
  const user = await requireUser();

  const [fila] = await sql<{ password_hash: string | null; created_at: Date }[]>`
    select password_hash, created_at from users where id = ${user.id}`;
  const tieneClave = !!fila?.password_hash;

  return (
    <>
      <div className="head">
        <div>
          <h1>Mi cuenta</h1>
          <p>Tus datos de acceso al panel. No tienen nada que ver con los del estudio.</p>
        </div>
      </div>

      {ok && AVISOS[ok] && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <span className="pill good">{AVISOS[ok]}</span>
        </div>
      )}
      {e && (
        <div className="problemas" style={{ marginBottom: "1rem" }}>{e}</div>
      )}

      <div className="grid cols-2-1">
        <div className="card">
          <h3>{tieneClave ? "Cambiar la contraseña" : "Poner una contraseña"}</h3>

          {!tieneClave && (
            <p className="muted" style={{ fontSize: ".86rem", marginBottom: ".5rem", lineHeight: 1.55 }}>
              Entrás con Google y todavía no tenés contraseña. Si ponés una, vas a poder entrar de las
              dos formas.
            </p>
          )}

          <form action={guardarContrasena} className="ajustes">
            {tieneClave && (
              <>
                <label className="lbl" htmlFor="actual">Contraseña actual</label>
                <input id="actual" name="actual" type="password" autoComplete="current-password" required />
              </>
            )}

            <label className="lbl" htmlFor="password">Contraseña nueva</label>
            <input id="password" name="password" type="password" autoComplete="new-password"
                   minLength={10} required />

            <label className="lbl" htmlFor="password2">Repetila</label>
            <input id="password2" name="password2" type="password" autoComplete="new-password"
                   minLength={10} required />

            <button type="submit" className="btn" style={{ width: "100%", marginTop: ".9rem" }}>
              Guardar
            </button>
          </form>

          <p className="muted" style={{ fontSize: ".8rem", marginTop: "1rem", lineHeight: 1.55 }}>
            Al menos 10 caracteres. Al cambiarla se cierran las sesiones abiertas en otros dispositivos.
          </p>
        </div>

        <div className="card">
          <h3>Tus datos</h3>
          <form action={guardarNombre} className="ajustes">
            <label className="lbl" htmlFor="name">Nombre</label>
            <input id="name" name="name" defaultValue={user.name ?? ""} placeholder="Cómo te llamás" />
            <button type="submit" className="btn ghost" style={{ width: "100%", marginTop: ".9rem" }}>
              Guardar
            </button>
          </form>

          <ul className="ayuda" style={{ marginTop: "1.5rem" }}>
            <li><strong>Email</strong> — {user.email}. Es con el que entrás y no se puede cambiar desde acá.</li>
            <li><strong>Tipo de cuenta</strong> — {user.is_staff ? "agencia (ve todos los estudios)" : "estudio"}.</li>
            <li>
              <strong>Desde</strong> —{" "}
              {fila?.created_at ? new Date(fila.created_at).toLocaleDateString("es-AR") : "—"}.
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
