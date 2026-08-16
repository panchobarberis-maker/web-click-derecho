"""
Pega la locucion al video y exporta el mp4 final.

    python3 demo/montar.py --corto

Cada frase va en el segundo en que entra su escena: el grabador dejo anotado
cuando aparece cada cartel en tiempos[-corto].json, asi que no hay que
sincronizar a ojo. Los audios se suman sobre una sola pista —no se promedian
(normalize=0)— porque no se pisan entre si y promediar solo bajaria el volumen.

Si esta salida/musica.wav, va abajo de todo como cama. La voz la agacha cuando
habla (sidechaincompress): sin eso, una cama que se escucha en los silencios
tapa la voz cuando entra.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SALIDA = AQUI / "salida"
FF = os.environ.get("FFMPEG", str(AQUI.parent / "node_modules/ffmpeg-static/ffmpeg"))


def main() -> None:
    sufijo = "-corto" if "--corto" in sys.argv else ""

    crudos = sorted((SALIDA / f"crudo{sufijo}").glob("*.webm"))
    if not crudos:
        raise SystemExit(f"no hay grabacion en {SALIDA / f'crudo{sufijo}'}: corré primero el grabador")
    tiempos = json.loads((SALIDA / f"tiempos{sufijo}.json").read_text(encoding="utf-8"))
    voces = SALIDA / f"voz{sufijo}"

    entradas, filtros, etiquetas = [], [], []
    for e in tiempos:
        archivo = voces / f"{e['n']:02}.wav"
        if not archivo.exists():
            raise SystemExit(f"falta {archivo}: corré cortar.py antes")
        entradas += ["-i", str(archivo)]
        i = len(etiquetas) + 1                       # 0 es el video
        # La primera frase no tiene silencio adelante y la placa tarda medio
        # segundo en aparecer: sin esto la voz arranca sobre una pantalla vacia.
        ms = int((e["seg"] + (0.6 if e["n"] == 1 else 0)) * 1000)
        filtros.append(f"[{i}:a]adelay={ms}|{ms}[a{i}]")
        etiquetas.append(f"[a{i}]")

    filtros.append("".join(etiquetas) + f"amix=inputs={len(etiquetas)}:normalize=0[voz]")

    musica = SALIDA / "musica.wav"
    if musica.exists():
        entradas += ["-i", str(musica)]
        i = len(etiquetas) + 1
        # La cama se agacha 9 dB cuando hay voz y vuelve despacio al terminar.
        filtros.append(f"[voz]asplit=2[voz1][llave]")
        filtros.append(
            f"[{i}:a][llave]sidechaincompress=threshold=0.03:ratio=6:attack=25:release=900[cama]")
        filtros.append("[voz1][cama]amix=inputs=2:normalize=0:dropout_transition=0[mezcla]")
        pista = "[mezcla]"
    else:
        pista = "[voz]"

    destino = AQUI / "video" / f"right-lead{sufijo or '-demo'}-en.mp4"
    destino.parent.mkdir(parents=True, exist_ok=True)

    # Sin -shortest: la voz termina antes que el video y la placa final tiene
    # que quedar un momento en silencio, no cortarse con la ultima palabra.
    subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", "-i", str(crudos[0]), *entradas,
                    "-filter_complex", ";".join(filtros),
                    "-map", "0:v", "-map", pista,
                    "-vf", "scale=1280:720:flags=lanczos,fps=30",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
                    "-movflags", "+faststart", str(destino)], check=True)
    print(f"listo: {destino}")


if __name__ == "__main__":
    main()
