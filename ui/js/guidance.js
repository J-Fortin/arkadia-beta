// ===================== GUIDAGE DES SÉLECTIONS =====================
const SELECTION_STEPS = ["race", "carriere", "religion", "moralite", "ecole"];

const STEP_MESSAGES = {
  race: "1. Choisir la race",
  carriere: "2. Choisir la carrière",
  religion: "3. Choisir la religion ou divinité",
  moralite: "4. Choisir une moralité permise par la divinité",
  ecole: "5. Choisir l'école de magie"
};

function getFieldWrap(id) {
  return g(id)?.closest(".col, .col-2, .col-3, .col-full");
}

function getStepHint(wrap) {
  let hint = wrap.querySelector(":scope > .step-hint");

  if (!hint) {
    hint = document.createElement("div");
    hint.className = "step-hint";
    wrap.appendChild(hint);
  }

  return hint;
}

function setStepState(id, state, message = "") {
  const wrap = getFieldWrap(id);
  if (!wrap) return;

  wrap.classList.remove("step-active", "step-done", "step-disabled");
  if (state) wrap.classList.add(`step-${state}`);

  const hint = getStepHint(wrap);
  hint.textContent = message;
  hint.style.display = message ? "block" : "none";
}

function isMagicCareerSelected() {
  const carriere = getDatabaseCarriereOption(v("carriere"));
  return carriereDonneAccesSorts(carriere);
}

function updateSelectionGuidance() {
  SELECTION_STEPS.forEach((id) => setStepState(id, null));

  const hasRace = Boolean(v("race"));
  const hasCarriere = Boolean(v("carriere"));
  const hasReligion = Boolean(v("religion"));
  const hasMoralite = Boolean(v("moralite"));
  const needsEcole = isMagicCareerSelected();
  const hasEcole = typeof getSelectedSpellSchools === "function" ? getSelectedSpellSchools().length > 0 : Boolean(v("ecole"));

  if (hasRace) setStepState("race", "done", "Race sélectionnée");
  if (hasCarriere) setStepState("carriere", "done", "Carrière sélectionnée");
  if (hasReligion) setStepState("religion", "done", "Religion sélectionnée");
  if (hasMoralite) setStepState("moralite", "done", "Moralité permise sélectionnée");
  if (needsEcole && hasEcole) setStepState("ecole", "done", "École(s) sélectionnée(s)");

  if (!hasRace) {
    setStepState("race", "active", STEP_MESSAGES.race);
    return;
  }

  if (!hasCarriere) {
    setStepState("carriere", "active", STEP_MESSAGES.carriere);
    return;
  }

  if (!hasReligion) {
    setStepState("religion", "active", STEP_MESSAGES.religion);
    setStepState("moralite", "disabled", "Choisis une divinité pour débloquer les moralités permises.");
    return;
  }

  if (!hasMoralite) {
    setStepState("moralite", "active", STEP_MESSAGES.moralite);
    return;
  }

  if (needsEcole && !hasEcole) {
    setStepState("ecole", "active", "La divinité est choisie; sélectionne maintenant l'école de magie.");
    return;
  }

  if (!needsEcole) {
    setStepState("ecole", "disabled", "Aucune école requise pour cette carrière.");
  }
}
