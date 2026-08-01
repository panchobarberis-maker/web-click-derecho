"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const OPTS: { key: string; label: string }[] = [
  { key: "7d", label: "7 días" },
  { key: "30d", label: "30 días" },
  { key: "90d", label: "90 días" },
  { key: "all", label: "Todo" },
];

export function RangePicker({ current }: { current: string }) {
  const path = usePathname();
  const params = useSearchParams();

  return (
    <div className="ranges">
      {OPTS.map((o) => {
        const next = new URLSearchParams(params);
        next.set("r", o.key);
        return (
          <Link key={o.key} href={`${path}?${next}`} aria-current={current === o.key ? "page" : undefined}>
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
