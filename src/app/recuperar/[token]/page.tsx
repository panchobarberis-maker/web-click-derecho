import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { applyPasswordReset, findPasswordReset, revisarContrasena } from "@/lib/auth";
import { langDeCabecera, t as textos } from "@/lib/i18n";
import "../../login/login.css";

export const dynamic = "force-dynamic";

async function cambiar(formData: FormData) {
  "use server";

  const lang = langDeCabecera((await headers()).get("accept-language"));
  const token = String(formData.get("token") ?? "");

  // El token se vuelve a buscar acá: el server action es una entrada más y no
  // puede confiar en que la página ya lo validó.
  const reset = await findPasswordReset(token);
  if (!reset) redirect("/recuperar?vencido=1");

  const nueva = String(formData.get("password") ?? "");
  const problema = revisarContrasena(nueva, String(formData.get("password2") ?? ""), lang);
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
  const x = textos(langDeCabecera((await headers()).get("accept-language"))).auth;

  if (!reset) {
    return (
      <div className="auth">
        <div className="auth-card">
          <div className="auth-brand">
            Right Lead
            <small>{x.recuperarAcceso}</small>
          </div>
          <p className="auth-error">{x.linkUsado}</p>
          <p className="auth-foot">{x.linkUsadoPie}</p>
          <p className="auth-link"><a href="/recuperar">{x.pedirLinkNuevo}</a></p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          Right Lead
          <small>{x.elegiClave}</small>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <form action={cambiar}>
          <input type="hidden" name="token" value={token} />

          <label htmlFor="password">{x.claveNueva}</label>
          <input id="password" name="password" type="password" autoComplete="new-password"
                 minLength={10} required autoFocus />

          <label htmlFor="password2">{x.repetila}</label>
          <input id="password2" name="password2" type="password" autoComplete="new-password"
                 minLength={10} required />

          <button type="submit">{x.guardar}</button>
        </form>

        <p className="auth-foot">
          {x.para} <strong>{reset.email}</strong>. {x.clavePie}
        </p>
      </div>
    </div>
  );
}
