import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { sql } from "@/lib/db";
import {
  createSession, currentUser, esperaPorIntentos, fakeVerify,
  limpiarIntentos, registrarIntentoFallido, verifyPassword,
} from "@/lib/auth";
import { clientIp } from "@/lib/ip";
import { googleEnabled } from "@/lib/google";
import { langDeCabecera, t as textos } from "@/lib/i18n";
import "./login.css";

export const dynamic = "force-dynamic";

async function login(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/login?e=cred");

  const cabeceras = await headers();
  const ip = clientIp(cabeceras);

  // Si la base no responde, el server action moriria sin decir nada y el
  // boton pareceria no hacer nada. Preferimos mandar al login con un motivo.
  let user: { id: string; password_hash: string | null } | undefined;
  let espera = 0;
  try {
    espera = await esperaPorIntentos(email, ip);
    if (espera === 0) {
      [user] = await sql<{ id: string; password_hash: string | null }[]>`
        select id, password_hash from users where lower(email) = ${email}`;
    }
  } catch (e) {
    console.error("login: la base no respondió:", e);
    redirect("/login?e=db");
  }

  // Frenamos antes de verificar: cada intento cuesta ~100ms de scrypt, así que
  // sin esto una lista de contraseñas comunes se prueba sola.
  if (espera > 0) redirect(`/login?e=freno&m=${espera}`);

  // El usuario inexistente también paga el costo del hash: si no, el tiempo de
  // respuesta delata qué emails están registrados.
  if (!user) {
    await fakeVerify();
    await registrarIntentoFallido(email, ip);
    redirect("/login?e=cred");
  }
  if (!(await verifyPassword(password, user.password_hash))) {
    await registrarIntentoFallido(email, ip);
    redirect("/login?e=cred");
  }

  await limpiarIntentos(email, ip);
  await createSession(user.id, cabeceras.get("user-agent"));
  redirect("/panel");
}

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string; m?: string }> }) {
  if (await currentUser()) redirect("/panel");
  const { e, m } = await searchParams;

  // Antes de la sesion no hay estudio del cual sacar el idioma, asi que lo pide
  // el navegador.
  const x = textos(langDeCabecera((await headers()).get("accept-language"))).auth;
  const minutos = Math.max(1, Number(m) || 1);
  const error = e === "freno" ? x.freno(minutos) : x.errores[e ?? ""];

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          Right Lead
          <small>{x.panelDeConsultas}</small>
        </div>

        {error && (
          <p className={e === "cambiada" ? "auth-ok" : "auth-error"}>
            {error}
            {e === "db" && (
              <>
                {" "}
                <a href="/api/health" style={{ color: "inherit", fontWeight: 600 }}>{x.verDiagnostico}</a>
              </>
            )}
          </p>
        )}

        {googleEnabled() && (
          <>
            <a className="auth-google" href="/api/auth/google">
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.5h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.6z" />
                <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3z" />
                <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
              </svg>
              {x.entrarConGoogle}
            </a>
            <div className="auth-or"><span>{x.o}</span></div>
          </>
        )}

        <form action={login}>
          <label htmlFor="email">{x.email}</label>
          <input id="email" name="email" type="email" autoComplete="email" required autoFocus />

          <label htmlFor="password">{x.contrasena}</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />

          <button type="submit">{x.entrar}</button>
        </form>

        <p className="auth-link">
          <a href="/recuperar">{x.olvidaste}</a>
        </p>

        <p className="auth-foot">
          {x.loginPie}
        </p>
      </div>
    </div>
  );
}
