// ===================== ÉTAT =====================
let pvBase=3,magiePts=0;
let compRows=0,sortRows=0,evRows=0;
let eventCountBaseline=0;
let lastEventAbuseWarning='';

function g(id){return document.getElementById(id)}
function v(id){return g(id)?.value||''}
function sv(id,val){const el=g(id);if(el&&val!==undefined)el.value=val;}

function showInfo(id,html){const el=g(id);if(el){el.innerHTML=html;el.style.display=html?'block':'none';}}

function getSelectedCarriere(){
  return typeof getDatabaseCarriereOption==='function'?getDatabaseCarriereOption(v('carriere')):null;
}

function getSelectedCarriereDatabaseOption(){
  return getSelectedCarriere();
}

function getCarriereMagicPoints(carriere=getSelectedCarriere()){
  return Number(carriere?.ptsMagie)||0;
}

function carriereEstSemiMagique(carriere=getSelectedCarriere()){
  return Boolean(carriere?.semiMagique);
}

function carriereDonneAccesSorts(carriere=getSelectedCarriere()){
  return Boolean(carriere && (getCarriereMagicPoints(carriere)>0 || carriere.semiMagique || Number(carriere.maxMagique)>0));
}

function getCarriereSortMaxLevel(carriere=getSelectedCarriere()){
  if(!carriereDonneAccesSorts(carriere))return 0;
  const databaseMax=Number(carriere?.maxMagique)||0;
  if(databaseMax>0)return databaseMax;
  return carriereEstSemiMagique(carriere)?5:10;
}

// ===================== FAIBLESSES / IMMUNITÉS =====================
function addEffect(target, value) {
  if (!value || value === 'Aucune') return;
  if (!target.includes(value)) target.push(value);
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

  selectedCompetenceNames().forEach(name => {
    getEffectsFromDatabase('immunitesParCompetence', name).forEach(effect => addEffect(immunites, effect));
  });

  sv('faiblesses', faiblesses.join(' · ') || '');
  sv('immunites', immunites.join(' · ') || '');
}

