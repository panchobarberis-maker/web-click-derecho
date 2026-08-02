/**
 * La IP de quien hace el pedido.
 *
 * Detrás de Vercel el socket siempre es del proxy, así que la real viene en
 * x-forwarded-for. Nos quedamos con el primer valor, que es el del cliente;
 * los que siguen los agregan los proxies del camino y se pueden falsificar.
 *
 * Sirve para frenar intentos de contraseña, no para identificar a nadie: una
 * IP compartida se frena junta, y por eso el tope por IP es más alto que el
 * tope por cuenta.
 */
export function clientIp(headers: Headers): string | null {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || null;
  return headers.get("x-real-ip");
}
