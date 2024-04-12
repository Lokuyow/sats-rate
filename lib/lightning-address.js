// ライトニングアドレスの正規表現（メールの正規表現を流用）
const addressRegExp = /^[A-Za-z0-9]{1}[A-Za-z0-9_.-]*@{1}[A-Za-z0-9_.-]{1,}\.[A-Za-z0-9]{1,}$/

export class LightningAddress {
  addressView = window.document.getElementById('lightning-address-output');
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

    // Document: https://github.com/lnurl/luds/blob/luds/16.md
    this.data = await fetch(`https://${this.#domain}/.well-known/lnurlp/${this.#userName}`).then(async (res) => {
      if (!res.ok) {
        throw new Error('Error: cannot fetch Address Data.');
      }
      return res.json();
    })

    if(!this.data || this.data.tag !== 'payRequest' || !this.data.callback) {
      throw new Error('支払い可能なライトニングアドレスではないようです')
    }

    if(this.data.status === 'ERROR') {
      // 仕様上this.data.reasonが存在するはずなのでエラー理由をスローする
      // https://github.com/lnurl/luds/blob/luds/06.md
      if(this.data.reason) {
        throw new Error(this.data.reason)
      } else {
        throw new Error(`Invalid lnurlp response: ${JSON.stringify(this.data)}`)
      }
    }
  }

  /**
   * 入力値の数量でインボイスを生成する
   * @param {number} amount ミリサトシ
   * @returns void
   */
  async getInvoice(amount) {
    if(!this.data || this.data.tag !== 'payRequest' || !this.data.callback) {
      throw new Error('支払い可能なライトニングアドレスではないようです')
    }

    // 数量のバリデーション
    if( amount > this.data.maxSendable || amount < (this.data.minSendable ?? 0)) {
      throw new Error(`Invalid amount. Make sure the amount is within the range. 数量は${this.data.minSendable/1000}sats~${this.data.maxSendable/1000}satsの間である必要があります`)
    }

    const callbackUrl = new URL(this.data.callback)
    callbackUrl.searchParams.append('amount', amount);

    const invoice = await fetch(callbackUrl).then(async (res) => {
      if (!res.ok) {
        throw new Error('Error: cannot get invoice.');
      }
      return res.json()
    });

    if(invoice.status === 'ERROR') {
      // 仕様上this.data.reasonが存在するはずなのでエラー理由をスローする
      // https://github.com/lnurl/luds/blob/luds/06.md
      if(invoice.reason) {
        throw new Error(invoice.reason)
      } else {
        throw new Error(`Invalid callback response: ${JSON.stringify(invoice)}`)
      }
    }

    return invoice;
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