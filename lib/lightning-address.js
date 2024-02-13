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

    fetch(`https://${this.#domain}/.well-known/lnurlp/${this.#userName}`).then(async (res) => {
      this.data = await res.json();

      console.log(this.data);
    });
  }
}