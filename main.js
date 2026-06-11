import { currencyManager } from "./assets/js/currencyManager.js";
import { Pos } from "./assets/js/pos.js";
import { formatCurrency, getLocaleSeparators, parseInput, updateCustomOptions } from "./assets/js/numberUtils.js";
import { loadJsonFromStorage } from "./assets/js/storage.js";
import {
  setupEventListenersForCurrencyButtons,
  shareViaWebAPIEvent,
  shareSiteViaWebAPIEvent,
  copySiteToClipboardEvent,
  showNotification,
  readFromClipboard,
} from "./assets/js/clipboardShare.js";
import {
  applyServiceWorkerUpdate,
  checkForServiceWorkerUpdates,
  displaySiteVersion,
  scheduleServiceWorkerInitialization,
  subscribeToServiceWorkerUpdates,
} from "./assets/js/serviceWorkerManager.js";

const BASE_URL = "https://osats.money/";
const dateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
};
let lastUpdatedField;
let lastUpdatedTimestamp = null;
let selectedLocale = navigator.language || navigator.languages[0];
let lastClickEvent = null;
window.currencyRates = {};
window.baseCurrencyValue = {};
let selectedCurrencies = [];
let currencyInputFields = [];
const pos = new Pos();
const DEFAULT_SELECTED_CURRENCIES = ["sats", "btc", "jpy", "usd", "eur"];
const MAX_SELECTED_CURRENCIES = 20;
const RESERVED_QUERY_PARAMS = new Set(["d", "currencies", "ts", "img_id", "lang"]);
let isServiceWorkerUpdateReady = false;
let isServiceWorkerUpdateBusy = false;

// 自動更新モードフラグ（初期値はローカルストレージから取得、未設定の場合はtrue）
const storedAutoUpdateEnabled = loadJsonFromStorage("autoUpdateEnabledLS", true);
let autoUpdateEnabled = typeof storedAutoUpdateEnabled === "boolean" ? storedAutoUpdateEnabled : true;

document.addEventListener("DOMContentLoaded", async () => {
  await initializeApp();
});

async function initializeApp() {
  // CurrencyManagerのインスタンスを作成
  currencyManager.setRatesUpdateCallback(updateGlobalCurrencyRates);

  // 通貨データをロードし、UIコンポーネントを初期化
  await currencyManager.loadCurrencies();

  initializeGlobalValues();

  await currencyManager.fetchCurrencyData(selectedCurrencies);

  // UIを更新
  currencyManager.updateCurrencyInputs(selectedCurrencies);

  // inputs変数を更新
  currencyInputFields = selectedCurrencies.map((id) => document.getElementById(id));

  // その他の初期化処理
  subscribeToServiceWorkerUpdates(({ newVersionAvailable: updateReady, isCheckingForUpdates, isActivatingUpdate }) => {
    isServiceWorkerUpdateReady = updateReady;
    isServiceWorkerUpdateBusy = isCheckingForUpdates || isActivatingUpdate;
    updateUpdateButtonState(updateReady, isServiceWorkerUpdateBusy);
  });
  void scheduleServiceWorkerInitialization()
    .then(async (registration) => {
      if (!registration) {
        return;
      }

      await displaySiteVersion();
      await checkForServiceWorkerUpdates();
    })
    .catch((error) => {
      console.error("An error occurred while scheduling service worker initialization:", error);
    });
  setupEventListeners();
  checkAndUpdateElements();
  document.addEventListener("visibilitychange", handleVisibilityChange);
  setupThemeToggle();
  setupPosDialogEventListeners();

  // 計算
  prepareAndCalculate(baseCurrencyValue);
}

function setupEventListeners() {
  setupInputFieldsEventListeners();
  setupCurrencyButtonsEventListeners();
  document.getElementById("share-results-via-webapi").addEventListener("click", handleShareViaWebAPI);
  document.getElementById("share-site-via-webapi").addEventListener("click", shareSiteViaWebAPIEvent);
  document.getElementById("copy-site-to-clipboard").addEventListener("click", copySiteToClipboardEvent);
  document.getElementById("update-prices").addEventListener("click", updateElementsBasedOnTimestamp);
  document.getElementById("saveDefaultValuesButton").addEventListener("click", (event) => {
    saveCurrentValuesAsDefault(event);
  });
  document.getElementById("checkForUpdateBtn").addEventListener("click", checkForUpdates);
  window.addEventListener("online", handleOnline);

  // 自動更新トグルの設定を追加
  const autoUpdateToggle = document.getElementById("auto-update-toggle");
  if (autoUpdateToggle) {
    autoUpdateToggle.checked = autoUpdateEnabled;
    autoUpdateToggle.addEventListener("change", (event) => {
      autoUpdateEnabled = event.target.checked;
      localStorage.setItem("autoUpdateEnabledLS", JSON.stringify(autoUpdateEnabled));
    });
  }

  const menuToggleButton = document.getElementById("menu-toggle-button");
  const floatingMenu = document.getElementById("floating-menu");

  if (menuToggleButton && floatingMenu) {
    // ホバー操作が可能な環境ではホバー開閉、そうでない環境ではタップ開閉
    const supportsHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    if (!supportsHover) {
      // タッチデバイスの場合：クリックでトグル
      menuToggleButton.addEventListener("click", (event) => {
        event.stopPropagation(); // documentへの伝播を防ぐ
        floatingMenu.classList.toggle("open");
      });

      // ドキュメントのどこかをクリックしたらメニューを閉じる
      document.addEventListener("click", () => {
        if (floatingMenu.classList.contains("open")) {
          floatingMenu.classList.remove("open");
        }
      });

      // メニュー自身へのクリックは、ドキュメントへの伝播を止める
      floatingMenu.addEventListener("click", (event) => {
        event.stopPropagation();
      });
    } else {
      // PCの場合：ホバーで表示
      let menuTimer;
      const showMenu = () => {
        clearTimeout(menuTimer);
        floatingMenu.classList.add("open");
      };

      const hideMenu = () => {
        menuTimer = setTimeout(() => {
          floatingMenu.classList.remove("open");
        }, 300);
      };

      menuToggleButton.addEventListener("mouseenter", showMenu);
      floatingMenu.addEventListener("mouseenter", showMenu);

      menuToggleButton.addEventListener("mouseleave", hideMenu);
      floatingMenu.addEventListener("mouseleave", hideMenu);
    }
  }
}

function getUpdateButtonElements() {
  const button = document.getElementById("checkForUpdateBtn");
  if (!button) {
    return {};
  }

  const label = document.getElementById("buttonLabel");
  const spinnerWrapper = button.querySelector(".spinner-wrapper");
  return { button, label, spinnerWrapper };
}

function getTranslatedUpdateButtonText(translationKey, fallbackText) {
  if (!window.vanilla_i18n_instance || !window.vanilla_i18n_instance._translationData) {
    return fallbackText;
  }

  return window.vanilla_i18n_instance.translate(translationKey) || fallbackText;
}

function updateUpdateButtonState(isUpdateReady, isBusy = isServiceWorkerUpdateBusy) {
  const { button, label, spinnerWrapper } = getUpdateButtonElements();
  if (!button || !label) {
    return;
  }

  const translationKey = isUpdateReady ? "updateUI.textContent" : "settings.update";
  const fallbackText = isUpdateReady ? "更新があります" : "更新をチェック";

  label.setAttribute("vanilla-i18n", translationKey);
  label.textContent = getTranslatedUpdateButtonText(translationKey, fallbackText);
  button.disabled = isBusy;
  button.setAttribute("aria-busy", isBusy ? "true" : "false");

  if (spinnerWrapper) {
    spinnerWrapper.style.display = isBusy ? "block" : "none";
  }
}

function setupInputFieldEventListeners(element) {
  element.addEventListener("keyup", handleInputFormatting);
  element.addEventListener("focus", handleFocus);
  element.addEventListener("contextmenu", handleContextMenu);
  element.addEventListener("paste", handleInputFormatting);
  element.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      this.blur();
    }
  });
}

// 通貨レートの更新をグローバル変数に反映するコールバック関数
function updateGlobalCurrencyRates(rates) {
  currencyRates = rates;
  updateCustomOptions(currencyRates);
  updateLastUpdated(currencyRates.last_updated_at);
}

function setupInputFieldsEventListeners() {
  currencyInputFields.forEach((element) => {
    if (!element) return; // elementがnullでないことを保証
    setupInputFieldEventListeners(element);
  });
}

async function handleOnline() {
  await currencyManager.fetchCurrencyData(selectedCurrencies);
  void checkForServiceWorkerUpdates().catch((error) => {
    console.error("An error occurred while checking for updates after reconnecting:", error);
  });
  checkAndUpdateElements();
}

function sanitizeSelectedCurrencies(candidateCurrencies) {
  if (!Array.isArray(candidateCurrencies)) {
    return [];
  }

  const allowedCurrencies = new Set(currencyManager.currencies);
  const sanitizedCurrencies = [];
  const seenCurrencies = new Set();

  candidateCurrencies.forEach((candidate) => {
    const currency = typeof candidate === "string" ? candidate.trim().toLowerCase() : "";

    if (!currency || seenCurrencies.has(currency) || !allowedCurrencies.has(currency)) {
      return;
    }

    seenCurrencies.add(currency);
    sanitizedCurrencies.push(currency);
  });

  return sanitizedCurrencies.slice(0, MAX_SELECTED_CURRENCIES);
}

function sanitizeBaseCurrencyValue(candidateBaseCurrencyValue) {
  if (!candidateBaseCurrencyValue || typeof candidateBaseCurrencyValue !== "object" || Array.isArray(candidateBaseCurrencyValue)) {
    return {};
  }

  const allowedCurrencies = new Set(currencyManager.currencies);

  for (const [candidateKey, candidateValue] of Object.entries(candidateBaseCurrencyValue)) {
    const currency = typeof candidateKey === "string" ? candidateKey.trim().toLowerCase() : "";
    const numericValue = Number.parseFloat(candidateValue);

    if (!allowedCurrencies.has(currency) || !Number.isFinite(numericValue)) {
      continue;
    }

    return { [currency]: numericValue };
  }

  return {};
}

function initializeGlobalValues() {
  const urlParams = new URLSearchParams(window.location.search);
  let querySelectedCurrencies = [];
  let queryBaseCurrencyValue = {};

  if (urlParams.toString()) {
    // URLクエリパラメータを優先して読み込む
    const decimalFormat = urlParams.get("d") || "p";
    const locale = decimalFormat === "c" ? "de-DE" : "en-US";

    // currencies パラメータから通貨リストを取得（ハイフンまたはカンマ区切り、互換性のため）
    const currenciesParam = urlParams.get("currencies");
    if (currenciesParam) {
      // ハイフンまたはカンマで分割
      const separator = currenciesParam.includes('-') ? '-' : ',';
      querySelectedCurrencies = currenciesParam.split(separator).map(s => s.trim()).filter(Boolean);
    }

    // その他のパラメータから基準通貨の値を取得
    urlParams.forEach((value, key) => {
      if (!RESERVED_QUERY_PARAMS.has(key)) {
        queryBaseCurrencyValue[key] = parseInput(value, locale);
      }
    });
  }

  // ローカルストレージからの読み込み
  let storageSelectedCurrencies = loadJsonFromStorage("selectedCurrenciesLS", []);
  let storageBaseCurrencyValue = loadJsonFromStorage("baseCurrencyValueLS", {});

  querySelectedCurrencies = sanitizeSelectedCurrencies(querySelectedCurrencies);
  storageSelectedCurrencies = sanitizeSelectedCurrencies(storageSelectedCurrencies);
  queryBaseCurrencyValue = sanitizeBaseCurrencyValue(queryBaseCurrencyValue);
  storageBaseCurrencyValue = sanitizeBaseCurrencyValue(storageBaseCurrencyValue);

  // URLクエリパラメータが優先
  selectedCurrencies = querySelectedCurrencies.length ? querySelectedCurrencies : storageSelectedCurrencies;
  baseCurrencyValue = Object.keys(queryBaseCurrencyValue).length ? queryBaseCurrencyValue : storageBaseCurrencyValue;

  // デフォルト値の設定
  if (!selectedCurrencies.length) {
    selectedCurrencies = [...DEFAULT_SELECTED_CURRENCIES];
    localStorage.setItem("selectedCurrenciesLS", JSON.stringify(selectedCurrencies));
  }

  if (!Object.keys(baseCurrencyValue).length) {
    baseCurrencyValue = { [selectedCurrencies[0]]: 100 };
  }

  processGlobalValues(Object.keys(queryBaseCurrencyValue).length > 0);

  // URLクエリパラメータの処理後に削除
  if (urlParams.toString()) {
    const currentUrl = new URL(window.location.href);
    const newUrl = `${currentUrl.origin}${currentUrl.pathname}`;
    window.history.replaceState(null, "", newUrl);
  }
}

function processGlobalValues(queryParamsBase) {
  const baseCurrencyKey = Object.keys(baseCurrencyValue)[0];

  if (baseCurrencyKey && !selectedCurrencies.includes(baseCurrencyKey)) {
    if (queryParamsBase) {
      selectedCurrencies = sanitizeSelectedCurrencies([baseCurrencyKey, ...selectedCurrencies]);
    } else {
      baseCurrencyValue = { [selectedCurrencies[0]]: 100 };
    }
  }
}

// キーボードから入力したときの直接入力フィールドの処理
function handleInputFormatting(event) {
  const inputElement = event.target;
  addCommasToInput(inputElement);
  const values = getValuesFromElements();

  // 計算元の通貨とその値を保存
  const currencyId = inputElement.id;
  const inputValue = values[currencyId];
  baseCurrencyValue = {};
  baseCurrencyValue[currencyId] = parseFloat(inputValue) || 0;
}

// 現在の入力値をデフォルト値としてローカルストレージに保存
function saveCurrentValuesAsDefault(event) {
  const currentValues = {};

  if (lastUpdatedField) {
    const rawValue = document.getElementById(lastUpdatedField).value;
    const sanitizedValue = parseInput(rawValue, selectedLocale);
    currentValues[lastUpdatedField] = sanitizedValue;
  }

  localStorage.setItem("baseCurrencyValueLS", JSON.stringify(currentValues));

  // 翻訳を使用
  const message = window.vanilla_i18n_instance.translate("showNotification.setup");
  showNotification(message, event);
}

function getInputValue(id) {
  const element = document.getElementById(id);
  return element ? parseInput(element.value, selectedLocale) : 0;
}

// 計算前に入力値をフォーマットしインプットフィールドに入れる
function prepareAndCalculate(baseCurrencyValue) {
  // baseCurrencyValue から最初の通貨コードを取得
  const baseCurrency = Object.keys(baseCurrencyValue)[0];
  const currencyValue = baseCurrencyValue[baseCurrency];
  const currencyInputField = document.getElementById(baseCurrency);

  if (baseCurrency && currencyInputField) {
    // 通貨値をフォーマット
    const formattedValue = formatCurrency(currencyValue, baseCurrency, selectedLocale, true);

    // 通貨の入力フィールドにフォーマットされた値を設定
    currencyInputField.value = formattedValue;

    // calculateValues 関数を呼び出して計算を実行
    calculateValues(baseCurrency);
  } else {
    console.error("Base currency is not valid or element does not exist.");
  }
}

// 計算
function calculateValues(inputField) {
  const satsInBtc = 1e8;

  const inputValues = selectedCurrencies.reduce((acc, currency) => {
    acc[currency] = parseFloat(getInputValue(currency)) || 0;
    return acc;
  }, {});

  if (inputField === "sats") {
    inputValues["btc"] = inputValues["sats"] / satsInBtc;
  } else if (inputField === "btc") {
    inputValues["sats"] = inputValues["btc"] * satsInBtc;
  } else {
    inputValues["btc"] = inputValues[inputField] / currencyRates[inputField];
    inputValues["sats"] = inputValues["btc"] * satsInBtc;
  }

  selectedCurrencies.forEach((currency) => {
    if (currency !== "btc" && currency !== "sats") {
      inputValues[currency] = inputValues["btc"] * (currencyRates[currency] || 0);
    }
  });

  // 最後に更新されたフィールドを記録
  lastUpdatedField = inputField;

  // 有効桁数の計算
  const inputDigits = inputValues[inputField].toString().replace(".", "").length;
  const significantDigits = calculateSignificantDigits(inputDigits);

  // 入力フィールドの更新
  selectedCurrencies.forEach((currency) => {
    const element = document.getElementById(currency);

    if (element) {
      // 直接入力ボックス
      if (currency === inputField) {
        // カーソル位置の維持
        const caretPos = element.selectionStart;
        element.setSelectionRange(caretPos, caretPos);
      } else {
        // 値のフォーマットと更新
        element.value = formatCurrency(inputValues[currency], currency, selectedLocale, true, significantDigits);
      }
    }
  });

  changeBackgroundColorFromId(inputField);
}

// 直接入力時の数値処理
function addCommasToInput(inputElement) {
  const originalCaretPos = inputElement.selectionStart;
  const originalSelectionEnd = inputElement.selectionEnd;
  const separators = getLocaleSeparators(selectedLocale);
  const originalValue = parseInput(inputElement.value, selectedLocale);

  if (originalValue === "") {
    inputElement.value = "0";
    inputElement.selectionStart = 1;
    inputElement.selectionEnd = 1;
    return;
  }

  let preSeparatorCount = (inputElement.value.slice(0, originalCaretPos).match(new RegExp(`\\${separators.groupSeparator}`, "g")) || []).length;

  let formattedValue;
  if (originalValue.endsWith(".") || (originalValue.includes(".") && originalCaretPos > originalValue.indexOf("."))) {
    const parts = originalValue.split(".");
    const integerPart = parts[0];
    formattedValue = new Intl.NumberFormat(selectedLocale, { numberingSystem: "latn" }).format(parseFloat(integerPart));

    if (parts[1] !== undefined) {
      formattedValue += separators.decimalSeparator + parts[1];
    } else if (originalValue.endsWith(".")) {
      formattedValue += separators.decimalSeparator;
    }
  } else {
    const currencyId = inputElement.id;
    formattedValue = formatCurrency(originalValue, currencyId, selectedLocale, false);
  }

  let postSeparatorCount = (formattedValue.slice(0, originalCaretPos).match(new RegExp(`\\${separators.groupSeparator}`, "g")) || []).length;
  let diffSeparatorCount = postSeparatorCount - preSeparatorCount;

  if (inputElement.value !== formattedValue) {
    inputElement.value = formattedValue;

    if (originalCaretPos === 0 && originalSelectionEnd === originalValue.length) {
      inputElement.selectionStart = 0;
      inputElement.selectionEnd = formattedValue.length;
      return;
    }

    let newCaretPos = originalCaretPos + diffSeparatorCount;

    if (newCaretPos < 0) newCaretPos = 0;
    if (newCaretPos > formattedValue.length) newCaretPos = formattedValue.length;

    inputElement.selectionStart = newCaretPos;
    inputElement.selectionEnd = newCaretPos;
  }
}

// インプットフィールドから桁区切りを取り除いた数値を取得
function getValuesFromElements() {
  const values = {};
  selectedCurrencies.forEach((field) => {
    const rawValue = document.getElementById(field).value;
    values[field] = parseInput(rawValue, selectedLocale);
  });
  return values;
}

// 有効桁数を算出する
// 基本桁数8 + 入力桁数 - 1 = 有効桁数(最大10)
function calculateSignificantDigits(inputDigits) {
  let dynamicSignificantDigits = 8;
  if (inputDigits > 1) {
    dynamicSignificantDigits += inputDigits - 1;
  }
  return Math.min(dynamicSignificantDigits, 10);
}

// データ取得日時のunixtimeの変換と表示
function updateLastUpdated(timestamp) {
  const updatedAt = new Date(timestamp * 1000);
  const userLocale = navigator.language || navigator.userLanguage;
  const formatter = new Intl.DateTimeFormat(userLocale, {
    ...dateTimeFormatOptions,
    numberingSystem: "latn", // numberingSystemを追加
  });
  const formattedDate = formatter.format(updatedAt);

  document.getElementById("last-updated").textContent = formattedDate;
  lastUpdatedTimestamp = timestamp;

  return formattedDate;
}

// ページ読み込みもしくは表示状態が変わった際の要素更新処理
export function checkAndUpdateElements() {
  const diffTime = Math.floor(Date.now() / 1000) - lastUpdatedTimestamp;
  const updatePricesElement = document.getElementById("update-prices");
  const lastUpdatedElement = document.getElementById("last-updated");

  updateElementClass(updatePricesElement, diffTime >= 610);
  updateElementClass(lastUpdatedElement, diffTime >= 610);

  // 既存のタイマーをクリア
  if (updateTimer) {
    clearTimeout(updateTimer);
  }

  // 610秒経過していない場合、残り時間をタイマーにセット
  if (diffTime < 610) {
    const remainingTime = (610 - diffTime) * 1000 + 1000; // ミリ秒に変換して1秒追加
    updateTimer = setTimeout(() => {
      checkAndUpdateElements();
    }, remainingTime);
  }
}

// タイマーのIDを保持するための変数を追加
let updateTimer = null;

function handleVisibilityChange() {
  if (document.hidden) {
    // 画面が非表示になったらタイマーをクリア
    if (updateTimer) {
      clearTimeout(updateTimer);
      updateTimer = null;
    }
    return;
  }

  // 画面が表示された時の処理
  checkAndUpdateElements();
}

// レート更新ボタンを押したとき
async function updateElementsBasedOnTimestamp() {
  const diffTime = Math.floor(Date.now() / 1000) - lastUpdatedTimestamp;

  const updatePricesElement = document.getElementById("update-prices");
  const lastUpdatedElement = document.getElementById("last-updated");

  if (diffTime >= 610) {
    // すぐにアニメーションを開始
    let svg = updatePricesElement.querySelector("svg");
    if (svg && !svg.classList.contains("rotated")) {
      svg.classList.add("rotated");
    }

    // 更新中の状態を設定
    updatePricesElement.classList.add("updating");

    // アニメーション開始時刻を記録
    const animationStartTime = Date.now();

    try {
      // データを取得
      await currencyManager.fetchCurrencyData(selectedCurrencies);
      const updatedDiffTime = Math.floor(Date.now() / 1000) - lastUpdatedTimestamp;

      // 計算処理
      if (lastUpdatedField) {
        calculateValues(lastUpdatedField);
      }

      // 最低アニメーション持続時間を保証
      const animationDuration = Date.now() - animationStartTime;
      if (animationDuration < 800) {
        await new Promise((resolve) => setTimeout(resolve, 800 - animationDuration));
      }

      // 要素のクラスを更新
      updateElementClass(updatePricesElement, updatedDiffTime >= 610);
      updateElementClass(lastUpdatedElement, updatedDiffTime >= 610);
    } catch (error) {
      console.error("データの更新中にエラーが発生しました:", error);

      // エラー時も最低アニメーション時間を保証
      const animationDuration = Date.now() - animationStartTime;
      if (animationDuration < 800) {
        await new Promise((resolve) => setTimeout(resolve, 800 - animationDuration));
      }

      // エラー状態の表示
      updatePricesElement.classList.add("outdated");
      updatePricesElement.classList.remove("recent");
    } finally {
      // アニメーションを終了
      if (svg) {
        svg.classList.remove("rotated");
      }
      // 更新中の状態を解除
      updatePricesElement.classList.remove("updating");
    }
  }
}

// 変更後のupdateElementClass関数
function updateElementClass(element, isOutdated) {
  if (isOutdated) {
    element.classList.add("outdated");
    element.classList.remove("recent");
    // 自動更新が有効かつ更新中でなければ、直ちに更新処理を実行
    if (element.id === "update-prices" && autoUpdateEnabled && !element.classList.contains("updating")) {
      element.classList.add("updating");
      void updateElementsBasedOnTimestamp();
    }
  } else {
    element.classList.remove("outdated");
    element.classList.add("recent");
    element.classList.remove("updating");
  }
  element.style.visibility = "visible";
}

// 選択
function handleFocus(event) {
  event.target.select();
}

function handleContextMenu(event) {
  if (isMobileDevice() && event.target.tagName.toLowerCase() === "input") {
    event.preventDefault();
  }
}

function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

//計算元の入力ボックスの色を変更
function changeBackgroundColorFromId(id) {
  currencyInputFields.forEach((input) => input.classList.remove("last-input-field"));

  const targetInput = document.getElementById(id);
  targetInput.classList.add("last-input-field");
}

// 通貨ボタンのイベントリスナー設定（clipboardShare.jsのラッパー）
function setupCurrencyButtonsEventListeners() {
  setupEventListenersForCurrencyButtons(
    selectedCurrencies,
    getLocaleSeparators,
    selectedLocale,
    pasteFromClipboardToInput
  );
}

// クリップボードから貼り付け
async function pasteFromClipboardToInput(currency) {
  const clipboardData = await readFromClipboard();
  const inputElement = document.getElementById(currency);
  inputElement.value = clipboardData;
  lastUpdatedField = currency;
  handleInputFormatting({ target: inputElement });
  calculateValues(currency);
}

// Web Share API イベントハンドラー（clipboardShare.jsのラッパー）
function handleShareViaWebAPI(event) {
  shareViaWebAPIEvent(
    {
      lastUpdatedField,
      selectedCurrencies,
      parseInput,
      selectedLocale,
      lastUpdatedTimestamp,
      getLocaleSeparators,
    },
    event
  );
}

// テーマ変更トグル
function setupThemeToggle() {
  const themeToggle = document.querySelector("#themeToggle");
  themeToggle.addEventListener("change", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  });
}

// サイト更新ボタン
async function checkForUpdates(event) {
  lastClickEvent = event; // クリックイベントを保存
  if (isServiceWorkerUpdateBusy) {
    return;
  }

  try {
    const result = isServiceWorkerUpdateReady ? await applyServiceWorkerUpdate() : await checkForServiceWorkerUpdates();

    if (result.status === "no-update") {
      const message = window.vanilla_i18n_instance.translate("showNotification.up");
      showNotification(message, lastClickEvent);
    } else if (result.status === "update-ready") {
      updateUpdateButtonState(true);
    } else if (result.status === "activating" || result.status === "busy") {
      return;
    } else if (result.status === "unavailable") {
      console.warn("No active service worker registration found");
    }
  } catch (error) {
    console.error("An error occurred while checking for updates:", error);
  }
}

function setupPosDialogEventListeners() {
  pos.initialize();

  /**
   * ライトニングアドレスのダイアログの制御
   */
  const showAddressButton = document.getElementById("show-lightning-address-dialog");
  const lnDialog = document.getElementById("update-lightning-address-dialog");
  const lnDialogSubmitButton = document.getElementById("lightning-address-submit-button");
  const lnDialogCloseButton = document.getElementById("lightning-address-close-button");
  const lnDialogClearButton = document.getElementById("lightning-address-clear-button");
  const lnAddressForm = document.getElementById("lightning-address-form");

  if (!showAddressButton || !lnDialog || !lnDialogSubmitButton || !lnDialogCloseButton || !lnDialogClearButton || !lnAddressForm) {
    return;
  }

  // ダイアログを開く
  showAddressButton.addEventListener("click", () => {
    lnDialog.showModal();
  });

  // ダイアログを閉じる
  lnDialogCloseButton.addEventListener("click", (event) => {
    event.preventDefault(); // フォームを送信しない
    lnDialog.close();
  });

  // フォームをクリアして設定
  lnDialogClearButton.addEventListener("click", (event) => {
    event.preventDefault(); // フォームを送信しない
    pos.clearLnAddress();
    lnDialog.close();
  });

  // ライトニングアドレスのダイアログの外側をクリックして閉じる
  lnDialog.addEventListener("click", (event) => {
    const rect = lnDialog.getBoundingClientRect();
    const isInDialog = rect.top <= event.clientY && event.clientY <= rect.bottom && rect.left <= event.clientX && event.clientX <= rect.right;

    if (!isInDialog) {
      lnDialog.close();
    }
  });

  // アドレスを設定する
  lnDialogSubmitButton.addEventListener("click", (event) => {
    const isValid = lnAddressForm.checkValidity();
    if (!isValid) {
      return;
    }

    pos.setLnAddress(lnAddressForm);
    event.preventDefault(); // フォームを送信しない
    lnDialog.close();
  });

  /**
   * 支払いインボイスのQRコードダイアログの制御
   */
  const showInvoiceButton = document.getElementById("show-invoice-dialog");
  const invoiceDialog = document.getElementById("lightning-invoice-dialog");
  const invoiceDialogCloseButton = document.getElementById("lightning-invoice-close-button");

  if (!showInvoiceButton || !invoiceDialog || !invoiceDialogCloseButton) {
    return;
  }

  // ダイアログを開く
  showInvoiceButton.addEventListener("click", () => {
    invoiceDialog.showModal();
    pos.showInvoice();
  });

  // ダイアログを閉じる
  invoiceDialogCloseButton.addEventListener("click", (event) => {
    event.preventDefault(); // フォームを送信しない
    invoiceDialog.close();
    pos.clearMessage();
  });

  // インボイスのダイアログの外側をクリックして閉じる
  invoiceDialog.addEventListener("click", (event) => {
    const rect = invoiceDialog.getBoundingClientRect();
    const isInDialog =
      rect.top <= event.clientY &&
      event.clientY <= rect.bottom &&
      rect.left <= event.clientX &&
      event.clientX <= rect.right;

    if (!isInDialog) {
      invoiceDialog.close();
      pos.clearMessage();
    }
  });
}

// index.htmlで使用する関数をグローバルスコープで使用できるようにwindowに追加する
window.satsRate = {
  calculateValues,
};
