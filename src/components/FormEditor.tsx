"use client";

import { useState, useTransition } from "react";
import type { Field, Step } from "@/lib/db";
import { CON_OPCIONES, TIPOS, pasoDeCoordinacion, slugify, validarFormulario } from "@/lib/forms";
import type { Lang } from "@/lib/i18n";

type Guardar = (steps: Step[]) => Promise<{ ok: boolean; problemas?: string[] }>;

const nuevaPregunta = (): Field => ({ key: "", label: "", type: "text", required: false });
const nuevoPaso = (n: number): Step => ({ title: `Paso ${n}`, fields: [nuevaPregunta()] });

export function FormEditor({
  inicial,
  guardar,
  verUrl,
  lang = "es",
}: {
  inicial: Step[];
  guardar: Guardar;
  verUrl: string;
  /** Para que el paso sugerido salga en el idioma del estudio. */
  lang?: Lang;
}) {
  const [steps, setSteps] = useState<Step[]>(inicial.length ? inicial : [nuevoPaso(1)]);
  const [problemas, setProblemas] = useState<string[]>([]);
  const [guardado, setGuardado] = useState(false);
  const [pendiente, empezar] = useTransition();

  // Un solo bloque de coordinación por formulario: sus claves son fijas y
  // dos copias chocarían al validar.
  const tieneCoordinacion = steps.some((p) => p.fields.some((f) => f.key === "contacto_pref"));

  /** Cambia el arreglo sin mutarlo y marca que hay cambios sin guardar. */
  function actualizar(fn: (copia: Step[]) => void) {
    setSteps((prev) => {
      const copia = structuredClone(prev);
      fn(copia);
      return copia;
    });
    setGuardado(false);
  }

  const mover = <T,>(arr: T[], i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  };

  function onGuardar() {
    const encontrados = validarFormulario(steps);
    setProblemas(encontrados);
    if (encontrados.length) return;

    empezar(async () => {
      const r = await guardar(steps);
      if (r.ok) {
        setGuardado(true);
        setProblemas([]);
      } else {
        setProblemas(r.problemas ?? ["No se pudo guardar."]);
      }
    });
  }

  return (
    <div className="editor">
      {steps.map((paso, i) => (
        <section className="card paso" key={i}>
          <header>
            <span className="paso-n">Paso {i + 1}</span>
            <div className="acciones">
              <button type="button" onClick={() => actualizar((s) => mover(s, i, -1))} disabled={i === 0} aria-label="Subir el paso">↑</button>
              <button type="button" onClick={() => actualizar((s) => mover(s, i, 1))} disabled={i === steps.length - 1} aria-label="Bajar el paso">↓</button>
              <button
                type="button"
                className="borrar"
                onClick={() => actualizar((s) => void s.splice(i, 1))}
                disabled={steps.length === 1}
                aria-label="Borrar el paso"
              >
                Borrar paso
              </button>
            </div>
          </header>

          <label className="lbl">Título</label>
          <input
            value={paso.title}
            onChange={(e) => actualizar((s) => void (s[i].title = e.target.value))}
            placeholder="Sobre tu trabajo"
          />

          <label className="lbl">Aclaración (opcional)</label>
          <input
            value={paso.subtitle ?? ""}
            onChange={(e) => actualizar((s) => void (s[i].subtitle = e.target.value))}
            placeholder="Una línea que ayude a responder"
          />

          <div className="preguntas">
            {paso.fields.map((f, j) => (
              <div className="pregunta" key={j}>
                <div className="fila">
                  <div className="crece">
                    <label className="lbl">Pregunta</label>
                    <input
                      value={f.label}
                      onChange={(e) =>
                        actualizar((s) => {
                          const campo = s[i].fields[j];
                          const claveAuto = !campo.key || campo.key === slugify(campo.label);
                          campo.label = e.target.value;
                          // La clave sigue a la etiqueta mientras nadie la haya tocado a mano.
                          if (claveAuto) campo.key = slugify(e.target.value);
                        })
                      }
                      placeholder="¿Cuánto tiempo trabajaste ahí?"
                    />
                  </div>

                  <div>
                    <label className="lbl">Tipo</label>
                    <select
                      value={f.type}
                      onChange={(e) =>
                        actualizar((s) => {
                          const campo = s[i].fields[j];
                          campo.type = e.target.value as Field["type"];
                          if (CON_OPCIONES.has(campo.type) && !campo.options?.length) campo.options = ["", ""];
                          if (!CON_OPCIONES.has(campo.type)) delete campo.options;
                        })
                      }
                    >
                      {TIPOS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="botones">
                    <button type="button" onClick={() => actualizar((s) => mover(s[i].fields, j, -1))} disabled={j === 0} aria-label="Subir la pregunta">↑</button>
                    <button type="button" onClick={() => actualizar((s) => mover(s[i].fields, j, 1))} disabled={j === paso.fields.length - 1} aria-label="Bajar la pregunta">↓</button>
                    <button type="button" className="borrar" onClick={() => actualizar((s) => void s[i].fields.splice(j, 1))} aria-label="Borrar la pregunta">✕</button>
                  </div>
                </div>

                {CON_OPCIONES.has(f.type) && (
                  <div className="opciones">
                    <label className="lbl">Opciones</label>
                    {(f.options ?? []).map((o, k) => (
                      <div className="fila-opcion" key={k}>
                        <input
                          value={o}
                          onChange={(e) => actualizar((s) => void (s[i].fields[j].options![k] = e.target.value))}
                          placeholder={`Opción ${k + 1}`}
                        />
                        <button
                          type="button"
                          className="borrar"
                          onClick={() => actualizar((s) => void s[i].fields[j].options!.splice(k, 1))}
                          aria-label="Borrar la opción"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button type="button" className="agregar chico" onClick={() => actualizar((s) => void s[i].fields[j].options!.push(""))}>
                      + Agregar opción
                    </button>
                  </div>
                )}

                <div className="pie">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={!!f.required}
                      onChange={(e) => actualizar((s) => void (s[i].fields[j].required = e.target.checked))}
                    />
                    Obligatoria
                  </label>
                  <span className="clave" title="Con este nombre se guarda la respuesta">
                    clave: <code>{f.key || "—"}</code>
                  </span>
                </div>
              </div>
            ))}

            <button type="button" className="agregar" onClick={() => actualizar((s) => void s[i].fields.push(nuevaPregunta()))}>
              + Agregar pregunta
            </button>
          </div>
        </section>
      ))}

      <div className="pasos-nuevos">
        <button type="button" className="agregar paso-nuevo" onClick={() => actualizar((s) => void s.push(nuevoPaso(s.length + 1)))}>
          + Agregar paso
        </button>

        {/*
          El bloque de coordinación se ofrece en vez de venir puesto: si viniera
          puesto, cada paso que se agregue después cae detrás de él y el
          formulario termina preguntando cómo coordinar antes de saber el caso.
          Así lo agrega el que arma el formulario cuando ya cargó el resto.
        */}
        {!tieneCoordinacion && (
          <button type="button" className="agregar paso-nuevo" onClick={() => actualizar((s) => void s.push(pasoDeCoordinacion(lang)))}>
            + Agregar paso de coordinación
          </button>
        )}
      </div>

      {problemas.length > 0 && (
        <div className="problemas">
          <strong>Revisá esto antes de guardar:</strong>
          <ul>{problemas.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
      )}

      <div className="barra">
        <button type="button" className="btn" onClick={onGuardar} disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar formulario"}
        </button>
        <a className="btn ghost" href={verUrl} target="_blank" rel="noreferrer">Ver cómo queda</a>
        {guardado && <span className="ok">Guardado</span>}
      </div>
    </div>
  );
}
