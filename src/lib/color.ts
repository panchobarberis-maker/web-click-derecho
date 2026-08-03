/**
 * Que color de texto va arriba del color del estudio.
 *
 * Cada estudio elige su color y lo usamos de fondo en la banda del formulario.
 * Con un bordo o un azul marino el texto va en blanco, pero un estudio puede
 * elegir un dorado claro o un beige, y ahi el blanco no se lee. En vez de
 * confiar en que nadie elija un color claro, se mide.
 */

/** Luminancia relativa segun WCAG. 0 = negro, 1 = blanco. */
function luminancia(hex: string): number {
  const h = hex.trim().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return 0; // color raro: lo tratamos como oscuro

  const canal = (i: number) => {
    const v = parseInt(full.slice(i * 2, i * 2 + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
}

const TINTA = "#241c12"; // el marron casi negro del resto de la interfaz

/**
 * El texto que mejor contrasta contra ese fondo, entre blanco y la tinta.
 * Se queda con el que da mas contraste, que es lo unico que importa aca.
 */
export function sobreElColor(fondo: string): string {
  const l = luminancia(fondo);
  const conBlanco = 1.05 / (l + 0.05);
  const conTinta = (l + 0.05) / (luminancia(TINTA) + 0.05);
  return conBlanco >= conTinta ? "#ffffff" : TINTA;
}
