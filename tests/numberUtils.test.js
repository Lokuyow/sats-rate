// assets/js/numberUtils.js の単体テスト（Issue #39）
// 実行: npm test （Node 標準の node --test を使用、追加の依存なし）
//
// 既知の不具合に触れるケースは、正しい期待値のまま test.skip で入れている。
// 対応する修正 PR がマージされたら、skip を外して有効化すること。
// バグった現行挙動を期待値として固定するテストは書かない方針。

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  getLocaleSeparators,
  parseInput,
  formatCurrency,
  updateCustomOptions,
} from "../assets/js/numberUtils.js";

describe("getLocaleSeparators", () => {
  test("en-US: 桁区切りはカンマ、小数点はピリオド", () => {
    assert.deepEqual(getLocaleSeparators("en-US"), {
      groupSeparator: ",",
      decimalSeparator: ".",
    });
  });

  test("ja-JP: 桁区切りはカンマ、小数点はピリオド", () => {
    assert.deepEqual(getLocaleSeparators("ja-JP"), {
      groupSeparator: ",",
      decimalSeparator: ".",
    });
  });

  test("de-DE: 桁区切りはピリオド、小数点はカンマ", () => {
    assert.deepEqual(getLocaleSeparators("de-DE"), {
      groupSeparator: ".",
      decimalSeparator: ",",
    });
  });

  test("fr-FR: 桁区切りは狭いノーブレークスペース、小数点はカンマ", () => {
    assert.deepEqual(getLocaleSeparators("fr-FR"), {
      groupSeparator: "\u202F",
      decimalSeparator: ",",
    });
  });

  // Issue #7: 4桁を区切らないロケールでは format(1000.1) の固定インデックスが
  // 数字を拾ってしまい、区切り文字が壊れる。修正は PR #23。
  // PR #23 がマージされたら以下の skip を外すこと。
  test.skip("es-ES: 桁区切りはピリオド、小数点はカンマ（PR #23 で修正予定）", () => {
    assert.deepEqual(getLocaleSeparators("es-ES"), {
      groupSeparator: ".",
      decimalSeparator: ",",
    });
  });

  test.skip("pt-PT: 桁区切りはノーブレークスペース、小数点はカンマ（PR #23 で修正予定）", () => {
    assert.deepEqual(getLocaleSeparators("pt-PT"), {
      groupSeparator: "\u00A0",
      decimalSeparator: ",",
    });
  });

  test.skip("it-IT: 桁区切りはピリオド、小数点はカンマ（PR #23 で修正予定）", () => {
    assert.deepEqual(getLocaleSeparators("it-IT"), {
      groupSeparator: ".",
      decimalSeparator: ",",
    });
  });

  test.skip("hu-HU: 桁区切りはノーブレークスペース、小数点はカンマ（PR #23 で修正予定）", () => {
    assert.deepEqual(getLocaleSeparators("hu-HU"), {
      groupSeparator: "\u00A0",
      decimalSeparator: ",",
    });
  });
});

describe("parseInput", () => {
  test("桁区切りを除去する（en-US）", () => {
    assert.equal(parseInput("1,000", "en-US"), "1000");
  });

  test("桁区切りと小数を変換する（en-US）", () => {
    assert.equal(parseInput("1,000.5", "en-US"), "1000.5");
  });

  test("桁区切りと小数を変換する（de-DE）", () => {
    assert.equal(parseInput("1.000,5", "de-DE"), "1000.5");
  });

  test("通貨記号を取り除く（$）", () => {
    assert.equal(parseInput("$1,234.56", "en-US"), "1234.56");
  });

  test("通貨記号を取り除く（¥）", () => {
    assert.equal(parseInput("¥12,345", "ja-JP"), "12345");
  });

  test("空文字は空文字のまま", () => {
    assert.equal(parseInput("", "en-US"), "");
  });

  test("小数点のみの入力はそのまま返す", () => {
    assert.equal(parseInput(".", "en-US"), ".");
  });

  test("null / undefined は空文字になる", () => {
    assert.equal(parseInput(null, "en-US"), "");
    assert.equal(parseInput(undefined, "en-US"), "");
  });

  test("数字と区切り以外は取り除かれる", () => {
    assert.equal(parseInput("abc", "en-US"), "");
  });

  test("btc の最小単位（8桁小数）を保持する", () => {
    assert.equal(parseInput("0.00000001", "en-US"), "0.00000001");
  });

  test("数値型の入力も受け付ける", () => {
    assert.equal(parseInput(1000, "en-US"), "1000");
  });

  // Issue #8: 現行実装は指数表記・全角数字・負号を無言で別の値に変換する
  // （例: "1e-8" が "18" になる）。修正は PR #26 で、負号は無効入力として
  // 空文字を返す仕様。PR #26 がマージされたら以下の skip を外すこと。
  test.skip("指数表記を正しく展開する（PR #26 で修正予定）", () => {
    assert.equal(parseInput("1e-8", "en-US"), "0.00000001");
    assert.equal(parseInput("1e5", "en-US"), "100000");
  });

  test.skip("全角数字を受け付ける（PR #26 で修正予定）", () => {
    assert.equal(parseInput("１００", "ja-JP"), "100");
  });

  test.skip("負の値は無効として空文字を返す（PR #26 で修正予定）", () => {
    assert.equal(parseInput("-100", "en-US"), "");
  });

  // Issue #9: ロケールと逆の小数点記号で入力すると、区切り文字として
  // 処理されて金額が10倍になる。修正は PR #24。
  // PR #24 がマージされたら以下の skip を外すこと。
  test.skip("en-US でカンマ小数（1,5）を 1.5 と読む（PR #24 で修正予定）", () => {
    assert.equal(parseInput("1,5", "en-US"), "1.5");
  });

  test.skip("de-DE でピリオド小数（1.5）を 1.5 と読む（PR #24 で修正予定）", () => {
    assert.equal(parseInput("1.5", "de-DE"), "1.5");
  });
});

describe("formatCurrency", () => {
  test("sats は整数に整形し桁区切りを付ける", () => {
    assert.equal(formatCurrency(1000, "sats", "en-US"), "1,000");
  });

  test("sats は小数以下を丸める", () => {
    assert.equal(formatCurrency(1234.56, "sats", "en-US"), "1,235");
  });

  test("btc は小数8桁まで表示する", () => {
    assert.equal(formatCurrency(0.5, "btc", "en-US"), "0.5");
    assert.equal(formatCurrency(1, "btc", "en-US"), "1");
    assert.equal(formatCurrency(0.00000001, "btc", "en-US"), "0.00000001");
  });

  test("ロケールに応じた区切りで整形する（ja-JP）", () => {
    assert.equal(formatCurrency(1500.5, "btc", "ja-JP"), "1,500.5");
  });

  test("文字列の数値も整形できる", () => {
    assert.equal(formatCurrency("1000", "sats", "en-US"), "1,000");
  });
});

describe("formatCurrency と parseInput の往復", () => {
  test("en-US: 整形→パースで元の値に戻る", () => {
    const formatted = formatCurrency(1000, "sats", "en-US");
    assert.equal(Number(parseInput(formatted, "en-US")), 1000);
  });

  test("de-DE: 整形→パースで元の値に戻る", () => {
    const formatted = formatCurrency(1000.5, "btc", "de-DE");
    assert.equal(formatted, "1.000,5");
    assert.equal(Number(parseInput(formatted, "de-DE")), 1000.5);
  });

  test("ja-JP: 整形→パースで元の値に戻る", () => {
    const formatted = formatCurrency(1234.56, "btc", "ja-JP");
    assert.equal(Number(parseInput(formatted, "ja-JP")), 1234.56);
  });
});

describe("updateCustomOptions", () => {
  test("レートの桁数に応じて表示する小数桁数が変わる", () => {
    // 更新前: usd の整形オプションは未設定で、デフォルトの小数3桁まで
    assert.equal(formatCurrency(0.123456789012, "usd", "en-US"), "0.123");

    // 1.2345 は整数部1桁 → 小数部は 11 - 1 = 10桁まで
    updateCustomOptions({ usd: 1.2345 });
    assert.equal(formatCurrency(0.123456789012, "usd", "en-US"), "0.123456789");
  });

  test("整数部の桁数が大きい通貨は小数桁数が減る", () => {
    // 150000 は整数部6桁 → 小数部は 11 - 6 = 5桁まで
    updateCustomOptions({ jpy: 150000 });
    assert.equal(formatCurrency(1.123456, "jpy", "en-US"), "1.12346");
  });

  test("sats / btc / last_updated_at は更新対象に含まれない", () => {
    updateCustomOptions({ sats: 99999, btc: 99999, last_updated_at: 123 });
    // sats の整形（小数0桁）が変わっていないこと
    assert.equal(formatCurrency(1000.5, "sats", "en-US"), "1,001");
  });
});
