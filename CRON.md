# El job de recuperación de abandonos

`/api/cron/recover` busca a quienes dejaron el mail y no terminaron el
formulario hace más de 45 minutos, y les manda el recordatorio. Cada sesión se
marca como contactada, así que correrlo de más no duplica mails.

## La restricción del plan gratuito de Vercel

En el plan **Hobby** los cron jobs **corren una vez por día**. Por eso
`vercel.json` viene con `0 12 * * *` (12:00 UTC, 9 de la mañana en Argentina):
con `*/15 * * * *` el deploy directamente falla.

Una vez al día funciona, pero no es lo ideal: el valor del recordatorio baja
cuanto más tarde llega. Alguien que abandonó el formulario a las 10 de la
mañana recibe el mail al otro día.

## Cómo llegar a cada 15 minutos

**Opción A — un cron externo, gratis.** En [cron-job.org](https://cron-job.org)
(o similar) creás un job cada 15 minutos contra:

```
https://TU-APP.vercel.app/api/cron/recover
```

con este header:

```
Authorization: Bearer EL_VALOR_DE_CRON_SECRET
```

Y dejás el cron de Vercel como está o lo sacás. El endpoint no hace nada si no
hay abandonos pendientes.

**Opción B — Vercel Pro** (US$20/mes), que permite cualquier frecuencia. Solo
tiene sentido si ya estás pagando Pro por otra cosa.

## Probarlo a mano

```bash
curl -H "Authorization: Bearer TU_CRON_SECRET" https://TU-APP.vercel.app/api/cron/recover
```

Responde `{"candidatos":N,"enviados":N}`.

---

# El resumen diario: a quién llamar hoy

`/api/cron/digest` hace dos cosas en la misma corrida:

1. **Puntúa las consultas sin abrir** con Claude, de todos los estudios y de a
   veinte por vez. Guarda el veredicto en la consulta, así no se vuelve a pagar
   por releer lo mismo y el panel puede mostrarlo.
2. **Manda el resumen** a los estudios a los que, *en su hora local*, les toca
   ahora.

Es idempotente: se puede llamar todas las veces que quieras. El estudio que ya
recibió el suyo no lo recibe de nuevo hasta pasadas 20 horas, y si el mail
falla la marca se borra para que el próximo intento lo reintente.

```bash
curl -H "Authorization: Bearer TU_CRON_SECRET" https://TU-APP.vercel.app/api/cron/digest
```

Responde `{"estudios":N,"puntuadas":N,"enviados":N}`.

## Qué se configura por estudio

| Columna | Qué es | Por defecto |
|---|---|---|
| `firms.triage_contexto` | Qué casos quiere el estudio, escrito por el estudio | vacío |
| `firms.timezone` | Zona horaria IANA (`America/Argentina/Buenos_Aires`) | `UTC` |
| `firms.digest_hora` | Hora local a la que sale el resumen | `8` |
| `firms.digest_dias` | Días ISO separados por coma (1 = lunes) | `1,2,3,4,5` |

`triage_contexto` es lo que hace que el triage sirva. Sin eso el modelo puntúa
en el vacío; con eso cada cliente de la agencia tiene su propio criterio:

> Tomamos despidos, accidentes laborales y sucesiones. No tomamos casos penales
> ni reclamos de menos de 500 mil pesos. Solo provincia de Buenos Aires.

## Otra vez la restricción del plan Hobby

Igual que con el de recuperación: **en Hobby los cron corren una vez por día**,
y un `0 * * * *` en `vercel.json` hace fallar el deploy. Por eso queda en
`0 11 * * *` (11:00 UTC, 8 de la mañana en Argentina).

Eso tiene una consecuencia que conviene entender: **con una sola corrida diaria
la hora por estudio no funciona de verdad.** El resumen sale solo para los
estudios cuya hora local, en ese momento exacto, coincide con su `digest_hora`.
Con 11:00 UTC eso son las 8 de la mañana en Argentina y nada más: un estudio en
Ohio con `digest_hora = 8` no recibe nunca.

Para que la hora por estudio funcione hace falta que el endpoint se llame **una
vez por hora**, y ahí valen las mismas dos opciones:

- **Un cron externo gratis** ([cron-job.org](https://cron-job.org)) cada hora
  contra `/api/cron/digest`, con el header `Authorization: Bearer <CRON_SECRET>`.
- **Vercel Pro**, y entonces sí `0 * * * *` en `vercel.json`.

Mientras haya un solo huso horario entre los clientes, con la corrida diaria
alcanza: se pone la hora UTC que corresponda y listo.

## Sin `ANTHROPIC_API_KEY` el resumen sale igual

El triage se saltea y las consultas aparecen marcadas «Sin analizar», ordenadas
por fecha. El correo no se cae por eso, y tampoco se cae si el modelo falla en
una consulta puntual: esa queda sin puntaje y va al final de la lista, no
desaparece.

## El resumen ordena, no descarta

El correo dice «estas conviene mirarlas primero», nunca «estas son las buenas»,
muestra el total de pendientes arriba y lleva una aclaración al pie. No es un
detalle de redacción: un caso mal puntuado que nadie abre puede ser un caso
perdido con un plazo vencido, y de eso responde el estudio. Si alguna vez se
toca ese texto, conviene no aflojar ahí.
