import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { sql } from "@/lib/db";
import { acceptInvitation, createSession, currentUser, findInvitation, hashPassword } from "@/lib/auth";
import { googleEnabled } from "@/lib/google";
import "../../login/login.css";

export const dynamic = "force-dynamic";

async function aceptar(formData: FormData) {
  "use server";

  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  const inv = await findInvitation(token);
  if (!inv) redirect("/login?e=sin_invitacion");
  if (password.length < 10) redirect(`/invite/${token}?e=corta`);

  const email = inv.email.toLowerCase();
  const hash = await hashPassword(password);

  // Si ya existía (invitado a otro estudio antes) sumamos la membresía;
  // no le pisamos la contraseña que ya tenía.
  const [user] = await sql<{ id: string }[]>`
    insert into users (email, name, password_hash)
    values (${email}, ${name || null}, ${hash})
    on conflict (lower(email)) do update set name = coalesce(users.name, excluded.name)
    returning id`;

  await acceptInvitation(inv, user.id);
  await createSession(user.id, (await headers()).get("user-agent"));
  redirect("/panel");
}

export default async function Invite({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { token } = await params;
  const inv = await findInvitation(token);
  if (!inv) {
    return (
      <div className="auth">
        <div className="auth-card">
          <div className="auth-brand">Click Derecho</div>
          <p className="auth-error">Esta invitación venció o ya fue usada. Pedile una nueva al estudio.</p>
        </div>
      </div>
    );
  }

  // Si ya está logueado con el mail invitado, aceptamos y listo.
  const user = await currentUser();
  if (user && user.email.toLowerCase() === inv.email.toLowerCase()) {
    await acceptInvitation(inv, user.id);
    redirect("/panel");
  }

  const corta = (await searchParams).e === "corta";

  function FormularioClave({ token }: { token: string }) {
    return (
      <form action={aceptar}>
        <input type="hidden" name="token" value={token} />

        <label htmlFor="name">Tu nombre</label>
        <input id="name" name="name" type="text" autoComplete="name" />

        <label htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />

        <button type="submit">Crear mi acceso</button>
      </form>
    );
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          {inv.firm_name}
          <small>Te invitaron al panel</small>
        </div>

        <p className="auth-hint">
          Vas a entrar como <strong>{inv.email}</strong>.
        </p>

        {corta && <p className="auth-error">La contraseña tiene que tener al menos 10 caracteres.</p>}

        {/*
          Con Google alcanza un click y no hay contraseña que recordar ni que
          perder. Por eso es el camino principal y la contraseña queda plegada:
          no la sacamos porque hay estudios sin cuenta de Google, pero pedirle
          a alguien que invente una contraseña cuando no hace falta es la forma
          mas facil de que abandone el alta.
        */}
        {googleEnabled() ? (
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
            <p className="auth-foot" style={{ marginTop: ".9rem" }}>
              Un click y listo. No tenés que inventar ninguna contraseña.
            </p>

            <details className="auth-alt">
              <summary>Prefiero entrar con una contraseña</summary>
              <FormularioClave token={token} />
            </details>
          </>
        ) : (
          <FormularioClave token={token} />
        )}
      </div>
    </div>
  );
}
