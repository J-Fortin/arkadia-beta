import zlib from "node:zlib";

function xml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnName(index) {
  let name = "";
  while (index > 0) {
    const mod = (index - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    index = Math.floor((index - mod) / 26);
  }
  return name;
}

function cellRef(row, col) {
  return `${columnName(col)}${row}`;
}

function textCell(row, col, value, style = 0) {
  return `<c r="${cellRef(row, col)}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t>${xml(value)}</t></is></c>`;
}

function numberCell(row, col, value, style = 0) {
  const number = Number(value) || 0;
  return `<c r="${cellRef(row, col)}"${style ? ` s="${style}"` : ""}><v>${number}</v></c>`;
}

function rowXml(rowNumber, cells) {
  return `<row r="${rowNumber}">${cells.join("")}</row>`;
}

function crc32(buffer) {
  let crc = -1;

  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ -1) >>> 0;
}

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value);
  return buffer;
}

function zipDate() {
  return { time: 0, date: 33 };
}

function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { time, date } = zipDate();

  files.forEach((file) => {
    const name = Buffer.from(file.name, "utf8");
    const content = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, "utf8");
    const crc = crc32(content);
    const localHeader = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(time), u16(date),
      u32(crc), u32(content.length), u32(content.length), u16(name.length), u16(0), name
    ]);

    localParts.push(localHeader, content);
    centralParts.push(Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(time), u16(date),
      u32(crc), u32(content.length), u32(content.length), u16(name.length), u16(0),
      u16(0), u16(0), u16(0), u32(0), u32(offset), name
    ]));
    offset += localHeader.length + content.length;
  });

  const central = Buffer.concat(centralParts);
  const end = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(central.length), u32(offset), u16(0)
  ]);

  return Buffer.concat([...localParts, central, end]);
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
      const fileNameLength = buffer.readUInt16LE(entry.localOffset + 26);
      const extraLength = buffer.readUInt16LE(entry.localOffset + 28);
      const dataStart = entry.localOffset + 30 + fileNameLength + extraLength;
      const data = buffer.subarray(dataStart, dataStart + entry.compressedSize);

      if (entry.method === 0) return data.toString("utf8");
      if (entry.method === 8) return zlib.inflateRawSync(data).toString("utf8");
      throw new Error(`Compression XLSX non supportee: ${entry.method}`);
    }
  };
}

function unxml(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
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

function optionValue(label) {
  const slug = slugify(label);
  return optionAliases[slug] || slug;
}

function parseSharedStringsFromZip(zip) {
  try {
    const xml = zip.text("xl/sharedStrings.xml");
    return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => {
      const text = [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join("");
      return unxml(text);
    });
  } catch {
    return [];
  }
}

function parseSheetRows(sheetXml) {
  const rows = new Map();

  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(rowMatch[1]);
    const row = {};

    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = attrs.match(/\br="([A-Z]+)\d+"/)?.[1];
      if (!ref) continue;

      const text = body.match(/<t\b[^>]*>([\s\S]*?)<\/t>/)?.[1];
      const number = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      row[ref] = unxml(text ?? number ?? "");
    }

    rows.set(rowNumber, row);
  }

  return rows;
}

function parseSheetCells(sheetXml, sharedStrings) {
  const rows = new Map();

  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(rowMatch[1]);
    const row = new Map();

    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const col = attrs.match(/\br="([A-Z]+)\d+"/)?.[1];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1] || "";
      if (!col) continue;

      const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] || "";
      const inlineText = body.match(/<t\b[^>]*>([\s\S]*?)<\/t>/)?.[1] || "";
      let text = raw;
      if (type === "s") text = sharedStrings[Number(raw)] || "";
      if (type === "inlineStr") text = inlineText;

      row.set(col, { raw, text: unxml(text), type });
    }

    rows.set(rowNumber, row);
  }

  return rows;
}

function parseExcelDate(raw) {
  const serial = Number(raw);
  if (!serial || serial < 20_000) return "";
  const date = new Date(Date.UTC(1899, 11, 30 + serial));
  return date.toISOString().slice(0, 10);
}

function parseLegacyArkadiaWorkbook(sheetXml, sharedStrings) {
  const rows = parseSheetCells(sheetXml, sharedStrings);

  function cell(row, col) {
    return rows.get(row)?.get(col) || { raw: "", text: "", type: "" };
  }

  function text(row, col) {
    const value = cell(row, col);
    const index = Number(value.raw);
    if (value.type === "s") return value.text.trim();
    if (/^\d+$/.test(value.raw) && index > 0 && sharedStrings[index]) return sharedStrings[index].trim();
    return String(value.text || value.raw || "").trim();
  }

  function raw(row, col) {
    return String(cell(row, col).raw || "").trim();
  }

  const data = {
    v: "2.4",
    joueur: {
      nom: text(2, "D"),
      naiss: raw(3, "D") ? `${Math.round(Number(raw(3, "D")))}-01-01` : "",
      premier: parseExcelDate(raw(4, "AA")),
      tel: text(4, "U"),
      email: "",
      allergies: text(9, "G"),
      u1nom: text(6, "S"),
      u1tel: text(6, "D"),
      u2nom: text(7, "S"),
      u2tel: text(7, "D")
    },
    personnage: {
      nom: text(48, "D"),
      premier: parseExcelDate(raw(49, "P")),
      race: optionValue(text(51, "F")),
      carriere: optionValue(text(51, "U")),
      moralite: moraliteAliases[slugify(text(60, "F"))] || optionValue(text(60, "F")),
      religion: text(54, "F"),
      ecole: "",
      maison: text(56, "H"),
      noblesse: slugify(text(56, "W")) === "oui" ? "oui" : "non",
      ptsArmure: String(Math.round(Number(raw(58, "S")) || 0)),
      typeArmure: "",
      faiblesses: text(52, "F"),
      immunites: text(52, "U"),
      evenementsParticipes: "",
      xpEvenements: "",
      xpTotal: "",
      ressources: "",
      titres: "",
      notes: raw(61, "U") ? `Import ancienne fiche : total XP indique dans le fichier original = ${Math.round(Number(raw(61, "U")) || 0)}.` : "",
      bg: ""
    },
    audit: { eventCountBaseline: 0, eventCountCurrent: 0, eventAbuseWarning: "" },
    competences: [],
    sorts: [],
    competencesSpeciales: [],
    sortsSpeciaux: [],
    evenements: []
  };

  for (let row = 22; row <= 43; row++) {
    const ev = text(row, "B");
    const saisonRaw = raw(row, "D");
    if (!ev || ev === "Événement") continue;
    data.evenements.push({
      ev,
      saison: saisonRaw ? String(Math.round(Number(saisonRaw) || 0)) : "",
      xp: "3"
    });
  }

  data.audit.eventCountCurrent = data.evenements.length;
  data.personnage.evenementsParticipes = String(data.evenements.length);
  data.personnage.xpEvenements = String(data.evenements.length * 3);
  data.personnage.xpTotal = String(data.evenements.length);

  for (let row = 66; row <= 85; row++) {
    const name = text(row, "A");
    const xp = raw(row, "D");
    if (!name || name === "Compétences") continue;
    data.competences.push({
      nom: name,
      freq: "",
      count: "1",
      xp: String(Math.round(Number(xp) || 0))
    });
  }

  for (let row = 91; row <= 111; row++) {
    const lvl = raw(row, "A");
    const nom = text(row, "D");
    if (nom && nom !== "Nom du sort ") {
      data.sorts.push({ lvl: String(Math.round(Number(lvl) || 0)), nom, xp: "0" });
    }
  }

  return data;
}

function findSectionRows(rows) {
  const sections = new Map();

  for (const [rowNumber, row] of rows) {
    if (row.A) sections.set(row.A, rowNumber);
  }

  return sections;
}

function readLabelBlock(rows, startRow, endRow, mapping, target) {
  for (let rowNumber = startRow + 1; rowNumber < endRow; rowNumber++) {
    const row = rows.get(rowNumber);
    if (!row?.A) continue;
    const key = mapping[row.A];
    if (key) target[key] = row.B || "";
  }
}

function readTable(rows, startRow, endRow, mapper) {
  const items = [];

  for (let rowNumber = startRow + 2; rowNumber < endRow; rowNumber++) {
    const row = rows.get(rowNumber);
    if (!row?.A || row.A === "Aucune donnee" || row.A === "Aucune donnée") continue;
    items.push(mapper(row));
  }

  return items;
}

function splitContactValue(value) {
  const parts = String(value || "").split(/\s+-\s+|\s+\|\s+|[,;]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return { nom: parts[0], tel: parts.slice(1).join(" ") };
  return { nom: value || "", tel: "" };
}

function labelValueRows(startRow, title, pairs) {
  const rows = [rowXml(startRow, [textCell(startRow, 1, title, 1)])];
  let row = startRow + 1;

  pairs.forEach(([label, value]) => {
    rows.push(rowXml(row, [textCell(row, 1, label, 2), textCell(row, 2, value || "")]));
    row += 1;
  });

  return { rows, nextRow: row + 1 };
}

function tableRows(startRow, title, headers, items, mapper) {
  const rows = [rowXml(startRow, [textCell(startRow, 1, title, 1)])];
  let row = startRow + 1;
  rows.push(rowXml(row, headers.map((header, index) => textCell(row, index + 1, header, 3))));
  row += 1;

  if (!items.length) {
    rows.push(rowXml(row, [textCell(row, 1, "Aucune donnée")]));
    row += 1;
  } else {
    items.forEach((item) => {
      rows.push(rowXml(row, mapper(item, row)));
      row += 1;
    });
  }

  return { rows, nextRow: row + 1 };
}

function buildSheet(data) {
  const joueur = data.joueur || {};
  const personnage = data.personnage || {};
  const audit = data.audit || {};
  const competences = data.competences || [];
  const sorts = data.sorts || [];
  const competencesSpeciales = data.competencesSpeciales || data.specialCompetences || [];
  const sortsSpeciaux = data.sortsSpeciaux || data.specialSorts || [];
  const evenements = data.evenements || [];
  const rows = [];
  let row = 1;

  rows.push(rowXml(row, [textCell(row, 1, "Arkadia - Fiche de personnage", 4)]));
  row += 2;

  let block = labelValueRows(row, "Informations du joueur", [
    ["Nom", joueur.nom],
    ["Date de naissance", joueur.naiss],
    ["Date du 1er Arkadia", joueur.premier],
    ["Téléphone", joueur.tel],
    ["Courriel", joueur.email],
    ["Allergies", joueur.allergies],
    ["Contact urgence #1", [joueur.u1nom, joueur.u1tel].filter(Boolean).join(" - ")],
    ["Contact urgence #2", [joueur.u2nom, joueur.u2tel].filter(Boolean).join(" - ")]
  ]);
  rows.push(...block.rows); row = block.nextRow;

  block = labelValueRows(row, "Personnage", [
    ["Nom", personnage.nom],
    ["Date du 1er événement", personnage.premier],
    ["Race", personnage.race],
    ["Choix racial", personnage.raceVariant],
    ["Carrière", personnage.carriere],
    ["Religion / Divinité", personnage.religion],
    ["Divinité secondaire", personnage.religion2],
    ["Moralité", personnage.moralite],
    ["École de magie", personnage.ecole],
    ["École de magie secondaire", personnage.ecole2],
    ["Noblesse", personnage.noblesse],
    ["Maison / Titre", personnage.maison],
    ["Chances actuelles", personnage.chancesActuelles],
    ["Chances maximum", personnage.chancesMax],
    ["Faiblesses", personnage.faiblesses],
    ["Immunités", personnage.immunites],
    ["Ressources", personnage.ressources],
    ["Titres / capacités", personnage.titres],
    ["Notes", personnage.notes],
    ["Background", personnage.bg]
  ]);
  rows.push(...block.rows); row = block.nextRow;

  block = labelValueRows(row, "XP", [
    ["Événements participés", audit.eventCountCurrent ?? personnage.evenementsParticipes],
    ["XP événements", personnage.xpEvenements],
    ["Avertissement anti-abus", [audit.eventAbuseWarning, audit.chanceAbuseWarning].filter(Boolean).join(" | ")]
  ]);
  rows.push(...block.rows); row = block.nextRow;

  block = tableRows(row, "Compétences", ["Nom", "Fréquence", "Fois", "XP"], competences, (item, r) => [
    textCell(r, 1, item.nom),
    textCell(r, 2, item.freq),
    numberCell(r, 3, item.count),
    numberCell(r, 4, item.xp)
  ]);
  rows.push(...block.rows); row = block.nextRow;

  block = tableRows(row, "Sorts", ["École", "Niveau", "Nom", "XP"], sorts, (item, r) => [
    textCell(r, 1, item.ecole || personnage.ecole),
    numberCell(r, 2, item.lvl),
    textCell(r, 3, item.nom),
    numberCell(r, 4, item.xp)
  ]);
  rows.push(...block.rows); row = block.nextRow;

  block = tableRows(row, "Compétences spéciales", ["Nom", "Fréquence", "Fois", "XP / fois", "Note animation"], competencesSpeciales, (item, r) => [
    textCell(r, 1, item.nom),
    textCell(r, 2, item.freq),
    numberCell(r, 3, item.count),
    numberCell(r, 4, item.xp),
    textCell(r, 5, item.note)
  ]);
  rows.push(...block.rows); row = block.nextRow;

  block = tableRows(row, "Sorts spéciaux", ["École", "Niveau", "Nom", "XP", "Note animation"], sortsSpeciaux, (item, r) => [
    textCell(r, 1, item.ecole),
    numberCell(r, 2, item.lvl),
    textCell(r, 3, item.nom),
    numberCell(r, 4, item.xp),
    textCell(r, 5, item.note)
  ]);
  rows.push(...block.rows); row = block.nextRow;

  block = tableRows(row, "Historique des événements", ["Événement", "Saison", "XP"], evenements, (item, r) => [
    textCell(r, 1, item.ev),
    textCell(r, 2, item.saison),
    numberCell(r, 3, item.xp)
  ]);
  rows.push(...block.rows);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols><col min="1" max="1" width="28" customWidth="1"/><col min="2" max="2" width="45" customWidth="1"/><col min="3" max="6" width="16" customWidth="1"/></cols>
  <sheetData>${rows.join("")}</sheetData>
</worksheet>`;
}

function workbookFiles(data) {
  const sheet = buildSheet(data);

  return [
    { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/_rels/workbook.xml.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/workbook.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Fiche personnage" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: "xl/styles.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF8B1A1A"/><name val="Calibri"/></font><font><b/><color rgb="FF5C4A2A"/><name val="Calibri"/></font><font><b/><sz val="18"/><color rgb="FF8B1A1A"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF5EDD6"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8D9B5"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/></cellXfs></styleSheet>` },
    { name: "xl/worksheets/sheet1.xml", content: sheet }
  ];
}

export async function generateCharacterWorkbook(data) {
  return createZip(workbookFiles(data));
}

export async function parseCharacterWorkbook(buffer) {
  const zip = readZipEntries(buffer);
  const sheetXml = zip.text("xl/worksheets/sheet1.xml");
  const sharedStrings = parseSharedStringsFromZip(zip);
  const rows = parseSheetRows(sheetXml);
  const sections = findSectionRows(rows);
  if (!sections.has("Informations du joueur")) {
    return parseLegacyArkadiaWorkbook(sheetXml, sharedStrings);
  }
  const lastRow = Math.max(...rows.keys());
  const sectionOrder = [
    "Informations du joueur",
    "Personnage",
    "XP",
    "Compétences",
    "Sorts",
    "Compétences spéciales",
    "Sorts spéciaux",
    "Historique des événements"
  ].filter((name) => sections.has(name));

  function sectionEnd(name) {
    const index = sectionOrder.indexOf(name);
    const next = sectionOrder[index + 1];
    return next ? sections.get(next) : lastRow + 1;
  }

  const data = { v: "2.8", joueur: {}, personnage: {}, audit: {}, competences: [], sorts: [], competencesSpeciales: [], sortsSpeciaux: [], evenements: [] };

  readLabelBlock(rows, sections.get("Informations du joueur"), sectionEnd("Informations du joueur"), {
    "Nom": "nom",
    "Date de naissance": "naiss",
    "Date du 1er Arkadia": "premier",
    "Téléphone": "tel",
    "Courriel": "email",
    "Allergies": "allergies",
    "Contact urgence #1": "u1contact",
    "Contact urgence #2": "u2contact"
  }, data.joueur);

  const contact1 = splitContactValue(data.joueur.u1contact);
  const contact2 = splitContactValue(data.joueur.u2contact);
  data.joueur.u1nom = data.joueur.u1nom || contact1.nom;
  data.joueur.u1tel = data.joueur.u1tel || contact1.tel;
  data.joueur.u2nom = data.joueur.u2nom || contact2.nom;
  data.joueur.u2tel = data.joueur.u2tel || contact2.tel;
  delete data.joueur.u1contact;
  delete data.joueur.u2contact;

  readLabelBlock(rows, sections.get("Personnage"), sectionEnd("Personnage"), {
    "Nom": "nom",
    "Date du 1er événement": "premier",
    "Race": "race",
    "Choix racial": "raceVariant",
    "Carrière": "carriere",
    "Religion / Divinité": "religion",
    "Divinité secondaire": "religion2",
    "Moralité": "moralite",
    "École de magie": "ecole",
    "École de magie secondaire": "ecole2",
    "Noblesse": "noblesse",
    "Maison / Titre": "maison",
    "Chances actuelles": "chancesActuelles",
    "Chances maximum": "chancesMax",
    "Faiblesses": "faiblesses",
    "Immunités": "immunites",
    "Ressources": "ressources",
    "Titres / capacités": "titres",
    "Notes": "notes",
    "Background": "bg"
  }, data.personnage);

  readLabelBlock(rows, sections.get("XP"), sectionEnd("XP"), {
    "Événements participés": "evenementsParticipes",
    "XP événements": "xpEvenements"
  }, data.personnage);

  readLabelBlock(rows, sections.get("XP"), sectionEnd("XP"), {
    "Avertissement anti-abus": "eventAbuseWarning"
  }, data.audit);

  data.competences = readTable(rows, sections.get("Compétences"), sectionEnd("Compétences"), (row) => ({
    nom: row.A || "",
    freq: row.B || "",
    count: row.C || "1",
    xp: row.D || "0"
  }));

  const sortHeader = rows.get(sections.get("Sorts") + 1) || {};
  const sortsHaveSchoolColumn = sortHeader.A === "École";
  data.sorts = readTable(rows, sections.get("Sorts"), sectionEnd("Sorts"), (row) => (
    sortsHaveSchoolColumn
      ? { ecole: row.A || "", lvl: row.B || "", nom: row.C || "", xp: row.D || "0" }
      : { lvl: row.A || "", nom: row.B || "", xp: row.C || "0" }
  ));

  if (sections.has("Compétences spéciales")) {
    data.competencesSpeciales = readTable(rows, sections.get("Compétences spéciales"), sectionEnd("Compétences spéciales"), (row) => ({
      nom: row.A || "",
      freq: row.B || "",
      count: row.C || "1",
      xp: row.D || "0",
      note: row.E || ""
    }));
  }

  if (sections.has("Sorts spéciaux")) {
    data.sortsSpeciaux = readTable(rows, sections.get("Sorts spéciaux"), sectionEnd("Sorts spéciaux"), (row) => ({
      ecole: row.A || "",
      lvl: row.B || "",
      nom: row.C || "",
      xp: row.D || "0",
      note: row.E || ""
    }));
  }

  data.evenements = readTable(rows, sections.get("Historique des événements"), sectionEnd("Historique des événements"), (row) => ({
    ev: row.A || "",
    saison: row.B || "",
    xp: row.C || "3"
  }));

  data.audit.eventCountCurrent = Number(data.personnage.evenementsParticipes) || data.evenements.length;
  data.audit.chanceCountCurrent = Number(data.personnage.chancesActuelles) || 0;
  data.audit.chanceMax = Number(data.personnage.chancesMax) || 0;
  return data;
}
