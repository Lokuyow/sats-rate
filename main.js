import { currencyManager } from "./assets/js/currencyManager.js";

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
let customOptions = {
  sats: { maximumFractionDigits: 0, minimumFractionDigits: 0 },
  btc: { maximumFractionDigits: 8, minimumFractionDigits: 0 },
};

// 自動更新モードフラグ（初期値はローカルストレージから取得、未設定の場合はtrue）
let autoUpdateEnabled = localStorage.getItem("autoUpdateEnabledLS") === null ? true : JSON.parse(localStorage.getItem("autoUpdateEnabledLS"));

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
  await registerAndHandleServiceWorker();
  await displaySiteVersion();
  setupEventListeners();
  checkAndUpdateElements();
  document.addEventListener("visibilitychange", handleVisibilityChange);
  setupThemeToggle();

  // 計算
  prepareAndCalculate(baseCurrencyValue);
}

function setupEventListeners() {
  setupInputFieldsEventListeners();
  setupEventListenersForCurrencyButtons();
  document.getElementById("share-via-webapi").addEventListener("click", shareViaWebAPIEvent);
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
    // タッチデバイスかどうかを判定
    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

    if (isTouchDevice) {
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
  checkAndUpdateElements();
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

    urlParams.forEach((value, key) => {
      if (key !== "d" && key !== "currencies" && key !== "ts") {
        queryBaseCurrencyValue[key] = parseInput(value, locale);
      }
    });
  }

  // ローカルストレージからの読み込み
  let storageSelectedCurrencies = JSON.parse(localStorage.getItem("selectedCurrenciesLS")) || [];
  let storageBaseCurrencyValue = JSON.parse(localStorage.getItem("baseCurrencyValueLS")) || {};

  // URLクエリパラメータが優先
  selectedCurrencies = querySelectedCurrencies.length ? querySelectedCurrencies : storageSelectedCurrencies;
  baseCurrencyValue = Object.keys(queryBaseCurrencyValue).length ? queryBaseCurrencyValue : storageBaseCurrencyValue;

  // デフォルト値の設定
  if (!selectedCurrencies.length) {
    selectedCurrencies = ["sats", "btc", "jpy", "usd", "eur"];
    localStorage.setItem("selectedCurrenciesLS", JSON.stringify(selectedCurrencies));
  }

  if (!Object.keys(baseCurrencyValue).length) {
    baseCurrencyValue = { [selectedCurrencies[0]]: 100 };
  }

  processGlobalValues(querySelectedCurrencies.length > 0, Object.keys(queryBaseCurrencyValue).length > 0);

  // URLクエリパラメータの処理後に削除
  if (urlParams.toString()) {
    const currentUrl = new URL(window.location.href);
    const newUrl = `${currentUrl.origin}${currentUrl.pathname}`;
    window.history.replaceState(null, "", newUrl);
  }
}

function processGlobalValues(queryParamsSelected, queryParamsBase) {
  const baseCurrencyKey = Object.keys(baseCurrencyValue)[0];

  if (queryParamsBase) {
    // URLクエリパラメータでbaseCurrencyValueが設定された場合
    if (baseCurrencyKey && !selectedCurrencies.includes(baseCurrencyKey)) {
      selectedCurrencies.unshift(baseCurrencyKey);
    }
  }

  if (queryParamsSelected) {
    // URLクエリパラメータでselectedCurrenciesが設定された場合
    if (baseCurrencyKey && !selectedCurrencies.includes(baseCurrencyKey)) {
      baseCurrencyValue = { [selectedCurrencies[0]]: 100 };
    }
  } else {
    // ローカルストレージからselectedCurrenciesが設定された場合
    if (baseCurrencyKey && !selectedCurrencies.includes(baseCurrencyKey)) {
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

//　ロケールから桁区切りと小数点の文字を取得
function getLocaleSeparators(locale) {
  const formattedNumber = new Intl.NumberFormat(locale, { numberingSystem: "latn" }).format(1000.1);
  return {
    groupSeparator: formattedNumber[1], // 桁区切り文字
    decimalSeparator: formattedNumber[5], // 小数点の区切り文字
  };
}

//ピリオドを小数点とし、桁区切り文字を使わないよう変換
function parseInput(inputValue, locale) {
  const separators = getLocaleSeparators(locale);

  // 数字、小数点、桁区切り文字以外の文字を削除
  const onlyNumbersAndSeparators = inputValue.replace(/[^0-9\.,]/g, "");

  const sanitizedValue = onlyNumbersAndSeparators.replace(new RegExp(`\\${separators.groupSeparator}`, "g"), "").replace(separators.decimalSeparator, ".");

  return sanitizedValue;
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

// カスタムオプションを更新する関数
function updateCustomOptions(rates) {
  // 各通貨についてループ
  for (const [key, value] of Object.entries(rates)) {
    // sats と btc はスキップ
    if (key === "sats" || key === "btc" || key === "last_updated_at") continue;

    // 小数点以上の桁数を計算
    let integerDigits = Math.floor(value).toString().length;
    let maximumFractionDigits = 10 - integerDigits;

    // maximumFractionDigitsは0以上でなければならない
    maximumFractionDigits = Math.max(0, maximumFractionDigits);

    // カスタムオプションの更新
    customOptions[key] = {
      maximumFractionDigits: maximumFractionDigits,
      minimumFractionDigits: 0,
    };
  }
}

// 小数点以下の制限、ロケールごとの小数点記号の記法
export function formatCurrency(num, id, selectedLocale, shouldRound = true, significantDigits) {
  // numが数値でない場合、数値に変換
  if (typeof num !== "number") {
    num = parseFloat(num);
    if (isNaN(num)) {
      console.error("Invalid type for num:", num);
      return;
    }
  }

  // significantDigitsが指定されている場合、指定の桁数で数値を丸める
  let roundedNum = shouldRound ? Number(num.toPrecision(significantDigits)) : num;

  // 通貨ごとのフォーマットオプションを取得
  const formatOptions = {
    ...customOptions[id],
    numberingSystem: "latn",
  };
  const maximumFractionDigits = formatOptions.maximumFractionDigits;
  const numFractionDigits = (roundedNum.toString().split(".")[1] || "").length;

  // 小数点以下の桁数が規定以上の場合丸める
  if (numFractionDigits > maximumFractionDigits) {
    roundedNum = Number(roundedNum.toFixed(maximumFractionDigits));
  }

  // ロケールに応じて数値をフォーマットし、返却
  return roundedNum.toLocaleString(selectedLocale, formatOptions);
}

// 有効桁数を算出する
// 基本桁数7 + 入力桁数 - 1 = 有効桁数(最大10)
function calculateSignificantDigits(inputDigits) {
  let dynamicSignificantDigits = 7;
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
    // 自動更新が有効かつ更新中でなければ、直ちに自動クリック
    if (element.id === "update-prices" && autoUpdateEnabled && !element.classList.contains("updating")) {
      element.classList.add("updating");
      element.click();
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

// ポップアップ表示
function showNotification(message, event, align = "right") {
  const notification = document.getElementById("notification");
  notification.innerHTML = message.replace(/\n/g, '<br>');

  // Handle null event (fallback scenarios)
  if (event && event.pageX !== undefined && event.pageY !== undefined) {
    notification.style.left = event.pageX + "px";
    notification.style.top = event.pageY + 20 + "px";
  } else {
    // Center position as fallback
    notification.style.left = "50%";
    notification.style.top = "50px";
    notification.style.transform = "translateX(-50%)";
  }

  if (event && align === "left") {
    notification.style.transform = "translateX(0)";
  } else if (event && align === "right") {
    notification.style.transform = "translateX(-100%)";
  }

  notification.style.visibility = "visible";

  setTimeout(() => {
    notification.style.visibility = "hidden";
  }, 1000);
}


function generateQueryStringFromValues(imgId = null) {
  if (!lastUpdatedField || !selectedCurrencies.length) return "";

  const baseKey = lastUpdatedField;
  const separators = getLocaleSeparators(selectedLocale);
  const decimalFormat = separators.decimalSeparator === "," ? "c" : "p";

  // 画面に表示されている値を取得し、URLに適した形式に変換
  const baseDisplayValue = document.getElementById(baseKey).value;
  const baseNormalized = parseInput(baseDisplayValue, selectedLocale); // 一旦ピリオドに正規化
  const baseValue = baseNormalized.replace(".", separators.decimalSeparator); // ロケールに合わせて置換

  // currencies パラメータ（全選択通貨、ハイフン区切り）
  const currencies = selectedCurrencies.join('-');

  // 各通貨のkey=valueペアを構築（入力値のみ）
  const params = new URLSearchParams();
  params.set(baseKey, baseValue);
  params.set('currencies', currencies);

  // img_idがあれば追加
  if (imgId) {
    params.set('img_id', imgId);
  }

  params.set('d', decimalFormat);

  return `?${params.toString()}`;
}

// インプットフィールドから桁区切りを取り除いた数値を取得
function getValuesFromElements() {
  const values = {};
  const inputFields = selectedCurrencies;

  inputFields.forEach((field) => {
    const rawValue = document.getElementById(field).value;
    values[field] = parseInput(rawValue, selectedLocale);
  });
  return values;
}

// コピー用テキストの作成

export function setupEventListenersForCurrencyButtons() {
  selectedCurrencies.forEach((currency) => {
    // コピーイベントリスナーの設定
    const copyButton = document.getElementById("copy-" + currency);
    if (copyButton) {
      // ボタンが存在するか確認
      copyButton.addEventListener("click", function (event) {
        copySingleCurrencyToClipboardEvent(event);
      });
    }

    // ペーストイベントリスナーの設定
    const pasteButton = document.getElementById("paste-" + currency);
    if (pasteButton) {
      // ボタンが存在するか確認
      pasteButton.addEventListener("click", function () {
        pasteFromClipboardToInput(currency);
      });
    }
  });

  // すべての通貨をコピーするためのイベントリスナーの設定
  const copyToClipboardButton = document.getElementById("copy-to-clipboard");
  if (copyToClipboardButton) {
    // ボタンが存在するか確認
    copyToClipboardButton.addEventListener("click", copyToClipboardEvent);
  }
}

// クリップボードにコピー　各通貨
function copySingleCurrencyToClipboardEvent(event) {
  const currency = event.target.dataset.currency;
  const inputValue = document.getElementById(currency).value;
  const separators = getLocaleSeparators(selectedLocale);
  const sanitizedValue = inputValue.replace(new RegExp(`\\${separators.groupSeparator}`, "g"), ""); // 桁区切りを削除
  copyToClipboard(sanitizedValue, event, "left");
}

// クリップボードにコピー　全体（OGP画像生成付き）
async function copyToClipboardEvent(event) {
  // イベント伝播を防止
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  try {
    console.log('[copyToClipboardEvent] Starting...');
    // OGP画像を生成してR2にアップロード
    const imgId = await generateAndUploadOgpImage();
    console.log('[copyToClipboardEvent] Got img_id:', imgId);

    const queryParams = generateQueryStringFromValues(imgId);
    console.log('[copyToClipboardEvent] Generated query params:', queryParams);

    const textToCopy = `${BASE_URL}${queryParams}`;
    console.log('[copyToClipboardEvent] Text to copy:', textToCopy);

    copyToClipboard(textToCopy, event, "right");
    console.log('[copyToClipboardEvent] Completed successfully');
    console.log('[copyToClipboardEvent] NOTE: Page refresh after this is likely due to Service Worker or Live Preview auto-reload');
  } catch (error) {
    console.error("[copyToClipboardEvent] Failed to generate OGP image:", error);
    console.error("[copyToClipboardEvent] Error stack:", error.stack);
    alert(`エラーが発生しました: ${error.message}\n\nコンソールで詳細を確認してください。`);
    // フォールバック: img_idなしでコピー
    const queryParams = generateQueryStringFromValues(null);
    const textToCopy = `${BASE_URL}${queryParams}`;
    copyToClipboard(textToCopy, event, "right");
  }
}

// コピー
function copyToClipboard(text, event, align = "right") {
  // Secure context check (HTTPS or localhost)
  if (!isSecureContext) {
    fallbackCopyToClipboard(text, event);
    return;
  }

  navigator.clipboard
    .writeText(text)
    .then(() => {
      // 翻訳を使用
      const message = window.vanilla_i18n_instance.translate("showNotification.copy");
      showNotification(message, event); // 通知を表示
    })
    .catch((err) => {
      console.error("Failed to copy to clipboard", err);
      fallbackCopyToClipboard(text, event);
    });
}

// Fallback copy method for non-secure contexts
function fallbackCopyToClipboard(text, event) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);

  try {
    textarea.select();
    document.execCommand("copy");
    const message = window.vanilla_i18n_instance.translate("showNotification.copy");
    showNotification(message, event);
  } catch (err) {
    console.error("Fallback copy failed:", err);
  } finally {
    document.body.removeChild(textarea);
  }
}

// クリップボードから読み取り
async function readFromClipboard() {
  try {
    return await navigator.clipboard.readText();
  } catch (error) {
    console.error("Failed to read from clipboard:", error);
    return null;
  }
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

// Web Share API（OGP画像生成付き）
async function shareViaWebAPIEvent(event) {
  // イベント伝播を防止
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  try {
    // OGP画像を生成してR2にアップロード
    const imgId = await generateAndUploadOgpImage();
    const queryParams = generateQueryStringFromValues(imgId);
    shareViaWebAPI(queryParams, event);
  } catch (error) {
    console.error("Failed to generate OGP image:", error);
    console.error("Error stack:", error.stack);
    alert(`エラーが発生しました: ${error.message}\n\nコンソールで詳細を確認してください。`);
    // フォールバック: img_idなしで共有
    const queryParams = generateQueryStringFromValues(null);
    shareViaWebAPI(queryParams, event);
  }
}

// サイトを共有 (Web Share API)
function shareSiteViaWebAPIEvent(event) {
  const siteText = window.vanilla_i18n_instance.translate("shareSite.text");
  const siteUrl = "https://osats.money/";

  if (!isSecureContext || !navigator.share) {
    fallbackShareSiteViaClipboard(siteText, siteUrl, event);
    return;
  }

  navigator.share({ title: siteText, url: siteUrl })
    .catch((error) => {
      console.log("Sharing failed", error);
      fallbackShareSiteViaClipboard(siteText, siteUrl, event);
    });
}

// Fallback: copy site info to clipboard
function fallbackShareSiteViaClipboard(siteText, siteUrl, event) {
  const textToCopy = `${siteText}\n${siteUrl}`;
  const textarea = document.createElement("textarea");
  textarea.value = textToCopy;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);

  try {
    textarea.select();
    document.execCommand("copy");
    const message = window.vanilla_i18n_instance.translate("showNotification.copy");
    showNotification(message, event, "left");
  } catch (err) {
    console.error("Fallback share failed:", err);
  } finally {
    document.body.removeChild(textarea);
  }
}

// サイトURLをクリップボードにコピー（名称＋URLの2行）
function copySiteToClipboardEvent(event) {
  const siteText = window.vanilla_i18n_instance.translate("shareSite.text");
  const siteUrl = "https://osats.money/";
  const textToCopy = `${siteText}\n${siteUrl}`;
  copyToClipboard(textToCopy, event, "right");
}

function shareViaWebAPI(queryParams, event) {
  const shareUrl = `https://osats.money/${queryParams}`;

  if (!isSecureContext || !navigator.share) {
    fallbackShareViaClipboard(shareUrl, event);
    return;
  }

  navigator.share({
    url: shareUrl,
  })
    .catch((error) => {
      console.error("Sharing failed", error);
      fallbackShareViaClipboard(shareUrl, event);
    });
}

// Fallback: copy URL to clipboard when Web Share API unavailable
function fallbackShareViaClipboard(url, event) {
  const textarea = document.createElement("textarea");
  textarea.value = url;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);

  try {
    textarea.select();
    document.execCommand("copy");
    const message = window.vanilla_i18n_instance.translate("showNotification.copy");
    showNotification(message, event, "left");
  } catch (err) {
    console.error("Fallback share failed:", err);
  } finally {
    document.body.removeChild(textarea);
  }
}

// =====================================================
// OGP画像生成（Canvas）
// =====================================================

const OGP_WIDTH = 1200;
const OGP_HEIGHT = 630;
const OGP_FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const OGP_MAX_OUTPUT_CURRENCIES = 4;
const JST_OFFSET = 9 * 60 * 60 * 1000;

const OGP_FONT_CONFIGS = {
  1: { fontSize: 95, startY: 370, lineSpacing: 0 },
  2: { fontSize: 90, startY: 320, lineSpacing: 130 },
  3: { fontSize: 85, startY: 265, lineSpacing: 115 },
  4: { fontSize: 70, startY: 235, lineSpacing: 95 }
};

/**
 * 通貨コードをフォーマット
 */
function formatCurrencyCodeForOgp(code) {
  return code === 'sats' ? 'sats' : code.toUpperCase();
}

/**
 * タイムスタンプをJSTフォーマット
 */
function formatTimestampForOgp(timestamp) {
  const date = new Date(timestamp);
  const jstDate = new Date(date.getTime() + JST_OFFSET);

  const year = jstDate.getUTCFullYear();
  const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstDate.getUTCDate()).padStart(2, '0');
  const hour = String(jstDate.getUTCHours()).padStart(2, '0');
  const minute = String(jstDate.getUTCMinutes()).padStart(2, '0');

  return `${year}/${month}/${day} ${hour}:${minute}`;
}

/**
 * OGP画像用のCanvasを生成
 */
function generateOgpCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = OGP_WIDTH;
  canvas.height = OGP_HEIGHT;
  const ctx = canvas.getContext('2d');

  // 背景
  ctx.fillStyle = '#F5F7F6';
  ctx.fillRect(0, 0, OGP_WIDTH, OGP_HEIGHT);

  // 基準通貨の取得
  const baseKey = lastUpdatedField;
  const baseDisplayValue = document.getElementById(baseKey)?.value || '0';
  const baseNormalized = parseInput(baseDisplayValue, selectedLocale);

  // メインタイトル（入力値 通貨コード =）
  const mainTitle = `${formatNumberForOgp(baseNormalized)} ${formatCurrencyCodeForOgp(baseKey)} =`;
  ctx.font = `bold 100px ${OGP_FONT_FAMILY}`;
  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'center';
  ctx.fillText(mainTitle, OGP_WIDTH / 2, 130);

  // 区切り線
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(100, 150);
  ctx.lineTo(1100, 150);
  ctx.stroke();

  // 出力通貨の行を生成
  const outputCurrencies = selectedCurrencies.filter(key => key !== baseKey).slice(0, OGP_MAX_OUTPUT_CURRENCIES);
  const outputData = outputCurrencies.map(key => {
    const displayValue = document.getElementById(key)?.value || '0';
    const normalized = parseInput(displayValue, selectedLocale);
    return {
      value: formatNumberForOgp(normalized),
      code: formatCurrencyCodeForOgp(key)
    };
  });

  // フォント設定を取得
  const config = OGP_FONT_CONFIGS[Math.min(outputData.length, OGP_MAX_OUTPUT_CURRENCIES)] || OGP_FONT_CONFIGS[4];

  // 出力行を描画（数値と通貨記号を分けて整列）
  ctx.font = `${config.fontSize}px ${OGP_FONT_FAMILY}`;
  ctx.fillStyle = '#333';
  // 全体を右に寄せるオフセット（px）
  const OUTPUT_SHIFT = 120;
  const centerX = OGP_WIDTH / 2 + OUTPUT_SHIFT;
  const numberX = centerX - 10; // 数値の右端位置
  const codeX = centerX + 10;   // 通貨記号の左端位置

  outputData.forEach((data, i) => {
    const y = config.startY + (i * config.lineSpacing);
    // 数値を右揃えで描画
    ctx.textAlign = 'right';
    ctx.fillText(data.value, numberX, y);
    // 通貨記号を左揃えで描画
    ctx.textAlign = 'left';
    ctx.fillText(data.code, codeX, y);
  });

  // フッター: 日付を中央に表示
  const dateText = formatTimestampForOgp(Date.now());
  ctx.textAlign = 'center';
  ctx.fillStyle = '#666';
  ctx.font = `50px ${OGP_FONT_FAMILY}`;
  ctx.fillText(dateText, OGP_WIDTH / 2, OGP_HEIGHT - 20);

  // Source credit (Right Bottom)
  ctx.textAlign = 'right';
  ctx.font = `34px ${OGP_FONT_FAMILY}`;
  ctx.fillText('Source: CoinGecko', OGP_WIDTH - 20, OGP_HEIGHT - 20);

  return canvas;
}

/**
 * 数値をOGP用にフォーマット（桁区切りあり、最大8桁）
 */
function formatNumberForOgp(valueStr) {
  const num = parseFloat(valueStr);
  if (isNaN(num)) return valueStr;

  const parts = valueStr.split('.');
  const fracLength = parts[1] ? Math.min(parts[1].length, 8) : 0;

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fracLength,
    useGrouping: true
  }).format(num);
}

/**
 * OGP画像を生成してR2にアップロード
 * @returns {Promise<string|null>} img_id または null
 */
async function generateAndUploadOgpImage() {
  try {
    // Canvas生成
    const canvas = generateOgpCanvas();
    const isLocalHost = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
    // Prefer production endpoint first for reliability, then fall back to local dev endpoints when running locally.
    const apiCandidates = isLocalHost
      ? [
        'https://osats.money/api/save-ogp', // prefer production
        `${window.location.protocol}//127.0.0.1:8787/api/save-ogp`,
        `${window.location.protocol}//localhost:8787/api/save-ogp`,
      ]
      : [`${window.location.origin}/api/save-ogp`];

    console.log('OGP upload candidates:', apiCandidates);

    // Generate a binary Blob and send as multipart/form-data (FormData)
    const blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
    if (!blob) {
      throw new Error('Failed to create OGP blob');
    }

    // upload helper with timeout using AbortController. Always sends FormData(blob).
    const tryUpload = async (apiUrl, timeoutMs = 5000) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const form = new FormData();
        form.append('file', blob, 'ogp.png');
        const resp = await fetch(apiUrl, {
          method: 'POST',
          body: form,
          signal: controller.signal,
        });

        clearTimeout(timeout);
        console.log('Upload response status:', resp.status, 'from', apiUrl);
        return resp;
      } catch (err) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
          console.error('Upload timed out for', apiUrl);
        } else {
          console.error('Upload fetch error for', apiUrl, err);
        }
        return null;
      }
    };

    let response = null;
    let successfulUrl = null;
    for (const apiUrl of apiCandidates) {
      response = await tryUpload(apiUrl);
      if (response && response.ok) {
        successfulUrl = apiUrl;
        break;
      }
      console.warn('Upload failed or not ok, trying next candidate:', apiUrl);
    }

    if (successfulUrl) {
      console.log('OGP uploaded successfully to:', successfulUrl);
    }

    if (!response || !response.ok) {
      const errorText = response ? await response.clone().text().catch(() => '') : '';
      console.error('Upload error response:', errorText);
      throw new Error(`Upload failed: ${response ? response.status : 'no-response'} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Upload successful, img_id:', result.img_id);
    return result.img_id || null;
  } catch (error) {
    console.error('Failed to generate and upload OGP image:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    alert(`共有用画像のアップロードに失敗しました。`);
    return null;
  }
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

// サービスワーカー
let newVersionAvailable = false;

// サービスワーカーからのメッセージリスナー（セキュアコンテキストのみ）
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", async (event) => {
    const updateButton = document.getElementById("checkForUpdateBtn");
    const buttonText = updateButton.querySelector("#buttonText");
    const spinnerWrapper = buttonText.querySelector(".spinner-wrapper");

    console.log("Message from Service Worker:", event.data);

    if (event.data && event.data.type === "NEW_VERSION_INSTALLED") {
      newVersionAvailable = true;
      if (buttonText) {
        buttonText.textContent = window.vanilla_i18n_instance.translate("updateUI.textContent");
      }
      if (spinnerWrapper) {
        spinnerWrapper.style.display = "none";
      }
    } else if (event.data && event.data.type === "NO_UPDATE_FOUND") {
      // 一定時間待機してからメッセージを確認
      await delay(300);

      if (!newVersionAvailable) {
        const message = window.vanilla_i18n_instance.translate("showNotification.up");
        showNotification(message, lastClickEvent);
        if (spinnerWrapper) {
          spinnerWrapper.style.display = "none";
        }
      }
    }
  });
}

async function registerAndHandleServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service Worker is not supported in this browser.");
    return;
  }

  // Non-secure contexts (HTTP + private IP) cannot register Service Workers
  if (!isSecureContext) {
    console.warn(
      "Service Worker registration skipped: Not in secure context (HTTP + private IP). " +
      "App works in offline-limited mode. For full PWA features, use HTTPS or localhost."
    );
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("./sw.js");

    registration.addEventListener("updatefound", () => {
      const installingWorker = registration.installing;

      installingWorker.addEventListener("statechange", async () => {
        if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
          newVersionAvailable = true;
          const updateUI = document.getElementById("buttonText");
          if (updateUI) {
            console.log("Updating UI from Service Worker installation");

            // 翻訳テキストを取得
            let translatedText = "";
            if (window.vanilla_i18n_instance && window.vanilla_i18n_instance._translationData) {
              translatedText = window.vanilla_i18n_instance.translate("updateUI.textContent");
            } else {
              // 翻訳データがまだロードされていない場合
              await window.vanilla_i18n_instance.run();
              translatedText = window.vanilla_i18n_instance.translate("updateUI.textContent");
            }

            // テキストを更新
            updateUI.textContent = translatedText || "更新があります"; // デフォルトのテキストを設定
          }
        }
      });
    });
  } catch (error) {
    console.error("Service Worker registration failed:", error);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// サイト更新ボタン
async function checkForUpdates(event) {
  lastClickEvent = event; // クリックイベントを保存
  const updateButton = document.getElementById("checkForUpdateBtn");
  const buttonText = updateButton.querySelector("#buttonText");
  const spinnerWrapper = buttonText.querySelector(".spinner-wrapper");

  if (spinnerWrapper) {
    spinnerWrapper.style.display = "block";
  }

  // 新しいバージョンが利用可能な場合、ページをリロード
  if (newVersionAvailable) {
    window.location.reload();
    return; // 以降の処理を実行させない
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) throw new Error("No active service worker registration found");

    // サービスワーカーの状態を確認
    if (registration.installing || registration.waiting) {
      // サービスワーカーがインストール中または待機中であれば、更新状態をチェック
      navigator.serviceWorker.controller.postMessage("CHECK_UPDATE_STATUS");
    } else {
      // それ以外の場合は、更新を試みる
      await registration.update();
      // 更新状態をチェック
      navigator.serviceWorker.controller.postMessage("CHECK_UPDATE_STATUS");
    }
  } catch (error) {
    console.error("An error occurred while checking for updates:", error);
    if (spinnerWrapper) {
      spinnerWrapper.style.display = "none";
    }
  }
}

//Service Workerからサイトのバージョン情報を取得
async function fetchVersionFromSW() {
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        if (event.data.error) {
          reject(event.data.error);
        } else {
          resolve(event.data.version);
        }
      };

      registration.active.postMessage({ action: "getVersion" }, [messageChannel.port2]);
    });
  }
  return null;
}

//サイトのバージョン情報を画面に表示
async function displaySiteVersion() {
  const siteVersion = await fetchVersionFromSW();
  if (siteVersion) {
    document.getElementById("siteVersion").textContent = siteVersion;
  }
}

import { Pos } from "./assets/js/pos.js";

const pos = new Pos();
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

// index.htmlで使用する関数をグローバルスコープで使用できるようにwindowに追加する
window.satsRate = {
  calculateValues,
};
