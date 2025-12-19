const path = require("path");
const crypto = require("crypto");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const QRCode = require("qrcode");

const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "dumpling.sqlite");
const DEFAULT_EVENT = process.env.DEFAULT_EVENT || "yun_jiaozi_dongzhi";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

const shareImages = new Map();
const SHARE_IMAGE_TTL_MS = 30 * 60 * 1000;
const SHARE_IMAGE_MAX_ITEMS = 80;

function cleanupShareImages() {
  const now = Date.now();
  for (const [id, item] of shareImages.entries()) {
    if (!item || now - item.createdAt > SHARE_IMAGE_TTL_MS) {
      shareImages.delete(id);
    }
  }
  if (shareImages.size <= SHARE_IMAGE_MAX_ITEMS) return;
  const entries = Array.from(shareImages.entries()).sort((a, b) => a[1].createdAt - b[1].createdAt);
  for (let i = 0; i < entries.length - SHARE_IMAGE_MAX_ITEMS; i++) {
    shareImages.delete(entries[i][0]);
  }
}

setInterval(cleanupShareImages, 60 * 1000).unref?.();

const db = new sqlite3.Database(DB_PATH);
db.serialize(() => {
  db.run(
    "CREATE TABLE IF NOT EXISTS participants (event TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)"
  );
});

function nowIso() {
  return new Date().toISOString();
}

function dbGet(sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbRun(sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ changes: this.changes });
    });
  });
}

async function getParticipantCount(event) {
  const row = await dbGet("SELECT count FROM participants WHERE event = ?", [event]);
  return row ? row.count : 0;
}

async function incrementParticipant(event) {
  const ts = nowIso();
  await dbRun(
    "INSERT INTO participants(event, count, updated_at) VALUES(?, 1, ?) ON CONFLICT(event) DO UPDATE SET count = count + 1, updated_at = excluded.updated_at",
    [event, ts]
  );
  return await getParticipantCount(event);
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/styles.css", (req, res) => {
  res.type("text/css").sendFile(path.join(__dirname, "styles.css"));
});

app.get("/app.js", (req, res) => {
  res.type("application/javascript").sendFile(path.join(__dirname, "app.js"));
});

app.get("/api/participants", async (req, res) => {
  try {
    const event = typeof req.query.event === "string" && req.query.event ? req.query.event : DEFAULT_EVENT;
    const count = await getParticipantCount(event);
    res.json({ event, count });
  } catch (err) {
    res.status(500).json({ error: "internal_error" });
  }
});

app.post("/api/participants", async (req, res) => {
  try {
    const event = typeof req.body?.event === "string" && req.body.event ? req.body.event : DEFAULT_EVENT;
    const count = await incrementParticipant(event);
    res.json({ event, count });
  } catch (err) {
    res.status(500).json({ error: "internal_error" });
  }
});

app.get("/api/share-qr", async (req, res) => {
  try {
    const data = typeof req.query.data === "string" ? req.query.data : "";
    if (!data || data.length > 2048) {
      res.status(400).json({ error: "bad_request" });
      return;
    }
    const buf = await QRCode.toBuffer(data, {
      type: "png",
      width: 280,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#3b2f2a", light: "#ffffff" },
    });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    res.end(buf);
  } catch (err) {
    res.status(500).json({ error: "internal_error" });
  }
});

app.post(
  "/api/share-image",
  express.raw({ type: ["image/png", "image/webp", "application/octet-stream"], limit: "3mb" }),
  (req, res) => {
    try {
      const buf = req.body;
      if (!Buffer.isBuffer(buf) || buf.length < 20) {
        res.status(400).json({ error: "bad_request" });
        return;
      }
      const ct = typeof req.headers["content-type"] === "string" ? req.headers["content-type"] : "application/octet-stream";
      const type = ct === "image/webp" ? "image/webp" : "image/png";
      const id = crypto.randomBytes(16).toString("hex");
      shareImages.set(id, { buf, type, createdAt: Date.now() });
      cleanupShareImages();
      res.setHeader("Cache-Control", "no-store");
      res.json({ url: `/share-image/${id}` });
    } catch (err) {
      res.status(500).json({ error: "internal_error" });
    }
  }
);

app.get("/share-image/:id", (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : "";
  const item = id ? shareImages.get(id) : null;
  if (!item) {
    res.status(404).send("not_found");
    return;
  }
  res.setHeader("Content-Type", item.type);
  res.setHeader("Cache-Control", "no-store");
  const ext = item.type === "image/webp" ? "webp" : "png";
  res.setHeader("Content-Disposition", `inline; filename="dumpling.${ext}"`);
  res.end(item.buf);
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

function listen(port) {
  const server = app.listen(port, () => {
    console.log(`dumplingCloud listening on http://localhost:${port}`);
    console.log(`db: ${DB_PATH}`);
  });

  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      const next = port + 1;
      if (next <= port + 20) {
        listen(next);
        return;
      }
    }
    throw err;
  });
}

listen(PORT);
