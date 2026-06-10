const SW_URL = "/sw.js";
const UPDATE_RELOAD_KEY = "osats-sw-reload-pending";

let newVersionAvailable = false;
let registrationPromise = null;
const updateListeners = new Set();

function isServiceWorkerUsable() {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service Worker is not supported in this browser.");
    return false;
  }

  if (!isSecureContext) {
    console.warn(
      "Service Worker registration skipped: Not in secure context (HTTP + private IP). " +
        "App works in offline-limited mode. For full PWA features, use HTTPS or localhost."
    );
    return false;
  }

  return true;
}

function notifyUpdateListeners() {
  updateListeners.forEach((listener) => listener({ newVersionAvailable }));
}

function setNewVersionAvailable(value) {
  if (newVersionAvailable === value) {
    return;
  }

  newVersionAvailable = value;
  notifyUpdateListeners();
}

function handleControllerChange() {
  if (sessionStorage.getItem(UPDATE_RELOAD_KEY) !== "1") {
    return;
  }

  sessionStorage.removeItem(UPDATE_RELOAD_KEY);
  window.location.reload();
}

async function waitForInstallationOutcome(registration, installingWorker) {
  return new Promise((resolve) => {
    const finish = (status) => resolve({ status });

    if (installingWorker.state === "installed") {
      if (navigator.serviceWorker.controller && registration.waiting) {
        setNewVersionAvailable(true);
        finish("update-ready");
      } else {
        finish("no-update");
      }
      return;
    }

    installingWorker.addEventListener("statechange", () => {
      if (installingWorker.state === "installed") {
        if (navigator.serviceWorker.controller && registration.waiting) {
          setNewVersionAvailable(true);
          finish("update-ready");
        } else {
          finish("no-update");
        }
      } else if (installingWorker.state === "redundant") {
        finish("no-update");
      }
    });
  });
}

function attachRegistrationListeners(registration) {
  if (registration.waiting) {
    setNewVersionAvailable(true);
  }

  registration.addEventListener("updatefound", () => {
    const installingWorker = registration.installing;
    if (!installingWorker) {
      return;
    }

    installingWorker.addEventListener("statechange", () => {
      if (installingWorker.state === "installed" && navigator.serviceWorker.controller && registration.waiting) {
        setNewVersionAvailable(true);
      }
    });
  });
}

async function registerServiceWorker() {
  if (!isServiceWorkerUsable()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_URL);
    attachRegistrationListeners(registration);
    return registration;
  } catch (error) {
    console.error("Service Worker registration failed:", error);
    return null;
  }
}

export function initializeServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }

  if (!registrationPromise) {
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    registrationPromise = registerServiceWorker();
  }

  return registrationPromise;
}

export function subscribeToServiceWorkerUpdates(listener) {
  updateListeners.add(listener);
  listener({ newVersionAvailable });

  return () => {
    updateListeners.delete(listener);
  };
}

export async function applyServiceWorkerUpdate() {
  const registration = await initializeServiceWorker();
  if (!registration || !registration.waiting) {
    return false;
  }

  sessionStorage.setItem(UPDATE_RELOAD_KEY, "1");
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
  return true;
}

export async function checkForServiceWorkerUpdates() {
  const registration = await initializeServiceWorker();
  if (!registration) {
    return { status: "unavailable" };
  }

  if (registration.waiting || newVersionAvailable) {
    await applyServiceWorkerUpdate();
    return { status: "activating" };
  }

  await registration.update();

  if (registration.waiting) {
    setNewVersionAvailable(true);
    return { status: "update-ready" };
  }

  if (!registration.installing) {
    return { status: "no-update" };
  }

  return waitForInstallationOutcome(registration, registration.installing);
}

export async function fetchVersionFromSW() {
  const registration = await initializeServiceWorker();
  if (!registration) {
    return null;
  }

  const activeRegistration = registration.active ? registration : await navigator.serviceWorker.ready.catch(() => null);
  if (!activeRegistration || !activeRegistration.active) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      if (event.data.error) {
        reject(event.data.error);
      } else {
        resolve(event.data.version);
      }
    };

    activeRegistration.active.postMessage({ type: "GET_VERSION" }, [messageChannel.port2]);
  });
}

export async function displaySiteVersion(elementId = "siteVersion") {
  const target = document.getElementById(elementId);
  if (!target) {
    return;
  }

  const version = await fetchVersionFromSW();
  if (version) {
    target.textContent = version;
  }
}

initializeServiceWorker();
