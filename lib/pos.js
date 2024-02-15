import { LightningAddress } from "./lightning-address.js";

export class Pos {
  // 定数
  localStorageKey = 'POS:LnAddress';

  // LightningAddressクラスのインスタンス
  #lnAddress;

  initialize() {
    console.info('Pos: initialize POS')

    // ローカルストレージからアドレスを取得
    this.#lnAddress = new LightningAddress(window.localStorage.getItem(this.localStorageKey) ?? '');
  }

  setLnAddress(form) {
    console.info('Pos: setting lnAddress');

    const formData = new FormData(form);

    this.#lnAddress = new LightningAddress(formData.get('lightning-address') ?? '');

    if(!this.#lnAddress.hasValidAddress) {
      console.warn(`Pos: invalid address: ${formData.get('lightning-address')}`);

      // TODO: フォームにライトニングアドレスの形式と違うとメッセージ出す
      return;
    }

    window.localStorage.setItem(this.localStorageKey, this.#lnAddress.toString());
    console.info(`Pos: set lnAddress: ${this.#lnAddress}`);
  }

  getCurrntSatsAmount() {
    const satsInput = window.document.getElementById('sats');
    console.info(`Pos: getCurrntSatsAmount: ${satsInput.value}`);

    return satsInput.value || null;
  }

  // 支払いボタン押下時
  async pay() {
    if(!this.#lnAddress.hasValidAddress()) {
      return;
    }

    const amount = this.getCurrntSatsAmount();
    if(!amount) {
     return;
    }

    this.#showQrCode(`lightning://${this.#lnAddress.toString()}`);

    await this.#lnAddress.fetchAddressData();

    const invoice = await this.#lnAddress.getInvoice(amount * 1000);

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

