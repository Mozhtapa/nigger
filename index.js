// index.js
import fetch from "node-fetch";

// === تنظیمات ===
const AUTH_KEY = "s2pAGvsfNJMdp";           // اینو عوض کن
const WORKER_URL = "https://nigger.pastviewbyme.workers.dev/"; // اینو عوض کن

const SKIP_HEADERS = {
  host: 1,
  connection: 1,
  "content-length": 1,
  "transfer-encoding": 1,
  "proxy-connection": 1,
  "proxy-authorization": 1,
};

// شبیه doPost در Apps Script
async function handleRequest(req) {
  try {
    if (req.k !== AUTH_KEY) return { e: "unauthorized" };

    if (Array.isArray(req.q)) {
      return await doBatch(req.q);
    }
    return await doSingle(req);
  } catch (err) {
    return { e: String(err) };
  }
}

// شبیه _doSingle
async function doSingle(req) {
  if (!req.u || typeof req.u !== "string" || !/^https?:\/\//i.test(req.u)) {
    return { e: "bad url" };
  }

  const payload = buildWorkerPayload(req);

  const resp = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    return { e: "invalid worker response", raw: text };
  }
}

// شبیه _doBatch
async function doBatch(items) {
  const fetchArgs = [];
  const errorMap = {};

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (!item.u || typeof item.u !== "string" || !/^https?:\/\//i.test(item.u)) {
      errorMap[i] = "bad url";
      continue;
    }

    const payload = buildWorkerPayload(item);

    fetchArgs.push({
      _i: i,
      options: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    });
  }

  // در Node.js چیزی به اسم fetchAll نیست، خودمون Parallel انجام می‌دیم
  const promises = fetchArgs.map((arg) =>
    fetch(WORKER_URL, arg.options)
      .then((r) => r.text())
      .then((text) => {
        try {
          return JSON.parse(text);
        } catch (e) {
          return { e: "invalid worker response", raw: text };
        }
      })
  );

  const responses = fetchArgs.length > 0 ? await Promise.all(promises) : [];
  const results = [];
  let rIdx = 0;

  for (let i = 0; i < items.length; i++) {
    if (Object.prototype.hasOwnProperty.call(errorMap, i)) {
      results.push({ e: errorMap[i] });
    } else {
      results.push(responses[rIdx++]);
    }
  }

  return { q: results };
}

// شبیه _buildWorkerPayload
function buildWorkerPayload(req) {
  const headers = {};

  if (req.h && typeof req.h === "object") {
    for (const k in req.h) {
      if (
        Object.prototype.hasOwnProperty.call(req.h, k) &&
        !SKIP_HEADERS[k.toLowerCase()]
      ) {
        headers[k] = req.h[k];
      }
    }
  }

  return {
    u: req.u,
    m: (req.m || "GET").toUpperCase(),
    h: headers,
    b: req.b || null,
    ct: req.ct || null,
    r: req.r !== false,
  };
}

// این نقش main رو دارد؛ توی GitHub Actions این اجرا می‌شود
async function run() {
  // --- اینجا مشخص می‌کنی چه درخواستی می‌خوای بفرستی ---

  // مثال 1: یک درخواست تکی (معادل _doSingle)
  const singleReq = {
    k: AUTH_KEY,
    u: "https://example.com", // هدفی که Worker باید به آن وصل شود
    m: "GET",
    h: {
      "User-Agent": "GitHubActionsRelay",
    },
  };

  const singleResult = await handleRequest(singleReq);
  console.log("Single result:", JSON.stringify(singleResult, null, 2));

  // مثال 2: batch request (معادل _doBatch)
  const batchReq = {
    k: AUTH_KEY,
    q: [
      {
        u: "https://example.com",
        m: "GET",
      },
      {
        u: "https://example.org",
        m: "GET",
      },
    ],
  };

  const batchResult = await handleRequest(batchReq);
  console.log("Batch result:", JSON.stringify(batchResult, null, 2));
}

// اجرای اصلی
run().catch((err) => {
  console.error("Error in run():", err);
  process.exit(1);
});
