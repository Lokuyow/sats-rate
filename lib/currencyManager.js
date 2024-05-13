export class CurrencyManager {
    constructor() {
        if (CurrencyManager.instance) {
            return CurrencyManager.instance;
        }

        this.currencies = [];
        this.currencySymbols = {};
        this.currencyRates = {};
        this.selectedCurrencies = [];
        this.onRatesUpdate = null;
        this.onCurrenciesUpdate = null;

        CurrencyManager.instance = this;
    }

    async loadCurrencies() {
        try {
            const response = await fetch('./lib/currencies.json');
            const data = await response.json();
            this.currencies = data.map(item => item.abbreviation);
            this.currencySymbols = data.reduce((acc, item) => {
                acc[item.abbreviation] = item.symbol;
                return acc;
            }, {});
        } catch (error) {
            console.error('Failed to load currency data:', error);
        }
    }

    setRatesUpdateCallback(callback) {
        this.onRatesUpdate = callback;
    }

    setCurrenciesUpdateCallback(callback) {
        this.onCurrenciesUpdate = callback;
    }

    async fetchCurrencyData(selectedCurrencies) {
        const storedData = JSON.parse(localStorage.getItem("currencyRatesLS"));
        const filteredCurrencies = selectedCurrencies.filter(currency => currency !== 'sats' && currency !== 'btc');
        const needFetchAPI = this.doesNeedFetchAPI(storedData, filteredCurrencies);

        if (needFetchAPI) {
            try {
                const currencyData = await this.fetchDataFromAPI(filteredCurrencies);
                this.updateCurrencyRates(currencyData);
                localStorage.setItem("currencyRatesLS", JSON.stringify(currencyData));
            } catch (error) {
                console.error('Error fetching currency data:', error);
                this.handleFetchError(storedData);
            }
        } else {
            console.log("Local storage data is up-to-date. Skipping API request.");
            this.updateCurrencyRates(storedData);
        }
    }

    doesNeedFetchAPI(storedData, filteredCurrencies) {
        if (!storedData) {
            return true;
        }
        const lastUpdatedAt = storedData.last_updated_at;
        const storedCurrencies = Object.keys(storedData).filter(key => key !== 'last_updated_at');
        return filteredCurrencies.some(currency => !storedCurrencies.includes(currency)) || this.isDataOutdated(lastUpdatedAt);
    }

    async fetchDataFromAPI(filteredCurrencies) {
        const currenciesParam = filteredCurrencies.map(c => c.toLowerCase()).join(',');
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${currenciesParam}&include_last_updated_at=true&precision=full`;
        const response = await fetch(url);
        console.log("API_URL", url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.bitcoin || {};
    }

    updateCurrencyRates(currencyData) {
        this.currencyRates = currencyData;
        this.onRatesUpdate?.(this.currencyRates);
    }

    handleFetchError(storedData) {
        if (storedData) {
            this.updateCurrencyRates(storedData);
            alert("最新価格レートの取得に失敗しました。過去のデータを表示しています。");
            console.log(this.currencyRates);
        } else {
            alert("価格レートの取得に失敗しました。時間をおいてリロードをして下さい。");
        }
    }

    isDataOutdated(lastUpdatedAt) {
        const lastUpdatedTimestamp = lastUpdatedAt;
        const currentTime = Math.floor(Date.now() / 1000);
        return currentTime - lastUpdatedTimestamp > 610;
    }

    updateCurrencyInputs(selectedCurrencies) {
        const container = document.querySelector('.currency-inputs-container');
        container.innerHTML = '';
        selectedCurrencies.forEach(currency => {
            container.appendChild(this.createCurrencyInputField(currency));
        });
        const rows = selectedCurrencies.length;
        container.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    }

    createCurrencyInputField(currency) {
        const currencySymbol = this.currencySymbols[currency];

        // コピーボタン
        const copyButton = document.createElement('button');
        copyButton.className = 'currency-icons normal-btn';
        copyButton.id = `copy-${currency}`;
        copyButton.dataset.currency = currency;
        const currencyDisplay = currency === 'sats' ? 'sats' : currency.toUpperCase();
        copyButton.setAttribute('aria-label', `${currencyDisplay}の数値をコピー`);

        // 通貨シンボルを表示するための span 要素
        const symbolSpan = document.createElement('span');
        symbolSpan.className = 'currency-icon-span';

        if (currency === 'btc' || currency === 'sats') {
            // SVGを使用する場合
            const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgElement.setAttribute('width', '21px');
            svgElement.setAttribute('height', '21px');

            const useElement = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            useElement.setAttributeNS('http://www.w3.org/1999/xlink', 'href', './images/bitcoin-icon.svg#icon');  // アイコンのIDを指定
            useElement.setAttribute('class', 'bitcoin-icon');

            svgElement.appendChild(useElement);
            symbolSpan.appendChild(svgElement); // SVGをspan内に追加
        } else {
            // 通貨シンボルを直接spanに設定
            symbolSpan.textContent = currencySymbol;
        }

        copyButton.appendChild(symbolSpan); // ボタンにspanを追加


        // 通貨シンボルの長さに応じてスタイルを調整
        switch (currencySymbol.length) {
            case 2:
                copyButton.style.fontWeight = "500";
                copyButton.style.fontSize = '1.2rem';
                copyButton.style.letterSpacing = '-1px';
                break;
            case 3:
                copyButton.style.fontWeight = "700";
                copyButton.style.fontSize = '0.9rem';
                copyButton.style.letterSpacing = '-1px';
                break;
            case 4:
                copyButton.style.fontWeight = "700";
                copyButton.style.fontSize = '0.82rem';
                copyButton.style.letterSpacing = '-1px';
            default:
                break;
        }

        // 入力フィールド
        const input = document.createElement('input');
        input.className = 'currency-input';
        if (currency === 'sats') {
            input.classList.add('currency-input-sats');
        } else if (currency === 'btc') {
            input.classList.add('currency-input-btc');
        } else {
            input.classList.add('currency-input-other');
        }
        input.type = 'text';
        input.id = currency;
        input.setAttribute('aria-label', `${currencyDisplay}の金額`);
        input.setAttribute('oninput', `window.satsRate.calculateValues('${currency}')`);
        input.inputMode = 'decimal';

        // ペーストボタン
        const pasteButton = document.createElement('button');
        pasteButton.className = 'currency-units normal-btn';
        pasteButton.id = `paste-${currency}`;
        pasteButton.dataset.currency = currency;
        pasteButton.setAttribute('aria-label', `${currencyDisplay}の数値をペースト`);
        pasteButton.textContent = currencyDisplay;

        // 要素をフラグメントに追加
        const fragment = document.createDocumentFragment();
        fragment.appendChild(copyButton);
        fragment.appendChild(input);
        fragment.appendChild(pasteButton);

        return fragment;
    }
}

export const currencyManager = new CurrencyManager();