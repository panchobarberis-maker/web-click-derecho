import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/cookie-names";

/**
 * Corta la visita al panel sin cookie de sesión.
 *
 * Es solo la primera puerta: el middleware corre en el edge y no puede tocar
 * la base, así que acá únicamente miramos si hay cookie. Que la sesión sea
 * válida y que el usuario tenga acceso a ese estudio lo resuelve
 * `activeFirm()` contra Postgres en cada pantalla.
 */
export function middleware(req: NextRequest) {
  // La home es publica. Va acá y no en el matcher porque la ruta raiz deja el
  // grupo capturado vacio y no hay forma limpia de excluirla con la negacion.
  if (req.nextUrl.pathname === "/") return NextResponse.next();

  if (req.cookies.get(SESSION_COOKIE)) return NextResponse.next();

  const login = new URL("/login", req.url);
  return NextResponse.redirect(login);
}

export const config = {
  // Todo el panel queda protegido. Lo público —el formulario, el widget y las
  // APIs que usa— se excluye acá, así agregar una pantalla nueva al panel la
  // deja protegida por omisión y no al revés.
  matcher: [
    "/((?!f/|w\\.js|login|recuperar|invite/|sin-acceso|api/auth/|api/track|api/answer|api/submit|api/impression|api/cron/|api/health|hero-default\\.svg|_next/|favicon\\.ico).*)",
  ],
};
