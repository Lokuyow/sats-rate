// =====================================================
// Cloudflare Worker for sats-rate OGP
// R2を使用した動的PNG OGP画像配信
// =====================================================

// 定数
const DEFAULT_TITLE = "おいくらサッツ";
const DEFAULT_DESCRIPTION = "ビットコイン、サッツ、日本円、米ドルなど複数通貨間換算ツール";
const STATIC_OGP_PATH = "/assets/images/ogp.png";

// TTL: 168時間（7日）
const IMAGE_TTL_SECONDS = 168 * 60 * 60;

// =====================================================
// ユーティリティ関数
// =====================================================

function formatCurrencyCode(code) {
    return code === 'sats' ? 'sats' : code.toUpperCase();
}

function parseCurrencyList(currencies) {
    const separator = currencies.includes('-') ? '-' : ',';
    return currencies.split(separator).map(s => s.trim()).filter(Boolean);
}

// UUIDv4生成
function generateImageId() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// 旧式クエリ判定（カンマ区切りcurrencies）
function isLegacyQuery(params) {
    const currencies = params.get('currencies');
    if (!currencies) return false;
    return currencies.includes(',');
}

// =====================================================
// メインハンドラー（ES Modules形式）
// =====================================================

export default {
    async fetch(request, env, ctx) {
        return handleRequest(request, env);
    }
};

async function handleRequest(request, env) {
    const url = new URL(request.url);

    // CORS対応のOPTIONSリクエスト
    if (request.method === "OPTIONS") {
        return handleCors();
    }

    // API: OGP画像保存
    if (url.pathname === "/api/save-ogp" && request.method === "POST") {
        return handleSaveOgp(request, env);
    }

    // OGP画像配信
    if (url.pathname === "/og-image") {
        return handleOgImage(url, env);
    }

    // SNSボットのUser-Agentを検出
    const userAgent = (request.headers.get("user-agent") || "").toLowerCase();
    const isSocialBot = /twitterbot|facebookexternalhit|linkedinbot|slackbot|discordbot|telegrambot|line-poker|applebot/i.test(userAgent);

    const accept = request.headers.get("accept") || "";
    // SNSボットの場合、またはtext/htmlを要求している場合に書き換え処理を行う
    if (!accept.includes("text/html") && !isSocialBot) {
        return fetch(request);
    }

    const originRes = await fetch(request);

    // 動的OGPが不要な場合はそのまま返す
    if (!shouldUseDynamicOgp(url.searchParams)) {
        return originRes;
    }

    // 旧式クエリ（カンマ区切り）は静的PNGを使用
    if (isLegacyQuery(url.searchParams)) {
        return rewriteOgpMeta(originRes, url, null);
    }

    // 新形式: img_idがあればR2画像を参照
    const imgId = url.searchParams.get('img_id');
    return rewriteOgpMeta(originRes, url, imgId);
}

// =====================================================
// CORS処理
// =====================================================

function handleCors() {
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400"
        }
    });
}

function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    };
}

// =====================================================
// OGP画像保存 API
// =====================================================

async function handleSaveOgp(request, env) {
    try {
        console.log('[handleSaveOgp] Starting...');
        const body = await request.json();
        const { dataUrl } = body;

        console.log('[handleSaveOgp] dataUrl length:', dataUrl?.length);

        if (!dataUrl || !dataUrl.startsWith('data:image/png;base64,')) {
            console.error('[handleSaveOgp] Invalid data URL');
            return new Response(JSON.stringify({ error: 'Invalid data URL' }), {
                status: 400,
                headers: { "Content-Type": "application/json", ...corsHeaders() }
            });
        }

        // Base64デコード
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        console.log('[handleSaveOgp] Image bytes size:', bytes.length);

        // 画像IDを生成
        const imgId = generateImageId();
        const key = `${imgId}.png`;
        console.log('[handleSaveOgp] Generated key:', key);

        // R2バインディングの確認
        if (!env.OGP_IMAGES) {
            console.error('[handleSaveOgp] R2 binding OGP_IMAGES not found!');
            return new Response(JSON.stringify({ error: 'R2 binding not configured' }), {
                status: 500,
                headers: { "Content-Type": "application/json", ...corsHeaders() }
            });
        }

        // R2に保存（TTLはカスタムメタデータで管理）
        const expiresAt = Date.now() + (IMAGE_TTL_SECONDS * 1000);
        console.log('[handleSaveOgp] Saving to R2...');
        await env.OGP_IMAGES.put(key, bytes, {
            httpMetadata: {
                contentType: 'image/png',
                cacheControl: 'public, max-age=604800' // 7日
            },
            customMetadata: {
                expiresAt: expiresAt.toString(),
                createdAt: Date.now().toString()
            }
        });
        console.log('[handleSaveOgp] Successfully saved to R2:', key);

        return new Response(JSON.stringify({ img_id: imgId }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders() }
        });
    } catch (error) {
        console.error('[handleSaveOgp] Error:', error);
        console.error('[handleSaveOgp] Error stack:', error.stack);
        return new Response(JSON.stringify({ error: 'Internal server error', message: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders() }
        });
    }
}

// =====================================================
// OGP画像配信
// =====================================================

async function handleOgImage(url, env) {
    const imgId = url.searchParams.get('img_id');
    console.log('[handleOgImage] Requested img_id:', imgId);

    // img_idがない場合は静的PNGにリダイレクト
    if (!imgId) {
        console.log('[handleOgImage] No img_id, redirecting to static OGP');
        return Response.redirect(`${url.origin}${STATIC_OGP_PATH}`, 302);
    }

    // img_idの形式チェック（UUID形式）
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(imgId)) {
        console.log('[handleOgImage] Invalid UUID format, redirecting to static OGP');
        return Response.redirect(`${url.origin}${STATIC_OGP_PATH}`, 302);
    }

    try {
        const key = `${imgId}.png`;
        console.log('[handleOgImage] Fetching from R2:', key);
        const object = await env.OGP_IMAGES.get(key);

        if (!object) {
            console.log('[handleOgImage] Image not found in R2:', key);
            // R2に画像がない場合は静的PNGにリダイレクト
            return Response.redirect(`${url.origin}${STATIC_OGP_PATH}`, 302);
        }

        console.log('[handleOgImage] Image found in R2, size:', object.size);

        // TTLチェック（期限切れの場合も静的PNGにリダイレクト）
        const expiresAt = object.customMetadata?.expiresAt;
        if (expiresAt && Date.now() > parseInt(expiresAt)) {
            console.log('[handleOgImage] Image expired, deleting and redirecting');
            // 期限切れ画像を削除（非同期で実行）
            env.OGP_IMAGES.delete(key).catch(() => { });
            return Response.redirect(`${url.origin}${STATIC_OGP_PATH}`, 302);
        }

        console.log('[handleOgImage] Serving image:', key);
        return new Response(object.body, {
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=604800", // 7日
                "X-Image-Id": imgId
            }
        });
    } catch (error) {
        console.error('Get OGP image error:', error);
        return Response.redirect(`${url.origin}${STATIC_OGP_PATH}`, 302);
    }
}

// =====================================================
// 動的OGP判定
// =====================================================

function shouldUseDynamicOgp(params) {
    // img_idがあれば動的OGP
    if (params.has('img_id')) return true;
    // 旧式（tsパラメータ）も一応対応（静的PNGを返す）
    if (params.has('ts')) return true;
    return false;
}

// =====================================================
// OGPメタタグ書き換え
// =====================================================

function rewriteOgpMeta(originRes, url, imgId) {
    const params = url.searchParams;
    const { title, description } = buildOgTextFromParams(params);
    const currentUrl = url.toString();

    // OGP画像URL決定
    let ogImageUrl;
    if (imgId) {
        // R2のPNG画像を参照
        ogImageUrl = `${url.origin}/og-image?img_id=${imgId}`;
    } else {
        // 静的PNG
        ogImageUrl = `${url.origin}${STATIC_OGP_PATH}`;
    }

    const rewriter = new HTMLRewriter()
        .on('meta[property="og:title"]', new ReplaceMeta(title))
        .on('meta[property="og:description"]', new ReplaceMeta(description))
        .on('meta[property="og:image"]', new ReplaceMeta(ogImageUrl))
        .on('meta[property="og:url"]', new ReplaceMeta(currentUrl))
        .on('meta[name="twitter:card"]', new ReplaceMeta("summary_large_image"))
        .on('meta[name="twitter:image"]', new ReplaceMeta(ogImageUrl))
        .on('title', new ReplaceTitle(title));

    return rewriter.transform(originRes);
}

// =====================================================
// OGPテキスト生成
// =====================================================

function buildOgTextFromParams(params) {
    const currencies = params.get('currencies');

    if (!currencies) {
        return { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION };
    }

    const currencyList = parseCurrencyList(currencies);
    const { key: baseKey, value: baseValue } = findBaseCurrency(params);

    if (!baseKey || !baseValue) {
        return { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION };
    }

    // タイトル: 入力値と通貨コード
    const formattedValue = formatNumberWithLocale(baseValue, params);
    const title = `${formattedValue} ${formatCurrencyCode(baseKey)} | ${DEFAULT_TITLE}`;

    // Description: 選択通貨の一覧
    const description = `${formattedValue} ${formatCurrencyCode(baseKey)} を含む ${currencyList.length} 通貨間の換算結果`;

    return { title, description };
}

function findBaseCurrency(params) {
    // URLの最初の通貨パラメータを基準通貨とする
    for (const [key, value] of params.entries()) {
        if (key === 'currencies' || key === 'img_id' || key === 'd') continue;
        // 通貨コードと思われるキー（小文字2-4文字）
        if (/^[a-z]{2,4}$/i.test(key) && value) {
            return { key, value };
        }
    }
    return { key: null, value: null };
}

function formatNumberWithLocale(valueStr, params) {
    const s = String(valueStr).trim();
    if (s === '') return s;

    // 小数点の正規化
    let normalized;
    if (s.includes(',') && !s.includes('.')) {
        normalized = s.replace(/,/g, '.');
    } else {
        normalized = s.replace(/,/g, '');
    }

    const num = Number(normalized);
    if (Number.isNaN(num)) return s;

    const decimalFormat = params.get('d');
    const locale = decimalFormat === 'c' ? 'de-DE' : 'en-US';

    const parts = normalized.split('.');
    const fracLength = parts[1] ? Math.min(parts[1].length, 8) : 0;

    return new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: fracLength,
        useGrouping: true
    }).format(num);
}

// =====================================================
// HTMLRewriter クラス
// =====================================================

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

// =====================================================
// TODO: 定期クリーンアップ（Cron Trigger）
// 期限切れ画像の削除は別途Cron Triggerで実装予定
// [[triggers]]
// crons = ["0 0 * * *"]  # 毎日0時に実行
// =====================================================

