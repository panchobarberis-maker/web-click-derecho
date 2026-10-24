# Cómo se cuentan los videos de Right Lead

Esto no es un guion: es la decisión de qué se vende y con qué sujeto, para no
volver a discutirla en cada pieza. Vale para todo lo que se haga de acá en
adelante.

## Right Lead es una agencia, no un software

Los servicios son cinco:

- Diseño web
- Optimización de GMB (la ficha de Google / Maps)
- SEO
- Creación de contenido
- Construcción de autoridad

**No hay campañas pagas en el discurso.** Todo lo que se vende es orgánico.

El error a evitar es que el sujeto de las frases sea la aplicación. «Right Lead
le pregunta al visitante si necesita ayuda» suena a que se vende software.
«Nosotros ponemos esto en tu sitio» es el mismo plano y otro negocio.

## La app no es el producto: es la prueba

Y por eso no hay que mostrarla menos, hay que mostrarla en otro lugar del
argumento.

Todas las agencias de marketing jurídico dicen lo mismo y el abogado lo sabe.
Casi ninguna tiene tecnología propia: alquilan herramientas de terceros. La app
es lo que hace creíble al resto, no una línea más del catálogo.

Los cinco servicios hacen todos lo mismo —traer gente al sitio— y todos terminan
en el mismo instante: alguien llega. Ahí la agencia típica se detiene y manda un
informe de posiciones. Con tráfico pago eso duele porque es plata; **con
orgánico duele más, porque son seis meses de trabajo que no se compran con una
tarjeta.**

## La línea central

> Las otras agencias te mandan un informe de posiciones.
> Nosotros te decimos qué artículo te trajo un caso.

Ninguna agencia de SEO puede decir eso, porque ninguna sabe qué pasó después del
clic. Es la pantalla de atribución, que ya existe y ya está grabada. Un abogado
no compra el puesto tres: compra casos.

## Cada servicio tiene su pantalla

| Servicio | Qué se ve | Cómo cierra la app |
|---|---|---|
| Diseño web | el sitio del estudio | el formulario vive ahí |
| GMB | la ficha de Maps, las reseñas | cuántas consultas vinieron de Maps |
| SEO | el resultado de búsqueda | qué búsqueda trajo el caso |
| Contenido | la nota del blog | **qué nota trajo el caso** |
| Autoridad | el abogado hablando en video | el clip *es* el servicio funcionando |

Lo de autoridad conviene tenerlo presente: el clip en la esquina del sitio no se
explica como función del software, se muestra como el servicio andando.

## Los tres videos son tres trabajos distintos

| Pieza | Para quién | Estado |
|---|---|---|
| Demo de 1:25 | alguien que ya está en conversación y quiere ver cómo funciona | **hecha, no se toca** |
| Reel | alguien que no conoce Right Lead | el actual queda; los próximos van con este posicionamiento |
| Resultados de un cliente real | el que más convierte de los tres | no se puede hacer todavía |

## El reparto de los quince

Cinco por servicio quedan como cinco veces el mismo video. Mejor:

- **5 por servicio.** Cada uno con el mismo remate: el servicio trae gente, la
  app prueba que llegó y la recupera si se va.
- **4 rompiendo objeciones:** «ya tengo web y no me entra nada», «el SEO tarda
  mucho», «ya probé una agencia», «yo contesto por WhatsApp».
- **3 sobre lo que nadie más hace:** el abandono, la atribución por artículo, el
  clip.
- **3 libres**, reservados para cuando haya resultados de un cliente real.

## Pendiente cuando se retome

Decisiones que quedaron abiertas y que hay que cerrar antes de grabar:

1. **El layout del splitscreen:** avatar en franja abajo, o en círculo en la
   esquina. Define a qué tamaño se graba la app, así que va primero.
2. **`avatar_id` y `voice_id` de HeyGen.** Se sacan con `heygen-listar.mjs`.
3. **Material de b-roll** en `demo/material/`. Sin eso los videos son solo
   pantalla de aplicación, que es justo lo que no se quiere.

Y dos cosas a resolver que no son de acá:

- **El origen del tráfico en la demo dice `google / cpc`**, o sea anuncio pago.
  Contradice el posicionamiento. Se decidió no tocarlo por ahora; cuando se
  retome, va a búsqueda orgánica.
- **La ficha de GMB y el resultado de búsqueda no son la aplicación.** Se pueden
  dibujar y grabar, pero serían reproducciones. Conviene una captura real, de un
  cliente o propia: se ve auténtica y no corre riesgo de parecer inventada.
