// ===================== XP + STATS =====================
const XP_PAR_EVENEMENT = 3;
const MAX_XP_EVENEMENTS = 150;
const XP_PASSE_SAISON = 2;

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

function getSeasonPassChecked(){
  return Boolean(g('passe-saison')?.checked);
}

function getSeasonPassXpRaw(){
  return getSeasonPassChecked()?XP_PASSE_SAISON:0;
}

function getGeneralXpRaw(){
  return getEventXpRaw()+getSeasonPassXpRaw();
}

function getGeneralXpUsed(){
  return Math.min(getGeneralXpRaw(),MAX_XP_EVENEMENTS);
}

function getTotalXpLimit(){
  return getRaceBaseXp()+getGeneralXpUsed();
}

function calcXP(){
  let dep=0;
  document.querySelectorAll('.comp-xp').forEach(el=>dep+=parseInt(el.value)||0);
  document.querySelectorAll('#sorts-tbody tr').forEach(row=>{
    const hasSort=row.querySelector('.sort-lvl-sel')?.value||row.querySelector('.sort-nom-sel')?.value;
    if(hasSort)dep+=parseInt(row.querySelector('.sort-xp')?.value)||0;
  });
  document.querySelectorAll('#special-comp-tbody tr').forEach(row=>{
    const hasSpecial=row.querySelector('.special-comp-nom')?.value||row.querySelector('.special-comp-freq')?.value||row.querySelector('.special-comp-note')?.value;
    const count=Math.max(1,parseInt(row.querySelector('.special-comp-count')?.value,10)||1);
    if(hasSpecial)dep+=(parseInt(row.querySelector('.special-comp-xp')?.value)||0)*count;
  });
  document.querySelectorAll('#special-sort-tbody tr').forEach(row=>{
    const hasSpecial=row.querySelector('.special-sort-ecole')?.value||row.querySelector('.special-sort-lvl')?.value||row.querySelector('.special-sort-nom')?.value||row.querySelector('.special-sort-note')?.value;
    if(hasSpecial)dep+=parseInt(row.querySelector('.special-sort-xp')?.value)||0;
  });
  const eventCount=getEventCount();
  const rawGeneralXP=getGeneralXpRaw();
  const total=getTotalXpLimit();
  const dispo=total-dep;
  sv('xp-dep',dep);sv('xp-dispo',dispo);
  const pct=total>0?Math.min(100,(dep/total)*100):0;
  g('xp-bar').style.width=pct+'%';
  g('xp-lbl-d').textContent=dep+' dépensés';
  const passLabel=getSeasonPassChecked()?` + passe saison ${XP_PASSE_SAISON} XP`:'';
  const capLabel=rawGeneralXP>MAX_XP_EVENEMENTS?` plafonnés à ${MAX_XP_EVENEMENTS} XP généraux`:'';
  g('xp-lbl-t').textContent=`${total} total (${eventCount} événements × ${XP_PAR_EVENEMENT} XP${passLabel}${capLabel})`;
  updateEventAbuseWarning();
  updateSeasonPassWarning();
}

function getEventAbuseWarning(){
  const current=getEventCount();
  const increase=current-eventCountBaseline;
  const rawGeneralXP=getGeneralXpRaw();
  const warnings=[];

  if(rawGeneralXP>MAX_XP_EVENEMENTS){
    warnings.push(`Les XP généraux donnent ${rawGeneralXP} XP, mais le maximum utilisable est ${MAX_XP_EVENEMENTS} XP. La limite totale est donc XP de race (${getRaceBaseXp()}) + ${MAX_XP_EVENEMENTS} XP.`);
  }

  if(increase>1){
    warnings.push(`Le nombre d'événements participés a augmenté de ${increase} depuis la fiche chargée (${eventCountBaseline} → ${current}). À vérifier avant validation.`);
  }

  return warnings.join(' ');
}

function getSeasonPassWarning(){
  if(!getSeasonPassChecked())return '';
  const state=seasonPassBaseline?'déjà présente dans la fiche chargée':'cochée sur cette fiche';
  const capNote=getGeneralXpRaw()>MAX_XP_EVENEMENTS
    ? ` Le plafond général de ${MAX_XP_EVENEMENTS} XP est déjà atteint; la passe saison ne peut pas dépasser cette limite.`
    : '';
  return `Passe saison ${state} : +${XP_PASSE_SAISON} XP généraux à valider par l'animation. Utilisation unique par personnage.${capNote}`;
}

function updateSeasonPassWarning(){
  const alertEl=g('alert-passe-saison');
  const hintEl=g('passe-saison-hint');
  const warning=getSeasonPassWarning();

  if(hintEl){
    hintEl.textContent=seasonPassBaseline
      ? 'Passe saison déjà appliquée sur la fiche chargée.'
      : 'Utilisation unique par personnage.';
  }

  if(!alertEl)return;
  alertEl.innerHTML=warning?`⚠ <b>Vérification animation :</b> ${warning}`:'';
  alertEl.classList.toggle('show',Boolean(warning));
}

function parseSeasonPassValue(value){
  const normalized=String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .trim();
  return ['1','true','oui','yes','coche','checked'].includes(normalized);
}

function setSeasonPassState(checked=false, locked=false){
  const el=g('passe-saison');
  seasonPassBaseline=Boolean(locked && checked);
  if(el){
    el.checked=Boolean(checked);
    el.disabled=Boolean(seasonPassBaseline);
  }
  updateSeasonPassWarning();
}

function onSeasonPassChange(){
  const el=g('passe-saison');
  if(seasonPassBaseline && el){
    el.checked=true;
    el.disabled=true;
  }
  calcXP();
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
  const maxPvArmure=Number(typeof getArmorRules==='function'&&getArmorRules().maxCombinedPoints)||13;
  const racePv=getRacePvInfo();
  const compPv=getCompetencePvBonus();
  const baseMagic=getCarriereMagicPoints();
  const careerMagic=typeof getBaseCarriereMagicPoints==='function'?getBaseCarriereMagicPoints():baseMagic;
  const raceMagic=typeof getRaceMagicBonus==='function'?getRaceMagicBonus():0;
  const compMagic=getCompetenceMagicBonus();
  pvBase=racePv.value+compPv;
  magiePts=baseMagic+compMagic;
  const total=pvBase+armure;

  g('sv-pv').textContent=compPv?`${racePv.label} ${compPv>0?'+':'-'} ${Math.abs(compPv)}`:racePv.label;
  if(g('sv-magie')){
    g('sv-magie').textContent=(carriereDonneAccesSorts()||compMagic)?String(magiePts):'—';
    const magicDetails=[];
    if(carriereDonneAccesSorts()||raceMagic||compMagic)magicDetails.push(`Carrière ${careerMagic}`);
    if(raceMagic)magicDetails.push(`race +${raceMagic}`);
    if(compMagic)magicDetails.push(`compétences ${compMagic>0?'+':''}${compMagic}`);
    g('sv-magie').title=magicDetails.join(', ');
  }
  g('alert-pv').classList.toggle('show',total>maxPvArmure);
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
    if(typeof renderCarriereInfo==='function')renderCarriereInfo(getSelectedCarriere());
    if(typeof refreshAllSortRows==='function')refreshAllSortRows();
  }
}

