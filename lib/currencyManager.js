import { prepareAndCalculate, setDefaultValues, checkAndUpdateElements, setupEventListenersForCurrencyButtons, setBaseCurrencyValue, getBaseCurrencyValue } from '../main.js';
export class CurrencyManager {
    constructor() {
        this.currencies = [];
        this.currencySymbols = {};
        this.currencyRates = {};
        this.selectedCurrencies = [];
        this.onRatesUpdate = null;
        this.onCurrenciesUpdate = null;
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

    generateCurrencyCheckboxes() {
        const container = document.getElementById('currency-container');
        container.innerHTML = '';
        this.currencies.forEach(currency => {
            const label = document.createElement('label');
            label.style.marginRight = '4px';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = currency;
            checkbox.name = 'currency';

            label.appendChild(checkbox);

            const displayText = currency === 'sats' ? 'sats' : currency.toUpperCase();
            label.appendChild(document.createTextNode(displayText));

            container.appendChild(label);
        });
    }

    async saveSelectedCurrencies() {
        let selectedCurrencies = Array.from(document.querySelectorAll('input[name="currency"]:checked')).map(el => el.value);
        await this.fetchCurrencyData(selectedCurrencies);
        this.selectedCurrencies = selectedCurrencies;
        localStorage.setItem('selectedCurrenciesLS', JSON.stringify(selectedCurrencies));
        this.updateCurrencyInputs(selectedCurrencies);
        if (this.onCurrenciesUpdate) {
            this.onCurrenciesUpdate(this.selectedCurrencies);
        }

        // 更新関数とイベントリスナー設定
        checkAndUpdateElements();
        setupEventListenersForCurrencyButtons();

        // デフォルト値の設定と計算の準備
        setDefaultValues();
        prepareAndCalculate(getBaseCurrencyValue());

        // URLからクエリパラメータを削除
        const url = new URL(window.location.href);
        const cleanUrl = url.origin + url.pathname;
        window.history.pushState({ path: cleanUrl }, '', cleanUrl);
    }

    updateCheckboxStates(selectedCurrencies) {
        const checkboxes = document.querySelectorAll('input[name="currency"]');
        checkboxes.forEach(checkbox => {
            if (selectedCurrencies.includes(checkbox.value)) {
                checkbox.checked = true;
            }
        });
    }

    async fetchCurrencyData(selectedCurrencies) {
        const filteredCurrencies = selectedCurrencies.filter(currency => currency !== 'sats' && currency !== 'btc');
        const currenciesParam = filteredCurrencies.map(c => c.toLowerCase()).join(',');
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${currenciesParam}&include_last_updated_at=true&precision=full`;

        try {
            const response = await fetch(url);
            console.log("API_URL", url);
            const data = await response.json();
            const currencyData = data.bitcoin || {};

            // インスタンスのcurrencyRatesを更新
            this.currencyRates = currencyData;

            if (this.onRatesUpdate) {
                this.onRatesUpdate(this.currencyRates);
            }

            localStorage.setItem("currencyRatesLS", JSON.stringify(currencyData));

        } catch (error) {
            console.error('Error fetching currency data:', error);

            // ローカルストレージから価格データを取得
            const storedData = localStorage.getItem("currencyRatesLS");
            if (storedData) {
                this.currencyRates = JSON.parse(storedData);
                alert("最新価格レートの取得に失敗しました。過去のデータを表示しています。");
                console.log(this.currencyRates);
            } else {
                alert("価格レートの取得に失敗しました。時間をおいてリロードをして下さい。");
            }
        }
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
                copyButton.style.fontFamily = "'MPLUSRounded1c-Medium', 'Roboto', Arial, 'Noto Sans', sans-serif";
                copyButton.style.fontSize = '1.2rem';
                copyButton.style.letterSpacing = '-1px';
                break;
            case 3:
                copyButton.style.fontFamily = "'MPLUSRounded1c-Bold', 'Roboto', Arial, 'Noto Sans', sans-serif";
                copyButton.style.fontSize = '0.9rem';
                copyButton.style.letterSpacing = '-1px';
                break;
            case 4:
                copyButton.style.fontFamily = "'MPLUSRounded1c-Bold', 'Roboto', Arial, 'Noto Sans', sans-serif";
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
        pasteButton.className = 'currency-units reverse-btn';
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