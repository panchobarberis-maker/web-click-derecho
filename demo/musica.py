"""
La cama de música del video.

    python3 demo/musica.py 86        # segundos

Si dejás una pista tuya en `demo/musica.mp3` (o .wav, .m4a), se usa esa y no se
genera nada. **Es lo que conviene**: esto de acá son ondas sintetizadas, suenan
a colchón y nada más. No puedo bajar música con licencia, y usar una pista
ajena en un video de venta es pedir un problema.

Lo que genera: cuatro acordes largos —Am7, Fmaj7, Cmaj7, G— que se repiten, con
un arpegio encima. Cada nota son dos osciladores apenas desafinados entre sí,
que es lo que evita que suene a tono de prueba.

El arpegio no es un adorno, es lo que hace que se escuche. La primera versión
era solo el colchón grave, entre 90 y 330 Hz y con el filtro en 1100: medido
estaba, pero un parlante de teléfono o de notebook no baja hasta ahí y en la
práctica no sonaba nada. El arpegio vive entre 350 y 660 Hz —más un armónico una
octava arriba— que es donde esos parlantes andan bien.

**El nivel se fija midiendo la banda de 300 a 3000 Hz, no el pico.** Es la
diferencia entre las dos versiones que no se escuchaban y esta: el pico se puede
poner donde uno quiera y seguir siendo inaudible si toda esa energía está en los
graves. Con el pico a -16 dB la cama tenía la banda media en -41, veintidós dB
abajo de la voz: no se oía. Ahora se apunta la banda media a -30, que contra una
voz que promedia -19 queda once dB abajo —presente en los silencios, debajo de
todo cuando alguien habla.
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
# El arpegio de cada acorde: cuatro notas, en el registro que reproduce
# cualquier parlante.
ARPEGIOS = [
    [440.00, 523.25, 659.25, 523.25],
    [349.23, 440.00, 523.25, 440.00],
    [392.00, 493.88, 659.25, 493.88],
    [392.00, 493.88, 587.33, 493.88],
]
COMPAS = 5.0          # lo que dura cada acorde
DESAFINE = 0.35       # Hz entre los dos osciladores de cada nota


# El objetivo real. La voz del video promedia -19 dB en esta misma banda.
MEDIOS = -30.0        # dB, promedio de 300 a 3000 Hz
TECHO = -9.0          # dB, pico maximo: por arriba de esto empieza a estorbar


def ff(args):
    subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def medir(archivo, banda=False) -> tuple:
    """(pico, promedio) del archivo. Con banda=True mide solo 300-3000 Hz, que es
    lo que reproduce un parlante de telefono o de notebook."""
    import re
    af = "highpass=f=300,lowpass=f=3000,volumedetect" if banda else "volumedetect"
    salida = subprocess.run([FF, "-hide_banner", "-i", str(archivo), "-af", af,
                             "-f", "null", "-"], capture_output=True, text=True).stderr
    return (float(re.search(r"max_volume: (-?[\d.]+) dB", salida).group(1)),
            float(re.search(r"mean_volume: (-?[\d.]+) dB", salida).group(1)))


def acorde(notas, arpegio, destino):
    """El colchon del acorde, con su arpegio encima."""
    entradas, filtros, etiquetas = [], [], []

    for i, hz in enumerate(notas):
        for f in (hz, hz + DESAFINE):
            entradas += ["-f", "lavfi", "-i", f"sine=frequency={f}:duration={COMPAS}:sample_rate=48000"]
            # El colchon va bajo a proposito: son ocho osciladores graves y si
            # pesan lo mismo que el arpegio se comen toda la mezcla en 100-250 Hz,
            # que es justo lo que despues no sale por el parlante.
            vol = 0.45 / (1 + i * 0.55)
            k = len(etiquetas)
            filtros.append(f"[{k}:a]volume={vol:.3f}[n{k}]")
            etiquetas.append(f"[n{k}]")

    # Una nota cada COMPAS/4, con ataque corto y cola larga: suena a pulsada y
    # no a bloque, y es la capa que sobrevive en un parlante chico. Cada nota
    # lleva su octava arriba, floja: estira el arpegio hasta 1300 Hz y ahi
    # cualquier parlante lo reproduce entero.
    paso = COMPAS / len(arpegio)
    for i, hz in enumerate(arpegio):
        for f, vol in ((hz, 1.0), (hz * 2, 0.3)):
            entradas += ["-f", "lavfi", "-i",
                         f"sine=frequency={f}:duration={paso}:sample_rate=48000"]
            k = len(etiquetas)
            filtros.append(
                f"[{k}:a]afade=t=in:d=0.02,afade=t=out:st=0.12:d={paso - 0.14}:curve=exp,"
                f"volume={vol},adelay={int(i * paso * 1000)}|{int(i * paso * 1000)}[n{k}]")
            etiquetas.append(f"[n{k}]")

    n = len(etiquetas)
    filtros.append(
        "".join(etiquetas) + f"amix=inputs={n}:normalize=0,"
        # Entra y sale despacio: un acorde que corta seco suena a error.
        f"afade=t=in:d=1.4,afade=t=out:st={COMPAS - 1.6}:d=1.6,"
        f"atrim=0:{COMPAS}[a]"
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
        acorde(notas, ARPEGIOS[i], p)
        partes.append(p)

    lista = SALIDA / "acordes.txt"
    # El ciclo entero dura 4 acordes; se repite hasta pasar el largo pedido.
    vueltas = int(segundos // (COMPAS * len(ACORDES))) + 2
    lista.write_text("".join(f"file '{p}'\n" for _ in range(vueltas) for p in partes))

    ff(["-f", "concat", "-safe", "0", "-i", str(lista),
        "-af", ",".join([
            "lowpass=f=3200",                       # calida, pero no sorda
            "tremolo=f=0.12:d=0.14",                # respira, apenas
            "aecho=0.8:0.85:420|730:0.28|0.2",      # aire
            "highpass=f=120",                       # se va el retumbe que igual no suena
            # Inclina la mezcla hacia donde se escucha. Sin esto la cama pesa en
            # los graves y el medidor da bien mientras el parlante no da nada.
            "equalizer=f=800:width_type=o:width=2.5:g=5",
            # Sin esto el promedio queda veinte dB abajo del pico y la cama
            # aparece y desaparece en vez de sostenerse.
            "acompressor=threshold=0.05:ratio=4:attack=80:release=600",
            f"atrim=0:{segundos}",
            "afade=t=in:d=2.5",
            f"afade=t=out:st={max(0, segundos - 3)}:d=3",
        ]),
        "-ac", "2", "-ar", "48000", str(bruto)])

    # Recién ahora se sabe cuánto pesa la mezcla; la ganancia sale de medirla,
    # y se mide la banda que se escucha, no el total.
    tope, _ = medir(bruto)
    _, medios = medir(bruto, banda=True)
    ajuste = min(MEDIOS - medios, TECHO - tope)
    ff(["-i", str(bruto), "-af", f"volume={ajuste:.1f}dB", str(destino)])
    bruto.unlink()

    for p in partes:
        p.unlink()
    lista.unlink()
    tope, _ = medir(destino)
    _, medios = medir(destino, banda=True)
    print(f"cama generada: {destino}  ({segundos:.0f}s)")
    print(f"  pico {tope:.1f} dB · banda 300-3000 Hz {medios:.1f} dB (objetivo {MEDIOS:.0f})")
    if medios < MEDIOS - 1.5:
        print("  ⚠  la banda media quedó corta: el techo de pico no dejó subir más")
    print("\n  ⚠  Son ondas sintetizadas, no una pista de verdad.")
    print("     Si conseguís una con licencia, dejala en demo/musica.mp3 y volvé a correr esto.\n")


if __name__ == "__main__":
    main()
