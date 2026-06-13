const SW_URL = "/sw.js";

let newVersionAvailable = false;
let isCheckingForUpdates = false;
let isActivatingUpdate = false;
let registrationPromise = null;
let scheduledInitializationPromise = null;
let controllerChangeListenerAttached = false;
let pageExitListenerAttached = false;
let knownRegistration = null;
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

function rememberRegistration(registration) {
  if (registration) {
    knownRegistration = registration;
  }
}

function promoteWaitingWorkerForNextNavigation() {
  const waitingWorker = knownRegistration?.waiting;
  if (!waitingWorker) {
    return;
  }

  waitingWorker.postMessage({ type: "SKIP_WAITING" });
}

function handlePageExit(event) {
  if (event.type === "pagehide" && event.persisted) {
    return;
  }

  promoteWaitingWorkerForNextNavigation();
}

function ensurePageExitListener() {
  if (pageExitListenerAttached) {
    return;
  }

  window.addEventListener("beforeunload", handlePageExit);
  window.addEventListener("pagehide", handlePageExit);
  pageExitListenerAttached = true;
}

function ensureControllerChangeListener() {
  if (controllerChangeListenerAttached) {
    return;
  }

  navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
  controllerChangeListenerAttached = true;
}

function handleControllerChange() {
  updateState({
    newVersionAvailable: false,
    isCheckingForUpdates: false,
    isActivatingUpdate: false,
  });

  void displaySiteVersion().catch((error) => {
    console.error("Failed to refresh the displayed service worker version:", error);
  });
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
    rememberRegistration(registration);
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

function syncWaitingUpdateState(registration) {
  if (registration.waiting && navigator.serviceWorker.controller && !isActivatingUpdate) {
    updateState({ newVersionAvailable: true });
  }
}

function attachRegistrationListeners(registration) {
  rememberRegistration(registration);

  if (observedRegistrations.has(registration)) {
    syncWaitingUpdateState(registration);
    return;
  }

  observedRegistrations.add(registration);

  syncWaitingUpdateState(registration);

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

async function resolveUpdateReady() {
  updateState({ newVersionAvailable: true });

  return { status: "update-ready" };
}

async function activateWaitingServiceWorker(registration) {
  if (!registration.waiting) {
    updateState({ newVersionAvailable: false, isActivatingUpdate: false });
    return { status: "no-update" };
  }

  updateState({ newVersionAvailable: false, isActivatingUpdate: true });
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
  return { status: "activating" };
}

async function registerServiceWorker() {
  if (!isServiceWorkerUsable()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_URL, { updateViaCache: "none" });
    rememberRegistration(registration);
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

  ensureControllerChangeListener();
  ensurePageExitListener();

  if (!registrationPromise) {
    registrationPromise = registerServiceWorker();
  }

  return registrationPromise;
}

export async function activateWaitingServiceWorkerOnStartup() {
  if (!isServiceWorkerUsable()) {
    return { status: "unavailable" };
  }

  ensureControllerChangeListener();
  ensurePageExitListener();

  const registration = await getLatestRegistration();
  if (!registration) {
    return { status: "unavailable" };
  }

  if (!registration.waiting) {
    return { status: "no-update" };
  }

  return activateWaitingServiceWorker(registration);
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

  return activateWaitingServiceWorker(registration);
}

export async function checkForServiceWorkerUpdates() {
  if (isCheckingForUpdates || isActivatingUpdate) {
    return { status: "busy" };
  }

  const registration = (await initializeServiceWorker()) || (await getLatestRegistration());
  if (!registration) {
    return { status: "unavailable" };
  }

  if (registration.waiting) {
    return resolveUpdateReady();
  }

  updateState({ isCheckingForUpdates: true });

  try {
    await registration.update();

    const latestRegistration = await getLatestRegistration();
    if (!latestRegistration) {
      return { status: "unavailable" };
    }

    if (latestRegistration.waiting) {
      return resolveUpdateReady();
    }

    if (!latestRegistration.installing) {
      updateState({ newVersionAvailable: false });
      return { status: "no-update" };
    }

    const result = await waitForInstallationOutcome(latestRegistration.installing);
    if (result.status === "update-ready") {
      return resolveUpdateReady();
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
