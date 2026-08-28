import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { getCompetenceMeta, getDatabaseOptions } from "../backend/services/database.service.js";
import { armorRules, excludedRaceValues } from "../backend/services/codex-rules.js";
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

function racialCompetence(options, race, expected) {
  const target = normalizeCompetenceKey(expected);

  return (options.competences || []).find((option) => {
    return option.race === race && normalizeCompetenceKey(option.nom) === target;
  });
}

function assertRacialFree(options, race, expected, baseXp) {
  const option = racialCompetence(options, race, expected);

  assert(option, `La competence raciale ${expected} doit exister pour ${race}.`);
  assert(option.gratuit === true && Number(option.xp) === 0, `La competence raciale ${expected} doit etre gratuite pour ${race}.`);
  assert(Number(option.baseXp) === baseXp, `La competence raciale ${expected} doit conserver son cout normal (${baseXp}) pour les achats suivants.`);
}

function assertRacialDiscount(options, race, expected, xp, baseXp) {
  const option = racialCompetence(options, race, expected);

  assert(option, `La competence raciale a rabais ${expected} doit exister pour ${race}.`);
  assert(option.gratuit !== true && Number(option.xp) === xp, `La competence raciale a rabais ${expected} doit couter ${xp} XP pour ${race}.`);
  assert(Number(option.baseXp) === baseXp, `La competence raciale a rabais ${expected} doit conserver son cout normal (${baseXp}).`);
  assert(normalizeCompetenceKey(option.note) === "rabais racial", `La competence raciale a rabais ${expected} doit etre marquee comme rabais racial.`);
}

function assertNoRacialCompetence(options, race, expected) {
  assert(!racialCompetence(options, race, expected), `La competence raciale ${expected} ne doit pas exister pour ${race}.`);
}

function competenceMetaEntry(meta, expected) {
  const target = normalizeCompetenceKey(expected);

  return Object.entries(meta || {}).find(([key]) => {
    return normalizeCompetenceKey(key.split("|").at(-1)) === target;
  })?.[1];
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
const specialsJs = fs.readFileSync(path.join(root, "ui/ressourcesEtNotes/specials.js"), "utf8");
const competencesJs = fs.readFileSync(path.join(root, "ui/competences/competences.js"), "utf8");
const armureJs = fs.readFileSync(path.join(root, "ui/caracteristiques/armure.js"), "utf8");
const emailServiceJs = fs.readFileSync(path.join(root, "backend/services/email.service.js"), "utf8");
const apiJs = fs.readFileSync(path.join(root, "ui/js/api.js"), "utf8");
const stateJs = fs.readFileSync(path.join(root, "ui/js/state.js"), "utf8");
const guidanceJs = fs.readFileSync(path.join(root, "ui/js/guidance.js"), "utf8");
const validationsJs = fs.readFileSync(path.join(root, "ui/js/validations.js"), "utf8");
const html = fs.readFileSync(path.join(root, "ui/arkadia_beta_1.2.html"), "utf8");
const competenceState = { race: "", carriere: "", moralite: "balancee", selected: [], schools: [] };
function fakeSelectedCompetenceRows() {
  return competenceState.selected.map((name, index) => ({
    id: `selected-competence-${index + 1}`,
    querySelector: (selector) => selector === ".comp-sel" ? { value: `${name}|0||Générale|1|0` } : null
  }));
}
const competenceContext = vm.createContext({
  DATABASE_OPTIONS: options,
  COMPETENCE_META: meta,
  COMPETENCE_META_INDEX: {},
  document: {
    querySelectorAll: (selector) => {
      if (selector === "#comp-tbody tr") return fakeSelectedCompetenceRows();
      if (selector === ".comp-sel") return fakeSelectedCompetenceRows().map((fakeRow) => fakeRow.querySelector(".comp-sel"));
      return [];
    }
  },
  v: (id) => competenceState[id] || "",
  g: () => null,
  normalizeCompetenceKey,
  sortByText: (items) => [...items].sort((a, b) => String(a).localeCompare(String(b), "fr", { sensitivity: "base" })),
  getDatabaseCarriereOption: (key = competenceState.carriere) => options.carrieres.find((option) => option.value === key) || null,
  getDatabaseCompetenceOptions: () => options.competences || [],
  selectedCompetenceNames: () => competenceState.selected,
  getSelectedSpellSchools: () => competenceState.schools,
  carriereEstSemiMagique: (carriere = options.carrieres.find((option) => option.value === competenceState.carriere)) => Boolean(carriere?.semiMagique),
  carriereDonneAccesSorts: (carriere = options.carrieres.find((option) => option.value === competenceState.carriere)) => Boolean(carriere && (Number(carriere.ptsMagie) > 0 || Number(carriere.maxMagique) > 0))
});
vm.runInContext(competencesJs, competenceContext, { filename: "ui/competences/competences.js" });

function freeCompetenceFirstXp(race, carriere, nom, cat = "Raciale") {
  competenceState.race = race;
  competenceState.carriere = carriere;
  return competenceContext.getFreeCompetenceFirstXp(nom, cat, "");
}

function competenceOptionsFor(race, carriere, { selected = [], schools = [], moralite = "balancee" } = {}) {
  competenceState.race = race;
  competenceState.carriere = carriere;
  competenceState.moralite = moralite;
  competenceState.selected = selected;
  competenceState.schools = schools;
  return competenceContext.getCompOptions("");
}

function competenceIsAvailable(race, carriere, nom, state = {}) {
  const target = normalizeCompetenceKey(nom);
  return competenceOptionsFor(race, carriere, state).some((option) => normalizeCompetenceKey(option.nom) === target);
}

function competenceInitialXpFor(race, carriere, nom, state = {}) {
  const target = normalizeCompetenceKey(nom);
  const option = competenceOptionsFor(race, carriere, state).find((candidate) => normalizeCompetenceKey(candidate.nom) === target);

  assert(option, `La competence ${nom} doit etre disponible pour ${race}/${carriere}.`);
  return competenceContext.getOptionInitialXp(option, "");
}

function visibleCompetenceOptionFor(race, carriere, nom, state = {}) {
  const target = normalizeCompetenceKey(nom);
  return competenceOptionsFor(race, carriere, state).find((candidate) => normalizeCompetenceKey(candidate.nom) === target) || null;
}

function optionInitialXp(option, rowId = "") {
  return Number(competenceContext.getOptionInitialXp(option, rowId));
}

function optionExtraXp(option, rowId = "") {
  return Number(competenceContext.getOptionExtraXp(option, rowId));
}

function contactMarchandOptionsFor(race, carriere, state = {}) {
  return competenceOptionsFor(race, carriere, state).filter((option) => normalizeCompetenceKey(option.nom).startsWith("contact marchand"));
}

function duplicateCompetenceNamesFor(race, carriere) {
  const counts = new Map();

  competenceOptionsFor(race, carriere).forEach((option) => {
    const key = normalizeCompetenceKey(option.nom);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return [...counts.entries()].filter(([, count]) => count > 1);
}

function careerCompetenceExists(carriere, nom) {
  const target = normalizeCompetenceKey(nom);

  return (options.competences || []).some((option) => {
    return option.carriere === carriere && normalizeCompetenceKey(option.nom) === target;
  });
}

function mixedCareerSpecialCompetences() {
  return Object.entries(options.sourcesParCarriereMixte || {}).flatMap(([carriere, sources]) => {
    return (options.competences || [])
      .filter((option) => option.carriere === carriere && normalizeCompetenceKey(option.cat).startsWith("carriere"))
      .filter((option) => {
        return !(sources || []).some((source) => careerCompetenceExists(source, option.nom));
      });
  });
}

function categoryIsCareer(cat) {
  return normalizeCompetenceKey(String(cat || "").split("-")[0]).startsWith("carriere");
}

function firstFreeRuleMatchesName(rule, nom) {
  const normalized = normalizeCompetenceKey(nom);
  const names = (rule.names || []).map((name) => normalizeCompetenceKey(name));
  if (names.includes(normalized)) return true;

  const prefix = normalizeCompetenceKey(rule.startsWith || "");
  return Boolean(prefix && normalized.startsWith(prefix));
}

function careerOptionGetsFirstFree(option) {
  const rules = options.rules?.competences?.firstFreeByCareer?.[option.carriere] || [];
  return rules.some((rule) => firstFreeRuleMatchesName(rule, option.nom));
}

function expectedHumanCareerInitialXp(option, visibleOption) {
  if (careerOptionGetsFirstFree(option)) return 0;

  const carriere = options.carrieres.find((candidate) => candidate.value === option.carriere);
  const mixedSurcharge = carriere?.mixte && categoryIsCareer(visibleOption.cat) ? 1 : 0;

  return Number(option.xp) + mixedSurcharge;
}

function assertAllCareerCompetencesAreCosted() {
  const issues = [];

  (options.competences || []).filter((option) => option.carriere).forEach((option) => {
    const visibleOption = visibleCompetenceOptionFor("humain", option.carriere, option.nom);

    if (!visibleOption || visibleOption.carriere !== option.carriere) {
      issues.push(`${option.carriere}/${option.nom} absent du choix de carriere`);
      return;
    }

    const initialXp = optionInitialXp(visibleOption);
    const expectedXp = expectedHumanCareerInitialXp(option, visibleOption);

    if (initialXp > expectedXp) {
      issues.push(`${option.carriere}/${option.nom}: ${initialXp} XP au lieu de ${expectedXp} max`);
    }
  });

  assert(issues.length === 0, `Les competences de carriere doivent appliquer leur cout/rabais: ${issues.slice(0, 10).join("; ")}`);
}

function assertAllRacialCompetencesAreCosted() {
  const issues = [];

  (options.competences || []).filter((option) => option.race).forEach((option) => {
    const baseXp = Number(option.baseXp);
    const racialXp = Number(option.xp);
    const note = normalizeCompetenceKey(option.note);
    const visibleMatches = options.carrieres
      .map((carriere) => {
        const visibleOption = visibleCompetenceOptionFor(option.race, carriere.value, option.nom);
        return visibleOption ? { carriere: carriere.value, initialXp: optionInitialXp(visibleOption), visibleOption } : null;
      })
      .filter(Boolean);

    if (option.gratuit === true) {
      if (racialXp !== 0) issues.push(`${option.race}/${option.nom}: gratuit mais cout racial ${racialXp}`);
      if (note) issues.push(`${option.race}/${option.nom}: gratuit avec note ${option.note}`);
    } else if (note === "rabais racial") {
      if (!(racialXp > 0 && racialXp < baseXp)) {
        issues.push(`${option.race}/${option.nom}: rabais racial invalide ${racialXp}/${baseXp}`);
      }
    } else if (racialXp !== baseXp) {
      issues.push(`${option.race}/${option.nom}: cout racial ${racialXp}/${baseXp} sans note de rabais`);
    }

    if (visibleMatches.length === 0) {
      issues.push(`${option.race}/${option.nom}: jamais visible pour aucune carriere`);
      return;
    }

    visibleMatches.forEach(({ carriere, initialXp }) => {
      if (option.gratuit === true && initialXp > 1) {
        issues.push(`${option.race}/${carriere}/${option.nom}: gratuit racial calcule a ${initialXp} XP`);
      }

      if (note === "rabais racial" && initialXp > racialXp) {
        issues.push(`${option.race}/${carriere}/${option.nom}: rabais racial calcule a ${initialXp} XP au lieu de ${racialXp} max`);
      }
    });
  });

  assert(issues.length === 0, `Les competences raciales doivent appliquer gratuites/rabais: ${issues.slice(0, 10).join("; ")}`);
}

function assertAllVisibleCompetenceCostsAreValid() {
  const issues = [];

  options.races.forEach((race) => {
    options.carrieres.forEach((carriere) => {
      const counts = new Map();
      const visibleOptions = competenceOptionsFor(race.value, carriere.value);

      visibleOptions.forEach((option) => {
        const key = normalizeCompetenceKey(option.nom);
        const initialXp = optionInitialXp(option);
        const extraXp = optionExtraXp(option);

        counts.set(key, (counts.get(key) || 0) + 1);

        if (!Number.isFinite(initialXp) || initialXp < 0 || !Number.isFinite(extraXp) || extraXp < 0) {
          issues.push(`${race.value}/${carriere.value}/${option.nom}: cout invalide ${initialXp}/${extraXp}`);
        }

        if (option.race && normalizeCompetenceKey(option.note) === "rabais racial" && !(Number(option.xp) > 0 && Number(option.xp) < Number(option.baseXp))) {
          issues.push(`${race.value}/${carriere.value}/${option.nom}: rabais racial visible invalide`);
        }

        if (option.race && option.gratuit === true && initialXp > 1) {
          issues.push(`${race.value}/${carriere.value}/${option.nom}: gratuite raciale visible trop chere (${initialXp})`);
        }
      });

      [...counts.entries()].forEach(([name, count]) => {
        if (count > 1) issues.push(`${race.value}/${carriere.value}/${name}: doublon x${count}`);
      });
    });
  });

  assert(issues.length === 0, `Tous les choix visibles doivent avoir un cout valide et unique: ${issues.slice(0, 10).join("; ")}`);
}

const magicState = { race: "", carriere: "", competences: [] };
const magicContext = vm.createContext({
  document: {
    getElementById: (id) => ({ value: magicState[id] || "" }),
    querySelectorAll: (selector) => {
      if (selector !== ".comp-sel") return [];
      return magicState.competences.map((name) => ({ value: `${name}|0||Générale|1|0` }));
    }
  },
  getDatabaseCarriereOption: (key = magicState.carriere) => options.carrieres.find((option) => option.value === key) || null,
  getDatabaseRaceOption: (key = magicState.race) => options.races.find((option) => option.value === key) || null
});
vm.runInContext(stateJs, magicContext, { filename: "ui/js/state.js" });

function magicPointsFor(race, carriere) {
  magicState.race = race;
  magicState.carriere = carriere;
  magicState.competences = [];
  return magicContext.getCarriereMagicPoints(magicContext.getDatabaseCarriereOption(carriere));
}

function hasSpellAccessFor(race, carriere) {
  magicState.race = race;
  magicState.carriere = carriere;
  magicState.competences = [];
  return magicContext.carriereDonneAccesSorts(magicContext.getDatabaseCarriereOption(carriere));
}

function sortMaxFor(race, carriere, competences = []) {
  magicState.race = race;
  magicState.carriere = carriere;
  magicState.competences = competences;
  return magicContext.getCarriereSortMaxLevel(magicContext.getDatabaseCarriereOption(carriere));
}

function select(value = "") {
  return {
    value: String(value),
    disabled: false,
    options: [],
    appendChild(option) {
      this.options.push(option);
    },
    closest: () => null,
    set innerHTML(value) {
      this._innerHTML = String(value);
      this.options = [];
    },
    get innerHTML() {
      return this._innerHTML || "";
    }
  };
}

function sortLevelChoicesFor(race, carriere, ecole, competences = [], completedLevels = []) {
  const state = { race, carriere, ecole, competences };
  const levelSelect = select();
  const currentRow = {
    id: "current-sort",
    querySelector: (selector) => {
      if (selector === ".sort-ecole-sel") return input(ecole);
      if (selector === ".sort-lvl-sel") return levelSelect;
      return null;
    }
  };
  const completedRows = completedLevels.map((level, index) => ({
    id: `completed-sort-${index + 1}`,
    querySelector: (selector) => {
      if (selector === ".sort-ecole-sel") return input(ecole);
      if (selector === ".sort-lvl-sel") return input(String(level));
      if (selector === ".sort-nom-sel") return input(`Sort niveau ${level}`);
      return null;
    }
  }));
  const sortContext = vm.createContext({
    DATABASE_OPTIONS: options,
    document: {
      getElementById: (id) => {
        if (id === "current-sort") return currentRow;
        return input(state[id] || "");
      },
      querySelectorAll: (selector) => {
        if (selector === ".comp-sel") return state.competences.map((name) => ({ value: `${name}|0||G\u00e9n\u00e9rale|1|0` }));
        if (selector === "#sorts-tbody tr") return completedRows;
        return [];
      },
      createElement: () => ({ value: "", textContent: "", disabled: false })
    },
    getDatabaseCarriereOption: (key = state.carriere) => options.carrieres.find((option) => option.value === key) || null,
    getDatabaseRaceOption: (key = state.race) => options.races.find((option) => option.value === key) || null,
    getSelectedSpellSchools: () => [ecole],
    getSortEntries: (school, level) => options.sorts?.[school]?.[String(level)] || [],
    getSortXpFromDatabase: () => null,
    calcXP: () => {},
    sortByText: (items) => [...items].sort((a, b) => String(a).localeCompare(String(b), "fr", { sensitivity: "base" }))
  });

  vm.runInContext(stateJs, sortContext, { filename: "ui/js/state.js" });
  vm.runInContext(fs.readFileSync(path.join(root, "ui/competences/sorts.js"), "utf8"), sortContext, { filename: "ui/competences/sorts.js" });
  sortContext.updateSortLevelOptions(levelSelect, "current-sort");

  return levelSelect.options.map((option) => ({
    level: Number(option.value),
    disabled: Boolean(option.disabled)
  })).filter((option) => option.level > 0);
}

function sortLevelIsChoice(race, carriere, ecole, level, competences = [], completedLevels = []) {
  return sortLevelChoicesFor(race, carriere, ecole, competences, completedLevels)
    .some((option) => option.level === level && !option.disabled);
}

function input(value = "") {
  return { value: String(value) };
}

function row(fields) {
  return {
    querySelector: (selector) => fields[selector] || null
  };
}

function calculatedSpentXpWithSpecialRows() {
  const elements = {
    "xp-total": input("0"),
    "xp-depart": input("0"),
    "xp-dep": input("0"),
    "xp-dispo": input("0"),
    "xp-bar": { style: {} },
    "xp-lbl-d": { textContent: "" },
    "xp-lbl-t": { textContent: "" }
  };
  const calcContext = vm.createContext({
    document: {
      querySelectorAll: (selector) => {
        if (selector === ".comp-xp") return [input("2")];
        if (selector === "#sorts-tbody tr") return [row({ ".sort-lvl-sel": input("1"), ".sort-nom-sel": input("Sort"), ".sort-xp": input("3") })];
        if (selector === "#special-comp-tbody tr") return [row({ ".special-comp-nom": input(""), ".special-comp-freq": input("Autorisation"), ".special-comp-note": input(""), ".special-comp-count": input("2"), ".special-comp-xp": input("7") })];
        if (selector === "#special-sort-tbody tr") return [row({ ".special-sort-ecole": input(""), ".special-sort-lvl": input(""), ".special-sort-nom": input(""), ".special-sort-note": input("Autorisation"), ".special-sort-xp": input("4") })];
        return [];
      }
    },
    g: (id) => elements[id] || null,
    v: (id) => elements[id]?.value || "",
    sv: (id, value) => {
      if (elements[id]) elements[id].value = String(value);
    },
    getDatabaseRaceOption: () => null,
    getArmorRules: () => ({ maxCombinedPoints: 13 }),
    getRaceChanceMax: () => 3,
    selectedCompetenceNames: () => [],
    updateScenarioResources: () => {},
    alert: () => {},
    eventCountBaseline: 0,
    chanceCountBaseline: 0,
    lastEventAbuseWarning: "",
    lastChanceAbuseWarning: ""
  });

  vm.runInContext(calculsJs, calcContext, { filename: "ui/caracteristiques/calculs.js" });
  calcContext.calcXP();
  return Number(elements["xp-dep"].value);
}

function totalXpWithSeasonPass(events, checked) {
  const elements = {
    "xp-total": input(String(events)),
    "xp-depart": input("10"),
    "xp-dep": input("0"),
    "xp-dispo": input("0"),
    "xp-bar": { style: {} },
    "xp-lbl-d": { textContent: "" },
    "xp-lbl-t": { textContent: "" },
    "passe-saison": { checked },
    "passe-saison-hint": { textContent: "" },
    "alert-passe-saison": { innerHTML: "", classList: { toggle: () => {} } }
  };
  const calcContext = vm.createContext({
    document: {
      querySelectorAll: () => []
    },
    g: (id) => elements[id] || null,
    v: (id) => elements[id]?.value || "",
    sv: (id, value) => {
      if (elements[id]) elements[id].value = String(value);
    },
    getDatabaseRaceOption: () => null,
    getArmorRules: () => ({ maxCombinedPoints: 13 }),
    getRaceChanceMax: () => 3,
    selectedCompetenceEntries: () => [],
    updateScenarioResources: () => {},
    alert: () => {},
    eventCountBaseline: 0,
    seasonPassBaseline: false,
    chanceCountBaseline: 0,
    lastEventAbuseWarning: "",
    lastChanceAbuseWarning: ""
  });

  vm.runInContext(calculsJs, calcContext, { filename: "ui/caracteristiques/calculs.js" });
  calcContext.calcXP();
  return {
    total: Number(elements["xp-dispo"].value),
    label: elements["xp-lbl-t"].textContent
  };
}

assert(calculsJs.includes("const MAX_XP_EVENEMENTS = 150"), "La limite de 150 XP d'evenements doit etre declaree.");
assert(calculsJs.includes("Math.min(getEventXpRaw(),MAX_XP_EVENEMENTS)"), "Les XP d'evenements doivent etre plafonnes a 150.");
assert(sauvegardeJs.includes("xpEvenements:getEventXpUsed()"), "L'export doit sauvegarder les XP d'evenements plafonnes.");
assert(!html.includes("alert-evenements-abus"), "La section Historique des evenements ne doit plus afficher d'alerte.");
assert(html.includes("special-comp-tbody") && html.includes("special-sort-tbody"), "La section VI doit exposer les ajouts speciaux de l'animation.");
assert(calculsJs.includes("#special-comp-tbody") && calculsJs.includes("#special-sort-tbody"), "Les XP des ajouts speciaux doivent etre inclus dans le total depense.");
assert(/special-comp-note[^>]+oninput="calcXP\(\)"/.test(specialsJs), "La note des competences speciales doit recalculer les XP.");
assert(/special-sort-note[^>]+oninput="calcXP\(\)"/.test(specialsJs), "La note des sorts speciaux doit recalculer les XP.");
assert(calculatedSpentXpWithSpecialRows() === 23, "Les XP des competences speciales et sorts speciaux doivent alimenter les XP depenses.");
const seasonPassBelowCap = totalXpWithSeasonPass(49, true);
const seasonPassAtCap = totalXpWithSeasonPass(50, true);
assert(seasonPassBelowCap.total === 159 && seasonPassBelowCap.label.includes("passe saison 2 XP"), "La passe saison doit ajouter 2 XP aux XP generaux.");
assert(seasonPassAtCap.total === 160 && seasonPassAtCap.label.includes("plafonnés à 150 XP généraux"), "La passe saison doit respecter la limite generale de 150 XP.");
assert(html.includes("ressourcesEtNotes/ressources.js"), "Le calcul automatique des ressources doit etre charge.");
assert(html.includes('id="ressources"') && html.includes("readonly"), "Les ressources par scenario doivent etre un champ calcule.");
assert(html.includes('id="passe-saison"') && html.includes("alert-passe-saison"), "La passe saison doit etre disponible avec une alerte animation.");
assert(calculsJs.includes("updateScenarioResources"), "Les ressources doivent etre recalculees avec les stats.");
assert(calculsJs.includes("getGeneralXpUsed") && calculsJs.includes("XP_PASSE_SAISON = 2"), "La passe saison doit ajouter 2 XP dans la limite generale.");
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
for (const excludedRace of excludedRaceValues) {
  assert(!options.races.some((option) => option.value === excludedRace), `La race ${excludedRace} ne doit pas etre exposee.`);
  assert(!options.competences.some((option) => option.race === excludedRace), `Les competences raciales de ${excludedRace} ne doivent pas etre exposees.`);
  [
    "carrieresPermisesParRace",
    "moralitesPermisesParRace",
    "divinitesPermisesParRace",
    "faiblessesParRace",
    "immunitesParRace"
  ].forEach((mapName) => {
    assert(!options[mapName]?.[excludedRace], `${mapName} ne doit pas contenir ${excludedRace}.`);
  });
  const accessRules = options.rules?.competences?.access || {};
  ["charognardRaces", "rageAnimaleRaces", "sangImpurDirectRaces", "sangInterditRaces", "sangPurInterditRaces"].forEach((ruleName) => {
    assert(!(accessRules[ruleName] || []).includes(excludedRace), `${ruleName} ne doit pas contenir ${excludedRace}.`);
  });
}
assert((options.immunitesParRace?.gitan || []).some((effect) => normalizeCompetenceKey(effect) === "maledictions"), "Gitan doit etre immunise aux maledictions.");
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
assert((options.competences || []).filter((option) => option.race).every((option) => Number(option.xp) >= 0 && Number(option.xp) <= Number(option.baseXp)), "Les avantages raciaux doivent exposer un cout gratuit ou rabais valide.");
assert(!(options.competences || []).some((option) => /avac/i.test(option.nom)), "Bouclier avance ne doit pas rester mal orthographie en Bouclier Avace.");
assertRacialDiscount(options, "demi-elfe", "Archerie", 2, 3);
assertRacialDiscount(options, "demi-elfe", "Lecture et ecriture Commun", 1, 2);
assertRacialDiscount(options, "elfe-gris", "Haute magie", 2, 3);
assertRacialFree(options, "elfe-gris", "Resistance magique", 6);
assertRacialDiscount(options, "elfe-lunaire", "Resistance magique", 5, 6);
assertRacialFree(options, "elfe-lunaire", "Resistance mentale", 6);
assertRacialFree(options, "haut-elfe", "Noblesse", 3);
assertRacialFree(options, "haut-elfe", "Lecture et ecriture Elfique", 2);
assertRacialDiscount(options, "haut-elfe", "Tir precis", 5, 6);
assertNoRacialCompetence(options, "haut-elfe", "Resistance mentale");
assertRacialFree(options, "elfe-noir", "Coup abyssal", 0);
assertRacialFree(options, "etre-sylvestre", "Aura de serenite", 0);
assertRacialFree(options, "gitan", "Arme de jet", 3);
assertRacialDiscount(options, "gitan", "Clairvoyance", 4, 5);
assertRacialFree(options, "demi-demon", "Bravoure", 4);
assertRacialFree(options, "demi-demon", "Torture", 4);
assert(competencesJs.includes("racialCompetenceCareerAllows"), "Les avantages raciaux gratuits doivent etre filtres selon l'acces de carriere.");
const duplicateCompetenceChoices = options.races.flatMap((race) => {
  return options.carrieres.map((carriere) => {
    const duplicates = duplicateCompetenceNamesFor(race.value, carriere.value);
    return duplicates.length ? `${race.value}/${carriere.value}: ${duplicates.map(([name, count]) => `${name} x${count}`).join(", ")}` : "";
  }).filter(Boolean);
});
assert(duplicateCompetenceChoices.length === 0, `Les choix de competences ne doivent pas afficher de doublons: ${duplicateCompetenceChoices.slice(0, 5).join("; ")}`);
assertAllCareerCompetencesAreCosted();
assertAllRacialCompetencesAreCosted();
assertAllVisibleCompetenceCostsAreValid();
const elfeNoirInquisiteurTorture = competenceOptionsFor("elfe-noir", "inquisiteur").filter((option) => normalizeCompetenceKey(option.nom) === "torture");
assert(elfeNoirInquisiteurTorture.length === 1 && normalizeCompetenceKey(elfeNoirInquisiteurTorture[0].cat) === "raciale", "Elfe noir Inquisiteur doit voir Torture une seule fois, avec le meilleur cout.");
mixedCareerSpecialCompetences().forEach((option) => {
  assert(competenceInitialXpFor("humain", option.carriere, option.nom) === Number(option.xp), `La competence speciale ${option.nom} de ${option.carriere} doit garder son cout de ${option.xp} XP.`);
});
assert(competenceInitialXpFor("humain", "inquisiteur", "Abjuration") === 6, "Abjuration d'Inquisiteur doit couter 6 XP.");
assert(!competenceIsAvailable("humain", "mage", "Archerie Arcane"), "Archerie Arcane doit exiger Archerie.");
assert(competenceIsAvailable("humain", "mage", "Archerie Arcane", { selected: ["Archerie"] }), "Archerie Arcane doit etre disponible avec Archerie et une carriere magique.");
assert(!competenceIsAvailable("humain", "barbare", "Baton de pouvoir"), "Baton de pouvoir doit exiger une carriere magique ou semi-magique.");
assert(competenceIsAvailable("humain", "mage", "Baton de pouvoir"), "Baton de pouvoir doit etre disponible pour une carriere magique.");
assert(!competenceIsAvailable("humain", "combattant", "Invocation Guerriere"), "Invocation Guerriere doit exiger Religion.");
assert(competenceIsAvailable("humain", "combattant", "Invocation Guerriere", { selected: ["Religion"] }), "Invocation Guerriere doit etre disponible avec Religion et une carriere armee.");
assert(!competenceIsAvailable("humain", "mage", "Rituel", { selected: ["Religion"] }), "Rituel doit exiger Lecture et ecriture en plus de Religion.");
assert(competenceIsAvailable("humain", "mage", "Rituel", { selected: ["Religion", "Lecture et ecriture - Commun"] }), "Rituel doit etre disponible avec Religion et Lecture et ecriture.");
assert(!competenceIsAvailable("humain", "mage", "Peinture des Morts"), "Peinture des Morts doit exiger l'ecole Necromancie.");
assert(competenceIsAvailable("humain", "mage", "Peinture des Morts", { schools: ["Necromancie"] }), "Peinture des Morts doit etre disponible avec l'ecole Necromancie.");
assert(competenceIsAvailable("rasgadan", "totem", "Rage animale"), "Rasgadan Totem doit avoir acces a Rage animale.");
assert(!competenceIsAvailable("rasgadan", "druide", "Rage animale"), "Rage animale doit exiger la carriere Totem.");
assert(!competenceIsAvailable("humain", "totem", "Rage animale"), "Rage animale doit exiger une race permise.");
assert(competenceIsAvailable("haut-elfe", "combattant", "Noblesse"), "Noblesse doit etre disponible pour Haut-Elfe.");
assert(!competenceIsAvailable("humain", "combattant", "Noblesse"), "Noblesse doit etre reservee aux Hauts-Elfes.");
assert(competenceIsAvailable("haut-elfe", "mage", "Tir precis"), "Tir precis doit etre visible comme competence raciale gratuite Haut-Elfe.");
assert(competenceInitialXpFor("haut-elfe", "mage", "Resistance mentale") === 6, "Resistance mentale ne doit pas etre gratuite pour Haut-Elfe.");
assert(competenceIsAvailable("elfe-noir", "charlatan", "Coup abyssal"), "Coup abyssal doit etre visible comme competence raciale gratuite Elfe noir.");
assert(competenceIsAvailable("etre-sylvestre", "druide", "Aura de serenite"), "Aura de serenite doit etre visible comme competence raciale gratuite Etre Sylvestre.");
assert(competenceIsAvailable("gitan", "combattant", "Clairvoyance"), "Clairvoyance doit etre visible comme competence raciale a rabais Gitan hors acces de carriere.");
assert(competenceInitialXpFor("gitan", "combattant", "Clairvoyance") === 4, "Gitan Combattant doit acheter Clairvoyance a 4 XP comme competence raciale a rabais.");
assert(competenceInitialXpFor("humain", "mage", "Lecture et ecriture Commun") === 1, "Humain Mage doit garder Lecture et ecriture a 1 XP malgre le 1er gratuit de carriere.");
assert(competenceInitialXpFor("humain", "combattant", "Lecture et ecriture Rakuzan", { selected: ["Lecture et ecriture - Commun", "Lecture et ecriture - Elfique"] }) === 1, "Humain doit garder chaque langue Lecture et ecriture a 1 XP meme apres deux langues.");
assert(competenceInitialXpFor("demi-elfe", "barde", "Lecture et ecriture Commun") === 1, "Demi-Elfe Barde doit garder Lecture et ecriture a 1 XP malgre le 1er gratuit de carriere.");
assert(competenceInitialXpFor("demi-elfe", "combattant", "Lecture et ecriture Rakuzan", { selected: ["Lecture et ecriture (Commun)", "Lecture et ecriture (Elfique)"] }) === 1, "Demi-Elfe doit garder chaque langue Lecture et ecriture a 1 XP.");
assert(competenceInitialXpFor("elfe-gris", "mage", "Lecture et ecriture Commun") === 1, "Elfe gris Mage doit garder Lecture et ecriture a 1 XP malgre le 1er gratuit de carriere.");
assert(competenceInitialXpFor("elfe-gris", "combattant", "Lecture et ecriture Rakuzan", { selected: ["Lecture et ecriture (Commun)", "Lecture et ecriture (Elfique)"] }) === 1, "Elfe gris doit garder chaque langue Lecture et ecriture a 1 XP.");
assert(competenceIsAvailable("demi-demon", "combattant", "Torture"), "Demi-demon doit avoir acces a Torture comme competence raciale gratuite.");
assert(!competenceIsAvailable("humain", "combattant", "Ferveur divine"), "Ferveur divine doit exiger Religion hors acces de carriere direct.");
assert(competenceIsAvailable("humain", "combattant", "Ferveur divine", { selected: ["Religion"] }), "Ferveur divine doit etre disponible avec Religion.");
assert(!competenceIsAvailable("humain", "combattant", "Sang impur"), "Sang impur doit exiger une race directe ou Religion malefique.");
assert(competenceIsAvailable("humain", "combattant", "Sang impur", { moralite: "malefique", selected: ["Religion"] }), "Sang impur doit etre disponible avec Religion malefique.");
assert(!competenceIsAvailable("humain", "combattant", "Sang pur", { moralite: "benefique" }), "Sang pur doit exiger Religion benefique.");
assert(competenceIsAvailable("humain", "combattant", "Sang pur", { moralite: "benefique", selected: ["Religion"] }), "Sang pur doit etre disponible avec Religion benefique.");
assert(!competenceIsAvailable("demi-demon", "combattant", "Sang pur", { moralite: "benefique", selected: ["Religion"] }), "Sang pur doit rester interdit aux races impures.");
const contactMarchandSelection = [
  "Contact Marchand - Mineur",
  "Contact Marchand - Druide",
  "Contact Marchand - Brasseur"
];
assert(contactMarchandOptionsFor("humain", "marchand").length === 7, "Marchand doit voir les 7 contacts marchands avant selection.");
assert(contactMarchandOptionsFor("humain", "marchand", { selected: contactMarchandSelection.slice(0, 1) }).length === 6, "Un contact marchand deja choisi ne doit pas etre propose une deuxieme fois.");
assert(contactMarchandOptionsFor("humain", "marchand", { selected: contactMarchandSelection.slice(0, 2) }).length === 5, "Marchand doit pouvoir choisir un troisieme contact marchand different.");
assert(contactMarchandOptionsFor("humain", "marchand", { selected: contactMarchandSelection }).length === 0, "Marchand ne doit pas pouvoir choisir plus de 3 contacts marchands.");
assert(contactMarchandOptionsFor("humain", "charlatan").length === 7, "Une carriere mixte marchande doit voir les contacts marchands avant selection.");
assert(contactMarchandOptionsFor("humain", "charlatan", { selected: contactMarchandSelection.slice(0, 1) }).length === 0, "Une carriere mixte marchande ne doit pas pouvoir choisir plus de 1 contact marchand.");
assert(competencesJs.includes("getFreeCompetenceFirstXp"), "Les avantages raciaux gratuits doivent appliquer le surcout mixte au premier achat.");
assert(competenceInitialXpFor("elfe-gris", "mage", "Haute magie") === 2, "Elfe gris Mage doit acheter Haute magie a 2 XP comme competence raciale a rabais.");
assert(competenceInitialXpFor("elfe-gris", "barde", "Haute magie") === 2, "Elfe gris Barde doit garder le rabais racial sur Haute magie sans surcout mixte.");
assert(competenceInitialXpFor("demi-elfe", "barde", "Archerie") === 2, "Demi-Elfe Barde doit acheter Archerie a 2 XP comme competence raciale a rabais.");
assert(competenceInitialXpFor("humain", "barde", "Haute magie") === 4, "Humain Barde doit payer le surcout mixte sur Haute magie.");
assert(competenceInitialXpFor("elfe-gris", "animiste", "Clairvoyance") === 6, "Animiste doit payer le surcout mixte meme quand la competence vient des deux sources.");
assert(magicPointsFor("elfe-sanguinaire", "barde") === 20, "Elfe sanguinaire semi-magique doit avoir 20 points de magie.");
assert(magicPointsFor("elfe-sanguinaire", "mage") === 30, "Elfe sanguinaire magique doit avoir 30 points de magie.");
assert(magicPointsFor("demi-elfe", "mage") === 20, "Les autres races magiques doivent conserver les points de magie de carriere.");
assert(hasSpellAccessFor("elfe-sanguinaire", "barbare") === false && magicPointsFor("elfe-sanguinaire", "barbare") === 0, "Le bonus Elfe sanguinaire ne doit pas donner acces aux sorts a une carriere non magique.");
assert(sortMaxFor("humain", "sage") === 6, "Sage doit garder un niveau de sorts maximum de base de 6.");
assert(sortMaxFor("humain", "sage", ["Ferveur magique"]) === 7, "Ferveur magique doit donner acces au niveau 7 pour Sage.");
assert(sortMaxFor("humain", "sage", ["Ferveur divine"]) === 7, "Ferveur divine doit donner acces au niveau 7 pour Sage.");
assert(sortMaxFor("humain", "barde") === 5, "Une carriere semi-magique doit garder un niveau de sorts maximum de base de 5.");
assert(sortMaxFor("humain", "barde", ["Ferveur magique"]) === 6, "Ferveur magique doit donner acces au niveau 6 pour une carriere semi-magique.");
assert((options.sorts?.["Sortil\u00e8ges"]?.["6"] || []).length > 0, "La caste 6 de Sortileges doit contenir des sorts accessibles.");
assert((options.sorts?.Dons?.["7"] || []).length > 0, "La caste 7 de Dons doit contenir des sorts accessibles.");
assert(!sortLevelIsChoice("humain", "barde", "Sortil\u00e8ges", 6, [], [1, 2, 3, 4, 5]), "Barde sans Ferveur magique ne doit pas voir la caste 6.");
assert(sortLevelIsChoice("humain", "barde", "Sortil\u00e8ges", 6, ["Ferveur magique"], [1, 2, 3, 4, 5]), "Ferveur magique doit rendre la caste 6 disponible dans le choix de sorts du Barde.");
assert(sortLevelIsChoice("humain", "sage", "Dons", 7, ["Ferveur magique"], [1, 2, 3, 4, 5, 6]), "Ferveur magique doit rendre la caste 7 disponible dans le choix de sorts du Sage.");
assert(sortMaxFor("humain", "barbare", ["Ferveur magique"]) === 0, "Ferveur magique ne doit pas donner de sorts a une carriere non magique.");
assert(normalizeCompetenceKey(competenceMetaEntry(meta, "Ambidexterie")?.frequence) === "a volonte", "Les competences non cumulables sans frequence Codex doivent etre a volonte.");
assert(normalizeCompetenceKey(competenceMetaEntry(meta, "Creation d anima")?.frequence) === "1 fois", "Une frequence Codex explicite doit etre conservee.");
assert(hasFirstFreeRule(options, "combattant", "resistance physique"), "Combattant doit avoir le 1er achat de Resistance physique gratuit.");
assert(hasFirstFreeRule(options, "mage", "lecture et ecriture"), "Mage doit avoir le 1er Lecture et ecriture gratuit.");
assert(hasFirstFreeRule(options, "barde", "lecture et ecriture"), "Barde doit avoir le 1er Lecture et ecriture gratuit.");
assert(hasFirstFreeRule(options, "charlatan", "lecture et ecriture"), "Charlatan doit avoir le 1er Lecture et ecriture gratuit.");
assert(hasFirstFreeRule(options, "charlatan", "resistance aux poisons"), "Charlatan doit avoir le 1er achat de Resistance aux poisons gratuit.");
assert(competenceInitialXpFor("elfe-noir", "charlatan", "Resistance aux poisons") === 0, "Elfe noir Charlatan doit acheter Resistance aux poisons gratuitement au premier achat.");
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
    naiss: "1990-02-03",
    premier: "2022-05-06",
    tel: "418-000-0000",
    email: "test@example.com",
    allergies: "Arachides",
    u1nom: "Contact Un",
    u1tel: "418-111-1111",
    u2nom: "Contact Deux",
    u2tel: "418-222-2222"
  },
  personnage: {
    nom: "Verification",
    premier: "2023-01-02",
    race: "humain",
    raceVariant: "",
    carriere: "charlatan",
    moralite: "balancee",
    religion: "Amida",
    religion2: "Baku",
    ecole: "Dons",
    ecole2: "Sortileges",
    maison: "Maison Verification",
    noblesse: "oui",
    ptsArmure: "7",
    typeArmure: "Metal rigide complet",
    piecesArmure: { zones: fullPlateZones, helmet: "metal-rigide", gorget: "metal-rigide" },
    chancesActuelles: "3",
    chancesMax: "3",
    faiblesses: "Feu",
    immunites: "Maladies",
    passeSaison: "oui",
    xpEvenements: "9",
    xpGeneraux: "11",
    ressources: "Forge - 10 cartes\nConcoction - 5 plantes",
    titres: "Titre special",
    notes: "Note de verification",
    bg: "Background complet"
  },
  audit: {
    eventCountCurrent: 3,
    eventAbuseWarning: "Alerte evenement",
    seasonPassWarning: "Alerte passe saison",
    chanceAbuseWarning: "Alerte chances"
  },
  competences: [
    { nom: "Falsification", freq: "", count: "1", xp: "0" },
    { nom: "Resistance physique", freq: "1/scenario", count: "2", xp: "12" }
  ],
  sorts: [{ ecole: "Dons", lvl: "1", nom: "Sort de verification", xp: "2" }],
  competencesSpeciales: [{ nom: "Marque de l'animation", freq: "1 fois", count: "2", xp: "7", note: "Titre special" }],
  sortsSpeciaux: [{ ecole: "Voie unique", lvl: "4", nom: "Sort hors codex", xp: "3", note: "Autorise par animation" }],
  evenements: [
    { ev: "Evenement un", saison: "12", xp: "3" },
    { ev: "Evenement deux", saison: "13", xp: "3" }
  ]
};

const workbook = await generateCharacterWorkbook(sample);
const parsed = await parseCharacterWorkbook(workbook);
assert(parsed.joueur.nom === sample.joueur.nom, "L'import Excel doit restaurer le nom du joueur.");
assert(parsed.joueur.naiss === sample.joueur.naiss, "L'import Excel doit restaurer la date de naissance.");
assert(parsed.joueur.premier === sample.joueur.premier, "L'import Excel doit restaurer la date du 1er Arkadia.");
assert(parsed.joueur.tel === sample.joueur.tel, "L'import Excel doit restaurer le telephone du joueur.");
assert(parsed.joueur.email === sample.joueur.email, "L'import Excel doit restaurer le courriel du joueur.");
assert(parsed.joueur.allergies === sample.joueur.allergies, "L'import Excel doit restaurer les allergies.");
assert(parsed.joueur.u1nom === sample.joueur.u1nom, "L'import Excel doit restaurer le contact d'urgence #1.");
assert(parsed.joueur.u1tel === sample.joueur.u1tel, "L'import Excel doit restaurer le telephone du contact #1.");
assert(parsed.joueur.u2nom === sample.joueur.u2nom, "L'import Excel doit restaurer le contact d'urgence #2.");
assert(parsed.joueur.u2tel === sample.joueur.u2tel, "L'import Excel doit restaurer le telephone du contact #2.");
assert(parsed.personnage.nom === sample.personnage.nom, "L'import Excel doit restaurer le nom du personnage.");
assert(parsed.personnage.premier === sample.personnage.premier, "L'import Excel doit restaurer la date du 1er evenement personnage.");
assert(parsed.personnage.race === sample.personnage.race, "L'import Excel doit restaurer la race.");
assert(parsed.personnage.carriere === sample.personnage.carriere, "L'import Excel doit restaurer la carriere.");
assert(parsed.personnage.moralite === sample.personnage.moralite, "L'import Excel doit restaurer la moralite.");
assert(parsed.personnage.religion === sample.personnage.religion, "L'import Excel doit restaurer la divinite.");
assert(parsed.personnage.religion2 === sample.personnage.religion2, "L'import Excel doit restaurer la divinite secondaire.");
assert(parsed.personnage.ecole === sample.personnage.ecole, "L'import Excel doit restaurer l'ecole de magie.");
assert(parsed.personnage.ecole2 === sample.personnage.ecole2, "L'import Excel doit restaurer l'ecole de magie secondaire.");
assert(parsed.personnage.maison === sample.personnage.maison, "L'import Excel doit restaurer la maison.");
assert(parsed.personnage.noblesse === sample.personnage.noblesse, "L'import Excel doit restaurer la noblesse.");
assert(parsed.personnage.typeArmure === sample.personnage.typeArmure, "L'import Excel doit restaurer le type d'armure.");
assert(parsed.personnage.chancesActuelles === sample.personnage.chancesActuelles, "L'import Excel doit restaurer les chances actuelles.");
assert(parsed.personnage.chancesMax === sample.personnage.chancesMax, "L'import Excel doit restaurer les chances maximum.");
assert(parsed.personnage.faiblesses === sample.personnage.faiblesses, "L'import Excel doit restaurer les faiblesses exportees.");
assert(parsed.personnage.immunites === sample.personnage.immunites, "L'import Excel doit restaurer les immunites exportees.");
assert(parsed.personnage.ressources === sample.personnage.ressources, "L'import Excel doit restaurer les ressources.");
assert(parsed.personnage.titres === sample.personnage.titres, "L'import Excel doit restaurer les titres.");
assert(parsed.personnage.notes === sample.personnage.notes, "L'import Excel doit restaurer les notes.");
assert(parsed.personnage.bg === sample.personnage.bg, "L'import Excel doit restaurer le background.");
assert(parsed.competences?.length === sample.competences.length, "L'import Excel doit restaurer toutes les competences.");
assert(parsed.competences?.[1]?.nom === sample.competences[1].nom && parsed.competences?.[1]?.count === sample.competences[1].count, "L'import Excel doit restaurer les competences cumulables.");
assert(parsed.sorts?.[0]?.ecole === sample.sorts[0].ecole && parsed.sorts?.[0]?.nom === sample.sorts[0].nom, "L'import Excel doit restaurer les sorts.");
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
assert(parsed.personnage.passeSaison === sample.personnage.passeSaison, "L'import Excel doit restaurer la passe saison.");
assert(parsed.personnage.xpEvenements === sample.personnage.xpEvenements, "L'import Excel doit restaurer les XP d'evenements.");
assert(parsed.personnage.xpGeneraux === sample.personnage.xpGeneraux, "L'import Excel doit restaurer les XP generaux.");
assert(parsed.personnage.evenementsParticipes === String(sample.audit.eventCountCurrent), "L'import Excel doit restaurer le nombre d'evenements.");
assert(parsed.evenements?.length === sample.evenements.length && parsed.evenements?.[1]?.ev === sample.evenements[1].ev, "L'import Excel doit restaurer l'historique des evenements.");
assert(apiJs.includes("/fiche/import-xlsx") && sauvegardeJs.includes("importerFicheExcel"), "L'UI doit utiliser l'import Excel specialise pour les fichiers xlsx/xlsm.");
assert(html.includes(".xlsm"), "Le selecteur de fichier doit accepter les imports XLSM.");

console.log("Verification Arkadia OK");
