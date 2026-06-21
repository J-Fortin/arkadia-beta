// ===================== ÉTAT =====================
let pvBase=3,magiePts=0;
let compRows=0,sortRows=0,evRows=0;
let eventCountBaseline=0;
let lastEventAbuseWarning='';

function g(id){return document.getElementById(id)}
function v(id){return g(id)?.value||''}
function sv(id,val){const el=g(id);if(el&&val!==undefined)el.value=val;}

function showInfo(id,html){const el=g(id);if(el){el.innerHTML=html;el.style.display=html?'block':'none';}}

// ===================== FAIBLESSES / IMMUNITÉS =====================
const CARRIERE_EFFECTS = {
  barbare: {
    immunites: ["Fractures"]
  }
};

const COMPETENCE_EFFECTS = {
  "Bravoure": { immunites: ["Peur / effets de terreur"] },
  "Bravoure accrue": { immunites: ["Peur / effets de terreur accrus"] },
  "Endurance naturelle à la magie": { immunites: ["Résistance naturelle à la magie"] },
  "Résistance à l'alcool": { immunites: ["Résistance à l'alcool"] },
  "Résistance aux maladies": { immunites: ["Résistance aux maladies"] },
  "Résistance aux poisons": { immunites: ["Résistance aux poisons"] },
  "Résistance à la torture": { immunites: ["Résistance à la torture"] },
  "Résistance physique": { immunites: ["Résistance physique"] },
  "Résistance magique": { immunites: ["Résistance magique"] },
  "Résistance mentale": { immunites: ["Résistance mentale"] },
  "Résistance élémentaire": { immunites: ["Résistance élémentaire"] },
  "Peinture de protection": { immunites: ["Protection rituelle / peinture de protection"] },
  "Armure de la foi": { immunites: ["Protection divine"] },
  "Talisman": { immunites: ["Protection par talisman"] },
  "Talisman avancé": { immunites: ["Protection par talisman avancé"] }
};

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
  const r = RACES[race];
  const careerEffects = CARRIERE_EFFECTS[carriere];

  const faiblesses = [];
  const immunites = [];

  if(r){
    addEffect(faiblesses, r.faiblesses);
    addEffect(immunites, r.immunites);
  }

  (careerEffects?.faiblesses || []).forEach(effect => addEffect(faiblesses, effect));
  (careerEffects?.immunites || []).forEach(effect => addEffect(immunites, effect));

  selectedCompetenceNames().forEach(name => {
    const effects = COMPETENCE_EFFECTS[name];
    (effects?.faiblesses || []).forEach(effect => addEffect(faiblesses, effect));
    (effects?.immunites || []).forEach(effect => addEffect(immunites, effect));
  });

  sv('faiblesses', faiblesses.join(' · ') || '');
  sv('immunites', immunites.join(' · ') || '');
}

