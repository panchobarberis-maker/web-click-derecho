"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Field, Firm, Funnel, Workflow } from "@/lib/db";
import { sessionKey } from "@/lib/session-key";

type Props = {
  firm: Firm;
  funnel: Funnel;
  workflow: Workflow;
  search: Record<string, string | undefined>;
};

const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export function FormRunner({ firm, funnel, workflow, search }: Props) {
  const steps = workflow.steps?.steps ?? [];
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);

  const sessionId = useRef<string | null>(null);
  const started = useRef(false);
  const dataRef = useRef(data);
  dataRef.current = data;
  const stepRef = useRef(step);
  stepRef.current = step;

  const storeKey = sessionKey(firm.slug);

  // Abrir (o retomar) la sesion y registrar la visita.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const resume = search.retomar || localStorage.getItem(storeKey);

      const res = await post("/api/track", {
        type: "view",
        sessionId: resume,
        firmSlug: firm.slug,
        funnelId: funnel.id,
        workflowId: workflow.id,
        surface: search.surface ?? "page",
        source: search.utm_source ?? search.src ?? null,
        referrer: document.referrer || null,
        utm: Object.fromEntries(Object.entries(search).filter(([k]) => k.startsWith("utm_"))),
      });

      if (!res.ok || cancelled) return;
      const json = await res.json();
      sessionId.current = json.sessionId;
      localStorage.setItem(storeKey, json.sessionId);

      // Retomar donde lo dejo. maxStep viene 1-based ("llego hasta el paso N"),
      // asi que el indice del paso en el que estaba es maxStep - 1.
      if (json.data && Object.keys(json.data).length) {
        setData(json.data);
        started.current = true;
        if (typeof json.maxStep === "number") {
          setStep(Math.max(0, Math.min(json.maxStep - 1, steps.length - 1)));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Guardado parcial. Esto es lo que permite recuperar abandonos despues. */
  const save = useCallback(
    (extra?: { stepDone?: number }) => {
      if (!sessionId.current) return;
      post("/api/answer", {
        sessionId: sessionId.current,
        data: dataRef.current,
        step: stepRef.current,
        stepDone: extra?.stepDone,
        started: started.current,
      });
    },
    [],
  );

  /**
   * Autoguardado con debounce. Va atado a `data` y no al blur: si guardaramos
   * en el handler de blur leeriamos el ref antes de que React re-renderice y
   * se perderia el ultimo campo tipeado.
   */
  useEffect(() => {
    if (!started.current || !sessionId.current) return;
    const t = setTimeout(() => save(), 500);
    return () => clearTimeout(t);
  }, [data, save]);

  // Si cierra la pestaña a mitad de camino, igual queda guardado lo tipeado.
  useEffect(() => {
    const onHide = () => {
      if (!sessionId.current || done) return;
      navigator.sendBeacon?.(
        "/api/answer",
        new Blob(
          [JSON.stringify({ sessionId: sessionId.current, data: dataRef.current, step: stepRef.current, started: started.current })],
          { type: "application/json" },
        ),
      );
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [done]);

  function set(key: string, value: string) {
    if (!started.current && value.trim()) started.current = true;
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    for (const f of steps[step]?.fields ?? []) {
      const v = (data[f.key] ?? "").trim();
      if (f.required && !v) errs[f.key] = "Completá este campo";
      else if (f.type === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) errs[f.key] = "Revisá el email";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function next() {
    if (!validate()) return;

    if (step < steps.length - 1) {
      save({ stepDone: step });
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.parent?.postMessage({ type: "intake:step", step: step + 1 }, "*");
      return;
    }

    setSending(true);
    const res = await post("/api/submit", { sessionId: sessionId.current, data, step });
    setSending(false);
    if (res.ok) {
      localStorage.removeItem(storeKey);
      setDone(true);
      window.parent?.postMessage({ type: "intake:submit" }, "*");
    }
  }

  if (done) {
    return (
      <div className="fcard">
        <div className="fdone">
          <div className="check">✓</div>
          <h2>Recibimos tu consulta</h2>
          <p>
            Un abogado de {firm.name} la va a revisar y te contacta
            {data.email ? <> a <strong>{data.email}</strong></> : null}. Si es urgente, respondé el mail que te acabamos de mandar.
          </p>
        </div>
      </div>
    );
  }

  const current = steps[step];
  if (!current) return <div className="fcard"><p className="empty">Este formulario todavía no tiene preguntas.</p></div>;

  return (
    <div className="fcard">
      <div className="fsteps">
        Paso {step + 1} de {steps.length} · {funnel.name}
      </div>
      <div className="fprogress">
        <span style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>

      <div className="fhead">
        <h1>{current.title}</h1>
        {current.subtitle && <p>{current.subtitle}</p>}
      </div>

      {current.fields.map((f) => (
        <FieldInput key={f.key} field={f} value={data[f.key] ?? ""} error={errors[f.key]} onChange={set} />
      ))}

      <div className="fnav">
        {step > 0 && (
          <button type="button" className="fbtn back" onClick={() => setStep(step - 1)}>
            ← Atrás
          </button>
        )}
        <button type="button" className="fbtn" onClick={next} disabled={sending} style={{ marginLeft: "auto" }}>
          {sending ? "Enviando…" : step === steps.length - 1 ? "Enviar consulta" : "Continuar"}
        </button>
      </div>

      {step === 0 && (
        <p className="fnote">
          Tus datos van directo al estudio y se usan solo para responder esta consulta.
        </p>
      )}
    </div>
  );
}

function FieldInput({
  field, value, error, onChange,
}: {
  field: Field;
  value: string;
  error?: string;
  onChange: (k: string, v: string) => void;
}) {
  const id = `f-${field.key}`;
  const label = (
    <label htmlFor={id}>
      {field.label} {field.required && <span className="req">*</span>}
    </label>
  );

  return (
    <div className={`ffield${error ? " err" : ""}`}>
      {field.type === "radio" ? <span style={{ display: "block", fontSize: ".9rem", fontWeight: 500, marginBottom: ".5rem" }}>{field.label} {field.required && <span className="req">*</span>}</span> : label}

      {field.type === "textarea" ? (
        <textarea id={id} value={value} onChange={(e) => onChange(field.key, e.target.value)} />
      ) : field.type === "select" ? (
        <select id={id} value={value} onChange={(e) => onChange(field.key, e.target.value)}>
          <option value="">Elegí una opción…</option>
          {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.type === "radio" ? (
        <div className="fradios">
          {field.options?.map((o) => (
            <label key={o}>
              <input
                type="radio"
                name={field.key}
                value={o}
                checked={value === o}
                onChange={() => onChange(field.key, o)}
              />
              {o}
            </label>
          ))}
        </div>
      ) : (
        <input
          id={id}
          type={field.type}
          value={value}
          autoComplete={field.key === "email" ? "email" : field.key === "phone" ? "tel" : field.key === "full_name" ? "name" : "off"}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      )}

      {error && <div className="msg">{error}</div>}
    </div>
  );
}
