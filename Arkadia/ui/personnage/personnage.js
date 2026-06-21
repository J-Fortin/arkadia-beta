// ===================== RACE =====================
function onRace(){
  refreshRaceCareerOptions('race');
  const r=RACES[v('race')];
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
  showInfo('race-info',`<b>${r.label}</b> · ${r.info}<br><i>Faiblesses : ${r.faiblesses} · Immunités : ${r.immunites}</i>`);
  g('xp-depart').value = r.xp;
  g('sv-chances').textContent = r.chances;
  updateFaiblessesImmunites();
  validerCombinaisonRaceCarriere();
  validerMoraliteDivinite();
  calcXP(); calcStats(); updateCompetences();
  updateSelectionGuidance();
}

// ===================== CARRIÈRE =====================
function onCarriere(){
  refreshRaceCareerOptions('carriere');
  const c=CARRIERES[v('carriere')];
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
  showInfo('carr-info',`<b>${c.label}</b> · ${c.info}<br><i>Armes : ${c.armes} · Armures : ${c.armures}</i>`);
  magiePts=c.ptsMagie;
  g('sv-magie').textContent=c.magie||c.ptsMagie>0?c.ptsMagie:'—';
  g('card-sorts').style.display=(c.magie||c.ptsMagie>0)?'block':'none';
  validerCombinaisonRaceCarriere();
  calcStats(); updateCompetences(); updateEcoleSelector(); refreshAllSortRows();
  updateSelectionGuidance();
}

// ===================== MORALITÉ =====================
const MORALITE_LABELS = {
  benefique: 'Bénéfique',
  balancee: 'Balancée',
  malefique: 'Maléfique'
};

function updateMoraliteSelector(){
  const moraliteEl=g('moralite');
  const div=v('religion');
  const d=DIVINITES[div];
  const current=moraliteEl.value;
  const moralites=d
    ? sortByText(d.moralites).sort((a,b)=>(MORALITE_LABELS[a]||a).localeCompare(MORALITE_LABELS[b]||b,'fr',{sensitivity:'base'}))
    : ['balancee','benefique','malefique'];

  moraliteEl.innerHTML='';
  const empty=document.createElement('option');
  empty.value='';
  empty.textContent=d?'-- Choisir une moralité permise --':'Choisir la divinité d\'abord';
  moraliteEl.appendChild(empty);

  moralites.forEach(m=>{
    const option=document.createElement('option');
    option.value=m;
    option.textContent=MORALITE_LABELS[m]||m;
    moraliteEl.appendChild(option);
  });

  moraliteEl.disabled=!d;
  moraliteEl.value=moralites.includes(current)?current:'';
}

function onMoralite(){validerMoraliteDivinite();updateEcoleSelector();updateSelectionGuidance();}

// ===================== RELIGION =====================
function onReligion(){
  const div=v('religion');
  const d=DIVINITES[div];
  updateMoraliteSelector();
  if(!d){showInfo('divinite-info','');validerMoraliteDivinite();updateEcoleSelector();updateSelectionGuidance();return;}
  const moralitesPermises=sortByText(d.moralites.map(m=>MORALITE_LABELS[m]||m)).join(', ');
  const ecolesPermises=sortByText(d.ecoles).join(', ');
  showInfo('divinite-info',`<b>${div}</b> · Moralités permises : ${moralitesPermises} · Écoles : ${ecolesPermises}`);
  validerMoraliteDivinite();
  updateEcoleSelector();
  updateSelectionGuidance();
}

// ===================== ÉCOLE =====================
function updateEcoleSelector(){
  const div=v('religion');
  const carr=v('carriere');
  const c=CARRIERES[carr];
  const d=DIVINITES[div];
  const ecoleEl=g('ecole');
  const ecoleTxt=g('ecole-txt');
  const eclBadge=g('ecole-badge');
  const currentEcole=ecoleEl.value;
  
  if(c&&(c.magie||c.ptsMagie>0)&&d){
    ecoleEl.style.display='block';
    ecoleTxt.style.display='none';
    ecoleEl.innerHTML='<option value="">-- Choisir l\'école correspondant à la divinité --</option>';
    sortByText(d.ecoles).forEach(e=>{
      const o=document.createElement('option');
      o.value=e;o.textContent=e;
      ecoleEl.appendChild(o);
    });
    ecoleEl.value=d.ecoles.includes(currentEcole)?currentEcole:'';
    eclBadge.textContent='Selon la divinité';
    eclBadge.style.display=ecoleEl.value?'none':'block';
  } else if(c&&(c.magie||c.ptsMagie>0)){
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
  const nb=Object.values(SORTS[e]||{}).reduce((a,b)=>a+b.length,0);
  showInfo('ecole-info',`<b>École : ${e}</b> · ${nb} sorts disponibles (niveaux 1–10). Coût : 2 XP (niv. 1–3) · 3 XP (niv. 4–6) · 4 XP (niv. 7–9) · 5 XP (niv. 10).`);
  document.querySelectorAll('.sort-nom-sel').forEach(sel=>{
    const lvl=parseInt(sel.closest('tr')?.querySelector('.sort-lvl-sel')?.value)||null;
    updateSortOptions(sel,lvl);
  });
  refreshAllSortRows();
  updateSelectionGuidance();
}

