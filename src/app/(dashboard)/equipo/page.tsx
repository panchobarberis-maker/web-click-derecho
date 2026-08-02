import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { createInvitation } from "@/lib/auth";
import { requireOwner } from "@/lib/tenancy";
import { sendMail } from "@/lib/mailer";
import { dentroDe, fmtLong, hace } from "@/lib/format";
import { baseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

async function invitar(formData: FormData) {
  "use server";

  // requireOwner vuelve a resolver el estudio y el rol contra la base: el
  // formulario no decide a qué estudio se invita.
  const { user, firm } = await requireOwner();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "member") === "owner" ? "owner" : "member";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return;

  const token = await createInvitation({ email, firmId: firm.id, role, invitedBy: user.id });
  const base = baseUrl();
  const link = `${base}/invite/${token}`;

  await sendMail({
    to: email,
    subject: `Te invitaron al panel de ${firm.name}`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;color:#2a2118;line-height:1.6">
        <p>Hola,</p>
        <p><strong>${user.name ?? user.email}</strong> te dio acceso al panel de consultas de
           <strong>${firm.name}</strong>. Ahí ves las consultas que entran, quién dejó el formulario
           a medias y de dónde viene cada una.</p>
        <p style="margin:1.75rem 0">
          <a href="${link}" style="background:#5a4630;color:#fff;padding:12px 28px;border-radius:99px;text-decoration:none;font-weight:500;display:inline-block">
            Activar mi acceso
          </a>
        </p>
        <p style="font-size:13px;color:#6b6478">El link vence en 7 días.</p>
      </div>`,
  });

  revalidatePath("/equipo");
}

async function quitar(formData: FormData) {
  "use server";
  const { user, firm } = await requireOwner();
  const userId = String(formData.get("userId"));

  // Sin esto, el único dueño puede sacarse a sí mismo y dejar el estudio huérfano.
  if (userId === user.id) return;

  await sql`delete from memberships where firm_id = ${firm.id} and user_id = ${userId}`;
  await sql`delete from auth_sessions where user_id = ${userId}`;
  revalidatePath("/equipo");
}

async function cancelar(formData: FormData) {
  "use server";
  const { firm } = await requireOwner();
  await sql`delete from invitations where id = ${String(formData.get("id"))} and firm_id = ${firm.id}`;
  revalidatePath("/equipo");
}

export default async function Equipo() {
  const { user, firm } = await requireOwner();

  const [miembros, pendientes] = await Promise.all([
    sql<{ id: string; name: string | null; email: string; role: string; last_login_at: Date | null }[]>`
      select u.id, u.name, u.email, m.role, u.last_login_at
      from memberships m join users u on u.id = m.user_id
      where m.firm_id = ${firm.id}
      order by m.role, u.email`,
    sql<{ id: string; email: string; role: string; expires_at: Date }[]>`
      select id, email, role, expires_at from invitations
      where firm_id = ${firm.id} and accepted_at is null and expires_at > now()
      order by created_at desc`,
  ]);

  return (
    <>
      <div className="head">
        <div>
          <h1>Equipo</h1>
          <p>
            Quién puede ver las consultas de {firm.name}. El acceso es solo por invitación: no hay registro
            abierto.
          </p>
        </div>
      </div>

      <div className="grid cols-2-1">
        <div className="card">
          <h3>Con acceso</h3>
          <table>
            <thead>
              <tr>
                <th>Persona</th>
                <th>Rol</th>
                <th>Último ingreso</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {miembros.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.name ?? "—"}
                    <div className="muted" style={{ fontSize: ".8rem" }}>{m.email}</div>
                  </td>
                  <td>{m.role === "owner" ? "Administra" : "Ve consultas"}</td>
                  <td title={m.last_login_at ? fmtLong(m.last_login_at) : ""}>
                    {m.last_login_at ? hace(m.last_login_at) : <span className="muted">nunca</span>}
                  </td>
                  <td className="num">
                    {m.id !== user.id && (
                      <form action={quitar}>
                        <input type="hidden" name="userId" value={m.id} />
                        <button type="submit" className="btn ghost" style={{ padding: ".35rem .9rem", fontSize: ".8rem" }}>
                          Quitar
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {pendientes.length > 0 && (
            <>
              <h3 style={{ marginTop: "2rem" }}>Invitaciones pendientes</h3>
              <table>
                <tbody>
                  {pendientes.map((i) => (
                    <tr key={i.id}>
                      <td>{i.email}</td>
                      <td className="muted">vence {dentroDe(i.expires_at)}</td>
                      <td className="num">
                        <form action={cancelar}>
                          <input type="hidden" name="id" value={i.id} />
                          <button type="submit" className="btn ghost" style={{ padding: ".35rem .9rem", fontSize: ".8rem" }}>
                            Cancelar
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div className="card">
          <h3>Invitar</h3>
          <form action={invitar}>
            <label htmlFor="email" style={{ display: "block", fontSize: ".86rem", fontWeight: 500, marginBottom: ".45rem" }}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="socio@estudio.com.ar"
              style={{
                width: "100%", padding: ".7rem .85rem", marginBottom: "1rem",
                border: "1px solid #ded5c6", borderRadius: 10, fontFamily: "inherit", fontSize: ".92rem",
              }}
            />

            <label htmlFor="role" style={{ display: "block", fontSize: ".86rem", fontWeight: 500, marginBottom: ".45rem" }}>
              Rol
            </label>
            <select
              id="role"
              name="role"
              defaultValue="member"
              style={{
                width: "100%", padding: ".7rem .85rem", marginBottom: "1.25rem",
                border: "1px solid #ded5c6", borderRadius: 10, fontFamily: "inherit", fontSize: ".92rem", background: "#fff",
              }}
            >
              <option value="member">Ve las consultas</option>
              <option value="owner">Administra el equipo</option>
            </select>

            <button type="submit" className="btn" style={{ width: "100%" }}>Enviar invitación</button>
          </form>

          <p className="muted" style={{ fontSize: ".8rem", marginTop: "1rem", lineHeight: 1.55 }}>
            Le llega un mail con un link que vence en 7 días. Puede entrar con Google o creando una
            contraseña.
          </p>
        </div>
      </div>
    </>
  );
}
