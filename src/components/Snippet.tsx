"use client";

import { useState } from "react";

/** Bloque de código con botón de copiar: el snippet se copia, no se transcribe. */
export function Snippet({ code }: { code: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <div className="snippet-wrap">
      <pre className="snippet">{code}</pre>
      <button
        type="button"
        className="copiar"
        onClick={() => {
          navigator.clipboard.writeText(code).then(() => {
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
          });
        }}
      >
        {copiado ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
