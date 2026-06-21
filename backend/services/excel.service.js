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
      if (entry.method !== 0) throw new Error("Import XLSX compresse non supporte pour le moment.");

      const fileNameLength = buffer.readUInt16LE(entry.localOffset + 26);
      const extraLength = buffer.readUInt16LE(entry.localOffset + 28);
      const dataStart = entry.localOffset + 30 + fileNameLength + extraLength;
      return buffer.toString("utf8", dataStart, dataStart + entry.compressedSize);
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
    if (!row?.A || row.A === "Aucune donnee") continue;
    items.push(mapper(row));
  }

  return items;
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
    ["Carrière", personnage.carriere],
    ["Religion / Divinité", personnage.religion],
    ["Moralité", personnage.moralite],
    ["École de magie", personnage.ecole],
    ["Noblesse", personnage.noblesse],
    ["Maison / Titre", personnage.maison],
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
    ["Avertissement anti-abus", audit.eventAbuseWarning]
  ]);
  rows.push(...block.rows); row = block.nextRow;

  block = tableRows(row, "Compétences", ["Nom", "Fréquence", "Fois", "XP"], competences, (item, r) => [
    textCell(r, 1, item.nom),
    textCell(r, 2, item.freq),
    numberCell(r, 3, item.count),
    numberCell(r, 4, item.xp)
  ]);
  rows.push(...block.rows); row = block.nextRow;

  block = tableRows(row, "Sorts", ["Niveau", "Nom", "XP"], sorts, (item, r) => [
    numberCell(r, 1, item.lvl),
    textCell(r, 2, item.nom),
    numberCell(r, 3, item.xp)
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
  const rows = parseSheetRows(zip.text("xl/worksheets/sheet1.xml"));
  const sections = findSectionRows(rows);
  const lastRow = Math.max(...rows.keys());
  const sectionOrder = [
    "Informations du joueur",
    "Personnage",
    "XP",
    "Compétences",
    "Sorts",
    "Historique des événements"
  ].filter((name) => sections.has(name));

  function sectionEnd(name) {
    const index = sectionOrder.indexOf(name);
    const next = sectionOrder[index + 1];
    return next ? sections.get(next) : lastRow + 1;
  }

  const data = { v: "2.4", joueur: {}, personnage: {}, audit: {}, competences: [], sorts: [], evenements: [] };

  readLabelBlock(rows, sections.get("Informations du joueur"), sectionEnd("Informations du joueur"), {
    "Nom": "nom",
    "Date de naissance": "naiss",
    "Date du 1er Arkadia": "premier",
    "Téléphone": "tel",
    "Courriel": "email",
    "Allergies": "allergies"
  }, data.joueur);

  readLabelBlock(rows, sections.get("Personnage"), sectionEnd("Personnage"), {
    "Nom": "nom",
    "Date du 1er événement": "premier",
    "Race": "race",
    "Carrière": "carriere",
    "Religion / Divinité": "religion",
    "Moralité": "moralite",
    "École de magie": "ecole",
    "Noblesse": "noblesse",
    "Maison / Titre": "maison",
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

  data.competences = readTable(rows, sections.get("Compétences"), sectionEnd("Compétences"), (row) => ({
    nom: row.A || "",
    freq: row.B || "",
    count: row.C || "1",
    xp: row.D || "0"
  }));

  data.sorts = readTable(rows, sections.get("Sorts"), sectionEnd("Sorts"), (row) => ({
    lvl: row.A || "",
    nom: row.B || "",
    xp: row.C || "0"
  }));

  data.evenements = readTable(rows, sections.get("Historique des événements"), sectionEnd("Historique des événements"), (row) => ({
    ev: row.A || "",
    saison: row.B || "",
    xp: row.C || "3"
  }));

  data.audit.eventCountCurrent = Number(data.personnage.evenementsParticipes) || data.evenements.length;
  return data;
}
