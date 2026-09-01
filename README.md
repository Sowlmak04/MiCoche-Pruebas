# Mi Coche

PWA privada para Adri y Laura que guarda la ubicación actual del coche y permite abrir Google Maps para volver hasta él.

## Estado actual

**Versión estable candidata: V4.1**

La aplicación está pensada para dos iPhone y utiliza una única ubicación activa compartida. La interfaz se muestra siempre con identidad visual oscura, independientemente de que iOS esté configurado en modo claro u oscuro.

## Arquitectura

- Frontend: HTML + CSS + JavaScript vanilla
- Hosting y API: Cloudflare Workers + Static Assets
- Base de datos: Cloudflare D1 (`mi-coche-db`)
- Binding D1: `DB`
- Autorización PWA: cookie `HttpOnly`, `Secure` y `SameSite`
- Autorización para Atajos: `Authorization: Bearer <token>`
- Secretos runtime: `TOKEN_ADRI` y `TOKEN_LAURA`
- Navegación: Google Maps mediante URL, sin API key
- Despliegue: Cloudflare Workers Builds conectado a GitHub
- Comando de despliegue: `npx wrangler deploy`

## Comportamiento funcional

- `Guardar aquí` guarda una nueva posición y la establece como ubicación activa.
- `Cómo llegar` abre Google Maps con la ubicación activa.
- La papelera permite eliminar la ubicación activa tras confirmación.
- Eliminar no recupera automáticamente un aparcamiento histórico anterior.
- Si no existe ubicación activa, la aplicación muestra el estado vacío y solo permite `Guardar aquí`.
- Los dos iPhone comparten la misma ubicación activa.

## Persistencia

### `parking`

Conserva los registros de aparcamiento.

### `app_state`

Mantiene qué registro de `parking` es actualmente la ubicación activa mediante `active_parking_id`.

Esto permite conservar historial técnico en D1 sin mostrar automáticamente una ubicación anterior después de eliminar la actual.

## Migraciones

Las migraciones versionadas son:

```text
migrations/0001_create_parking.sql
migrations/0002_add_active_parking.sql
```

Para aplicar migraciones pendientes en remoto:

```bash
npm run db:migrate:remote
```

## Desarrollo local opcional

Instalar dependencias:

```bash
npm install
```

Crear `.dev.vars` sin versionarlo:

```text
TOKEN_ADRI=token-local-adri
TOKEN_LAURA=token-local-laura
```

Aplicar migraciones locales:

```bash
npm run db:migrate:local
```

Arrancar:

```bash
npm run dev
```

## Despliegue

El repositorio está conectado a Cloudflare Workers Builds. Los cambios en la rama desplegada se publican mediante:

```bash
npx wrangler deploy
```

La configuración activa está en `wrangler.jsonc`.

No confundir variables de build con secretos runtime: `TOKEN_ADRI` y `TOKEN_LAURA` deben existir como secretos del Worker.

## PWA e iconos

El manifiesto incluye:

```text
public/icons/apple-touch-icon.png
public/icons/icon-192.png
public/icons/icon-512.png
public/icons/icon-maskable-512.png
```

El icono `maskable` está declarado específicamente en `manifest.json`.

La aplicación utiliza una identidad oscura fija y tanto `background_color` como `theme_color` están alineados con esa interfaz.

## Service Worker

El Service Worker cachea los recursos estáticos esenciales y elimina cachés anteriores durante la activación.

Caché de la versión final V4.1:

```text
mi-coche-static-v4-1-final
```

Cuando una actualización necesite invalidar de nuevo todos los recursos estáticos, debe cambiarse `CACHE_NAME`.

## Seguridad

Nunca subir a GitHub:

- `TOKEN_ADRI`
- `TOKEN_LAURA`
- `.dev.vars`
- cualquier credencial privada

El `database_id` de D1 no es un secreto.

## Validación V4.1

La V4.1 se ha comprobado en dos iPhone, uno configurado en modo oscuro y otro en modo claro.

Pruebas funcionales superadas:

- carga de ubicación activa
- `Cómo llegar`
- cancelación de eliminación
- eliminación confirmada
- persistencia del estado vacío
- nuevo guardado
- sincronización del estado entre ambos iPhone
- interfaz oscura consistente independientemente del modo de iOS

Tras aplicar este parche final de limpieza, solo se requiere una prueba breve de humo antes de crear el punto de restauración `backup-v4.1-validado`.
