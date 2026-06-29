// ===================== XP + STATS =====================
const XP_PAR_EVENEMENT = 3;
const MAX_XP_EVENEMENTS = 150;

function getEventCount(){
  return parseInt(v('xp-total'),10)||0;
}

function getRaceBaseXp(){
  return parseInt(v('xp-depart'),10)||0;
}

function getEventXpRaw(){
  return getEventCount()*XP_PAR_EVENEMENT;
}

function getEventXpUsed(){
  return Math.min(getEventXpRaw(),MAX_XP_EVENEMENTS);
}

function getTotalXpLimit(){
  return getRaceBaseXp()+getEventXpUsed();
}

function calcXP(){
  let dep=0;
  document.querySelectorAll('.comp-xp').forEach(el=>dep+=parseInt(el.value)||0);
  document.querySelectorAll('#sorts-tbody tr').forEach(row=>{
    const hasSort=row.querySelector('.sort-lvl-sel')?.value||row.querySelector('.sort-nom-sel')?.value;
    if(hasSort)dep+=parseInt(row.querySelector('.sort-xp')?.value)||0;
  });
  document.querySelectorAll('#special-comp-tbody tr').forEach(row=>{
    const hasSpecial=row.querySelector('.special-comp-nom')?.value||row.querySelector('.special-comp-note')?.value;
    const count=Math.max(1,parseInt(row.querySelector('.special-comp-count')?.value,10)||1);
    if(hasSpecial)dep+=(parseInt(row.querySelector('.special-comp-xp')?.value)||0)*count;
  });
  document.querySelectorAll('#special-sort-tbody tr').forEach(row=>{
    const hasSpecial=row.querySelector('.special-sort-ecole')?.value||row.querySelector('.special-sort-lvl')?.value||row.querySelector('.special-sort-nom')?.value||row.querySelector('.special-sort-note')?.value;
    if(hasSpecial)dep+=parseInt(row.querySelector('.special-sort-xp')?.value)||0;
  });
  const eventCount=getEventCount();
  const rawEventXP=getEventXpRaw();
  const total=getTotalXpLimit();
  const dispo=total-dep;
  sv('xp-dep',dep);sv('xp-dispo',dispo);
  const pct=total>0?Math.min(100,(dep/total)*100):0;
  g('xp-bar').style.width=pct+'%';
  g('xp-lbl-d').textContent=dep+' dépensés';
  const capLabel=rawEventXP>MAX_XP_EVENEMENTS?` plafonnés à ${MAX_XP_EVENEMENTS} XP`:'';
  g('xp-lbl-t').textContent=`${total} total (${eventCount} événements × ${XP_PAR_EVENEMENT} XP${capLabel})`;
  updateEventAbuseWarning();
}

function getEventAbuseWarning(){
  const current=getEventCount();
  const increase=current-eventCountBaseline;
  const rawEventXP=getEventXpRaw();
  const warnings=[];

  if(rawEventXP>MAX_XP_EVENEMENTS){
    warnings.push(`Les événements donnent ${rawEventXP} XP, mais le maximum utilisable est ${MAX_XP_EVENEMENTS} XP. La limite totale est donc XP de race (${getRaceBaseXp()}) + ${MAX_XP_EVENEMENTS} XP.`);
  }

  if(increase>1){
    warnings.push(`Le nombre d'événements participés a augmenté de ${increase} depuis la fiche chargée (${eventCountBaseline} → ${current}). À vérifier avant validation.`);
  }

  return warnings.join(' ');
}

function getChanceAbuseWarning(){
  const current=parseInt(v('chances-actuelles'),10)||0;
  const max=getRaceChanceMax();
  const increase=current-chanceCountBaseline;

  if(current>max){
    return `Attention : les chances actuelles (${current}) dépassent le maximum de la race (${max}).`;
  }

  if(increase>1){
    return `Attention : les chances ont augmenté de ${increase} depuis la fiche chargée (${chanceCountBaseline} → ${current}). Une fiche ne devrait regagner qu'une chance à la fois, sans dépasser le maximum racial (${max}).`;
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

function updateChanceAbuseWarning(){
  const alertEl=g('alert-chances-abus');
  if(!alertEl)return;

  const warning=getChanceAbuseWarning();
  alertEl.innerHTML=warning?`⚠ <b>Vérification anti-abus :</b> ${warning}`:'';
  alertEl.classList.toggle('show',Boolean(warning));

  if(warning && warning!==lastChanceAbuseWarning){
    lastChanceAbuseWarning=warning;
  } else if(!warning) {
    lastChanceAbuseWarning='';
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
  let bonus=0;
  selectedCompetenceEntries().forEach(entry=>{
    const name=normalizeStatCompetenceName(entry.nom);
    const count=entry.count;
    if(competenceNameIs(name,'endurance simple'))bonus+=1;
    if(competenceNameIs(name,'endurance guerriere'))bonus+=1;
    if(competenceNameIs(name,'transfert de vitalite en mana'))bonus-=count;
    if(competenceNameIs(name,'protection sauvage'))bonus+=1;
  });
  return bonus;
}

function getCompetenceMagicBonus(){
  let bonus=0;
  selectedCompetenceEntries().forEach(entry=>{
    const name=normalizeStatCompetenceName(entry.nom);
    if(competenceNameIs(name,'transfert de vitalite en mana'))bonus+=5*entry.count;
    if(competenceNameIs(name,'haute magie'))bonus+=3*entry.count;
  });
  return bonus;
}

function selectedCompetenceEntries(){
  const entries=[];
  document.querySelectorAll('#comp-tbody tr').forEach(row=>{
    const sel=row.querySelector('.comp-sel');
    if(!sel?.value)return;
    const parts=sel.value.split('|');
    const nom=parts[0]||'';
    const count=parseInt(row.querySelector('.comp-count')?.value,10)||1;
    if(nom)entries.push({nom,count});
  });
  return entries;
}

function normalizeStatCompetenceName(value){
  const normalized=typeof normalizeCompetenceKey==='function'
    ? normalizeCompetenceKey(value)
    : String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  return normalized.replace(/^touche a tout\s+/,'').trim();
}

function competenceNameIs(normalizedName, target){
  return normalizedName===target || normalizedName.endsWith(` ${target}`);
}

function calcStats(){
  const armure=parseInt(v('pts-armure'))||0;
  const racePv=getRacePvInfo();
  const compPv=getCompetencePvBonus();
  const baseMagic=getCarriereMagicPoints();
  const compMagic=getCompetenceMagicBonus();
  pvBase=racePv.value+compPv;
  magiePts=baseMagic+compMagic;
  const total=pvBase+armure;

  g('sv-pv').textContent=compPv?`${racePv.label} ${compPv>0?'+':'-'} ${Math.abs(compPv)}`:racePv.label;
  if(g('sv-magie')){
    g('sv-magie').textContent=(carriereDonneAccesSorts()||compMagic)?String(magiePts):'—';
    g('sv-magie').title=compMagic?`Base carrière ${baseMagic}, compétences ${compMagic>0?'+':''}${compMagic}`:'';
  }
  g('alert-pv').classList.toggle('show',total>10);
  updateChanceAbuseWarning();
  if(typeof updateScenarioResources==='function')updateScenarioResources();
}

function removeRow(id){
  const el=g(id);
  if(el){
    el.remove();
    if(typeof refreshSelectedCompetenceCosts==='function')refreshSelectedCompetenceCosts();
    calcXP();
    calcStats();
    updateFaiblessesImmunites();
  }
}

