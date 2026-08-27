# Mi Coche

PWA privada para Adri y Laura que guarda la última ubicación del coche y permite abrir Google Maps para volver hasta él.

## Arquitectura

- Frontend: HTML + CSS + JavaScript vanilla
- Hosting/API: Cloudflare Workers + Static Assets
- Base de datos: Cloudflare D1
- Autorización:
  - PWA: cookie `HttpOnly` creada tras introducir una credencial del dispositivo una vez
  - Atajos: `Authorization: Bearer <token>`
- Navegación: Google Maps mediante URL, sin API key

## Requisitos para desplegar

- Cuenta gratuita de Cloudflare
- Repositorio GitHub
- Node.js únicamente para utilizar Wrangler durante configuración/desarrollo
- Dos secretos aleatorios: uno para Adri y otro para Laura

## 1. Instalar dependencias

Desde la carpeta del repositorio:

```bash
npm install
```

## 2. Iniciar sesión en Cloudflare

```bash
npx wrangler login
```

## 3. Crear la base D1

Recomendación para España/Europa occidental:

```bash
npx wrangler d1 create mi-coche-db --location=weur
```

Cloudflare devolverá un `database_id`.

Abre `wrangler.jsonc` y sustituye:

```text
REEMPLAZAR_CON_DATABASE_ID
```

por el ID real de la base.

No es un secreto y puede quedar versionado en GitHub.

## 4. Aplicar la migración

```bash
npm run db:migrate:remote
```

Esto crea la tabla `parking`.

## 5. Generar los dos tokens

Genera dos cadenas aleatorias largas e independientes. Por ejemplo, desde una terminal con Node:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Ejecuta el comando dos veces.

Guarda cada valor en un sitio seguro y no los subas a GitHub.

## 6. Configurar secretos en Cloudflare

```bash
npx wrangler secret put TOKEN_ADRI
```

Pega el token de Adri cuando lo solicite.

Después:

```bash
npx wrangler secret put TOKEN_LAURA
```

Pega el token de Laura.

Wrangler almacena estos valores como secretos del Worker.

## 7. Desplegar

```bash
npm run deploy
```

Cloudflare mostrará la URL `*.workers.dev`.

## 8. Primera prueba desde iPhone

1. Abre la URL HTTPS de Cloudflare en Safari.
2. La app mostrará `Autorizar este iPhone`.
3. En el iPhone de Adri introduce el token de Adri.
4. En el iPhone de Laura introduce el token de Laura.
5. Pulsa `Guardar aquí`.
6. Acepta el permiso de ubicación.
7. Comprueba desde el otro iPhone que aparece el mismo aparcamiento.
8. Pulsa `Cómo llegar` y verifica que Google Maps recibe el destino.

## 9. Añadir a la pantalla de inicio en iPhone

Desde Safari:

1. Abre Mi Coche.
2. Usa el menú Compartir.
3. Elige `Añadir a pantalla de inicio`.
4. Confirma el nombre `Mi Coche`.

La app se abrirá en modo standalone.

## 10. Probar Atajos sin NFC

Cuando la PWA funcione correctamente, el Atajo podrá enviar:

```http
POST https://TU-URL/api/parking
Authorization: Bearer TOKEN_DEL_IPHONE
Content-Type: application/json
```

con cuerpo JSON:

```json
{
  "latitude": 40.4168,
  "longitude": -3.7038,
  "accuracy": 12.4
}
```

No configures todavía la NFC. Primero valida manualmente este flujo.

## Desarrollo local opcional

Crea un archivo `.dev.vars` que NO se versionará:

```text
TOKEN_ADRI=token-local-adri
TOKEN_LAURA=token-local-laura
```

Aplica la migración local:

```bash
npm run db:migrate:local
```

Arranca:

```bash
npm run dev
```

## Seguridad

Nunca pongas los tokens en:

- `app.js`
- `wrangler.jsonc`
- GitHub
- la etiqueta NFC

El `database_id` de D1 no es una credencial secreta.

## Actualizaciones del Service Worker

El Service Worker utiliza el nombre de caché:

```text
mi-coche-static-v1
```

Si en una actualización futura necesitas forzar una renovación completa de archivos cacheados, cambia el sufijo, por ejemplo a `v2`.

## V1 deliberadamente fuera de alcance

- historial visible
- varios coches
- geocodificación/dirección
- mapas embebidos
- notas/fotos
- seguimiento en segundo plano
- sincronización offline
- NFC hasta validar PWA + API



## V4

Añade estado de ubicación activa, eliminación confirmada y mejoras de UX. Requiere ejecutar `migrations/0002_add_active_parking.sql` en D1 antes de usar la V4.
