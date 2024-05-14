# おいくらサッツ
サッツ（Sats, Sat, Satoshi）、ビットコイン（bitcoin, BTC）、日本円（JPY）、米ドル（USD）など複数通貨の相互換算ができるツールです。
## URLクエリパラメータ
### デフォルト入力値のクエリ
URLの末尾に特定の通貨と数字を付けるとそれが入力された状態でサイトにアクセスできます。

例：https://lokuyow.github.io/sats-rate/?jpy=3264
```
https://lokuyow.github.io/sats-rate/?{通貨=数字}
```
通貨
- sats
- btc
- jpy
- usd
- eur

「SNSに共有」右端のコピーボタンからクエリ付のURLをコピーできます。
### 小数点のクエリ
日本では小数点がピリオド「.」桁区切りがカンマ「,」ですが、地域によっては逆になっています。このクエリは前述のデフォルト入力値のクエリがどちらの記法で書かれたものなのかを判断するためのクエリです。（省略可）

サイトにアクセスしたときの実際の表示は端末やブラウザの言語設定に合わせられます。

例：https://lokuyow.github.io/sats-rate/?usd=1.234,56&d=c
```
https://lokuyow.github.io/sats-rate/?{デフォルト入力値のクエリ}&{小数点のクエリ}
```
- クエリを省略　小数点はピリオド「.」
- d=p　小数点（decimal point）はピリオド「.」（period）
- d=c　小数点（decimal point）はカンマ「,」（comma）

「SNSに共有」右端のコピーボタンからクエリ付のURLをコピーできます。

## 価格レート取得先
[CoinGecko](https://www.coingecko.com/ja)

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