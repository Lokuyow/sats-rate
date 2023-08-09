const satsInBtc = 1e8;
const inputFields = ['btc', 'sats', 'jpy', 'usd'];
let btcToJpy, btcToUsd, lastUpdatedField;

document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
    try {
        await fetchDataFromCoinGecko();
        setupEventListeners();
        handleServiceWorker();
        loadValuesFromQueryParams();
    } catch (err) {
        handleError(err);
    }
}

async function fetchDataFromCoinGecko() {
    const data = await getCoinGeckoData();
    updateCurrencyRates(data);
    updateLastUpdated(data.bitcoin.last_updated_at);
    setDefaultValues();
}

async function getCoinGeckoData() {
    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=jpy%2Cusd&include_last_updated_at=true");
    return response.json();
}

function setDefaultValues() {
    const satsField = document.getElementById('sats');
    if (!satsField.value) {
        satsField.value = addCommas("100");
        calculateValues('sats');
    }
}

function updateCurrencyRates(data) {
    btcToJpy = data.bitcoin.jpy;
    btcToUsd = data.bitcoin.usd;
}

function updateLastUpdated(timestamp) {
    const updatedAt = new Date(timestamp * 1000);
    document.getElementById('last-updated').textContent = `データ取得：${updatedAt.toLocaleString()}`;
}

function handleError(err) {
    console.error("Failed to fetch price data from CoinGecko:", err);
    alert("価格データの取得に失敗しました。しばらく時間をおいてからページをリロードしてみてください。");
}

function setupEventListeners() {
    inputFields.forEach(id => {
        const element = document.getElementById(id);
        element.addEventListener('focus', selectInputText);
        element.addEventListener('keyup', formatInputWithCommas);
    });

    document.getElementById('copy-to-clipboard').addEventListener('click', function (event) {
        const values = getValuesFromElements();
        const textToCopy = generateCopyText(values);
        copyToClipboard(textToCopy, event);
    });

    document.getElementById('share-via-webapi').addEventListener('click', function () {
        const values = getValuesFromElements();
        const shareText = generateCopyText(values);
        shareViaWebAPI(shareText);
    });
}

function selectInputText(event) {
    event.target.select();
}

function formatInputWithCommas(event) {
    addCommasToInput(event.target);
}

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
    updateNotice.innerHTML = '新しいバージョンが利用可能です<button id="updateBtn">更新</button>';
    document.body.appendChild(updateNotice);
    document.getElementById('updateBtn').addEventListener('click', () => {
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

// URLクエリパラメータ
function loadValuesFromQueryParams() {
    const urlParams = new URLSearchParams(window.location.search);
    ['btc', 'sats', 'jpy', 'usd'].forEach(field => {
        if (urlParams.has(field)) {
            const element = document.getElementById(field);
            element.value = addCommas(urlParams.get(field));
            calculateValues(field);
        }
    });
}

// 計算
function calculateValues(inputField) {
    const values = {
        btc: getInputValue('btc'),
        sats: getInputValue('sats'),
        jpy: getInputValue('jpy'),
        usd: getInputValue('usd')
    };

    switch (inputField) {
        case 'btc':
            values.sats = (values.btc * satsInBtc).toLocaleString();
            values.jpy = (values.btc * btcToJpy).toLocaleString();
            values.usd = (values.btc * btcToUsd).toLocaleString();
            break;
        case 'sats':
            values.btc = (values.sats / satsInBtc).toFixed(8);
            values.jpy = (values.btc * btcToJpy).toLocaleString();
            values.usd = (values.btc * btcToUsd).toLocaleString();
            break;
        case 'jpy':
            values.btc = (values.jpy / btcToJpy).toFixed(8);
            values.sats = (values.btc * satsInBtc).toLocaleString();
            values.usd = (values.btc * btcToUsd).toLocaleString();
            break;
        case 'usd':
            values.btc = (values.usd / btcToUsd).toFixed(8);
            values.sats = (values.btc * satsInBtc).toLocaleString();
            values.jpy = (values.btc * btcToJpy).toLocaleString();
            break;
        default:
            console.error("Unknown inputField:", inputField);
            return;
    }

    inputFields.forEach(id => {
        getElementById(id).value = addCommas(values[id]);
    });

    lastUpdatedField = inputField;
    updateShareButton(values.btc, values.sats, values.jpy, values.usd);
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
function updateShareButton(btc, sats, jpy, usd) {
    const shareText = `₿：${addCommas(btc)} BTC\n₿：${addCommas(sats)} sats\n¥：${addCommas(jpy)} 円\n$：${addCommas(usd)} ドル\nPowered by CoinGecko,`;
    const queryParams = getQueryStringFromValues({ btc, sats, jpy, usd });
    const links = generateShareLinks(queryParams, shareText);

    document.getElementById('share-twitter').href = links.twitter;
    document.getElementById('share-nostter').href = links.nostter;
    document.getElementById('share-mass-driver').href = links.massDriver;
}

// クリップボードにコピー
function getValuesFromElements() {
    return {
        btc: addCommas(document.getElementById('btc').value),
        sats: addCommas(document.getElementById('sats').value),
        jpy: addCommas(document.getElementById('jpy').value),
        usd: addCommas(document.getElementById('usd').value)
    };
}

function generateCopyText(values) {
    const queryParams = getQueryStringFromValues(values);
    return `₿：${values.btc} BTC\n₿：${values.sats} sats\n¥：${values.jpy} 円\n$：${values.usd} ドル\nPowered by CoinGecko, https://lokuyow.github.io/sats-rate/${queryParams}`;
}

function copyToClipboard(text, event) {
    navigator.clipboard.writeText(text).then(() => {
        const notification = document.getElementById('notification');
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

function getElementById(id) {
    return document.getElementById(id);
}

function getInputValue(id) {
    return getElementById(id).value.replace(/,/g, '');
}

// Web Share API
function shareViaWebAPI(shareText) {
    if (navigator.share) {
        navigator.share({
            title: 'おいくらサッツ',
            text: shareText,
            url: 'https://lokuyow.github.io/sats-rate/'
        })
        .then(() => console.log('成功した共有'))
        .catch((error) => console.log('共有エラー', error));
    } else {
        console.log('Web Share APIはサポートされていません。');
    }
}
