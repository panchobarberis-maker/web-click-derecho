# El video de demostración

Los dos videos de `video/` no son una animación ni un montaje de capturas: son
la aplicación de verdad, corriendo contra una base de verdad, grabada con
Playwright. Lo único agregado encima es un puntero y los subtítulos, porque
Playwright no graba el cursor del sistema.

Todo esto está acá para poder **volver a grabarlos** cuando la aplicación cambie
—o cuando haya que cambiar el guion— sin rehacer el trabajo.

| Archivo | Qué es |
|---|---|
| `video/right-lead-corto-en.mp4` | 0:59. El recorrido completo, el abandono, las dos superficies y la atribución. Para redes y primer contacto. **Sin locución todavía**: el guion se rehizo y la voz está pendiente. |
| `video/right-lead-demo-en.mp4` | 2:04, con locución. La primera versión, con la historia contada de otra forma. Para una reunión. |

Los dos están en inglés.

El corto va en este orden, y el orden es la parte pensada: primero el proceso
**entero** —alguien llega desde una nota del blog, consulta, y al estudio le
llega completa—, y recién después qué pasa cuando alguien no termina. Al revés
no se entiende: no se puede explicar el abandono de algo que todavía no se
mostró. Después las dos formas que tiene el formulario de aparecer en un sitio
—pop-up y clip— y al final de dónde vino la consulta.

## El estudio del video es inventado

`Whitfield & Marsh`, abogados laboralistas en Columbus, Ohio, con su propio
sitio, su cuenta y dos meses de historial generado. **Ningún dato de ningún
cliente real aparece en los videos**, y conviene que siga siendo así.

Lo crea `estudio-en.mjs`, que es idempotente: correrlo de nuevo lo borra y lo
vuelve a armar.

## Volver a grabar

Hace falta la aplicación corriendo en `localhost:3000` contra una base con el
esquema al día.

```bash
# 1. Dependencias que solo usa esto (no van en package.json: engordan el build)
npm i --no-save playwright ffmpeg-static

# 2. El sitio del estudio necesita resolver a esta máquina
echo "127.0.0.1 whitfieldmarsh.com" | sudo tee -a /etc/hosts

# 3. Los mails del video los arma la misma función que usa la aplicación,
#    así que se compila desde src/ en vez de copiarse a mano
mkdir -p demo/.build && cp src/lib/{i18n,mailer,forms}.ts demo/.build/
sed -i 's|from "./i18n"|from "./i18n.js"|; s|from "./db"|from "./db.js"|' demo/.build/*.ts
echo 'export {};' > demo/.build/db.ts
npx tsc demo/.build/*.ts --module esnext --target es2022 --moduleResolution bundler --skipLibCheck

# 4. El estudio de demostración y el video del clip
node demo/estudio-en.mjs
node demo/clip.mjs

# 5. A grabar (deja el .webm crudo y los tiempos en demo/salida/)
node demo/grabar-corto.mjs      # o grabar.mjs para el largo
```

Sin locución eso ya da un video mudo con subtítulos, en `demo/salida/crudo*/`.

El paso 3 falla con errores de tipos (`process` no existe, etc.) y **está bien**:
igual emite los `.js`, que es lo único que se necesita.

## La locución

El video se acomoda a la voz, no al revés: cada escena espera a que termine su
frase. Por eso el orden es guion → voz → grabar → montar.

1. `guion-corto.md` / `guion-locucion.md` tienen el texto, los tiempos y las
   instrucciones para generarlo.
2. La voz se genera aparte (se usó ElevenLabs) y se guarda como `voz-corto.mp3`
   o `voz.mp3`. La del corto no está en el repo: el guion cambió y hay que
   volver a generarla.
3. `cortar.py` la parte en una frase por archivo. Vienen todas seguidas en un
   solo audio, así que los cortes se buscan alineando los silencios con el largo
   esperado de cada línea —una frase de 90 caracteres dura el doble que una de
   45— y se elige la combinación que menos se aleja. Deja `segmentos-*.json`.
4. Se vuelve a grabar: con `segmentos-*.json` presente, cada escena dura lo que
   dura su frase.
5. `montar.py` pega cada audio en el segundo exacto en que entra su cartel
   —el grabador los deja anotados en `tiempos-*.json`— y exporta el mp4.

```bash
python3 demo/cortar.py demo/voz-corto.mp3 demo/guion-corto.txt
node demo/grabar-corto.mjs
python3 demo/montar.py --corto
```

Para el largo es lo mismo sin `-corto` ni `--corto`:
`cortar.py demo/voz.mp3 demo/guion-locucion.txt`, `grabar.mjs`, `montar.py`.

`cortar.py` imprime cuánto duró cada frase contra lo que se esperaba. Si alguna
sale marcada con «revisar», el corte de esa línea probablemente cayó mal y hay
que mirarla antes de montar.

## Qué es cada archivo

| Archivo | Qué hace |
|---|---|
| `grabar.mjs` · `grabar-corto.mjs` | El guion de lo que se hace en pantalla. Es donde se cambia qué se muestra y en qué orden. |
| `escena.mjs` | El puntero, los subtítulos y las placas. También lleva la cuenta de en qué segundo entra cada frase. |
| `sitio.mjs` | El sitio del estudio y la casilla de mail. Es el escenario, no parte de la aplicación. |
| `estudio-en.mjs` | El estudio inventado: áreas, formularios, pop-ups, clips y dos meses de tráfico. |
| `clip-fondo.html` · `clip.mjs` | La placa vertical del clip y el script que la convierte en video. Es un relleno: **reemplazar por una grabación real del abogado**, que es lo que hace que un clip sirva. |
| `cortar.py` · `montar.py` | Partir la locución y pegarla al video. |

## Un detalle que importa

Todo lo que se ve es real menos dos cosas, y conviene tenerlas presentes antes
de mostrarle el video a alguien:

- **El contenido del clip** es una placa con la marca, no una persona hablando.
  Es lo primero que conviene reemplazar: un clip funciona porque se ve la cara
  del abogado.
- **El historial** del estudio es tráfico generado. Las proporciones son
  verosímiles (se abre entre el 3% y el 9% de las veces que se muestra un
  pop-up), pero son números inventados y no hay que presentarlos como
  resultados de un cliente.
