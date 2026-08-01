import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { sql } from "@/lib/db";
import { createSession, currentUser, fakeVerify, verifyPassword } from "@/lib/auth";
import { googleEnabled } from "@/lib/google";
import "./login.css";

export const dynamic = "force-dynamic";

const ERRORES: Record<string, string> = {
  cred: "Email o contraseña incorrectos.",
  state: "La sesión de Google expiró. Probá de nuevo.",
  google: "No pudimos conectar con Google. Probá de nuevo en un minuto.",
  google_off: "El acceso con Google no está configurado en este servidor.",
  email_no_verificado: "Tu cuenta de Google no tiene el email verificado.",
  sin_invitacion: "Ese email no tiene acceso. Pedile una invitación al estudio.",
};

async function login(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/login?e=cred");

  const [user] = await sql<{ id: string; password_hash: string | null }[]>`
    select id, password_hash from users where lower(email) = ${email}`;

  // El usuario inexistente también paga el costo del hash: si no, el tiempo de
  // respuesta delata qué emails están registrados.
  if (!user) {
    await fakeVerify();
    redirect("/login?e=cred");
  }
  if (!(await verifyPassword(password, user.password_hash))) redirect("/login?e=cred");

  await createSession(user.id, (await headers()).get("user-agent"));
  redirect("/");
}

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (await currentUser()) redirect("/");
  const error = ERRORES[(await searchParams).e ?? ""];

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          Click Derecho
          <small>Panel de consultas</small>
        </div>

        {error && <p className="auth-error">{error}</p>}

        {googleEnabled() && (
          <>
            <a className="auth-google" href="/api/auth/google">
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.5h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.6z" />
                <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3z" />
                <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
              </svg>
              Entrar con Google
            </a>
            <div className="auth-or"><span>o</span></div>
          </>
        )}

        <form action={login}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required autoFocus />

          <label htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />

          <button type="submit">Entrar</button>
        </form>

        <p className="auth-foot">
          El acceso es por invitación. Si tu estudio trabaja con nosotros y todavía no entrás,
          escribinos y te damos de alta.
        </p>
      </div>
    </div>
  );
}
