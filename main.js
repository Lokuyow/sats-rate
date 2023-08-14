const satsInBtc = 1e8;
const inputFields = ['btc', 'sats', 'jpy', 'usd', 'eur'];
const formatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
};
let btcToJpy, btcToUsd, btcToEur, lastUpdatedField;

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
    recalculateValues();
}

async function getCoinGeckoData() {
    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=jpy%2Cusd%2Ceur&include_last_updated_at=true");
    return response.json();
}

let touchStartTime = 0;
let longPressed = false; // 長押し判定用のフラグ
let touchMoved = false;  // タッチ移動を検出するフラグ

function setupEventListeners() {
    inputFields.forEach(id => {
        const element = getDomElementById(id);
        setupInputFieldEventListeners(element);
    });

    getDomElementById('copy-to-clipboard').addEventListener('click', copyToClipboardEvent);
    getDomElementById('share-via-webapi').addEventListener('click', shareViaWebAPIEvent);
    getDomElementById('update-prices').addEventListener('click', fetchDataFromCoinGecko);
}

function setupInputFieldEventListeners(element) {
    element.addEventListener('keyup', formatInputWithCommas);
    element.addEventListener('focus', handleFocus);
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });    
    element.addEventListener('touchend', handleTouchEnd);
    element.addEventListener('contextmenu', handleContextMenu);
}

function getDomElementById(id) {
    return document.getElementById(id);
}

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

function handleError(err) {
    console.error("Failed to fetch price data from CoinGecko:", err);
    alert("価格データの取得に失敗しました。しばらく時間をおいてからページをリロードしてみてください。");
}

function setDefaultValues() {
    const satsField = getDomElementById('sats');
    if (!satsField.value) {
        satsField.value = addCommas("100");
        calculateValues('sats');
    }
}

function updateCurrencyRates(data) {
    btcToJpy = data.bitcoin.jpy;
    btcToUsd = data.bitcoin.usd;
    btcToEur = data.bitcoin.eur;
}

function formatInputWithCommas(event) {
    addCommasToInput(event.target);
}

function getInputValue(id) {
    return getDomElementById(id).value.replace(/,/g, '');
}

function updateLastUpdated(timestamp) {
    const updatedAt = new Date(timestamp * 1000);
    const formatter = new Intl.DateTimeFormat('ja-JP', formatOptions);
    getDomElementById('last-updated').textContent = formatter.format(updatedAt);
    updateButtonAppearance();
}

function updateButtonAppearanceOnVisibilityChange() {
    if (document.visibilityState === 'visible') {
        updateButtonAppearance();
    }
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

    const formatOptions = {
        btc: { maximumFractionDigits: 8, minimumFractionDigits: 0 },
        sats: { maximumFractionDigits: 8, minimumFractionDigits: 0 },
        jpy: { maximumFractionDigits: 3, minimumFractionDigits: 0 },
        usd: { maximumFractionDigits: 5, minimumFractionDigits: 0 },
        eur: { maximumFractionDigits: 5, minimumFractionDigits: 0 }
    };

    switch (inputField) {
        case 'btc':
            values.sats = (values.btc * satsInBtc).toLocaleString(undefined, formatOptions.sats);
            values.jpy = (values.btc * btcToJpy).toLocaleString(undefined, formatOptions.jpy);
            values.usd = (values.btc * btcToUsd).toLocaleString(undefined, formatOptions.usd);
            values.eur = (values.btc * btcToEur).toLocaleString(undefined, formatOptions.eur);
            break;
        case 'sats':
            values.btc = (values.sats / satsInBtc).toFixed(8);
            values.jpy = (values.btc * btcToJpy).toLocaleString(undefined, formatOptions.jpy);
            values.usd = (values.btc * btcToUsd).toLocaleString(undefined, formatOptions.usd);
            values.eur = (values.btc * btcToEur).toLocaleString(undefined, formatOptions.eur);
            break;
        case 'jpy':
            values.btc = (values.jpy / btcToJpy).toFixed(8);
            values.sats = (values.btc * satsInBtc).toLocaleString(undefined, formatOptions.sats);
            values.usd = (values.btc * btcToUsd).toLocaleString(undefined, formatOptions.usd);
            values.eur = (values.btc * btcToEur).toLocaleString(undefined, formatOptions.eur);
            break;
        case 'usd':
            values.btc = (values.usd / btcToUsd).toFixed(8);
            values.sats = (values.btc * satsInBtc).toLocaleString(undefined, formatOptions.sats);
            values.jpy = (values.btc * btcToJpy).toLocaleString(undefined, formatOptions.jpy);
            values.eur = (values.btc * btcToEur).toLocaleString(undefined, formatOptions.eur);
            break;
        case 'eur':
            values.btc = (values.eur / btcToEur).toFixed(8);
            values.sats = (values.btc * satsInBtc).toLocaleString(undefined, formatOptions.sats);
            values.jpy = (values.btc * btcToJpy).toLocaleString(undefined, formatOptions.jpy);
            values.usd = (values.btc * btcToUsd).toLocaleString(undefined, formatOptions.usd);
            break;
        default:
            console.error("Unknown inputField:", inputField);
            return;
    }

    inputFields.forEach(id => {
        getDomElementById(id).value = addCommas(values[id]);
    });

    lastUpdatedField = inputField;
    updateShareButton(values.btc, values.sats, values.jpy, values.usd, values.eur);
}

// 更新時再計算
function recalculateValues() {
    if (lastUpdatedField) {
        calculateValues(lastUpdatedField);
    }
}

// 更新ボタンの見た目
function updateButtonAppearance() {
    const timestampElem = getDomElementById('last-updated');
    const updatedAtTimestamp = new Date(timestampElem.textContent).getTime();
    const now = Date.now();
    const diffMinutes = (now - updatedAtTimestamp) / (1000 * 60);

    const updateButton = getDomElementById('update-prices');

    if (diffMinutes >= 10) {
        updateButton.classList.add('outdated');
        updateButton.classList.remove('recent');
    } else {
        updateButton.classList.remove('outdated');
        updateButton.classList.add('recent');
    }

    updateButton.style.visibility = 'visible';
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

// カンマ追加
function addCommas(num) {
    let s = num.toString().replace(/[^0-9.]/g, '');
    let b = s.toString().split('.');
    b[0] = b[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,');
    return b.join('.');
}
// カンマ追加時のカーソル位置調整
function addCommasToInput(inputElement) {
    let caretPos = inputElement.selectionStart - inputElement.value.length;
    inputElement.value = addCommas(inputElement.value.replace(/,/g, ''));
    caretPos = caretPos + (inputElement.value.length - caretPos);
    inputElement.selectionStart = caretPos;
    inputElement.selectionEnd = caretPos;
}

// URLクエリパラメータ
function loadValuesFromQueryParams() {
    const urlParams = new URLSearchParams(window.location.search);
    ['btc', 'sats', 'jpy', 'usd', 'eur'].forEach(field => {
        if (urlParams.has(field)) {
            const element = getDomElementById(field);
            element.value = addCommas(urlParams.get(field));
            calculateValues(field);
        }
    });
}
function getQueryStringFromValues(values) {
    let queryParams = '';
    switch (lastUpdatedField) {
        case 'btc':
            queryParams = `?btc=${values.btc.replace(/,/g, '')}`;
            break;
        case 'sats':
            queryParams = `?sats=${values.sats.replace(/,/g, '')}`;
            break;
        case 'jpy':
            queryParams = `?jpy=${values.jpy.replace(/,/g, '')}`;
            break;
        case 'usd':
            queryParams = `?usd=${values.usd.replace(/,/g, '')}`;
            break;
        case 'eur':
            queryParams = `?eur=${values.eur.replace(/,/g, '')}`;
            break;
    }
    return queryParams;
}

// 共有ボタン
function generateShareLinks(queryParams, shareText) {
    const shareUrl = "https://lokuyow.github.io/sats-rate/" + queryParams;
    return {
        twitter: "https://twitter.com/share?url=" + encodeURIComponent(shareUrl) + "&text=" + encodeURIComponent(shareText),
        nostter: "https://nostter.vercel.app/post?content=" + encodeURIComponent(shareText) + "%20" + encodeURIComponent(shareUrl),
        massDriver: "https://mdrv.shino3.net/?intent=" + encodeURIComponent(shareText) + "%20" + encodeURIComponent(shareUrl)
    };
}
function updateShareButton(btc, sats, jpy, usd, eur) {
    const shareText = `₿：${addCommas(btc)} BTC\n₿：${addCommas(sats)} sats\n¥：${addCommas(jpy)} JPY\n$：${addCommas(usd)} USD\n€：${addCommas(eur)} EUR\nPowered by CoinGecko,`;
    const queryParams = getQueryStringFromValues({ btc, sats, jpy, usd, eur });
    const links = generateShareLinks(queryParams, shareText);

    getDomElementById('share-twitter').href = links.twitter;
    getDomElementById('share-nostter').href = links.nostter;
    getDomElementById('share-mass-driver').href = links.massDriver;
}

// クリップボードにコピー
function copyToClipboardEvent(event) {
    const values = getValuesFromElements();
    const textToCopy = generateCopyText(values);
    copyToClipboard(textToCopy, event);
}

function getValuesFromElements() {
    const values = {};
    inputFields.forEach(field => {
        values[field] = addCommas(getDomElementById(field).value);
    });
    return values;
}

function generateCopyText(values) {
    const baseTexts = {
        btc: "₿：{value} BTC",
        sats: "₿：{value} sats",
        jpy: "¥：{value} JPY",
        usd: "$：{value} USD",
        eur: "€：{value} EUR",
    };

    const generatedTexts = inputFields.map(field => baseTexts[field].replace('{value}', values[field])).join('\n');
    return `${generatedTexts}\nPowered by CoinGecko, https://lokuyow.github.io/sats-rate/${getQueryStringFromValues(values)}`;
}

function copyToClipboard(text, event) {
    navigator.clipboard.writeText(text).then(() => {
        const notification = getDomElementById('notification');
        notification.textContent = 'クリップボードにコピーしました';
        notification.style.left = event.clientX + 'px';
        notification.style.top = (event.clientY + 20) + 'px';
        notification.style.visibility = 'visible';

        setTimeout(() => {
            notification.style.visibility = 'hidden';
        }, 1000);
    }).catch(err => {
        console.error('クリップボードへのコピーに失敗しました', err);
    });
}

// Web Share API
function shareViaWebAPIEvent() {
    const values = getValuesFromElements();
    const shareText = generateCopyText(values);
    const queryParams = getQueryStringFromValues(values);
    shareViaWebAPI(shareText, queryParams);
}
function shareViaWebAPI(shareText, queryParams) {
    shareText = shareText.replace(/https:\/\/lokuyow\.github\.io\/sats-rate\/.*$/, '');
    if (navigator.share) {
        navigator.share({
            title: 'おいくらサッツ',
            text: shareText,
            url: `https://lokuyow.github.io/sats-rate/${queryParams}`
        });
    } else {
        alert('お使いのブラウザはWeb共有APIをサポートしていません。別のブラウザを試してください。');
    }
}