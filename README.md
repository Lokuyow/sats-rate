# おいくらサッツ
ビットコイン（bitcoin, BTC）、サッツ（Sats, Sat, Satoshi）、日本円（JPY）、米ドル（USD）、ユーロ（EUR）の相互換算ツールです。

最新レートを取得し計算、表示します。

## URLクエリパラメータ
URLの末尾に特定の通貨文字と数字を付けるとそれが入力された状態でサイトにアクセスすることができます。
```
https://lokuyow.github.io/sats-rate/{?通貨=数字}
```
例：https://lokuyow.github.io/sats-rate/?jpy=3264

### 通貨
- sats
- btc
- jpy
- usd
- eur

## 価格レート取得先
[CoinGecko](https://www.coingecko.com/ja)