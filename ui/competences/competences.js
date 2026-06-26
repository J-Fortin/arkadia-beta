// ===================== COMPÉTENCES =====================
const SURCOUT_CARRIERE_MIXTE = 1;
let refreshingCompetenceCosts=false;

function getCompetenceRules(){
  return DATABASE_OPTIONS?.rules?.competences || {};
}

function getConcoctionRules(){
  return getCompetenceRules().concoctionRules || {};
}

function getCompetenceAccessRules(){
  return getCompetenceRules().access || {};
}

function carriereEstMixte() {
  return Boolean(getDatabaseCarriereOption(v('carriere'))?.mixte);
}

function isCareerCategory(cat) {
  return normalizeCompetenceKey(String(cat || '').split('-')[0]).startsWith('carriere');
}

function isCareerOrSpecialCategory(cat) {
  const normalized=normalizeCompetenceKey(String(cat || '').split('-')[0]);
  return normalized.startsWith('carriere') || normalized.startsWith('special');
}

function getMixedCareerSources() {
  const carr=v('carriere');
  const sourceKeys=DATABASE_OPTIONS?.sourcesParCarriereMixte?.[carr] || getDatabaseCarriereOption(carr)?.sources || [];
  return sourceKeys.map((key,order)=>{
    const carriere=getDatabaseCarriereOption(key);
    return {key,label:carriere?.label || key,order};
  });
}

function competenceExisteDansCarriereSource(nom, sourceKey) {
  const normalized=normalizeCompetenceKey(nom);
  if(!normalized || !sourceKey)return false;

  return getDatabaseCompetenceOptions().some(option=>{
    return option.carriere===sourceKey && normalizeCompetenceKey(option.nom)===normalized;
  });
}

function getMixedCareerCategory(nom) {
  const sources = getMixedCareerSources();
  const carriere=getDatabaseCarriereOption(v('carriere'));
  const specialCategory=`Spécial - ${carriere?.label || 'Carrière'}`;
  if (sources.length === 0) return specialCategory;

  const matchingSources = sources.filter(source => competenceExisteDansCarriereSource(nom, source.key));
  if (matchingSources.length === 0) return specialCategory;

  return `Carrière - ${matchingSources.map(source => source.label).join(' / ')}`;
}

function annuleSurcoutMixte() {
  return v('race') === 'humain';
}

function hasSelectedCompetence(targetName){
  const target=normalizeCompetenceKey(targetName);
  return selectedCompetenceNames().some(name=>normalizeCompetenceKey(name)===target);
}

function hasSelectedCompetenceStartingWith(targetName){
  const target=normalizeCompetenceKey(targetName);
  return selectedCompetenceNames().some(name=>normalizeCompetenceKey(name).startsWith(target));
}

function selectedSchoolIs(name){
  const target=normalizeCompetenceKey(name);
  const schools=typeof getSelectedSpellSchools==='function'?getSelectedSpellSchools():[v('ecole')].filter(Boolean);
  return schools.some((school)=>normalizeCompetenceKey(school)===target);
}

function selectedCareerAllowsArmor(){
  return (Number(getDatabaseCarriereOption(v('carriere'))?.armurePermise)||0)>0;
}

function optionGivesDirectAccess(option){
  return Boolean(option.gratuit || option.race || String(option.cat||'').startsWith('Spécial'));
}

function competenceIsConcoction(nom){
  return normalizeCompetenceKey(nom).startsWith('concoction');
}

function getConcoctionSourceFromCategory(cat){
  const normalized=normalizeCompetenceKey(cat);
  if(normalized==='raciale')return 'race';
  if(normalized.startsWith('carriere') || normalized.startsWith('special'))return 'carriere';
  return '';
}

function getConcoctionSourceForOption(option){
  if(!competenceIsConcoction(option.nom))return '';
  if(option.race)return 'race';
  if(option.carriere)return 'carriere';

  const sourceFromCategory=getConcoctionSourceFromCategory(option.cat);
  if(sourceFromCategory)return sourceFromCategory;

  const rule=getConcoctionRules()[normalizeCompetenceKey(option.nom)];
  if(!rule)return '';

  const raceOk=rule.races.includes(v('race'));
  const carriereOk=rule.carrieres.includes(v('carriere'));
  if(raceOk && !carriereOk)return 'race';
  if(carriereOk && !raceOk)return 'carriere';
  return '';
}

function getSelectedConcoctionSource(){
  let selectedSource='';

  document.querySelectorAll('#comp-tbody tr').forEach(row=>{
    const value=row.querySelector('.comp-sel')?.value || '';
    if(!value || selectedSource==='mixte')return;

    const parts=value.split('|');
    const nom=parts[0] || '';
    const cat=parts[3] || '';
    if(!competenceIsConcoction(nom))return;

    const source=getConcoctionSourceFromCategory(cat);
    if(!source)return;
    if(selectedSource && selectedSource!==source){
      selectedSource='mixte';
      return;
    }
    selectedSource=source;
  });

  return selectedSource;
}

function concoctionSourceAllowed(option){
  if(!competenceIsConcoction(option.nom))return true;

  const selectedSource=getSelectedConcoctionSource();
  const optionSource=getConcoctionSourceForOption(option);
  if(!selectedSource || !optionSource)return true;

  return selectedSource===optionSource;
}

function exclusiveConcoctionAllowed(option){
  const group=getCompetenceRules().exclusiveConcoctionsByCareer?.[v('carriere')] || [];
  const name=normalizeCompetenceKey(option.nom);
  if(!group.includes(name))return true;

  let allowed=true;
  document.querySelectorAll('#comp-tbody tr').forEach(row=>{
    const selectedName=normalizeCompetenceKey(row.querySelector('.comp-sel')?.value?.split('|')[0] || '');
    if(selectedName && group.includes(selectedName) && selectedName!==name)allowed=false;
  });

  return allowed;
}

function competenceAllowedByCodexRestrictions(option){
  const name=normalizeCompetenceKey(option.nom);
  const race=v('race');
  const carriere=v('carriere');
  const moralite=v('moralite');
  const concoctionRules=getConcoctionRules();
  const accessRules=getCompetenceAccessRules();

  if(concoctionRules[name] && (!concoctionSourceAllowed(option) || !exclusiveConcoctionAllowed(option)))return false;

  if(optionGivesDirectAccess(option))return true;

  if(concoctionRules[name]){
    const rule=concoctionRules[name];
    return rule.races.includes(race) || rule.carrieres.includes(carriere);
  }

  if(name==='charognard')return (accessRules.charognardRaces || []).includes(race);
  if(name==='baton de pouvoir')return carriereEstSemiMagique() || carriereDonneAccesSorts();
  if(name==='archerie arcane')return carriereDonneAccesSorts() && hasSelectedCompetence('Archerie');
  if(name==='invocation guerriere')return hasSelectedCompetence('Religion') && selectedCareerAllowsArmor();
  if(name==='noblesse')return race==='haut-elfe';
  if(name==='peinture des morts')return selectedSchoolIs('Nécromancie');
  if(name==='rage animale')return carriere==='totem' && (accessRules.rageAnimaleRaces || []).includes(race);
  if(name==='rituel')return hasSelectedCompetenceStartingWith('Lecture et écriture') && hasSelectedCompetence('Religion');

  if(name==='sang impur'){
    if((accessRules.sangInterditRaces || []).includes(race))return false;
    return (accessRules.sangImpurDirectRaces || []).includes(race) || (moralite==='malefique' && hasSelectedCompetence('Religion'));
  }

  if(name==='sang pur'){
    if((accessRules.sangPurInterditRaces || []).includes(race))return false;
    return moralite==='benefique' && hasSelectedCompetence('Religion');
  }

  return true;
}

function getCompetenceMeta(nom, cat='') {
  const normalized = normalizeCompetenceKey(nom);
  const lectureKey = normalized.startsWith('lecture et ecriture') ? 'lecture et ecriture commun' : '';

  return COMPETENCE_META[`${cat}|${nom}`]
    || COMPETENCE_META[nom]
    || COMPETENCE_META_INDEX[normalized]
    || (lectureKey ? COMPETENCE_META_INDEX[lectureKey] : null)
    || {};
}

function getCumulableMax(nom, cat='') {
  return parseInt(getCompetenceMeta(nom, cat).cumulableMax, 10) || 1;
}

function categoryIsGeneral(cat){
  return normalizeCompetenceKey(cat)==='generale';
}

function mixedCategoryIsShared(cat){
  return String(cat || '').includes('/');
}

function mixedSurchargeApplies(cat, gratuit=false){
  return !gratuit && carriereEstMixte() && isCareerCategory(cat) && !mixedCategoryIsShared(cat);
}

function competenceIsLectureEcriture(nom){
  return normalizeCompetenceKey(nom).startsWith('lecture et ecriture');
}

function sageLectureGratuiteApplies(nom,rowId=''){
  if(v('carriere')!=='sage' || !competenceIsLectureEcriture(nom))return false;

  const rows=[...document.querySelectorAll('#comp-tbody tr')];
  for(const row of rows){
    if(row.id===rowId)break;
    const selectedName=row.querySelector('.comp-sel')?.value?.split('|')[0] || '';
    if(competenceIsLectureEcriture(selectedName))return false;
  }

  return true;
}

function humanGeneralDiscountApplies(cat, rowId=''){
  if(v('race')!=='humain' || !categoryIsGeneral(cat))return false;
  let generalBefore=0;
  const rows=[...document.querySelectorAll('#comp-tbody tr')];

  for(const row of rows){
    if(row.id===rowId)break;
    const sel=row.querySelector('.comp-sel');
    const selectedCat=sel?.value?.split('|')[3] || '';
    if(categoryIsGeneral(selectedCat))generalBefore++;
  }

  return generalBefore<2;
}

function xpFinalCompetence(rawXp, cat, gratuit=false, rowId='', nom='') {
  let base = parseXP(rawXp);
  if (gratuit) return 0;

  if (sageLectureGratuiteApplies(nom,rowId)) {
    return 0;
  }

  if (humanGeneralDiscountApplies(cat,rowId)) {
    base=Math.max(0,base-1);
  }

  if (mixedSurchargeApplies(cat,gratuit) && !annuleSurcoutMixte()) {
    return base + SURCOUT_CARRIERE_MIXTE;
  }

  return base;
}

function noteCoutMixte(cat, gratuit=false) {
  if (!mixedSurchargeApplies(cat,gratuit)) return '';
  return annuleSurcoutMixte() ? ' [surcoût mixte annulé]' : ' [mixte +1]';
}

function noteLectureSage(nom,rowId=''){
  return sageLectureGratuiteApplies(nom,rowId)?' [Sage 1er gratuit]':'';
}

function noteRabaisHumain(cat,rowId,gratuit=false){
  if(gratuit || !humanGeneralDiscountApplies(cat,rowId))return '';
  return ' [Humain -1]';
}

function updateCompetences(){
  const carr=v('carriere');
  const race=v('race');
  const alertEl=g('alert-comp');
  const humanHint=g('human-comp-hint');
  if(humanHint){
    humanHint.style.display=race==='humain'?'block':'none';
    humanHint.textContent=race==='humain'?'Humain : les 2 premières compétences générales sélectionnées coûtent 1 XP de moins. Ensuite, les coûts reviennent à la normale.':'';
  }
  if(!carr||!race){alertEl.classList.add('show');return;}
  alertEl.classList.remove('show');

  document.querySelectorAll('#comp-tbody tr').forEach(tr=>{
    const sel=tr.querySelector('.comp-sel');
    if(sel){
      const curVal=sel.value;
      const countVal=tr.querySelector('.comp-count')?.value||'1';
      rebuildCompSelect(sel);
      sel.value=curVal;
      if(curVal && !sel.value){
        const xp=tr.querySelector('.comp-xp');
        const freq=tr.querySelector('.comp-freq');
        const count=tr.querySelector('.comp-count');
        if(xp)xp.value='0';
        if(freq)freq.value='';
        if(count)setCompCountOptions(count,1,'1');
      } else if(sel.value) {
        onCompSel(sel, tr.id, undefined, undefined, countVal, true);
      }
    }
  });

  refreshSelectedCompetenceCosts();
  calcXP();
  calcStats();
  updateFaiblessesImmunites();
}

function getSelectedCompetenceKeys(excludeRowId=''){
  const keys=new Set();

  document.querySelectorAll('#comp-tbody tr').forEach(row=>{
    if(excludeRowId && row.id===excludeRowId)return;
    const name=row.querySelector('.comp-sel')?.value?.split('|')[0] || '';
    const key=normalizeCompetenceKey(name);
    if(key)keys.add(key);
  });

  return keys;
}

function getCurrentRowCompetenceKey(rowId=''){
  if(!rowId)return '';
  return normalizeCompetenceKey(g(rowId)?.querySelector('.comp-sel')?.value?.split('|')[0] || '');
}

function getCompOptions(rowId=''){
  const carr=v('carriere');
  const race=v('race');
  const selectedElsewhere=getSelectedCompetenceKeys(rowId);
  const currentKey=getCurrentRowCompetenceKey(rowId);

  const options=getDatabaseCompetenceOptions().filter(option => {
    const carriereOk=!option.carriere || option.carriere===carr;
    const raceOk=!option.race || option.race===race;
    return carriereOk && raceOk;
  }).map(option => {
    if(option.carriere===carr && carriereEstMixte() && isCareerCategory(option.cat)){
      return {...option, cat:getMixedCareerCategory(option.nom)};
    }

    return option;
  }).filter(option=>competenceAllowedByCodexRestrictions(option));

  const freeNames=new Set(options.filter(option=>option.gratuit).map(option=>normalizeCompetenceKey(option.nom)));
  const specificNames=new Set(options
    .filter(option=>option.race || option.carriere || option.gratuit)
    .map(option=>normalizeCompetenceKey(option.nom)));
  return options.filter(option=>{
    const normalized=normalizeCompetenceKey(option.nom);
    if(selectedElsewhere.has(normalized) && normalized!==currentKey)return false;
    if(option.gratuit)return true;
    if(!option.race && !option.carriere && specificNames.has(normalized))return false;
    return !freeNames.has(normalized);
  });
}

function getCompetenceSourcePrefix(cat){
  if(!carriereEstMixte() || !isCareerOrSpecialCategory(cat))return '';
  return `${String(cat).replace(/^Carrière - /,'').replace(/^Spécial - /,'Spécial - ')} · `;
}

function rebuildCompSelect(sel){
  const rowId=sel.closest('tr')?.id || '';
  const opts=getCompOptions(rowId);
  let optHtml='<option value="">-- Choisir --</option>';

  if(opts.length===0){
    optHtml='<option value="">-- Aucun choix permis pour cette race/carrière --</option>';
    sel.innerHTML=optHtml;
    return;
  }

  const cats=sortByText([...new Set(opts.map(o=>o.cat))]);
  cats.forEach(cat=>{
    optHtml+=`<optgroup label="${cat}">`;
    opts
      .filter(o=>o.cat===cat)
      .sort((a,b)=>a.nom.localeCompare(b.nom,'fr',{sensitivity:'base'}))
      .forEach(o=>{
      const gratuit=Boolean(o.gratuit);
      const xpNum=xpFinalCompetence(o.xp, o.cat, gratuit, rowId, o.nom);
      const meta=getCompetenceMeta(o.nom, cat);
      const cumulableMax=parseInt(o.cumulableMax,10)||getCumulableMax(o.nom, cat);
      const frequencyLabel=meta.frequence?` · ${meta.frequence}`:'';
      const cumulableLabel=cumulableMax>1?` · max ${cumulableMax}`:'';
      const note=o.note?` [${o.note}]`:`${noteLectureSage(o.nom,rowId)}${noteRabaisHumain(o.cat,rowId,gratuit)}${noteCoutMixte(o.cat, gratuit)}`;
      const freeLabel=gratuit && cumulableMax>1?' [1er GRATUIT]':' [GRATUIT]';
      const label=getCompetenceSourcePrefix(cat)+o.nom+(gratuit?freeLabel:note);
      const extraXp=gratuit?getExtraXpForFreeCompetence(o.nom,o.baseXp || o.xp,rowId):xpNum;
      const xpDisplay=gratuit?(cumulableMax>1?`1er GRATUIT, puis ${extraXp} XP`:'GRATUIT'):`${xpNum} XP`;
      optHtml+=`<option value="${o.nom}|${o.xp}|${gratuit?'gratuit':''}|${cat}|${cumulableMax}|${o.baseXp || o.xp}">${label} — ${xpDisplay}${frequencyLabel}${cumulableLabel}</option>`;
    });
    optHtml+='</optgroup>';
  });

  sel.innerHTML=optHtml;
}

function parseXP(raw){
  if(!raw)return 0;
  if(raw==='0(G)')return 0;
  const m=String(raw).match(/^(\d+)/);
  return m?parseInt(m[1]):0;
}

function getPaidOptionsForCompetence(nom){
  const carr=v('carriere');
  const race=v('race');
  const normalized=normalizeCompetenceKey(nom);

  return getDatabaseCompetenceOptions().filter(option=>{
    if(option.gratuit || normalizeCompetenceKey(option.nom)!==normalized)return false;
    const carriereOk=!option.carriere || option.carriere===carr;
    const raceOk=!option.race || option.race===race;
    return carriereOk && raceOk;
  }).map(option=>{
    if(option.carriere===carr && carriereEstMixte() && isCareerCategory(option.cat)){
      return {...option, cat:getMixedCareerCategory(option.nom)};
    }

    return option;
  }).filter(option=>competenceAllowedByCodexRestrictions(option));
}

function getExtraXpForFreeCompetence(nom, fallbackXp, rowId=''){
  const paidOptions=getPaidOptionsForCompetence(nom);
  const careerOption=paidOptions.find(option=>option.carriere===v('carriere'));
  const generalOption=paidOptions.find(option=>!option.carriere && !option.race);
  const racialOption=paidOptions.find(option=>option.race===v('race'));
  const option=careerOption || racialOption || generalOption;
  const rawXp=option?.xp ?? fallbackXp;
  const cat=option?.cat || 'Générale';

  return xpFinalCompetence(rawXp,cat,false,rowId);
}

function setCompCountOptions(countSel, max, selected='1') {
  const safeMax=Math.max(1, Math.min(5, parseInt(max,10)||1));
  const safeSelected=Math.max(1, Math.min(safeMax, parseInt(selected,10)||1));

  countSel.innerHTML='';
  for(let i=1;i<=safeMax;i++){
    const option=document.createElement('option');
    option.value=String(i);
    option.textContent=String(i);
    countSel.appendChild(option);
  }

  countSel.value=String(safeSelected);
  countSel.disabled=safeMax<=1;
  countSel.title=safeMax>1?`Cumulable jusqu'à ${safeMax} fois`:'Non cumulable';
}

function updateCompXPFromCount(row) {
  const xpIn=row.querySelector('.comp-xp');
  const countSel=row.querySelector('.comp-count');
  const first=parseInt(xpIn?.dataset.firstXp,10)||0;
  const extra=parseInt(xpIn?.dataset.extraXp,10)||first;
  const count=parseInt(countSel?.value,10)||1;

  if(xpIn)xpIn.value=first+(Math.max(0,count-1)*extra);
  calcXP();
  calcStats();
}

function onCompCount(sel,rowId){
  const row=g(rowId);
  if(!row)return;
  updateCompXPFromCount(row);
}

function addComp(nomVal='',xpVal='',freqVal='',countVal='1'){
  compRows++;
  const id='comp-'+compRows;
  const tr=document.createElement('tr');
  tr.id=id;
  tr.innerHTML=`
    <td><select class="comp-sel" onchange="onCompSel(this,'${id}')"></select></td>
    <td><input type="text" class="comp-freq" value="${freqVal}" placeholder="Fréquence"></td>
    <td><select class="comp-count" onchange="onCompCount(this,'${id}')" disabled><option value="1">1</option></select></td>
    <td class="td-xp"><input type="number" class="comp-xp" min="0" value="${xpVal}" oninput="calcXP()"></td>
    <td class="td-btn no-print"><button class="ibtnd" onclick="removeRow('${id}')">✕</button></td>
  `;
  g('comp-tbody').appendChild(tr);
  const sel=tr.querySelector('.comp-sel');
  rebuildCompSelect(sel);

  if(nomVal){
    let found=false;
    for(let opt of sel.options){
      if(opt.value.startsWith(nomVal+'|')){sel.value=opt.value;found=true;break;}
    }
    if(!found){
      onCompSel(sel,id,'','','1');
      return;
    }
    onCompSel(sel,id,undefined,freqVal,countVal);
  }
}

function refreshSelectedCompetenceCosts(){
  if(refreshingCompetenceCosts)return;
  refreshingCompetenceCosts=true;

  document.querySelectorAll('#comp-tbody tr').forEach(tr=>{
    const sel=tr.querySelector('.comp-sel');
    if(!sel)return;

    const parts=sel.value?.split('|') || [];
    const selectedName=parts[0] || '';
    const selectedCat=parts[3] || '';
    const freqVal=tr.querySelector('.comp-freq')?.value || '';
    const countVal=tr.querySelector('.comp-count')?.value || '1';

    rebuildCompSelect(sel);
    if(!selectedName)return;

    const normalized=normalizeCompetenceKey(selectedName);
    const normalizedCat=normalizeCompetenceKey(selectedCat);
    const match=[...sel.options].find(option=>{
      const optionParts=option.value.split('|');
      return normalizeCompetenceKey(optionParts[0] || '')===normalized
        && normalizeCompetenceKey(optionParts[3] || '')===normalizedCat;
    }) || [...sel.options].find(option=>normalizeCompetenceKey(option.value.split('|')[0] || '')===normalized);
    if(match){
      sel.value=match.value;
      onCompSel(sel,tr.id,undefined,freqVal,countVal,true);
    }
  });

  refreshingCompetenceCosts=false;
  calcXP();
  calcStats();
  updateFaiblessesImmunites();
}

function onCompSel(sel,rowId,overrideXP,overrideFreq,overrideCount,skipRefresh=false){
  const row=g(rowId);
  const xpIn=row.querySelector('.comp-xp');
  const freqIn=row.querySelector('.comp-freq');
  const countSel=row.querySelector('.comp-count');
  if(!sel.value){
    if(freqIn)freqIn.value='';
    if(countSel)setCompCountOptions(countSel,1,'1');
    if(xpIn){
      xpIn.value='0';
      xpIn.dataset.firstXp='0';
      xpIn.dataset.extraXp='0';
    }
    updateFaiblessesImmunites();
    calcXP();
    if(!skipRefresh)refreshSelectedCompetenceCosts();
    return;
  }

  const parts=sel.value.split('|');
  const nom=parts[0]||'';
  const xpRaw=parts[1]||'';
  const gratuit=parts[2]==='gratuit';
  const cat=parts[3]||'';
  const maxRaw=parts[4]||getCumulableMax(nom, cat);
  const baseXpRaw=parts[5]||xpRaw;
  const meta=getCompetenceMeta(nom, cat);
  const maxCumulable=parseInt(maxRaw,10)||getCumulableMax(nom, cat);
  const firstXp=gratuit?0:xpFinalCompetence(xpRaw,cat,gratuit,rowId,nom);
  const extraXp=gratuit?getExtraXpForFreeCompetence(nom,baseXpRaw,rowId):firstXp;
  const count=overrideCount!==undefined&&overrideCount!==''?overrideCount:'1';

  xpIn.dataset.firstXp=String(firstXp);
  xpIn.dataset.extraXp=String(extraXp);
  if(countSel)setCompCountOptions(countSel,maxCumulable,count);
  xpIn.value=overrideXP!==undefined&&overrideXP!==''?overrideXP:firstXp+(Math.max(0,(parseInt(countSel?.value,10)||1)-1)*extraXp);
  if(freqIn)freqIn.value=overrideFreq!==undefined&&overrideFreq!==''?overrideFreq:(meta.frequence||'');

  calcXP();
  calcStats();
  updateFaiblessesImmunites();
  if(!skipRefresh)refreshSelectedCompetenceCosts();
}
