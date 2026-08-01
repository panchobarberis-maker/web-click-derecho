"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Inicio" },
  { href: "/responses", label: "Consultas" },
  { href: "/analytics", label: "Analytics" },
  { sep: true },
  { href: "/funnels", label: "Áreas y formularios" },
  { href: "/embed", label: "Instalación" },
];

export function Nav({ firmName }: { firmName: string }) {
  const path = usePathname();

  return (
    <nav className="sidebar">
      <div className="brand">
        Click Derecho
        <small>{firmName}</small>
      </div>
      <div className="nav">
        {items.map((it, i) =>
          it.sep ? (
            <div className="sep" key={i} />
          ) : (
            <Link
              key={it.href}
              href={it.href!}
              aria-current={path === it.href || (it.href !== "/" && path.startsWith(it.href!)) ? "page" : undefined}
            >
              {it.label}
            </Link>
          ),
        )}
      </div>
      <footer>Intake v0.1</footer>
    </nav>
  );
}
