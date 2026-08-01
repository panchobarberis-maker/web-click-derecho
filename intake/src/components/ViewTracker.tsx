"use client";

import { useEffect } from "react";
import { sessionKey } from "@/lib/session-key";

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
  surface,
}: {
  firmSlug: string;
  funnelId?: string;
  surface?: string;
}) {
  useEffect(() => {
    const key = sessionKey(firmSlug);

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firmSlug,
        funnelId: funnelId ?? null,
        sessionId: localStorage.getItem(key),
        surface: surface ?? "page",
        referrer: document.referrer || null,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.sessionId && localStorage.setItem(key, j.sessionId))
      .catch(() => {});
  }, [firmSlug, funnelId, surface]);

  return null;
}
