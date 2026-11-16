let customOptions = {
  sats: { maximumFractionDigits: 0, minimumFractionDigits: 0 },
  btc: { maximumFractionDigits: 8, minimumFractionDigits: 0 },
};

const localeSeparatorsCache = new Map();

export function getLocaleSeparators(locale) {
  if (localeSeparatorsCache.has(locale)) {
    return localeSeparatorsCache.get(locale);
  }

  const formattedNumber = new Intl.NumberFormat(locale, { numberingSystem: "latn" }).format(1000.1);
  const separators = {
    groupSeparator: formattedNumber[1],
    decimalSeparator: formattedNumber[5],
  };

  localeSeparatorsCache.set(locale, separators);
  return separators;
}

// 指数表記の数値を通常の10進表記に展開する（例: "1e-8" → "0.00000001"）
function expandExponentialNotation(numericString) {
  const value = Number(numericString);
  if (!Number.isFinite(value)) return "";

  const str = String(value);
  if (!str.includes("e") && !str.includes("E")) return str;

  const [mantissa, exponentPart] = str.split(/[eE]/);
  const exponent = parseInt(exponentPart, 10);
  const isNegative = mantissa.startsWith("-");
  const mantissaDigits = mantissa.replace("-", "");
  const dotIndex = mantissaDigits.indexOf(".");
  const integerDigitCount = dotIndex === -1 ? mantissaDigits.length : dotIndex;
  const digits = mantissaDigits.replace(".", "");
  const newDotIndex = integerDigitCount + exponent;

  let expanded;
  if (newDotIndex <= 0) {
    expanded = "0." + "0".repeat(-newDotIndex) + digits;
  } else if (newDotIndex >= digits.length) {
    expanded = digits + "0".repeat(newDotIndex - digits.length);
  } else {
    expanded = digits.slice(0, newDotIndex) + "." + digits.slice(newDotIndex);
  }

  return (isNegative ? "-" : "") + expanded;
}

export function parseInput(inputValue, locale) {
  const separators = getLocaleSeparators(locale);
  // 全角数字・記号を半角にそろえる（例: "１００" → "100"）。区切り文字も同じ正規化形で照合する
  const groupSeparator = separators.groupSeparator.normalize("NFKC");
  const decimalSeparator = separators.decimalSeparator.normalize("NFKC");
  const normalized = String(inputValue ?? "")
    .normalize("NFKC")
    .replace(new RegExp(`\\${groupSeparator}`, "g"), "")
    .replace(decimalSeparator, ".");

  // 数字・小数点・指数表記に使う文字以外（通貨記号など）は除去する
  const cleaned = normalized.replace(/[^0-9.eE+-]/g, "");

  // 指数表記は文字を落として別の値にせず、通常の10進表記に展開して正しく解釈する
  if (/^(?:\d+(?:\.\d*)?|\.\d+)[eE][+-]?\d+$/.test(cleaned)) {
    return expandExponentialNotation(cleaned);
  }

  // 負の値と、解釈できない "e" や "+" を含む入力は無効（値なし）として扱う
  if (/[eE+-]/.test(cleaned)) return "";

  return cleaned;
}

export function updateCustomOptions(rates) {
  for (const [key, value] of Object.entries(rates)) {
    if (key === "sats" || key === "btc" || key === "last_updated_at") continue;

    let integerDigits = Math.floor(value).toString().length;
    let maximumFractionDigits = 11 - integerDigits;
    maximumFractionDigits = Math.max(0, maximumFractionDigits);

    customOptions[key] = {
      maximumFractionDigits,
      minimumFractionDigits: 0,
    };
  }
}

export function formatCurrency(num, id, selectedLocale, shouldRound = true, significantDigits) {
  if (typeof num !== "number") {
    num = parseFloat(num);
    if (isNaN(num)) {
      console.error("Invalid type for num:", num);
      return;
    }
  }

  let roundedNum = shouldRound ? Number(num.toPrecision(significantDigits)) : num;
  const formatOptions = {
    ...customOptions[id],
    numberingSystem: "latn",
  };
  const maximumFractionDigits = formatOptions.maximumFractionDigits;
  const numFractionDigits = (roundedNum.toString().split(".")[1] || "").length;

  if (numFractionDigits > maximumFractionDigits) {
    roundedNum = Number(roundedNum.toFixed(maximumFractionDigits));
  }

  return roundedNum.toLocaleString(selectedLocale, formatOptions);
}