// ===================== ÉTAT =====================
let pvBase=3,magiePts=0;
let compRows=0,sortRows=0,evRows=0,specialCompRows=0,specialSortRows=0;
let eventCountBaseline=0;
let lastEventAbuseWarning='';
let seasonPassBaseline=false;
let chanceCountBaseline=0;
let lastChanceAbuseWarning='';

function g(id){return document.getElementById(id)}
function v(id){return g(id)?.value||''}
function sv(id,val){const el=g(id);if(el&&val!==undefined)el.value=val;}

function showInfo(id,html){const el=g(id);if(el){el.innerHTML=html;el.style.display=html?'block':'none';}}

function getSelectedCarriere(){
  return typeof getDatabaseCarriereOption==='function'?getDatabaseCarriereOption(v('carriere')):null;
}

function getSelectedRace(){
  return typeof getDatabaseRaceOption==='function'?getDatabaseRaceOption(v('race')):null;
}

function getSelectedCarriereDatabaseOption(){
  return getSelectedCarriere();
}

const RACE_MAGIC_BONUSES={
  'elfe-sanguinaire':10
};

function normalizeStateKey(value){
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function hasSelectedFerveurMagique(){
  return selectedCompetenceNames().some(name=>{
    const normalized=normalizeStateKey(name).replace(/^touche a tout /,'');
    return normalized==='ferveur magique' || normalized==='ferveur magic' || normalized==='ferveur divine';
  });
}

function getBaseCarriereMagicPoints(carriere=getSelectedCarriere()){
  return Number(carriere?.ptsMagie)||0;
}

function carriereEstSemiMagique(carriere=getSelectedCarriere()){
  return Boolean(carriere?.semiMagique);
}

function carriereHasNativeMagicAccess(carriere=getSelectedCarriere()){
  return Boolean(carriere && (getBaseCarriereMagicPoints(carriere)>0 || Number(carriere.maxMagique)>0));
}

function getRaceMagicBonus(carriere=getSelectedCarriere()){
  if(!carriereHasNativeMagicAccess(carriere))return 0;
  return RACE_MAGIC_BONUSES[v('race')] || 0;
}

function getCarriereMagicPoints(carriere=getSelectedCarriere()){
  return getBaseCarriereMagicPoints(carriere)+getRaceMagicBonus(carriere);
}

function carriereDonneAccesSorts(carriere=getSelectedCarriere()){
  return carriereHasNativeMagicAccess(carriere);
}

function getCarriereSortMaxLevel(carriere=getSelectedCarriere()){
  if(!carriereDonneAccesSorts(carriere))return 0;
  const databaseMax=Number(carriere?.maxMagique)||0;
  const baseMax=databaseMax>0?databaseMax:(carriereEstSemiMagique(carriere)?5:10);
  return hasSelectedFerveurMagique()?baseMax+1:baseMax;
}

// ===================== FAIBLESSES / IMMUNITÉS =====================
function addEffect(target, value) {
  if (!value || value === 'Aucune') return;
  if (!target.includes(value)) target.push(value);
}

function getRaceChanceMax(){
  return Number(getSelectedRace()?.chances)||3;
}

function getSelectedRaceVariant(){
  const race=getSelectedRace();
  const variantValue=v('race-variant');
  const variants=Array.isArray(race?.variants)?race.variants:[];
  return variants.find(variant=>variant.value===variantValue)||null;
}

function selectedCompetenceNames() {
  const names = [];

  document.querySelectorAll('.comp-sel').forEach(sel => {
    if (!sel.value) return;
    const name = sel.value.split('|')[0];
    if (name) names.push(name);
  });

  return names;
}

function updateFaiblessesImmunites(){
  const race = v('race');
  const carriere = v('carriere');
  const moralite = v('moralite');

  const faiblesses = [];
  const immunites = [];

  getEffectsFromDatabase('faiblessesParRace', race).forEach(effect => addEffect(faiblesses, effect));
  getEffectsFromDatabase('faiblessesParCarriereMoralite', `${carriere}|${moralite}`).forEach(effect => addEffect(faiblesses, effect));
  getEffectsFromDatabase('immunitesParRace', race).forEach(effect => addEffect(immunites, effect));
  getEffectsFromDatabase('immunitesParCarriere', carriere).forEach(effect => addEffect(immunites, effect));

  const variant=getSelectedRaceVariant();
  (variant?.faiblesses || []).forEach(effect => addEffect(faiblesses, effect));
  (variant?.immunites || []).forEach(effect => addEffect(immunites, effect));

  selectedCompetenceNames().forEach(name => {
    getEffectsFromDatabase('immunitesParCompetence', name).forEach(effect => addEffect(immunites, effect));
  });

  sv('faiblesses', faiblesses.join(' · ') || '');
  sv('immunites', immunites.join(' · ') || '');
}

