import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getCompetenceMeta,
  getDatabaseOptions,
  getWorkbookOverview
} from "./services/database.service.js";
import { generateCharacterWorkbook } from "./services/excel.service.js";
import { parseCharacterWorkbook } from "./services/excel.service.js";
import { sendCharacterWorkbookEmail } from "./services/email.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uiRoot = path.resolve(__dirname, "../ui");

await loadEnvFile(path.resolve(__dirname, ".env"));

const port = Number(process.env.PORT || 3000);

async function loadEnvFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return;
      const [key, ...parts] = trimmed.split("=");
      if (!process.env[key]) process.env[key] = parts.join("=").trim();
    });
  } catch {
    // .env is optional in beta/dev mode.
  }
}

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...extra
  };
}

function sendJson(res, status, data) {
  res.writeHead(status, corsHeaders({ "Content-Type": "application/json; charset=utf-8" }));
  res.end(JSON.stringify(data, null, 2));
}

function sendXlsx(res, filename, buffer) {
  res.writeHead(200, corsHeaders({
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${filename}"`
  }));
  res.end(buffer);
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
  }[ext] || "application/octet-stream";
}

async function sendStatic(req, res, url) {
  if (req.method !== "GET") return false;

  const requestedPath = url.pathname === "/" ? "/arkadia_beta_1.2.html" : decodeURIComponent(url.pathname);
  const filePath = path.resolve(uiRoot, requestedPath.replace(/^\/+/, ""));

  if (!filePath.startsWith(uiRoot)) {
    sendJson(res, 403, { ok: false, message: "Acces refuse." });
    return true;
  }

  try {
    const file = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(file);
    return true;
  } catch {
    return false;
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Requete trop volumineuse."));
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("JSON invalide."));
      }
    });
  });
}

function readBinaryBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;

    req.on("data", chunk => {
      chunks.push(chunk);
      length += chunk.length;
      if (length > 5_000_000) {
        req.destroy();
        reject(new Error("Fichier trop volumineux."));
      }
    });

    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function buildEmailPreview(data) {
  const joueur = data.joueur || {};
  const personnage = data.personnage || {};
  const audit = data.audit || {};
  const animationEmail = process.env.ANIMATION_EMAIL || "vidarmazrim@gmail.com";
  const lines = [
    "Nouvelle fiche Arkadia",
    "",
    `A : ${animationEmail}`,
    `Copie joueur : ${joueur.email || "Non renseignee"}`,
    "",
    `Joueur : ${joueur.nom || "Non renseigne"}`,
    `Personnage : ${personnage.nom || "Non renseigne"}`,
    `Race : ${personnage.race || "Non renseignee"}`,
    `Carriere : ${personnage.carriere || "Non renseignee"}`,
    `Evenements participes : ${audit.eventCountCurrent ?? personnage.evenementsParticipes ?? "0"}`,
    `XP d'evenements : ${(Number(audit.eventCountCurrent ?? personnage.evenementsParticipes) || 0) * 3}`
  ];

  if (audit.eventAbuseWarning) {
    lines.push("", "AVERTISSEMENT ANTI-ABUS", audit.eventAbuseWarning);
  }

  return lines.join("\n");
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, { ok: true, service: "arkadia-backend" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/database/overview") {
      sendJson(res, 200, await getWorkbookOverview());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/database/options") {
      sendJson(res, 200, await getDatabaseOptions());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/database/competences-meta") {
      sendJson(res, 200, await getCompetenceMeta());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/email/envoyer") {
      const data = await readJsonBody(req);
      const workbook = await generateCharacterWorkbook(data);
      const filename = `arkadia_${(data.personnage?.nom || "personnage").replace(/\s+/g, "_")}.xlsx`;
      const emailPreview = buildEmailPreview(data);
      const emailResult = await sendCharacterWorkbookEmail({
        data,
        workbook,
        filename,
        emailPreview
      });

      sendJson(res, 200, {
        ok: true,
        message: emailResult.message,
        sent: emailResult.sent,
        mode: emailResult.mode,
        recipients: emailResult.recipients,
        attachment: {
          filename,
          bytes: workbook.length
        },
        emailPreview
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/fiche/export-xlsx") {
      const data = await readJsonBody(req);
      const workbook = await generateCharacterWorkbook(data);
      const filename = `arkadia_${(data.personnage?.nom || "personnage").replace(/\s+/g, "_")}.xlsx`;
      sendXlsx(res, filename, workbook);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/fiche/import-xlsx") {
      const workbook = await readBinaryBody(req);
      sendJson(res, 200, await parseCharacterWorkbook(workbook));
      return;
    }

    if (await sendStatic(req, res, url)) return;

    sendJson(res, 404, { ok: false, message: "Route introuvable." });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      message: error.message || "Erreur serveur."
    });
  }
});

server.listen(port, () => {
  console.log(`Arkadia backend started on http://localhost:${port}`);
});
