import { redirect } from "next/navigation";
import { applyPasswordReset, findPasswordReset, revisarContrasena } from "@/lib/auth";
import "../../login/login.css";

export const dynamic = "force-dynamic";

async function cambiar(formData: FormData) {
  "use server";

  const token = String(formData.get("token") ?? "");

  // El token se vuelve a buscar acá: el server action es una entrada más y no
  // puede confiar en que la página ya lo validó.
  const reset = await findPasswordReset(token);
  if (!reset) redirect("/recuperar?vencido=1");

  const nueva = String(formData.get("password") ?? "");
  const problema = revisarContrasena(nueva, String(formData.get("password2") ?? ""));
  if (problema) redirect(`/recuperar/${token}?e=${encodeURIComponent(problema)}`);

  await applyPasswordReset(reset, nueva);

  // No lo dejamos entrar directo: que escriba la contraseña nueva una vez es
  // lo que hace que se la acuerde, y confirma que quedó donde él cree.
  redirect("/login?e=cambiada");
}

export default async function Elegir({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { token } = await params;
  const reset = await findPasswordReset(token);
  const error = (await searchParams).e;

  if (!reset) {
    return (
      <div className="auth">
        <div className="auth-card">
          <div className="auth-brand">
            Click Derecho
            <small>Recuperar el acceso</small>
          </div>
          <p className="auth-error">Este link ya se usó o venció.</p>
          <p className="auth-foot">Los links valen una hora. Pedí uno nuevo y usalo apenas te llegue.</p>
          <p className="auth-link"><a href="/recuperar">Pedir un link nuevo</a></p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          Click Derecho
          <small>Elegí tu contraseña</small>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <form action={cambiar}>
          <input type="hidden" name="token" value={token} />

          <label htmlFor="password">Contraseña nueva</label>
          <input id="password" name="password" type="password" autoComplete="new-password"
                 minLength={10} required autoFocus />

          <label htmlFor="password2">Repetila</label>
          <input id="password2" name="password2" type="password" autoComplete="new-password"
                 minLength={10} required />

          <button type="submit">Guardar</button>
        </form>

        <p className="auth-foot">
          Para <strong>{reset.email}</strong>. Al menos 10 caracteres. Se cierran las sesiones que
          tengas abiertas en otros dispositivos.
        </p>
      </div>
    </div>
  );
}
