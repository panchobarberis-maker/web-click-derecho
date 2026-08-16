"""
La cama de música del video.

    python3 demo/musica.py 86        # segundos

Si dejás una pista tuya en `demo/musica.mp3` (o .wav, .m4a), se usa esa y no se
genera nada. **Es lo que conviene**: esto de acá son ondas sintetizadas, suenan
a colchón y nada más. No puedo bajar música con licencia, y usar una pista
ajena en un video de venta es pedir un problema.

Lo que genera: cuatro acordes largos —Am7, Fmaj7, Cmaj7, G— que se repiten. Cada
nota son dos osciladores apenas desafinados entre sí, que es lo que evita que
suene a tono de prueba; después pasa por un filtro que se lleva los agudos, un
temblor lento de volumen y un eco corto para que tenga algo de aire.

Queda con el pico a -24 dB, medido y corregido: tiene que estar abajo de la
voz, no al lado. Poner una ganancia a ojo daba una cama inaudible.
"""
import os
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SALIDA = AQUI / "salida"
FF = os.environ.get("FFMPEG", str(AQUI.parent / "node_modules/ffmpeg-static/ffmpeg"))

# Am7 · Fmaj7 · Cmaj7 · G(add9). Todo en registro grave: lo agudo compite con la voz.
ACORDES = [
    [110.00, 164.81, 196.00, 261.63],
    [87.31, 130.81, 174.61, 220.00],
    [130.81, 196.00, 246.94, 329.63],
    [98.00, 146.83, 196.00, 246.94],
]
COMPAS = 5.0          # lo que dura cada acorde
DESAFINE = 0.35       # Hz entre los dos osciladores de cada nota


PICO = -20.0          # dB, el pico al que tiene que quedar la cama


def ff(args):
    subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def pico(archivo) -> float:
    """El pico real del archivo, para no calcular la ganancia a ojo."""
    salida = subprocess.run([FF, "-hide_banner", "-i", str(archivo), "-af", "volumedetect",
                             "-f", "null", "-"], capture_output=True, text=True).stderr
    import re
    return float(re.search(r"max_volume: (-?[\d.]+) dB", salida).group(1))


def acorde(notas, destino):
    entradas, filtros, etiquetas = [], [], []
    for i, hz in enumerate(notas):
        for j, f in enumerate((hz, hz + DESAFINE)):
            entradas += ["-f", "lavfi", "-i", f"sine=frequency={f}:duration={COMPAS}:sample_rate=48000"]
            # Las notas de arriba, mas bajas: si suenan todas igual queda un bloque.
            vol = 0.9 / (1 + i * 0.55)
            k = len(etiquetas)
            filtros.append(f"[{k}:a]volume={vol:.3f}[n{k}]")
            etiquetas.append(f"[n{k}]")
    n = len(etiquetas)
    filtros.append(
        "".join(etiquetas) + f"amix=inputs={n}:normalize=0,"
        # Entra y sale despacio: un acorde que corta seco suena a error.
        f"afade=t=in:d=1.4,afade=t=out:st={COMPAS - 1.8}:d=1.8[a]"
    )
    ff([*entradas, "-filter_complex", ";".join(filtros), "-map", "[a]", str(destino)])


def main() -> None:
    segundos = float(sys.argv[1]) if len(sys.argv) > 1 else 90.0
    SALIDA.mkdir(parents=True, exist_ok=True)
    destino = SALIDA / "musica.wav"

    propia = next((AQUI / f"musica.{e}" for e in ("mp3", "wav", "m4a", "aac")
                   if (AQUI / f"musica.{e}").exists()), None)
    if propia:
        ff(["-i", str(propia), "-t", str(segundos), "-ar", "48000", "-ac", "2", str(destino)])
        print(f"música propia: {propia} → {destino}")
        return

    bruto = SALIDA / "musica-bruto.wav"
    partes = []
    for i, notas in enumerate(ACORDES):
        p = SALIDA / f"acorde-{i}.wav"
        acorde(notas, p)
        partes.append(p)

    lista = SALIDA / "acordes.txt"
    # El ciclo entero dura 4 acordes; se repite hasta pasar el largo pedido.
    vueltas = int(segundos // (COMPAS * len(ACORDES))) + 2
    lista.write_text("".join(f"file '{p}'\n" for _ in range(vueltas) for p in partes))

    ff(["-f", "concat", "-safe", "0", "-i", str(lista),
        "-af", ",".join([
            "lowpass=f=1100",                       # se va lo brillante
            "tremolo=f=0.12:d=0.22",                # respira
            "aecho=0.8:0.85:420|730:0.28|0.2",      # aire
            "highpass=f=60",                        # se va el retumbe
            f"atrim=0:{segundos}",
            "afade=t=in:d=2.5",
            f"afade=t=out:st={max(0, segundos - 3)}:d=3",
        ]),
        "-ac", "2", "-ar", "48000", str(bruto)])

    # Recién ahora se sabe cuánto pesa la mezcla; la ganancia sale de medirla.
    ajuste = PICO - pico(bruto)
    ff(["-i", str(bruto), "-af", f"volume={ajuste:.1f}dB", str(destino)])
    bruto.unlink()

    for p in partes:
        p.unlink()
    lista.unlink()
    print(f"cama generada: {destino}  ({segundos:.0f}s, pico {pico(destino):.1f} dB)")
    print("\n  ⚠  Son ondas sintetizadas, no una pista de verdad.")
    print("     Si conseguís una con licencia, dejala en demo/musica.mp3 y volvé a correr esto.\n")


if __name__ == "__main__":
    main()
