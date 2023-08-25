const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=jpy%2Cusd%2Ceur&include_last_updated_at=true&precision=3";
const satsInBtc = 1e8;
const inputFields = ['sats', 'btc', 'jpy', 'usd', 'eur'];
const dateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
};
const BASE_URL = "https://lokuyow.github.io/sats-rate/";
const BASE_TEXTS = {
    sats: "₿：{value} sats",
    btc: "₿：{value} BTC",
    jpy: "¥：{value} JPY",
    usd: "$：{value} USD",
    eur: "€：{value} EUR"
};
let btcToJpy, btcToUsd, btcToEur, lastUpdatedField;
let lastUpdatedTimestamp = null;
let touchStartTime = 0;
let longPressed = false;
let touchMoved = false;
let selectedLocale = navigator.language || navigator.languages[0];

document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
    await fetchDataFromCoinGecko();
    setupEventListeners();
    handleServiceWorker();
    loadValuesFromQueryParams();
    handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
}

async function fetchDataFromCoinGecko() {
    let data;

    try {
        const response = await fetch(COINGECKO_URL);
        data = await response.json();
    } catch (err) {
        handleCoinGeckoRequestError(err);
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

function setupEventListeners() {
    inputFields.forEach(id => {
        const element = getDomElementById(id);
        setupInputFieldEventListeners(element);
    });
    setupEventListenersForCurrencyButtons()
    getDomElementById('share-via-webapi').addEventListener('click', shareViaWebAPIEvent);
    getDomElementById('update-prices').addEventListener('click', updateElementsBasedOnTimestamp);
}

function setupInputFieldEventListeners(element) {
    element.addEventListener('keyup', handleInputFormatting);
    element.addEventListener('focus', handleFocus);
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd);
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
        satsField.value = formatCurrency("100");
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
            getDomElementById(id).value = formatCurrency(values[id], id);
        }
    });

    lastUpdatedField = inputField;
    updateShareButton(values.btc, values.sats, values.jpy, values.usd, values.eur);
}

// キー入力
function handleInputFormatting(event) {
    addCommasToInput(event.target);
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
        formattedValue = formatCurrency(originalValue, currencyId);
    }

    let postSeparatorCount = (formattedValue.slice(0, originalCaretPos).match(new RegExp(`\\${separators.groupSeparator}`, 'g')) || []).length;
    let diffSeparatorCount = postSeparatorCount - preSeparatorCount;

    let newCaretPos = originalCaretPos + diffSeparatorCount;
    inputElement.value = formattedValue;

    if (newCaretPos < 0) newCaretPos = 0;
    if (newCaretPos > formattedValue.length) newCaretPos = formattedValue.length;

    inputElement.selectionStart = newCaretPos;
    inputElement.selectionEnd = newCaretPos;
}

// 計算結果のカンマ追加と桁数処理
function formatCurrency(num, id) {
    const currencyFormatOptions = {
        sats: { maximumFractionDigits: 3, minimumFractionDigits: 0 },
        btc: { maximumFractionDigits: 8, minimumFractionDigits: 0 },
        jpy: { maximumFractionDigits: 3, minimumFractionDigits: 0 },
        usd: { maximumFractionDigits: 5, minimumFractionDigits: 0 },
        eur: { maximumFractionDigits: 5, minimumFractionDigits: 0 }
    };
    return Number(num).toLocaleString(selectedLocale, currencyFormatOptions[id]);
}

// 価格レート更新日時の表示
function updateLastUpdated(timestamp) {
    const updatedAt = new Date(timestamp * 1000);
    const userLocale = navigator.language || navigator.userLanguage;
    const formatter = new Intl.DateTimeFormat(userLocale, dateTimeFormatOptions);

    getDomElementById('last-updated').textContent = formatter.format(updatedAt);
    lastUpdatedTimestamp = timestamp;
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

    if (diffTime >= 610) {
        await fetchDataFromCoinGecko();
        const updatedDiffTime = Math.floor(Date.now() / 1000) - lastUpdatedTimestamp;

        const updatePricesElement = getDomElementById('update-prices');
        const lastUpdatedElement = getDomElementById('last-updated');

        updateElementClass(updatePricesElement, updatedDiffTime >= 610);
        updateElementClass(lastUpdatedElement, updatedDiffTime >= 610);

        let svg = updatePricesElement.querySelector('svg');
        if (svg && !svg.classList.contains('rotated')) {
            svg.classList.add('rotated');
            svg.addEventListener('animationend', function () {
                svg.classList.remove('rotated');
            }, { once: true });
        }
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

function handleTouchStart(event) {
    touchMoved = false;
    longPressed = false;
    longPressTimer = setTimeout(() => {
        longPressed = true;
    }, 500);
}

function handleTouchMove(event) {
    touchMoved = true;
    clearTimeout(longPressTimer);
}

function handleTouchEnd(event) {
    clearTimeout(longPressTimer);
}

function handleContextMenu(event) {
    if (isMobileDevice() && !longPressed) {
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
            const formattedValue = formatCurrency(parsedValue, field); // 数値をロケールに応じてフォーマット
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
    // 基準通貨を取得（lastUpdatedFieldに基づいて）
    const baseCurrencyKey = lastUpdatedField;
    const baseCurrencySymbol = getCurrencySymbol(baseCurrencyKey);
    const baseCurrencyText = `${baseCurrencySymbol} ${formatCurrency(values[baseCurrencyKey], baseCurrencyKey)} ${(baseCurrencyKey !== 'sats') ? baseCurrencyKey.toUpperCase() : 'sats'} =`;

    // 他の通貨の整形（基準通貨、sats、btc以外）
    const excludeKeys = ['sats', 'btc', baseCurrencyKey];
    const otherCurrencies = Object.keys(values).filter(key => !excludeKeys.includes(key));
    const otherCurrencyTexts = otherCurrencies.map(key => {
        const symbol = getCurrencySymbol(key);
        return `${symbol} ${formatCurrency(values[key], key)} ${key.toUpperCase()}`;
    });

    // satsとBTCを一緒に表示
    let satsAndBtcText = '';
    if (baseCurrencyKey === 'sats') {
        satsAndBtcText = `₿ ${formatCurrency(values['btc'], 'btc')} BTC`;
    } else if (baseCurrencyKey === 'btc') {
        satsAndBtcText = `₿ ${formatCurrency(values['sats'], 'sats')} sats`;
    } else {
        satsAndBtcText = `₿ ${formatCurrency(values['sats'], 'sats')} sats, ${formatCurrency(values['btc'], 'btc')} BTC`;
    }
    otherCurrencyTexts.unshift(satsAndBtcText);

    // 結果の組み立て
    const resultText = [baseCurrencyText, ...otherCurrencyTexts].filter(Boolean).join('\n');

    return `${resultText}\nPowered by CoinGecko,`;
}

function getCurrencySymbol(key) {
    const symbols = {
        sats: '₿',
        btc: '₿',
        jpy: '¥',
        usd: '$',
        eur: '€'
    };
    return symbols[key] || '';
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
        const formattedValue = formatCurrency(numericValue, currency);
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
function handleServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('./sw.js').then(reg => {
        reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    notifyUserOfUpdate(reg);
                }
            });
        });
    });
}
function notifyUserOfUpdate(reg) {
    const updateNotice = document.createElement('div');
    updateNotice.className = 'update-notice';

    const updateBox = document.createElement('div');
    updateBox.className = 'update-notice-box';
    updateNotice.appendChild(updateBox);

    const title = document.createElement('h3');
    title.innerHTML = 'アップデート通知';
    updateBox.appendChild(title);

    const text = document.createElement('p');
    text.innerHTML = '新しいバージョンが利用可能です。';
    updateBox.appendChild(text);

    const updateButton = document.createElement('button');
    updateButton.id = 'updateBtn';
    updateButton.innerHTML = '更新';
    updateBox.appendChild(updateButton);

    document.body.appendChild(updateNotice);

    getDomElementById('updateBtn').addEventListener('click', () => {
        if (reg.waiting) {
            reg.waiting.postMessage('skipWaiting');
            reg.waiting.addEventListener('statechange', () => {
                if (reg.waiting == null) {
                    window.location.reload();
                }
            });
        } else {
            console.warn('Service Worker is not waiting.');
        }
    });
}