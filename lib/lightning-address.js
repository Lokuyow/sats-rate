export class LightningAddress {
  #domain = '';
  #userName = '';

  data = {};

  constructor(lightningAddressString) {
    const [userName, domain] = lightningAddressString.split('@');
    this.#domain = domain;
    this.#userName = userName;
  }

  async fetchAddressData() {
    if(!this.#domain || !this.#userName) {
      return;
    }

    this.data = await fetch(`https://${this.#domain}/.well-known/lnurlp/${this.#userName}`).then(async (res) => {
      return res.json();
    })

    console.info(this.data);
  }

  /**
   * 入力値の数量でインボイスを生成する
   * @param {number} amount ミリサトシ
   * @returns void
   */
  async getInvoice(amount) {
    if(!this.data || this.data.status !== 'OK' || this.data.tag !== 'payRequest' || !this.data.callback) {
      return;
    }

    // 数量のバリデーション
    if( amount > this.data.maxSendable && amount < (this.data.minSendable ?? 0)) {
      return;
    }

    const callbackUrl = new URL(this.data.callback)
    callbackUrl.searchParams.append('amount', amount);

    const invoice = await fetch(callbackUrl).then(async (res) => {
      return res.json();
    })

    return invoice;
  }
}