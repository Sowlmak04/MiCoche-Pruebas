const SESSION_COOKIE = "mi_coche_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // 1 año

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      return new Response("Not found", { status: 404 });
    }

    try {
      if (url.pathname === "/api/auth" && request.method === "POST") {
        return await authorizePwa(request, env);
      }

      if (url.pathname === "/api/parking/latest" && request.method === "GET") {
        return await getLatestParking(request, env);
      }

      if (url.pathname === "/api/parking" && request.method === "POST") {
        return await saveParking(request, env);
      }

      if (url.pathname === "/api/parking/current" && request.method === "DELETE") {
        return await clearCurrentParking(request, env);
      }

      if (
        url.pathname === "/api/auth" ||
        url.pathname === "/api/parking/latest" ||
        url.pathname === "/api/parking" ||
        url.pathname === "/api/parking/current"
      ) {
        return jsonError(405, "METHOD_NOT_ALLOWED", "Método no permitido.");
      }

      return jsonError(404, "NOT_FOUND", "Ruta no encontrada.");
    } catch (error) {
      console.error("Unhandled error:", error);
      return jsonError(500, "SERVER_ERROR", "Error interno.");
    }
  },
};

async function authorizePwa(request, env) {
  if (!isSameOriginRequest(request)) {
    return jsonError(403, "FORBIDDEN", "Origen no permitido.");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "INVALID_REQUEST", "Petición inválida.");
  }

  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const user = identifyToken(token, env);

  if (!user) {
    return jsonError(401, "AUTH_INVALID", "Credencial no válida.");
  }

  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Set-Cookie": buildSessionCookie(token),
  });

  return new Response(JSON.stringify({ ok: true, user }), {
    status: 200,
    headers,
  });
}

async function getLatestParking(request, env) {
  const auth = authenticate(request, env);
  if (!auth) {
    return jsonError(401, "UNAUTHORIZED", "No autorizado.");
  }

  const row = await env.DB.prepare(`
    SELECT p.id, p.latitude, p.longitude, p.accuracy, p.parked_at, p.saved_by
    FROM app_state AS s
    LEFT JOIN parking AS p ON p.id = s.active_parking_id
    WHERE s.id = 1
    LIMIT 1
  `).first();

  const parking = row?.id ? row : null;
  return json({ parking });
}

async function saveParking(request, env) {
  const auth = authenticate(request, env);
  if (!auth) {
    return jsonError(401, "UNAUTHORIZED", "No autorizado.");
  }

  // Las escrituras autenticadas mediante cookie solo se aceptan desde el mismo origen.
  if (auth.method === "cookie" && !isSameOriginRequest(request)) {
    return jsonError(403, "FORBIDDEN", "Origen no permitido.");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "INVALID_REQUEST", "Petición inválida.");
  }

  const latitude = toFiniteNumber(body?.latitude);
  const longitude = toFiniteNumber(body?.longitude);
  const accuracy =
    body?.accuracy === undefined || body?.accuracy === null
      ? null
      : toFiniteNumber(body.accuracy);

  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    (accuracy !== null && accuracy < 0)
  ) {
    return jsonError(400, "INVALID_LOCATION", "Ubicación no válida.");
  }

  const result = await env.DB.prepare(`
    INSERT INTO parking (latitude, longitude, accuracy, saved_by)
    VALUES (?, ?, ?, ?)
  `)
    .bind(latitude, longitude, accuracy, auth.user)
    .run();

  const id = result.meta.last_row_id;

  await env.DB.prepare(`
    INSERT INTO app_state (id, active_parking_id)
    VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET active_parking_id = excluded.active_parking_id
  `)
    .bind(id)
    .run();

  const parking = await env.DB.prepare(`
    SELECT id, latitude, longitude, accuracy, parked_at, saved_by
    FROM parking
    WHERE id = ?
  `)
    .bind(id)
    .first();

  return json({ ok: true, parking }, 201);
}

async function clearCurrentParking(request, env) {
  const auth = authenticate(request, env);
  if (!auth) {
    return jsonError(401, "UNAUTHORIZED", "No autorizado.");
  }

  if (auth.method === "cookie" && !isSameOriginRequest(request)) {
    return jsonError(403, "FORBIDDEN", "Origen no permitido.");
  }

  await env.DB.prepare(`
    INSERT INTO app_state (id, active_parking_id)
    VALUES (1, NULL)
    ON CONFLICT(id) DO UPDATE SET active_parking_id = NULL
  `).run();

  return json({ ok: true, parking: null });
}

function authenticate(request, env) {
  const authorization = request.headers.get("Authorization") || "";

  if (authorization.startsWith("Bearer ")) {
    const token = authorization.slice(7).trim();
    const user = identifyToken(token, env);
    return user ? { user, method: "bearer" } : null;
  }

  const cookies = parseCookies(request.headers.get("Cookie") || "");
  const token = cookies[SESSION_COOKIE];
  const user = token ? identifyToken(token, env) : null;

  return user ? { user, method: "cookie" } : null;
}

function identifyToken(token, env) {
  if (!token) return null;
  if (env.TOKEN_ADRI && token === env.TOKEN_ADRI) return "Adri";
  if (env.TOKEN_LAURA && token === env.TOKEN_LAURA) return "Laura";
  return null;
}

function parseCookies(header) {
  const result = {};

  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (!rawName || rest.length === 0) continue;

    try {
      result[rawName] = decodeURIComponent(rest.join("="));
    } catch {
      // Ignorar cookies malformadas.
    }
  }

  return result;
}

function buildSessionCookie(token) {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
}

function isSameOriginRequest(request) {
  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get("Origin");

  return origin === expectedOrigin;
}

function toFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return null;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function jsonError(status, code, message) {
  return json(
    {
      error: {
        code,
        message,
      },
    },
    status
  );
}
