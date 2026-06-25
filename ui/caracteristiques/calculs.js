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

function getRacePvInfo(){
  const r=getDatabaseRaceOption(v('race'));
  if(!r)return {value:3,label:'—'};

  const pvJour=parseInt(r.pvJour,10)||3;
  const pvNuit=parseInt(r.pvNuit,10)||pvJour;

  if(pvJour!==pvNuit)return {value:Math.max(pvJour,pvNuit),label:`${pvJour} jour / ${pvNuit} nuit`};
  return {value:pvJour,label:String(pvJour)};
}

function getCompetencePvBonus(){
  return 0;
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

