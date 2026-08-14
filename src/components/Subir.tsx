"use client";

import { useId, useRef, useState } from "react";
import { t as textos, type Lang } from "@/lib/i18n";

type Estado = { fase: "quieto" | "subiendo" | "listo" | "error"; pct?: number; msg?: string };
type Clase = "video" | "imagen";

const ACCEPT: Record<Clase, string> = {
  video: "video/mp4,video/webm,video/quicktime",
  imagen: "image/png,image/jpeg,image/webp,image/svg+xml",
};

/**
 * Elige un archivo y lo sube directo a Supabase.
 *
 * El archivo no pasa por nuestro servidor: se le pide un permiso firmado y el
 * navegador sube contra Supabase. Por eso se usa XMLHttpRequest y no fetch,
 * que todavia no reporta progreso de subida: sin barra, una subida de 20 MB
 * parece que se colgo y la gente recarga a la mitad.
 *
 * El campo de texto con la direccion queda visible y editable: si el estudio
 * ya tiene el archivo en otro lado, pega la direccion y no sube nada.
 */
export function SubirArchivo({
  name,
  clase,
  etiqueta,
  defaultValue = "",
  habilitado,
  maxMb,
  ayuda,
  vistaPrevia,
  lang = "es",
}: {
  name: string;
  clase: Clase;
  /** Como se llama el campo. Lo pone el componente, no la pantalla: si no,
      quedaban dos etiquetas encimadas ("Logo" y "Dirección de la imagen"). */
  etiqueta: string;
  defaultValue?: string;
  habilitado: boolean;
  maxMb: number;
  ayuda?: string;
  /** Muestra lo cargado. Solo para imagenes: un logo mal pegado se ve enseguida. */
  vistaPrevia?: boolean;
  lang?: Lang;
}) {
  const [url, setUrl] = useState(defaultValue);
  const [estado, setEstado] = useState<Estado>({ fase: "quieto" });
  const input = useRef<HTMLInputElement>(null);
  const x = textos(lang).comp;
  const id = useId();

  async function elegido(archivo: File) {
    setEstado({ fase: "subiendo", pct: 0 });

    const permiso = await fetch("/subir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: archivo.name, tipo: archivo.type, bytes: archivo.size, clase }),
    });

    const datos = await permiso.json().catch(() => ({}));
    if (!permiso.ok) return setEstado({ fase: "error", msg: datos.error ?? x.noEmpezo });

    try {
      await new Promise<void>((listo, falla) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", `${datos.subirA}?token=${encodeURIComponent(datos.token)}`);
        xhr.setRequestHeader("Content-Type", archivo.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setEstado({ fase: "subiendo", pct: Math.round((e.loaded / e.total) * 100) });
        };
        xhr.onload = () => (xhr.status < 300 ? listo() : falla(new Error(x.respondio(xhr.status))));
        xhr.onerror = () => falla(new Error(x.seCorto));
        xhr.send(archivo);
      });
    } catch (e) {
      return setEstado({ fase: "error", msg: e instanceof Error ? e.message : x.noSubio });
    }

    setUrl(datos.publica);
    setEstado({ fase: "listo" });
  }

  return (
    <div className="subir">
      <label className="lbl" htmlFor={habilitado ? undefined : id}>{etiqueta}</label>

      {habilitado && (
        <>
          <input
            ref={input}
            type="file"
            accept={ACCEPT[clase]}
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) elegido(f);
              e.target.value = "";
            }}
          />
          <button type="button" className="agregar" onClick={() => input.current?.click()}
                  disabled={estado.fase === "subiendo"}>
            {estado.fase === "subiendo"
              ? x.subiendo(estado.pct ?? 0)
              : clase === "video" ? x.subirVideo : x.subirImagen}
          </button>

          {estado.fase === "subiendo" && (
            <div className="meter" style={{ marginTop: ".5rem" }}>
              <span style={{ width: `${estado.pct ?? 0}%` }} />
            </div>
          )}
          {estado.fase === "listo" && (
            <p className="subir-ok">{clase === "video" ? x.videoSubido : x.imagenSubida}</p>
          )}
          {estado.fase === "error" && <p className="subir-error">{estado.msg}</p>}
        </>
      )}

      {/* El campo que se manda es este, no uno oculto: asi lo que se ve escrito
          es lo que se guarda, incluso si mandan el formulario antes de que la
          pagina termine de cargar. La subida lo unico que hace es completarlo. */}
      {/* Con la subida disponible este campo es la alternativa, y lo dice; sin
          ella es el campo principal y ya lo etiqueta el titulo de arriba. */}
      {habilitado && (
        <label className="lbl" htmlFor={id}>{clase === "video" ? x.pegarVideo : x.pegarImagen}</label>
      )}
      <input id={id} name={name} value={url}
             onChange={(e) => setUrl(e.target.value)}
             placeholder={clase === "video" ? "https://…/clip.mp4" : "https://…/logo.png"} />

      {/* Ver lo cargado evita el caso mas comun: una direccion que ya no existe
          y un logo roto en el formulario del estudio sin que nadie se entere. */}
      {/* La ayuda va siempre, no solo cuando se puede subir: quien tiene que
          pegar una direccion es el que mas necesita saber que va ahi. */}
      <p className="muted subir-ayuda">{ayuda ?? x.hastaMb(maxMb)}</p>

      {vistaPrevia && url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="subir-muestra" src={url} alt="" />
      ) : null}
    </div>
  );
}
