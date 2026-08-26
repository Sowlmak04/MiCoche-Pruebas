const views = {
  loading: document.querySelector("#loading-view"),
  auth: document.querySelector("#auth-view"),
  empty: document.querySelector("#empty-view"),
  parking: document.querySelector("#parking-view"),
  error: document.querySelector("#error-view"),
};

const authForm = document.querySelector("#auth-form");
const authButton = document.querySelector("#auth-button");
const authMessage = document.querySelector("#auth-message");
const tokenInput = document.querySelector("#device-token");

const parkedDate = document.querySelector("#parked-date");
const parkedAge = document.querySelector("#parked-age");
const savedBy = document.querySelector("#saved-by");

const directionsButton = document.querySelector("#directions-button");
const retryButton = document.querySelector("#retry-button");
const saveButtons = [...document.querySelectorAll(".save-button")];
const globalStatus = document.querySelector("#global-status");

let currentParking = null;
let ageTimer = null;

document.addEventListener("DOMContentLoaded", init);
authForm.addEventListener("submit", authorizeDevice);
retryButton.addEventListener("click", loadLatestParking);
directionsButton.addEventListener("click", openDirections);

for (const button of saveButtons) {
  button.addEventListener("click", saveCurrentLocation);
}

async function init() {
  registerServiceWorker();
  await loadLatestParking();
}

async function loadLatestParking() {
  clearStatus();
  showView("loading");

  try {
    const response = await fetch("/api/parking/latest", {
      method: "GET",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (response.status === 401) {
      showView("auth");
      return;
    }

    if (!response.ok) {
      throw new Error("latest_failed");
    }

    const data = await response.json();

    if (!data.parking) {
      currentParking = null;
      stopAgeTimer();
      showView("empty");
      return;
    }

    renderParking(data.parking);
    showView("parking");
  } catch {
    stopAgeTimer();
    showView("error");
  }
}

async function authorizeDevice(event) {
  event.preventDefault();

  const token = tokenInput.value.trim();
  if (!token) return;

  authButton.disabled = true;
  authMessage.textContent = "Autorizando…";
  authMessage.className = "status-message";

  try {
    const response = await fetch("/api/auth", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ token }),
    });

    if (response.status === 401) {
      authMessage.textContent = "El código no es válido.";
      authMessage.className = "status-message error";
      return;
    }

    if (!response.ok) {
      throw new Error("auth_failed");
    }

    tokenInput.value = "";
    authMessage.textContent = "";
    await loadLatestParking();
  } catch {
    authMessage.textContent = "No se pudo autorizar este iPhone.";
    authMessage.className = "status-message error";
  } finally {
    authButton.disabled = false;
  }
}

async function saveCurrentLocation() {
  clearStatus();
  setSaveButtonsDisabled(true);
  setGlobalStatus("Obteniendo ubicación…");

  try {
    const position = await getCurrentPosition();

    setGlobalStatus("Guardando…");

    const response = await fetch("/api/parking", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy ?? null,
      }),
    });

    if (response.status === 401) {
      showView("auth");
      setGlobalStatus("Este iPhone necesita volver a autorizarse.", "error");
      return;
    }

    if (!response.ok) {
      throw new Error("save_failed");
    }

    const data = await response.json();
    renderParking(data.parking);
    showView("parking");
    setGlobalStatus("✓ Coche guardado", "success");
  } catch (error) {
    if (isGeolocationError(error)) {
      setGlobalStatus(geolocationMessage(error), "error");
    } else {
      setGlobalStatus("No se pudo guardar la ubicación.", "error");
    }
  } finally {
    setSaveButtonsDisabled(false);
  }
}

function renderParking(parking) {
  currentParking = parking;

  const date = new Date(parking.parked_at);
  parkedDate.textContent = formatParkedDate(date);
  parkedAge.textContent = formatElapsed(date);
  savedBy.textContent = `Guardado por ${parking.saved_by}`;

  startAgeTimer();
}

function openDirections() {
  if (!currentParking) return;

  const destination = `${currentParking.latitude},${currentParking.longitude}`;
  const url =
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;

  window.location.href = url;
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject({ code: -1 });
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

function formatParkedDate(date) {
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const time = new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  if (sameDay) {
    return `Hoy · ${time}`;
  }

  const day = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  }).format(date);

  return `${day} · ${time}`;
}

function formatElapsed(date) {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (seconds < 60) return "Ahora";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes
      ? `Hace ${hours} h ${remainingMinutes} min`
      : `Hace ${hours} h`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) return `Hace ${days} ${days === 1 ? "día" : "días"}`;

  const months = Math.floor(days / 30);
  if (months < 12) return `Hace ${months} ${months === 1 ? "mes" : "meses"}`;

  const years = Math.floor(days / 365);
  return `Hace ${years} ${years === 1 ? "año" : "años"}`;
}

function startAgeTimer() {
  stopAgeTimer();
  ageTimer = window.setInterval(() => {
    if (!currentParking) return;
    parkedAge.textContent = formatElapsed(new Date(currentParking.parked_at));
  }, 60_000);
}

function stopAgeTimer() {
  if (ageTimer !== null) {
    window.clearInterval(ageTimer);
    ageTimer = null;
  }
}

function showView(name) {
  for (const [viewName, element] of Object.entries(views)) {
    element.classList.toggle("hidden", viewName !== name);
  }
}

function setSaveButtonsDisabled(disabled) {
  for (const button of saveButtons) {
    button.disabled = disabled;
  }
}

function setGlobalStatus(message, type = "") {
  globalStatus.textContent = message;
  globalStatus.className = `global-status ${type}`.trim();
}

function clearStatus() {
  globalStatus.textContent = "";
  globalStatus.className = "global-status";
}

function isGeolocationError(error) {
  return error && typeof error.code === "number";
}

function geolocationMessage(error) {
  switch (error.code) {
    case 1:
      return "No tenemos permiso para acceder a tu ubicación.";
    case 2:
      return "No se pudo obtener tu ubicación.";
    case 3:
      return "La ubicación tardó demasiado. Vuelve a intentarlo.";
    default:
      return "Este dispositivo no permite obtener la ubicación.";
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // La PWA sigue siendo utilizable aunque falle el registro.
    });
  });
}
