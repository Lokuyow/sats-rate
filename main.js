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
const currencyFormatOptions = {
    sats: { maximumFractionDigits: 0, minimumFractionDigits: 0 },
    btc: { maximumFractionDigits: 8, minimumFractionDigits: 0 },
    jpy: { maximumFractionDigits: 5, minimumFractionDigits: 0 },
    usd: { maximumFractionDigits: 5, minimumFractionDigits: 0 },
    eur: { maximumFractionDigits: 5, minimumFractionDigits: 0 }
};
const significantDigits = 7;
let btcToJpy, btcToUsd, btcToEur, lastUpdatedField;
let lastUpdatedTimestamp = null;
let selectedLocale = navigator.language || navigator.languages[0];

document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
    await fetchDataFromCoinGecko();
    await handleServiceWorker();
    loadValuesFromQueryParams();
    setupEventListeners();
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
    }
    setDefaultValues();
    if (lastUpdatedField) {
        calculateValues(lastUpdatedField);
        updateElementClass(getDomElementById('update-prices'), false);
    }
}

async function setupEventListeners() {
    inputFields.forEach(id => {
        const element = getDomElementById(id);
        setupInputFieldEventListeners(element);
    });
    
    await displaySiteVersion();
    setupEventListenersForCurrencyButtons()
    getDomElementById('share-via-webapi').addEventListener('click', shareViaWebAPIEvent);
    getDomElementById('update-prices').addEventListener('click', updateElementsBasedOnTimestamp);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
}

function setupInputFieldEventListeners(element) {
    element.addEventListener('keyup', handleInputFormatting);
    element.addEventListener('focus', handleFocus);
    element.addEventListener('contextmenu', handleContextMenu);
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

function setDefaultValues() {
    const satsField = getDomElementById('sats');
    if (!satsField.value) {
        satsField.value = formatCurrency("100", "sats", selectedLocale, currencyFormatOptions);
        calculateValues('sats');
    }
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
            getDomElementById(id).value = formatCurrency(values[id], id, selectedLocale, currencyFormatOptions);
        }
    });

    lastUpdatedField = inputField;
    updateShareButton(values.btc, values.sats, values.jpy, values.usd, values.eur);
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

function getLocaleSeparators(locale) {
    const formattedNumber = new Intl.NumberFormat(locale).format(1000.1);
    return {
        groupSeparator: formattedNumber[1], // 桁区切り文字
        decimalSeparator: formattedNumber[5] // 小数点の区切り文字
    };
}

function parseInput(inputValue, locale) {
    const separators = getLocaleSeparators(locale);
    const sanitizedValue = inputValue.replace(new RegExp(`\\${separators.groupSeparator}`, 'g'), '').replace(separators.decimalSeparator, '.');
    return sanitizedValue;
}

function addCommasToInput(inputElement) {
    const originalCaretPos = inputElement.selectionStart;
    const originalSelectionEnd = inputElement.selectionEnd; // 追加
    const separators = getLocaleSeparators(selectedLocale);
    const originalValue = parseInput(inputElement.value, selectedLocale);

    if (originalValue === '') {
        inputElement.value = '0';
        inputElement.selectionStart = 1;
        inputElement.selectionEnd = 1;
        return; // この関数の残りの部分をスキップ
    }

    let preSeparatorCount = (inputElement.value.slice(0, originalCaretPos).match(new RegExp(`\\${separators.groupSeparator}`, 'g')) || []).length;

    let formattedValue;
    if (originalValue.endsWith('.') || (originalValue.includes(separators.decimalSeparator) && originalCaretPos > originalValue.indexOf(separators.decimalSeparator))) {
        // 小数点が入力された場合、桁区切りを保持する
        const parts = originalValue.split(separators.decimalSeparator);
        const integerPart = parts[0];
        formattedValue = new Intl.NumberFormat(selectedLocale).format(parseFloat(integerPart));
        formattedValue += separators.decimalSeparator + (parts[1] ? parts[1] : '');
    } else {
        const currencyId = inputElement.id; // 通貨のIDを入力エレメントのIDから取得
        formattedValue = formatCurrency(originalValue, currencyId, selectedLocale, currencyFormatOptions);
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
function formatCurrency(num, id, selectedLocale, currencyFormatOptions) {
    if (typeof num !== 'number') {
        num = parseFloat(num);
        if (isNaN(num)) {
            console.error("Invalid type for num:", num);
            return;
        }
    }

    let roundedNum = Number(num.toPrecision(significantDigits));
    const maximumFractionDigits = currencyFormatOptions[id].maximumFractionDigits;
    const numFractionDigits = (roundedNum.toString().split('.')[1] || '').length;

    if (numFractionDigits > maximumFractionDigits) {
        roundedNum = Number(roundedNum.toFixed(maximumFractionDigits));
    }

    return Number(roundedNum).toLocaleString(selectedLocale, currencyFormatOptions[id]);
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

// 画面を切り替えたときのレート更新ボタンと取得日時表示
function handleVisibilityChange() {
    if (document.hidden) return;

    const diffTime = Math.floor(Date.now() / 1000) - lastUpdatedTimestamp;
    const updatePricesElement = getDomElementById('update-prices');
    const lastUpdatedElement = getDomElementById('last-updated');

    updateElementClass(updatePricesElement, diffTime >= 610);
    updateElementClass(lastUpdatedElement, diffTime >= 610);
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
            svg.addEventListener('animationend', function () {
                svg.classList.remove('rotated');
            }, { once: true });
        }

        // データを取得
        await fetchDataFromCoinGecko();
        const updatedDiffTime = Math.floor(Date.now() / 1000) - lastUpdatedTimestamp;

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
            const formattedValue = formatCurrency(parsedValue, field, selectedLocale, currencyFormatOptions); // 数値をロケールに応じてフォーマット
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
        lastUpdatedText,
        'Powered by CoinGecko,'
    ].filter(Boolean).join('\n');
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
    return baseTexts[key]?.replace('{value}', formatCurrency(value, key, selectedLocale, currencyFormatOptions)) || '';
}

// 共有ボタン
function updateShareButton(btc, sats, jpy, usd, eur) {
    const values = { btc, sats, jpy, usd, eur };

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
        nostter: `https://nostter.vercel.app/post?content=${encodeURIComponent(shareText)}%20${encodeURIComponent(shareUrl)}`,
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

// コピー、ポップアップ表示
function copyToClipboard(text, event, align = 'right') {
    navigator.clipboard.writeText(text).then(() => {
        const notification = getDomElementById('notification');
        notification.textContent = 'クリップボードにコピーしました';

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
        const formattedValue = formatCurrency(numericValue, currency, selectedLocale, currencyFormatOptions);
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
async function handleServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    try {
        const reg = await navigator.serviceWorker.register('./sw.js');
        monitorServiceWorkerUpdate(reg);
    } catch (e) {
        console.error("Service Worker registration failed:", e);
    }
}

function monitorServiceWorkerUpdate(reg) {
    reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                promptUserToUpdate(reg);
            }
        });
    });
}

function promptUserToUpdate(reg) {
    const updateNotice = createUpdateNoticeElement();
    document.body.appendChild(updateNotice);

    getDomElementById('updateBtn').addEventListener('click', () => reloadWhenWorkerUpdated(reg));
}

async function reloadWhenWorkerUpdated(reg) {
    if (reg.waiting) {
        reg.waiting.postMessage('skipWaiting');
        await new Promise(resolve => {
            reg.waiting.addEventListener('statechange', () => {
                if (!reg.waiting) {
                    resolve();
                }
            });
        });
        window.location.reload();
    } else {
        console.warn('Service Worker is not waiting.');
        window.location.reload();
    }
}

function createUpdateNoticeElement() {
    const updateNotice = document.createElement('div');
    updateNotice.className = 'update-notice';

    const updateBox = document.createElement('div');
    updateBox.className = 'update-notice-box';

    const title = createElementWithContent('h3', 'アップデート通知');
    const text = createElementWithContent('p', '新しいバージョンが利用可能です。');
    const updateButton = createElementWithContent('button', '更新', { id: 'updateBtn' });

    updateBox.append(title, text, updateButton);
    updateNotice.appendChild(updateBox);

    return updateNotice;
}

function createElementWithContent(tag, content, attributes = {}) {
    const element = document.createElement(tag);
    element.innerHTML = content;

    for (const key in attributes) {
        element.setAttribute(key, attributes[key]);
    }

    return element;
}

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

async function displaySiteVersion() {
    const siteVersion = await fetchVersionFromSW();
    if (siteVersion) {
        getDomElementById('siteVersion').textContent = siteVersion;
    }
}