const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=jpy%2Cusd%2Ceur&include_last_updated_at=true&precision=5";
const BASE_URL = "https://lokuyow.github.io/sats-rate/";
const satsInBtc = 1e8;
const inputFields = ['sats', 'btc', 'jpy', 'usd', 'eur'];
const dateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
};
const currencyFormatOptionsSets = {
    default: {
        sats: { maximumFractionDigits: 0, minimumFractionDigits: 0 },
        btc: { maximumFractionDigits: 8, minimumFractionDigits: 0 },
        jpy: { maximumFractionDigits: 5, minimumFractionDigits: 0 },
        usd: { maximumFractionDigits: 5, minimumFractionDigits: 0 },
        eur: { maximumFractionDigits: 5, minimumFractionDigits: 0 }
    },
    alt: {
        sats: { maximumFractionDigits: 0, minimumFractionDigits: 0 },
        btc: { maximumFractionDigits: 8, minimumFractionDigits: 0 },
        jpy: { maximumFractionDigits: 2, minimumFractionDigits: 0 },
        usd: { maximumFractionDigits: 4, minimumFractionDigits: 0 },
        eur: { maximumFractionDigits: 4, minimumFractionDigits: 0 }
    }
};
let activeField = null;
let currentFormatOptions = {};
let btcToJpy, btcToUsd, btcToEur, lastUpdatedField;
let lastUpdatedTimestamp = null;
let selectedLocale = navigator.language || navigator.languages[0];
const inputs = document.querySelectorAll('.currency-input');

document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
    await fetchDataFromCoinGecko();
    await registerAndHandleServiceWorker();
    await displaySiteVersion();
    currentFormatOptions = currencyFormatOptionsSets.default;
    setDefaultValues()
    loadValuesFromQueryParams();
    setupEventListeners();
    checkAndUpdateElements();
    document.addEventListener('visibilitychange', handleVisibilityChange);
}

async function fetchDataFromCoinGecko() {
    let data;

    try {
        const response = await fetch(COINGECKO_URL);
        data = await response.json();

        // 価格データをローカルストレージに保存
        localStorage.setItem("priceData", JSON.stringify(data));

    } catch (err) {
        console.warn("Failed to fetch data from CoinGecko. Trying to get data from localStorage...");

        // ローカルストレージから価格データを取得
        const storedData = localStorage.getItem("priceData");

        if (storedData) {
            data = JSON.parse(storedData);
        } else {
            handleCoinGeckoRequestError(err);
            return;
        }
    }

    if (data) {
        updateCurrencyRates(data);
        updateLastUpdated(data.bitcoin.last_updated_at);
        updateElementClass(getDomElementById('last-updated'), false);
        updateElementClass(getDomElementById('update-prices'), false);
    }
}

async function setupEventListeners() {
    inputFields.forEach(id => {
        const element = getDomElementById(id);
        setupInputFieldEventListeners(element);
    });

    setupEventListenersForCurrencyButtons()
    getDomElementById('share-via-webapi').addEventListener('click', shareViaWebAPIEvent);
    getDomElementById('update-prices').addEventListener('click', updateElementsBasedOnTimestamp);
    getDomElementById('saveDefaultValuesButton').addEventListener('click', (event) => {
        saveCurrentValuesAsDefault(event);
    });
    getDomElementById('checkForUpdateBtn').addEventListener('click', checkForUpdates);
    window.addEventListener('online', handleOnline);
}

function setupInputFieldEventListeners(element) {
    element.addEventListener('keyup', handleInputFormatting);
    element.addEventListener('focus', handleFocus);
    element.addEventListener('contextmenu', handleContextMenu);
    element.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            this.blur();
        }
    });
}

function getDomElementById(id) {
    return document.getElementById(id);
}

function handleOnline() {
    console.log('オンラインに復帰しました。最新データを取得します。');
    fetchDataFromCoinGecko();
}

function handleCoinGeckoRequestError(err) {
    console.error("Failed to fetch price data from CoinGecko:", err);
    alert("価格レートの取得に失敗しました。時間をおいてからリロードしてみてください。");
}

//デフォルト入力値
function setDefaultValues() {
    const storedDefaultValues = JSON.parse(localStorage.getItem('defaultValues')) || {};
    const lastFieldFromLocalStorage = Object.keys(storedDefaultValues)[0];

    if (lastFieldFromLocalStorage) {
        const field = getDomElementById(lastFieldFromLocalStorage);
        if (field) {
            const formattedValue = new Intl.NumberFormat(selectedLocale).format(storedDefaultValues[lastFieldFromLocalStorage]);
            field.value = formattedValue;
            calculateValues(lastFieldFromLocalStorage);
        }
    } else {
        const satsField = getDomElementById('sats');
        if (!satsField.value) {
            satsField.value = "100";
            calculateValues('sats');
        }
    }
}

//デフォルト入力値の保存
function saveCurrentValuesAsDefault(event) {
    const currentValues = {};

    if (lastUpdatedField) {
        const rawValue = getDomElementById(lastUpdatedField).value;
        const sanitizedValue = parseInput(rawValue, selectedLocale);
        currentValues[lastUpdatedField] = sanitizedValue;
    }

    localStorage.setItem('defaultValues', JSON.stringify(currentValues));

    showNotification('設定完了', event);
}

function updateCurrencyRates(data) {
    btcToJpy = data.bitcoin.jpy;
    btcToUsd = data.bitcoin.usd;
    btcToEur = data.bitcoin.eur;
}

function getInputValue(id) {
    return parseInput(getDomElementById(id).value, selectedLocale);
}

// 計算
function calculateValues(inputField) {
    const values = {
        btc: getInputValue('btc'),
        sats: getInputValue('sats'),
        jpy: getInputValue('jpy'),
        usd: getInputValue('usd'),
        eur: getInputValue('eur')
    };

    const inputDigits = values[inputField].toString().replace('.', '').length;
    const significantDigits = calculateSignificantDigits(inputDigits);

    switch (inputField) {
        case 'btc':
            values.sats = values.btc * satsInBtc;
            values.jpy = values.btc * btcToJpy;
            values.usd = values.btc * btcToUsd;
            values.eur = values.btc * btcToEur;
            break;
        case 'sats':
            values.btc = values.sats / satsInBtc;
            values.jpy = values.btc * btcToJpy;
            values.usd = values.btc * btcToUsd;
            values.eur = values.btc * btcToEur;
            break;
        case 'jpy':
            values.btc = values.jpy / btcToJpy;
            values.sats = values.btc * satsInBtc;
            values.usd = values.btc * btcToUsd;
            values.eur = values.btc * btcToEur;
            break;
        case 'usd':
            values.btc = values.usd / btcToUsd;
            values.sats = values.btc * satsInBtc;
            values.jpy = values.btc * btcToJpy;
            values.eur = values.btc * btcToEur;
            break;
        case 'eur':
            values.btc = values.eur / btcToEur;
            values.sats = values.btc * satsInBtc;
            values.jpy = values.btc * btcToJpy;
            values.usd = values.btc * btcToUsd;
            break;
        default:
            console.error("Unknown inputField:", inputField);
            return;
    }

    inputFields.forEach(id => {
        if (id === inputField) {
            const element = getDomElementById(id);
            const caretPos = element.selectionStart;
            element.setSelectionRange(caretPos, caretPos);
        } else {
            getDomElementById(id).value = formatCurrency(values[id], id, selectedLocale, true, significantDigits);
        }
    });

    lastUpdatedField = inputField;
    updateShareButton(values.btc, values.sats, values.jpy, values.usd, values.eur);
    changeBackgroundColorFromId(inputField);
}

// キー入力
function handleInputFormatting(event) {
    const inputElement = event.target;
    addCommasToInput(inputElement);

    const queryString = generateQueryStringFromValues();

    if (queryString) {
        const currentUrl = new URL(window.location.href);
        const newUrl = `${currentUrl.origin}${currentUrl.pathname}${queryString}`;
        window.history.replaceState(null, '', newUrl);
    }
}

//ロケールから桁区切りと小数点の文字を取得
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


// 有効数字、小数点以下の制限、ロケールごとの記法
function formatCurrency(num, id, selectedLocale, shouldRound = true, significantDigits) {
    // 現在選択されているフォーマットオプションを取得
    const formatOptions = currentFormatOptions[id];

    if (typeof num !== 'number') {
        num = parseFloat(num);
        if (isNaN(num)) {
            console.error("Invalid type for num:", num);
            return;
        }
    }

    let roundedNum = shouldRound ? Number(num.toPrecision(significantDigits)) : num;
    const maximumFractionDigits = formatOptions.maximumFractionDigits;
    const numFractionDigits = (roundedNum.toString().split('.')[1] || '').length;

    if (numFractionDigits > maximumFractionDigits) {
        roundedNum = Number(roundedNum.toFixed(maximumFractionDigits));
    }

    return Number(roundedNum).toLocaleString(selectedLocale, formatOptions);
}

function calculateSignificantDigits(inputDigits) {
    let dynamicSignificantDigits = 7;
    if (inputDigits > 1) {
        dynamicSignificantDigits += (inputDigits - 1);
    }
    return Math.min(dynamicSignificantDigits, 10);
}

// 価格レート更新日時の表示
function updateLastUpdated(timestamp) {
    const updatedAt = new Date(timestamp * 1000);
    const userLocale = navigator.language || navigator.userLanguage;
    const formatter = new Intl.DateTimeFormat(userLocale, dateTimeFormatOptions);
    const formattedDate = formatter.format(updatedAt);

    getDomElementById('last-updated').textContent = formattedDate;
    lastUpdatedTimestamp = timestamp;

    return formattedDate;
}

// ページ読み込みもしくは表示状態が変わった際の要素更新処理
function checkAndUpdateElements() {
    const diffTime = Math.floor(Date.now() / 1000) - lastUpdatedTimestamp;
    const updatePricesElement = getDomElementById('update-prices');
    const lastUpdatedElement = getDomElementById('last-updated');

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

    const updatePricesElement = getDomElementById('update-prices');
    const lastUpdatedElement = getDomElementById('last-updated');

    if (diffTime >= 610) {
        // すぐにアニメーションを開始
        let svg = updatePricesElement.querySelector('svg');
        if (svg && !svg.classList.contains('rotated')) {
            svg.classList.add('rotated');
        }

        // アニメーション開始時刻を記録
        const animationStartTime = Date.now();

        // データを取得し計算
        await fetchDataFromCoinGecko();
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
    activeField = event.target.id;
    if (activeField === 'jpy' || activeField === 'usd' || activeField === 'eur') {
        currentFormatOptions = currencyFormatOptionsSets.alt;
    } else {
        currentFormatOptions = currencyFormatOptionsSets.default;
    }
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
    inputs.forEach(input => input.classList.remove('last-input-field'));

    const targetInput = getDomElementById(id);
    targetInput.classList.add('last-input-field');
}

// ポップアップ表示
function showNotification(message, event, align = 'right') {
    const notification = getDomElementById('notification');
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
    const decimalFormat = urlParams.get('d') || 'p'; // dパラメータから小数点のフォーマット情報を取得
    const locale = decimalFormat === 'c' ? 'de-DE' : 'en-US'; // dパラメータに基づいてロケールを設定

    ['btc', 'sats', 'jpy', 'usd', 'eur'].forEach(field => {
        if (urlParams.has(field)) {
            const element = getDomElementById(field);
            const rawValue = urlParams.get(field);
            const parsedValue = parseInput(rawValue, locale); // クエリパラメータのロケール情報で解析
            const formattedValue = formatCurrency(parsedValue, field, selectedLocale, true); // 数値をロケールに応じてフォーマット
            element.value = formattedValue;
            calculateValues(field);
        }
    });
}

function getQueryString(field, value) {
    const separators = getLocaleSeparators(selectedLocale);
    const formattedValue = value.replace('.', separators.decimalSeparator); // 小数点をロケールに合わせて置換
    const decimalFormat = separators.decimalSeparator === '.' ? 'p' : 'c'; // 小数点のフォーマットを設定
    return `?${field}=${formattedValue}&d=${decimalFormat}`; // dパラメータを追加
}

function generateQueryStringFromValues() {
    if (!lastUpdatedField) return '';
    const values = getValuesFromElements();
    return getQueryString(lastUpdatedField, values[lastUpdatedField]);
}

// インプットフィールドから桁区切りを取り除いた数値を取得
function getValuesFromElements() {
    const values = {};
    inputFields.forEach(field => {
        const rawValue = getDomElementById(field).value;
        values[field] = parseInput(rawValue, selectedLocale);
    });
    return values;
}

// 共有テキスト生成
function generateCopyText(values) {
    const baseCurrencyKey = lastUpdatedField;
    const baseCurrencyText = `${getCurrencyText(baseCurrencyKey, values[baseCurrencyKey], baseCurrencyKey)} =`;

    const otherCurrencyKeys = ['sats', 'btc'].filter(key => key !== baseCurrencyKey);
    const otherCurrencyTexts = otherCurrencyKeys.map(key => getCurrencyText(key, values[key], baseCurrencyKey)).join(', ');

    const remainingCurrencies = Object.keys(values).filter(key => !['sats', 'btc', baseCurrencyKey].includes(key))
        .map(key => getCurrencyText(key, values[key]));

    const lastUpdatedText = updateLastUpdated(lastUpdatedTimestamp);

    return [
        baseCurrencyText,
        otherCurrencyTexts,
        ...remainingCurrencies,
        '',
        lastUpdatedText,
        'Powered by CoinGecko,'
    ].join('\n');
}

function getCurrencyText(key, value, baseCurrencyKey) {
    const includeSymbol = (baseCurrencyKey === 'sats' && key === 'btc') ||
        (baseCurrencyKey === 'btc' && key === 'sats') ||
        (baseCurrencyKey === key);

    const baseTexts = {
        sats: "₿ {value} sats",
        btc: includeSymbol ? "₿ {value} BTC" : "{value} BTC",
        jpy: "¥ {value} JPY",
        usd: "$ {value} USD",
        eur: "€ {value} EUR"
    };
    return baseTexts[key]?.replace('{value}', formatCurrency(value, key, selectedLocale, true)) || '';
}

// 共有ボタン
function updateShareButton() {
    const values = getValuesFromElements();

    const shareText = generateCopyText(values);
    const queryParams = generateQueryStringFromValues();

    const links = generateShareLinks(queryParams, shareText);

    getDomElementById('share-twitter').href = links.twitter;
    getDomElementById('share-nostter').href = links.nostter;
    getDomElementById('share-mass-driver').href = links.massDriver;
}

function generateShareLinks(queryParams, shareText) {
    const shareUrl = `${BASE_URL}${queryParams}`;
    return {
        twitter: `https://twitter.com/share?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
        nostter: `https://nostter.app/post?content=${encodeURIComponent(shareText)}%20${encodeURIComponent(shareUrl)}`,
        massDriver: `https://mdrv.shino3.net/?intent=${encodeURIComponent(shareText)}%20${encodeURIComponent(shareUrl)}`
    };
}

function setupEventListenersForCurrencyButtons() {
    ['sats', 'btc', 'jpy', 'usd', 'eur'].forEach(currency => {
        getDomElementById('copy-' + currency).addEventListener('click', function (event) {
            copySingleCurrencyToClipboardEvent(event);
        });

        getDomElementById('paste-' + currency).addEventListener('click', function (event) {
            pasteFromClipboardToInput(currency);
        });
    });

    getDomElementById('copy-to-clipboard').addEventListener('click', copyToClipboardEvent);
}

// クリップボードにコピー　各通貨
function copySingleCurrencyToClipboardEvent(event) {
    const currency = event.target.dataset.currency;
    const inputValue = getDomElementById(currency).value;
    const separators = getLocaleSeparators(selectedLocale);
    const sanitizedValue = inputValue.replace(new RegExp(`\\${separators.groupSeparator}`, 'g'), ''); // 桁区切りを削除
    copyToClipboard(sanitizedValue, event, 'left');
}

// クリップボードにコピー　全体
function copyToClipboardEvent(event) {
    const values = getValuesFromElements();
    const baseText = generateCopyText(values);
    const queryParams = generateQueryStringFromValues();
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
    const sanitizedValue = parseInput(clipboardData, selectedLocale); // クリップボードのデータをロケールに応じて解析
    const numericValue = parseFloat(sanitizedValue);
    if (!isNaN(numericValue)) {
        const formattedValue = formatCurrency(numericValue, currency, selectedLocale, true);
        getDomElementById(currency).value = formattedValue;
        calculateValues(currency);
    } else {
        console.log("クリップボードの内容が数値ではありません。");
    }
}

// Web Share API
function shareViaWebAPIEvent() {
    const values = getValuesFromElements();
    const shareText = generateCopyText(values);
    const queryParams = generateQueryStringFromValues();
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
    const updateButton = getDomElementById('checkForUpdateBtn');
    const buttonText = getDomElementById('buttonText');
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
                    const updateUI = getDomElementById('buttonText');
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
    const updateButton = getDomElementById('checkForUpdateBtn');
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
        getDomElementById('siteVersion').textContent = siteVersion;
    }
}

import { consoleLog } from './lib/console.js';

consoleLog('import test.');
