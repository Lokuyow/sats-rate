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

export function parseInput(inputValue, locale) {
  const separators = getLocaleSeparators(locale);
  const onlyNumbersAndSeparators = String(inputValue ?? "").replace(/[^0-9\.,]/g, "");

  return onlyNumbersAndSeparators.replace(new RegExp(`\\${separators.groupSeparator}`, "g"), "").replace(separators.decimalSeparator, ".");
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