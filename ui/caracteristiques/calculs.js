// ===================== XP + STATS =====================
function calcXP(){
  let dep=0;
  document.querySelectorAll('.comp-xp').forEach(el=>dep+=parseInt(el.value)||0);
  document.querySelectorAll('#sorts-tbody tr').forEach(row=>{
    const hasSort=row.querySelector('.sort-lvl-sel')?.value||row.querySelector('.sort-nom-sel')?.value;
    if(hasSort)dep+=parseInt(row.querySelector('.sort-xp')?.value)||0;
  });
  const eventCount=parseInt(v('xp-total'))||0;
  const eventXP=eventCount*3;
  const total=eventXP+(parseInt(v('xp-depart'))||0);
  const dispo=total-dep;
  sv('xp-dep',dep);sv('xp-dispo',dispo);
  const pct=total>0?Math.min(100,(dep/total)*100):0;
  g('xp-bar').style.width=pct+'%';
  g('xp-lbl-d').textContent=dep+' dépensés';
  g('xp-lbl-t').textContent=total+' total ('+eventCount+' événements × 3 XP)';
  updateEventAbuseWarning();
}

function getEventAbuseWarning(){
  const current=parseInt(v('xp-total'))||0;
  const increase=current-eventCountBaseline;

  if(increase>1){
    return `Attention : le nombre d'événements participés a augmenté de ${increase} depuis la fiche chargée (${eventCountBaseline} → ${current}). À vérifier avant validation.`;
  }

  return '';
}

function updateEventAbuseWarning(){
  const alertEl=g('alert-evenements-abus');
  if(!alertEl)return;

  const warning=getEventAbuseWarning();
  alertEl.innerHTML=warning?`⚠ <b>Vérification anti-abus :</b> ${warning}`:'';
  alertEl.classList.toggle('show',Boolean(warning));

  if(warning && warning!==lastEventAbuseWarning){
    lastEventAbuseWarning=warning;
    alert(warning);
  } else if(!warning) {
    lastEventAbuseWarning='';
  }
}

function onEventCountChange(){
  calcXP();
}

const COMPETENCE_PV_BONUS = {
  'endurance simple': 1,
  'endurance guerriere': 1
};

const RACE_PV_RULES = {
  'humain': { value: 3, label: '3' },
  'demi-elfe': { value: 3, label: '3' },
  'elfe-gris': { value: 3, label: '3' },
  'elfe-lunaire': { value: 3, label: '3 variable jour/nuit' },
  'elfe-noir': { value: 3, label: '3' },
  'elfe-sanguinaire': { value: 3, label: '3' },
  'elfe-sauvage': { value: 3, label: '3' },
  'etre-sylvestre': { value: 3, label: '3' },
  'haut-elfe': { value: 3, label: '3' },
  'nain': { value: 4, label: '4' },
  'gobelin': { value: 4, label: '2 jour / 4 nuit' },
  'orque': { value: 4, label: '4' },
  'demi-demon': { value: 4, label: '4' },
  'illithyd': { value: 3, label: '3' },
  'norde': { value: 4, label: '4' },
  'presque-humain': { value: 3, label: '3' },
  'bossu': { value: 3, label: '3' },
  'gitan': { value: 3, label: '3' },
  'morgull': { value: 3, label: '3' },
  'arboreen': { value: 3, label: '3' },
  'corvus': { value: 3, label: '3' },
  'rasgadan': { value: 3, label: '3' },
  'ratfolk': { value: 3, label: '3' },
  'saurien': { value: 3, label: '3' }
};

function getRacePvInfo(){
  const race=v('race');
  const r=RACES[race];
  if(!r)return {value:3,label:'—'};

  if(RACE_PV_RULES[race])return RACE_PV_RULES[race];

  return {value:parseInt(r.pv)||3,label:String(r.pv)};
}

function getCompetencePvBonus(){
  let bonus=0;

  document.querySelectorAll('#comp-tbody tr').forEach(row=>{
    const sel=row.querySelector('.comp-sel');
    if(!sel?.value)return;

    const name=sel.value.split('|')[0]||'';
    const key=normalizeCompetenceKey(name);
    const count=parseInt(row.querySelector('.comp-count')?.value,10)||1;
    const amount=COMPETENCE_PV_BONUS[key]||0;

    bonus+=amount*count;
  });

  return bonus;
}

function calcStats(){
  const armure=parseInt(v('pts-armure'))||0;
  const racePv=getRacePvInfo();
  const compPv=getCompetencePvBonus();
  pvBase=racePv.value+compPv;
  const total=pvBase+armure;

  g('sv-pv').textContent=compPv>0?`${racePv.label} + ${compPv}`:racePv.label;
  g('alert-pv').classList.toggle('show',total>10);
}

function removeRow(id){
  const el=g(id);
  if(el){
    el.remove();
    calcXP();
    calcStats();
    updateFaiblessesImmunites();
  }
}

