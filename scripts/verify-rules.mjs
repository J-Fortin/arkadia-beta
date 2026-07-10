import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { getCompetenceMeta, getDatabaseOptions } from "../backend/services/database.service.js";
import { armorRules } from "../backend/services/codex-rules.js";
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
const armorContext = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, "ui/caracteristiques/armure.js"), "utf8"), armorContext, { filename: "ui/caracteristiques/armure.js" });
const calculateArmorValues = armorContext.calculateArmorValues;

function armorResult(pieces) {
  return calculateArmorValues(armorRules, pieces);
}

assert(fs.existsSync(path.join(root, "database/source/Fiche-de-joueur-V1.3.xlsx")), "Le fichier Excel source V1.3 est manquant.");
assert(!fs.existsSync(path.join(root, "ui/js/data.js")), "L'ancienne base statique ui/js/data.js existe encore.");

const calculsJs = fs.readFileSync(path.join(root, "ui/caracteristiques/calculs.js"), "utf8");
const sauvegardeJs = fs.readFileSync(path.join(root, "ui/js/sauvegarde.js"), "utf8");
const ressourcesJs = fs.readFileSync(path.join(root, "ui/ressourcesEtNotes/ressources.js"), "utf8");
const armureJs = fs.readFileSync(path.join(root, "ui/caracteristiques/armure.js"), "utf8");
const emailServiceJs = fs.readFileSync(path.join(root, "backend/services/email.service.js"), "utf8");
const apiJs = fs.readFileSync(path.join(root, "ui/js/api.js"), "utf8");
const guidanceJs = fs.readFileSync(path.join(root, "ui/js/guidance.js"), "utf8");
const validationsJs = fs.readFileSync(path.join(root, "ui/js/validations.js"), "utf8");
const html = fs.readFileSync(path.join(root, "ui/arkadia_beta_1.2.html"), "utf8");
assert(calculsJs.includes("const MAX_XP_EVENEMENTS = 150"), "La limite de 150 XP d'evenements doit etre declaree.");
assert(calculsJs.includes("Math.min(getEventXpRaw(),MAX_XP_EVENEMENTS)"), "Les XP d'evenements doivent etre plafonnes a 150.");
assert(sauvegardeJs.includes("xpEvenements:getEventXpUsed()"), "L'export doit sauvegarder les XP d'evenements plafonnes.");
assert(!html.includes("alert-evenements-abus"), "La section Historique des evenements ne doit plus afficher d'alerte.");
assert(html.includes("special-comp-tbody") && html.includes("special-sort-tbody"), "La section VI doit exposer les ajouts speciaux de l'animation.");
assert(calculsJs.includes("#special-comp-tbody") && calculsJs.includes("#special-sort-tbody"), "Les XP des ajouts speciaux doivent etre inclus dans le total depense.");
assert(html.includes("ressourcesEtNotes/ressources.js"), "Le calcul automatique des ressources doit etre charge.");
assert(html.includes('id="ressources"') && html.includes("readonly"), "Les ressources par scenario doivent etre un champ calcule.");
assert(calculsJs.includes("updateScenarioResources"), "Les ressources doivent etre recalculees avec les stats.");
assert(ressourcesJs.includes("updateScenarioResources") && ressourcesJs.includes("touche a tout"), "Le calcul des ressources doit gerer les competences et Touche a tout.");
assert(typeof calculateArmorValues === "function", "Le calculateur d'armure doit etre testable.");
assert(options.rules?.armor?.maxCombinedPoints === 13, "Le maximum PV + armure doit etre expose a 13.");
assert(html.includes('id="armor-helmet-enabled"') && html.includes('id="armor-gorget-enabled"'), "La fiche doit exposer le casque et le gorget via des boutons a cocher.");
assert(html.indexOf('id="armor-helmet-enabled"') > html.indexOf('class="armor-table"'), "Les boutons casque/gorget doivent etre sous le tableau.");
assert(html.includes('class="armor-table"'), "La section armure doit etre affichee comme un tableau.");
assert(html.includes('id="armor-row-torso"') && html.includes('id="armor-row-arms"') && html.includes('id="armor-row-legs"'), "La section armure doit guider l'ordre plastron, puis bras/jambes.");
assert(!html.includes('id="armor-epic"') && !html.includes('id="bonus-armure"'), "La section armure ne doit pas calculer l'epique ni les bonus speciaux.");
assert(!html.includes("<svg") && !html.includes("armor-visual"), "L'image d'armure ne doit plus etre affichee.");
assert(armureJs.includes("calculateArmorValues"), "La logique d'armure doit etre isolee dans un calculateur.");
assert(armureJs.includes("toggleArmorHelmet") && armureJs.includes("toggleArmorGorget"), "Les boutons a cocher casque/gorget doivent etre branches cote frontend.");
assert(armureJs.includes("updateArmorOrderState"), "La section armure doit guider le choix du plastron avant les autres pieces.");
assert(emailServiceJs.includes('label: "animation"') && emailServiceJs.includes('label: "joueur"'), "L'envoi courriel doit preparer une copie animation et une copie joueur.");
assert(emailServiceJs.includes("sendWithAvailableProviders") && emailServiceJs.indexOf('name: "smtp"') < emailServiceJs.indexOf('name: "resend"'), "L'envoi courriel doit utiliser SMTP avant Resend lorsque les deux sont configures.");
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

const fullPlateZones = Object.fromEntries(armorRules.bodyZones.map((zone) => [zone.id, "metal-rigide"]));
let armor = armorResult({ zones: fullPlateZones, helmet: "metal-rigide", gorget: "metal-rigide", epic: true });
assert(armor.bodyPoints === 5, "Une armure de metal rigide complete doit donner 5 PA.");
assert(armor.helmetPoints === 2, "Un casque de metal rigide doit donner 2 PA.");
assert(armor.epicPoints === 0 && armor.bonus === 0, "L'armure epique et les bonus speciaux ne doivent pas etre calcules dans la section armure.");
assert(armor.total === 7, "Full plate + casque doit donner 7 PA dans la section armure.");
assert(armor.classification.includes("Armure complète") && armor.classification.includes("Métal rigide"), "Le resume d'armure doit indiquer complete/incomplete et le materiau.");

armor = armorResult({ zones: { torse: "metal-rigide" }, helmet: "", gorget: "", epic: false });
assert(armor.bodyPoints === 4 && armor.complete === false, "Une armure de metal rigide incomplete doit donner 4 PA.");
assert(armor.classification.includes("Armure incomplète") && armor.classification.includes("Métal rigide"), "Le resume d'armure incomplete doit indiquer le materiau.");

armor = armorResult({ zones: { brasGauche: "metal-rigide", brasDroit: "metal-rigide" }, helmet: "metal-rigide", gorget: "metal-rigide", epic: true });
assert(armor.total === 0 && armor.hasTorso === false, "Sans plastron, les pieces d'armure et le casque ne doivent donner aucun PA.");

armor = armorResult({
  zones: {
    torse: "metal-rigide",
    brasGauche: "cuir-souple",
    brasDroit: "cuir-souple",
    jambeGauche: "cuir-souple",
    jambeDroite: "cuir-souple"
  },
  helmet: "",
  gorget: "",
  epic: false
});
assert(armor.bodyPoints === 4 && armor.classification.includes("Hybride"), "Une armure hybride complete avec plastron rigide doit donner 4 PA.");

armor = armorResult({
  zones: {
    torse: "metal-souple",
    brasGauche: "metal-rigide",
    brasDroit: "metal-rigide",
    jambeGauche: "metal-rigide",
    jambeDroite: "metal-rigide"
  },
  helmet: "",
  gorget: "semi-metallique",
  epic: false
});
assert(armor.bodyPoints === 4 && armor.gorget?.throatProtection === true, "Les pieces metalliques compatibles doivent suivre le plastron et le gorget semi-metallique doit proteger la gorge.");

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
    ptsArmure: "7",
    typeArmure: "Metal rigide complet",
    piecesArmure: { zones: fullPlateZones, helmet: "metal-rigide", gorget: "metal-rigide" },
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
assert(parsed.personnage.ptsArmure === sample.personnage.ptsArmure, "L'import Excel doit restaurer les points d'armure.");
assert(parsed.personnage.piecesArmure?.zones?.torse === "metal-rigide", "L'import Excel doit restaurer les pieces d'armure.");
assert(parsed.personnage.piecesArmure?.helmet === "metal-rigide", "L'import Excel doit restaurer le casque.");
assert(parsed.personnage.piecesArmure?.gorget === "metal-rigide", "L'import Excel doit restaurer le gorget.");
assert(parsed.personnage.bonusArmure === undefined, "L'export Excel ne doit plus ecrire de bonus d'armure.");

console.log("Verification Arkadia OK");
