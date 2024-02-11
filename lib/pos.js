export class Pos {
  _lnAddress = '';

  localStorageKey = 'POS:LnAddress';

  initialize() {
    console.info('Pos: initialize POS')
    this._lnAddress = window.localStorage.getItem(this.localStorageKey) ?? '';

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

