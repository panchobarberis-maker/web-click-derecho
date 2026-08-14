import { headers } from "next/headers";
import { langDeCabecera, t as textos } from "@/lib/i18n";
import "../login/login.css";

export default async function SinAcceso() {
  const x = textos(langDeCabecera((await headers()).get("accept-language"))).auth;

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          Right Lead
          <small>{x.sinAcceso}</small>
        </div>
        <p className="auth-hint">{x.sinAccesoCuerpo}</p>
        <form action="/api/auth/logout" method="post">
          <button type="submit">{x.cerrarSesion}</button>
        </form>
      </div>
    </div>
  );
}
