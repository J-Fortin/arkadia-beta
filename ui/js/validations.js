// ===================== VALIDATIONS =====================
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

  if (race && religion) {
    const divinitesPermises = getAllowedDivinitiesForRace(race);
    if (divinitesPermises.length > 0 && !divinitesPermises.includes(religion)) {
      alertDiv.innerHTML = `⛔ <b>Divinité incompatible :</b> La base ne permet pas <b>${religion}</b> pour cette race.`;
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

function formulaireEstValidePourExport() {
  const validations = [
    validerCombinaisonRaceCarriere(),
    validerMoraliteDivinite()
  ];
  const ok = validations.every(Boolean);

  if (!ok) {
    const firstAlert = document.querySelector('.alert.show');
    firstAlert?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    alert("Impossible de sauvegarder ou d'envoyer : corrige d'abord les choix interdits.");
  }

  return ok;
}
