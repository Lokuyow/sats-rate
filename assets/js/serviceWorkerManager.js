const SW_URL = "/sw.js";
const UPDATE_RELOAD_KEY = "osats-sw-reload-pending";

let newVersionAvailable = false;
let isCheckingForUpdates = false;
let isActivatingUpdate = false;
let registrationPromise = null;
let scheduledInitializationPromise = null;
let controllerChangeListenerAttached = false;
const updateListeners = new Set();
const observedRegistrations = new WeakSet();

function runAfterWindowLoad(callback) {
  if (document.readyState === "complete") {
    callback();
    return;
  }

  window.addEventListener("load", callback, { once: true });
}

function runWhenBrowserIdle(callback) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => {
      void callback();
    }, { timeout: 2000 });
    return;
  }

  window.setTimeout(() => {
    void callback();
  }, 0);
}

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
  updateListeners.forEach((listener) =>
    listener({
      newVersionAvailable,
      isCheckingForUpdates,
      isActivatingUpdate,
    })
  );
}

function updateState(nextState) {
  let hasChanged = false;

  if (typeof nextState.newVersionAvailable === "boolean" && nextState.newVersionAvailable !== newVersionAvailable) {
    newVersionAvailable = nextState.newVersionAvailable;
    hasChanged = true;
  }

  if (typeof nextState.isCheckingForUpdates === "boolean" && nextState.isCheckingForUpdates !== isCheckingForUpdates) {
    isCheckingForUpdates = nextState.isCheckingForUpdates;
    hasChanged = true;
  }

  if (typeof nextState.isActivatingUpdate === "boolean" && nextState.isActivatingUpdate !== isActivatingUpdate) {
    isActivatingUpdate = nextState.isActivatingUpdate;
    hasChanged = true;
  }

  if (hasChanged) {
    notifyUpdateListeners();
  }
}

function handleControllerChange() {
  updateState({
    newVersionAvailable: false,
    isCheckingForUpdates: false,
    isActivatingUpdate: false,
  });

  if (sessionStorage.getItem(UPDATE_RELOAD_KEY) !== "1") {
    return;
  }

  sessionStorage.removeItem(UPDATE_RELOAD_KEY);
  window.location.reload();
}

async function getLatestRegistration() {
  if (!isServiceWorkerUsable()) {
    return null;
  }

  if (registrationPromise) {
    await registrationPromise.catch(() => null);
  }

  const registration = await navigator.serviceWorker.getRegistration().catch(() => null);
  if (registration) {
    attachRegistrationListeners(registration);
  }

  return registration;
}

async function waitForInstallationOutcome(installingWorker) {
  return new Promise((resolve) => {
    const finish = (status) => resolve({ status });

    if (installingWorker.state === "installed") {
      getLatestRegistration().then((registration) => {
        if (navigator.serviceWorker.controller && registration && registration.waiting) {
          updateState({ newVersionAvailable: true });
          finish("update-ready");
          return;
        }

        finish("no-update");
      });
      return;
    }

    installingWorker.addEventListener("statechange", () => {
      if (installingWorker.state === "installed") {
        getLatestRegistration().then((registration) => {
          if (navigator.serviceWorker.controller && registration && registration.waiting) {
            updateState({ newVersionAvailable: true });
            finish("update-ready");
            return;
          }

          finish("no-update");
        });
      } else if (installingWorker.state === "activating") {
        updateState({ newVersionAvailable: false, isActivatingUpdate: true });
      } else if (installingWorker.state === "redundant") {
        finish("no-update");
      }
    });
  });
}

function attachRegistrationListeners(registration) {
  if (observedRegistrations.has(registration)) {
    if (registration.waiting && navigator.serviceWorker.controller) {
      updateState({ newVersionAvailable: true });
    }
    return;
  }

  observedRegistrations.add(registration);

  if (registration.waiting && navigator.serviceWorker.controller) {
    updateState({ newVersionAvailable: true });
  }

  registration.addEventListener("updatefound", () => {
    const installingWorker = registration.installing;
    if (!installingWorker) {
      return;
    }

    installingWorker.addEventListener("statechange", () => {
      if (installingWorker.state === "installed" && navigator.serviceWorker.controller && registration.waiting) {
        updateState({ newVersionAvailable: true });
      }
    });
  });
}

async function resolveUpdateReady(applyWhenReady) {
  updateState({ newVersionAvailable: true });

  if (applyWhenReady) {
    return applyServiceWorkerUpdate();
  }

  return { status: "update-ready" };
}

async function registerServiceWorker() {
  if (!isServiceWorkerUsable()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_URL, { updateViaCache: "none" });
    attachRegistrationListeners(registration);
    return registration;
  } catch (error) {
    console.error("Service Worker registration failed:", error);
    return null;
  }
}

export function initializeServiceWorker() {
  if (!isServiceWorkerUsable()) {
    return Promise.resolve(null);
  }

  if (!controllerChangeListenerAttached) {
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    controllerChangeListenerAttached = true;
  }

  if (!registrationPromise) {
    registrationPromise = registerServiceWorker();
  }

  return registrationPromise;
}

export function scheduleServiceWorkerInitialization() {
  if (!isServiceWorkerUsable()) {
    return Promise.resolve(null);
  }

  if (registrationPromise) {
    return registrationPromise;
  }

  if (!scheduledInitializationPromise) {
    scheduledInitializationPromise = new Promise((resolve) => {
      runAfterWindowLoad(() => {
        runWhenBrowserIdle(async () => {
          resolve(await initializeServiceWorker());
        });
      });
    });
  }

  return scheduledInitializationPromise;
}

export function subscribeToServiceWorkerUpdates(listener) {
  updateListeners.add(listener);
  listener({
    newVersionAvailable,
    isCheckingForUpdates,
    isActivatingUpdate,
  });

  return () => {
    updateListeners.delete(listener);
  };
}

export async function applyServiceWorkerUpdate() {
  const registration = (await getLatestRegistration()) || (await initializeServiceWorker());
  if (!registration) {
    return { status: "unavailable" };
  }

  if (!registration.waiting) {
    updateState({ newVersionAvailable: false, isActivatingUpdate: false });
    return { status: "no-update" };
  }

  updateState({ newVersionAvailable: false, isActivatingUpdate: true });
  sessionStorage.setItem(UPDATE_RELOAD_KEY, "1");
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
  return { status: "activating" };
}

export async function checkForServiceWorkerUpdates({ applyWhenReady = false } = {}) {

  if (isCheckingForUpdates || isActivatingUpdate) {
    return { status: "busy" };
  }

  const registration = (await initializeServiceWorker()) || (await getLatestRegistration());
  if (!registration) {
    return { status: "unavailable" };
  }

  if (registration.waiting) {
    return resolveUpdateReady(applyWhenReady);
  }

  updateState({ isCheckingForUpdates: true });

  try {
    await registration.update();

    const latestRegistration = await getLatestRegistration();
    if (!latestRegistration) {
      return { status: "unavailable" };
    }

    if (latestRegistration.waiting) {
      return resolveUpdateReady(applyWhenReady);
    }

    if (!latestRegistration.installing) {
      updateState({ newVersionAvailable: false });
      return { status: "no-update" };
    }

    const result = await waitForInstallationOutcome(latestRegistration.installing);
    if (result.status === "update-ready") {
      return resolveUpdateReady(applyWhenReady);
    }

    return result;
  } finally {
    updateState({ isCheckingForUpdates: false });
  }
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

void scheduleServiceWorkerInitialization();
