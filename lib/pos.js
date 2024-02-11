export class Pos {
  _lnAddress = '';

  initialize() {
    // TODO: ローカルストレージからアドレスを取得
    console.info('Pos: initialize POS')
  }

  getLnAddress() {
    console.info('Pos: get lnAddress')
    return this._lnAddress;
  }

  setLnAddress(form) {
    console.info('Pos: set lnAddress');
    const formData = new FormData(form);
    console.log(formData);
    console.log(Object.fromEntries(formData));
    console.log(formData.get('lightning-address'));
    // TODO: ローカルストレージにアドレスを保管
    this._lnAddress = formData.get('lightning-address');
  }
}

