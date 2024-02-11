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

  setLnAddress(adress) {
    console.info('Pos: set lnAddress')
    console.info(adress)
    // TODO: ローカルストレージにアドレスを保管
    this._lnAddress = adress;
  }
}

