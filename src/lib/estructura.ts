/**
 * Lo que la aplicacion necesita que exista en la base.
 *
 * Vive en un solo lugar porque lo miran dos: /api/health, que es el
 * diagnostico de afuera cuando no se puede entrar, y la pantalla Base de
 * datos, que es el de adentro. Tenerlo duplicado significa que tarde o
 * temprano uno dice que esta todo bien y el otro que falta algo.
 *
 * Al agregar una tabla o una columna al esquema, agregarla tambien acá.
 */
export const TABLAS = [
  "firms", "funnels", "workflows", "sessions", "events",
  "users", "memberships", "oauth_accounts", "auth_sessions", "invitations",
  "popups", "clips", "password_resets", "login_attempts",
] as const;

/** Columnas agregadas despues del esquema inicial. */
export const COLUMNAS: [tabla: string, columna: string][] = [
  ["sessions", "surface_id"],
  ["firms", "show_on_home"],
  ["popups", "paginas"],
  ["clips", "paginas"],
  ["clips", "autoplay"],
  ["events", "surface_id"],
  ["firms", "lang"],
  ["popups", "titulo"],
];
