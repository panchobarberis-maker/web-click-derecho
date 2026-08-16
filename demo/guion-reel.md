# Right Lead — Instagram reel (20 s)

Vertical 9:16. Para el feed y para Reels. Público: dueños de estudios chicos y
medianos, en frío — no saben qué es Right Lead y no te dieron permiso para
explicarles nada. Eso manda todo lo de abajo.

---

## Dos cosas antes del texto

**No hay estadística.** El gancho dice «la mayoría» y no «el 70%», a propósito.
Un número en un anuncio hay que poder respaldarlo, y no tengo una fuente para
esa cifra. Si conseguís un estudio serio de abandono en formularios legales,
metelo — el gancho mejora mucho con un número. Inventarlo no es una opción.

**Sí lleva texto en pantalla, y no es lo mismo que subtítulos.** En el demo
pediste sin subtítulos y tenías razón: ahí molesta. Acá es otra cosa. En
Instagram la mayoría lo ve mudo y con el pulgar apoyado, así que el reel tiene
que funcionar sin audio. Pero no va la transcripción: van tres o cuatro palabras
grandes por golpe, que dicen algo por sí solas. Es un cartel, no un subtítulo.

---

## El guion

| Tiempo | En pantalla | Texto en pantalla | Locución |
|---|---|---|---|
| 0:00–0:03 | Un formulario a medio llenar. El cursor duda. La pestaña se cierra. | **They start.**<br>**They leave.** | Most people who start your intake form never finish it. |
| 0:03–0:05 | Negro un cuadro. Entra el panel. | **You never knew.** | You never even find out who they were. |
| 0:05–0:09 | La nota del blog → el aviso entra → se abre el formulario → área y tipo de caso. | **Right Lead** | Right Lead asks the visitor if they need help — and takes it from there. |
| 0:09–0:13 | La pestaña de abandonados. Su fila, con el paso en el que quedó. | **Her email.**<br>**Her last step.** | If she quits, you get her email and the step she stopped at. |
| 0:13–0:17 | El mail sale → se abre el formulario otra vez, ya lleno. | **She's back.** | One reminder, and she's back where she left off. |
| 0:17–0:20 | Placa final, logo. | **Right Lead**<br>*Link in bio* | Right Lead. Link in bio. |

**59 palabras.** A ritmo de reel son 20–22 segundos. Si al generarlo te da 24, no
lo aceleres: sacá la línea 2 («You never even find out who they were») y el texto
en pantalla la cubre igual.

---

## Copiar y pegar

```
01
Most people who start your intake form never finish it.

02
You never even find out who they were.

03
Right Lead asks the visitor if they need help — and takes it from there.

04
If she quits, you get her email and the step she stopped at.

05
One reminder, and she's back where she left off.

06
Right Lead. Link in bio.
```

---

## Ganchos alternativos

En Instagram el gancho es casi todo el resultado, y no se adivina cuál funciona:
se prueban. Los tres van con el mismo cuerpo, solo se cambian los primeros tres
segundos.

**A — la pérdida** (el de arriba, el más seguro)
> Most people who start your intake form never finish it.

**B — la pregunta** (funciona bien con dueños de estudio: se la contestan solos)
> How many people started your intake form last month and never finished?
> You don't know. That's the problem.

**C — en medio de la acción** (el más nativo de Reels, arranca mostrando)
> Watch this. She's about to close your intake form halfway through.
> *(la pestaña se cierra)* Most firms lose her right here.

Con el C hay que recortar una línea del cuerpo: el gancho ya se comió cinco
segundos.

---

## Las tomas

Casi todo sale de lo que ya está grabado. `grabar-corto.mjs` tiene las escenas
—la nota del blog con sus UTM, el aviso, el formulario, la pestaña de
abandonados, el mail, el formulario que vuelve lleno— y hay que recortarlas a
9:16 y acelerarlas.

**Falta una toma nueva:** el abandono visto desde el lado del visitante. Hoy el
abandono se cuenta desde el panel, y para el gancho hace falta verlo pasar —el
formulario a medio llenar, el cursor que duda, la pestaña que se cierra. Son
tres segundos y se graban con el mismo Playwright. Decime y la agrego a un
`grabar-reel.mjs`.

Lo demás del corte:

- **Rápido.** Ningún plano pasa de dos segundos y medio. El demo respira; el reel
  no puede.
- **Zoom donde importa.** A ese tamaño la pantalla entera no se lee: cuando entra
  el aviso, encuadre cerrado sobre el aviso.
- **Los tres primeros segundos sin marca.** El logo al principio hace que el
  pulgar siga de largo.

---

## La voz

Mismo circuito que el demo: se genera aparte y se monta con `cortar.py` y
`montar.py`.

Para el reel conviene una voz distinta a la del demo. Ahí es alguien
compartiendo pantalla; acá es alguien que te frena en la mitad del scroll. Más
directa, menos tibia.

En ElevenLabs, sobre las líneas de arriba: *«Direct, confident, slightly urgent.
Short pauses between lines, not long ones. This is a 20-second social ad, not a
narration.»*

Música: la misma cama de `musica.py` sirve, pero para 20 segundos generala de
nuevo con el largo justo (`python3 demo/musica.py 20`). Y para redes conviene
subirla — el objetivo de -30 dB está calculado contra una locución tranquila; en
un reel la cama puede ir en -26 sin tapar nada.

---

## El pie del posteo

> Alguien lee tu nota del blog, empieza tu formulario y lo abandona a la mitad.
> Hoy eso no te llega de ninguna forma: no existe.
>
> Right Lead te lo muestra. Con qué caso entró, en qué paso se fue, el mail, y de
> qué nota del blog vino. Y le manda un recordatorio con un link que la devuelve
> a su propio formulario, con todo lo que ya había escrito.
>
> Link en la bio.

Sin hashtags de relleno. Tres o cuatro que digan algo (`#lawfirmmarketing`,
`#legalmarketing`, `#lawfirmgrowth`) y listo; treinta hashtags genéricos hoy no
mueven nada y ensucian.

---

## Si querés una segunda pieza

Este reel es la presentación. El que suele rendir mejor después es uno solo sobre
el abandono, sin explicar el resto de la aplicación: es lo único que no tiene
nadie más y se cuenta entero en quince segundos. Decime y lo escribo.
