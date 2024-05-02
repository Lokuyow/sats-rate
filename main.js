import { CurrencyManager } from './lib/currencyManager.js';
const currencyManager = new CurrencyManager();
const BASE_URL = "https://lokuyow.github.io/sats-rate/";
const dateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
};
let lastUpdatedField;
let lastUpdatedTimestamp = null;
let selectedLocale = navigator.language || navigator.languages[0];
let lastClickEvent = null;
let currencyRates = {};
let selectedCurrencies = [];
let currencyInputFields = [];
export let baseCurrencyValue = {};
let customOptions = {
    sats: { maximumFractionDigits: 0, minimumFractionDigits: 0 },
    btc: { maximumFractionDigits: 8, minimumFractionDigits: 0 },
};

document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
    // CurrencyManagerのインスタンスを作成
    currencyManager.setCurrenciesUpdateCallback(updateGlobalSelectedCurrencies);
    currencyManager.setRatesUpdateCallback(updateGlobalCurrencyRates);

    // 通貨データをロードし、UIコンポーネントを初期化
    await currencyManager.loadCurrencies();

    // クエリパラメータから通貨設定と計算元の通貨とその値を読み込み
    const hasQueryParams = loadValuesFromQueryParams();

    // クエリパラメータがない場合、デフォルト値を設定
    if (!hasQueryParams) {
        setDefaultValues();
    }

    await currencyManager.fetchCurrencyData(selectedCurrencies);

    // UIを更新
    currencyManager.generateCurrencyCheckboxes();
    currencyManager.updateCheckboxStates(selectedCurrencies);
    currencyManager.updateCurrencyInputs(selectedCurrencies);

    // inputs変数を更新
    currencyInputFields = selectedCurrencies.map(id => document.getElementById(id));

    // 保存ボタンのイベントリスナーを設定
    const saveButton = document.getElementById('saveSelectedCurrencies');
    saveButton.addEventListener('click', () => currencyManager.saveSelectedCurrencies());

    // その他の初期化処理
    await registerAndHandleServiceWorker();
    await displaySiteVersion();
    setupEventListeners();
    checkAndUpdateElements();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 計算
    prepareAndCalculate(baseCurrencyValue);
}

function setupEventListeners() {
    setupInputFieldsEventListeners();
    setupEventListenersForCurrencyButtons();
    document.getElementById('share-via-webapi').addEventListener('click', shareViaWebAPIEvent);
    document.getElementById('update-prices').addEventListener('click', updateElementsBasedOnTimestamp);
    document.getElementById('saveDefaultValuesButton').addEventListener('click', (event) => {
        saveCurrentValuesAsDefault(event);
    });
    document.getElementById('checkForUpdateBtn').addEventListener('click', checkForUpdates);
    window.addEventListener('online', handleOnline);
}

function setupInputFieldEventListeners(element) {
    element.addEventListener('keyup', handleInputFormatting);
    element.addEventListener('focus', handleFocus);
    element.addEventListener('contextmenu', handleContextMenu);
    element.addEventListener('paste', handleInputFormatting);
    element.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
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

// 選択された通貨の更新をグローバル変数に反映するコールバック関数
function updateGlobalSelectedCurrencies(currencies) {
    selectedCurrencies = currencies;
    updateCurrencyInputFields(); // 通貨が更新されたらDOM要素も更新
}

function updateCurrencyInputFields() {
    currencyInputFields = selectedCurrencies.map(id => document.getElementById(id));
    setupInputFieldsEventListeners(); // 全ての入力フィールドにイベントリスナーを設定
}

function setupInputFieldsEventListeners() {
    currencyInputFields.forEach(element => {
        if (!element) return; // elementがnullでないことを保証
        setupInputFieldEventListeners(element);
    });
}

// baseCurrencyValue を設定する関数
export function setBaseCurrencyValue(value) {
    baseCurrencyValue = value;
}

// baseCurrencyValue を取得する関数
export function getBaseCurrencyValue() {
    return baseCurrencyValue;
}

async function handleOnline() {
    await currencyManager.fetchCurrencyData(selectedCurrencies);
    checkAndUpdateElements();
    alert('オンラインに復帰しました。最新データを取得します。');
}

//入力の初期値
export function setDefaultValues() {
    // ローカルストレージから値を読み込む
    selectedCurrencies = JSON.parse(localStorage.getItem('selectedCurrenciesLS')) || [];
    baseCurrencyValue = JSON.parse(localStorage.getItem('defaultValueLS')) || {};

    if (!selectedCurrencies.length && !Object.keys(baseCurrencyValue).length) {
        // selectedCurrencies と baseCurrencyValue が両方空の場合
        selectedCurrencies = ['sats', 'btc', 'jpy', 'usd', 'eur'];
        baseCurrencyValue = { sats: 100 };  // sats にデフォルト値 100 を設定
    } else if (!selectedCurrencies.length) {
        // selectedCurrencies だけ空の場合
        selectedCurrencies = ['sats', 'btc', 'jpy', 'usd', 'eur'];
        if (Object.keys(baseCurrencyValue).length) {
            const baseCurrency = Object.keys(baseCurrencyValue)[0];
            selectedCurrencies.push(baseCurrency); // baseCurrencyValue の通貨を含む
        }
    } else if (!Object.keys(baseCurrencyValue).length) {
        // baseCurrencyValue だけ空の場合
        const firstCurrency = selectedCurrencies[0];
        baseCurrencyValue[firstCurrency] = 100;  // 最初の通貨に 100 を設定
    }

    // 次に、baseCurrencyValue の通貨が selectedCurrencies に含まれているかどうかを確認し、含まれていなければ設定
    const baseCurrencyKey = Object.keys(baseCurrencyValue)[0];
    if (baseCurrencyKey && !selectedCurrencies.includes(baseCurrencyKey)) {
        // baseCurrencyValue の通貨が selectedCurrencies にない場合
        const firstCurrency = selectedCurrencies[0];
        baseCurrencyValue = {}; // baseCurrencyValue をクリア
        baseCurrencyValue[firstCurrency] = 100;  // 最初の通貨に 100 を設定
    }
}

// 現在の入力値をデフォルト値としてローカルストレージに保存
function saveCurrentValuesAsDefault(event) {
    const currentValues = {};

    if (lastUpdatedField) {
        const rawValue = document.getElementById(lastUpdatedField).value;
        const sanitizedValue = parseInput(rawValue, selectedLocale);
        currentValues[lastUpdatedField] = sanitizedValue;
    }

    localStorage.setItem('defaultValueLS', JSON.stringify(currentValues));

    showNotification('設定完了', event);
}

function getInputValue(id) {
    return parseInput(document.getElementById(id).value, selectedLocale);
}

// 計算前に入力値をフォーマットしインプットフィールドに入れる
export function prepareAndCalculate(baseCurrencyValue) {
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
        console.error('Base currency is not valid or element does not exist.');
    }
}

// 計算
function calculateValues(inputField) {
    const satsInBtc = 1e8;

    const inputValues = selectedCurrencies.reduce((acc, currency) => {
        acc[currency] = parseFloat(getInputValue(currency)) || 0;
        return acc;
    }, {});

    if (inputField === 'sats') {
        inputValues['btc'] = inputValues['sats'] / satsInBtc;
    } else if (inputField === 'btc') {
        inputValues['sats'] = inputValues['btc'] * satsInBtc;
    } else {
        inputValues['btc'] = inputValues[inputField] / currencyRates[inputField];
        inputValues['sats'] = inputValues['btc'] * satsInBtc;
    }

    selectedCurrencies.forEach(currency => {
        if (currency !== 'btc' && currency !== 'sats') {
            inputValues[currency] = inputValues['btc'] * (currencyRates[currency] || 0);
        }
    });

    // 最後に更新されたフィールドを記録
    lastUpdatedField = inputField;

    // 有効桁数の計算
    const inputDigits = inputValues[inputField].toString().replace('.', '').length;
    const significantDigits = calculateSignificantDigits(inputDigits);

    // 入力フィールドの更新
    selectedCurrencies.forEach(currency => {
        const element = document.getElementById(currency);

        if (element) {
            // 直接入力ボックス
            if (currency === inputField) {
                // カーソル位置の維持
                const caretPos = element.selectionStart;
                element.setSelectionRange(caretPos, caretPos);
                // 計算されるボックス
            } else {
                // 値のフォーマットと更新
                // formatCurrencyをsignificantDigitsを使って動的にフォーマットするように修正
                element.value = formatCurrency(inputValues[currency], currency, selectedLocale, true, significantDigits);
            }
        }
    });

    changeBackgroundColorFromId(inputField);
    updateShareButton();
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

//　ロケールから桁区切りと小数点の文字を取得
function getLocaleSeparators(locale) {
    const formattedNumber = new Intl.NumberFormat(locale).format(1000.1);
    return {
        groupSeparator: formattedNumber[1], // 桁区切り文字
        decimalSeparator: formattedNumber[5] // 小数点の区切り文字
    };
}

//ピリオドを小数点とし、桁区切り文字を使わないよう変換
function parseInput(inputValue, locale) {
    const separators = getLocaleSeparators(locale);

    // 数字、小数点、桁区切り文字以外の文字を削除
    const onlyNumbersAndSeparators = inputValue.replace(/[^0-9\.,]/g, '');

    const sanitizedValue = onlyNumbersAndSeparators
        .replace(new RegExp(`\\${separators.groupSeparator}`, 'g'), '')
        .replace(separators.decimalSeparator, '.');

    return sanitizedValue;
}

function addCommasToInput(inputElement) {
    const originalCaretPos = inputElement.selectionStart;
    const originalSelectionEnd = inputElement.selectionEnd;
    const separators = getLocaleSeparators(selectedLocale);
    const originalValue = parseInput(inputElement.value, selectedLocale);

    if (originalValue === '') {
        inputElement.value = '0';
        inputElement.selectionStart = 1;
        inputElement.selectionEnd = 1;
        return;
    }

    let preSeparatorCount = (inputElement.value.slice(0, originalCaretPos).match(new RegExp(`\\${separators.groupSeparator}`, 'g')) || []).length;

    let formattedValue;
    if (originalValue.endsWith('.') || (originalValue.includes('.') && originalCaretPos > originalValue.indexOf('.'))) {
        const parts = originalValue.split('.');
        const integerPart = parts[0];
        formattedValue = new Intl.NumberFormat(selectedLocale).format(parseFloat(integerPart));

        if (parts[1] !== undefined) {
            formattedValue += separators.decimalSeparator + parts[1];
        } else if (originalValue.endsWith('.')) {
            formattedValue += separators.decimalSeparator;
        }
    } else {
        const currencyId = inputElement.id;
        formattedValue = formatCurrency(originalValue, currencyId, selectedLocale, false);
    }

    let postSeparatorCount = (formattedValue.slice(0, originalCaretPos).match(new RegExp(`\\${separators.groupSeparator}`, 'g')) || []).length;
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
            minimumFractionDigits: 0
        };
    }
}

// 小数点以下の制限、ロケールごとの記法
function formatCurrency(num, id, selectedLocale, shouldRound = true, significantDigits) {
    // numが数値でない場合、数値に変換
    if (typeof num !== 'number') {
        num = parseFloat(num);
        if (isNaN(num)) {
            console.error("Invalid type for num:", num);
            return;
        }
    }

    // significantDigitsが指定されている場合、指定の桁数で数値を丸める
    let roundedNum = shouldRound ? Number(num.toPrecision(significantDigits)) : num;

    // 通貨ごとのフォーマットオプションを取得
    const formatOptions = customOptions[id];
    const maximumFractionDigits = formatOptions.maximumFractionDigits;
    const numFractionDigits = (roundedNum.toString().split('.')[1] || '').length;

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
        dynamicSignificantDigits += (inputDigits - 1);
    }
    return Math.min(dynamicSignificantDigits, 10);
}

// データ取得日時のunixtimeの変換と表示
function updateLastUpdated(timestamp) {
    const updatedAt = new Date(timestamp * 1000);
    const userLocale = navigator.language || navigator.userLanguage;
    const formatter = new Intl.DateTimeFormat(userLocale, dateTimeFormatOptions);
    const formattedDate = formatter.format(updatedAt);

    document.getElementById('last-updated').textContent = formattedDate;
    lastUpdatedTimestamp = timestamp;

    return formattedDate;
}

// ページ読み込みもしくは表示状態が変わった際の要素更新処理
export function checkAndUpdateElements() {
    const diffTime = Math.floor(Date.now() / 1000) - lastUpdatedTimestamp;
    const updatePricesElement = document.getElementById('update-prices');
    const lastUpdatedElement = document.getElementById('last-updated');

    updateElementClass(updatePricesElement, diffTime >= 610);
    updateElementClass(lastUpdatedElement, diffTime >= 610);
}

function handleVisibilityChange() {
    if (document.hidden) return;

    checkAndUpdateElements();
}

// レート更新ボタンを押したとき
async function updateElementsBasedOnTimestamp() {
    const diffTime = Math.floor(Date.now() / 1000) - lastUpdatedTimestamp;

    const updatePricesElement = document.getElementById('update-prices');
    const lastUpdatedElement = document.getElementById('last-updated');

    if (diffTime >= 610) {
        // すぐにアニメーションを開始
        let svg = updatePricesElement.querySelector('svg');
        if (svg && !svg.classList.contains('rotated')) {
            svg.classList.add('rotated');
        }

        // アニメーション開始時刻を記録
        const animationStartTime = Date.now();

        // データを取得し計算
        await currencyManager.fetchCurrencyData(selectedCurrencies);
        const updatedDiffTime = Math.floor(Date.now() / 1000) - lastUpdatedTimestamp;
        if (lastUpdatedField) {
            calculateValues(lastUpdatedField);
        }

        // 最低アニメーション持続時間を保証
        const animationDuration = Date.now() - animationStartTime;
        if (animationDuration < 800) {
            await new Promise(resolve => setTimeout(resolve, 800 - animationDuration));
        }

        // アニメーションを終了
        if (svg) {
            svg.classList.remove('rotated');
        }

        // 要素のクラスを更新
        updateElementClass(updatePricesElement, updatedDiffTime >= 610);
        updateElementClass(lastUpdatedElement, updatedDiffTime >= 610);
    }
}

// レート更新ボタンと取得日時表示の見た目
function updateElementClass(element, isOutdated) {
    if (isOutdated) {
        element.classList.add('outdated');
        element.classList.remove('recent');
    } else {
        element.classList.remove('outdated');
        element.classList.add('recent');
    }
    element.style.visibility = 'visible';
}

// 選択
function handleFocus(event) {
    event.target.select();
}

function handleContextMenu(event) {
    if (isMobileDevice() && event.target.tagName.toLowerCase() === 'input') {
        event.preventDefault();
    }
}

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

//計算元の入力ボックスの色を変更
function changeBackgroundColorFromId(id) {
    currencyInputFields.forEach(input => input.classList.remove('last-input-field'));

    const targetInput = document.getElementById(id);
    targetInput.classList.add('last-input-field');
}

// ポップアップ表示
function showNotification(message, event, align = 'right') {
    const notification = document.getElementById('notification');
    notification.textContent = message;

    notification.style.left = event.pageX + 'px';
    notification.style.top = (event.pageY + 20) + 'px';

    if (align === 'left') {
        notification.style.transform = 'translateX(0)';
    } else {
        notification.style.transform = 'translateX(-100%)';
    }

    notification.style.visibility = 'visible';

    setTimeout(() => {
        notification.style.visibility = 'hidden';
    }, 1000);
}

// URLクエリパラメータ
function loadValuesFromQueryParams() {
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.toString()) {
        return false;  // クエリパラメータが存在しない場合は false を返す
    }

    selectedCurrencies = urlParams.get('currencies') ? urlParams.get('currencies').split(',') : [];
    baseCurrencyValue = {};
    const decimalFormat = urlParams.get('d') || 'p';
    const locale = decimalFormat === 'c' ? 'de-DE' : 'en-US';

    urlParams.forEach((value, key) => {
        if (key !== 'd' && key !== 'currencies') {
            baseCurrencyValue[key] = parseInput(value, locale);
        }
    });

    // 処理後のURLからクエリパラメータを削除
    const currentUrl = new URL(window.location.href);
    const newUrl = `${currentUrl.origin}${currentUrl.pathname}`;
    window.history.replaceState(null, '', newUrl);

    return true;  // クエリパラメータが存在した場合は true を返す
}

function getQueryString(field, value) {
    const separators = getLocaleSeparators(selectedLocale);
    const formattedValue = value.replace('.', separators.decimalSeparator); // 小数点をロケールに合わせて置換
    const decimalFormat = separators.decimalSeparator === '.' ? 'p' : 'c'; // 小数点のフォーマットを設定

    const currencies = selectedCurrencies.join(','); // すべての選択された通貨をカンマ区切りでリスト化

    // フォーマットされた値、通貨リスト、小数点フォーマット情報を含むクエリ文字列を生成
    return `?${field}=${formattedValue}&currencies=${currencies}&d=${decimalFormat}`;
}

function generateQueryStringFromValues(values) {
    if (!lastUpdatedField || !selectedCurrencies.length) return '';
    return getQueryString(lastUpdatedField, values[lastUpdatedField]);
}

// インプットフィールドから桁区切りを取り除いた数値を取得
function getValuesFromElements() {
    const values = {};
    const inputFields = selectedCurrencies;

    inputFields.forEach(field => {
        const rawValue = document.getElementById(field).value;
        values[field] = parseInput(rawValue, selectedLocale);
    });
    return values;
}

// 共有テキスト生成
function generateCopyText(values) {
    const baseCurrencyKey = lastUpdatedField;  // 基本通貨キーをlastUpdatedFieldから取得
    const baseCurrencyText = `${getCurrencyText(baseCurrencyKey, values[baseCurrencyKey])} =`; // 基本通貨のテキストを生成し、最後に " =" を追加

    // baseCurrency以外の通貨キーを取得
    const otherCurrencyKeys = selectedCurrencies.filter(key => key !== baseCurrencyKey);
    // それぞれの通貨についてテキストを生成し、改行で結合
    const otherCurrencyTexts = otherCurrencyKeys.map(key => getCurrencyText(key, values[key])).join('\n');

    const lastUpdatedText = updateLastUpdated(lastUpdatedTimestamp); // 最終更新日時のテキストを生成

    // すべてのテキストを結合して返す
    return [
        baseCurrencyText,
        otherCurrencyTexts,
        '',
        lastUpdatedText,
        'Powered by CoinGecko,'
    ].join('\n');
}

// コピー用テキストの作成
function getCurrencyText(key, value) {
    const symbol = currencyManager.currencySymbols[key] || ''; // 通貨記号を取得
    const formattedValue = formatCurrency(value, key, selectedLocale, false); // 通貨の値をフォーマット
    // 通貨コードが "sats" の場合は大文字に変換しない
    const currencyCode = key === "sats" ? "sats" : key.toUpperCase();
    return `${symbol} ${formattedValue} ${currencyCode}`; // 通貨記号、フォーマットされた値、適切にフォーマットされた通貨コードを含むテキストを生成
}

// 共有ボタン
function updateShareButton() {
    const values = getValuesFromElements();

    const shareText = generateCopyText(values);
    const queryParams = generateQueryStringFromValues(values);

    const links = generateShareLinks(queryParams, shareText);

    document.getElementById('share-twitter').href = links.twitter;
    document.getElementById('share-nostter').href = links.nostter;
    document.getElementById('share-mass-driver').href = links.massDriver;
}

function generateShareLinks(queryParams, shareText) {
    const shareUrl = `${BASE_URL}${queryParams}`;
    return {
        twitter: `https://twitter.com/share?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
        nostter: `https://nostter.app/post?content=${encodeURIComponent(shareText)}%20${encodeURIComponent(shareUrl)}`,
        massDriver: `https://mdrv.shino3.net/?intent=${encodeURIComponent(shareText)}%20${encodeURIComponent(shareUrl)}`
    };
}

export function setupEventListenersForCurrencyButtons() {
    selectedCurrencies.forEach(currency => {
        // コピーイベントリスナーの設定
        const copyButton = document.getElementById('copy-' + currency);
        if (copyButton) { // ボタンが存在するか確認
            copyButton.addEventListener('click', function (event) {
                copySingleCurrencyToClipboardEvent(event);
            });
        }

        // ペーストイベントリスナーの設定
        const pasteButton = document.getElementById('paste-' + currency);
        if (pasteButton) { // ボタンが存在するか確認
            pasteButton.addEventListener('click', function () {
                pasteFromClipboardToInput(currency);
            });
        }
    });

    // すべての通貨をコピーするためのイベントリスナーの設定
    const copyToClipboardButton = document.getElementById('copy-to-clipboard');
    if (copyToClipboardButton) { // ボタンが存在するか確認
        copyToClipboardButton.addEventListener('click', copyToClipboardEvent);
    }
}

// クリップボードにコピー　各通貨
function copySingleCurrencyToClipboardEvent(event) {
    const currency = event.target.dataset.currency;
    const inputValue = document.getElementById(currency).value;
    const separators = getLocaleSeparators(selectedLocale);
    const sanitizedValue = inputValue.replace(new RegExp(`\\${separators.groupSeparator}`, 'g'), ''); // 桁区切りを削除
    copyToClipboard(sanitizedValue, event, 'left');
}

// クリップボードにコピー　全体
function copyToClipboardEvent(event) {
    const values = getValuesFromElements();
    const baseText = generateCopyText(values);
    const queryParams = generateQueryStringFromValues(values);
    const textToCopy = `${baseText} ${BASE_URL}${queryParams}`;
    copyToClipboard(textToCopy, event, 'right');
}

// コピー
function copyToClipboard(text, event, align = 'right') {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('クリップボードにコピーしました', event, align);  // 通知を表示
    }).catch(err => {
        console.error('クリップボードへのコピーに失敗しました', err);
    });
}

// クリップボードから読み取り
async function readFromClipboard() {
    try {
        return await navigator.clipboard.readText();
    } catch (error) {
        console.error("クリップボードからの読み取りに失敗しました:", error);
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

// Web Share API
function shareViaWebAPIEvent() {
    const values = getValuesFromElements();
    const shareText = generateCopyText(values);
    const queryParams = generateQueryStringFromValues(values);
    shareViaWebAPI(shareText, queryParams);
}

function shareViaWebAPI(originalShareText, queryParams) {
    const modifiedShareText = originalShareText.replace(/https:\/\/lokuyow\.github\.io\/sats-rate\/.*$/, '');

    if (navigator.share) {
        navigator.share({
            title: 'おいくらサッツ',
            text: modifiedShareText,
            url: `https://lokuyow.github.io/sats-rate/${queryParams}`
        });
    } else {
        alert('お使いのブラウザはWeb共有APIをサポートしていません。別のブラウザを試してください。');
    }
}


// サービスワーカー
let newVersionAvailable = false;

// サービスワーカーからのメッセージリスナー
navigator.serviceWorker.addEventListener('message', (event) => {
    const updateButton = document.getElementById('checkForUpdateBtn');
    const buttonText = document.getElementById('buttonText');
    const spinnerWrapper = updateButton.querySelector('.spinner-wrapper');

    console.log('Message from Service Worker:', event.data);

    if (event.data && event.data.type === 'NEW_VERSION_INSTALLED') {
        newVersionAvailable = true;
        if (buttonText) {
            buttonText.textContent = '更新があります';
        }
        spinnerWrapper.style.display = 'none';
    } else if (event.data && event.data.type === 'NO_UPDATE_FOUND') {
        showNotification('最新です', lastClickEvent);
        spinnerWrapper.style.display = 'none';
    }
});


async function registerAndHandleServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        console.warn("Service Worker is not supported in this browser.");
        return;
    }

    try {
        const registration = await navigator.serviceWorker.register('./sw.js');

        registration.addEventListener('updatefound', () => {
            const installingWorker = registration.installing;

            installingWorker.addEventListener('statechange', async () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    newVersionAvailable = true;
                    const updateUI = document.getElementById('buttonText');
                    if (updateUI) {
                        console.log("Updating UI from Service Worker installation");
                        updateUI.textContent = '更新があります';
                    }
                }
            });
        });
    } catch (error) {
        console.error("Service Worker registration failed:", error);
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// サイト更新ボタン
async function checkForUpdates(event) {
    lastClickEvent = event; // クリックイベントを保存
    const updateButton = document.getElementById('checkForUpdateBtn');
    const spinnerWrapper = updateButton.querySelector('.spinner-wrapper');
    spinnerWrapper.style.display = 'block'; // スピナーを表示

    // 新しいバージョンが利用可能な場合、ページをリロード
    if (newVersionAvailable) {
        window.location.reload();
        return; // 以降の処理を実行させない
    }

    try {
        await delay(300);

        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) throw new Error("No active service worker registration found");

        // サービスワーカーの状態を確認
        if (registration.installing || registration.waiting) {
            // サービスワーカーがインストール中または待機中であれば、更新状態をチェック
            navigator.serviceWorker.controller.postMessage('CHECK_UPDATE_STATUS');
        } else {
            // それ以外の場合は、更新を試みる
            await registration.update();
            // 更新状態をチェック
            navigator.serviceWorker.controller.postMessage('CHECK_UPDATE_STATUS');
        }
    } catch (error) {
        console.error("An error occurred while checking for updates:", error);
        spinnerWrapper.style.display = 'none';
    }
}

//Service Workerからサイトのバージョン情報を取得
async function fetchVersionFromSW() {
    if ('serviceWorker' in navigator) {
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

            registration.active.postMessage({ action: 'getVersion' }, [messageChannel.port2]);
        });
    }
    return null;
}

//サイトのバージョン情報を画面に表示
async function displaySiteVersion() {
    const siteVersion = await fetchVersionFromSW();
    if (siteVersion) {
        document.getElementById('siteVersion').textContent = siteVersion;
    }
}


import { Pos } from './lib/pos.js';

const pos = new Pos();
pos.initialize();

/**
 * ライトニングアドレスのダイアログの制御
 */
const showAddressButton = document.getElementById('show-lightning-address-dialog');
const lnDialog = document.getElementById('update-lightning-address-dialog');
const lnDialogSubmitButton = document.getElementById('lightning-address-submit-button');
const lnDialogCloseButton = document.getElementById('lightning-address-close-button');
const lnDialogClearButton = document.getElementById('lightning-address-clear-button');
const lnAddressForm = document.getElementById('lightning-address-form');

// ダイアログを開く
showAddressButton.addEventListener('click', () => {
    lnDialog.showModal();
});

// ダイアログを閉じる
lnDialogCloseButton.addEventListener('click', (event) => {
    event.preventDefault(); // フォームを送信しない
    lnDialog.close();
});

// フォームをクリア
lnDialogClearButton.addEventListener('click', (event) => {
    event.preventDefault(); // フォームを送信しない
    pos.clearLnAddress();
});

// アドレスを設定する
lnDialogSubmitButton.addEventListener('click', (event) => {
    const isValid = lnAddressForm.checkValidity()
    if (!isValid) {
        return;
    }

    pos.setLnAddress(lnAddressForm)
    event.preventDefault(); // フォームを送信しない
    lnDialog.close();
});

/**
 * 支払いインボイスのQRコードダイアログの制御
 */
const showInvoiceButton = document.getElementById('show-invoice-dialog');
const invoiceDialog = document.getElementById('lightning-invoice-dialog');
const invoiceDialogCloseButton = document.getElementById('lightning-invoice-close-button');

// ダイアログを開く
showInvoiceButton.addEventListener('click', () => {
    invoiceDialog.showModal();
    pos.showInvoice();
});

// ダイアログを閉じる
invoiceDialogCloseButton.addEventListener('click', (event) => {
    event.preventDefault(); // フォームを送信しない
    invoiceDialog.close();
    pos.clearMessage();
});


// index.htmlで使用する関数をグローバルスコープで使用できるようにwindowに追加する
window.satsRate = {
    calculateValues,
}