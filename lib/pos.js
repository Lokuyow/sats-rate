import { LightningAddress } from "./lightning-address.js";

export class Pos {
  // 定数
  localStorageKey = 'POS:LnAddress';

  _lnAddress = '';


  initialize() {
    console.info('Pos: initialize POS')

    // ローカルストレージからアドレスを取得
    this._lnAddress = window.localStorage.getItem(this.localStorageKey) ?? '';

    // ローカルストレージのアドレスをインプットに設定
    const addressInput = window.document.getElementById('lightning-address-input');
    addressInput.value = this._lnAddress;
  }

  getLnAddress() {
    console.info('Pos: get lnAddress')
    return this._lnAddress;
  }

  setLnAddress(form) {
    console.info('Pos: setting lnAddress');

    const formData = new FormData(form);    
    this._lnAddress = formData.get('lightning-address');
    window.localStorage.setItem(this.localStorageKey, this._lnAddress);
    console.debug(`Pos: set lnAddress: ${this._lnAddress}`);
  }

  getCurrntSatsAmount() {
    const satsInput = window.document.getElementById('sats');
    console.info(`Pos: getCurrntSatsAmount: ${satsInput.value}`);

    return satsInput.value || null;
  }

  // 支払いボタン押下時
  async pay() {
    if(!this._lnAddress) {
      return;
    }

    const amount = this.getCurrntSatsAmount();
    if(!amount) {
     return;
    }

    this.#showQrCode(`lightning://${this._lnAddress}`);

    const lightningAddress = new LightningAddress(this._lnAddress);
    await lightningAddress.fetchAddressData();

    const invoice = await lightningAddress.getInvoice(amount * 1000);

    console.log(invoice);
    // TODO: エラーハンドリングする
    this.#showQrCode(invoice.pr);
  }

  #showQrCode(data) {
    const qrWrapper = window.document.getElementById('lightning-pos-qr-box');
    qrWrapper.innerHTML = '';
    const img = document.createElement('img');
    img.width = 300;
    img.height = 300;
 
    // FIXME: QRの作成に外部APIを使用するのは危険なので本番で使用するな
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${data}`
    qrWrapper.appendChild(img);
  }
}

