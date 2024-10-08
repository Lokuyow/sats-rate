// ライトニングアドレスの正規表現（メールの正規表現を流用）
const addressRegExp = /^[A-Za-z0-9]{1}[A-Za-z0-9_.-]*@{1}[A-Za-z0-9_.-]{1,}\.[A-Za-z0-9]{1,}$/;

export class LightningAddress {
  addressView = window.document.getElementById("lightning-address-output");
  addressInput = window.document.getElementById("lightning-address-input");

  #domain = "";
  #userName = "";
  #LightningAddressStr = "";

  data = {};

  constructor(lightningAddressString) {
    this.#LightningAddressStr = addressRegExp.test(lightningAddressString) ? lightningAddressString : "";
    const [userName, domain] = this.#LightningAddressStr.split("@");
    this.#domain = domain;
    this.#userName = userName;

    this.#updateView();

    // 言語変更イベントのリスナーを追加
    window.addEventListener("languageChange", () => {
      this.#updateView();
    });
  }

  async fetchAddressData() {
    if (!this.#domain || !this.#userName) {
      return;
    }

    // Document: https://github.com/lnurl/luds/blob/luds/16.md
    this.data = await fetch(`https://${this.#domain}/.well-known/lnurlp/${this.#userName}`).then(async (res) => {
      if (!res.ok) {
        throw new Error(window.vanilla_i18n_instance.translate("lightningAddress.errors.cannotFetchData"));
      }
      return res.json();
    });

    if (!this.data || this.data.tag !== "payRequest" || !this.data.callback) {
      const message = window.vanilla_i18n_instance.translate("lightningAddress.errors.invalidAddress");
      throw new Error(message);
    }

    if (this.data.status === "ERROR") {
      // 仕様上this.data.reasonが存在するはずなのでエラー理由をスローする
      // https://github.com/lnurl/luds/blob/luds/06.md
      if (this.data.reason) {
        throw new Error(this.data.reason);
      } else {
        throw new Error(`Invalid lnurlp response: ${JSON.stringify(this.data)}`);
      }
    }
  }

  /**
   * 入力値の数量でインボイスを生成する
   * @param {number} amount ミリサトシ
   * @returns void
   */
  async getInvoice(amount) {
    if (!this.data || this.data.tag !== "payRequest" || !this.data.callback) {
      const message = window.vanilla_i18n_instance.translate("lightningAddress.errors.invalidAddress");
      throw new Error(message);
    }

    // 数量のバリデーション
    if (amount > this.data.maxSendable || amount < (this.data.minSendable ?? 0)) {
      const minSats = (this.data.minSendable ?? 0) / 1000;
      const maxSats = this.data.maxSendable / 1000;
      const message = window.vanilla_i18n_instance.translate("lightningAddress.errors.invalidAmount", {
        min: minSats,
        max: maxSats,
      });
      throw new Error(message);
    }

    const callbackUrl = new URL(this.data.callback);
    callbackUrl.searchParams.append("amount", amount);

    const invoice = await fetch(callbackUrl).then(async (res) => {
      if (!res.ok) {
        throw new Error(window.vanilla_i18n_instance.translate("lightningAddress.errors.cannotGetInvoice"));
      }
      return res.json();
    });

    if (invoice.status === "ERROR") {
      // 仕様上this.data.reasonが存在するはずなのでエラー理由をスローする
      // https://github.com/lnurl/luds/blob/luds/06.md
      if (invoice.reason) {
        throw new Error(invoice.reason);
      } else {
        throw new Error(`Invalid callback response: ${JSON.stringify(invoice)}`);
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
    const noAddressMessage = window.vanilla_i18n_instance.translate("lightningAddress.errors.noAddressSet");
    this.addressView.value = this.#LightningAddressStr || noAddressMessage;
    this.addressInput.value = this.#LightningAddressStr || "";
  }
}
