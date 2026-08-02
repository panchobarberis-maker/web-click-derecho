import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { acceptInvitation, createSession } from "@/lib/auth";
import { exchangeCode, googleEnabled } from "@/lib/google";
import { STATE_COOKIE } from "../route";

export const dynamic = "force-dynamic";

const fail = (req: Request, e: string) => NextResponse.redirect(new URL(`/login?e=${e}`, req.url));

export async function GET(req: Request) {
  if (!googleEnabled()) return fail(req, "google_off");

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const jar = await cookies();
  const esperado = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);

  if (!code || !state || !esperado || state !== esperado) return fail(req, "state");

  let g;
  try {
    g = await exchangeCode(code);
  } catch (err) {
    console.error("login con google falló:", err);
    return fail(req, "google");
  }

  // Una cuenta de Google sin verificar no prueba que sea dueño del mail, y de
  // ese mail depende que lo vinculemos a un usuario o a una invitación.
  if (g.email_verified === false) return fail(req, "email_no_verificado");

  const email = g.email.toLowerCase();

  // 1. Ya vinculó esta cuenta de Google antes.
  const [vinculada] = await sql<{ user_id: string }[]>`
    select user_id from oauth_accounts
    where provider = 'google' and provider_account_id = ${g.sub}`;
  if (vinculada) {
    await createSession(vinculada.user_id, req.headers.get("user-agent"));
    return NextResponse.redirect(new URL("/panel", req.url));
  }

  // 2. Ya tiene usuario con ese mail (entraba con contraseña): vinculamos.
  const [existente] = await sql<{ id: string }[]>`select id from users where lower(email) = ${email}`;
  if (existente) {
    await sql`
      insert into oauth_accounts (provider, provider_account_id, user_id)
      values ('google', ${g.sub}, ${existente.id})
      on conflict do nothing`;
    await sql`update users set
      name = coalesce(name, ${g.name ?? null}), image = coalesce(image, ${g.picture ?? null})
      where id = ${existente.id}`;
    await createSession(existente.id, req.headers.get("user-agent"));
    return NextResponse.redirect(new URL("/panel", req.url));
  }

  // 3. No tiene usuario: solo entra si alguien lo invitó. No hay registro abierto.
  const [inv] = await sql<{ id: string; email: string; firm_id: string; role: "owner" | "member"; firm_name: string }[]>`
    select i.id, i.email, i.firm_id, i.role, f.name as firm_name
    from invitations i join firms f on f.id = i.firm_id
    where lower(i.email) = ${email} and i.accepted_at is null and i.expires_at > now()
    order by i.created_at desc limit 1`;
  if (!inv) return fail(req, "sin_invitacion");

  const [nuevo] = await sql<{ id: string }[]>`
    insert into users (email, name, image) values (${email}, ${g.name ?? null}, ${g.picture ?? null})
    returning id`;
  await sql`insert into oauth_accounts (provider, provider_account_id, user_id)
    values ('google', ${g.sub}, ${nuevo.id})`;

  await acceptInvitation(inv, nuevo.id);

  await createSession(nuevo.id, req.headers.get("user-agent"));
  return NextResponse.redirect(new URL("/panel", req.url));
}
