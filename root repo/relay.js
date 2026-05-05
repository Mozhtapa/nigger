/**
 * Relay handler for mhr-cfw GitHub Actions backend.
 *
 * این اسکریپت:
 * 1. JSON ورودی را از stdin می‌خواند (client_payload)
 * 2. auth_key را با RELAY_AUTH_KEY مقایسه می‌کند
 * 3. درخواست HTTP/HTTPS را به مقصد ارسال می‌کند
 * 4. پاسخ را به JSON استاندارد برای کلاینت برمی‌گرداند
 */

const fs = require("fs");
const fetch = require("node-fetch"); // v2

// خواندن کل stdin
function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

(async () => {
  try {
    const raw = await readStdin();

    if (!raw || raw.trim().length === 0) {
      throw new Error("Empty stdin payload");
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (e) {
      throw new Error("Invalid JSON payload from client: " + e.message);
    }

    const {
      auth_key,
      method,
      url,
      headers,
      body
    } = payload;

    const expectedKey = process.env.RELAY_AUTH_KEY;
    if (!expectedKey) {
      throw new Error("RELAY_AUTH_KEY not set in environment");
    }

    if (auth_key !== expectedKey) {
      throw new Error("Invalid auth_key");
    }

    if (!url || !method) {
      throw new Error("Missing url or method in payload");
    }

    const fetchOptions = {
      method: method.toUpperCase(),
      headers: headers || {}
    };

    if (body != null && body !== "") {
      fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    const respBodyBuffer = await response.buffer();
    const respBodyBase64 = respBodyBuffer.toString("base64");

    const result = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      bodyBase64: respBodyBase64
    };

    // خروجی JSON برای کلاینت
    process.stdout.write(JSON.stringify(result));
  } catch (err) {
    const errorResult = {
      ok: false,
      error: err.message || String(err)
    };
    process.stdout.write(JSON.stringify(errorResult));
    process.exit(0);
  }
})();
