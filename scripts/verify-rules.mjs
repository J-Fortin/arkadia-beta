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

function hasFirstFreeRule(options, carriere, expected) {
  const rules = options.rules?.competences?.firstFreeByCareer?.[carriere] || [];
  const target = normalizeCompetenceKey(expected);

  return rules.some((rule) => {
    return (rule.names || []).some((name) => normalizeCompetenceKey(name) === target)
      || normalizeCompetenceKey(rule.startsWith) === target;
  });
}

const options = await getDatabaseOptions();
const meta = await getCompetenceMeta();

assert(fs.existsSync(path.join(root, "database/source/Fiche-de-joueur-V1.3.xlsx")), "Le fichier Excel source V1.3 est manquant.");
assert(!fs.existsSync(path.join(root, "ui/js/data.js")), "L'ancienne base statique ui/js/data.js existe encore.");

const calculsJs = fs.readFileSync(path.join(root, "ui/caracteristiques/calculs.js"), "utf8");
const sauvegardeJs = fs.readFileSync(path.join(root, "ui/js/sauvegarde.js"), "utf8");
const ressourcesJs = fs.readFileSync(path.join(root, "ui/ressourcesEtNotes/ressources.js"), "utf8");
const apiJs = fs.readFileSync(path.join(root, "ui/js/api.js"), "utf8");
const guidanceJs = fs.readFileSync(path.join(root, "ui/js/guidance.js"), "utf8");
const validationsJs = fs.readFileSync(path.join(root, "ui/js/validations.js"), "utf8");
const html = fs.readFileSync(path.join(root, "ui/arkadia_beta_1.2.html"), "utf8");
assert(calculsJs.includes("const MAX_XP_EVENEMENTS = 150"), "La limite de 150 XP d'evenements doit etre declaree.");
assert(calculsJs.includes("Math.min(getEventXpRaw(),MAX_XP_EVENEMENTS)"), "Les XP d'evenements doivent etre plafonnes a 150.");
assert(sauvegardeJs.includes("xpEvenements:getEventXpUsed()"), "L'export doit sauvegarder les XP d'evenements plafonnes.");
assert(html.includes("special-comp-tbody") && html.includes("special-sort-tbody"), "La section VI doit exposer les ajouts speciaux de l'animation.");
assert(calculsJs.includes("#special-comp-tbody") && calculsJs.includes("#special-sort-tbody"), "Les XP des ajouts speciaux doivent etre inclus dans le total depense.");
assert(html.includes("ressourcesEtNotes/ressources.js"), "Le calcul automatique des ressources doit etre charge.");
assert(html.includes('id="ressources"') && html.includes("readonly"), "Les ressources par scenario doivent etre un champ calcule.");
assert(calculsJs.includes("updateScenarioResources"), "Les ressources doivent etre recalculees avec les stats.");
assert(ressourcesJs.includes("updateScenarioResources") && ressourcesJs.includes("touche a tout"), "Le calcul des ressources doit gerer les competences et Touche a tout.");
assert(apiJs.includes("spellSchoolsMeetRequirements"), "Les exigences des ecoles de magie doivent etre verifiables cote frontend.");
assert(guidanceJs.includes("spellSchoolsMeetRequirements"), "Le guidage doit attendre toutes les ecoles requises.");
assert(validationsJs.includes("validerEcolesMagie"), "L'export doit valider les ecoles de magie.");
assert(html.includes("alert-ecole-magie"), "La fiche doit afficher les erreurs d'ecoles de magie.");
assert(html.includes("Titres / Races avancées / Capacités spéciales / Notes & Background complet"), "Les sections titres et notes doivent etre fusionnees.");
assert(!html.includes('id="notes"'), "L'ancien champ Notes separe ne doit plus etre affiche.");
assert(calculsJs.includes("special-comp-count") && calculsJs.includes("*count"), "Les XP des competences speciales doivent tenir compte du nombre de fois.");

assert(options.rules?.magic?.dualSchoolCareers?.sage?.secondReligion === true, "La regle Sage doit permettre une deuxieme divinite.");
assert(options.rules?.magic?.dualSchoolCareers?.animiste, "La regle Animiste doit etre exposee au frontend.");
assert(options.rules?.magic?.dualSchoolCareers?.chaman?.primaryType === "divine", "La regle Chaman doit demander une ecole divine.");
assert(options.rules?.magic?.dualSchoolCareers?.chaman?.secondaryType === "arcane", "La regle Chaman doit demander une ecole arcane.");
assert(options.rules?.magic?.schoolRemovalsByMorality?.benefique?.includes("Magie noire"), "La moralite benefique doit retirer la magie noire.");
assert(options.rules?.magic?.moralitiesByDivinity?.Cyrder?.includes("balancee"), "Les moralites par divinite doivent etre exposees.");
assert(options.rules?.magic?.divinitySchoolOverrides?.Magystia?.includes("Nécromancie"), "Les corrections d'ecoles par divinite doivent etre exposees.");
assert(options.rules?.competences?.concoctionRules?.["concoction alchimie"], "Les regles de concoction doivent etre exposees au frontend.");
assert(options.rules?.competences?.scenarioResourceRules?.byCompetence?.forge, "Les ressources de debut de scenario doivent etre exposees au frontend.");
assert(options.rules?.competences?.scenarioResourceRules?.creationAccrue?.key, "La regle de Creation accrue doit etre exposee au frontend.");
assert(!options.competences.some((option) => normalizeCompetenceKey(option.nom) === "test"), "La competence Test ne doit pas etre exposee.");
assert(options.religions.some((option) => option.value === "Esprit de la guerre (Odann)"), "Les variantes des Esprits de la guerre doivent etre creees.");
assert(!options.religions.some((option) => option.value === "Esprits de la guerre"), "Le choix generique Esprits de la guerre ne doit pas etre expose sans ecoles.");
assert(options.ecolesParDivinite?.["Esprit de la guerre (Khurn)"]?.includes("Voie maudite"), "Khurn doit donner acces a la Voie maudite.");
assert(options.ecolesParCarriere?.ermite?.includes("Druidisme"), "Ermite doit avoir acces au Druidisme.");
assert(options.ecolesParCarriere?.["gardien-mystique"]?.includes("Druidisme"), "Gardien mystique doit avoir acces au Druidisme.");
assert(options.ecolesParCarriere?.guerisseur?.includes("Dons"), "Guerisseur doit avoir acces aux ecoles du Pretre.");
assert(options.ecolesParCarriere?.inquisiteur?.includes("Voie sacrée"), "Inquisiteur doit avoir acces aux ecoles du Pretre.");
assert(!Object.values(options.ecolesParDivinite || {}).flat().includes("Berserk"), "Berserk ne doit pas etre affiche comme ecole de sorts.");

const sage = options.carrieres.find((carriere) => carriere.value === "sage");
const animiste = options.carrieres.find((carriere) => carriere.value === "animiste");
assert(sage?.sources?.includes("pretre") && sage?.sources?.includes("mage"), "La carriere Sage doit heriter de Pretre et Mage.");
assert(animiste?.sources?.includes("pretre") && animiste?.sources?.includes("druide"), "La carriere Animiste doit heriter de Pretre et Druide.");

assert(competenceMax(options, meta, "Falsification") === 1, "Falsification doit rester non cumulable.");
assert(competenceMax(options, meta, "Creation d'anima") > 1, "Creation d'anima doit rester cumulable.");
assert(competenceMax(options, meta, "Bravoure") === 1, "Bravoure gratuite doit rester non cumulable.");
assert(competenceMax(options, meta, "Resistance physique") > 1, "Resistance physique doit rester cumulable.");
assert(competenceMax(options, meta, "Lancer meurtrier") > 1, "Lancer meurtrier doit rester cumulable.");
assert(hasFirstFreeRule(options, "combattant", "resistance physique"), "Combattant doit avoir le 1er achat de Resistance physique gratuit.");
assert(hasFirstFreeRule(options, "mage", "lecture et ecriture"), "Mage doit avoir le 1er Lecture et ecriture gratuit.");
assert(hasFirstFreeRule(options, "barde", "lecture et ecriture"), "Barde doit avoir le 1er Lecture et ecriture gratuit.");
assert(hasFirstFreeRule(options, "charlatan", "lecture et ecriture"), "Charlatan doit avoir le 1er Lecture et ecriture gratuit.");
assert(hasFirstFreeRule(options, "scribe", "lecture et ecriture"), "Scribe doit avoir le 1er Lecture et ecriture gratuit.");
assert(hasFirstFreeRule(options, "traqueur", "lancer meurtrier"), "Traqueur doit avoir le 1er achat de Lancer meurtrier gratuit.");

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
  competencesSpeciales: [{ nom: "Marque de l'animation", freq: "1 fois", count: "2", xp: "7", note: "Titre special" }],
  sortsSpeciaux: [{ ecole: "Voie unique", lvl: "4", nom: "Sort hors codex", xp: "3", note: "Autorise par animation" }],
  evenements: []
};

const workbook = await generateCharacterWorkbook(sample);
const parsed = await parseCharacterWorkbook(workbook);
assert(parsed.joueur.nom === sample.joueur.nom, "L'import Excel doit restaurer le nom du joueur.");
assert(parsed.joueur.u1nom === sample.joueur.u1nom, "L'import Excel doit restaurer le contact d'urgence #1.");
assert(parsed.joueur.u1tel === sample.joueur.u1tel, "L'import Excel doit restaurer le telephone du contact #1.");
assert(parsed.joueur.u2nom === sample.joueur.u2nom, "L'import Excel doit restaurer le contact d'urgence #2.");
assert(parsed.joueur.u2tel === sample.joueur.u2tel, "L'import Excel doit restaurer le telephone du contact #2.");
assert(parsed.competencesSpeciales?.[0]?.nom === sample.competencesSpeciales[0].nom, "L'import Excel doit restaurer les competences speciales.");
assert(parsed.competencesSpeciales?.[0]?.count === sample.competencesSpeciales[0].count, "L'import Excel doit restaurer le nombre de fois des competences speciales.");
assert(parsed.competencesSpeciales?.[0]?.xp === sample.competencesSpeciales[0].xp, "L'import Excel doit restaurer les XP des competences speciales.");
assert(parsed.sortsSpeciaux?.[0]?.nom === sample.sortsSpeciaux[0].nom, "L'import Excel doit restaurer les sorts speciaux.");
assert(parsed.sortsSpeciaux?.[0]?.note === sample.sortsSpeciaux[0].note, "L'import Excel doit restaurer les notes des sorts speciaux.");

console.log("Verification Arkadia OK");
