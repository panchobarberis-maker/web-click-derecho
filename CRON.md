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
