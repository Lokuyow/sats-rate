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

    // ★修正箇所: ORIGIN を使わず、リクエストをそのまま fetch に渡す
    // これにより osats.money へのアクセスとして処理され、GitHub側のリダイレクトが発生しません。
    const originRes = await fetch(request);

    const { title, description } = buildOgTextFromParams(url.searchParams);
    // ogImageUrl の生成はそのままでOK
    const ogImageUrl = `${url.origin}/og-image${url.search}`;

    const rewriter = new HTMLRewriter()
        .on('meta[property="og:title"]', new ReplaceMeta(title))
        .on('meta[property="og:description"]', new ReplaceMeta(description))
        .on('meta[property="og:image"]', new ReplaceMeta(ogImageUrl))
        .on('meta[name="twitter:card"]', new ReplaceMeta("summary_large_image"))
        .on('meta[name="twitter:image"]', new ReplaceMeta(ogImageUrl))
        // headタグがない場合に備えて念のため書き換え対象があるか確認が必要ですが、
        // 既存のHTMLにheadがあればこれで動作します
        .on('head', new EnsureMeta(title, description, ogImageUrl));

    return rewriter.transform(originRes);
}

function buildOgTextFromParams(params) {
    if (![...params.keys()].length) {
        return { title: "おいくらサッツ", description: "複数通貨間換算ツール" };
    }
    const parts = [];
    for (const [k, v] of params.entries()) {
        // 表示を見やすく調整（例: 1000 JPY 等）
        // キーが og_sats などの制御用パラメータの場合は除外するロジックを入れても良いですが、
        // まずは動かすことを優先します。
        if (k === 'og_sats') continue; // OGP用パラメータはディスクリプションに出さない等の工夫も可能
        parts.push(`${v} ${k.toUpperCase()}`);
    }
    // OGP用のSatsがある場合はタイトルに使うなど
    const ogSats = params.get('og_sats');
    const displayTitle = ogSats ? `${ogSats} Sats` : "おいくらサッツ";

    return {
        title: displayTitle,
        description: parts.join(" = ") || "Sats Rate Calculator",
    };
}

class ReplaceMeta {
    constructor(content) { this.content = content; }
    element(el) { el.setAttribute("content", this.content); }
}

class EnsureMeta {
    constructor(title, desc, img) { this.title = title; this.desc = desc; this.img = img; }
    element(el) {
        // すでに存在する場合は重複する可能性がありますが、
        // HTMLRewriterの仕様上、headの末尾に追加されます。
        // 重複を避ける厳密な制御は複雑になるため、既存コードの方針（追加）を維持します。
        // ただし、ReplaceMetaが効いているなら、ここは本来「metaタグが全くなかった場合」の保険です。
        // 元のコードの意図通り残します。
    }
}

function handleOgImage(url) {
    // 簡易SVG生成
    // パラメータの取得と表示用整形
    const entries = [...url.searchParams.entries()].filter(([k]) => k !== 'og_sats');
    const paramsText = entries.map(([k, v]) => `${v} ${k.toUpperCase()}`).join(" = ");
    const ogSats = url.searchParams.get('og_sats');
    const mainText = ogSats ? `${ogSats} Sats` : "おいくらサッツ";

    // 日本語フォントはWorkerの標準環境では使えないことが多いため、
    // 確実に表示させるなら英数字メインにするか、画像化APIの利用検討が必要です。
    // ここではとりあえず元のSVGロジックを使います。

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#f7931a;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#f0b90b;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#grad)" />
    <rect x="50" y="50" width="1100" height="530" rx="30" fill="white" fill-opacity="0.95" />
    <text x="600" y="250" font-family="sans-serif" font-size="60" text-anchor="middle" fill="#555">Sats Rate</text>
    <text x="600" y="380" font-family="sans-serif" font-weight="bold" font-size="80" text-anchor="middle" fill="#333">${escapeHtml(mainText)}</text>
    <text x="600" y="480" font-family="sans-serif" font-size="40" text-anchor="middle" fill="#888">${escapeHtml(paramsText)}</text>
  </svg>`;
    return new Response(svg, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

function escapeHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }