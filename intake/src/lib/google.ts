/**
 * Login con Google — authorization code flow.
 *
 * No verificamos la firma del id_token porque no lo usamos: el código se
 * canjea server-to-server contra Google sobre TLS y los datos del usuario se
 * piden al endpoint de userinfo con el access token. La respuesta viene
 * directo de Google por un canal autenticado, así que no hay nada que
 * validar localmente.
 *
 * Los endpoints son configurables para poder probar el flujo completo contra
 * un IdP falso; por defecto apuntan a Google.
 */

import { baseUrl } from "./base-url";

const BASE_AUTH = process.env.GOOGLE_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth";
const BASE_TOKEN = process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
const BASE_USERINFO = process.env.GOOGLE_USERINFO_URL || "https://openidconnect.googleapis.com/v1/userinfo";

export const googleEnabled = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const redirectUri = () => `${baseUrl()}/api/auth/google/callback`;

export function authorizeUrl(state: string): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `${BASE_AUTH}?${q}`;
}

export type GoogleUser = { sub: string; email: string; name?: string; picture?: string; email_verified?: boolean };

export async function exchangeCode(code: string): Promise<GoogleUser> {
  const res = await fetch(BASE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`google token endpoint: ${res.status} ${await res.text()}`);

  const { access_token } = (await res.json()) as { access_token?: string };
  if (!access_token) throw new Error("google no devolvió access_token");

  const info = await fetch(BASE_USERINFO, { headers: { Authorization: `Bearer ${access_token}` } });
  if (!info.ok) throw new Error(`google userinfo: ${info.status}`);

  const user = (await info.json()) as GoogleUser;
  if (!user.sub || !user.email) throw new Error("google no devolvió sub/email");
  return user;
}
