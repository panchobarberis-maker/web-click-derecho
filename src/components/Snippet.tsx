"use client";

import { useState } from "react";
import { t as textos, type Lang } from "@/lib/i18n";

/** Bloque de código con botón de copiar: el snippet se copia, no se transcribe. */
export function Snippet({ code, lang = "es" }: { code: string; lang?: Lang }) {
  const x = textos(lang).widgets;
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
        {copiado ? x.copiado : x.copiar}
      </button>
    </div>
  );
}
