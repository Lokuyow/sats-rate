addEventListener("fetch", (event) => {
    event.respondWith(handleRequest(event.request));
});

// const ORIGIN = ... は削除（不要です）

async function handleRequest(request) {
    const url = new URL(request.url);

    // og-image endpoint
    if (url.pathname === "/og-image") {
        return handleOgImage(url);
    }

    const accept = request.headers.get("accept") || "";
    if (!accept.includes("text/html")) {
        // HTML 以外はそのままパススルー
        return fetch(request);
    }

    const originRes = await fetch(request);

    // 動的OGP判定: outputs, ts, または通貨キーに値がある場合のみ書き換え
    const isDynamicOgp = shouldUseDynamicOgp(url.searchParams);

    if (!isDynamicOgp) {
        // レガシーURL（currenciesのみ）または空URL → 静的OGP維持
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
    // 動的OGP対象条件: ts (timestamp) がある場合のみ
    // ts がない場合は静的OGP維持（レガシーURL互換）
    return params.has('ts');
}

function buildOgTextFromParams(params) {
    const currencies = params.get('currencies');

    if (!currencies) {
        return { title: "おいくらサッツ", description: "ビットコイン、サッツ、日本円、米ドルなど複数通貨間換算ツール" };
    }

    // 制御パラメータを除外
    const excludeKeys = ['d', 'ts', 'currencies'];
    // ハイフンまたはカンマで分割（互換性のため）
    const separator = currencies.includes('-') ? '-' : ',';
    const currencyList = currencies.split(separator).map(s => s.trim()).filter(Boolean);

    // ベース通貨を特定: 'currencies' の直前にある最初の非制御キーを計算元とする
    let baseKey = null;
    let baseValue = null;
    let prevNonControl = null;
    for (const [k, v] of params.entries()) {
        if (k === 'currencies') {
            baseKey = prevNonControl;
            baseValue = baseKey ? params.get(baseKey) : null;
            break;
        }
        if (!excludeKeys.includes(k)) prevNonControl = k;
    }

    if (!baseKey) {
        return { title: "おいくらサッツ", description: "複数通貨間換算ツール" };
    }

    // 数値を桁区切りでフォーマットする関数
    function formatNumberForDisplay(valueStr) {
        const s = String(valueStr).trim();
        // カンマが小数点として使われていてピリオドが無い場合はカンマを小数点に置換
        let normalized;
        if (s.includes(',') && !s.includes('.')) {
            normalized = s.replace(/,/g, '.');
        } else {
            // その他はカンマを削除（桁区切り対処）
            normalized = s.replace(/,/g, '');
        }
        const parts = normalized.split('.');
        const fracLength = parts[1] ? parts[1].length : 0;
        const maxFrac = Math.min(fracLength, 8);
        const num = Number(normalized);
        if (Number.isNaN(num)) return s;

        // d=c の場合は桁区切りをピリオド、小数点をカンマにする
        const decimalFormat = params.get('d');
        const locale = decimalFormat === 'c' ? 'de-DE' : 'en-US';
        return new Intl.NumberFormat(locale, { minimumFractionDigits: fracLength, maximumFractionDigits: maxFrac, useGrouping: true }).format(num);
    }

    // タイトル: "777 SATS | おいくらサッツ" 形式（数値をフォーマット）
    function formatCurrencyCode(code) { return code === 'sats' ? 'sats' : code.toUpperCase(); }
    const title = `${formatNumberForDisplay(baseValue)} ${formatCurrencyCode(baseKey)} | おいくらサッツ`;

    // 説明: 出力通貨を列挙（baseを除く）
    const outputParts = [];
    currencyList.forEach(key => {
        if (key !== baseKey) {
            const value = params.get(key);
            if (value) {
                outputParts.push(`${formatNumberForDisplay(value)} ${formatCurrencyCode(key)}`);
            }
        }
    });

    const description = outputParts.length > 0
        ? `${formatNumberForDisplay(baseValue)} ${baseKey.toUpperCase()} = ${outputParts.join(' = ')}`
        : `${formatNumberForDisplay(baseValue)} ${baseKey.toUpperCase()}`;

    return { title, description };
}

class ReplaceMeta {
    constructor(content) { this.content = content; }
    element(el) { el.setAttribute("content", this.content); }
}

class ReplaceTitle {
    constructor(title) { this.title = title; }
    element(el) { el.setInnerContent(this.title); }
}

function handleOgImage(url) {
    const params = url.searchParams;
    const currencies = params.get('currencies');
    const hasTs = params.has('ts');

    if (!currencies || !hasTs) {
        // 動的OGPでない場合はシンプルなSVGを返す
        return generateSimpleOgpSvg();
    }

    // 制御パラメータを除外
    const excludeKeys = ['d', 'ts', 'currencies'];
    // ハイフンまたはカンマで分割（互換性のため）
    const separator = currencies.includes('-') ? '-' : ',';
    const currencyList = currencies.split(separator).map(s => s.trim()).filter(Boolean);

    // ベース通貨を特定: 'currencies' の直前にある最初の非制御キーを計算元とする
    let baseKey = null;
    let baseValue = null;
    let prevNonControl = null;
    for (const [k, v] of params.entries()) {
        if (k === 'currencies') {
            baseKey = prevNonControl;
            baseValue = baseKey ? params.get(baseKey) : null;
            break;
        }
        if (!excludeKeys.includes(k)) prevNonControl = k;
    }

    // 出力通貨のリスト（baseを除く、最大4つ） — currencies の順を尊重
    const outputLines = [];
    // 数値フォーマット関数（OGP用）
    function formatNumberForDisplay(valueStr) {
        const s = String(valueStr).trim();
        if (s === '') return s;
        let normalized;
        if (s.includes(',') && !s.includes('.')) {
            normalized = s.replace(/,/g, '.');
        } else {
            normalized = s.replace(/,/g, '');
        }
        const parts = normalized.split('.');
        const fracLength = parts[1] ? parts[1].length : 0;
        const maxFrac = Math.min(fracLength, 8);
        const num = Number(normalized);
        if (Number.isNaN(num)) return s;

        // d=c の場合は桁区切りをピリオド、小数点をカンマにする
        const decimalFormat = params.get('d');
        const locale = decimalFormat === 'c' ? 'de-DE' : 'en-US';
        return new Intl.NumberFormat(locale, { minimumFractionDigits: fracLength, maximumFractionDigits: maxFrac, useGrouping: true }).format(num);
    }

    function formatCurrencyCode(code) { return code === 'sats' ? 'sats' : code.toUpperCase(); }

    // まずbaseを除外してから最大4つを取得
    const outputCurrencies = currencyList.filter(key => key !== baseKey).slice(0, 4);
    outputCurrencies.forEach(key => {
        const value = params.get(key);
        if (value) {
            outputLines.push(`${formatNumberForDisplay(value)} ${formatCurrencyCode(key)}`);
        }
    });

    // タイムスタンプの処理（JST）
    const ts = params.get('ts');
    let dateText = '';
    if (ts) {
        const date = new Date(parseInt(ts) * 1000);
        // JSTに変換 (UTC+9)
        const jstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
        const year = jstDate.getUTCFullYear();
        const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(jstDate.getUTCDate()).padStart(2, '0');
        const hour = String(jstDate.getUTCHours()).padStart(2, '0');
        const minute = String(jstDate.getUTCMinutes()).padStart(2, '0');
        dateText = `${year}/${month}/${day} ${hour}:${minute}`;
    }

    // システムフォント（単一引用符で囲むため、内部は二重引用符のまま）
    const fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

    // SVG生成
    const mainTitle = baseKey ? `${formatNumberForDisplay(baseValue)} ${baseKey.toUpperCase()} =` : 'おいくらサッツ';

    // 出力通貨の数に応じてフォントサイズと位置を調整
    const count = outputLines.length;
    let fontSize, startY, lineSpacing;

    if (count === 1) {
        fontSize = 100;
        startY = 350;
        lineSpacing = 0;
    } else if (count === 2) {
        fontSize = 85;
        startY = 300;
        lineSpacing = 130;
    } else if (count === 3) {
        fontSize = 65;
        startY = 270;
        lineSpacing = 105;
    } else { // 4個
        fontSize = 60;
        startY = 250;
        lineSpacing = 85;
    }

    const outputTextElements = outputLines.map((line, i) =>
        `<text x="600" y="${startY + (i * lineSpacing)}" font-family='${fontFamily}' font-size="${fontSize}" text-anchor="middle" fill="#333">${escapeHtml(line)}</text>`
    ).join('\n    ');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <!-- 背景色を #F5F7F6 に変更 -->
  <rect width="100%" height="100%" fill="#F5F7F6" />

  <!-- 出力通貨-->
  <text x="600" y="140" font-family='${fontFamily}' font-weight="bold" font-size="115" text-anchor="middle" fill="#1a1a1a">${escapeHtml(mainTitle)}</text>
  
  <!-- 区切り線 -->
  <line x1="200" y1="170" x2="1000" y2="170" stroke="#ddd" stroke-width="2" />
  
  <!-- 出力通貨 -->
  ${outputTextElements}
  
  <!-- 左下: サイト名 -->
  <text x="80" y="570" font-family='${fontFamily}' font-size="38" fill="#666">おいくらサッツ</text>
  
  <!-- 右下: 日時 -->
  <text x="1120" y="570" font-family='${fontFamily}' font-size="38" text-anchor="end" fill="#666">${escapeHtml(dateText)}</text>
</svg>`;

    return new Response(svg, {
        headers: {
            "content-type": "image/svg+xml; charset=utf-8",
            "cache-control": "public, max-age=3600"
        }
    });
}

function generateSimpleOgpSvg() {
    const fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <!-- 単色背景（オレンジ枠を廃止） -->
  <rect width="100%" height="100%" fill="#ffffff" />
  <text x="600" y="320" font-family='${fontFamily}' font-weight="bold" font-size="80" text-anchor="middle" fill="#1a1a1a">おいくらサッツ</text>
  <text x="600" y="400" font-family='${fontFamily}' font-size="36" text-anchor="middle" fill="#666">ビットコイン通貨換算ツール</text>
  <text x="80" y="570" font-family='${fontFamily}' font-size="28" fill="#888">osats.money</text>
</svg>`;
    return new Response(svg, {
        headers: {
            "content-type": "image/svg+xml; charset=utf-8",
            "cache-control": "public, max-age=3600"
        }
    });
}

function escapeHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }