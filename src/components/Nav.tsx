"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Señal de que el click se registró y la pantalla está viniendo.
 *
 * Va acá y no en un loading.tsx a propósito: un loading.tsx mete un límite de
 * Suspense en el segmento, y con eso la pantalla dejaba de refrescarse después
 * de un server action la mitad de las veces —el pop-up quedaba guardado pero
 * no aparecía en la lista—. Esto es solo un punto al lado del ítem del menú:
 * no toca el árbol de render, así que no puede romper nada.
 */
function Pendiente() {
  const { pending } = useLinkStatus();
  return pending ? <i className="latido" aria-hidden="true" /> : null;
}

type Firm = { id: string; name: string; role: string };

type Item = { href?: string; label?: string; sep?: boolean; ownerOnly?: boolean; staffOnly?: boolean };

const items: Item[] = [
  { href: "/panel", label: "Inicio" },
  { href: "/responses", label: "Consultas" },
  { href: "/analytics", label: "Analytics" },
  { sep: true },
  { href: "/funnels", label: "Áreas y formularios" },
  { href: "/popups", label: "Pop-ups" },
  { href: "/clips", label: "Clips" },
  { href: "/embed", label: "Instalación" },
  { sep: true },
  { href: "/cuenta", label: "Mi cuenta" },
  { href: "/ajustes", label: "Ajustes del estudio", ownerOnly: true },
  { href: "/equipo", label: "Equipo", ownerOnly: true },
  { href: "/estudios", label: "Estudios", staffOnly: true },
  { href: "/base", label: "Base de datos", staffOnly: true },
];

export function Nav({
  firm,
  firms,
  user,
}: {
  firm: Firm;
  firms: Firm[];
  user: { name: string | null; email: string; is_staff: boolean };
}) {
  const path = usePathname();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const esOwner = firm.role !== "member";

  function cambiarEstudio(id: string) {
    // La cookie solo elige entre los estudios permitidos; el servidor
    // igual valida el acceso en cada request.
    document.cookie = `intake_firm=${id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.refresh();
    setAbierto(false);
  }

  return (
    <nav className="sidebar">
      <div>
        <div className="brand">Right Lead</div>

        {firms.length > 1 ? (
          <div className="switch">
            <button onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
              <span>{firm.name}</span>
              <span aria-hidden="true">{abierto ? "▴" : "▾"}</span>
            </button>
            {abierto && (
              <ul>
                {firms.map((f) => (
                  <li key={f.id}>
                    <button onClick={() => cambiarEstudio(f.id)} aria-current={f.id === firm.id ? "true" : undefined}>
                      {f.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="switch-static">{firm.name}</div>
        )}
      </div>

      <div className="nav">
        {items.map((it, i) =>
          it.sep ? (
            <div className="sep" key={i} />
          ) : (it.ownerOnly && !esOwner) || (it.staffOnly && !user.is_staff) ? null : (
            <Link
              key={it.href}
              href={it.href!}
              aria-current={path === it.href || (it.href !== "/" && path.startsWith(it.href!)) ? "page" : undefined}
            >
              {it.label}
              <Pendiente />
            </Link>
          ),
        )}
      </div>

      <footer>
        <div className="who">
          <strong>{user.name ?? user.email}</strong>
          {user.is_staff && <span className="pill" style={{ fontSize: ".68rem" }}>Agencia</span>}
        </div>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="linkish">Cerrar sesión</button>
        </form>
      </footer>
    </nav>
  );
}
