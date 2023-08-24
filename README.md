# おいくらサッツ
ビットコイン（bitcoin, BTC）、サッツ（Sats, Sat, Satoshi）、日本円（JPY）、米ドル（USD）、ユーロ（EUR）の相互換算ツールです。最新レートを取得し計算、表示します。
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