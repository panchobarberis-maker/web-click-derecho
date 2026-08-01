import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { sql } from "./db";
import { SESSION_COOKIE } from "./cookie-names";

const scrypt = promisify(scryptCb) as (pw: string | Buffer, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

// Parametros de scrypt. N=2^15 tarda ~100ms por verificacion, que es el punto:
// hace inviable probar contraseñas en masa.
//
// maxmem es obligatorio: 128*N*r da 32 MB justos y el limite por defecto de
// Node es exactamente 32 MB, asi que sin subirlo scrypt tira
// ERR_CRYPTO_INVALID_SCRYPT_PARAMS.
const N = 32768, r = 8, p = 1, KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024;

export const COOKIE = SESSION_COOKIE;
const DIAS = 30;

// ---------------------------------------------------------------- contraseñas

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(plain.normalize("NFKC"), salt, KEYLEN, { N, r, p, maxmem: MAXMEM });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(plain: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [alg, n, rr, pp, saltB64, keyB64] = stored.split("$");
  if (alg !== "scrypt") return false;

  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(plain.normalize("NFKC"), salt, expected.length, {
    N: Number(n), r: Number(rr), p: Number(pp), maxmem: MAXMEM,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Verificacion de descarte cuando el email no existe.
 *
 * Sin esto, "usuario inexistente" responde en 1ms y "contraseña incorrecta" en
 * 100ms: la diferencia deja enumerar que direcciones estan registradas.
 */
export async function fakeVerify(): Promise<void> {
  await scrypt("descarte", Buffer.alloc(16), KEYLEN, { N, r, p, maxmem: MAXMEM });
}

// -------------------------------------------------------------------- sesiones

/** En la base solo guardamos el hash: el token en claro vive unicamente en la cookie. */
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createSession(userId: string, userAgent?: string | null): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + DIAS * 864e5);

  await sql`
    insert into auth_sessions (token_hash, user_id, expires_at, user_agent)
    values (${hashToken(token)}, ${userId}, ${expires}, ${userAgent ?? null})`;
  await sql`update users set last_login_at = now() where id = ${userId}`;

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await sql`delete from auth_sessions where token_hash = ${hashToken(token)}`;
  jar.delete(COOKIE);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  is_staff: boolean;
};

/** El usuario logueado, o null. No redirige: para eso está requireUser(). */
export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const [row] = await sql<SessionUser[]>`
    select u.id, u.email, u.name, u.image, u.is_staff
    from auth_sessions s join users u on u.id = s.user_id
    where s.token_hash = ${hashToken(token)} and s.expires_at > now()`;
  return row ?? null;
}

// ----------------------------------------------------------------- invitaciones

/** Devuelve el token en claro (va en el link del mail) y guarda solo el hash. */
export async function createInvitation(o: {
  email: string;
  firmId: string;
  role: "owner" | "member";
  invitedBy: string;
}): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const email = o.email.trim().toLowerCase();

  // Una invitacion pendiente por persona y estudio.
  await sql`
    delete from invitations
    where firm_id = ${o.firmId} and lower(email) = ${email} and accepted_at is null`;

  await sql`
    insert into invitations (token_hash, email, firm_id, role, invited_by, expires_at)
    values (${hashToken(token)}, ${email}, ${o.firmId}, ${o.role}, ${o.invitedBy},
            now() + interval '7 days')`;
  return token;
}

export type Invitation = { id: string; email: string; firm_id: string; role: "owner" | "member"; firm_name: string };

export async function findInvitation(token: string): Promise<Invitation | null> {
  const [row] = await sql<Invitation[]>`
    select i.id, i.email, i.firm_id, i.role, f.name as firm_name
    from invitations i join firms f on f.id = i.firm_id
    where i.token_hash = ${hashToken(token)}
      and i.accepted_at is null and i.expires_at > now()`;
  return row ?? null;
}

export async function acceptInvitation(inv: Invitation, userId: string): Promise<void> {
  await sql`
    insert into memberships (user_id, firm_id, role)
    values (${userId}, ${inv.firm_id}, ${inv.role})
    on conflict (user_id, firm_id) do update set role = excluded.role`;
  await sql`update invitations set accepted_at = now() where id = ${inv.id}`;
}
