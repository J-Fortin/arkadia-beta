import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { parseCharacterWorkbook } from "./excel.service.js";

const execFileAsync = promisify(execFile);
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"]);

const optionAliases = {
  "elf-noir": "elfe-noir",
  "elfe-noir": "elfe-noir",
  "haut-elfe-noldar": "haut-elfe",
  "demi-elfe-peredhil": "demi-elfe",
  "elfe-gris-mitheldar": "elfe-gris",
  "elfe-lunaire-ithileldar": "elfe-lunaire",
  "elfe-sauvage-sylaneldar": "elfe-sauvage",
  "presqu-humain": "presque-humain",
  "maitre-des-runes": "maitre-runes",
  "seigneur-de-guerre": "seigneur-guerre"
};

const moraliteAliases = {
  neutre: "balancee",
  balance: "balancee",
  balancee: "balancee",
  benefique: "benefique",
  malefique: "malefique"
};

const sectionAliases = [
  { key: "joueur", labels: ["informations du joueur", "joueur", "information joueur"] },
  { key: "personnage", labels: ["identite du personnage", "personnage", "fiche personnage"] },
  { key: "xp", labels: ["xp", "xps"] },
  { key: "competencesSpeciales", labels: ["competences speciales", "capacites speciales de l animation"] },
  { key: "sortsSpeciaux", labels: ["sorts speciaux", "sorts speciaux de l animation"] },
  { key: "competences", labels: ["competences"] },
  { key: "sorts", labels: ["sorts"] },
  { key: "evenements", labels: ["historique des evenements", "evenements"] }
];

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fold(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function optionValue(label) {
  const slug = slugify(label);
  return optionAliases[slug] || slug;
}

function moraliteValue(label) {
  const slug = slugify(label);
  return moraliteAliases[slug] || optionValue(label);
}

function normalizeLines(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitLabelValue(line) {
  const cells = line.split(/\t+|\s{2,}/).map((cell) => cell.trim()).filter(Boolean);
  if (cells.length >= 2) return [cells[0], cells.slice(1).join(" ")];

  const colon = line.match(/^(.{2,60}?)[\s:=-]+(.{1,})$/);
  if (colon) return [colon[1].trim(), colon[2].trim()];

  return ["", ""];
}

function findSection(line) {
  const normalized = fold(line);

  for (const section of sectionAliases) {
    if (section.labels.some((label) => normalized === fold(label) || normalized.includes(fold(label)))) {
      return section.key;
    }
  }

  return "";
}

function detectSection(line, currentSection) {
  return findSection(line) || currentSection;
}

function parsePairs(lines) {
  const pairs = new Map();
  let section = "";

  lines.forEach((line, index) => {
    section = detectSection(line, section);

    const [label, sameLineValue] = splitLabelValue(line);
    if (!label) return;

    let value = sameLineValue;
    if (!value && lines[index + 1] && !splitLabelValue(lines[index + 1])[1]) {
      value = lines[index + 1];
    }

    if (!value || fold(label) === fold(value)) return;

    const key = fold(label);
    if (section) pairs.set(`${section}|${key}`, value);
    if (!pairs.has(key)) pairs.set(key, value);
  });

  return pairs;
}

function valueFromPairs(pairs, section, labels) {
  for (const label of labels) {
    const local = pairs.get(`${section}|${fold(label)}`);
    if (local) return local;
  }

  for (const label of labels) {
    const global = pairs.get(fold(label));
    if (global) return global;
  }

  return "";
}

function splitContact(value) {
  const parts = String(value || "").split(/\s+-\s+|\s+\|\s+|[,;]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return { nom: parts[0], tel: parts.slice(1).join(" ") };
  return { nom: value || "", tel: "" };
}

function ouiNon(value) {
  const normalized = fold(value);
  if (normalized.startsWith("oui") || normalized === "yes") return "oui";
  if (normalized.startsWith("non") || normalized === "no") return "non";
  return value || "";
}

function sectionLines(lines, sectionName) {
  const result = [];
  let active = false;

  for (const line of lines) {
    const detected = findSection(line);
    if (detected === sectionName) {
      active = true;
      continue;
    }
    if (active && detected && detected !== sectionName) break;
    if (active) result.push(line);
  }

  return result;
}

function parseCompetences(lines) {
  return sectionLines(lines, "competences").map((line) => {
    const cells = line.split(/\t+|\s{2,}/).map((cell) => cell.trim()).filter(Boolean);
    if (cells.length < 2 || fold(cells[0]).includes("nom")) return null;

    return {
      nom: cells[0],
      freq: cells[1] && !/^\d+$/.test(cells[1]) ? cells[1] : "",
      count: cells.find((cell) => /^\d+$/.test(cell)) || "1",
      xp: cells[cells.length - 1]?.match(/^\d+$/) ? cells[cells.length - 1] : "0"
    };
  }).filter((item) => item?.nom);
}

function parseSorts(lines) {
  return sectionLines(lines, "sorts").map((line) => {
    const cells = line.split(/\t+|\s{2,}/).map((cell) => cell.trim()).filter(Boolean);
    if (cells.length < 2 || fold(cells[0]).includes("ecole")) return null;

    const levelIndex = cells.findIndex((cell) => /^\d+$/.test(cell));
    if (levelIndex === -1) return null;

    return {
      ecole: levelIndex > 0 ? cells.slice(0, levelIndex).join(" ") : "",
      lvl: cells[levelIndex],
      nom: cells[levelIndex + 1] || "",
      xp: cells[cells.length - 1]?.match(/^\d+$/) ? cells[cells.length - 1] : "0"
    };
  }).filter((item) => item?.nom);
}

function parseCompetencesSpeciales(lines) {
  return sectionLines(lines, "competencesSpeciales").map((line) => {
    const cells = line.split(/\t+|\s{2,}/).map((cell) => cell.trim()).filter(Boolean);
    if (cells.length < 2 || fold(cells[0]).includes("nom")) return null;

    return {
      nom: cells[0],
      freq: cells[1] && !/^\d+$/.test(cells[1]) ? cells[1] : "",
      count: cells.find((cell) => /^\d+$/.test(cell)) || "1",
      xp: cells[cells.length - 2]?.match(/^\d+$/) ? cells[cells.length - 2] : cells[cells.length - 1]?.match(/^\d+$/) ? cells[cells.length - 1] : "0",
      note: cells.length > 4 ? cells[cells.length - 1] : ""
    };
  }).filter((item) => item?.nom);
}

function parseSortsSpeciaux(lines) {
  return sectionLines(lines, "sortsSpeciaux").map((line) => {
    const cells = line.split(/\t+|\s{2,}/).map((cell) => cell.trim()).filter(Boolean);
    if (cells.length < 2 || fold(cells[0]).includes("ecole")) return null;

    const levelIndex = cells.findIndex((cell) => /^\d+$/.test(cell));
    if (levelIndex === -1) return null;

    return {
      ecole: levelIndex > 0 ? cells.slice(0, levelIndex).join(" ") : "",
      lvl: cells[levelIndex],
      nom: cells[levelIndex + 1] || "",
      xp: cells[cells.length - 2]?.match(/^\d+$/) ? cells[cells.length - 2] : cells[cells.length - 1]?.match(/^\d+$/) ? cells[cells.length - 1] : "0",
      note: cells.length > levelIndex + 3 ? cells[cells.length - 1] : ""
    };
  }).filter((item) => item?.nom);
}

function parseEvenements(lines) {
  return sectionLines(lines, "evenements").map((line) => {
    const cells = line.split(/\t+|\s{2,}/).map((cell) => cell.trim()).filter(Boolean);
    if (cells.length < 2 || fold(cells[0]).includes("evenement")) return null;
    return { ev: cells[0], saison: cells[1] || "", xp: cells[2] || "3" };
  }).filter((item) => item?.ev);
}

function parseCharacterText(text, sourceLabel) {
  const lines = normalizeLines(text);
  const pairs = parsePairs(lines);

  const contact1 = splitContact(valueFromPairs(pairs, "joueur", [
    "Contact urgence #1",
    "Contact d'urgence #1",
    "Contact de secours #1",
    "Contact secours 1",
    "Urgence 1"
  ]));
  const contact2 = splitContact(valueFromPairs(pairs, "joueur", [
    "Contact urgence #2",
    "Contact d'urgence #2",
    "Contact de secours #2",
    "Contact secours 2",
    "Urgence 2"
  ]));

  const joueur = {
    nom: valueFromPairs(pairs, "joueur", ["Nom du joueur", "Prenom et Nom du joueur", "Nom"]),
    naiss: valueFromPairs(pairs, "joueur", ["Date de naissance", "Naissance"]),
    premier: valueFromPairs(pairs, "joueur", ["Date du 1er Arkadia", "1er Arkadia"]),
    tel: valueFromPairs(pairs, "joueur", ["Telephone", "Tel", "Téléphone"]),
    email: valueFromPairs(pairs, "joueur", ["Courriel", "Email", "E-mail"]),
    allergies: valueFromPairs(pairs, "joueur", ["Allergies"]),
    u1nom: valueFromPairs(pairs, "joueur", ["Contact urgence #1 nom", "Contact secours 1 nom"]) || contact1.nom,
    u1tel: valueFromPairs(pairs, "joueur", ["Contact urgence #1 telephone", "Telephone contact #1", "Telephone contact 1"]) || contact1.tel,
    u2nom: valueFromPairs(pairs, "joueur", ["Contact urgence #2 nom", "Contact secours 2 nom"]) || contact2.nom,
    u2tel: valueFromPairs(pairs, "joueur", ["Contact urgence #2 telephone", "Telephone contact #2", "Telephone contact 2"]) || contact2.tel
  };

  const race = valueFromPairs(pairs, "personnage", ["Race"]);
  const carriere = valueFromPairs(pairs, "personnage", ["Carriere", "Carrière"]);
  const moralite = valueFromPairs(pairs, "personnage", ["Moralite", "Moralité"]);

  const personnage = {
    nom: valueFromPairs(pairs, "personnage", ["Nom du personnage", "Nom"]),
    premier: valueFromPairs(pairs, "personnage", ["Date du 1er evenement", "Date du 1er événement"]),
    race: race ? optionValue(race) : "",
    raceVariant: valueFromPairs(pairs, "personnage", ["Choix racial"]),
    carriere: carriere ? optionValue(carriere) : "",
    religion: valueFromPairs(pairs, "personnage", ["Religion / Divinite", "Religion / Divinité", "Religion", "Divinite", "Divinité"]),
    religion2: valueFromPairs(pairs, "personnage", ["Divinite secondaire", "Divinité secondaire"]),
    moralite: moralite ? moraliteValue(moralite) : "",
    ecole: valueFromPairs(pairs, "personnage", ["Ecole de magie", "École de magie"]),
    ecole2: valueFromPairs(pairs, "personnage", ["Ecole de magie secondaire", "École de magie secondaire", "Ecole secondaire"]),
    noblesse: ouiNon(valueFromPairs(pairs, "personnage", ["Noblesse"])),
    maison: valueFromPairs(pairs, "personnage", ["Maison / Titre", "Maison Noble / Titre", "Maison"]),
    ptsArmure: valueFromPairs(pairs, "personnage", ["Points d'armure", "Armure"]),
    typeArmure: valueFromPairs(pairs, "personnage", ["Type d'armure", "Type armure"]),
    chancesActuelles: valueFromPairs(pairs, "personnage", ["Chances actuelles", "Chances"]),
    chancesMax: valueFromPairs(pairs, "personnage", ["Chances maximum", "Chances max"]),
    faiblesses: valueFromPairs(pairs, "personnage", ["Faiblesses"]),
    immunites: valueFromPairs(pairs, "personnage", ["Immunites", "Immunités"]),
    evenementsParticipes: valueFromPairs(pairs, "xp", ["Evenements participes", "Événements participés"]),
    xpEvenements: valueFromPairs(pairs, "xp", ["XP evenements", "XP événements"]),
    ressources: valueFromPairs(pairs, "personnage", ["Ressources", "Ressources par scenario"]),
    titres: valueFromPairs(pairs, "personnage", ["Titres / capacites", "Titres / capacités", "Titres"]),
    notes: valueFromPairs(pairs, "personnage", ["Notes"]),
    bg: valueFromPairs(pairs, "personnage", ["Background"])
  };

  const data = {
    v: "2.8",
    joueur,
    personnage,
    audit: {
      importSource: sourceLabel,
      eventCountCurrent: Number(personnage.evenementsParticipes) || 0,
      chanceCountCurrent: Number(personnage.chancesActuelles) || 0,
      chanceMax: Number(personnage.chancesMax) || 0
    },
    competences: parseCompetences(lines),
    sorts: parseSorts(lines),
    competencesSpeciales: parseCompetencesSpeciales(lines),
    sortsSpeciaux: parseSortsSpeciaux(lines),
    evenements: parseEvenements(lines)
  };

  const meaningfulFields = [
    joueur.nom,
    joueur.tel,
    joueur.email,
    personnage.nom,
    personnage.race,
    personnage.carriere,
    data.competences.length,
    data.sorts.length,
    data.competencesSpeciales.length,
    data.sortsSpeciaux.length,
    data.evenements.length
  ].filter(Boolean);

  if (meaningfulFields.length === 0) {
    throw new Error(`Import ${sourceLabel} impossible: aucun champ Arkadia lisible n'a ete detecte.`);
  }

  return data;
}

async function runFileTool(command, args) {
  try {
    const { stdout } = await execFileAsync(command, args, {
      encoding: "utf8",
      maxBuffer: 10_000_000,
      timeout: 20_000,
      windowsHide: true
    });
    return stdout || "";
  } catch {
    return "";
  }
}

async function withTempFile(buffer, ext, callback) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "arkadia-import-"));
  const filePath = path.join(dir, `source${ext}`);

  try {
    await fs.writeFile(filePath, buffer);
    return await callback(filePath);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function decodePdfEscapedString(value) {
  return String(value || "")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));
}

function extractLiteralPdfText(buffer) {
  const content = buffer.toString("latin1");
  const chunks = [];

  for (const match of content.matchAll(/\(([^()]*(?:\\.[^()]*)*)\)\s*Tj/g)) {
    chunks.push(decodePdfEscapedString(match[1]));
  }

  for (const match of content.matchAll(/\[((?:\s*\([^()]*(?:\\.[^()]*)*\)\s*)+)\]\s*TJ/g)) {
    for (const part of match[1].matchAll(/\(([^()]*(?:\\.[^()]*)*)\)/g)) {
      chunks.push(decodePdfEscapedString(part[1]));
    }
  }

  return chunks.join("\n");
}

async function extractPdfText(buffer) {
  const text = await withTempFile(buffer, ".pdf", async (filePath) => {
    return await runFileTool("pdftotext", ["-layout", filePath, "-"])
      || await runFileTool("pdftotext", [filePath, "-"]);
  });

  return text.trim() || extractLiteralPdfText(buffer).trim();
}

async function extractImageText(buffer, ext) {
  return await withTempFile(buffer, ext, async (filePath) => {
    return await runFileTool("tesseract", [filePath, "stdout", "-l", "fra+eng"])
      || await runFileTool("tesseract", [filePath, "stdout"]);
  });
}

function extensionFromRequest(filename, contentType) {
  const ext = path.extname(filename || "").toLowerCase();
  if (ext) return ext;
  if (contentType.includes("pdf")) return ".pdf";
  if (contentType.includes("json")) return ".json";
  if (contentType.includes("spreadsheet") || contentType.includes("excel")) return ".xlsx";
  if (contentType.includes("jpeg")) return ".jpg";
  if (contentType.includes("png")) return ".png";
  return "";
}

export async function parseCharacterFile(buffer, { filename = "", contentType = "" } = {}) {
  const ext = extensionFromRequest(filename, contentType);

  if (ext === ".xlsx" || ext === ".xlsm") {
    return parseCharacterWorkbook(buffer);
  }

  if (ext === ".json") {
    return JSON.parse(buffer.toString("utf8"));
  }

  if (ext === ".pdf") {
    const text = await extractPdfText(buffer);
    if (!text) {
      throw new Error("Import PDF impossible: le fichier ne contient pas de texte lisible. Exporte en Excel ou installe l'outil pdftotext/OCR.");
    }
    return parseCharacterText(text, "PDF");
  }

  if (imageExtensions.has(ext)) {
    const text = await extractImageText(buffer, ext);
    if (!text) {
      throw new Error("Import image impossible: OCR non disponible ou aucun texte lisible. Installe Tesseract OCR ou utilise l'export Excel.");
    }
    return parseCharacterText(text, "image");
  }

  throw new Error("Type de fichier non supporte. Formats acceptes: JSON, XLSX, PDF, JPG, JPEG, PNG.");
}
