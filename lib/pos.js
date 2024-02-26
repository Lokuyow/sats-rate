import { LightningAddress } from './lightning-address.js';

export class Pos {
  // 定数
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
  #qrCode;

  #qrWrapper = window.document.getElementById('lightning-pos-qr-box');
  #satsInput = window.document.getElementById('sats');
  #messageArea = window.document.getElementById('pos-message');
  #otherUnits = ['btc', 'jpy', 'usd', 'eur'] 

  // 制御用フラグ
  #isRequesting = false;

  initialize() {
    console.info('Pos: initialize POS')

    // ローカルストレージからアドレスを取得
    this.#lnAddress = new LightningAddress(window.localStorage.getItem(this.localStorageKey) ?? '');

    // 値が変更されたら請求書は削除する
    this.#handleInputChange();
  }

  setLnAddress(form) {
    console.info('Pos: setting lnAddress');

    const formData = new FormData(form);

    this.#lnAddress = new LightningAddress(formData.get('lightning-address') ?? '');

    if(!this.#lnAddress.hasValidAddress) {
      console.warn(`Pos: invalid address: ${formData.get('lightning-address')}`);

      return;
    }

    window.localStorage.setItem(this.localStorageKey, this.#lnAddress.toString());
    console.info(`Pos: set lnAddress: ${this.#lnAddress}`);
  }

  getCurrntSatsAmount() {
    const satsAmount = this.#satsInput.value.replaceAll(',', '');

    return satsAmount || null;
  }

  // 支払いボタン押下時
  async generateInvoice() {
    if(this.#isRequesting) {
      return;
    }

    this.#isRequesting = true;

    if(!this.#lnAddress.hasValidAddress()) {
      return;
    }

    const amount = this.getCurrntSatsAmount();
    if(!amount) {
     return;
    }

    this.#clearQrCode();

    try {
      await this.#lnAddress.fetchAddressData();
      const invoice = await this.#lnAddress.getInvoice(amount * 1000);    
      this.#updateQrCode(invoice.pr);
    } catch (error) {
      this.#setMessage(error.message ?? JSON.stringify(error));
    } finally {
      this.#isRequesting = false;
    }
  }

  clearLnAddress() {
    console.info(`Pos: clear lnAddress`);
    this.#lnAddress = new LightningAddress('');
    window.localStorage.clear(this.localStorageKey);
    this.#clearQrCode();
  }

  #clearQrCode() {
    this.#qrWrapper.innerHTML = '';
  }

  #showQrCode(data) {
    this.#qrCode = new QRCodeStyling(this.#getQrCodeConfig(data))
    this.#qrCode.append(this.#qrWrapper);
  }

  #updateQrCode(data) {
    this.#qrCode.update(this.#getQrCodeConfig(data));
  }

  #handleInputChange() {
    let inputs = this.#otherUnits.map(u => window.document.getElementById(u))
    inputs = [ ...inputs, this.#satsInput ];

    // どの通貨が変更された場合もQRコードをクリアする
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        this.#clearQrCode();
      });
    });
  }

  // エラーメッセージなどを表示する
  #setMessage(message) {
    this.#messageArea.innerHTML = '';
    const p = document.createElement('p')
    p.innerText = message;
    
    this.#messageArea.appendChild(p)
  }
}

