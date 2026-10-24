"use client";

import { useId, useRef, useState } from "react";
import { t as textos, type Lang } from "@/lib/i18n";

const S1 = "#1a6fa8"; // visitas
const S2 = "#b3701a"; // consultas

/**
 * Neutros del grafico.
 *
 * Estaban en grises lilas —#e8e5ee, #6b6478, #f1eff5— heredados de cuando la
 * interfaz era violeta. Sobre el beige actual desentonaban: la grilla tiraba a
 * lavanda contra una pagina calida. Estos son los mismos neutros del panel.
 */
const GRILLA = "#ece5da";
const EJE = "#7d7164";
const PISTA = "#efe9de";

export type Point = { label: string; visits: number; responses: number };

/**
 * Visitas vs consultas en el tiempo. Un solo eje y: las dos series se cuentan
 * en la misma unidad (personas), asi que comparten escala.
 */
export function LineChart({ data, lang = "es" }: { data: Point[]; lang?: Lang }) {
  const x2 = textos(lang).stats;
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  // Los degradados van por id; con dos graficos en la misma pagina, un id fijo
  // hace que el segundo pinte con el del primero.
  const gid = useId();

  if (data.length < 2) return <p className="empty">{x2.sinDatos}</p>;

  const W = 820, H = 240, PL = 44, PR = 16, PT = 16, PB = 28;
  const max = Math.max(4, ...data.map((d) => Math.max(d.visits, d.responses)));
  const top = Math.ceil(max / 4) * 4;
  const x = (i: number) => PL + (i * (W - PL - PR)) / (data.length - 1);
  const y = (v: number) => PT + (1 - v / top) * (H - PT - PB);
  const path = (k: "visits" | "responses") => data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d[k])}`).join(" ");
  // El relleno cierra la linea contra el eje: le da peso a la serie sin
  // agregar tinta, que es lo que le faltaba al grafico para no verse flaco.
  const area = (k: "visits" | "responses") =>
    `${path(k)} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  const ultimo = data.length - 1;

  function move(e: React.MouseEvent) {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const rel = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((rel - PL) / (W - PL - PR)) * (data.length - 1));
    setHover(i >= 0 && i < data.length ? i : null);
  }

  const h = hover != null ? data[hover] : null;

  return (
    <div>
      <div className="legend" style={{ marginBottom: ".75rem" }}>
        <span><i className="dot" style={{ background: S1 }} />{x2.visitas}</span>
        <span><i className="dot" style={{ background: S2 }} />{x2.consultasEnviadas}</span>
      </div>

      <div ref={box} style={{ position: "relative" }} onMouseMove={move} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={x2.grafico}>
          <defs>
            <linearGradient id={`${gid}-v`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={S1} stopOpacity="0.16" />
              <stop offset="100%" stopColor={S1} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${gid}-c`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={S2} stopOpacity="0.14" />
              <stop offset="100%" stopColor={S2} stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={PL} x2={W - PR} y1={y(top * t)} y2={y(top * t)}
                    stroke={GRILLA} strokeWidth={t === 0 ? 1.5 : 1} />
              <text x={PL - 10} y={y(top * t) + 4} textAnchor="end" fontSize="11" fill={EJE}>
                {Math.round(top * t)}
              </text>
            </g>
          ))}

          {data.map((d, i) =>
            i % Math.ceil(data.length / 7) === 0 ? (
              <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill={EJE}>{d.label}</text>
            ) : null,
          )}

          <path d={area("visits")} fill={`url(#${gid}-v)`} stroke="none" />
          <path d={area("responses")} fill={`url(#${gid}-c)`} stroke="none" />

          <path d={path("visits")} fill="none" stroke={S1} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
          <path d={path("responses")} fill="none" stroke={S2} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />

          {/* El ultimo dato es el que se mira primero: se marca siempre. */}
          {hover == null && (
            <>
              <circle cx={x(ultimo)} cy={y(data[ultimo].visits)} r="3.5" fill={S1} stroke="#fff" strokeWidth="1.5" />
              <circle cx={x(ultimo)} cy={y(data[ultimo].responses)} r="3.5" fill={S2} stroke="#fff" strokeWidth="1.5" />
            </>
          )}

          {hover != null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={PT} y2={H - PB} stroke={EJE} strokeWidth="1" strokeOpacity="0.35" />
              {/* anillo de superficie de 2px para separar el marker de la linea */}
              <circle cx={x(hover)} cy={y(data[hover].visits)} r="5" fill={S1} stroke="#fff" strokeWidth="2" />
              <circle cx={x(hover)} cy={y(data[hover].responses)} r="5" fill={S2} stroke="#fff" strokeWidth="2" />
            </>
          )}
        </svg>

        {h && (
          <div
            style={{
              position: "absolute", top: 0, left: `${(x(hover!) / W) * 100}%`,
              transform: x(hover!) > W / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
              background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8,
              padding: ".55rem .75rem", fontSize: ".82rem", pointerEvents: "none",
              boxShadow: "0 6px 20px rgba(42,33,24,.12)", whiteSpace: "nowrap",
            }}
          >
            <strong style={{ display: "block", marginBottom: ".3rem" }}>{h.label}</strong>
            <div><i className="dot" style={{ background: S1 }} />{x2.visitas}: {h.visits}</div>
            <div><i className="dot" style={{ background: S2 }} />{x2.consultas}: {h.responses}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Barras horizontales. Magnitud en una sola dimension -> una sola tinta. */
export function BarList({
  rows,
  color = S1,
  unit = "",
}: {
  rows: { label: string; value: number; caption?: string }[];
  color?: string;
  unit?: string;
}) {
  if (!rows.length) return <p className="empty">Sin datos en este período.</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: ".8rem" }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".88rem", marginBottom: ".3rem" }}>
            <span>{r.label}</span>
            <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
              {r.caption ?? `${r.value}${unit}`}
            </span>
          </div>
          <div style={{ height: 8, background: PISTA, borderRadius: 4 }}>
            <div style={{ width: `${(r.value / max) * 100}%`, height: "100%", background: color, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Tile({
  label, value, sub, meter,
}: { label: string; value: string | number; sub?: string; meter?: number }) {
  return (
    <div className="card tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {meter != null && <div className="meter"><span style={{ width: `${Math.min(100, meter)}%` }} /></div>}
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
