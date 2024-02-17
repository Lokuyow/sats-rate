// ライトニングアドレスの正規表現（メールの正規表現を流用）
const addressRegExp = /^[A-Za-z0-9]{1}[A-Za-z0-9_.-]*@{1}[A-Za-z0-9_.-]{1,}\.[A-Za-z0-9]{1,}$/

export class LightningAddress {
  addressView = document.getElementById('lightning-address-output');
  addressInput = window.document.getElementById('lightning-address-input');

  #domain = '';
  #userName = '';
  #LightningAddressStr = '';

  data = {};

  constructor(lightningAddressString) {
    this.#LightningAddressStr = addressRegExp.test(lightningAddressString) ? lightningAddressString : '';
    const [userName, domain] = this.#LightningAddressStr.split('@');
    this.#domain = domain;
    this.#userName = userName;

    this.#updateView()
  }

  async fetchAddressData() {
    if(!this.#domain || !this.#userName) {
      return;
    }

    this.data = await fetch(`https://${this.#domain}/.well-known/lnurlp/${this.#userName}`).then(async (res) => {
      return res.json();
    })

    console.info(this.data); // Debug;
    return this.data;
  }

  /**
   * 入力値の数量でインボイスを生成する
   * @param {number} amount ミリサトシ
   * @returns void
   */
  async getInvoice(amount) {
    if(!this.data || this.data.tag !== 'payRequest' || !this.data.callback) {
      return;
    }

    if(this.data.status === 'ERROR') {
      // TODO: 仕様上this.data.reasonが存在するはずなのでエラー理由をスローする
      
      return;
    }

    // 数量のバリデーション
    if( amount > this.data.maxSendable && amount < (this.data.minSendable ?? 0)) {
      return;
    }

    const callbackUrl = new URL(this.data.callback)
    callbackUrl.searchParams.append('amount', amount);

    return fetch(callbackUrl).then(async (res) => {
      return res.json();
    });
  }

  toString() {
    return this.#LightningAddressStr;
  }

  hasValidAddress() {
    return !!this.#LightningAddressStr;
  }

  #updateView() {
    this.addressView.value = this.#LightningAddressStr || 'ライトニングアドレス未設定'
    this.addressInput.value = this.#LightningAddressStr || '';
  }
}