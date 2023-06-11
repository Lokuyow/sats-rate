let btcToJpy;
let btcToUsd;
const satsInBtc = 1e8;

window.onload = async function() {
    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=jpy%2Cusd");
    const data = await response.json();
    btcToJpy = data.bitcoin.jpy;
    btcToUsd = data.bitcoin.usd;

    console.log(data); //あとでけす
}

function calculateValues(inputField) {
    let btc, sats, jpy, usd;

    switch(inputField) {
        case 'btc':
            btc = document.getElementById('btc').value;
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

    document.getElementById('btc').value = btc;
    document.getElementById('sats').value = sats;
    document.getElementById('jpy').value = jpy;
    document.getElementById('usd').value = usd;
}
