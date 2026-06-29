// ===================== RACE =====================
function onRace(){
  refreshRaceCareerOptions('race');
  const r=getDatabaseRaceOption(v('race'));
  if(!r){
    showInfo('race-info','');
    renderRaceVariantSelector();
    g('xp-depart').value='0';
    pvBase=3;
    updateChanceLimits(true);
    sv('faiblesses','');
    sv('immunites','');
    validerCombinaisonRaceCarriere();
    validerMoraliteDivinite();
    updateEcoleSelector();
    refreshAllSortRows();
    calcXP(); calcStats(); updateCompetences();
    updateSelectionGuidance();
    return;
  }
  const pvInfo=r.pvJour===r.pvNuit?`${r.pvJour}`:`${r.pvJour} jour / ${r.pvNuit} nuit`;
  showInfo('race-info',`<b>${r.label}</b> · ${r.xp} XPs · PV : ${pvInfo} · Chances : ${r.chances || 3}`);
  g('xp-depart').value = r.xp || 0;
  renderRaceVariantSelector();
  updateChanceLimits(true);
  updateMoraliteSelector();
  updateFaiblessesImmunites();
  validerCombinaisonRaceCarriere();
  validerMoraliteDivinite();
  updateEcoleSelector();
  refreshAllSortRows();
  calcXP(); calcStats(); updateCompetences();
  updateSelectionGuidance();
}

function renderRaceVariantSelector(){
  const race=getSelectedRace();
  const wrap=g('race-variant-wrap');
  const sel=g('race-variant');
  const info=g('race-variant-info');
  const label=g('race-variant-label');
  const variants=Array.isArray(race?.variants)?race.variants:[];

  if(!wrap||!sel||!info)return;

  if(variants.length===0){
    wrap.style.display='none';
    sel.innerHTML='';
    sel.value='';
    info.textContent='';
    return;
  }

  const current=sel.value;
  wrap.style.display='flex';
  label.textContent=race.value==='saurien'?'Lignée saurienne':'Affinité élémentaire';
  sel.innerHTML='';
  variants.forEach(variant=>{
    const option=document.createElement('option');
    option.value=variant.value;
    option.textContent=variant.label;
    sel.appendChild(option);
  });
  sel.value=variants.some(variant=>variant.value===current)?current:variants[0].value;
  onRaceVariant();
}

function onRaceVariant(){
  const variant=getSelectedRaceVariant();
  const info=g('race-variant-info');
  if(info)info.textContent=variant?.description || '';
  updateFaiblessesImmunites();
}

function updateChanceLimits(resetBaseline=false){
  const input=g('chances-actuelles');
  const label=g('sv-chances');
  const race=getSelectedRace();
  const max=race?getRaceChanceMax():0;

  if(!input)return;

  input.max=String(max);
  input.disabled=!race;
  if(!race){
    input.value='0';
    if(label)label.textContent='max —';
    chanceCountBaseline=0;
    updateChanceAbuseWarning();
    return;
  }

  const current=parseInt(input.value,10);
  if(!Number.isFinite(current) || current<0 || current>max)input.value=String(max);
  if(label)label.textContent=`max ${max}`;
  if(resetBaseline)chanceCountBaseline=parseInt(input.value,10)||0;
  updateChanceAbuseWarning();
}

function onChanceChange(){
  updateChanceLimits(false);
}

// ===================== CARRIÈRE =====================
const CAREER_ADVANTAGE_SUMMARY={
  animiste:' · Avantages : compétences Prêtre/Druide, 2 écoles permises par sa divinité, détection magique au toucher, contrôle d’artéfact avec anima, 3 objets magiques portés, Concoction : Herboristerie',
  sage:' · Avantages : compétences Prêtre/Mage, 1er Lecture et écriture gratuit, tous les alphabets, 1 ou 2 divinités, 1 école divine + 1 école arcane, Concoction : Alchimie ou Herboristerie'
};

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
  const semiInfo=carriereEstSemiMagique(c)&&carriereDonneAccesSorts(c)?' · Sorts semi-magiques +1 XP':'';
  const magicInfo=carriereDonneAccesSorts(c)?` · Magie : ${getCarriereMagicPoints(c)} pts · Niveau max : ${getCarriereSortMaxLevel(c)}${semiInfo}`:'';
  const advantageInfo=CAREER_ADVANTAGE_SUMMARY[c.value] || '';
  showInfo('carr-info',`<b>${c.label}</b> · Armure permise : ${c.armurePermise} · Type : ${c.typeArmure || '—'}${magicInfo}${advantageInfo}`);
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

function onMoralite(){validerMoraliteDivinite();updateFaiblessesImmunites();updateEcoleSelector();updateCompetences();updateSelectionGuidance();}

// ===================== RELIGION =====================
function updateDiviniteInfo(){
  const selectedDivinities=getSelectedDivinitiesForSchools();
  if(!selectedDivinities.length){
    showInfo('divinite-info','');
    return;
  }

  const labels=selectedDivinities.map((divinite)=>getDatabaseReligionOption(divinite)?.label || divinite);
  const ecolesPermises=sortByText(selectedDivinities.flatMap((divinite)=>getAllowedSchoolsForDivinite(divinite))).join(', ');
  showInfo('divinite-info',`<b>${labels.join(' / ')}</b> · Écoles : ${ecolesPermises || 'Selon la base'}`);
}

function onReligion(){
  const div=v('religion');
  const d=getDatabaseReligionOption(div);
  updateMoraliteSelector();
  updateSecondaryReligionSelector();
  if(!d){updateDiviniteInfo();validerMoraliteDivinite();updateEcoleSelector();refreshAllSortRows();updateCompetences();updateSelectionGuidance();return;}
  updateDiviniteInfo();
  validerMoraliteDivinite();
  updateEcoleSelector();
  refreshAllSortRows();
  updateCompetences();
  updateSelectionGuidance();
}

function onReligion2(){
  updateDiviniteInfo();
  validerMoraliteDivinite();
  updateEcoleSelector();
  refreshAllSortRows();
  updateCompetences();
  updateSelectionGuidance();
}

function updateSecondaryReligionSelector(){
  const wrap=g('religion-2-wrap');
  const sel=g('religion-2');
  if(!wrap||!sel)return;

  const enabled=carriereAllowsSecondReligion(v('carriere'));
  if(!enabled){
    wrap.style.display='none';
    sel.value='';
    return;
  }

  const current=sel.value;
  wrap.style.display='block';
  renderOptions('religion-2', getReligionOptionsForSelection(), '-- Aucune / choisir --');
  sel.value=[...sel.options].some(option=>option.value===current)?current:'';
}

// ===================== ÉCOLE =====================
function setSchoolSelectOptions(select, options, placeholder, currentValue, blockedValue=''){
  if(!select)return;
  select.innerHTML='';

  const empty=document.createElement('option');
  empty.value='';
  empty.textContent=placeholder;
  select.appendChild(empty);

  options.forEach(ecole=>{
    if(blockedValue && normalizeCompetenceKey(ecole)===normalizeCompetenceKey(blockedValue))return;
    const option=document.createElement('option');
    option.value=ecole;
    option.textContent=ecole;
    select.appendChild(option);
  });

  select.value=[...select.options].some(option=>option.value===currentValue)?currentValue:'';
}

function updateEcoleSelector(){
  const div=v('religion');
  const carr=v('carriere');
  const c=getDatabaseCarriereOption(carr);
  const d=getDatabaseReligionOption(div);
  const ecoleEl=g('ecole');
  const ecole2El=g('ecole-2');
  const ecole2Wrap=g('ecole-2-wrap');
  const ecoleTxt=g('ecole-txt');
  const eclBadge=g('ecole-badge');
  const ecl2Badge=g('ecole-2-badge');
  const ecoleLabel=g('ecole-label');
  const ecole2Label=g('ecole-2-label');
  const currentEcole=ecoleEl.value;
  const currentEcole2=ecole2El?.value || '';
  const dual=carriereUsesDualSchools(carr);
  const allowedSchools=dual?getAllowedSchoolsForCareerAndDivinities(carr):getAllowedSchoolsForSelection(carr,div);
  updateSecondaryReligionSelector();
  
  if(c&&carriereDonneAccesSorts(c)&&d&&dual){
    const primaryOptions=getDualSchoolOptions('primary',carr);
    const secondaryOptions=getDualSchoolOptions('secondary',carr);
    const schoolRule=getCareerSchoolRule(carr) || {};
    const isSage=carr==='sage';
    const primaryType=schoolRule.primaryType;
    const secondaryType=schoolRule.secondaryType;
    const primaryLabel=primaryType==='divine'?'École divine':primaryType==='arcane'?'École arcane':'École de magie 1';
    const secondaryLabel=secondaryType==='divine'?'École divine':secondaryType==='arcane'?'École arcane':'École de magie 2';
    ecoleEl.style.display='block';
    ecoleTxt.style.display='none';
    if(ecole2Wrap)ecole2Wrap.style.display='block';
    if(ecoleLabel)ecoleLabel.textContent=primaryLabel;
    if(ecole2Label)ecole2Label.textContent=secondaryLabel;

    setSchoolSelectOptions(
      ecoleEl,
      primaryOptions,
      primaryType==='divine'?'-- Choisir l\'école divine --':primaryType==='arcane'?'-- Choisir l\'école arcane --':'-- Choisir une première école --',
      currentEcole
    );
    setSchoolSelectOptions(
      ecole2El,
      secondaryOptions,
      secondaryType==='divine'?'-- Choisir l\'école divine --':secondaryType==='arcane'?'-- Choisir l\'école arcane --':'-- Choisir une deuxième école --',
      currentEcole2,
      isSage?'':ecoleEl.value
    );

    if(!isSage && ecole2El && normalizeCompetenceKey(ecole2El.value)===normalizeCompetenceKey(ecoleEl.value))ecole2El.value='';
    eclBadge.textContent=primaryType==='divine'?'Choisir une école divine':primaryType==='arcane'?'Choisir une école arcane':'Première école permise';
    eclBadge.style.display=ecoleEl.value?'none':'block';
    if(ecl2Badge){
      ecl2Badge.textContent=secondaryType==='divine'?'Choisir une école divine':secondaryType==='arcane'?'Choisir une école arcane':'Deuxième école permise';
      ecl2Badge.style.display=ecole2El?.value?'none':'block';
    }
  } else if(c&&carriereDonneAccesSorts(c)&&d){
    if(ecole2Wrap)ecole2Wrap.style.display='none';
    if(ecole2El)ecole2El.value='';
    if(ecoleLabel)ecoleLabel.textContent='École(s) de magie';
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
    if(ecole2Wrap)ecole2Wrap.style.display='none';
    if(ecole2El)ecole2El.value='';
    if(ecoleLabel)ecoleLabel.textContent='École(s) de magie';
    ecoleEl.style.display='block';
    ecoleTxt.style.display='none';
    eclBadge.textContent='Choisir une divinité';
    eclBadge.style.display='block';
    ecoleEl.innerHTML='<option value="">-- Choisir une divinité pour voir les écoles permises --</option>';
  } else {
    if(ecole2Wrap)ecole2Wrap.style.display='none';
    if(ecole2El)ecole2El.value='';
    if(ecoleLabel)ecoleLabel.textContent='École(s) de magie';
    ecoleEl.style.display='none';
    ecoleTxt.style.display='block';
    eclBadge.style.display='none';
    ecoleTxt.value=c?'Carrière non-magique - pas de sorts':'Choisir une carrière magique et une divinité';
  }
  if(typeof validerEcolesMagie==='function')validerEcolesMagie(false);
}

function onEcole(){
  if(carriereUsesDualSchools(v('carriere')))updateEcoleSelector();
  const schools=getSelectedSpellSchools();
  const badge=g('ecole-badge');
  const badge2=g('ecole-2-badge');
  if(badge)badge.style.display=v('ecole')?'none':'block';
  if(badge2)badge2.style.display=v('ecole-2')?'none':'block';
  if(!schools.length){showInfo('ecole-info','');refreshAllSortRows();updateCompetences();updateSelectionGuidance();return;}
  const nb=schools.reduce((total,ecole)=>total+getSortCountForEcole(ecole),0);
  const maxLevel=getCarriereSortMaxLevel();
  showInfo('ecole-info',`<b>École(s) : ${schools.join(' / ')}</b> · ${nb} sorts disponibles (accès niveaux 1–${maxLevel}). Coûts selon la base de données.`);
  document.querySelectorAll('.sort-nom-sel').forEach(sel=>{
    const lvl=parseInt(sel.closest('tr')?.querySelector('.sort-lvl-sel')?.value)||null;
    updateSortOptions(sel,lvl);
  });
  refreshAllSortRows();
  updateCompetences();
  if(typeof validerEcolesMagie==='function')validerEcolesMagie(false);
  updateSelectionGuidance();
}

function onEcole2(){
  onEcole();
}

