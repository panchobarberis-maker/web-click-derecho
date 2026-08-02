"use client";

import { useEffect } from "react";
import { sessionKey } from "@/lib/session-key";
import { pickAttribution } from "@/lib/attribution";

/**
 * Registra la visita en las pantallas previas al formulario (menu de areas y
 * de casos). Sin esto, alguien que abre el pop-up y no elige nada no contaria
 * como visita, y la tasa de conversion daria inflada.
 *
 * Reusa la misma sesion que despues levanta el FormRunner, asi una persona
 * cuenta una sola vez aunque pase por las tres pantallas.
 */
export function ViewTracker({
  firmSlug,
  funnelId,
  search,
}: {
  firmSlug: string;
  funnelId?: string;
  search: Record<string, string | undefined>;
}) {
  useEffect(() => {
    // Vista previa del panel: mirar cómo queda un pop-up no puede contar
    // como una visita ni ensuciarle las estadísticas al estudio.
    if (search.preview === "1") return;

    const key = sessionKey(firmSlug);

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firmSlug,
        funnelId: funnelId ?? null,
        sessionId: localStorage.getItem(key),
        surface: search.surface ?? "page",
        surfaceId: search.sid ?? null,
        // `ref` y `lp` los reenvia el widget: son de la pagina madre, no del iframe.
        referrer: search.ref || document.referrer || null,
        landingPage: search.lp || location.href,
        utm: pickAttribution(search),
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.sessionId && localStorage.setItem(key, j.sessionId))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmSlug, funnelId]);

  return null;
}
