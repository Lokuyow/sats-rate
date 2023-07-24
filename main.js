let btcToJpy;
let btcToUsd;
const satsInBtc = 1e8;

window.onload = async function() {
    try {
        const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=jpy%2Cusd");
        const data = await response.json();
        btcToJpy = data.bitcoin.jpy;
        btcToUsd = data.bitcoin.usd;
    } catch (err) {
        console.error("Failed to fetch price data from CoinGecko:", err);
        alert("価格データの取得に失敗しました。しばらく時間をおいてからページをリロードしてみてください。");
        return;
    }

    document.getElementById('sats').value = 100;
    calculateValues('sats');

    document.getElementById('btc').addEventListener('focus', function() {
        this.select();
    });
    document.getElementById('sats').addEventListener('focus', function() {
        this.select();
    });
    document.getElementById('jpy').addEventListener('focus', function() {
        this.select();
    });
    document.getElementById('usd').addEventListener('focus', function() {
        this.select();
    });

    document.getElementById('btc').addEventListener('keyup', function() {
        addCommasToInput(this);
    });
    document.getElementById('sats').addEventListener('keyup', function() {
        addCommasToInput(this);
    });
    document.getElementById('jpy').addEventListener('keyup', function() {
        addCommasToInput(this);
    });
    document.getElementById('usd').addEventListener('keyup', function() {
        addCommasToInput(this);
    });

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
        .then(function(registration) {
            console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch(function(error) {
            console.log('Service Worker registration failed:', error);
        });
    }
}

function calculateValues(inputField) {
    let btc, sats, jpy, usd;
    switch(inputField) {
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
    document.getElementById('sats').value = sats;
    document.getElementById('jpy').value = jpy;
    document.getElementById('usd').value = usd;
}

function addCommas(num) {
    let s = num.toString().replace(/[^0-9.]/g, '');
    let b = s.toString().split('.');
    b[0] = b[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,');
    return b.join('.');
}

function addCommasToInput(inputElement) {
    let caretPos = inputElement.selectionStart - inputElement.value.length;
    inputElement.value = addCommas(inputElement.value.replace(/,/g, ''));
    caretPos = caretPos + (inputElement.value.length - caretPos);
    inputElement.selectionStart = caretPos;
    inputElement.selectionEnd = caretPos;
}