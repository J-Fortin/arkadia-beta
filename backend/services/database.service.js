import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workbookPath = path.resolve(
  __dirname,
  "../../database/source/Fiche-de-joueur-V1.3.xlsx"
);

let workbookCache;
let workbookMtimeMs = 0;

function decodeXml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const valueAliases = {
  combatant: "combattant",
  "etre-sylvestre-terre": "etre-sylvestre",
  "etre-sylvestre-eau": "etre-sylvestre",
  "etre-sylvestre-feu": "etre-sylvestre",
  "etre-sylvestre-air": "etre-sylvestre",
  "presqu-humain": "presque-humain",
  "saurien-phrynos": "saurien",
  "saurien-slann": "saurien",
  "saurien-coatl": "saurien",
  "saurien-troglodon": "saurien",
  "maitre-des-runes": "maitre-runes",
  "seigneur-de-guerre": "seigneur-guerre"
};

const religionAliases = {
  "essence-infernale": "Essence infernale",
  "esprits-de-la-nature": "Esprits de la Nature",
  "esprits-des-morts": "Esprits des Morts"
};

function optionValue(label) {
  const slug = slugify(label);
  return valueAliases[slug] || slug;
}

function religionValue(label) {
  const slug = slugify(label);
  return religionAliases[slug] || label;
}

function colToNumber(colRef) {
  return colRef.split("").reduce((sum, char) => {
    return sum * 26 + char.charCodeAt(0) - 64;
  }, 0);
}

function uniqueOptions(options) {
  const seen = new Set();

  return options.filter((option) => {
    if (!option.label || seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

function sheetValue(value) {
  const text = String(value || "").trim();
  if (!text || text === "0" || text.startsWith("#")) return "";
  return text;
}

function sheetNumber(value) {
  const text = sheetValue(value).replace(",", ".");
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function sheetBoolean(value) {
  const text = sheetValue(value).toLowerCase();
  return text === "1" || text === "true" || text === "oui" || text === "yes";
}

function addUniqueMappedValue(map, key, value) {
  if (!key || !value) return;
  if (!map[key]) map[key] = [];
  if (!map[key].includes(value)) map[key].push(value);
}

function cleanListValue(value) {
  return sheetValue(value).replace(/\s*\/\s*$/, "").trim();
}

function isNameValue(value) {
  const text = sheetValue(value);
  return Boolean(text && !/^-?\d+(\.\d+)?$/.test(text));
}

function pushUniqueValue(list, value) {
  if (value && !list.includes(value)) list.push(value);
}

function addMappedListValue(map, key, value) {
  if (!key || !value) return;
  if (!map[key]) map[key] = [];
  pushUniqueValue(map[key], value);
}

function uniqueByKey(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readZipEntries(buffer) {
  const entries = new Map();
  let eocdOffset = -1;

  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) throw new Error("Archive XLSX invalide.");

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let centralOffset = buffer.readUInt32LE(eocdOffset + 16);

  for (let i = 0; i < totalEntries; i++) {
    if (buffer.readUInt32LE(centralOffset) !== 0x02014b50) {
      throw new Error("Répertoire ZIP invalide.");
    }

    const method = buffer.readUInt16LE(centralOffset + 10);
    const compressedSize = buffer.readUInt32LE(centralOffset + 20);
    const fileNameLength = buffer.readUInt16LE(centralOffset + 28);
    const extraLength = buffer.readUInt16LE(centralOffset + 30);
    const commentLength = buffer.readUInt16LE(centralOffset + 32);
    const localOffset = buffer.readUInt32LE(centralOffset + 42);
    const nameStart = centralOffset + 46;
    const name = buffer.toString("utf8", nameStart, nameStart + fileNameLength);

    entries.set(name, { method, compressedSize, localOffset });
    centralOffset = nameStart + fileNameLength + extraLength + commentLength;
  }

  return {
    text(name) {
      const entry = entries.get(name);
      if (!entry) throw new Error(`Fichier XLSX manquant: ${name}`);
      const { method, compressedSize, localOffset } = entry;

      if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
        throw new Error(`Entrée ZIP invalide: ${name}`);
      }

      const fileNameLength = buffer.readUInt16LE(localOffset + 26);
      const extraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + fileNameLength + extraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

      if (method === 0) return compressed.toString("utf8");
      if (method === 8) return zlib.inflateRawSync(compressed).toString("utf8");
      throw new Error(`Compression ZIP non supportée: ${method}`);
    }
  };
}

function parseSharedStrings(xml) {
  const strings = [];
  const itemRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let itemMatch;

  while ((itemMatch = itemRegex.exec(xml))) {
    const textParts = [...itemMatch[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)];
    strings.push(decodeXml(textParts.map((match) => match[1]).join("")));
  }

  return strings;
}

function parseWorkbook(zip) {
  const workbookXml = zip.text("xl/workbook.xml");
  const relsXml = zip.text("xl/_rels/workbook.xml.rels");
  const rels = {};
  const sheets = {};

  for (const match of relsXml.matchAll(/<Relationship\b([^>]+)>/g)) {
    const attrs = match[1];
    const id = attrs.match(/\bId="([^"]+)"/)?.[1];
    const target = attrs.match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) rels[id] = target;
  }

  for (const match of workbookXml.matchAll(/<sheet\b([^>]+)>/g)) {
    const attrs = match[1];
    const name = decodeXml(attrs.match(/\bname="([^"]+)"/)?.[1]);
    const sheetId = attrs.match(/\bsheetId="([^"]+)"/)?.[1];
    const relId = attrs.match(/\br:id="([^"]+)"/)?.[1];
    if (name && rels[relId]) {
      sheets[name] = {
        id: Number(sheetId),
        path: `xl/${rels[relId]}`
      };
    }
  }

  return sheets;
}

function parseSheet(xml, sharedStrings) {
  const rows = new Map();
  let rowCount = 0;
  let columnCount = 0;

  for (const rowMatch of xml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(rowMatch[1]);
    const cells = new Map();

    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = attrs.match(/\br="([A-Z]+)\d+"/)?.[1];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      if (!ref) continue;

      const colNumber = colToNumber(ref);
      const rawValue = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] || "";
      const inlineText = body.match(/<t\b[^>]*>([\s\S]*?)<\/t>/)?.[1] || "";
      let value = rawValue;

      if (type === "s") value = sharedStrings[Number(rawValue)] || "";
      if (type === "inlineStr") value = decodeXml(inlineText);
      value = decodeXml(value).trim();

      if (value) cells.set(colNumber, value);
      columnCount = Math.max(columnCount, colNumber);
    }

    rows.set(rowNumber, cells);
    rowCount = Math.max(rowCount, rowNumber);
  }

  return {
    rowCount,
    columnCount,
    cell(row, col) {
      return rows.get(row)?.get(col) || "";
    }
  };
}

async function readWorkbook() {
  const stats = await fs.stat(workbookPath);
  if (workbookCache && workbookMtimeMs === stats.mtimeMs) return workbookCache;

  const buffer = await fs.readFile(workbookPath);
  const zip = readZipEntries(buffer);
  const sharedStrings = parseSharedStrings(zip.text("xl/sharedStrings.xml"));
  const sheets = parseWorkbook(zip);

  workbookCache = {
    source: workbookPath,
    worksheets: Object.entries(sheets).map(([name, sheet]) => {
      const parsed = parseSheet(zip.text(sheet.path), sharedStrings);
      return { name, id: sheet.id, ...parsed };
    }),
    getWorksheet(name) {
      return this.worksheets.find((sheet) => sheet.name === name);
    }
  };
  workbookMtimeMs = stats.mtimeMs;

  return workbookCache;
}

export async function getWorkbookOverview() {
  const workbook = await readWorkbook();

  return {
    source: workbook.source,
    sheets: workbook.worksheets.map((sheet) => ({
      id: sheet.id,
      name: sheet.name,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount
    }))
  };
}

export async function getDatabaseOptions() {
  const workbook = await readWorkbook();
  const dataSheet = workbook.getWorksheet("Données");
  const magicSheet = workbook.getWorksheet("Magie");
  const schoolRestrictionSheet = workbook.getWorksheet("Restriction d'école");
  const careerRestrictionSheet = workbook.getWorksheet("Restriction de carrière");
  const moralityRestrictionSheet = workbook.getWorksheet("Restriction de moralité");
  const divinityRestrictionSheet = workbook.getWorksheet("Restriction de divinité");
  const competenceSheet = workbook.getWorksheet("Compétences");
  const weaknessSheet = workbook.getWorksheet("Faiblesses");
  const immunitySheet = workbook.getWorksheet("Immunités");

  const races = [];
  const carrieres = [];
  const religions = [];
  const moralites = [];
  const ecoles = [];
  const ecolesParCarriere = {};
  const ecolesParDivinite = {};
  const sorts = {};
  let careerIndex = 0;
  const carrieresPermisesParRace = {};
  const moralitesPermisesParRace = {};
  const divinitesPermisesParRace = {};
  const faiblessesParRace = {};
  const faiblessesParCarriereMoralite = {};
  const immunitesParRace = {};
  const immunitesParCarriere = {};
  const immunitesParCompetence = {};
  const competences = [];

  for (let row = 3; row <= dataSheet.rowCount; row++) {
    const race = dataSheet.cell(row, 3);
    const carriere = dataSheet.cell(row, 8);
    const religion = dataSheet.cell(row, 12);
    const moralite = dataSheet.cell(row, 14);

    if (race) {
      races.push({
        value: optionValue(race),
        label: race,
        xp: sheetNumber(dataSheet.cell(row, 4)),
        pvJour: sheetNumber(dataSheet.cell(row, 5)),
        pvNuit: sheetNumber(dataSheet.cell(row, 6))
      });
    }
    if (carriere) {
      careerIndex++;
      carrieres.push({
        value: optionValue(carriere),
        label: carriere,
        mixte: careerIndex > 7,
        armurePermise: sheetNumber(dataSheet.cell(row, 9)),
        typeArmure: sheetValue(dataSheet.cell(row, 10)),
        ptsMagie: sheetNumber(dataSheet.cell(row, 17)),
        semiMagique: sheetBoolean(dataSheet.cell(row, 18)),
        maxMagique: sheetNumber(dataSheet.cell(row, 19))
      });
    }
    if (religion) religions.push({ value: religionValue(religion), label: religion });
    if (moralite) moralites.push({ value: optionValue(moralite), label: moralite });
  }

  for (let row = 3; row <= magicSheet.rowCount; row++) {
    const ecole = sheetValue(magicSheet.cell(row, 1));
    const nom = sheetValue(magicSheet.cell(row, 2));
    const xp = sheetNumber(magicSheet.cell(row, 3));
    const niveau = sheetNumber(magicSheet.cell(row, 4));

    if (ecole) ecoles.push({ value: ecole, label: ecole });
    if (ecole && nom && niveau) {
      const levelKey = String(niveau);
      if (!sorts[ecole]) sorts[ecole] = {};
      if (!sorts[ecole][levelKey]) sorts[ecole][levelKey] = [];
      if (!sorts[ecole][levelKey].some((sort) => sort.nom === nom)) {
        sorts[ecole][levelKey].push({ nom, xp });
      }
    }
  }

  if (schoolRestrictionSheet) {
    for (let row = 2; row <= schoolRestrictionSheet.rowCount; row++) {
      const carriere = sheetValue(schoolRestrictionSheet.cell(row, 5));
      const ecoleCarriere = sheetValue(schoolRestrictionSheet.cell(row, 6));
      const divinite = sheetValue(schoolRestrictionSheet.cell(row, 8));
      const ecoleDivinite = sheetValue(schoolRestrictionSheet.cell(row, 9));

      addUniqueMappedValue(ecolesParCarriere, optionValue(carriere), ecoleCarriere);
      addUniqueMappedValue(ecolesParDivinite, religionValue(divinite), ecoleDivinite);
    }
  }

  if (careerRestrictionSheet) {
    for (let row = 3; row <= careerRestrictionSheet.rowCount; row++) {
      const race = sheetValue(careerRestrictionSheet.cell(row, 4));
      const carriere = sheetValue(careerRestrictionSheet.cell(row, 5));
      addMappedListValue(carrieresPermisesParRace, optionValue(race), optionValue(carriere));
    }
  }

  if (moralityRestrictionSheet) {
    for (let row = 2; row <= moralityRestrictionSheet.rowCount; row++) {
      const race = sheetValue(moralityRestrictionSheet.cell(row, 4));
      const moralite = sheetValue(moralityRestrictionSheet.cell(row, 5));
      addMappedListValue(moralitesPermisesParRace, optionValue(race), optionValue(moralite));
    }
  }

  if (divinityRestrictionSheet) {
    for (let row = 2; row <= divinityRestrictionSheet.rowCount; row++) {
      const race = sheetValue(divinityRestrictionSheet.cell(row, 7));
      const divinite = sheetValue(divinityRestrictionSheet.cell(row, 8));
      addMappedListValue(divinitesPermisesParRace, optionValue(race), religionValue(divinite));
    }
  }

  if (weaknessSheet) {
    for (let row = 3; row <= weaknessSheet.rowCount; row++) {
      const race = sheetValue(weaknessSheet.cell(row, 2));
      [3, 4, 5].forEach((col) => {
        addMappedListValue(faiblessesParRace, optionValue(race), cleanListValue(weaknessSheet.cell(row, col)));
      });

      const carriere = sheetValue(weaknessSheet.cell(row, 8));
      const moralite = optionValue(weaknessSheet.cell(row, 9));
      const key = `${optionValue(carriere)}|${moralite}`;
      [11, 12].forEach((col) => {
        addMappedListValue(faiblessesParCarriereMoralite, key, cleanListValue(weaknessSheet.cell(row, col)));
      });
    }
  }

  if (immunitySheet) {
    for (let row = 3; row <= immunitySheet.rowCount; row++) {
      const race = sheetValue(immunitySheet.cell(row, 2));
      [3, 4, 5, 6].forEach((col) => {
        addMappedListValue(immunitesParRace, optionValue(race), cleanListValue(immunitySheet.cell(row, col)));
      });

      const carriere = sheetValue(immunitySheet.cell(row, 9));
      addMappedListValue(immunitesParCarriere, optionValue(carriere), cleanListValue(immunitySheet.cell(row, 10)));

      const competence = sheetValue(immunitySheet.cell(row, 12));
      addMappedListValue(immunitesParCompetence, competence, cleanListValue(immunitySheet.cell(row, 13)));
    }
  }

  if (competenceSheet) {
    const baseXpByName = new Map();

    for (let row = 3; row <= competenceSheet.rowCount; row++) {
      const nom = sheetValue(competenceSheet.cell(row, 8));
      const xp = sheetNumber(competenceSheet.cell(row, 9));
      const carriere = sheetValue(competenceSheet.cell(row, 10));
      const cumulableMax = sheetNumber(competenceSheet.cell(row, 11)) || 1;

      if (!isNameValue(nom)) continue;

      const option = {
        nom,
        xp,
        cat: carriere ? `Carrière - ${carriere}` : "Générale",
        carriere: carriere ? optionValue(carriere) : "",
        cumulableMax
      };

      competences.push(option);
      if (!baseXpByName.has(nom) || xp < baseXpByName.get(nom)) baseXpByName.set(nom, xp);
    }

    for (let row = 3; row <= competenceSheet.rowCount; row++) {
      const race = sheetValue(competenceSheet.cell(row, 17));
      const nom = sheetValue(competenceSheet.cell(row, 18));
      const xpDelta = sheetNumber(competenceSheet.cell(row, 21));
      const baseXp = baseXpByName.get(nom);

      if (!isNameValue(race) || !isNameValue(nom) || baseXp === undefined) continue;

      competences.push({
        nom,
        xp: Math.max(0, baseXp + xpDelta),
        cat: "Raciale",
        race: optionValue(race),
        note: xpDelta < 0 ? "rabais racial" : "",
        cumulableMax: 1
      });
    }
  }

  return {
    races: uniqueOptions(races),
    carrieres: uniqueOptions(carrieres),
    religions: uniqueOptions(religions),
    moralites: uniqueOptions(moralites),
    ecoles: uniqueOptions(ecoles),
    ecolesParCarriere,
    ecolesParDivinite,
    sorts,
    carrieresPermisesParRace,
    moralitesPermisesParRace,
    divinitesPermisesParRace,
    faiblessesParRace,
    faiblessesParCarriereMoralite,
    immunitesParRace,
    immunitesParCarriere,
    immunitesParCompetence,
    competences: uniqueByKey(competences, (option) => [
      option.cat,
      option.nom,
      option.race || "",
      option.carriere || ""
    ].join("|"))
  };
}

export async function getCompetenceMeta() {
  const workbook = await readWorkbook();
  const sheet = workbook.getWorksheet("Compétences");
  const meta = {};

  function ensureEntry(name) {
    if (!meta[name]) {
      meta[name] = {
        categorie: "",
        frequence: ""
      };
    }

    return meta[name];
  }

  for (let row = 3; row <= sheet.rowCount; row++) {
    const category = sheet.cell(row, 1);
    const name = sheet.cell(row, 2);
    const frequency = sheet.cell(row, 4);

    if (!name) continue;

    const entry = {
      categorie: category,
      frequence: frequency ? `${frequency} fois` : ""
    };

    meta[name] = entry;
    if (category) meta[`${category}|${name}`] = entry;
  }

  for (let row = 3; row <= sheet.rowCount; row++) {
    const name = sheet.cell(row, 8);
    const maxPurchases = parseInt(sheet.cell(row, 11), 10) || 1;

    if (!name || maxPurchases <= 1) continue;

    ensureEntry(name).cumulableMax = maxPurchases;
  }

  return meta;
}
