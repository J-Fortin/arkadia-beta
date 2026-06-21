// ===================== VALIDATIONS =====================
function raceCarriereSontCompatibles(race, carriere) {
  if (!race || !carriere) return true;

  const r = RACES[race];
  const c = CARRIERES[carriere];
  if (!r || !c) return true;

  if (r.carrieresInterdites && r.carrieresInterdites.includes(carriere)) return false;
  if (r.carrieresMustBe && !r.carrieresMustBe.includes(carriere)) return false;

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

  renderOptions('race', availableRaces, '-- Choisir une race --');
  renderOptions('carriere', availableCarrieres, '-- Choisir une carrière --');

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
    alert('La carrière choisie a été retirée, car elle est interdite pour cette race.');
  }

  if (changedField === 'carriere' && raceWasRemoved) {
    alert('La race choisie a été retirée, car elle est interdite pour cette carrière.');
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

  const r = RACES[race];
  const c = CARRIERES[carriere];
  if (!r || !c) {
    alertEl.classList.remove('show');
    return true;
  }

  if (!raceCarriereSontCompatibles(race, carriere)) {
    alertEl.innerHTML = `⛔ <b>Combinaison interdite :</b> La race <b>${r.label}</b> ne peut pas être de carrière <b>${c.label}</b>.`;
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
    const r = RACES[race];
    if (r && r.moralitesInterdites && r.moralitesInterdites.includes(moralite)) {
      const labMoral = {benefique:'Bénéfique', balancee:'Balancée', malefique:'Maléfique'}[moralite];
      alertRace.innerHTML = `⛔ <b>Moralité incompatible :</b> La race <b>${r.label}</b> ne peut pas être de moralité <b>${labMoral}</b>.`;
      alertRace.classList.add('show');
      ok = false;
    } else {
      alertRace.classList.remove('show');
    }
  } else {
    alertRace.classList.remove('show');
  }

  if (religion && moralite) {
    const d = DIVINITES[religion];
    if (d && !d.moralites.includes(moralite)) {
      const labMoral = {benefique:'Bénéfique', balancee:'Balancée', malefique:'Maléfique'}[moralite];
      const permises = d.moralites.map(m=>({benefique:'Bénéfique',balancee:'Balancée',malefique:'Maléfique'}[m])).join(', ');
      alertDiv.innerHTML = `⛔ <b>Moralité incompatible avec la divinité :</b> <b>${religion}</b> n'accepte pas la moralité <b>${labMoral}</b>. Moralités permises : ${permises}.`;
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
