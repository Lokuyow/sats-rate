let customOptions = {
  sats: { maximumFractionDigits: 0, minimumFractionDigits: 0 },
  btc: { maximumFractionDigits: 8, minimumFractionDigits: 0 },
};

const localeSeparatorsCache = new Map();

export function getLocaleSeparators(locale) {
  if (localeSeparatorsCache.has(locale)) {
    return localeSeparatorsCache.get(locale);
  }

  const parts = new Intl.NumberFormat(locale, { numberingSystem: "latn" }).formatToParts(1000000.1);
  const separators = {
    groupSeparator: parts.find((part) => part.type === "group")?.value ?? "",
    decimalSeparator: parts.find((part) => part.type === "decimal")?.value ?? ".",
  };

  localeSeparatorsCache.set(locale, separators);
  return separators;
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

  // 数字・小数点・符号と、無効な入力の判定に使う "e"/"E" 以外（通貨記号など）は除去する
  const cleaned = normalized.replace(/[^0-9.eE+-]/g, "");

  // 負の値と、指数表記を含む入力、解釈できない "e" や "+" を含む入力は無効（値なし）として扱う
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