export class LightningAddress {
  #domain = '';
  #userName = '';

  data = {};
  invoice = {};

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

    this.invoice = await fetch(callbackUrl).then(async (res) => {
      return res.json;
    })

    console.info(this.invoice);
  }
}