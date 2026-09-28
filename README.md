# ❄️ Winter Arc

Aplicación web (PWA) para hacer un **Winter Arc** de ~90 días con tus amigos: registra tus hábitos diarios,
entrenamientos y notas, mira tus rachas y estadísticas y comparte el progreso con tu grupo — sin rankings
tóxicos y con privacidad real.

- Funciona en móvil, tablet y escritorio, y se puede **instalar** como app.
- Los datos viven en **PostgreSQL (Supabase)**: mismo estado en todos tus dispositivos.
- La seguridad se impone en la **base de datos (RLS + funciones con comprobación de permisos)**, no en la interfaz.

---

## 1. Qué hace

| Área | Funcionalidad |
| --- | --- |
| Cuenta | Registro, login, logout, recuperación de contraseña por email, sesión persistente (cookies httpOnly), perfil con avatar (emoji + color) y zona horaria, borrado de cuenta |
| Grupos | Crear grupo (quien lo crea es admin), unirse por **enlace `/join/CODIGO`** o **código**, varios grupos por usuario, salir, expulsar, promover/quitar admin, transferir administración, eliminar grupo (soft delete) |
| Invitaciones | Códigos aleatorios de 60 bits, caducidad opcional, usos máximos, revocar y regenerar, rate limiting anti fuerza bruta |
| Hábitos | Configurables desde la app por los admins: nombre, descripción, icono, categoría, color, frecuencia (diaria / días concretos / objetivo semanal), opcional, objetivo, orden, activo/inactivo, "activo desde" |
| Hoy | Progreso del día (x / y, %), marcar ✅ hecho / ⭕ no hecho / ➖ no aplica con **guardado inmediato** y estado "Guardado ✓" real, navegación por los últimos 7 días |
| Notas | "¿Qué hice hoy?" y "¿Qué puedo mejorar mañana?" con autoguardado y detección de conflictos entre dispositivos |
| Entrenamiento | Tipo (gimnasio, boxeo, cardio, movilidad, otro), duración, intensidad, sensación 1-10, ejercicios, observaciones, objetivo siguiente |
| Calendario | Vista mensual con colores 🟢 cumplido · 🟡 parcial · 🔴 bajo · ⚪ sin datos; detalle del día (hábitos, entrenos, notas, %) |
| Estadísticas | Hoy, semana, mes, total del arc, racha actual y mejor, racha por hábito, tiempo entrenando, objetivos semanales, últimas 8 semanas |
| Grupo | Progreso colectivo, tarjetas por miembro (%, racha, días activos, entrenos, semana), tiempo real, comparación **opcional** configurable por el grupo y por cada persona |
| Gamificación | XP, niveles, 12 logros calculados en servidor (7 días, rachas de 7/14/30, 10/30 entrenos, 20 sesiones de estudio…) |
| Recordatorios | Recordatorio configurable (activado + hora) mostrado en la app si quedan hábitos pendientes |
| PWA | Manifest, iconos (incl. maskable), service worker con página offline |

## 2. Stack

- **Next.js 16** (App Router, Server Components, Server Actions, `proxy.ts`) + **React 19** + **TypeScript estricto**
- **Supabase**: PostgreSQL, Auth, Row Level Security, Realtime (`@supabase/ssr` para sesiones con cookies)
- **Tailwind CSS v4**, componentes propios al estilo shadcn/ui sobre **Radix UI**, iconos **lucide-react**, `sonner`, `next-themes`
- **Zod 4** para validación compartida cliente/servidor
- **Vitest** (unit + integración contra Supabase real) y **Playwright** (E2E, móvil + escritorio)

## 3. Estructura

```
supabase/
  config.toml                 Config para Supabase CLI (local)
  migrations/
    20260928000100_schema.sql     Tablas, tipos, constraints, índices, triggers de integridad
    20260928000200_security.sql   Helpers de autorización, validaciones, RLS, grants mínimos
    20260928000300_functions.sql  RPCs (grupos, invitaciones, stats, logros), catálogo de logros
  seed.sql                    Vacío a propósito: no hay datos falsos
src/
  proxy.ts                    Refresco de sesión, protección optimista de rutas, CSP con nonce
  app/
    (auth)/…                  login, register, forgot-password
    (app)/…                   today, dashboard, calendar, workouts, progress, group, group/admin, settings, onboarding
    join/[code]/              Aceptar invitación
    auth/confirm/             Destino de los enlaces de email (PKCE / token_hash)
    reset-password/           Nueva contraseña tras recuperación
    actions/                  Server Actions (validan con Zod y llaman a Supabase con la sesión del usuario)
    manifest.ts               Manifest PWA
  components/                 UI (ui/, habits/, admin/, groups/, settings/, …)
  lib/
    dates.ts                  Fechas por zona horaria (día local del usuario)
    stats.ts                  Rachas, porcentajes, XP (puro, testeado)
    validation.ts             Esquemas Zod
    data/                     Lectura de datos en servidor (session, queries, personal-stats)
    supabase/                 Clientes server/browser
public/                       sw.js, offline.html, iconos
tests/
  integration/security.test.ts  42 tests de permisos y abuso contra Supabase real
  e2e/                          Flujo completo A/B, seguridad, recuperación de contraseña
scripts/
  local-stack/                Stack Supabase mínimo sin Docker (sólo para tests)
  generate-icons.mjs          PNG de la PWA a partir del SVG
```

## 4. Configuración local

Requisitos: Node ≥ 20.9, npm y [Supabase CLI](https://supabase.com/docs/guides/local-development) (usa Docker).

```bash
npm install
npx supabase start          # levanta Postgres, Auth, REST, Realtime, Inbucket (emails)
npx supabase db reset       # aplica supabase/migrations
cp .env.example .env.local  # y pega la URL + publishable/anon key que imprime `supabase start`
npm run dev                 # http://localhost:3000
```

Los emails de confirmación/recuperación en local se ven en Inbucket/Mailpit (`http://127.0.0.1:54324`).

## 5. Variables de entorno

| Variable | Obligatoria | Dónde | Descripción |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | Vercel + local | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sí* | Vercel + local | Clave publicable (`sb_publishable_…`). *O bien `NEXT_PUBLIC_SUPABASE_ANON_KEY` en proyectos con claves legacy |
| `NEXT_PUBLIC_SITE_URL` | Recomendada | Vercel + local | URL pública (enlaces de invitación y redirecciones de email). En Vercel, si falta, se usa `VERCEL_PROJECT_PRODUCTION_URL` |

**No existe ninguna variable secreta en la app.** La `service_role` key no se usa en ningún sitio: no la añadas a Vercel.

## 6. Configuración de Supabase (producción)

1. Crea un proyecto en [supabase.com](https://supabase.com) (región UE si tus amigos están en España).
2. **Aplica las migraciones** (una de estas dos opciones):
   - CLI: `npx supabase link --project-ref TU_REF && npx supabase db push`
   - Manual: SQL Editor → ejecuta en orden los 3 archivos de `supabase/migrations/`.
3. **Authentication → URL Configuration**
   - *Site URL*: `https://tu-app.vercel.app`
   - *Redirect URLs*: `https://tu-app.vercel.app/auth/confirm` (y `http://localhost:3000/auth/confirm` para desarrollo)
4. **Authentication → Providers → Email**: deja activado *Confirm email* (recomendado). Longitud mínima de contraseña ≥ 8.
5. **Authentication → Emails → SMTP**: configura un SMTP propio (Resend, Postmark, SES…). El SMTP por defecto de
   Supabase tiene un límite muy bajo de emails por hora y no sirve para producción.
6. **Authentication → Attack Protection**: activa CAPTCHA (Cloudflare Turnstile) si abres el registro a mucha gente, y
   la protección de contraseñas filtradas (plan Pro).
7. **Database → Publications**: la migración añade `habit_logs` a `supabase_realtime` para el panel de grupo en directo.
8. Revisa **Advisors → Security** tras migrar: no debería mostrar tablas sin RLS.

## 7. Migraciones

- Viven en `supabase/migrations/` y son la única fuente de verdad del esquema.
- Nuevos cambios: `npx supabase migration new nombre` → editar → `npx supabase db reset` (local) → `npx supabase db push` (prod).
- Tras cambiar el esquema, actualiza `src/lib/database.types.ts` (o genera con `npx supabase gen types typescript --local`).

## 8. Tests

```bash
npm run lint
npm run typecheck
npm test                    # unit: fechas/zonas horarias, rachas, %, XP, validación (56 tests)
npm run test:integration    # integración + abuso contra Supabase real (42 tests)
npm run build
npm run test:e2e            # Playwright: flujo A/B, seguridad, recuperación de contraseña y
                            # responsive (10 páginas × 5 tamaños × claro/oscuro), móvil + escritorio
```

Los tests de integración y E2E necesitan un Supabase local en marcha y `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY` exportadas. Con Supabase CLI basta con `supabase start`.
El test E2E de recuperación de contraseña lee los emails de `E2E_MAILBOX_URL` (por defecto el buzón del stack de
`scripts/local-stack`). Si tu Playwright no encuentra Chromium, define `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

<details>
<summary>Stack de pruebas sin Docker (scripts/local-stack)</summary>

Para entornos sin Docker (CI restringidos) hay un stack mínimo: Postgres 16 + binario de `supabase/auth` +
binario de PostgREST + un gateway Node que imita el enrutado de Supabase y un buzón SMTP en memoria.
`reset-db.sh` recrea el esquema y aplica las migraciones; `env.sh` exporta las variables. Usa un secreto JWT de
desarrollo público: **nunca** lo uses fuera de local.
</details>

## 9. Despliegue (Vercel + Supabase)

1. Configura Supabase como en el punto 6.
2. En Vercel: *Add New Project* → importa el repositorio (framework Next.js detectado automáticamente).
3. Añade las variables del punto 5 en *Settings → Environment Variables* (Production y Preview).
4. Deploy. Añade el dominio final a *Site URL* / *Redirect URLs* de Supabase y a `NEXT_PUBLIC_SITE_URL`.
5. Comprueba: registro → email de confirmación → `/onboarding`.

## 10. Crear el primer grupo

1. Entra en la app y regístrate. Tras confirmar el email llegas a **Empezar** (`/onboarding`).
2. En *Crear un grupo*: nombre (p. ej. `WINTER ARC 2026`), fechas de inicio/fin y deja activado
   *Usar los hábitos del Winter Arc* (Entrenamiento 4×/semana, Boxeo mar-jue-sáb, Movilidad, Activación, Reflexión,
   Lectura, Actitud positiva, Estudio L-V y Proyecto Google AdSense 5×/semana).
3. Llegas a **Administración**: ajusta hábitos (frecuencias, días, colores, orden…), reglas y el umbral de "día
   cumplido" (80 % por defecto).

## 11. Invitaciones

- Al crear el grupo se genera una invitación de 30 días. En *Grupo → Administrar → Invitaciones* puedes:
  **Compartir** (menú nativo del móvil), copiar **enlace** (`https://tu-app/join/ABCD…`) o **código**, crear
  invitaciones con caducidad (24 h – 90 días o sin caducidad) y usos máximos, **revocar** una o **regenerar**
  (revoca todas y crea una nueva).
- Tus amigos abren el enlace → se registran → vuelven a la invitación → *Unirme al grupo*. O introducen el código en
  *Empezar → Unirme con un código* (acepta guiones y minúsculas).

## 12. Arquitectura de seguridad

**Principio**: el navegador no es de fiar. Cada lectura/escritura pasa por Postgres con el JWT del usuario y RLS decide.

- **Autenticación**: Supabase Auth; sesión en cookies httpOnly gestionadas por `@supabase/ssr`; `getClaims()` valida el
  JWT en cada petición del servidor. Contraseñas gestionadas exclusivamente por Supabase (bcrypt).
- **RLS en todas las tablas** (deny by default):
  - `profiles`: lees el tuyo y el de quien comparte grupo contigo; sólo editas el tuyo (y sólo columnas permitidas).
  - `user_settings`, `daily_entries` (notas), `workouts`: **sólo el propietario**.
  - `groups`, `group_members`, `habits`: sólo miembros; editar grupo/hábitos sólo admins.
  - `group_invitations`: sólo admins.
  - `habit_logs`: escribes sólo los tuyos, sólo en grupos donde eres miembro y en la ventana editable (7 días);
    el grupo los ve **sólo si compartes tus hábitos**.
  - `user_achievements`: sin permisos de escritura (los concede la BD al evaluar datos reales).
- **Anti-IDOR / mass assignment**: grants por columna (no se puede escribir `user_id`, `group_id`, `role`,
  `created_by`, `deleted_at`…); triggers que fijan `group_id` a partir del hábito y hacen inmutables las columnas clave.
- **Operaciones sensibles sólo por RPC `SECURITY DEFINER`** con `search_path` vacío y comprobación explícita de
  permisos: crear grupo, unirse, invitaciones, roles, expulsar, transferir, borrar grupo/cuenta. Siempre queda ≥ 1 admin.
- **Helpers en esquema `private`** (no expuesto por la API) para evitar recursión de RLS y superficie de ataque.
- **Invitaciones**: 12 caracteres de un alfabeto de 32 (60 bits, sin sesgo de módulo), nunca IDs internos.
  Rate limiting en BD: 10 intentos de unión / 10 min, 30 previsualizaciones / 10 min, 30 invitaciones / hora,
  5 grupos / día por usuario. Un código inválido no revela el grupo.
- **Validación**: Zod en cliente y servidor + `CHECK` constraints en BD (longitudes, rangos 1-600 min, 1-10,
  colores hex, iconos en lista blanca, zona horaria válida, fechas dentro de ventana).
- **Zona horaria**: el "día" de un registro es el día local según la zona del perfil; la BD valida la fecha con esa
  zona. Si el dispositivo está en otra zona, la app avisa y ofrece actualizarla.
- **Cabeceras**: CSP con nonce por petición y `strict-dynamic`, `frame-ancestors 'none'`, X-Frame-Options, nosniff,
  Referrer-Policy, Permissions-Policy, HSTS, COOP; `Cache-Control: private, no-store` en páginas autenticadas.
- **Server Actions**: protección CSRF nativa de Next.js (comprobación de Origin); redirecciones post-login filtradas
  (anti open-redirect); errores de BD traducidos a mensajes genéricos y registrados sin secretos ni tokens.
- **PWA**: el service worker nunca cachea HTML autenticado ni respuestas de datos, sólo estáticos inmutables.
- **Sin secretos en el cliente**: sólo URL + clave publicable. Un test E2E verifica que el bundle no contiene `service_role`.

### Riesgos residuales conocidos

- **Rate limiting de login/registro**: además de los límites de Supabase Auth, la app aplica un limitador en memoria
  por instancia (en serverless no es global). Para exposición pública amplia, activa CAPTCHA en Supabase Auth.
- **Histórico con la configuración actual**: las estadísticas pasadas se calculan con la configuración vigente de
  cada hábito (desactivar un hábito lo quita también del histórico; "activo desde" protege los días anteriores a un
  hábito nuevo). Es una decisión consciente para simplicidad; no se versiona la configuración.
- **Offline**: los cambios pendientes se reintentan mientras la pestaña está abierta (y se avisa antes de cerrarla),
  pero no se guardan en una cola persistente del dispositivo.
- **Notificaciones push**: la configuración (activado + hora) está en BD y el aviso se muestra dentro de la app; el
  envío push en segundo plano (Web Push + cron) no está implementado.
- **Borrado de cuenta**: usa `delete from auth.users` desde una función `SECURITY DEFINER`. Si tu proyecto de Supabase
  restringe ese permiso al rol `postgres`, la app mostrará un error y habrá que borrar al usuario desde el panel.
- **Enumeración de nombres de usuario**: `username_available` es consultable sin sesión (para validar el registro);
  permite saber si un username existe, pero no expone ningún otro dato.
- **Realtime** no se ha podido probar en este entorno (el stack de pruebas sin Docker no incluye el servidor Realtime);
  si no conecta, el panel de grupo sigue funcionando y se actualiza al recargar.
- Ningún sistema es 100 % seguro: revisa periódicamente *Advisors* de Supabase y las dependencias (`npm audit`).

## Decisiones de diseño

- **Hábitos por grupo** (no personales): todos los miembros comparten la configuración del Winter Arc; así las
  estadísticas del grupo son comparables. Un usuario puede estar en varios grupos y cambiar el activo.
- **% del día = hábitos obligatorios completados / obligatorios** (diarios + días concretos, sin opcionales, sin "no
  aplica"). Los objetivos semanales se miden aparte (x / objetivo por semana) y suman XP.
- **Día cumplido** = % ≥ umbral del grupo (80 % por defecto): es lo que pinta de verde el calendario y alarga la racha.
  Los días sin hábitos obligatorios no rompen la racha, y hoy no la rompe hasta que termina.
- **Ventana editable de 7 días** para hábitos y notas (60 días para entrenamientos): permite corregir sin reescribir
  la historia.
- **Avatar = emoji + color** en lugar de subir imágenes: sin almacenamiento de ficheros de terceros ni riesgos de
  contenido; se puede añadir Supabase Storage más adelante.
- **Estadísticas en SQL (`daily_stats`, SECURITY INVOKER)**: agrega en la BD respetando RLS y privacidad, en vez de
  enviar todos los registros al cliente.
