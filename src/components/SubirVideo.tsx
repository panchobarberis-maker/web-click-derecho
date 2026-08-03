"use client";

import { useRef, useState } from "react";

type Estado = { fase: "quieto" | "subiendo" | "listo" | "error"; pct?: number; msg?: string };

/**
 * Elige un video y lo sube directo a Supabase.
 *
 * El archivo no pasa por nuestro servidor: se le pide un permiso firmado y el
 * navegador sube contra Supabase. Por eso se usa XMLHttpRequest y no fetch,
 * que todavia no reporta progreso de subida: sin barra, una subida de 20 MB
 * parece que se colgo y la gente recarga a la mitad.
 *
 * El campo de texto con la direccion queda visible y editable: si el estudio
 * ya tiene el video en otro lado, pega la direccion y no sube nada.
 */
export function SubirVideo({
  name,
  defaultValue = "",
  habilitado,
  maxMb,
}: {
  name: string;
  defaultValue?: string;
  habilitado: boolean;
  maxMb: number;
}) {
  const [url, setUrl] = useState(defaultValue);
  const [estado, setEstado] = useState<Estado>({ fase: "quieto" });
  const input = useRef<HTMLInputElement>(null);

  async function elegido(archivo: File) {
    setEstado({ fase: "subiendo", pct: 0 });

    const permiso = await fetch("/subir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: archivo.name, tipo: archivo.type, bytes: archivo.size }),
    });

    const datos = await permiso.json().catch(() => ({}));
    if (!permiso.ok) return setEstado({ fase: "error", msg: datos.error ?? "No se pudo empezar la subida." });

    try {
      await new Promise<void>((listo, falla) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", `${datos.subirA}?token=${encodeURIComponent(datos.token)}`);
        xhr.setRequestHeader("Content-Type", archivo.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setEstado({ fase: "subiendo", pct: Math.round((e.loaded / e.total) * 100) });
        };
        xhr.onload = () => (xhr.status < 300 ? listo() : falla(new Error(`Supabase respondió ${xhr.status}`)));
        xhr.onerror = () => falla(new Error("Se cortó la conexión durante la subida."));
        xhr.send(archivo);
      });
    } catch (e) {
      return setEstado({ fase: "error", msg: e instanceof Error ? e.message : "No se pudo subir." });
    }

    setUrl(datos.publica);
    setEstado({ fase: "listo" });
  }

  return (
    <div className="subir">
      {habilitado && (
        <>
          <input
            ref={input}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) elegido(f);
              e.target.value = "";
            }}
          />
          <button type="button" className="agregar" onClick={() => input.current?.click()}
                  disabled={estado.fase === "subiendo"}>
            {estado.fase === "subiendo" ? `Subiendo… ${estado.pct ?? 0}%` : "Subir un video"}
          </button>

          {estado.fase === "subiendo" && (
            <div className="meter" style={{ marginTop: ".5rem" }}>
              <span style={{ width: `${estado.pct ?? 0}%` }} />
            </div>
          )}
          {estado.fase === "listo" && <p className="subir-ok">Video subido.</p>}
          {estado.fase === "error" && <p className="subir-error">{estado.msg}</p>}

          <p className="muted subir-ayuda">
            Vertical, de 15 a 20 segundos, hasta {maxMb} MB. Cuanto más liviano, más rápido
            arranca en el sitio del estudio.
          </p>
        </>
      )}

      {/* El campo que se manda es este, no uno oculto: asi lo que se ve escrito
          es lo que se guarda, incluso si mandan el formulario antes de que la
          pagina termine de cargar. La subida lo unico que hace es completarlo. */}
      <label className="lbl">{habilitado ? "…o pegá la dirección de un video" : "Dirección del video (mp4)"}</label>
      <input name={name} aria-label="Dirección del video" value={url}
             onChange={(e) => setUrl(e.target.value)} placeholder="https://…/clip.mp4" />
    </div>
  );
}
