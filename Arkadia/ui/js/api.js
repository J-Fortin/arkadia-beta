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

function optionsFromObject(source) {
  return Object.entries(source).map(([value, item]) => ({
    value,
    label: item.label || value
  }));
}

function getLocalDatabaseOptions() {
  return {
    races: optionsFromObject(RACES),
    carrieres: optionsFromObject(CARRIERES),
    moralites: [
      { value: "benefique", label: "Bénéfique" },
      { value: "balancee", label: "Balancée" },
      { value: "malefique", label: "Maléfique" }
    ],
    religions: Object.keys(DIVINITES).map((name) => ({
      value: name,
      label: name
    })),
    ecoles: Object.keys(SORTS).map((name) => ({
      value: name,
      label: name
    }))
  };
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
    console.warn("Base de données non disponible, utilisation des choix locaux.", error);
    COMPETENCE_META = {};
    buildCompetenceMetaIndex(COMPETENCE_META);
    renderDatabaseOptions(getLocalDatabaseOptions());
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
