// ===================== RACE =====================
function onRace(){
  refreshRaceCareerOptions('race');
  const r=getDatabaseRaceOption(v('race'));
  if(!r){
    showInfo('race-info','');
    g('xp-depart').value='0';
    pvBase=3;
    g('sv-chances').textContent='—';
    sv('faiblesses','');
    sv('immunites','');
    validerCombinaisonRaceCarriere();
    validerMoraliteDivinite();
    calcXP(); calcStats(); updateCompetences();
    updateSelectionGuidance();
    return;
  }
  const pvInfo=r.pvJour===r.pvNuit?`${r.pvJour}`:`${r.pvJour} jour / ${r.pvNuit} nuit`;
  showInfo('race-info',`<b>${r.label}</b> · ${r.xp} XPs · PV : ${pvInfo}`);
  g('xp-depart').value = r.xp || 0;
  g('sv-chances').textContent = '—';
  updateMoraliteSelector();
  updateFaiblessesImmunites();
  validerCombinaisonRaceCarriere();
  validerMoraliteDivinite();
  calcXP(); calcStats(); updateCompetences();
  updateSelectionGuidance();
}

// ===================== CARRIÈRE =====================
function onCarriere(){
  refreshRaceCareerOptions('carriere');
  const c=getDatabaseCarriereOption(v('carriere'));
  if(!c){
    showInfo('carr-info','');
    magiePts=0;
    g('sv-magie').textContent='—';
    g('card-sorts').style.display='none';
    validerCombinaisonRaceCarriere();
    updateCompetences(); updateEcoleSelector(); refreshAllSortRows();
    updateSelectionGuidance();
    return;
  }
  const magicInfo=carriereDonneAccesSorts(c)?` · Magie : ${getCarriereMagicPoints(c)} pts · Niveau max : ${getCarriereSortMaxLevel(c)}`:'';
  showInfo('carr-info',`<b>${c.label}</b> · Armure permise : ${c.armurePermise} · Type : ${c.typeArmure || '—'}${magicInfo}`);
  const hasSortAccess=carriereDonneAccesSorts(c);
  magiePts=getCarriereMagicPoints(c);
  g('sv-magie').textContent=hasSortAccess?magiePts:'—';
  g('card-sorts').style.display=hasSortAccess?'block':'none';
  validerCombinaisonRaceCarriere();
  calcStats(); updateCompetences(); updateEcoleSelector(); refreshAllSortRows();
  updateSelectionGuidance();
}

// ===================== MORALITÉ =====================
function updateMoraliteSelector(){
  const moraliteEl=g('moralite');
  const current=moraliteEl.value;
  const moraliteOptions=sortOptionsByLabel(getMoraliteOptionsForSelection());

  moraliteEl.innerHTML='';
  const empty=document.createElement('option');
  empty.value='';
  empty.textContent='-- Choisir une moralité permise --';
  moraliteEl.appendChild(empty);

  moraliteOptions.forEach(m=>{
    const option=document.createElement('option');
    option.value=m.value;
    option.textContent=m.label;
    moraliteEl.appendChild(option);
  });

  moraliteEl.disabled=moraliteOptions.length===0;
  moraliteEl.value=moraliteOptions.some((m)=>m.value===current)?current:'';
}

function onMoralite(){validerMoraliteDivinite();updateFaiblessesImmunites();updateEcoleSelector();updateSelectionGuidance();}

// ===================== RELIGION =====================
function onReligion(){
  const div=v('religion');
  const d=getDatabaseReligionOption(div);
  updateMoraliteSelector();
  if(!d){showInfo('divinite-info','');validerMoraliteDivinite();updateEcoleSelector();updateSelectionGuidance();return;}
  const ecolesPermises=sortByText(getAllowedSchoolsForDivinite(div)).join(', ');
  showInfo('divinite-info',`<b>${d.label}</b> · Écoles : ${ecolesPermises || 'Selon la base'}`);
  validerMoraliteDivinite();
  updateEcoleSelector();
  updateSelectionGuidance();
}

// ===================== ÉCOLE =====================
function updateEcoleSelector(){
  const div=v('religion');
  const carr=v('carriere');
  const c=getDatabaseCarriereOption(carr);
  const d=getDatabaseReligionOption(div);
  const ecoleEl=g('ecole');
  const ecoleTxt=g('ecole-txt');
  const eclBadge=g('ecole-badge');
  const currentEcole=ecoleEl.value;
  const allowedSchools=getAllowedSchoolsForSelection(carr,div);
  
  if(c&&carriereDonneAccesSorts(c)&&d){
    ecoleEl.style.display='block';
    ecoleTxt.style.display='none';
    ecoleEl.innerHTML='<option value="">-- Choisir l\'école correspondant à la divinité --</option>';
    allowedSchools.forEach(e=>{
      const o=document.createElement('option');
      o.value=e;o.textContent=e;
      ecoleEl.appendChild(o);
    });
    ecoleEl.value=allowedSchools.includes(currentEcole)?currentEcole:'';
    eclBadge.textContent='Selon la divinité';
    eclBadge.style.display=ecoleEl.value?'none':'block';
  } else if(c&&carriereDonneAccesSorts(c)){
    ecoleEl.style.display='block';
    ecoleTxt.style.display='none';
    eclBadge.textContent='Choisir une divinité';
    eclBadge.style.display='block';
    ecoleEl.innerHTML='<option value="">-- Choisir une divinité pour voir les écoles permises --</option>';
  } else {
    ecoleEl.style.display='none';
    ecoleTxt.style.display='block';
    eclBadge.style.display='none';
    ecoleTxt.value=c?'Carrière non-magique - pas de sorts':'Choisir une carrière magique et une divinité';
  }
}

function onEcole(){
  const e=v('ecole');
  const badge=g('ecole-badge');
  if(badge)badge.style.display=e?'none':'block';
  if(!e){showInfo('ecole-info','');updateSelectionGuidance();return;}
  const nb=getSortCountForEcole(e);
  const maxLevel=getCarriereSortMaxLevel();
  showInfo('ecole-info',`<b>École : ${e}</b> · ${nb} sorts disponibles (accès niveaux 1–${maxLevel}). Coûts selon la base de données.`);
  document.querySelectorAll('.sort-nom-sel').forEach(sel=>{
    const lvl=parseInt(sel.closest('tr')?.querySelector('.sort-lvl-sel')?.value)||null;
    updateSortOptions(sel,lvl);
  });
  refreshAllSortRows();
  updateSelectionGuidance();
}

