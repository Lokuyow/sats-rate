export class CurrencyManager {
  constructor() {
    if (CurrencyManager.instance) {
      return CurrencyManager.instance;
    }

    this.currencies = [];
    this.currencySymbols = {};
    this.currencyRates = {};
    this.onRatesUpdate = null;

    CurrencyManager.instance = this;
  }

  async loadCurrencies() {
    try {
      const response = await fetch("./assets/data/currencies.json");
      const data = await response.json();
      this.currencies = data.map((item) => item.abbreviation);
      this.currencySymbols = data.reduce((acc, item) => {
        acc[item.abbreviation] = item.symbol;
        return acc;
      }, {});
    } catch (error) {
      console.error("Failed to load currency data:", error);
    }
  }

  setRatesUpdateCallback(callback) {
    this.onRatesUpdate = callback;
  }

  async fetchCurrencyData(selectedCurrencies) {
    const storedData = JSON.parse(localStorage.getItem("currencyRatesLS"));
    const filteredCurrencies = selectedCurrencies.filter((currency) => currency !== "sats" && currency !== "btc");
    const needFetchAPI = this.doesNeedFetchAPI(storedData, filteredCurrencies);

    if (needFetchAPI) {
      try {
        const currencyData = await this.fetchDataFromAPI(filteredCurrencies);
        this.updateCurrencyRates(currencyData);
        localStorage.setItem("currencyRatesLS", JSON.stringify(currencyData));
      } catch (error) {
        console.error("Error fetching currency data:", error);
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
    const storedCurrencies = Object.keys(storedData).filter((key) => key !== "last_updated_at");
    return filteredCurrencies.some((currency) => !storedCurrencies.includes(currency)) || this.isDataOutdated(lastUpdatedAt);
  }

  async fetchDataFromAPI(filteredCurrencies) {
    const currenciesParam = filteredCurrencies.map((c) => c.toLowerCase()).join(",");
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

      const message = window.vanilla_i18n_instance.translate("alerts.fetchErrorWithData");
      console.log(message);
      console.log(this.currencyRates);
    } else {
      const message = window.vanilla_i18n_instance.translate("alerts.fetchErrorNoData");
      alert(message);
    }
  }

  isDataOutdated(lastUpdatedAt) {
    const lastUpdatedTimestamp = lastUpdatedAt;
    const currentTime = Math.floor(Date.now() / 1000);
    return currentTime - lastUpdatedTimestamp > 610;
  }

  updateCurrencyInputs(selectedCurrencies) {
    const container = document.querySelector(".currency-inputs-container");
    container.innerHTML = "";
    selectedCurrencies.forEach((currency) => {
      container.appendChild(this.createCurrencyInputField(currency));
    });
    const rows = selectedCurrencies.length;
    container.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  }

  createCurrencyInputField(currency) {
    const currencySymbol = this.currencySymbols[currency];

    // 左側のボタン（ペースト）
    const leftButton = document.createElement("button");
    leftButton.className = "currency-icons normal-btn";
    leftButton.id = `paste-${currency}`;
    leftButton.dataset.currency = currency;
    const currencyDisplay = currency === "sats" ? "sats" : currency.toUpperCase();
    leftButton.setAttribute("aria-label", `Paste the value of ${currencyDisplay}`);

    // 通貨シンボルを表示するための span 要素
    const symbolSpan = document.createElement("span");
    symbolSpan.className = "currency-icon-span";

    if (currency === "btc" || currency === "sats") {
      const bitcoinIconDiv = document.createElement("div");
      bitcoinIconDiv.className = "bitcoin-icon";
      symbolSpan.appendChild(bitcoinIconDiv);
    } else {
      symbolSpan.textContent = currencySymbol;
    }

    leftButton.appendChild(symbolSpan);

    // スタイル調整
    switch (currencySymbol.length) {
      case 2:
        leftButton.style.fontWeight = "500";
        leftButton.style.fontSize = "1.2rem";
        leftButton.style.letterSpacing = "-1px";
        break;
      case 3:
        leftButton.style.fontWeight = "700";
        leftButton.style.fontSize = "0.9rem";
        leftButton.style.letterSpacing = "-1px";
        break;
      case 4:
        leftButton.style.fontWeight = "700";
        leftButton.style.fontSize = "0.82rem";
        leftButton.style.letterSpacing = "-1px";
      default:
        break;
    }

    // 入力フィールド
    const input = document.createElement("input");
    input.className = "currency-input";
    if (currency === "sats") {
      input.classList.add("currency-input-sats");
    } else if (currency === "btc") {
      input.classList.add("currency-input-btc");
    } else {
      input.classList.add("currency-input-other");
    }
    input.type = "text";
    input.id = currency;
    input.setAttribute("aria-label", `Amount of ${currencyDisplay}`);
    input.setAttribute("oninput", `window.satsRate.calculateValues('${currency}')`);
    input.inputMode = "decimal";

    // 右側のボタン（コピー）
    const rightButton = document.createElement("button");
    rightButton.className = "currency-units dark-btn";
    rightButton.id = `copy-${currency}`;
    rightButton.dataset.currency = currency;
    rightButton.setAttribute("aria-label", `Copy the value of ${currencyDisplay}`);
    rightButton.textContent = currencyDisplay;

    // 要素をフラグメントに追加
    const fragment = document.createDocumentFragment();
    fragment.appendChild(leftButton);
    fragment.appendChild(input);
    fragment.appendChild(rightButton);

    return fragment;
  }
}

export const currencyManager = new CurrencyManager();
