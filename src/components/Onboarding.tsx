import Link from "next/link";
import type { Paso } from "@/lib/onboarding";
import { t as textos, type Lang } from "@/lib/i18n";

/**
 * Checklist de puesta en marcha de un estudio.
 *
 * Se calcula del estado real de la base, no de una tabla de "pasos
 * completados": si alguien borra sus formularios, el paso vuelve a aparecer.
 * Desaparece del Inicio cuando esta todo hecho.
 */
export function Onboarding({ pasos, lang = "es" }: { pasos: Paso[]; lang?: Lang }) {
  const hechos = pasos.filter((p) => p.listo).length;
  if (hechos === pasos.length) return null;
  const x = textos(lang).comp;

  return (
    <section className="card onboarding">
      <header>
        <div>
          <h3>{x.puestaEnMarcha}</h3>
          <p className="muted">{x.puestaBajada}</p>
        </div>
        <span className="progreso">{x.deTotal(hechos, pasos.length)}</span>
      </header>

      <ol>
        {pasos.map((p) => (
          <li key={p.titulo} className={p.listo ? "listo" : ""}>
            <span className="marca" aria-hidden="true">{p.listo ? "✓" : ""}</span>
            <div>
              <strong>{p.titulo}</strong>
              <p>{p.detalle}</p>
            </div>
            {!p.listo && <Link href={p.href} className="btn ghost">{p.accion}</Link>}
          </li>
        ))}
      </ol>
    </section>
  );
}
