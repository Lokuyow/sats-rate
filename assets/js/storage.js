export function loadJsonFromStorage(key, fallbackValue) {
  try {
    const rawValue = window.localStorage.getItem(key);
    if (rawValue === null) {
      return fallbackValue;
    }

    const parsedValue = JSON.parse(rawValue);
    return parsedValue === null ? fallbackValue : parsedValue;
  } catch (error) {
    console.warn(`Failed to read localStorage key: ${key}`, error);

    try {
      window.localStorage.removeItem(key);
    } catch {
      // localStorageが利用できない環境でもフォールバックできるようにする
    }

    return fallbackValue;
  }
}