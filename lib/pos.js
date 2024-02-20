import { LightningAddress } from './lightning-address.js';

export class Pos {
  // 定数
  localStorageKey = 'POS:LnAddress';

  // LightningAddressクラスのインスタンス
  #lnAddress;

  #qrWrapper = window.document.getElementById('lightning-pos-qr-box');
  #satsInput = window.document.getElementById('sats');
  #otherUnits = ['btc', 'jpy', 'usd', 'eur'] 

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
    console.info(`Pos: getCurrntSatsAmount: ${satsAmount}`);

    return satsAmount || null;
  }

  // 支払いボタン押下時
  async generateInvoice() {
    this.#clearQrCode();
    if(!this.#lnAddress.hasValidAddress()) {
      return;
    }

    const amount = this.getCurrntSatsAmount();
    if(!amount) {
     return;
    }

    // this.#showQrCode(`lightning://${this.#lnAddress.toString()}`);

    await this.#lnAddress.fetchAddressData();

    // TODO: エラーハンドリングする
    const invoice = await this.#lnAddress.getInvoice(amount * 1000);
    console.log(invoice);
    
    this.#clearQrCode();
    this.#showQrCode(invoice.pr);
  }

  clearLnAddress() {
    console.info(`Pos: clear lnAddress`);
    this.#lnAddress = new LightningAddress('');
    window.localStorage.clear(this.localStorageKey);
  }

  #clearQrCode() {
    console.log('Pos: #clearQrCode ')
    this.#qrWrapper.innerHTML = '';
  }

  #showQrCode(data) {
    const qrCode = new QRCodeStyling({
      width: 320,
      height: 320,
      type: 'svg',
      data,
      image: './images/icon_x192.png',
      margin: 8,
      dotsOptions: {
          color: '#4D4D4D',
          type: 'rounded'
      },
      backgroundOptions: {
          color: '#e9ebee',
      },
      imageOptions: {
          crossOrigin: 'anonymous',
          margin: 8
      }
    })
    qrCode.append(this.#qrWrapper);
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
}

