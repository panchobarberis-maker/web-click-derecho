import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { createInvitation } from "@/lib/auth";
import { requireOwner } from "@/lib/tenancy";
import { sendMail } from "@/lib/mailer";
import { dentroDe, fmtLong, hace } from "@/lib/format";
import { baseUrl } from "@/lib/base-url";
import { t as textos } from "@/lib/i18n";

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
  const x = textos(firm.lang).equipo;

  await sendMail({
    to: email,
    subject: x.mailAsunto(firm.name),
    html: `
      <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;color:#2a2118;line-height:1.6">
        <p>${x.mailHola}</p>
        <p>${x.mailCuerpo(user.name ?? user.email, firm.name)}</p>
        <p style="margin:1.75rem 0">
          <a href="${link}" style="background:#5a4630;color:#fff;padding:12px 28px;border-radius:99px;text-decoration:none;font-weight:500;display:inline-block">
            ${x.mailBoton}
          </a>
        </p>
        <p style="font-size:13px;color:#6b6478">${x.mailVence}</p>
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
  const x = textos(firm.lang).equipo;
  const lang = firm.lang;

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
          <h1>{x.titulo}</h1>
          <p>{x.bajada(firm.name)}</p>
        </div>
      </div>

      <div className="grid cols-2-1">
        <div className="card">
          <h3>{x.conAcceso}</h3>
          <table>
            <thead>
              <tr>
                <th>{x.persona}</th>
                <th>{x.rol}</th>
                <th>{x.ultimoIngreso}</th>
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
                  <td>{m.role === "owner" ? x.administra : x.veConsultas}</td>
                  <td title={m.last_login_at ? fmtLong(m.last_login_at, lang) : ""}>
                    {m.last_login_at ? hace(m.last_login_at, lang) : <span className="muted">{x.nunca}</span>}
                  </td>
                  <td className="num">
                    {m.id !== user.id && (
                      <form action={quitar}>
                        <input type="hidden" name="userId" value={m.id} />
                        <button type="submit" className="btn ghost" style={{ padding: ".35rem .9rem", fontSize: ".8rem" }}>
                          {x.quitar}
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
              <h3 style={{ marginTop: "2rem" }}>{x.pendientes}</h3>
              <table>
                <tbody>
                  {pendientes.map((i) => (
                    <tr key={i.id}>
                      <td>{i.email}</td>
                      <td className="muted">{x.vence} {dentroDe(i.expires_at, lang)}</td>
                      <td className="num">
                        <form action={cancelar}>
                          <input type="hidden" name="id" value={i.id} />
                          <button type="submit" className="btn ghost" style={{ padding: ".35rem .9rem", fontSize: ".8rem" }}>
                            {x.cancelar}
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
          <h3>{x.invitar}</h3>
          <form action={invitar}>
            <label htmlFor="email" style={{ display: "block", fontSize: ".86rem", fontWeight: 500, marginBottom: ".45rem" }}>
              {x.email}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder={x.emailEjemplo}
              style={{
                width: "100%", padding: ".7rem .85rem", marginBottom: "1rem",
                border: "1px solid #ded5c6", borderRadius: 10, fontFamily: "inherit", fontSize: ".92rem",
              }}
            />

            <label htmlFor="role" style={{ display: "block", fontSize: ".86rem", fontWeight: 500, marginBottom: ".45rem" }}>
              {x.rol}
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
              <option value="member">{x.rolMiembro}</option>
              <option value="owner">{x.rolDuenio}</option>
            </select>

            <button type="submit" className="btn" style={{ width: "100%" }}>{x.enviarInvitacion}</button>
          </form>

          <p className="muted" style={{ fontSize: ".8rem", marginTop: "1rem", lineHeight: 1.55 }}>
            {x.invitarPie}
          </p>
        </div>
      </div>
    </>
  );
}
