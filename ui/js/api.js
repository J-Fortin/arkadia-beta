// ===================== API / DATABASE =====================
const API_BASE_URLS = ["http://localhost:3000/api", "/api"];
let DATABASE_OPTIONS = null;
let COMPETENCE_META = {};
let COMPETENCE_META_INDEX = {};

async function fetchFromApi(path, fetchOptions = {}) {
  let lastError;

  for (const baseUrl of API_BASE_URLS) {
    try {
      const response = await fetch(`${baseUrl}${path}`, fetchOptions);
      if (response.ok) return response.json();
      lastError = new Error(`HTTP ${response.status}`);
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
      lastError = new Error(`HTTP ${response.status}`);
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
  if (Array.isArray(databaseSchools) && databaseSchools.length > 0) return databaseSchools;

  return [];
}

function getAllowedSchoolsForCarriere(carriereKey = v("carriere")) {
  const databaseSchools = DATABASE_OPTIONS?.ecolesParCarriere?.[carriereKey];
  return Array.isArray(databaseSchools) ? databaseSchools : [];
}

function getAllowedSchoolsForSelection(carriereKey = v("carriere"), divinite = v("religion")) {
  const diviniteSchools = getAllowedSchoolsForDivinite(divinite);
  const carriereSchools = getAllowedSchoolsForCarriere(carriereKey);

  if (diviniteSchools.length > 0 && carriereSchools.length > 0) {
    return sortByText(diviniteSchools.filter((ecole) => carriereSchools.includes(ecole)));
  }

  if (diviniteSchools.length > 0) return sortByText(diviniteSchools);
  if (carriereSchools.length > 0) return sortByText(carriereSchools);

  return [];
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
  renderOptions("ecole", options.ecoles, "-- Choisir l'école --");
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
    ["race", "carriere", "moralite", "religion", "ecole"].forEach((id) => {
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
      eventAbuseWarning: getEventAbuseWarning()
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

async function importerFicheExcel(file) {
  return fetchFromApi("/fiche/import-xlsx", {
    method: "POST",
    headers: { "Content-Type": file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    body: file
  });
}
