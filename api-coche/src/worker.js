function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {"content-type": "application/json; charset=utf-8", "cache-control": "no-store"},
  });
}

function getBearerToken(request) {
  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function getUserFromToken(token, env) {
  if (!token) return null;
  if (env.TOKEN_ADRI && token === env.TOKEN_ADRI) return "adri";
  if (env.TOKEN_LAURA && token === env.TOKEN_LAURA) return "laura";
  return null;
}

function toFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (normalized !== "") {
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

async function saveParking(request, env) {
  const user = getUserFromToken(getBearerToken(request), env);
  if (!user) return json({ok:false, error:"UNAUTHORIZED", message:"No autorizado."}, 401);

  let body;
  try { body = await request.json(); }
  catch { return json({ok:false, error:"INVALID_JSON", message:"JSON no válido."}, 400); }

  const latitude = toFiniteNumber(body?.latitude);
  const longitude = toFiniteNumber(body?.longitude);

  if (latitude === null || longitude === null ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return json({ok:false, error:"INVALID_COORDINATES", message:"Coordenadas no válidas."}, 400);
  }

  const result = await env.DB.prepare(
    `INSERT INTO parking (latitude, longitude, created_by) VALUES (?, ?, ?)`
  ).bind(latitude, longitude, user).run();

  const parkingId = result.meta.last_row_id;

  await env.DB.prepare(
    `UPDATE app_state SET active_parking_id = ? WHERE id = 1`
  ).bind(parkingId).run();

  return json({ok:true, id:parkingId});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname !== "/api/parking") {
        return json({ok:false, error:"NOT_FOUND", message:"Ruta no encontrada."}, 404);
      }
      if (request.method !== "POST") {
        return json({ok:false, error:"METHOD_NOT_ALLOWED", message:"Método no permitido."}, 405);
      }
      return await saveParking(request, env);
    } catch (error) {
      console.error("Unhandled error:", error);
      return json({ok:false, error:"SERVER_ERROR", message:"Error interno."}, 500);
    }
  },
};
