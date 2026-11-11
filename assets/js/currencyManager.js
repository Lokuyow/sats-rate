import { loadJsonFromStorage } from "./storage.js";

export class CurrencyManager {
  #inFlightFetchCurrencyData = null;

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

  // 実行中の取得があれば、その Promise をそのまま返して二重リクエストを防ぐ。
  // 呼び出し元は3か所（初期化・オンライン復帰・手動／自動更新）とも同じ
  // selectedCurrencies を渡すため、重なった呼び出しの引数が異なることはない。
  // 万一引数が異なる呼び出しが重なった場合は、先行する呼び出しが優先され、
  // 後続の呼び出し元にも先行側の結果（戻り値・例外）がそのまま返る。
  fetchCurrencyData(selectedCurrencies) {
    if (this.#inFlightFetchCurrencyData) {
      return this.#inFlightFetchCurrencyData;
    }

    const promise = this.#performFetchCurrencyData(selectedCurrencies).finally(() => {
      // 成功・失敗のどちらでもクリアし、次回の呼び出しで再取得できるようにする
      if (this.#inFlightFetchCurrencyData === promise) {
        this.#inFlightFetchCurrencyData = null;
      }
    });
    this.#inFlightFetchCurrencyData = promise;
    return promise;
  }

  async #performFetchCurrencyData(selectedCurrencies) {
    const storedData = loadJsonFromStorage("currencyRatesLS", null);
    const filteredCurrencies = selectedCurrencies.filter((currency) => currency !== "sats" && currency !== "btc");

    // sats / btc のみ表示の場合は外部レートが不要なため、APIを呼ばずに完了する
    if (filteredCurrencies.length === 0) {
      if (storedData) {
        this.updateCurrencyRates(storedData);
      } else {
        this.currencyRates = {};
      }
      return;
    }

    const needFetchAPI = this.doesNeedFetchAPI(storedData, filteredCurrencies);

    if (needFetchAPI) {
      try {
        const currencyData = await this.fetchDataFromAPI(filteredCurrencies);
        this.updateCurrencyRates(currencyData);
        localStorage.setItem("currencyRatesLS", JSON.stringify(currencyData));
        this.saveUnavailableCurrencies(filteredCurrencies, currencyData);
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
    const unavailableCurrencies = this.loadUnavailableCurrencies(lastUpdatedAt);
    const hasMissingCurrency = filteredCurrencies.some(
      (currency) => !storedCurrencies.includes(currency) && !unavailableCurrencies.includes(currency)
    );
    return hasMissingCurrency || this.isDataOutdated(lastUpdatedAt);
  }

  // API に要求してもレスポンスに含まれなかった通貨を、そのレスポンスの
  // last_updated_at と紐付けて記録する。返ってこない通貨があるせいで
  // doesNeedFetchAPI が毎回「要取得」と判定するのを防ぐため。
  saveUnavailableCurrencies(requestedCurrencies, currencyData) {
    const unavailableCurrencies = requestedCurrencies.filter((currency) => !(currency in currencyData));
    if (unavailableCurrencies.length === 0) {
      localStorage.removeItem("unavailableCurrenciesLS");
      return;
    }
    localStorage.setItem(
      "unavailableCurrenciesLS",
      JSON.stringify({
        currencies: unavailableCurrencies,
        last_updated_at: currencyData.last_updated_at,
      })
    );
  }

  loadUnavailableCurrencies(lastUpdatedAt) {
    const stored = loadJsonFromStorage("unavailableCurrenciesLS", null);
    if (!stored || stored.last_updated_at !== lastUpdatedAt || !Array.isArray(stored.currencies)) {
      return [];
    }
    return stored.currencies;
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
    let renderedRows = 0;

    selectedCurrencies.forEach((currency) => {
      const currencyInputField = this.createCurrencyInputField(currency);
      if (!currencyInputField) {
        return;
      }

      container.appendChild(currencyInputField);
      renderedRows += 1;
    });

    container.style.gridTemplateRows = `repeat(${renderedRows}, 1fr)`;
  }

  createCurrencyInputField(currency) {
    const currencySymbol = this.currencySymbols[currency];
    const hasBuiltInIcon = currency === "btc" || currency === "sats";

    if (!hasBuiltInIcon && typeof currencySymbol !== "string") {
      console.warn(`Skipping unknown currency code: ${currency}`);
      return null;
    }

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

    if (hasBuiltInIcon) {
      const bitcoinIconDiv = document.createElement("div");
      bitcoinIconDiv.className = "bitcoin-icon";
      symbolSpan.appendChild(bitcoinIconDiv);
    } else {
      symbolSpan.textContent = currencySymbol;
    }

    leftButton.appendChild(symbolSpan);

    // スタイル調整
    if (typeof currencySymbol === "string") {
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
    input.addEventListener("input", () => {
      window.satsRate?.calculateValues(currency);
    });
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
