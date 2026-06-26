import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getCompetenceMeta, getDatabaseOptions } from "../backend/services/database.service.js";
import { generateCharacterWorkbook, parseCharacterWorkbook } from "../backend/services/excel.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeCompetenceKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ambidexterie/g, "ambidextrie")
    .replace(/\bavancee\b/g, "avance")
    .replace(/\bavace\b/g, "avance")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function competenceMax(options, meta, name) {
  const target = normalizeCompetenceKey(name);
  const values = [];

  for (const option of options.competences || []) {
    if (normalizeCompetenceKey(option.nom) === target) {
      values.push(Number(option.cumulableMax) || 1);
    }
  }

  for (const [key, value] of Object.entries(meta || {})) {
    const namePart = key.split("|").at(-1);
    if (normalizeCompetenceKey(namePart) === target) {
      values.push(Number(value.cumulableMax) || 1);
    }
  }

  return Math.max(1, ...values);
}

const options = await getDatabaseOptions();
const meta = await getCompetenceMeta();

assert(fs.existsSync(path.join(root, "database/source/Fiche-de-joueur-V1.3.xlsx")), "Le fichier Excel source V1.3 est manquant.");
assert(!fs.existsSync(path.join(root, "ui/js/data.js")), "L'ancienne base statique ui/js/data.js existe encore.");

assert(options.rules?.magic?.dualSchoolCareers?.sage?.secondReligion === true, "La regle Sage doit permettre une deuxieme divinite.");
assert(options.rules?.magic?.dualSchoolCareers?.animiste, "La regle Animiste doit etre exposee au frontend.");
assert(options.rules?.competences?.concoctionRules?.["concoction alchimie"], "Les regles de concoction doivent etre exposees au frontend.");

const sage = options.carrieres.find((carriere) => carriere.value === "sage");
const animiste = options.carrieres.find((carriere) => carriere.value === "animiste");
assert(sage?.sources?.includes("pretre") && sage?.sources?.includes("mage"), "La carriere Sage doit heriter de Pretre et Mage.");
assert(animiste?.sources?.includes("pretre") && animiste?.sources?.includes("druide"), "La carriere Animiste doit heriter de Pretre et Druide.");

assert(competenceMax(options, meta, "Falsification") === 1, "Falsification doit rester non cumulable.");
assert(competenceMax(options, meta, "Creation d'anima") > 1, "Creation d'anima doit rester cumulable.");

const sample = {
  joueur: {
    nom: "Verification Joueur",
    tel: "418-000-0000",
    email: "test@example.com",
    u1nom: "Contact Un",
    u1tel: "418-111-1111",
    u2nom: "Contact Deux",
    u2tel: "418-222-2222"
  },
  personnage: {
    nom: "Verification",
    race: "humain",
    carriere: "charlatan",
    moralite: "balancee",
    chancesActuelles: "3",
    chancesMax: "3"
  },
  competences: [{ nom: "Falsification", freq: "", count: "1", xp: "0" }],
  sorts: [],
  evenements: []
};

const workbook = await generateCharacterWorkbook(sample);
const parsed = await parseCharacterWorkbook(workbook);
assert(parsed.joueur.nom === sample.joueur.nom, "L'import Excel doit restaurer le nom du joueur.");
assert(parsed.joueur.u1nom === sample.joueur.u1nom, "L'import Excel doit restaurer le contact d'urgence #1.");
assert(parsed.joueur.u1tel === sample.joueur.u1tel, "L'import Excel doit restaurer le telephone du contact #1.");
assert(parsed.joueur.u2nom === sample.joueur.u2nom, "L'import Excel doit restaurer le contact d'urgence #2.");
assert(parsed.joueur.u2tel === sample.joueur.u2tel, "L'import Excel doit restaurer le telephone du contact #2.");

console.log("Verification Arkadia OK");
