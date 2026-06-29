// ===================== API / DATABASE =====================
const API_BASE_URLS = ["http://localhost:3000/api", "/api"];
let DATABASE_OPTIONS = null;
let COMPETENCE_META = {};
let COMPETENCE_META_INDEX = {};

function getCodexRuleGroup(group) {
  return DATABASE_OPTIONS?.rules?.[group] || {};
}

function getMagicRules() {
  return getCodexRuleGroup("magic");
}

async function apiErrorMessage(response) {
  try {
    const contentType = response.headers.get("Content-Type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return data?.message || `HTTP ${response.status}`;
    }
    return (await response.text()) || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

async function fetchFromApi(path, fetchOptions = {}) {
  let lastError;

  for (const baseUrl of API_BASE_URLS) {
    try {
      const response = await fetch(`${baseUrl}${path}`, fetchOptions);
      if (response.ok) return response.json();
      lastError = new Error(await apiErrorMessage(response));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function fetchBlobFromApi(path, fetchOptions = {}) {
  let lastError;

  for (const baseUrl of API_BASE_URLS) {
    try {
      const response = await fetch(`${baseUrl}${path}`, fetchOptions);
      if (response.ok) return response.blob();
      lastError = new Error(await apiErrorMessage(response));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function renderOptions(selectId, options, placeholder) {
  const select = g(selectId);
  if (!select || !Array.isArray(options) || options.length === 0) return;

  const currentValue = select.value;
  const sortedOptions = sortOptionsByLabel(options);
  select.innerHTML = "";

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = placeholder;
  select.appendChild(emptyOption);

  sortedOptions.forEach((option) => {
    const el = document.createElement("option");
    el.value = option.value;
    el.textContent = option.label;
    select.appendChild(el);
  });

  if (currentValue && sortedOptions.some((option) => option.value === currentValue)) {
    select.value = currentValue;
  }
}

function sortByText(values) {
  return [...values].sort((a, b) => String(a).localeCompare(String(b), "fr", { sensitivity: "base" }));
}

function sortOptionsByLabel(options) {
  return [...options].sort((a, b) => String(a.label || a.value).localeCompare(String(b.label || b.value), "fr", { sensitivity: "base" }));
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

function buildCompetenceMetaIndex(meta) {
  COMPETENCE_META_INDEX = {};

  Object.entries(meta || {}).forEach(([key, value]) => {
    const parts = key.split("|");
    const name = parts[parts.length - 1];
    const normalized = normalizeCompetenceKey(name);

    if (normalized) COMPETENCE_META_INDEX[normalized] = value;
  });
}

function getDatabaseCarriereOption(carriereKey = v("carriere")) {
  return (DATABASE_OPTIONS?.carrieres || []).find((option) => option.value === carriereKey) || null;
}

function getDatabaseRaceOption(raceKey = v("race")) {
  return (DATABASE_OPTIONS?.races || []).find((option) => option.value === raceKey) || null;
}

function getDatabaseReligionOption(religionKey = v("religion")) {
  return (DATABASE_OPTIONS?.religions || []).find((option) => option.value === religionKey) || null;
}

function getDatabaseMoraliteOption(moraliteKey = v("moralite")) {
  return (DATABASE_OPTIONS?.moralites || []).find((option) => option.value === moraliteKey) || null;
}

function getAllowedSchoolsForDivinite(divinite) {
  const databaseSchools = DATABASE_OPTIONS?.ecolesParDivinite?.[divinite];
  if (Array.isArray(databaseSchools) && databaseSchools.length > 0) return filterKnownMagicSchools(databaseSchools);

  return [];
}

function getAllowedSchoolsForCarriere(carriereKey = v("carriere")) {
  const databaseSchools = DATABASE_OPTIONS?.ecolesParCarriere?.[carriereKey];
  return Array.isArray(databaseSchools) ? filterKnownMagicSchools(databaseSchools) : [];
}

function getKnownMagicSchoolNames() {
  return (DATABASE_OPTIONS?.ecoles || []).map((option) => option.value);
}

function schoolExistsInDatabase(ecole) {
  const normalized = normalizeCompetenceKey(ecole);
  return getKnownMagicSchoolNames().some((school) => normalizeCompetenceKey(school) === normalized);
}

function filterKnownMagicSchools(schools) {
  return uniqueTexts((schools || []).filter((school) => schoolExistsInDatabase(school)));
}

function getCareerSchoolRule(carriereKey = v("carriere")) {
  return getMagicRules().dualSchoolCareers?.[carriereKey] || null;
}

function carriereUsesDualSchools(carriereKey = v("carriere")) {
  return Boolean(getCareerSchoolRule(carriereKey));
}

function carriereAllowsSecondReligion(carriereKey = v("carriere")) {
  return Boolean(getCareerSchoolRule(carriereKey)?.secondReligion);
}

function schoolHasType(ecole, type) {
  if (!type || type === "any") return true;
  const normalized = normalizeCompetenceKey(ecole);
  const source = getMagicRules().schoolTypes?.[type] || [];
  return source.some((school) => normalizeCompetenceKey(school) === normalized);
}

function uniqueTexts(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = normalizeCompetenceKey(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function schoolIsAllowedByRace(ecole, raceKey = v("race")) {
  const forbiddenSchools = getMagicRules().raceForbiddenSchools?.[raceKey] || [];
  if (forbiddenSchools.length === 0) return true;

  const normalized = normalizeCompetenceKey(ecole);
  return !forbiddenSchools.some((school) => normalizeCompetenceKey(school) === normalized);
}

function filterSchoolsForRace(schools, raceKey = v("race")) {
  return schools.filter((ecole) => schoolIsAllowedByRace(ecole, raceKey));
}

function getSelectedDivinitiesForSchools(carriereKey = v("carriere")) {
  const divinities = [v("religion")];
  if (carriereAllowsSecondReligion(carriereKey)) divinities.push(v("religion-2"));
  return uniqueTexts(divinities.filter(Boolean));
}

function getAllowedSchoolsForCareerAndDivinities(carriereKey = v("carriere"), divinities = getSelectedDivinitiesForSchools(carriereKey)) {
  const diviniteSchools = uniqueTexts(divinities.flatMap((divinite) => getAllowedSchoolsForDivinite(divinite)));
  const carriereSchools = getAllowedSchoolsForCarriere(carriereKey);
  let allowedSchools = [];

  if (diviniteSchools.length > 0 && carriereSchools.length > 0) {
    allowedSchools = diviniteSchools.filter((ecole) => carriereSchools.includes(ecole));
  } else if (diviniteSchools.length > 0) {
    allowedSchools = diviniteSchools;
  } else if (carriereSchools.length > 0) {
    allowedSchools = carriereSchools;
  }

  return sortByText(filterSchoolsForRace(uniqueTexts(allowedSchools)));
}

function getAllowedSchoolsForSelection(carriereKey = v("carriere"), divinite = v("religion")) {
  return getAllowedSchoolsForCareerAndDivinities(carriereKey, divinite ? [divinite] : []);
}

function getDualSchoolOptions(slot, carriereKey = v("carriere")) {
  const rule = getCareerSchoolRule(carriereKey);
  const type = slot === "secondary" ? rule?.secondaryType : rule?.primaryType;
  const schools = getAllowedSchoolsForCareerAndDivinities(carriereKey);
  return schools.filter((school) => schoolHasType(school, type));
}

function getSelectedSpellSchools() {
  return uniqueTexts([v("ecole"), v("ecole-2")].filter(Boolean));
}

function getRequiredSpellSchoolTypes(carriereKey = v("carriere")) {
  const rule = getCareerSchoolRule(carriereKey);
  if (!rule) return [];
  return [rule.primaryType, rule.secondaryType].filter(Boolean);
}

function spellSchoolTypeLabel(type) {
  if (type === "arcane") return "arcane";
  if (type === "divine") return "divine";
  return "permise";
}

function selectedSchoolMatchesType(type) {
  if (!type || type === "any") return true;
  return getSelectedSpellSchools().some((school) => schoolHasType(school, type));
}

function spellSchoolsMeetRequirements(carriereKey = v("carriere")) {
  const carriere = getDatabaseCarriereOption(carriereKey);
  if (!carriereDonneAccesSorts(carriere)) return true;

  const selected = getSelectedSpellSchools();
  const rule = getCareerSchoolRule(carriereKey);
  if (!rule) return selected.length >= 1;

  const requiredTypes = getRequiredSpellSchoolTypes(carriereKey);
  if (requiredTypes.length > 1 && selected.length < 2) return false;
  return requiredTypes.every((type) => selectedSchoolMatchesType(type));
}

function spellSchoolRequirementMessage(carriereKey = v("carriere")) {
  const rule = getCareerSchoolRule(carriereKey);
  if (!rule) return "Choisis une école de magie permise.";

  const requiredTypes = getRequiredSpellSchoolTypes(carriereKey).map(spellSchoolTypeLabel);
  if (carriereKey === "sage") return "Le Sage doit choisir une école divine et une école arcane permises par sa ou ses divinités.";
  if (carriereKey === "chaman") return "Le Chaman doit choisir une école divine et une école arcane permises par sa divinité.";
  if (getRequiredSpellSchoolTypes(carriereKey).every((type) => type === "any")) {
    return "Cette carrière doit choisir deux écoles de magie permises par sa divinité.";
  }
  if (requiredTypes.length > 1) return `Cette carrière doit choisir deux écoles de magie ${requiredTypes.join(" et ")}.`;
  return "Choisis les écoles de magie permises par cette carrière.";
}

function getSortEntries(ecole, level = null) {
  const databaseSorts = DATABASE_OPTIONS?.sorts?.[ecole];

  if (databaseSorts) {
    if (level) return databaseSorts[String(level)] || [];
    return Object.values(databaseSorts).flat();
  }

  return [];
}

function getSortCountForEcole(ecole) {
  return getSortEntries(ecole).length;
}

function getSortXpFromDatabase(ecole, level, nom = "") {
  const entries = getSortEntries(ecole, level);
  const selected = nom ? entries.find((entry) => entry.nom === nom) : null;
  const xp = Number((selected || entries[0])?.xp);

  return Number.isFinite(xp) && xp > 0 ? xp : null;
}

function getAllowedCareersForRace(raceKey = v("race")) {
  return DATABASE_OPTIONS?.carrieresPermisesParRace?.[raceKey] || [];
}

function getAllowedMoralitesForRace(raceKey = v("race")) {
  return DATABASE_OPTIONS?.moralitesPermisesParRace?.[raceKey] || [];
}

function getAllowedDivinitiesForRace(raceKey = v("race")) {
  return DATABASE_OPTIONS?.divinitesPermisesParRace?.[raceKey] || [];
}

function getMoraliteOptionsForSelection(raceKey = v("race")) {
  const allowed = getAllowedMoralitesForRace(raceKey);
  const options = DATABASE_OPTIONS?.moralites || [];
  if (allowed.length === 0) return options;
  return options.filter((option) => allowed.includes(option.value));
}

function getReligionOptionsForSelection(raceKey = v("race")) {
  const allowed = getAllowedDivinitiesForRace(raceKey);
  const options = DATABASE_OPTIONS?.religions || [];
  if (allowed.length === 0) return options;
  return options.filter((option) => allowed.includes(option.value));
}

function getDatabaseCompetenceOptions() {
  return DATABASE_OPTIONS?.competences || [];
}

function getEffectsFromDatabase(kind, key) {
  return DATABASE_OPTIONS?.[kind]?.[key] || [];
}

function renderDatabaseOptions(options) {
  DATABASE_OPTIONS = options;
  renderOptions("race", options.races, "-- Choisir une race --");
  renderOptions("carriere", options.carrieres, "-- Choisir une carrière --");
  renderOptions("moralite", options.moralites, "-- Choisir --");
  renderOptions("religion", options.religions, "-- Choisir --");
  renderOptions("religion-2", options.religions, "-- Aucune / choisir --");
  renderOptions("ecole", options.ecoles, "-- Choisir l'école --");
  renderOptions("ecole-2", options.ecoles, "-- Choisir l'école --");
  refreshRaceCareerOptions();
}

async function loadDatabaseOptions() {
  try {
    const [options, competenceMeta] = await Promise.all([
      fetchFromApi("/database/options"),
      fetchFromApi("/database/competences-meta")
    ]);
    COMPETENCE_META = competenceMeta || {};
    buildCompetenceMetaIndex(COMPETENCE_META);
    renderDatabaseOptions(options);

    return true;
  } catch (error) {
    console.error("Base de données non disponible.", error);
    COMPETENCE_META = {};
    buildCompetenceMetaIndex(COMPETENCE_META);
    DATABASE_OPTIONS = null;
    ["race", "carriere", "moralite", "religion", "religion-2", "ecole", "ecole-2"].forEach((id) => {
      const select = g(id);
      if (!select) return;
      select.innerHTML = '<option value="">Base de données indisponible</option>';
      select.disabled = true;
    });
    showInfo("race-info", "Base de données indisponible. Les choix ne sont pas générés localement.");
    return false;
  }
}

async function envoyerFicheParCourriel(data) {
  if (!formulaireEstValidePourExport()) return false;
  const payload = {
    ...data,
    audit: {
      ...(data?.audit || {}),
      eventCountBaseline,
      eventCountCurrent: parseInt(v("xp-total")) || 0,
      eventAbuseWarning: getEventAbuseWarning(),
      chanceCountBaseline,
      chanceCountCurrent: parseInt(v("chances-actuelles")) || 0,
      chanceMax: getRaceChanceMax(),
      chanceAbuseWarning: getChanceAbuseWarning()
    }
  };

  return fetchFromApi("/email/envoyer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

async function exporterFicheExcel(data) {
  return fetchBlobFromApi("/fiche/export-xlsx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
}

async function importerFiche(file) {
  return fetchFromApi("/fiche/import-file", {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-Filename": encodeURIComponent(file.name || "fiche")
    },
    body: file
  });
}
