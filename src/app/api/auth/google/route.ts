import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authorizeUrl, googleEnabled } from "@/lib/google";

export const dynamic = "force-dynamic";

export const STATE_COOKIE = "intake_oauth_state";

export async function GET(req: Request) {
  if (!googleEnabled()) return NextResponse.redirect(new URL("/login?e=google_off", req.url));

  // El state ata este redirect a este navegador: sin el, cualquiera puede
  // disparar el callback con un code ajeno (CSRF de login).
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(authorizeUrl(state));
}
