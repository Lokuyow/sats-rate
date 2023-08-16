const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=jpy%2Cusd%2Ceur&include_last_updated_at=true&precision=3";
const satsInBtc = 1e8;
const inputFields = ['btc', 'sats', 'jpy', 'usd', 'eur'];
const dateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
};
const BASE_URL = "https://lokuyow.github.io/sats-rate/";
const BASE_TEXTS = {
    btc: "₿：{value} BTC",
    sats: "₿：{value} sats",
    jpy: "¥：{value} JPY",
    usd: "$：{value} USD",
    eur: "€：{value} EUR"
};
let btcToJpy, btcToUsd, btcToEur, lastUpdatedField;
let lastUpdatedTimestamp = null;
let touchStartTime = 0;
let longPressed = false;
let touchMoved = false;

document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
    try {
        await fetchDataFromCoinGecko();
        setupEventListeners();
        handleServiceWorker();
        loadValuesFromQueryParams();
        initializeUpdateButtonRotation();
        document.addEventListener('visibilitychange', updateButtonAppearanceOnVisibilityChange);
    } catch (err) {
        handleError(err);
    }
}

async function fetchDataFromCoinGecko() {
    const data = await getCoinGeckoData();
    updateCurrencyRates(data);
    updateLastUpdated(data.bitcoin.last_updated_at);
    setDefaultValues();
    if (lastUpdatedField) {
        calculateValues(lastUpdatedField);
    }
}

async function getCoinGeckoData() {
    const response = await fetch(COINGECKO_URL);
    return response.json();
}

function setupEventListeners() {
    inputFields.forEach(id => {
        const element = getDomElementById(id);
        setupInputFieldEventListeners(element);
    });

    setupEventListenersForCurrencyButtons()

    getDomElementById('share-via-webapi').addEventListener('click', shareViaWebAPIEvent);
    getDomElementById('update-prices').addEventListener('click', fetchDataFromCoinGecko);
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

function handleError(err) {
    console.error("Failed to fetch price data from CoinGecko:", err);
    alert("価格データの取得に失敗しました。しばらく時間をおいてからページをリロードしてみてください。");
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
    return getDomElementById(id).value.replace(/,/g, '');
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

// 数値入力時のカンマ追加とカーソル位置調整
function addCommasToInput(inputElement) {
    const originalCaretPos = inputElement.selectionStart;
    const originalValue = inputElement.value.replace(/,/g, '');

    let preCommaCount = (inputElement.value.slice(0, originalCaretPos).match(/,/g) || []).length;

    let formattedValue = originalValue;
    if (!(originalValue.endsWith('.') || (originalValue.includes('.') && originalCaretPos > originalValue.indexOf('.')))) {
        formattedValue = formatCurrency(originalValue);
    }

    let postCommaCount = (formattedValue.slice(0, originalCaretPos).match(/,/g) || []).length;
    let diffCommaCount = postCommaCount - preCommaCount;

    let newCaretPos = originalCaretPos + diffCommaCount;
    inputElement.value = formattedValue;

    if (newCaretPos < 0) newCaretPos = 0;
    if (newCaretPos > formattedValue.length) newCaretPos = formattedValue.length;

    inputElement.selectionStart = newCaretPos;
    inputElement.selectionEnd = newCaretPos;
}

// カンマ追加と小数点
function formatCurrency(num, id) {
    const currencyFormatOptions = {
        btc: { maximumFractionDigits: 8, minimumFractionDigits: 0 },
        sats: { maximumFractionDigits: 0, minimumFractionDigits: 0 },
        jpy: { maximumFractionDigits: 3, minimumFractionDigits: 0 },
        usd: { maximumFractionDigits: 5, minimumFractionDigits: 0 },
        eur: { maximumFractionDigits: 5, minimumFractionDigits: 0 }
    };
    return Number(num).toLocaleString(undefined, currencyFormatOptions[id]);
}

// 価格更新日時
function updateLastUpdated(timestamp) {
    const updatedAt = new Date(timestamp * 1000);
    const formatter = new Intl.DateTimeFormat('ja-JP', dateTimeFormatOptions);
    getDomElementById('last-updated').textContent = formatter.format(updatedAt);
    lastUpdatedTimestamp = timestamp;
    updateButtonAppearance();
}

function updateButtonAppearanceOnVisibilityChange() {
    if (document.visibilityState === 'visible') {
        updateButtonAppearance();
    }
}

// 更新ボタンの見た目
function updateButtonAppearance() {
    const now = Math.floor(Date.now() / 1000);
    const diffTime = now - lastUpdatedTimestamp;
    
    // Elements to be updated
    const elementsToUpdate = [
        getDomElementById('update-prices'),
        getDomElementById('last-updated')
    ];

    elementsToUpdate.forEach(element => {
        if (diffTime >= 610) {
            element.classList.add('outdated');
            element.classList.remove('recent');
        } else {
            element.classList.remove('outdated');
            element.classList.add('recent');
        }
        element.style.visibility = 'visible';
    });
}

// 更新ボタンの回転
function initializeUpdateButtonRotation() {
    const updateButton = getDomElementById('update-prices');
    updateButton.addEventListener('click', function() {
        if (this.classList.contains('recent')) return;
        let svg = this.querySelector('svg');
        svg.classList.add('rotated');
        svg.addEventListener('animationend', function() {
            svg.classList.remove('rotated');
        }, { once: true });
    });
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
    ['btc', 'sats', 'jpy', 'usd', 'eur'].forEach(field => {
        if (urlParams.has(field)) {
            const element = getDomElementById(field);
            element.value = formatCurrency(urlParams.get(field));
            calculateValues(field);
        }
    });
}
function getQueryString(field, value) {
    return `?${field}=${value.replace(/,/g, '')}`;
}
function generateQueryStringFromValues() {
    if (!lastUpdatedField) return '';
    const values = getValuesFromElements();
    return getQueryString(lastUpdatedField, values[lastUpdatedField]);
}

// インプットフィールドからカンマを取り除いた数値を取得
function getValuesFromElements() {
    const values = {};
    inputFields.forEach(field => {
        values[field] = getDomElementById(field).value.replace(/,/g, '');
    });
    return values;
}

// 共有テキスト生成
function generateCopyText(values) {
    const formattedTexts = inputFields.map(field => BASE_TEXTS[field].replace('{value}', formatCurrency(values[field], field))).join('\n');
    return `${formattedTexts}\nPowered by CoinGecko,`;
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
        getDomElementById('copy-' + currency).addEventListener('click', function(event) {
            copySingleCurrencyToClipboardEvent(event);
        });

        getDomElementById('paste-' + currency).addEventListener('click', function(event) {
            pasteFromClipboardToInput(currency);
        });
    });

    getDomElementById('copy-to-clipboard').addEventListener('click', copyToClipboardEvent);
}

// クリップボードにコピー　各通貨
function copySingleCurrencyToClipboardEvent(event) {
    const currency = event.target.dataset.currency;
    const values = getValuesFromElements();
    copyToClipboard(values[currency], event, 'left');
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
    const numericValue = parseFloat(clipboardData);
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