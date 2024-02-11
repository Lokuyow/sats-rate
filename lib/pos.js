export class Pos {
  _lnAddress = '';

  localStorageKey = 'POS:LnAddress';

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
}

