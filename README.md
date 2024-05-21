# おいくらサッツ
サッツ（Sats, Sat, Satoshi）、ビットコイン（bitcoin, BTC）、日本円（JPY）、米ドル（USD）など複数通貨間の相互換算ができるツールです。
## URLクエリパラメータ

- 「SNSに計算結果を共有」からクエリ付きのURLをコピーできます。

- [利用できる通貨一覧 [abbreviation:]](./lib/currencies.json)

### デフォルト入力値のクエリ
通貨名と数値を付けることで任意の通貨とその入力値がセットされた状態でサイトにアクセスできます。
```
https://osats.money/?{通貨名=数値}
```
例：https://osats.money/?jpy=3264

### 表示通貨のクエリ

通貨名を付けることで任意の通貨がセットされた状態でサイトにアクセスできます。

```
https://osats.money/?currencies={通貨名,通貨名,通貨名,…}
```

例：https://osats.money/?currencies=sats,eth,jpy,usd


### 小数点記号のクエリ（省略可）
デフォルト入力値のクエリの記法を判断するためのクエリです。ピリオド「.」が小数点記号、カンマ「,」が桁区切り記号、もしくはその逆の記法か判断します。

クエリ付きURLを生成する際にブラウザの設定から判断し付加され、アクセスしたときにブラウザの設定に合わせて解釈します。
```
https://osats.money/?{デフォルト入力値のクエリ}&{小数点記号のクエリ}
```
例：https://osats.money/?usd=1.234,56&d=c

- d=p　小数点（decimal point）はピリオド「.」（period）
- d=c　小数点（decimal point）はカンマ「,」（comma）
- このクエリを省略した場合、　小数点はピリオド

## 価格レート取得先
[CoinGecko](https://www.coingecko.com/ja)

※ 対ビットコインレートのみ取得しています。ビットコインが関与しない通貨ペアのレートはビットコインとのペアを組み合わせて間接的に算出しています。直接の市場レートとは誤差があります。

例：
- USDJPY = BTCUSD, BTCJPY
- ETHUSD = BTCETH, BTCUSD 

## ライセンスおよび著作権
このリポジトリは以下のライセンスおよび著作権に基づいています。

 [MIT License](./LICENSE). Copyright (c) 2023 Lokuyow.

以下のファイルについては個別の著作権宣言が適用されます：

- `./lib/nostr-zap@0.21.0.js`
  - MIT License
  - Copyright (c) 2023 Sam Samskies.
  - https://github.com/SamSamskies/nostr-zap/blob/main/LICENSE
- `./lib/qr-code-styling@1.6.0-rc.1.js`
  - MIT License
  - Copyright (c) 2019 Denys Kozak.
  - https://github.com/kozakdenys/qr-code-styling/blob/master/LICENSE 
- その他の例外的な著作権宣言については個別にファイルを参照してください。

### ライセンスの例外
以下のファイルはこのリポジトリのライセンスから除外され、特別なライセンスまたは著作権宣言が適用されます：

- `./images/bitcoin-zukan.png`
  - © 2024 知っとこ！ビットコイン図鑑
  - https://bitcoin-zukan.com
  - > Any use or reproducion of illustrations are prrohibited.
- `./images/fulgur-favicon.ico`
  - Copyright © フルグル合同会社 All Rights Reserved.
  - https://lostinbitcoin.jp/copyright
- `./images/alby_icon_head_yellow_48x48.svg`
  - Copyright (c) Alby
  - https://github.com/getAlby/media
- `./images/btcmap-logo.svg`
  - Copyright © 2022-2024 BTC Map
  - https://btcmap.org/media
- `./images/robosats-favicon.ico`
  - © 2023 RoboSats.
  - https://github.com/RoboSats/robosats/blob/main/LICENSE
- `./images/mempool-favicon.ico`
  - Copyright (c) 2019-2023 Mempool Space K.K.
  - https://mempool.space/trademark-policy