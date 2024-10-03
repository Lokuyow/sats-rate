import { formatCurrency } from '../../main.js';
import { LightningAddress } from './lightning-address.js';

/**
 * POS機能
 * ライトニングアドレスを保管して入力された金額のインボイスのQRコードの表示を行う。
 */
export class Pos {
  localStorageKey = 'POS:LnAddress';
  #getQrCodeConfig(data) {
    return {
      width: 340,
      height: 340,
      type: 'svg',
      data,
      image: './assets/images/icon.svg',
      margin: 2,
      dotsOptions: {
        color: '#4D4D4D',
        type: 'rounded'
      },
      backgroundOptions: {
        color: '#e9ebee',
      },
      imageOptions: {
        crossOrigin: 'anonymous',
        margin: 2
      }
    }
  };

  // LightningAddressクラスのインスタンス
  #lnAddress;

  #qrWrapper = window.document.getElementById('lightning-pos-qr-box');
  #messageArea = window.document.getElementById('pos-message');
  #posPayButton = window.document.getElementById('show-invoice-dialog');

  // 連打による連続的なリクエストを制限するためのフラグ
  #isRequesting = false;

  initialize() {
    // ローカルストレージからアドレスを取得
    this.#lnAddress = new LightningAddress(window.localStorage.getItem(this.localStorageKey) ?? '');

    this.#updatePosPayButton();
  }

  setLnAddress(form) {
    const formData = new FormData(form);

    this.#lnAddress = new LightningAddress(formData.get('lightning-address') ?? '');

    if (!this.#lnAddress.hasValidAddress) {
      console.warn(`Pos: invalid address: ${formData.get('lightning-address')}`);

      return;
    }

    this.#updatePosPayButton();

    window.localStorage.setItem(this.localStorageKey, this.#lnAddress.toString());
  }

  get currencyRates() {
    return window.currencyRates;
  }

  get baseCurrencyValue() {
    return window.baseCurrencyValue;
  }

  getBaseCurrency() {
    return Object.keys(this.baseCurrencyValue)[0];
  }

  getBaseCurrencyAmount() {
    const currency = this.getBaseCurrency();
    return Number(this.baseCurrencyValue[currency]);
  }

  getCurrencyRate(currency) {
    return this.currencyRates[currency];
  }

  calculateSatsValue() {
    // satsの値を直接取得できるか確認
    const satsInput = window.document.getElementById('sats');
    if (satsInput) {
      const satsAmount = parseInt(satsInput.value.replaceAll(',', ''), 10);
      return satsAmount;
    }

    // 取得できなかった場合、計算
    const currency = this.getBaseCurrency();
    const value = this.getBaseCurrencyAmount();

    if (!currency || value === undefined || value === null) {
      console.error("Missing data for calculation");
      return null;
    }

    let satsAmount;

    if (currency === 'sats') {
      satsAmount = Math.round(value);
    } else if (currency === 'btc') {
      satsAmount = Math.round(value * 1e8);
    } else {
      const rate = this.getCurrencyRate(currency);
      if (!rate) {
        console.error("Rate not found for currency:", currency);
        return null;
      }
      satsAmount = Math.round(value / (rate / 1e8));
    }

    return satsAmount || null;
  }

  async showInvoice() {
    const satsAmount = this.calculateSatsValue();
    if (satsAmount === null) {
      return;
    }

    this.#clearQrCode();
    this.#showCurrentAmounts(satsAmount);

    await this.#generateInvoice(satsAmount);
  }

  // 支払いボタン押下時
  async #generateInvoice(satsAmount) {
    if (this.#isRequesting) {
      return;
    }

    this.#isRequesting = true;

    if (!this.#lnAddress.hasValidAddress()) {
      return;
    }

    try {
      await this.#lnAddress.fetchAddressData();
      const invoice = await this.#lnAddress.getInvoice(satsAmount * 1000);
      this.#showQrCode(invoice.pr);
    } catch (error) {
      let message;

      // 翻訳されたメッセージを取得
      const translatedMessage = window.vanilla_i18n_instance.translate('pos.errors.invoiceCreationFailed');

      if (error.message) {
        message = error.message;
      } else if (typeof error === 'object') {
        message = JSON.stringify(error);
      } else {
        message = `Error: ${translatedMessage}`;
      }

      this.#setMessage(`${translatedMessage} error: ${message}`);
    } finally {
      this.#isRequesting = false;
    }
  }

  clearLnAddress() {
    this.#lnAddress = new LightningAddress('');
    this.#updatePosPayButton()
    window.localStorage.removeItem('POS:LnAddress');
    this.#clearQrCode();
  }

  #showCurrentAmounts(satsAmount) {
    const satsInput = window.document.getElementById('sats');
    let satsFormatAmount;

    if (satsInput) {
      satsFormatAmount = satsInput.value;
    } else {
      satsFormatAmount = formatCurrency(satsAmount, 'sats');
    }

    const baseCurrency = this.getBaseCurrency();
    let baseCurrencyValue = '';

    // 'sats'の場合はbaseCurrencyとbaseCurrencyValueを空欄にする
    if (baseCurrency !== 'sats') {
      baseCurrencyValue = window.document.getElementById(baseCurrency)?.value || '';
      window.document.getElementById('base-unit').innerText = baseCurrency.toUpperCase();
    } else {
      window.document.getElementById('base-unit').innerText = '';
    }

    window.document.getElementById('current-sats').innerText = satsFormatAmount;
    window.document.getElementById('current-base').innerText = baseCurrencyValue;
  }


  #clearQrCode() {
    this.#qrWrapper.innerHTML = '';
  }

  #showQrCode(data) {
    const qrCode = new QRCodeStyling(this.#getQrCodeConfig(data))
    qrCode.append(this.#qrWrapper);
  }

  // エラーメッセージなどを表示する
  #setMessage(message) {
    this.#messageArea.innerHTML = '';
    const p = window.document.createElement('p')
    p.innerText = message;

    this.#messageArea.appendChild(p)
  }

  clearMessage() {
    this.#messageArea.innerHTML = '';
  }

  // 請求書を表示のボタンの状態を切り替える
  #updatePosPayButton() {
    this.#posPayButton.disabled = !this.#lnAddress || !this.#lnAddress.hasValidAddress();
  }
}

