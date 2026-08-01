"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function WorkflowPicker({
  workflows,
  current,
}: {
  workflows: { id: string; name: string; funnel: string }[];
  current: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();

  return (
    <select
      value={current}
      onChange={(e) => {
        const next = new URLSearchParams(params);
        next.set("wf", e.target.value);
        router.push(`${path}?${next}`);
      }}
      style={{
        padding: ".45rem .7rem", borderRadius: 8, border: "1px solid var(--line)",
        fontFamily: "inherit", fontSize: ".85rem", background: "#fff", color: "var(--ink)", maxWidth: 280,
      }}
    >
      {workflows.map((w) => (
        <option key={w.id} value={w.id}>
          {w.funnel} — {w.name}
        </option>
      ))}
    </select>
  );
}
