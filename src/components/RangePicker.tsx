"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { t as textos, type Lang } from "@/lib/i18n";

const CLAVES = ["7d", "30d", "90d", "all"] as const;

export function RangePicker({ current, lang = "es" }: { current: string; lang?: Lang }) {
  const path = usePathname();
  const params = useSearchParams();
  const x = textos(lang).comp;
  const nombre: Record<string, string> = {
    "7d": x.rango7, "30d": x.rango30, "90d": x.rango90, all: x.rangoTodo,
  };

  return (
    <div className="ranges">
      {CLAVES.map((clave) => {
        const next = new URLSearchParams(params);
        next.set("r", clave);
        return (
          <Link key={clave} href={`${path}?${next}`} aria-current={current === clave ? "page" : undefined}>
            {nombre[clave]}
          </Link>
        );
      })}
    </div>
  );
}
