// --- cookie helpers ---
function setCookie(name, value, days = 365) {
    const d = new Date();
    d.setTime(d.getTime() + days * 86400000);
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/`;
}

function getCookiesObj() {
    const obj = {};
    if (!document.cookie) return obj;
    document.cookie.split("; ").forEach(pair => {
        const i = pair.indexOf("=");
        if (i < 0) return;
        const k = pair.substring(0, i);
        const v = decodeURIComponent(pair.substring(i + 1));
        obj[k] = v;
    });
    return obj;
}

function parseCookieValue(s) {
    if (s === "true" || s === "false") return (s === "true");
    if (!isNaN(Number(s))) return Number(s);
    try {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) return arr;
    } catch {}
    return s;
}

function renderState(data) {
    const out = document.getElementById("output");
    let html = "";
    for (const key in data) {
        const val = data[key];
        if (Array.isArray(val)) {
            html += `<p>${key}: ${val.join(", ")}</p>`;
            setCookie(key, JSON.stringify(val));
        } else {
            html += `<p>${key}: ${val}</p>`;
            setCookie(key, String(val));
        }
    }
    out.innerHTML = html;
}

async function fetchState() {
    try {
        const r = await fetch("http://localhost:5000/state");
        if (!r.ok) throw 0;
        const data = await r.json();
        renderState(data);
    } catch {
        const cookies = getCookiesObj();
        let html = "<p>(From cookies)</p>";
        for (const k in cookies) html += `<p>${k}: ${cookies[k]}</p>`;
        document.getElementById("output").innerHTML = html;
    }
}

async function fetchLog() {
    try {
        const r = await fetch("http://localhost:5000/log");
        if (!r.ok) return;
        const arr = await r.json();
        document.getElementById("log").innerHTML =
            arr.map(line => `<p>${line}</p>`).join("");
    } catch {}
}

async function sendCookiesToServer() {
    const cookies = getCookiesObj();
    const payload = {};
    for (const k in cookies) payload[k] = parseCookieValue(cookies[k]);

    await fetch("http://localhost:5000/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    fetchState();
    fetchLog();
}

async function sendCommand() {
    await fetch("http://localhost:5000/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Command from browser" })
    });
    fetchLog();
}

// buttons
document.getElementById("syncBtn").onclick = sendCookiesToServer;
document.getElementById("sendCmdBtn").onclick = sendCommand;

// polling
setInterval(fetchState, 1000);
setInterval(fetchLog, 1000);

// initial
fetchState();
fetchLog();
