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
| **Aviso al estudio** | Mail con nombre, apellido, email, teléfono, opt-in, área, tipo de caso y **origen**, más todas las respuestas |
| **Atribución de origen** | De dónde vino cada consulta, incluso embebida en un iframe en el sitio del estudio |
| **Landing partida** | Foto del estudio + áreas de práctica como botones, con logo y texto de privacidad propios |

## Acceso

**No hay registro abierto.** Al panel se entra solo por invitación, con Google
o con email + contraseña. Los dos caminos llevan al mismo usuario: si alguien
creó su cuenta con contraseña y después entra con Google usando el mismo mail,
se le vincula la cuenta en vez de duplicarla.

Tres niveles:

| | Ve consultas | Invita gente | Ve todos los estudios |
|---|---|---|---|
| **Miembro** del estudio | ✓ | | |
| **Dueño** del estudio | ✓ | ✓ | |
| **Agencia** (`is_staff`) | ✓ | ✓ | ✓ |

La agencia tiene un selector de estudio en la barra lateral. La cookie solo
elige entre los estudios a los que la cuenta ya tiene acceso: el permiso se
resuelve siempre contra la base, así que forzar la cookie no abre nada.

Cómo funciona por dentro:

- **Contraseñas** con scrypt (`N=2^15`), sal aleatoria por usuario y
  comparación en tiempo constante. Un email inexistente igual paga el costo del
  hash, para que el tiempo de respuesta no delate qué cuentas existen.
- **Sesiones** opacas: token aleatorio de 32 bytes en cookie `httpOnly` +
  `SameSite=Lax`, y en la base solo su SHA-256. Se pueden revocar de a una.
- **Google** por authorization code flow con `state` en cookie contra CSRF de
  login. No se verifica la firma del `id_token` porque no se usa: el código se
  canjea server-to-server y los datos salen de `userinfo`.
- **Invitaciones** con token de un solo uso que vence a los 7 días; en la base
  también va solo el hash.

Para configurar Google, en la consola de Google Cloud:

- Origen autorizado: el valor de `NEXT_PUBLIC_APP_URL`
- Redirect URI: ese mismo valor + `/api/auth/google/callback`

Sin `GOOGLE_CLIENT_ID` el botón no aparece y el login por contraseña sigue
andando.

## Arranque local

La única dependencia externa es una base Postgres. Dos caminos.

### Con Supabase (recomendado)

Es gratis y te deja la base ya lista para cuando lo pongas online.

1. Crear una cuenta en [supabase.com](https://supabase.com) y un proyecto nuevo.
   Anotá la contraseña que te pide: no la vuelve a mostrar.
2. Botón **Connect** (arriba, al lado del nombre del proyecto) → pestaña
   **Direct Connection string** (la tercera). Ahí aparecen las tres variantes;
   copiar la del **Session pooler** y reemplazar `[YOUR-PASSWORD]` por la
   contraseña del paso 1.

   Las otras pestañas —Framework, Server, ORM, MCP— son para usar las
   librerías de Supabase, que esta app no usa: se conecta a Postgres directo.

   Sirve cualquiera de las tres cadenas y la app se configura sola, pero:
   la **directa** (`db.<ref>.supabase.co`) solo funciona si tu red tiene IPv6,
   y la de **transaction pooler** (puerto 6543) conviene reservarla para
   producción. Para local, la del **session pooler** es la que menos problemas
   da.

No hace falta tocar el SQL Editor: `npm run setup` aplica `db/schema.sql` solo
a través de la conexión.

Si perdiste la contraseña de la base (pasa si entraste con GitHub y salteaste
ese paso), se genera una nueva en **Project Settings → Database → Database
password → Reset database password**. Es la contraseña de Postgres, distinta de
la de tu cuenta de Supabase.

La cadena de conexión incluye esa contraseña: tratala como una credencial y no
la pegues en chats, capturas ni commits. Vive en `.env.local`, que está
ignorado por git.

```bash
git clone https://github.com/panchobarberis-maker/web-click-derecho
cd web-click-derecho
cp .env.example .env.local     # pegar ahí la cadena en DATABASE_URL
npm install
npm run setup
```

### Con Docker

Si preferís no depender de una cuenta:

```bash
cp .env.example .env.local     # dejar el DATABASE_URL como viene
npm install
npm run docker:up              # levanta Postgres 16 en un contenedor
npm run setup
```

En los dos casos, `npm run setup` crea las tablas, carga el estudio de ejemplo
con tráfico simulado y arranca en http://localhost:3000. Las veces siguientes
alcanza con `npm run dev`. Para volver a empezar de cero:
`npm run db:setup -- --reset --demo`.

- Panel: http://localhost:3000 — el seed crea dos cuentas con la contraseña
  `clickderecho2026` (cambiable con `SEED_PASSWORD`):
  - `hola@clickderecho.com` — la agencia, ve todos los estudios
  - `consultas@alzogarayserrano.com.ar` — dueño del estudio de ejemplo
- Formulario público: http://localhost:3000/f/alzogaray-serrano

Sin `RESEND_API_KEY` los mails no se mandan: se imprimen en la consola del
servidor. El flujo completo se puede probar sin cuenta de nada.

Para probar el job de recuperación sin esperar los 45 minutos:

```bash
curl -H "Authorization: Bearer dev-secret" localhost:3000/api/cron/recover
```

### Notas sobre Supabase

**Qué cadena de conexión usar.** Supabase ofrece tres y no dan lo mismo:

| | Cuándo |
|---|---|
| Conexión directa | Solo si tu red tiene IPv6 |
| **Session pooler** (5432) | Desarrollo local — es la que conviene |
| **Transaction pooler** (6543) | Vercel y cualquier entorno serverless |

La app detecta cuál le pasaste y se configura sola: activa SSL fuera de
localhost y desactiva los *prepared statements* con el transaction pooler.
Sin eso último, pgbouncer reparte cada consulta entre conexiones distintas y
Postgres responde `prepared statement does not exist` — es el error más común
al combinar Vercel con Supabase.

**RLS.** El esquema activa Row Level Security en todas las tablas sin definir
políticas. Supabase publica automáticamente el esquema `public` por su API
REST, así que sin esto cualquiera con la clave pública del proyecto podría leer
las consultas de los estudios desde el navegador. La app no se ve afectada: se
conecta con el rol dueño de las tablas, que no queda sujeto a RLS. El control
de acceso real lo hace la app filtrando por `firm_id` contra la membresía del
usuario.

### Sobre el aviso de `npm audit`

`npm install` reporta tres vulnerabilidades altas en `postcss` y `sharp`. Las
dos son dependencias internas de Next.js, no nuestras, y afectan a todas las
versiones publicadas de Next: no hay a que actualizar todavia.

**No corras `npm audit fix --force`**: la unica forma que encuentra npm de
"arreglarlas" es bajar Next a la version 9.3.3, de 2020, que no soporta nada de
lo que usa esta app.

Ninguna de las dos se puede explotar aca: `postcss` procesa CSS propio en el
build, y `sharp` solo entra por el optimizador de imagenes de `next/image`, que
esta app no usa. Cuando Next publique un parche, se actualiza y listo.

## Definir los formularios de un estudio

Están en `db/seed-data.mjs` como JSON y se cargan con `npm run db:setup`.
Tipos de campo: `text`, `email`, `tel`, `textarea`, `select`, `radio`, `date`, `checkbox`.

```js
{
  name: "Despido sin causa",
  slug: "despido-sin-causa",
  steps: [
    contacto,                        // paso 1: nombre, apellido, email, teléfono, opt-in
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

Las claves `first_name`, `last_name`, `email`, `phone` y `consent` son
especiales: se promueven a columnas y arman el bloque de contacto del mail al
estudio. El resto de las respuestas van abajo, con la etiqueta del formulario.

La landing se configura por estudio: `logo_url`, `hero_url` (la foto de la
columna izquierda), `accent` y `intro` (el texto de privacidad).

## Atribución del origen

Este es el punto donde es fácil equivocarse. El formulario corre dentro de un
iframe en el sitio del estudio, así que `document.referrer` visto desde adentro
es **el sitio del estudio** — sin hacer nada, todas las consultas figurarían
como "referral" y la atribución no serviría para nada.

Por eso el widget lee los `utm_*` y el referrer **de la página madre** y se los
pasa al iframe. La prioridad es: `utm_source` declarado → click id de la
plataforma (`gclid`, `fbclid`, `ttclid`, `msclkid`) → dominio del referrer →
directo.

Es **first-touch** y se guarda en `sessionStorage`: si alguien llega desde
Instagram, navega tres páginas del sitio y recién ahí abre el formulario, el
origen sigue siendo Instagram. Lo mismo aplica a la superficie (`page`,
`popup`, `clip`): cuenta por dónde entró la primera vez, no por dónde terminó
enviando.

Cada consulta guarda `source`, el `utm` completo (campaña y medio incluidos),
el referrer y la URL exacta del sitio del estudio donde se abrió.

## Instalación en el sitio del estudio

```html
<script src="https://TU-APP/w.js"
        data-firm="alzogaray-serrano"
        data-mode="popup"
        data-trigger="delay:12"></script>
```

- `data-mode`: `popup` · `button` (botón flotante) · `inline` (embebido en un `data-target`) · `clip` (video en una esquina)
- `data-trigger`: `delay:N` · `scroll:N` (% de la página) · `exit` (exit intent) · `now`
- `data-funnel` / `data-workflow`: saltear el menú y abrir un formulario puntual
- `data-once="false"`: mostrar el pop-up más de una vez por sesión
- `data-video` / `data-poster`: para el modo `clip`. El mp4 lo hospedás donde quieras

Todo va dentro de un iframe, así que el CSS del sitio del estudio no puede
romper el formulario ni al revés.

## Despliegue en Vercel

Entra en el plan gratuito. Es todo por navegador: no hace falta terminal.

1. **Vercel** → crear cuenta con GitHub → **Add New… → Project** → importar
   `web-click-derecho`.
2. **Root Directory**: dejarlo vacío. La app vive en la raíz del repo, así que
   Vercel la detecta sola. (Lo viejo del repo quedó en `legacy/`, que Vercel
   ignora.)
3. En **Environment Variables**, agregar:

   | Variable | Valor | ¿Obligatoria? |
   |---|---|---|
   | `DATABASE_URL` | El **transaction pooler** de Supabase (puerto 6543) | Sí |
   | `CRON_SECRET` | Cualquier texto largo al azar | Sí |
   | `RESEND_API_KEY` | De [resend.com](https://resend.com) | No, sin esto no salen mails |
   | `RESEND_FROM` | `Consultas <consultas@tudominio.com>` | Solo con Resend |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | De Google Cloud | Solo para login con Google |

   `NEXT_PUBLIC_APP_URL` **no hace falta**: la app deduce su dominio del
   entorno de Vercel. Solo se setea cuando hay dominio propio.

4. **Deploy**. Al terminar te da una URL `.vercel.app`.
5. Cargar las tablas y el estudio de ejemplo. Desde cualquier máquina con Node,
   una sola vez:

   **Sin terminal:** pegar todo `db/bootstrap.sql` en el **SQL Editor** de
   Supabase y ejecutarlo. Crea las tablas, el estudio de ejemplo, las cuentas y
   tráfico de prueba, y se puede correr más de una vez sin duplicar nada.

   Con terminal, si preferís:

   ```bash
   DATABASE_URL="<la cadena de Supabase>" node scripts/setup-db.mjs --demo
   ```

**Para el login con Google**, en Google Cloud hay que autorizar el dominio que
te dio Vercel: origen `https://TU-APP.vercel.app` y redirect
`https://TU-APP.vercel.app/api/auth/google/callback`.

Sobre el envío de recordatorios y la restricción de cron del plan gratuito, ver
[CRON.md](CRON.md).

Los mails de recuperación conviene mandarlos desde el dominio del estudio, no
desde el de la agencia: llegan mejor y es lo que la persona espera.

## Qué falta

Lo que quedó afuera del MVP, en orden de valor:

- **Recuperar contraseña.** Hoy si alguien la olvida hay que reinvitarlo.
- **Alta de estudios desde el panel.** Se crean en `seed-data.mjs`; debería
  poder hacerlo la agencia desde la interfaz.
- **Límite de intentos de login.** Falta frenar el fuerza bruta por IP y por
  cuenta. scrypt ya lo hace caro, pero no lo reemplaza.
- **Constructor visual de formularios.** Hoy se editan en `seed-data.mjs`. Es el
  80% del trabajo restante y el 10% del valor mientras la agencia arme los forms.
- **Impresiones de pop-up y clip.** Se cuentan desde que se abre el formulario;
  no se registra cuántas veces se mostraron sin que los abrieran.
- **Subida de videos para los clips.** Hoy se pasa una URL en `data-video`.
- **Secuencia de recuperación.** Hoy es un solo mail. Lo normal son 2 o 3.
- **Scoring del lead** y aviso por WhatsApp al estudio.

## Nota sobre datos personales

Los mails de recuperación van a gente que dejó su email en un formulario de
consulta del estudio: contactarla por esa misma consulta es la finalidad para la
que lo dio (Ley 25.326). Lo que sí corresponde: que el mail salga del estudio,
que tenga link de baja, y que esa base no se use para otra cosa.

Las respuestas incluyen datos sensibles de casos. No mandarlas a Google Analytics
ni a ninguna herramienta de terceros — GA además prohíbe expresamente cargar PII.

## Estructura del repo

```
/                 la app (Next.js). Vercel la toma de acá sin configurar nada.
  db/             esquema, datos de ejemplo y bootstrap.sql
  scripts/        setup de la base y generador del bootstrap
  src/            código
legacy/           el sitio estático y los scripts de Python que había antes
```

`legacy/` no forma parte de la app y Vercel lo ignora; queda como archivo.
