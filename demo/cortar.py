"""
Parte la locucion en una frase por archivo.

    python3 demo/cortar.py demo/voz-corto.mp3 demo/guion-corto.txt

La voz viene en un solo audio con todas las frases seguidas, asi que hay que
descubrir donde termina cada una. Los silencios solos no alcanzan: hay muchos
mas silencios que frases —cada coma es uno— y elegir por duracion se equivoca.
Se eligen los cortes que mejor explican el largo de cada linea: una frase de 90
caracteres dura mas o menos el doble que una de 45, y se busca la combinacion de
cortes que menos se aleja de eso. Es una alineacion, no un umbral.

Deja en demo/salida/:
  segmentos[-corto].json   cuanto dura cada frase, que es lo que el grabador
                           usa para que cada escena espere a su locucion
  voz[-corto]/NN.wav       una frase por archivo, para montarlas despues
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SALIDA = AQUI / "salida"
FF = os.environ.get("FFMPEG", str(AQUI.parent / "node_modules/ffmpeg-static/ffmpeg"))


def duracion(audio: Path) -> float:
    salida = subprocess.run([FF, "-hide_banner", "-i", str(audio)],
                            capture_output=True, text=True).stderr
    h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", salida).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


def silencios(audio: Path) -> list[tuple[float, float]]:
    """Los huecos candidatos. El umbral es generoso a proposito: sobran
    candidatos y la alineacion se encarga de descartar los que no van."""
    salida = subprocess.run(
        [FF, "-hide_banner", "-i", str(audio), "-af", "silencedetect=noise=-35dB:d=0.25", "-f", "null", "-"],
        capture_output=True, text=True).stderr
    ini = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", salida)]
    fin = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", salida)]
    return list(zip(ini, fin))


def alinear(cortes: list[float], previsto: list[float], total: float) -> list[float]:
    """Elige len(previsto)-1 cortes minimizando el error contra lo previsto."""
    N, K = len(cortes), len(previsto) - 1
    if N < K:
        raise SystemExit(f"solo {N} silencios para {K} cortes: el audio no tiene las pausas suficientes")

    INF = float("inf")
    pos = [0.0] + cortes
    coste = [[INF] * (K + 1) for _ in range(N + 1)]
    de = [[None] * (K + 1) for _ in range(N + 1)]
    coste[0][0] = 0.0

    for k in range(1, K + 1):
        for i in range(1, N + 1):
            for j in range(k - 1, i):
                if coste[j][k - 1] == INF:
                    continue
                e = coste[j][k - 1] + (pos[i] - pos[j] - previsto[k - 1]) ** 2
                if e < coste[i][k]:
                    coste[i][k], de[i][k] = e, j

    mejor, err = None, INF
    for i in range(1, N + 1):
        if coste[i][K] == INF:
            continue
        e = coste[i][K] + (total - pos[i] - previsto[K]) ** 2
        if e < err:
            err, mejor = e, i

    camino, i, k = [], mejor, K
    while k > 0:
        camino.append(pos[i])
        i, k = de[i][k], k - 1
    return list(reversed(camino))


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("uso: cortar.py <voz.mp3> <guion.txt>")
    audio, guion = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
    sufijo = "-corto" if "corto" in guion.name else ""

    lineas = [b.split("\n", 1)[1].strip()
              for b in guion.read_text(encoding="utf-8").strip().split("\n\n")]
    total = duracion(audio)

    # El corte va en el medio del silencio: deja aire al final de una frase y al
    # principio de la siguiente.
    cortes = [(a + b) / 2 for a, b in silencios(audio)]
    chars = [len(t) for t in lineas]
    previsto = [c / sum(chars) * total for c in chars]

    bordes = [0.0] + alinear(cortes, previsto, total) + [total]

    carpeta = SALIDA / f"voz{sufijo}"
    carpeta.mkdir(parents=True, exist_ok=True)
    segs = []
    for n, (a, b) in enumerate(zip(bordes, bordes[1:]), 1):
        subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", "-i", str(audio),
                        "-ss", str(round(a, 3)), "-to", str(round(b, 3)),
                        "-ar", "48000", "-ac", "1", str(carpeta / f"{n:02}.wav")], check=True)
        segs.append({"n": n, "ini": round(a, 3), "fin": round(b, 3),
                     "dura": round(b - a, 2), "esperado": round(previsto[n - 1], 2),
                     "texto": lineas[n - 1]})
        aviso = "  <-- revisar" if abs((b - a) - previsto[n - 1]) > 1.2 else ""
        print(f'{n:2}  {a:6.2f}→{b:6.2f}  {b - a:5.2f}s '
              f'(esperaba {previsto[n - 1]:4.2f}){aviso}  {lineas[n - 1][:52]}')

    destino = SALIDA / f"segmentos{sufijo}.json"
    destino.write_text(json.dumps(segs, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n{len(segs)} frases en {carpeta} · {destino}")


if __name__ == "__main__":
    main()
