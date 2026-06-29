// ===================== VALIDATIONS =====================
const PLAYER_REQUIRED_FIELDS = [
  { id: 'j-nom', label: 'Nom du joueur' },
  { id: 'j-tel', label: 'Téléphone du joueur' },
  { id: 'j-email', label: 'Courriel du joueur' },
  { id: 'u1-nom', label: "Contact d'urgence #1" },
  { id: 'u1-tel', label: "Téléphone du contact d'urgence #1" },
  { id: 'u2-nom', label: "Contact d'urgence #2" },
  { id: 'u2-tel', label: "Téléphone du contact d'urgence #2" }
];

function setFieldInvalid(id, isInvalid) {
  const field = g(id);
  const wrap = field?.closest('.col, .col-2, .col-3, .col-full');
  field?.classList.toggle('invalid-field', isInvalid);
  field?.setAttribute('aria-invalid', isInvalid ? 'true' : 'false');
  wrap?.classList.toggle('invalid-choice', isInvalid);
  wrap?.classList.remove('missing-required');
  if (isInvalid && wrap) {
    void wrap.offsetWidth;
    wrap.classList.add('missing-required');
  }
}

function validerInformationsJoueurObligatoires() {
  const alertEl = document.getElementById('alert-joueur');
  const missing = [];

  PLAYER_REQUIRED_FIELDS.forEach(({ id, label }) => {
    const field = g(id);
    const isMissing = !String(field?.value || '').trim();
    setFieldInvalid(id, isMissing);
    if (isMissing) missing.push(label);
  });

  const emailField = g('j-email');
  const emailInvalid = Boolean(emailField?.value?.trim()) && !emailField.checkValidity();
  if (emailInvalid) {
    setFieldInvalid('j-email', true);
  }

  if (missing.length === 0 && !emailInvalid) {
    alertEl?.classList.remove('show');
    if (alertEl) alertEl.innerHTML = '';
    return true;
  }

  const details = [];
  if (missing.length > 0) details.push(`Champs obligatoires manquants : ${missing.join(', ')}.`);
  if (emailInvalid) details.push('Le courriel du joueur doit être valide.');

  if (alertEl) {
    alertEl.innerHTML = `⛔ <b>Informations du joueur incomplètes :</b> ${details.join(' ')}`;
    alertEl.classList.add('show');
  }

  return false;
}

function raceCarriereSontCompatibles(race, carriere) {
  if (!race || !carriere) return true;

  const carrieresPermises = getAllowedCareersForRace(race);
  if (carrieresPermises.length > 0 && !carrieresPermises.includes(carriere)) return false;

  return true;
}

function refreshRaceCareerOptions(changedField = null) {
  if (!DATABASE_OPTIONS) return;

  const raceEl = g('race');
  const carriereEl = g('carriere');
  const currentRace = raceEl.value;
  const currentCarriere = carriereEl.value;

  const availableRaces = DATABASE_OPTIONS.races.filter(option => {
    return !currentCarriere || raceCarriereSontCompatibles(option.value, currentCarriere);
  });
  const availableCarrieres = DATABASE_OPTIONS.carrieres.filter(option => {
    return !currentRace || raceCarriereSontCompatibles(currentRace, option.value);
  });
  const availableReligions = getReligionOptionsForSelection(currentRace);

  renderOptions('race', availableRaces, '-- Choisir une race --');
  renderOptions('carriere', availableCarrieres, '-- Choisir une carrière --');
  renderOptions('religion', availableReligions, '-- Choisir --');
  renderOptions('religion-2', availableReligions, '-- Aucune / choisir --');

  const raceWasRemoved = Boolean(currentRace && !availableRaces.some(option => option.value === currentRace));
  const carriereWasRemoved = Boolean(currentCarriere && !availableCarrieres.some(option => option.value === currentCarriere));

  if (raceWasRemoved) {
    raceEl.value = '';
    showInfo('race-info', '');
  }

  if (carriereWasRemoved) {
    carriereEl.value = '';
    showInfo('carr-info', '');
    g('card-sorts').style.display = 'none';
  }

  if (changedField === 'race' && carriereWasRemoved) {
    alert('La carrière choisie a été retirée, car elle n’est pas permise par la base pour cette race.');
  }

  if (changedField === 'carriere' && raceWasRemoved) {
    alert('La race choisie a été retirée, car elle n’est pas permise par la base pour cette carrière.');
  }
}

function validerCombinaisonRaceCarriere() {
  const race = v('race');
  const carriere = v('carriere');
  const alertEl = document.getElementById('alert-race-carriere');

  setRaceCarriereInvalid(false);

  if (!race || !carriere) {
    alertEl.classList.remove('show');
    return true;
  }

  const r = getDatabaseRaceOption(race);
  const c = getDatabaseCarriereOption(carriere);
  if (!r || !c) {
    alertEl.classList.remove('show');
    return true;
  }

  if (!raceCarriereSontCompatibles(race, carriere)) {
    alertEl.innerHTML = `⛔ <b>Combinaison interdite :</b> La base ne permet pas <b>${r.label}</b> avec <b>${c.label}</b>.`;
    alertEl.classList.add('show');
    setRaceCarriereInvalid(true);
    return false;
  }

  alertEl.classList.remove('show');
  return true;
}

function setRaceCarriereInvalid(isInvalid) {
  ['race', 'carriere'].forEach(id => {
    const field = g(id);
    const wrap = field?.closest('.col, .col-2, .col-3, .col-full');
    field?.classList.toggle('invalid-field', isInvalid);
    wrap?.classList.toggle('invalid-choice', isInvalid);
  });
}

function validerMoraliteDivinite() {
  const moralite = v('moralite');
  const religion = v('religion');
  const religion2 = v('religion-2');
  const race = v('race');
  const alertDiv = document.getElementById('alert-moralite-divinite');
  const alertRace = document.getElementById('alert-moralite-race');
  let ok = true;

  if (race && moralite) {
    const r = getDatabaseRaceOption(race);
    const moralitesPermises = getAllowedMoralitesForRace(race);
    if (moralitesPermises.length > 0 && !moralitesPermises.includes(moralite)) {
      const labMoral = getDatabaseMoraliteOption(moralite)?.label || moralite;
      alertRace.innerHTML = `⛔ <b>Moralité incompatible :</b> La base ne permet pas <b>${labMoral}</b> pour <b>${r?.label || race}</b>.`;
      alertRace.classList.add('show');
      ok = false;
    } else {
      alertRace.classList.remove('show');
    }
  } else {
    alertRace.classList.remove('show');
  }

  if (race && (religion || religion2)) {
    const divinitesPermises = getAllowedDivinitiesForRace(race);
    const invalidReligion = [religion, religion2].filter(Boolean).find((divinite) => divinitesPermises.length > 0 && !divinitesPermises.includes(divinite));
    if (invalidReligion) {
      alertDiv.innerHTML = `⛔ <b>Divinité incompatible :</b> La base ne permet pas <b>${invalidReligion}</b> pour cette race.`;
      alertDiv.classList.add('show');
      ok = false;
    } else {
      alertDiv.classList.remove('show');
    }
  } else {
    alertDiv.classList.remove('show');
  }

  return ok;
}

function setEcolesInvalid(isInvalid) {
  ['ecole', 'ecole-2'].forEach(id => {
    const field = g(id);
    const wrap = field?.closest('.col, .col-2, .col-3, .col-full');
    field?.classList.toggle('invalid-field', isInvalid);
    wrap?.classList.toggle('invalid-choice', isInvalid);
  });
}

function validerEcolesMagie(showMissing = true) {
  const alertEl = document.getElementById('alert-ecole-magie');
  const carriere = getDatabaseCarriereOption(v('carriere'));
  const selected = typeof getSelectedSpellSchools === 'function' ? getSelectedSpellSchools() : [v('ecole')].filter(Boolean);
  const needsSchools = carriereDonneAccesSorts(carriere);

  setEcolesInvalid(false);

  if (!needsSchools) {
    alertEl?.classList.remove('show');
    if (alertEl) alertEl.innerHTML = '';
    return true;
  }

  const valid = typeof spellSchoolsMeetRequirements === 'function'
    ? spellSchoolsMeetRequirements()
    : selected.length > 0;

  if (valid) {
    alertEl?.classList.remove('show');
    if (alertEl) alertEl.innerHTML = '';
    return true;
  }

  if (!showMissing && selected.length === 0) {
    alertEl?.classList.remove('show');
    if (alertEl) alertEl.innerHTML = '';
    return true;
  }

  const message = typeof spellSchoolRequirementMessage === 'function'
    ? spellSchoolRequirementMessage()
    : "Choisis une école de magie permise.";
  if (alertEl) {
    alertEl.innerHTML = `⛔ <b>Écoles de magie incomplètes :</b> ${message}`;
    alertEl.classList.add('show');
  }
  setEcolesInvalid(true);
  return false;
}

function formulaireEstValidePourExport() {
  const validations = [
    validerInformationsJoueurObligatoires(),
    validerCombinaisonRaceCarriere(),
    validerMoraliteDivinite(),
    validerEcolesMagie(true)
  ];
  const ok = validations.every(Boolean);

  if (!ok) {
    const firstAlert = document.querySelector('.alert.show');
    firstAlert?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    alert("Impossible de sauvegarder ou d'envoyer : corrige d'abord les champs en erreur.");
  }

  return ok;
}
