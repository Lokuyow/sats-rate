let btcToJpy;
let btcToUsd;
const satsInBtc = 1e8;

window.onload = async function () {
    try {
        const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=jpy%2Cusd&include_last_updated_at=true");
        const data = await response.json();
        btcToJpy = data.bitcoin.jpy;
        btcToUsd = data.bitcoin.usd;
        const updatedAt = new Date(data.bitcoin.last_updated_at * 1000);
        document.getElementById('last-updated').textContent = `データ取得：${updatedAt.toLocaleString()}`;
    } catch (err) {
        console.error("Failed to fetch price data from CoinGecko:", err);
        alert("価格データの取得に失敗しました。しばらく時間をおいてからページをリロードしてみてください。");
        return;
    }

    document.getElementById('sats').value = 100;
    calculateValues('sats');

    document.getElementById('btc').addEventListener('focus', function () {
        this.select();
    });
    document.getElementById('sats').addEventListener('focus', function () {
        this.select();
    });
    document.getElementById('jpy').addEventListener('focus', function () {
        this.select();
    });
    document.getElementById('usd').addEventListener('focus', function () {
        this.select();
    });

    document.getElementById('btc').addEventListener('keyup', function () {
        addCommasToInput(this);
    });
    document.getElementById('sats').addEventListener('keyup', function () {
        addCommasToInput(this);
    });
    document.getElementById('jpy').addEventListener('keyup', function () {
        addCommasToInput(this);
    });
    document.getElementById('usd').addEventListener('keyup', function () {
        addCommasToInput(this);
    });

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
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
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('btc')) {
        document.getElementById('btc').value = addCommas(urlParams.get('btc'));
        calculateValues('btc');
    }
    if (urlParams.has('sats')) {
        document.getElementById('sats').value = addCommas(urlParams.get('sats'));
        calculateValues('sats');
    }
    if (urlParams.has('jpy')) {
        document.getElementById('jpy').value = addCommas(urlParams.get('jpy'));
        calculateValues('jpy');
    }
    if (urlParams.has('usd')) {
        document.getElementById('usd').value = addCommas(urlParams.get('usd'));
        calculateValues('usd');
    }
}

function calculateValues(inputField) {
    let btc, sats, jpy, usd;
    switch (inputField) {
        case 'btc':
            btc = document.getElementById('btc').value.replace(/,/g, '');
            sats = (btc * satsInBtc).toLocaleString();
            jpy = (btc * btcToJpy).toLocaleString();
            usd = (btc * btcToUsd).toLocaleString();
            break;
        case 'sats':
            sats = document.getElementById('sats').value.replace(/,/g, '');
            btc = (sats / satsInBtc).toFixed(8);
            jpy = (btc * btcToJpy).toLocaleString();
            usd = (btc * btcToUsd).toLocaleString();
            break;
        case 'jpy':
            jpy = document.getElementById('jpy').value.replace(/,/g, '');
            btc = (jpy / btcToJpy).toFixed(8);
            sats = (btc * satsInBtc).toLocaleString();
            usd = (btc * btcToUsd).toLocaleString();
            break;
        case 'usd':
            usd = document.getElementById('usd').value.replace(/,/g, '');
            btc = (usd / btcToUsd).toFixed(8);
            sats = (btc * satsInBtc).toLocaleString();
            jpy = (btc * btcToJpy).toLocaleString();
            break;
    }

    document.getElementById('btc').value = addCommas(btc);
    document.getElementById('sats').value = addCommas(sats);
    document.getElementById('jpy').value = addCommas(jpy);
    document.getElementById('usd').value = addCommas(usd);

    updateShareButton(btc, sats, jpy, usd);
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

function updateShareButton(btc, sats, jpy, usd) {
    const shareText = `₿：${addCommas(btc)} BTC\n₿：${addCommas(sats)} sats\n¥：${addCommas(jpy)} 円\n$：${addCommas(usd)} ドル\nPowered by CoinGecko,`;
    const shareUrl = "https://lokuyow.github.io/sats-rate/";
    document.getElementById('share-twitter').href = "https://twitter.com/share?url=" + encodeURIComponent(shareUrl) + "&text=" + encodeURIComponent(shareText);
    document.getElementById('share-nostter').href = "https://nostter.vercel.app/post?content=" + encodeURIComponent(shareText) + "%20" + encodeURIComponent(shareUrl);
    document.getElementById('share-mass-driver').href = "https://mdrv.shino3.net/?intent=" + encodeURIComponent(shareText) + "%20" + encodeURIComponent(shareUrl);
}

document.getElementById('copy-to-clipboard').addEventListener('click', function (event) {
    const btc = addCommas(document.getElementById('btc').value);
    const sats = addCommas(document.getElementById('sats').value);
    const jpy = addCommas(document.getElementById('jpy').value);
    const usd = addCommas(document.getElementById('usd').value);

    const textToCopy = `₿：${btc} BTC\n₿：${sats} sats\n¥：${jpy} 円\n$：${usd} ドル\nPowered by CoinGecko, https://lokuyow.github.io/sats-rate/`;

    navigator.clipboard.writeText(textToCopy).then(() => {
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
});
