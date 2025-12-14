// 定数
const EXCLUDE_KEYS = ['d', 'ts', 'currencies'];
const MAX_DECIMAL_PLACES = 8;
const DEFAULT_TITLE = "おいくらサッツ";
const DEFAULT_DESCRIPTION = "ビットコイン、サッツ、日本円、米ドルなど複数通貨間換算ツール";
const FALLBACK_DESCRIPTION = "複数通貨間換算ツール";

// ユーティリティ関数
function formatCurrencyCode(code) {
    return code === 'sats' ? 'sats' : code.toUpperCase();
}

function formatNumberForDisplay(valueStr, params) {
    const s = String(valueStr).trim();
    if (s === '') return s;

    // 小数点の正規化
    let normalized;
    if (s.includes(',') && !s.includes('.')) {
        normalized = s.replace(/,/g, '.');
    } else {
        normalized = s.replace(/,/g, '');
    }

    const parts = normalized.split('.');
    const fracLength = parts[1] ? parts[1].length : 0;
    const maxFrac = Math.min(fracLength, MAX_DECIMAL_PLACES);
    const num = Number(normalized);

    if (Number.isNaN(num)) return s;

    const decimalFormat = params.get('d');
    const locale = decimalFormat === 'c' ? 'de-DE' : 'en-US';

    return new Intl.NumberFormat(locale, {
        minimumFractionDigits: fracLength,
        maximumFractionDigits: maxFrac,
        useGrouping: true
    }).format(num);
}

function parseCurrencyList(currencies) {
    const separator = currencies.includes('-') ? '-' : ',';
    return currencies.split(separator).map(s => s.trim()).filter(Boolean);
}

function findBaseCurrency(params) {
    let prevNonControl = null;

    for (const [k, v] of params.entries()) {
        if (k === 'currencies') {
            if (prevNonControl) {
                return {
                    key: prevNonControl,
                    value: params.get(prevNonControl)
                };
            }
            break;
        }
        if (!EXCLUDE_KEYS.includes(k)) {
            prevNonControl = k;
        }
    }

    return { key: null, value: null };
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");
}

// メインハンドラー
addEventListener("fetch", (event) => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const url = new URL(request.url);

    if (url.pathname === "/og-image") {
        return handleOgImage(url);
    }

    const accept = request.headers.get("accept") || "";
    if (!accept.includes("text/html")) {
        return fetch(request);
    }

    const originRes = await fetch(request);

    if (!shouldUseDynamicOgp(url.searchParams)) {
        return originRes;
    }

    const { title, description } = buildOgTextFromParams(url.searchParams);
    const ogImageUrl = `${url.origin}/og-image${url.search}`;

    const rewriter = new HTMLRewriter()
        .on('meta[property="og:title"]', new ReplaceMeta(title))
        .on('meta[property="og:description"]', new ReplaceMeta(description))
        .on('meta[property="og:image"]', new ReplaceMeta(ogImageUrl))
        .on('meta[name="twitter:card"]', new ReplaceMeta("summary_large_image"))
        .on('meta[name="twitter:image"]', new ReplaceMeta(ogImageUrl))
        .on('title', new ReplaceTitle(title));

    return rewriter.transform(originRes);
}

function shouldUseDynamicOgp(params) {
    return params.has('ts');
}

function buildOgTextFromParams(params) {
    const currencies = params.get('currencies');

    if (!currencies) {
        return { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION };
    }

    const currencyList = parseCurrencyList(currencies);
    const { key: baseKey, value: baseValue } = findBaseCurrency(params);

    if (!baseKey) {
        return { title: DEFAULT_TITLE, description: FALLBACK_DESCRIPTION };
    }

    const title = `${formatNumberForDisplay(baseValue, params)} ${formatCurrencyCode(baseKey)} | ${DEFAULT_TITLE}`;

    const outputParts = currencyList
        .filter(key => key !== baseKey)
        .map(key => {
            const value = params.get(key);
            return value ? `${formatNumberForDisplay(value, params)} ${formatCurrencyCode(key)}` : null;
        })
        .filter(Boolean);

    const description = outputParts.length > 0
        ? `${formatNumberForDisplay(baseValue, params)} ${baseKey.toUpperCase()} = ${outputParts.join(' = ')}`
        : `${formatNumberForDisplay(baseValue, params)} ${baseKey.toUpperCase()}`;

    return { title, description };
}

// HTMLRewriter クラス
class ReplaceMeta {
    constructor(content) {
        this.content = content;
    }
    element(el) {
        el.setAttribute("content", this.content);
    }
}

class ReplaceTitle {
    constructor(title) {
        this.title = title;
    }
    element(el) {
        el.setInnerContent(this.title);
    }
}

// OGP画像生成
const MAX_OUTPUT_CURRENCIES = 4;
const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const JST_OFFSET = 9 * 60 * 60 * 1000;

const FONT_CONFIGS = {
    1: { fontSize: 100, startY: 350, lineSpacing: 0 },
    2: { fontSize: 85, startY: 300, lineSpacing: 130 },
    3: { fontSize: 65, startY: 270, lineSpacing: 105 },
    4: { fontSize: 60, startY: 250, lineSpacing: 85 }
};

function formatTimestamp(ts) {
    if (!ts) return '';

    const date = new Date(parseInt(ts) * 1000);
    const jstDate = new Date(date.getTime() + JST_OFFSET);

    const year = jstDate.getUTCFullYear();
    const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(jstDate.getUTCDate()).padStart(2, '0');
    const hour = String(jstDate.getUTCHours()).padStart(2, '0');
    const minute = String(jstDate.getUTCMinutes()).padStart(2, '0');

    return `${year}/${month}/${day} ${hour}:${minute}`;
}

function buildOutputLines(currencyList, baseKey, params) {
    return currencyList
        .filter(key => key !== baseKey)
        .slice(0, MAX_OUTPUT_CURRENCIES)
        .map(key => {
            const value = params.get(key);
            return value ? `${formatNumberForDisplay(value, params)} ${formatCurrencyCode(key)}` : null;
        })
        .filter(Boolean);
}

function generateDynamicOgpSvg(params, baseKey, baseValue, outputLines, dateText) {
    const mainTitle = baseKey
        ? `${formatNumberForDisplay(baseValue, params)} ${baseKey.toUpperCase()} =`
        : DEFAULT_TITLE;

    const config = FONT_CONFIGS[Math.min(outputLines.length, MAX_OUTPUT_CURRENCIES)] || FONT_CONFIGS[4];

    const outputTextElements = outputLines.map((line, i) =>
        `<text x="600" y="${config.startY + (i * config.lineSpacing)}" font-family='${FONT_FAMILY}' font-size="${config.fontSize}" text-anchor="middle" fill="#333">${escapeHtml(line)}</text>`
    ).join('\n    ');

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="100%" height="100%" fill="#F5F7F6" />
  <text x="600" y="140" font-family='${FONT_FAMILY}' font-weight="bold" font-size="115" text-anchor="middle" fill="#1a1a1a">${escapeHtml(mainTitle)}</text>
  <line x1="200" y1="170" x2="1000" y2="170" stroke="#ddd" stroke-width="2" />
  ${outputTextElements}
  <text x="80" y="570" font-family='${FONT_FAMILY}' font-size="38" fill="#666">${DEFAULT_TITLE}</text>
  <text x="1120" y="570" font-family='${FONT_FAMILY}' font-size="38" text-anchor="end" fill="#666">${escapeHtml(dateText)}</text>
</svg>`;
}

function generateSimpleOgpSvg() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="100%" height="100%" fill="#ffffff" />
  <text x="600" y="320" font-family='${FONT_FAMILY}' font-weight="bold" font-size="80" text-anchor="middle" fill="#1a1a1a">${DEFAULT_TITLE}</text>
  <text x="600" y="400" font-family='${FONT_FAMILY}' font-size="36" text-anchor="middle" fill="#666">ビットコイン通貨換算ツール</text>
  <text x="80" y="570" font-family='${FONT_FAMILY}' font-size="28" fill="#888">osats.money</text>
</svg>`;
}

function handleOgImage(url) {
    const params = url.searchParams;
    const currencies = params.get('currencies');
    const hasTs = params.has('ts');

    if (!currencies || !hasTs) {
        const svg = generateSimpleOgpSvg();
        return new Response(svg, {
            headers: {
                "content-type": "image/svg+xml; charset=utf-8",
                "cache-control": "public, max-age=3600"
            }
        });
    }

    const currencyList = parseCurrencyList(currencies);
    const { key: baseKey, value: baseValue } = findBaseCurrency(params);
    const outputLines = buildOutputLines(currencyList, baseKey, params);
    const dateText = formatTimestamp(params.get('ts'));

    const svg = generateDynamicOgpSvg(params, baseKey, baseValue, outputLines, dateText);

    return new Response(svg, {
        headers: {
            "content-type": "image/svg+xml; charset=utf-8",
            "cache-control": "public, max-age=3600"
        }
    });
}

