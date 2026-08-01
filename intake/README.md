# Intake — formularios de consulta + analytics para estudios jurídicos

Clon funcional del núcleo de Lawbrokr, en castellano y adaptado a Argentina.

El mecanismo central: **el contacto se pide en el paso 1 y se guarda solo, antes
de que la persona termine**. Por eso se puede recuperar a los que abandonan —
que en el tráfico típico son más que los que completan.

## Modelo

```
Estudio
 └── Área de práctica        (Laboral, Familia, Accidentes…)
      └── Formulario         (Despido sin causa, Trabajo en negro…)
           └── Pasos         (JSON: título + campos)
```

El visitante elige su área, después su caso, y responde solo las preguntas de
ese caso. Cada estudio define sus propias áreas y sus propios formularios: no hay
un cuestionario único para todos.

## Qué hace

| | |
|---|---|
| **Formulario multi-paso** | Barra de progreso, validación, guardado automático en cada cambio |
| **Recuperación de abandonos** | Job que le escribe a quien dejó el mail y no terminó, con link para retomar donde quedó |
| **Analytics** | Visitas, arranques, envíos, conversión, serie temporal, atribución por origen, rendimiento por área y por superficie |
| **Drop-off por paso** | Cuánta gente llega a cada paso. La caída más grande es el paso a rediseñar |
| **Bandeja de consultas** | Enviadas / abandonadas, no leídas, detalle con todas las respuestas |
| **Widget embebible** | Pop-up, botón flotante o formulario inline, en una línea de `<script>` |
| **Aviso al estudio** | Mail con el caso formateado apenas entra una consulta |

## Arranque local

```bash
createdb intake
cp .env.example .env.local
npm install
npm run db:setup -- --demo    # esquema + estudio de ejemplo + tráfico falso
npm run dev
```

- Panel: http://localhost:3000
- Formulario público: http://localhost:3000/f/alzogaray-serrano

Sin `RESEND_API_KEY` los mails no se mandan: se imprimen en la consola del
servidor. El flujo completo se puede probar sin cuenta de nada.

Para probar el job de recuperación sin esperar los 45 minutos:

```bash
curl -H "Authorization: Bearer dev-secret" localhost:3000/api/cron/recover
```

## Definir los formularios de un estudio

Están en `db/seed-data.mjs` como JSON y se cargan con `npm run db:setup`.
Tipos de campo: `text`, `email`, `tel`, `textarea`, `select`, `radio`, `date`.

```js
{
  name: "Despido sin causa",
  slug: "despido-sin-causa",
  steps: [
    contacto,                        // paso 1: nombre + email + teléfono
    { title: "Sobre tu trabajo", fields: [
        { key: "empresa", label: "Empresa", type: "text", required: true },
        { key: "antiguedad", label: "Antigüedad", type: "select",
          required: true, options: ["Menos de 1 año", "1 a 3 años", "Más de 3"] },
    ]},
  ],
}
```

**El paso 1 tiene que pedir el email.** Es lo que habilita todo lo demás: si la
persona se va en el paso 3, sin el mail no hay nada que recuperar.

## Instalación en el sitio del estudio

```html
<script src="https://TU-APP/w.js"
        data-firm="alzogaray-serrano"
        data-mode="popup"
        data-trigger="delay:12"></script>
```

- `data-mode`: `popup` · `button` (botón flotante) · `inline` (embebido en un `data-target`)
- `data-trigger`: `delay:N` · `scroll:N` (% de la página) · `exit` (exit intent) · `now`
- `data-funnel` / `data-workflow`: saltear el menú y abrir un formulario puntual
- `data-once="false"`: mostrar el pop-up más de una vez por sesión

Todo va dentro de un iframe, así que el CSS del sitio del estudio no puede
romper el formulario ni al revés.

## Despliegue

Vercel + Supabase entran en el free tier de los dos.

1. Crear el proyecto en Supabase y correr `db/schema.sql` en el SQL Editor.
2. En Vercel setear `DATABASE_URL` (el connection string *pooled* de Supabase),
   `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, `RESEND_FROM` y `CRON_SECRET`.
3. Agregar `vercel.json` para el job de recuperación:

```json
{ "crons": [{ "path": "/api/cron/recover", "schedule": "*/15 * * * *" }] }
```

Los mails de recuperación conviene mandarlos desde el dominio del estudio, no
desde el de la agencia: llegan mejor y es lo que la persona espera.

## Qué falta

Lo que quedó afuera del MVP, en orden de valor:

- **Login y multi-estudio.** Hoy el panel muestra el primer estudio de la tabla,
  sin autenticación. Es lo primero antes de ponerlo en manos de un cliente.
- **Constructor visual de formularios.** Hoy se editan en `seed-data.mjs`. Es el
  80% del trabajo restante y el 10% del valor mientras la agencia arme los forms.
- **Impresiones de pop-up.** Se cuenta el pop-up desde que se abre; no se registra
  cuántas veces se mostró sin que lo abrieran.
- **Secuencia de recuperación.** Hoy es un solo mail. Lo normal son 2 o 3.
- **Scoring del lead** y aviso por WhatsApp al estudio.

## Nota sobre datos personales

Los mails de recuperación van a gente que dejó su email en un formulario de
consulta del estudio: contactarla por esa misma consulta es la finalidad para la
que lo dio (Ley 25.326). Lo que sí corresponde: que el mail salga del estudio,
que tenga link de baja, y que esa base no se use para otra cosa.

Las respuestas incluyen datos sensibles de casos. No mandarlas a Google Analytics
ni a ninguna herramienta de terceros — GA además prohíbe expresamente cargar PII.
