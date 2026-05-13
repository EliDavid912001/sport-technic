require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(process.cwd(), '.env') });

const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const warnedMissingEnvPaths = new Set();

function parseEnvFile(envPath, opts) {
  const map = {};
  const silentIfMissing = opts && opts.silentIfMissing;
  if (!fs.existsSync(envPath)) {
    if (!silentIfMissing && !warnedMissingEnvPaths.has(envPath)) {
      warnedMissingEnvPaths.add(envPath);
      console.error('[env] .env file not found:', envPath);
    }
    return map;
  }
  try {
    let raw = fs.readFileSync(envPath, 'utf8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex <= 0) continue;
      const key = trimmed.slice(0, eqIndex).trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
      if (!key) continue;
      let value = trimmed.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (value) map[key] = value;
    }
  } catch (err) {
    console.error('[env] cannot read .env file:', envPath, err && err.message);
  }
  return map;
}

function slurpEnvVarFromFiles(varName, envPaths) {
  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    try {
      let raw = fs.readFileSync(envPath, 'utf8');
      if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
      for (let line of raw.split(/\r?\n/)) {
        line = String(line || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
        if (!line || line.startsWith('#')) continue;
        const prefix = varName + '=';
        if (!line.startsWith(prefix)) continue;
        let v = line.slice(prefix.length).trim();
        if (
          (v.startsWith('"') && v.endsWith('"')) ||
          (v.startsWith("'") && v.endsWith("'"))
        ) {
          v = v.slice(1, -1);
        }
        v = String(v || '').trim();
        if (v) return v;
      }
    } catch (_) {}
  }
  return '';
}

function loadDotEnv() {
  const cwdMap = parseEnvFile(path.join(process.cwd(), '.env'), { silentIfMissing: true });
  const dirMap = parseEnvFile(path.join(__dirname, '.env'), { silentIfMissing: false });
  const merged = { ...cwdMap, ...dirMap };
  for (const [key, value] of Object.entries(merged)) {
    process.env[key] = value;
  }
}

/** אם משתני מערכת/סדר טעינה השאירו מפתח ריק — קורא שוב ישירות מקבצי .env (ללא דריסת מפתחות אחרים). */
function hydrateMissingAiKeysFromEnvFiles() {
  if (!String(process.env.GEMINI_API_KEY || '').trim()) {
    const fromServerDir = parseEnvFile(path.join(__dirname, '.env'), { silentIfMissing: true });
    if (fromServerDir.GEMINI_API_KEY) process.env.GEMINI_API_KEY = fromServerDir.GEMINI_API_KEY;
  }
  if (!String(process.env.GEMINI_API_KEY || '').trim()) {
    const fromCwd = parseEnvFile(path.join(process.cwd(), '.env'), { silentIfMissing: true });
    if (fromCwd.GEMINI_API_KEY) process.env.GEMINI_API_KEY = fromCwd.GEMINI_API_KEY;
  }
  if (!String(process.env.OPENAI_API_KEY || '').trim()) {
    const fromServerDir = parseEnvFile(path.join(__dirname, '.env'), { silentIfMissing: true });
    if (fromServerDir.OPENAI_API_KEY) process.env.OPENAI_API_KEY = fromServerDir.OPENAI_API_KEY;
  }
  if (!String(process.env.OPENAI_API_KEY || '').trim()) {
    const fromCwd = parseEnvFile(path.join(process.cwd(), '.env'), { silentIfMissing: true });
    if (fromCwd.OPENAI_API_KEY) process.env.OPENAI_API_KEY = fromCwd.OPENAI_API_KEY;
  }
  const envPaths = [path.join(__dirname, '.env'), path.join(process.cwd(), '.env')];
  if (!String(process.env.GEMINI_API_KEY || '').trim()) {
    const v = slurpEnvVarFromFiles('GEMINI_API_KEY', envPaths);
    if (v) process.env.GEMINI_API_KEY = v;
  }
  if (!String(process.env.OPENAI_API_KEY || '').trim()) {
    const v = slurpEnvVarFromFiles('OPENAI_API_KEY', envPaths);
    if (v) process.env.OPENAI_API_KEY = v;
  }
}

let GEMINI_API_KEY = '';
let OPENAI_API_KEY = '';
function refreshAiKeysFromDisk() {
  loadDotEnv();
  hydrateMissingAiKeysFromEnvFiles();
  GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || '').trim();
  OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || '').trim();
}

function analysisKeysConfigured() {
  return !!(GEMINI_API_KEY || OPENAI_API_KEY);
}

refreshAiKeysFromDisk();
const envPathServer = path.join(__dirname, '.env');
const envPathCwd = path.join(process.cwd(), '.env');
console.log('[env] startup cwd:', process.cwd());
console.log('[env] server .env:', envPathServer, fs.existsSync(envPathServer) ? 'found' : 'missing');
console.log('[env] cwd .env:', envPathCwd, fs.existsSync(envPathCwd) ? 'found' : 'missing');
console.log('[env] GEMINI_API_KEY after load:', GEMINI_API_KEY ? 'present' : 'missing');
console.log('[env] OPENAI_API_KEY after load:', OPENAI_API_KEY ? 'present' : 'missing');
if (!analysisKeysConfigured()) {
  console.warn(
    '[env] חסר מפתח ניתוח: צריך לפחות אחד מ־GEMINI_API_KEY או OPENAI_API_KEY בקובץ .env ליד server.js או בתיקיית ההרצה:',
    path.join(__dirname, '.env'),
    '|',
    path.join(process.cwd(), '.env')
  );
}
const PORT = process.env.PORT || 3847;
const GEMINI_MODELS = String(process.env.GEMINI_MODELS || 'gemini-1.5-flash,gemini-2.5-flash')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const AUTH_SECRET = String(process.env.AUTH_SECRET || '').trim();
const ANALYSIS_PROVIDER = String(process.env.ANALYSIS_PROVIDER || 'gemini').trim().toLowerCase();
const MAX_GEMINI_RETRIES = Math.max(1, Number(process.env.MAX_GEMINI_RETRIES || 1));
const GEMINI_TIMEOUT_MS = Math.max(5000, Number(process.env.GEMINI_TIMEOUT_MS || 20000));
const OPENAI_TIMEOUT_MS = Math.max(5000, Number(process.env.OPENAI_TIMEOUT_MS || GEMINI_TIMEOUT_MS));
const GEMINI_MAX_OUTPUT_TOKENS = Math.max(512, Number(process.env.GEMINI_MAX_OUTPUT_TOKENS || 2500));
const MIN_TRANSIENT_RETRIES = Math.max(1, Number(process.env.MIN_TRANSIENT_RETRIES || 1));
const CONSISTENCY_PASSES = 1;
const CACHE_MAX_ITEMS = 30;
const IS_RENDER = String(process.env.RENDER || '').toLowerCase() === 'true';
const REQUESTED_QUEUE_CONCURRENCY = Math.max(1, Number(process.env.ANALYSIS_QUEUE_CONCURRENCY || 1));
const QUEUE_CONCURRENCY = IS_RENDER ? Math.min(1, REQUESTED_QUEUE_CONCURRENCY) || 1 : REQUESTED_QUEUE_CONCURRENCY;
const QUEUE_MAX_SIZE = Math.max(5, Number(process.env.ANALYSIS_QUEUE_MAX_SIZE || 25));
const JOB_TTL_MS = Math.max(60_000, Number(process.env.ANALYSIS_JOB_TTL_MS || 10 * 60_000));
const JOB_MAX_TRANSIENT_RETRIES = Math.max(0, Number(process.env.ANALYSIS_JOB_MAX_TRANSIENT_RETRIES || 2));
const JOB_RETRY_BASE_DELAY_MS = Math.max(300, Number(process.env.ANALYSIS_JOB_RETRY_BASE_DELAY_MS || 2000));
const ALLOW_FALLBACK_ON_OVERLOAD = String(process.env.ALLOW_FALLBACK_ON_OVERLOAD || 'true') === 'true';
const CIRCUIT_FAIL_THRESHOLD = Math.max(2, Number(process.env.CIRCUIT_FAIL_THRESHOLD || 4));
const CIRCUIT_COOLDOWN_MS = Math.max(5_000, Number(process.env.CIRCUIT_COOLDOWN_MS || 20_000));
const MAX_REQUEST_BODY_MB = Math.max(5, Number(process.env.MAX_REQUEST_BODY_MB || 60));
const MAX_REQUEST_BODY_BYTES = Math.floor(MAX_REQUEST_BODY_MB * 1024 * 1024);
const analysisCache = new Map();
const analysisJobs = new Map();
const analysisQueue = [];
let activeAnalysisWorkers = 0;
const circuitState = {
  failures: 0,
  openUntil: 0
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function isPhoneFirstRequest(req) {
  const hdr = req.headers || {};
  const device = String(hdr['x-client-device'] || '').toLowerCase();
  const phoneFirst = String(hdr['x-phone-first'] || '').toLowerCase();
  const ua = String(hdr['user-agent'] || '').toLowerCase();
  if (device === 'mobile' || phoneFirst === '1' || phoneFirst === 'true') return true;
  return /iphone|ipad|ipod|android|mobile/.test(ua);
}

function readJsonBody(req, res) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;
    let responded = false;
    req.on('data', chunk => {
      if (responded) return;
      bytes += chunk.length;
      if (bytes > MAX_REQUEST_BODY_BYTES) {
        responded = true;
        sendJson(res, 413, {
          error: `גודל הבקשה גדול מדי לשרת (${MAX_REQUEST_BODY_MB}MB מקסימום). קצץ את הסרטון או טווח הניתוח ונסה שוב.`
        });
        req.destroy();
        resolve(null);
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (responded) {
        resolve(null);
        return;
      }
      try {
        const parsed = JSON.parse(body || '{}');
        resolve(parsed);
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', err => {
      if (responded) {
        resolve(null);
        return;
      }
      reject(err);
    });
  });
}

function isTransientFailure(statusCode, message) {
  return statusCode === 429 || statusCode === 503 ||
    /high demand|try again later|temporar|timeout|overloaded|unavailable/i.test(message || '');
}

function buildOverloadFallbackText() {
  return JSON.stringify({
    score: 72,
    grade: 'בינוני',
    estimated_reps: 0,
    total_reps: 0,
    good_reps: 0,
    summary: 'המערכת זיהתה עומס זמני במנוע הניתוח המעמיק, לכן הוחזר ניתוח בסיסי כדי לא לעכב אותך.',
    muscles: {
      primary: ['טרם נותח'],
      secondary: ['טרם נותח'],
      stabilizers: ['טרם נותח']
    },
    reps: [],
    fixes: [
      {
        type: 'good',
        title: 'הסרטון נקלט בהצלחה',
        desc: 'הקובץ הגיע לשרת וניתן להריץ עליו ניתוח מלא בניסיון הבא.',
        impact: '+0%'
      },
      {
        type: 'bad',
        title: 'ניתוח מעמיק נדחה זמנית',
        desc: 'בגלל עומס רגעי במנוע, לא הופק דוח ביומכני מלא עבור הסרטון הזה.',
        impact: '-0%'
      }
    ],
    tips: 'נסה שוב בעוד כדקה לקבלת ניתוח מלא.\nמומלץ לצלם בזווית ברורה ובתאורה טובה.\nשמור על פריים יציב כדי לשפר דיוק בניסיון הבא.'
  });
}

function markCircuitFailure() {
  circuitState.failures += 1;
  if (circuitState.failures >= CIRCUIT_FAIL_THRESHOLD) {
    circuitState.openUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
  }
}

function markCircuitSuccess() {
  circuitState.failures = 0;
  circuitState.openUntil = 0;
}

function isCircuitOpen() {
  return Date.now() < circuitState.openUntil;
}

function makeCacheKey(parts) {
  return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

function getCachedResult(cacheKey) {
  if (!analysisCache.has(cacheKey)) return null;
  const value = analysisCache.get(cacheKey);
  analysisCache.delete(cacheKey);
  analysisCache.set(cacheKey, value);
  return value;
}

function setCachedResult(cacheKey, value) {
  if (analysisCache.has(cacheKey)) {
    analysisCache.delete(cacheKey);
  }
  analysisCache.set(cacheKey, value);
  if (analysisCache.size > CACHE_MAX_ITEMS) {
    const oldestKey = analysisCache.keys().next().value;
    analysisCache.delete(oldestKey);
  }
}

function callGemini(parts, model) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
        temperature: 0,
        responseMimeType: 'application/json'
      }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/${model}:generateContent`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const apiReq = https.request(options, apiRes => {
      let data = '';
      apiRes.on('data', chunk => data += chunk);
      apiRes.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (_) {
          // Keep parsed as null, raw body can still help debugging.
        }
        resolve({ statusCode: apiRes.statusCode || 500, body: parsed, raw: data });
      });
    });

    apiReq.setTimeout(GEMINI_TIMEOUT_MS, () => {
      apiReq.destroy(new Error('Gemini request timeout'));
    });
    apiReq.on('error', reject);
    apiReq.write(postData);
    apiReq.end();
  });
}

function partsToOpenAIInput(parts) {
  const out = [];
  for (const part of parts || []) {
    if (part && typeof part.text === 'string') {
      out.push({ type: 'input_text', text: part.text });
      continue;
    }
    if (part && part.inline_data && part.inline_data.data) {
      const mime = part.inline_data.mime_type || 'application/octet-stream';
      out.push({
        type: 'input_image',
        image_url: `data:${mime};base64,${part.inline_data.data}`
      });
    }
  }
  return out;
}

function callOpenAI(parts) {
  return new Promise((resolve, reject) => {
    const input = partsToOpenAIInput(parts);
    const content = input.map(item => {
      if (item.type === 'input_text') {
        return { type: 'text', text: item.text };
      }
      if (item.type === 'input_image') {
        return { type: 'image_url', image_url: { url: item.image_url } };
      }
      return null;
    }).filter(Boolean);
    const postData = JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content }],
      temperature: 0,
      max_tokens: GEMINI_MAX_OUTPUT_TOKENS
    });

    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const apiReq = https.request(options, apiRes => {
      let data = '';
      apiRes.on('data', chunk => data += chunk);
      apiRes.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (_) {
          // keep raw
        }
        resolve({ statusCode: apiRes.statusCode || 500, body: parsed, raw: data });
      });
    });

    apiReq.setTimeout(OPENAI_TIMEOUT_MS, () => {
      apiReq.destroy(new Error('OpenAI request timeout'));
    });
    apiReq.on('error', reject);
    apiReq.write(postData);
    apiReq.end();
  });
}

function extractOpenAIText(openaiRes) {
  if (!openaiRes || typeof openaiRes !== 'object') return '';
  if (Array.isArray(openaiRes.choices) && openaiRes.choices[0] && openaiRes.choices[0].message) {
    const msg = openaiRes.choices[0].message;
    if (typeof msg.content === 'string') return msg.content;
    if (Array.isArray(msg.content)) {
      return msg.content
        .map(part => (part && typeof part.text === 'string' ? part.text : ''))
        .filter(Boolean)
        .join('\n')
        .trim();
    }
  }
  return '';
}

function parseJsonFromText(rawText) {
  const raw = String(rawText || '').trim();
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    throw new Error('No JSON object in model response');
  }
  return JSON.parse(cleaned.slice(first, last + 1));
}

function median(nums) {
  const values = nums.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!values.length) return 0;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

function clampScore(n) {
  if (!Number.isFinite(n)) return 70;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function uniqueCleanStrings(arr, max = 8) {
  const out = [];
  for (const v of arr || []) {
    const s = String(v || '').trim();
    if (!s || out.includes(s)) continue;
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function gradeFromScore(score) {
  if (score >= 86) return 'מצוין';
  if (score >= 75) return 'טוב';
  if (score >= 60) return 'בינוני';
  return 'נדרש שיפור';
}

function aggregateAnalyses(rawTexts) {
  const parsed = rawTexts.map(parseJsonFromText);
  if (parsed.length === 1) {
    return JSON.stringify(parsed[0]);
  }

  const scores = parsed.map(p => Number(p.score));
  const targetScore = median(scores);
  const reference = parsed
    .slice()
    .sort((a, b) => Math.abs(Number(a.score) - targetScore) - Math.abs(Number(b.score) - targetScore))[0];

  const repsCountCandidates = parsed.map(p => Number(p.estimated_reps ?? p.total_reps));
  const estimatedReps = Math.max(0, Math.round(median(repsCountCandidates)));
  const goodReps = Math.max(0, Math.round(median(parsed.map(p => Number(p.good_reps)))));

  const maxRepLen = Math.max(...parsed.map(p => Array.isArray(p.reps) ? p.reps.length : 0), estimatedReps);
  const reps = Array.from({ length: maxRepLen }, (_, idx) => {
    const repScores = parsed
      .map(p => (Array.isArray(p.reps) && p.reps[idx] ? Number(p.reps[idx].score) : NaN))
      .filter(Number.isFinite);
    const repScore = clampScore(median(repScores));
    const note = parsed
      .map(p => (Array.isArray(p.reps) && p.reps[idx] && p.reps[idx].note ? String(p.reps[idx].note).trim() : ''))
      .find(Boolean) || 'ללא הערה מפורטת.';
    return { rep: idx + 1, score: repScore, note };
  });

  const allFixes = [];
  for (const p of parsed) {
    if (!Array.isArray(p.fixes)) continue;
    for (const f of p.fixes) {
      if (!f || !f.title) continue;
      allFixes.push({
        type: f.type === 'good' ? 'good' : 'bad',
        title: String(f.title).trim(),
        desc: String(f.desc || '').trim(),
        impact: String(f.impact || '').trim()
      });
    }
  }
  const fixes = [];
  for (const type of ['bad', 'good']) {
    const byType = allFixes.filter(f => f.type === type);
    for (const f of byType) {
      if (fixes.some(x => x.type === f.type && x.title === f.title)) continue;
      fixes.push(f);
      if (fixes.length >= 6) break;
    }
    if (fixes.length >= 6) break;
  }

  const aggregated = {
    score: clampScore(targetScore),
    grade: gradeFromScore(clampScore(targetScore)),
    estimated_reps: estimatedReps,
    total_reps: estimatedReps,
    good_reps: Math.min(Math.max(goodReps, 0), estimatedReps || goodReps),
    summary: String(reference.summary || '').trim(),
    muscles: {
      primary: uniqueCleanStrings((reference.muscles && reference.muscles.primary) || [], 6),
      secondary: uniqueCleanStrings((reference.muscles && reference.muscles.secondary) || [], 6),
      stabilizers: uniqueCleanStrings((reference.muscles && reference.muscles.stabilizers) || [], 6)
    },
    reps,
    fixes,
    tips: String(reference.tips || '').trim()
  };

  return JSON.stringify(aggregated);
}

async function requestSingleAnalysis(parts) {
  if (isCircuitOpen()) {
    return {
      ok: false,
      lastStatusCode: 503,
      lastErrorMessage: 'Gemini circuit is temporarily open'
    };
  }
  let lastErrorMessage = 'שגיאה מ-Gemini';
  let lastStatusCode = 500;
  const isTransientMessage = msg => /high demand|try again later|temporar|timeout|overloaded/i.test(msg || '');
  const totalAttempts = Math.max(MAX_GEMINI_RETRIES, MIN_TRANSIENT_RETRIES);

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    async function execGeminiPass() {
      if (!GEMINI_API_KEY) return null;
      for (const model of GEMINI_MODELS) {
        let geminiCall;
        try {
          geminiCall = await callGemini(parts, model);
        } catch (netErr) {
          lastErrorMessage = netErr.message || 'Network error';
          lastStatusCode = 503;
          console.log(`Gemini attempt ${attempt}/${totalAttempts} failed (network):`, lastErrorMessage);
          continue;
        }
        const geminiRes = geminiCall.body || {};
        const statusCode = geminiCall.statusCode;
        lastStatusCode = statusCode;

        if (geminiRes.candidates && geminiRes.candidates[0]) {
          const firstPart = geminiRes.candidates[0].content && geminiRes.candidates[0].content.parts
            ? geminiRes.candidates[0].content.parts[0]
            : null;
          const text = firstPart && firstPart.text ? firstPart.text : '';
          try {
            const normalizedText = JSON.stringify(parseJsonFromText(text));
            markCircuitSuccess();
            return { ok: true, text: normalizedText };
          } catch (parseErr) {
            lastErrorMessage = `Invalid JSON from Gemini: ${parseErr.message}`;
            lastStatusCode = 503;
            console.log(`Gemini attempt ${attempt}/${totalAttempts} invalid JSON (${model})`);
            continue;
          }
        }

        const geminiMessage = geminiRes.error && geminiRes.error.message
          ? geminiRes.error.message
          : `Gemini status ${statusCode}`;
        lastErrorMessage = geminiMessage;
        console.log(`Gemini attempt ${attempt}/${totalAttempts} failed (${model}):`, geminiMessage);
      }
      return null;
    }

    async function execOpenAIPass() {
      if (!OPENAI_API_KEY) return null;
      let openaiCall;
      try {
        openaiCall = await callOpenAI(parts);
      } catch (netErr) {
        lastErrorMessage = netErr.message || 'OpenAI network error';
        lastStatusCode = 503;
        console.log(`OpenAI attempt ${attempt}/${totalAttempts} failed (network):`, lastErrorMessage);
        openaiCall = null;
      }
      if (openaiCall) {
        const openaiRes = openaiCall.body || {};
        const statusCode = openaiCall.statusCode;
        lastStatusCode = statusCode;
        const text = extractOpenAIText(openaiRes);
        if (text) {
          try {
            const normalizedText = JSON.stringify(parseJsonFromText(text));
            markCircuitSuccess();
            return { ok: true, text: normalizedText };
          } catch (parseErr) {
            lastErrorMessage = `Invalid JSON from OpenAI: ${parseErr.message}`;
            lastStatusCode = 503;
            console.log(`OpenAI attempt ${attempt}/${totalAttempts} invalid JSON`);
          }
        } else {
          const openaiMessage = openaiRes.error && openaiRes.error.message
            ? openaiRes.error.message
            : `OpenAI status ${statusCode}`;
          lastErrorMessage = openaiMessage;
          console.log(`OpenAI attempt ${attempt}/${totalAttempts} failed:`, openaiMessage);
        }
      }
      return null;
    }

    const openaiFirst = ANALYSIS_PROVIDER === 'openai' && OPENAI_API_KEY;
    const picked = openaiFirst
      ? ((await execOpenAIPass()) || (await execGeminiPass()))
      : ((await execGeminiPass()) || (await execOpenAIPass()));
    if (picked && picked.ok) return picked;

    const transient = lastStatusCode === 429 || lastStatusCode === 503 || isTransientMessage(lastErrorMessage);
    if (!transient) break;
    await sleep(900 * attempt);
  }

  if (isTransientFailure(lastStatusCode, lastErrorMessage)) {
    markCircuitFailure();
  }
  return { ok: false, lastStatusCode, lastErrorMessage };
}

async function runAnalysis(parts) {
  const cacheKey = makeCacheKey(parts);
  const cached = getCachedResult(cacheKey);
  if (cached) {
    return { ok: true, payload: { text: cached, cached: true, passes: 0 } };
  }

  const successfulTexts = [];
  let lastErrorMessage = 'שגיאה מ-Gemini';
  let lastStatusCode = 500;

  for (let pass = 1; pass <= CONSISTENCY_PASSES; pass++) {
    const result = await requestSingleAnalysis(parts);
    if (result.ok) {
      successfulTexts.push(result.text);
    } else {
      lastStatusCode = result.lastStatusCode;
      lastErrorMessage = result.lastErrorMessage;
    }
    if (pass < CONSISTENCY_PASSES) await sleep(180);
  }

  if (successfulTexts.length) {
    let textToReturn;
    try {
      textToReturn = aggregateAnalyses(successfulTexts);
    } catch (_) {
      textToReturn = successfulTexts[0];
    }
    setCachedResult(cacheKey, textToReturn);
    return { ok: true, payload: { text: textToReturn, passes: successfulTexts.length } };
  }

  const noProviderConfigured = !GEMINI_API_KEY && !OPENAI_API_KEY;
  if (ALLOW_FALLBACK_ON_OVERLOAD && noProviderConfigured && isTransientFailure(lastStatusCode, lastErrorMessage)) {
    return {
      ok: true,
      payload: {
        text: buildOverloadFallbackText(),
        passes: 0,
        degraded: true
      }
    };
  }

  return { ok: false, lastStatusCode, lastErrorMessage };
}

function createJob(parts) {
  const id = crypto.randomUUID();
  const job = {
    id,
    status: 'queued',
    attempts: 0,
    maxAttempts: 1 + JOB_MAX_TRANSIENT_RETRIES,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    parts
  };
  analysisJobs.set(id, job);
  analysisQueue.push(id);
  pumpAnalysisQueue();
  return job;
}

function getPublicJob(job) {
  return {
    id: job.id,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    result: job.result,
    error: job.error
  };
}

async function processJob(job) {
  job.status = 'running';
  job.attempts = Number(job.attempts || 0) + 1;
  job.updatedAt = Date.now();
  const result = await runAnalysis(job.parts);
  if (result.ok) {
    job.status = 'done';
    job.result = result.payload;
  } else {
    const transient = isTransientFailure(result.lastStatusCode, result.lastErrorMessage);
    const remainingAttempts = Math.max(0, Number(job.maxAttempts || 1) - Number(job.attempts || 0));
    if (transient && remainingAttempts > 0) {
      const backoffMs = JOB_RETRY_BASE_DELAY_MS * Number(job.attempts || 1);
      job.status = 'queued';
      job.error = undefined;
      job.updatedAt = Date.now();
      setTimeout(() => {
        if (!analysisJobs.has(job.id)) return;
        if (job.status !== 'queued') return;
        analysisQueue.push(job.id);
        pumpAnalysisQueue();
      }, backoffMs).unref();
      return;
    }
    job.status = 'failed';
    job.error = transient
      ? 'יש כרגע עומס זמני על מנוע הניתוח. ניסינו כמה פעמים אוטומטית. נסה שוב בעוד כחצי דקה.'
      : result.lastErrorMessage;
  }
  job.updatedAt = Date.now();
  delete job.parts;
}

function pumpAnalysisQueue() {
  while (activeAnalysisWorkers < QUEUE_CONCURRENCY && analysisQueue.length > 0) {
    const jobId = analysisQueue.shift();
    const job = analysisJobs.get(jobId);
    if (!job || job.status !== 'queued') continue;
    activeAnalysisWorkers += 1;
    processJob(job)
      .catch(err => {
        job.status = 'failed';
        job.error = err.message || 'Job failed';
        job.updatedAt = Date.now();
      })
      .finally(() => {
        activeAnalysisWorkers = Math.max(0, activeAnalysisWorkers - 1);
        pumpAnalysisQueue();
      });
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of analysisJobs.entries()) {
    if (now - job.createdAt > JOB_TTL_MS) {
      analysisJobs.delete(id);
    }
  }
}, 60_000).unref();

const USERS_JSON = path.join(__dirname, 'data', 'users.json');
const SESSION_MAX_MS = 30 * 24 * 60 * 60 * 1000;

function readUsersDb() {
  try {
    return JSON.parse(fs.readFileSync(USERS_JSON, 'utf8'));
  } catch (_) {
    return { users: {}, sessions: {} };
  }
}

function writeUsersDb(db) {
  const dir = path.dirname(USERS_JSON);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(USERS_JSON, JSON.stringify(db), 'utf8');
}

function hashPassword(password, saltHex) {
  const salt = Buffer.from(saltHex, 'hex');
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}

function normalizeUsername(u) {
  return String(u || '').trim().toLowerCase().replace(/[^a-z0-9_]/gi, '');
}

function getBearerToken(req) {
  const h = req.headers && req.headers.authorization;
  if (!h) return '';
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

function getSessionUsername(db, token) {
  if (!token || !db.sessions || !db.sessions[token]) return null;
  const s = db.sessions[token];
  if (Date.now() - (s.createdAt || 0) > SESSION_MAX_MS) return null;
  const un = s.username;
  if (!un || !db.users[un]) return null;
  return un;
}

function pruneSessions(db) {
  const now = Date.now();
  if (!db.sessions) return;
  for (const [tok, s] of Object.entries(db.sessions)) {
    if (now - (s.createdAt || 0) > SESSION_MAX_MS) delete db.sessions[tok];
  }
}

const ANALYSIS_HISTORY_JSON = path.join(__dirname, 'data', 'analysis_history.json');

function ensureLocalDataFiles() {
  try {
    const dir = path.dirname(USERS_JSON);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(USERS_JSON)) {
      fs.writeFileSync(USERS_JSON, JSON.stringify({ users: {}, sessions: {} }), 'utf8');
    }
    if (!fs.existsSync(ANALYSIS_HISTORY_JSON)) {
      fs.writeFileSync(ANALYSIS_HISTORY_JSON, JSON.stringify({ entries: [] }), 'utf8');
    }
  } catch (err) {
    console.warn('[data] ensureLocalDataFiles:', err && err.message);
  }
}

function appendAnalysisHistory(entry) {
  try {
    ensureLocalDataFiles();
    let h = { entries: [] };
    if (fs.existsSync(ANALYSIS_HISTORY_JSON)) {
      h = JSON.parse(fs.readFileSync(ANALYSIS_HISTORY_JSON, 'utf8'));
    }
    if (!Array.isArray(h.entries)) h.entries = [];
    h.entries.push(entry);
    const cap = 5000;
    if (h.entries.length > cap) h.entries = h.entries.slice(-cap);
    fs.writeFileSync(ANALYSIS_HISTORY_JSON, JSON.stringify(h), 'utf8');
  } catch (err) {
    console.warn('[history] appendAnalysisHistory:', err && err.message);
  }
}

ensureLocalDataFiles();

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Client-Device, X-Phone-First, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const reqPathRaw = decodeURIComponent((req.url || '/').split('?')[0]);
  const reqPath = reqPathRaw.replace(/\/+$/, '') || '/';

  if (
    reqPath === '/health' ||
    (req.method === 'POST' && (reqPath === '/analyze' || reqPath === '/analyze/jobs' || reqPath === '/analyze/jobs/batch')) ||
    (req.method === 'GET' && reqPath.startsWith('/analyze/jobs/'))
  ) {
    refreshAiKeysFromDisk();
  }

  if (req.method === 'POST' && reqPath === '/api/register') {
    readJsonBody(req, res).then(parsed => {
      if (!parsed) return;
      const username = normalizeUsername(parsed.username);
      const password = String(parsed.password || '');
      if (username.length < 3 || username.length > 24) {
        sendJson(res, 400, { error: 'שם משתמש: 3–24 תווים (אנגלית, מספרים, קו תחתון)' });
        return;
      }
      if (password.length < 6) {
        sendJson(res, 400, { error: 'סיסמה: לפחות 6 תווים' });
        return;
      }
      const db = readUsersDb();
      if (db.users[username]) {
        sendJson(res, 409, { error: 'שם המשתמש כבר קיים' });
        return;
      }
      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPassword(password, salt);
      db.users[username] = {
        username,
        salt,
        passwordHash,
        progress: {}
      };
      pruneSessions(db);
      writeUsersDb(db);
      sendJson(res, 201, { ok: true, username });
    }).catch(e => sendJson(res, 400, { error: e.message }));
    return;
  }

  if (req.method === 'POST' && reqPath === '/api/login') {
    readJsonBody(req, res).then(parsed => {
      if (!parsed) return;
      const username = normalizeUsername(parsed.username);
      const password = String(parsed.password || '');
      const db = readUsersDb();
      const user = db.users[username];
      if (!user || user.passwordHash !== hashPassword(password, user.salt)) {
        sendJson(res, 401, { error: 'שם משתמש או סיסמה שגויים' });
        return;
      }
      const token = crypto.randomBytes(24).toString('hex');
      db.sessions = db.sessions || {};
      db.sessions[token] = { username, createdAt: Date.now() };
      pruneSessions(db);
      writeUsersDb(db);
      sendJson(res, 200, { ok: true, token, username });
    }).catch(e => sendJson(res, 400, { error: e.message }));
    return;
  }

  if (req.method === 'POST' && reqPath === '/api/logout') {
    readJsonBody(req, res).then(parsed => {
      if (!parsed) return;
      const token = String(parsed.token || getBearerToken(req) || '').trim();
      if (!token) {
        sendJson(res, 400, { error: 'Missing token' });
        return;
      }
      const db = readUsersDb();
      if (db.sessions && db.sessions[token]) delete db.sessions[token];
      writeUsersDb(db);
      sendJson(res, 200, { ok: true });
    }).catch(e => sendJson(res, 400, { error: e.message }));
    return;
  }

  if (req.method === 'GET' && reqPath === '/api/me') {
    const db = readUsersDb();
    const username = getSessionUsername(db, getBearerToken(req));
    if (!username) {
      sendJson(res, 401, { error: 'לא מחובר' });
      return;
    }
    sendJson(res, 200, { ok: true, username });
    return;
  }

  if (req.method === 'GET' && reqPath === '/api/progress') {
    const db = readUsersDb();
    const username = getSessionUsername(db, getBearerToken(req));
    if (!username) {
      sendJson(res, 401, { error: 'נדרשת התחברות' });
      return;
    }
    const q = new URL(req.url || '', 'http://localhost').searchParams;
    const exerciseKey = String(q.get('exerciseKey') || '').trim().toLowerCase();
    if (!exerciseKey) {
      sendJson(res, 400, { error: 'חסר exerciseKey' });
      return;
    }
    const user = db.users[username];
    const list = (user && user.progress && user.progress[exerciseKey]) || [];
    sendJson(res, 200, { entries: list });
    return;
  }

  if (req.method === 'POST' && reqPath === '/api/progress') {
    readJsonBody(req, res).then(parsed => {
      if (!parsed) return;
      const db = readUsersDb();
      const username = getSessionUsername(db, getBearerToken(req));
      if (!username) {
        sendJson(res, 401, { error: 'נדרשת התחברות' });
        return;
      }
      const exerciseKey = String(parsed.exerciseKey || '').trim().toLowerCase();
      const score = Number(parsed.score);
      if (!exerciseKey || !Number.isFinite(score)) {
        sendJson(res, 400, { error: 'exerciseKey ו-score נדרשים' });
        return;
      }
      const user = db.users[username];
      user.progress = user.progress || {};
      if (!Array.isArray(user.progress[exerciseKey])) user.progress[exerciseKey] = [];
      user.progress[exerciseKey].push({ at: Date.now(), score: Math.max(0, Math.min(100, Math.round(score))) });
      const cap = 200;
      if (user.progress[exerciseKey].length > cap) {
        user.progress[exerciseKey] = user.progress[exerciseKey].slice(-cap);
      }
      writeUsersDb(db);
      appendAnalysisHistory({
        at: Date.now(),
        username,
        exerciseKey,
        score: Math.max(0, Math.min(100, Math.round(score)))
      });
      sendJson(res, 200, { ok: true, count: user.progress[exerciseKey].length });
    }).catch(e => sendJson(res, 400, { error: e.message }));
    return;
  }

  if (req.method === 'GET' && reqPath === '/health') {
    refreshAiKeysFromDisk();
    const geminiInProcessEnv = !!String(process.env.GEMINI_API_KEY || '').trim();
    const openaiInProcessEnv = !!String(process.env.OPENAI_API_KEY || '').trim();
    sendJson(res, 200, {
      ok: true,
      providers: {
        gemini: GEMINI_API_KEY ? 'on' : 'off',
        openai: OPENAI_API_KEY ? 'on' : 'off',
        openai_optional: true
      },
      process_env: {
        GEMINI_API_KEY_present: geminiInProcessEnv,
        OPENAI_API_KEY_present: openaiInProcessEnv
      },
      gemini_ready: !!GEMINI_API_KEY,
      analysis_ready: !!(GEMINI_API_KEY || OPENAI_API_KEY),
      analysis_provider: ANALYSIS_PROVIDER,
      gemini_models: GEMINI_MODELS,
      auth_secret_configured: !!AUTH_SECRET,
      data_dir: path.join(__dirname, 'data'),
      users_store: 'users.json',
      analysis_history_store: 'analysis_history.json',
      queue: {
        queued: analysisQueue.length,
        running: activeAnalysisWorkers
      },
      circuitOpen: isCircuitOpen()
    });
    return;
  }

  if (req.method === 'POST' && reqPath === '/analyze/jobs') {
    refreshAiKeysFromDisk();
    if (!analysisKeysConfigured()) {
      console.error('[env] אין מפתח ניתוח אחרי refreshAiKeysFromDisk. צפוי .env ב:', path.join(__dirname, '.env'), '| cwd:', process.cwd());
      sendJson(res, 500, { error: 'חסר מפתח ניתוח בשרת. הגדר בקובץ .env ליד server.js לפחות אחד: GEMINI_API_KEY או OPENAI_API_KEY, והרץ node server.js מאותה תיקייה.' });
      return;
    }
    if ((analysisQueue.length + activeAnalysisWorkers) >= QUEUE_MAX_SIZE) {
      sendJson(res, 429, { error: 'התור מלא כרגע. נסה שוב בעוד מספר שניות.' });
      return;
    }
    readJsonBody(req, res).then(async parsed => {
      if (!parsed) return;
      if (!Array.isArray(parsed.parts) || !parsed.parts.length) {
        sendJson(res, 400, { error: 'Missing parts[] in request body' });
        return;
      }
      if (isPhoneFirstRequest(req)) {
        const result = await runAnalysis(parsed.parts);
        if (result.ok) {
          sendJson(res, 200, {
            id: `direct-${Date.now()}`,
            status: 'done',
            result: { text: result.payload.text || '' },
            phone_first_bypass: true
          });
          return;
        }
        const friendlyLoadError = isTransientFailure(result.lastStatusCode, result.lastErrorMessage);
        sendJson(res, friendlyLoadError ? 503 : 400, {
          error: friendlyLoadError
            ? 'הניתוח מתעכב כרגע. נסה שוב אחרי שיפור תאורה והתקרבות קלה למצלמה.'
            : (result.lastErrorMessage || 'ניתוח ישיר נכשל')
        });
        return;
      }
      const job = createJob(parsed.parts);
      sendJson(res, 202, getPublicJob(job));
    }).catch(e => {
      sendJson(res, 400, { error: e.message });
    });
    return;
  }

  if (req.method === 'POST' && reqPath === '/analyze/jobs/batch') {
    refreshAiKeysFromDisk();
    if (!analysisKeysConfigured()) {
      console.error('[env] אין מפתח ניתוח אחרי refreshAiKeysFromDisk. צפוי .env ב:', path.join(__dirname, '.env'), '| cwd:', process.cwd());
      sendJson(res, 500, { error: 'חסר מפתח ניתוח בשרת. הגדר בקובץ .env ליד server.js לפחות אחד: GEMINI_API_KEY או OPENAI_API_KEY, והרץ node server.js מאותה תיקייה.' });
      return;
    }
    readJsonBody(req, res).then(parsed => {
      if (!parsed) return;
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      if (!items.length) {
        sendJson(res, 400, { error: 'Missing items[] in request body' });
        return;
      }
      const freeSlots = Math.max(0, QUEUE_MAX_SIZE - (analysisQueue.length + activeAnalysisWorkers));
      if (items.length > freeSlots) {
        sendJson(res, 429, {
          error: 'התור מלא כרגע לחבילת ניתוחים. נסה פחות סרטונים בכל בקשה.',
          free_slots: freeSlots
        });
        return;
      }
      const jobs = [];
      for (const item of items) {
        if (!item || !Array.isArray(item.parts) || !item.parts.length) continue;
        const job = createJob(item.parts);
        jobs.push({
          client_id: item.client_id || null,
          job_id: job.id,
          status: job.status
        });
      }
      if (!jobs.length) {
        sendJson(res, 400, { error: 'No valid items with parts[] found' });
        return;
      }
      sendJson(res, 202, { jobs });
    }).catch(e => {
      sendJson(res, 400, { error: e.message });
    });
    return;
  }

  if (req.method === 'GET' && reqPath.startsWith('/analyze/jobs/')) {
    const jobId = reqPath.slice('/analyze/jobs/'.length).trim();
    const job = analysisJobs.get(jobId);
    if (!job) {
      sendJson(res, 404, { error: 'Job not found' });
      return;
    }
    sendJson(res, 200, getPublicJob(job));
    return;
  }

  if (req.method === 'POST' && reqPath === '/analyze') {
    refreshAiKeysFromDisk();
    if (!analysisKeysConfigured()) {
      console.error('[env] אין מפתח ניתוח אחרי refreshAiKeysFromDisk. צפוי .env ב:', path.join(__dirname, '.env'), '| cwd:', process.cwd());
      sendJson(res, 500, { error: 'חסר מפתח ניתוח בשרת. הגדר בקובץ .env ליד server.js לפחות אחד: GEMINI_API_KEY או OPENAI_API_KEY, והרץ node server.js מאותה תיקייה.' });
      return;
    }
    readJsonBody(req, res).then(async parsed => {
      if (!parsed) return;
      try {
        const parts = parsed.parts;
        if (!Array.isArray(parts) || !parts.length) {
          sendJson(res, 400, { error: 'Missing parts[] in request body' });
          return;
        }
        const result = await runAnalysis(parts);
        if (result.ok) {
          sendJson(res, 200, result.payload);
          return;
        }

        const friendlyLoadError = isTransientFailure(result.lastStatusCode, result.lastErrorMessage);
        sendJson(res, friendlyLoadError ? 503 : 400, {
          error: friendlyLoadError
            ? 'יש כרגע עומס זמני על מנוע הניתוח. המערכת ניסתה שוב אוטומטית ולא הצליחה. נסה שוב בעוד חצי דקה.'
            : result.lastErrorMessage
        });

      } catch (e) {
        console.log('Error:', e.message);
        sendJson(res, 400, { error: e.message });
      }
    }).catch(e => {
      sendJson(res, 400, { error: e.message });
    });
    return;
  }

  const relativePath = reqPath === '/' ? 'index.html' : reqPath.replace(/^\/+/, '');
  const filePath = path.resolve(__dirname, relativePath);

  if (!filePath.startsWith(path.resolve(__dirname))) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache'
    });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  refreshAiKeysFromDisk();
  if (IS_RENDER && !AUTH_SECRET) {
    console.warn('[env] אזהרה: AUTH_SECRET ריק — מומלץ להגדיר ב-Render/hosting לחתימת סשנים חזקה יותר.');
  }
  let envWatchTimer = null;
  function scheduleEnvReload(tag) {
    if (envWatchTimer) clearTimeout(envWatchTimer);
    envWatchTimer = setTimeout(() => {
      envWatchTimer = null;
      refreshAiKeysFromDisk();
      console.log('[env] reloaded keys from disk (' + tag + ')');
    }, 300);
  }
  const envWatchPaths = [];
  if (fs.existsSync(envPathServer)) envWatchPaths.push(envPathServer);
  if (fs.existsSync(envPathCwd) && envPathCwd !== envPathServer) envWatchPaths.push(envPathCwd);
  for (const p of envWatchPaths) {
    try {
      fs.watch(p, { persistent: false }, () => scheduleEnvReload(p));
    } catch (e) {
      console.warn('[env] fs.watch failed:', p, e && e.message);
    }
  }
  console.log('');
  console.log('  AI Coach פועל!');
  console.log('  http://127.0.0.1:' + PORT + '  (או http://localhost:' + PORT + ')');
  console.log('  Providers: Gemini=' + (GEMINI_API_KEY ? 'on' : 'off') + ', OpenAI=' + (OPENAI_API_KEY ? 'on' : 'off') + ' (optional)');
  console.log('');
});
