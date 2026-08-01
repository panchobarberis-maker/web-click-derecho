/**
 * Nombres de cookie sueltos, sin importar nada.
 *
 * El middleware corre en el runtime edge, donde no existe `node:crypto`.
 * Si tomara estas constantes de `lib/auth` se arrastraria todo ese modulo
 * al bundle del edge y la app no levanta.
 */
export const SESSION_COOKIE = "intake_session";
export const FIRM_COOKIE = "intake_firm";
