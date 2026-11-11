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

// 入力文字列に対して実際に小数点・桁区切りとして扱う記号を返す
// （ロケールの桁区切りが小数点として解釈される場合など、ロケールの区切りと異なることがある）
export function getEffectiveSeparators(inputValue, locale) {
  const separators = getLocaleSeparators(locale);
  const onlyNumbersAndSeparators = String(inputValue ?? "").replace(/[^0-9\.,]/g, "");

  const lastDotIndex = onlyNumbersAndSeparators.lastIndexOf(".");
  const lastCommaIndex = onlyNumbersAndSeparators.lastIndexOf(",");

  let decimalSeparator = separators.decimalSeparator;
  let groupSeparator = separators.groupSeparator;

  if (lastDotIndex !== -1 && lastCommaIndex !== -1) {
    // 両方の記号が現れる場合は、後ろに現れる方を小数点とみなす
    decimalSeparator = lastDotIndex > lastCommaIndex ? "." : ",";
    groupSeparator = decimalSeparator === "." ? "," : ".";
  } else if (lastDotIndex !== -1 || lastCommaIndex !== -1) {
    const presentSeparator = lastDotIndex !== -1 ? "." : ",";
    const separatorCount = onlyNumbersAndSeparators.split(presentSeparator).length - 1;

    if (separatorCount > 1) {
      // 同じ記号が複数回現れる場合は桁区切りとみなす
      groupSeparator = presentSeparator;
      decimalSeparator = presentSeparator === "." ? "," : ".";
    } else if (presentSeparator === separators.groupSeparator) {
      // ロケールの桁区切りが1回だけ現れる場合、後ろが3桁ちょうどでなければ
      // 逆の記法で入力された小数点とみなす（例: en-US で "1,5" → 1.5）
      const separatorIndex = onlyNumbersAndSeparators.indexOf(presentSeparator);
      if (onlyNumbersAndSeparators.length - separatorIndex - 1 !== 3) {
        decimalSeparator = presentSeparator;
        groupSeparator = separators.decimalSeparator;
      }
    }
  }

  return { decimalSeparator, groupSeparator };
}

export function parseInput(inputValue, locale) {
  const { decimalSeparator, groupSeparator } = getEffectiveSeparators(inputValue, locale);
  const onlyNumbersAndSeparators = String(inputValue ?? "").replace(/[^0-9\.,]/g, "");

  const withoutGroupSeparator = onlyNumbersAndSeparators.replace(new RegExp(`\\${groupSeparator}`, "g"), "");
  const decimalParts = withoutGroupSeparator.split(decimalSeparator);
  // 小数点は最初の1つだけを残し、残りは取り除く
  return decimalParts.length > 1 ? `${decimalParts[0]}.${decimalParts.slice(1).join("")}` : decimalParts[0];
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