import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { createPasswordReset, currentUser, esperaPorIntentos, registrarIntentoFallido } from "@/lib/auth";
import { resetEmail, sendMail } from "@/lib/mailer";
import { baseUrl } from "@/lib/base-url";
import { clientIp } from "@/lib/ip";
import "../login/login.css";

export const dynamic = "force-dynamic";

async function pedir(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/recuperar");

  const ip = clientIp(await headers());

  try {
    // El mismo freno que el login: mandar mails es más caro que fallar una
    // contraseña, y este formulario está abierto a cualquiera.
    if ((await esperaPorIntentos(email, ip)) === 0) {
      const [user] = await sql<{ id: string; name: string | null }[]>`
        select id, name from users where lower(email) = ${email}`;

      if (user) {
        const token = await createPasswordReset(user.id);
        const mail = resetEmail({ name: user.name, url: `${baseUrl()}/recuperar/${token}` });
        await sendMail({ to: email, subject: mail.subject, html: mail.html });
      }
      await registrarIntentoFallido(email, ip);
    }
  } catch (e) {
    console.error("recuperar: la base no respondió:", e);
    redirect("/login?e=db");
  }

  // La respuesta es siempre la misma exista o no la cuenta: si dijéramos "ese
  // email no está registrado", este formulario sería una forma cómoda de
  // averiguar qué direcciones tienen acceso al panel.
  redirect("/recuperar?listo=1");
}

export default async function Recuperar({ searchParams }: { searchParams: Promise<{ listo?: string }> }) {
  if (await currentUser()) redirect("/");
  const listo = (await searchParams).listo === "1";

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          Click Derecho
          <small>Recuperar el acceso</small>
        </div>

        {listo ? (
          <>
            <p className="auth-ok">
              Si ese email tiene una cuenta, ya le mandamos un link para elegir una contraseña nueva.
            </p>
            <p className="auth-foot">
              Vence en una hora. Si no te llega, mirá en spam o pedile al estudio que te vuelva a invitar.
            </p>
          </>
        ) : (
          <>
            <form action={pedir}>
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" required autoFocus />
              <button type="submit">Mandame el link</button>
            </form>
            <p className="auth-foot">Te llega un mail con un link para elegir una contraseña nueva.</p>
          </>
        )}

        <p className="auth-link">
          <a href="/login">← Volver</a>
        </p>
      </div>
    </div>
  );
}
