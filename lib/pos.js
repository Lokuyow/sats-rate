import { LightningAddress } from './lightning-address.js';

/**
 * POS機能
 * ライトニングアドレスを保管して入力された金額のインボイスのQRコードの表示を行う。
 * またインプットの値とインボイスの値が乖離することを避けるため入力値を監視し変更された場合は直ちに破棄する。
 */
export class Pos {
  localStorageKey = 'POS:LnAddress';
  #getQrCodeConfig(data) {
    return {
      width: 340,
      height: 340,
      type: 'svg',
      data,
      image: './images/icon_x192.png',
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
  #satsInput = window.document.getElementById('sats');
  #messageArea = window.document.getElementById('pos-message');
  #otherUnits = ['btc', 'jpy', 'usd', 'eur']
  #posPayButton = window.document.getElementById('pos-pay-button');

  // 連打による連続的なリクエストを制限するためのフラグ
  #isRequesting = false;

  initialize() {
    // ローカルストレージからアドレスを取得
    this.#lnAddress = new LightningAddress(window.localStorage.getItem(this.localStorageKey) ?? '');

    this.#updatePosPayButton();

    // 値が変更されたら請求書QRコードは削除しなければいけないため入力値を監視する
    this.#handleInputChange();
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

  getCurrntSatsAmount() {
    const satsAmount = this.#satsInput.value.replaceAll(',', '');

    return satsAmount || null;
  }

  // 支払いボタン押下時
  async generateInvoice() {
    if (this.#isRequesting) {
      return;
    }

    this.#isRequesting = true;

    if (!this.#lnAddress.hasValidAddress()) {
      return;
    }

    const amount = this.getCurrntSatsAmount();
    if (!amount) {
      return;
    }

    this.#clearQrCode();

    try {
      await this.#lnAddress.fetchAddressData();
      const invoice = await this.#lnAddress.getInvoice(amount * 1000);
      this.#showQrCode(invoice.pr);
    } catch (error) {
      this.#setMessage(error.message ?? JSON.stringify(error));
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

  #clearQrCode() {
    this.#qrWrapper.innerHTML = '';
  }

  #showQrCode(data) {
    const qrCode = new QRCodeStyling(this.#getQrCodeConfig(data))
    qrCode.append(this.#qrWrapper);
  }

  // どの通貨が変更された場合もQRコードをクリアする
  #handleInputChange() {
    let inputs = this.#otherUnits.map(u => window.document.getElementById(u))
    inputs = [...inputs, this.#satsInput];

    inputs.forEach(input => {
      input.addEventListener('input', () => {
        this.#clearQrCode();
      });
    });
  }

  // エラーメッセージなどを表示する
  #setMessage(message) {
    this.#messageArea.innerHTML = '';
    const p = window.document.createElement('p')
    p.innerText = message;

    this.#messageArea.appendChild(p)
  }

  // 請求書を表示のボタンの状態を切り替える
  #updatePosPayButton() {
    this.#posPayButton.disabled = !this.#lnAddress || !this.#lnAddress.hasValidAddress();
  }
}

