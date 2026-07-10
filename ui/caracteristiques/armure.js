// ===================== ARMURE =====================
function getArmorRules(){
  return typeof getCodexRuleGroup==='function'?getCodexRuleGroup('armor'):{};
}

function armorCareerConfig(){
  const career=getDatabaseCarriereOption(v('carriere'));
  const armorType=String(career?.typeArmure||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return {
    permission:Number(career?.armurePermise)||0,
    nonMetalOnly:armorType.includes('non metallique')
  };
}

function armorSelectForZone(zoneId){
  return document.querySelector(`.armor-piece-select[data-armor-zone="${zoneId}"]`);
}

function armorGroupSelects(){
  return Array.from(document.querySelectorAll('.armor-piece-group-select[data-armor-zone-group]'));
}

function armorZoneGroupIds(select){
  return String(select?.dataset?.armorZoneGroup||'').split(',').map(zone=>zone.trim()).filter(Boolean);
}

function setSelectValueIfAvailable(select,value){
  if(select&&Array.from(select.options).some(option=>option.value===value))select.value=value;
}

function populateArmorSelect(select,options,placeholder,nonMetalOnly){
  if(!select)return;
  const current=select.value;
  select.innerHTML=`<option value="">${placeholder}</option>`;
  options.forEach(option=>{
    if(nonMetalOnly&&option.metallic)return;
    const element=document.createElement('option');
    element.value=option.id;
    element.textContent=option.label;
    select.appendChild(element);
  });
  setSelectValueIfAvailable(select,current);
}

function isArmorHelmetEnabled(){
  return Boolean(g('armor-helmet-enabled')?.checked);
}

function isArmorGorgetEnabled(){
  return Boolean(g('armor-gorget-enabled')?.checked);
}

function setArmorHelmetEnabled(enabled,clearValue=false){
  const row=g('armor-helmet-row');
  const checkbox=g('armor-helmet-enabled');
  const select=g('armor-helmet');

  if(select&&!enabled&&clearValue)select.value='';
  if(row)row.hidden=!enabled;
  if(checkbox)checkbox.checked=enabled;
}

function setArmorGorgetEnabled(enabled,clearValue=false){
  const row=g('armor-gorget-row');
  const checkbox=g('armor-gorget-enabled');
  const select=g('armor-gorget');

  if(select&&!enabled&&clearValue)select.value='';
  if(row)row.hidden=!enabled;
  if(checkbox)checkbox.checked=enabled;
}

function toggleArmorHelmet(){
  const enabled=isArmorHelmetEnabled();
  setArmorHelmetEnabled(enabled,!enabled);
  updateArmorSelection();
}

function toggleArmorGorget(){
  const enabled=isArmorGorgetEnabled();
  setArmorGorgetEnabled(enabled,!enabled);
  updateArmorSelection();
}

function setArmorStep(rowId,state){
  const row=g(rowId);
  if(!row)return;
  row.classList.remove('step-active','step-done','step-disabled');
  if(state)row.classList.add(`step-${state}`);
}

function updateArmorOrderState(){
  const hasTorso=Boolean(armorSelectForZone('torse')?.value);
  const arms=g('armor-arms');
  const legs=g('armor-legs');

  if(!hasTorso){
    if(arms)arms.value='';
    if(legs)legs.value='';
  }
  if(arms)arms.disabled=!hasTorso;
  if(legs)legs.disabled=!hasTorso;

  setArmorStep('armor-row-torso',hasTorso?'done':'active');
  setArmorStep('armor-row-arms',!hasTorso?'disabled':(arms?.value?'done':'active'));
  setArmorStep('armor-row-legs',!hasTorso?'disabled':(legs?.value?'done':'active'));
}

function refreshArmorBuilder(){
  const rules=getArmorRules();
  if(!rules.bodyZones?.length)return;
  const career=armorCareerConfig();

  (rules.bodyZones||[]).forEach(zone=>{
    populateArmorSelect(armorSelectForZone(zone.id),rules.materials||[],'Aucune pièce',career.nonMetalOnly);
  });
  armorGroupSelects().forEach(select=>{
    populateArmorSelect(select,rules.materials||[],'Aucune pièce',career.nonMetalOnly);
  });
  populateArmorSelect(g('armor-helmet'),rules.helmets||[],'Aucun casque',career.nonMetalOnly);
  populateArmorSelect(g('armor-gorget'),rules.gorgets||[],'Aucun gorget',career.nonMetalOnly);
  setArmorHelmetEnabled(isArmorHelmetEnabled()||Boolean(g('armor-helmet')?.value));
  setArmorGorgetEnabled(isArmorGorgetEnabled()||Boolean(g('armor-gorget')?.value));
  updateArmorSelection();
}

function initializeArmorBuilder(){
  const rules=getArmorRules();
  if(!rules.bodyZones?.length)return;
  refreshArmorBuilder();
}

function collectArmorPieces(){
  const rules=getArmorRules();
  const zones={};
  (rules.bodyZones||[]).forEach(zone=>{
    zones[zone.id]=armorSelectForZone(zone.id)?.value||'';
  });
  armorGroupSelects().forEach(select=>{
    const value=select.value||'';
    armorZoneGroupIds(select).forEach(zoneId=>{
      zones[zoneId]=value;
    });
  });
  return {
    zones,
    helmet:isArmorHelmetEnabled()?(g('armor-helmet')?.value||''):'',
    gorget:isArmorGorgetEnabled()?(g('armor-gorget')?.value||''):''
  };
}

function loadArmorPieces(pieces={}){
  const rules=getArmorRules();
  const zones={...(pieces?.zones||pieces||{})};
  if(!zones.torse&&(zones.torseAvant||zones.torseArriere)){
    zones.torse=zones.torseAvant||zones.torseArriere;
  }

  (rules.bodyZones||[]).forEach(zone=>{
    const select=armorSelectForZone(zone.id);
    if(select)select.value='';
  });
  armorGroupSelects().forEach(select=>{
    select.value='';
  });

  Object.entries(zones).forEach(([zoneId,value])=>{
    setSelectValueIfAvailable(armorSelectForZone(zoneId),value);
  });
  armorGroupSelects().forEach(select=>{
    const values=armorZoneGroupIds(select).map(zoneId=>zones[zoneId]).filter(Boolean);
    if(values.length&&values.every(value=>value===values[0])){
      setSelectValueIfAvailable(select,values[0]);
    }
  });

  if(g('armor-helmet')){
    g('armor-helmet').value='';
    setSelectValueIfAvailable(g('armor-helmet'),pieces?.helmet||'');
    setArmorHelmetEnabled(Boolean(g('armor-helmet').value));
  }
  if(g('armor-gorget')){
    g('armor-gorget').value='';
    setSelectValueIfAvailable(g('armor-gorget'),pieces?.gorget||'');
    setArmorGorgetEnabled(Boolean(g('armor-gorget').value));
  }
  updateArmorSelection();
}

function calculateArmorValues(rules,pieces={}){
  const materials=rules.materials||[];
  const helmets=rules.helmets||[];
  const gorgets=rules.gorgets||[];
  const materialById=id=>materials.find(material=>material.id===id);
  const helmetById=id=>helmets.find(helmet=>helmet.id===id);
  const gorgetById=id=>gorgets.find(gorget=>gorget.id===id);
  const zones=pieces.zones||{};
  const selectedMaterials=Object.values(zones).filter(Boolean);
  const materialIds=[...new Set(selectedMaterials)];
  const complete=(rules.bodyZones||[]).every(zone=>Boolean(zones[zone.id]));
  const hasTorso=Boolean(zones.torse);
  const torsoMaterial=materialById(zones.torse);
  const compatibleMetalSet=complete
    && Boolean(torsoMaterial?.metallic)
    && selectedMaterials.every(materialId=>Boolean(materialById(materialId)?.metallic));
  let bodyPoints=0;
  let coverageSummary='Aucune armure';
  let materialSummary='';
  let classification='Aucune armure';

  if(hasTorso&&(materialIds.length===1||compatibleMetalSet)){
    const material=compatibleMetalSet?torsoMaterial:materialById(materialIds[0]);
    bodyPoints=Number(material?.[complete?'complete':'incomplete'])||0;
    coverageSummary=complete?'Armure complète':'Armure incomplète';
    materialSummary=material?.label||'Armure';
    classification=`${coverageSummary} — ${materialSummary}`;
  }else if(hasTorso&&materialIds.length>1){
    const hybridRule=rules.hybrid||{};
    bodyPoints=Number(hybridRule[complete?'complete':'incomplete'])||0;
    const rigidTorso=zones.torse==='metal-rigide';
    if(complete&&rigidTorso)bodyPoints+=Number(hybridRule.rigidTorsoBonus)||0;
    coverageSummary=complete?'Armure complète':'Armure incomplète';
    materialSummary=`${hybridRule.label||'Armure hybride'}${complete&&rigidTorso?' avec plastron rigide':''}`;
    classification=`${coverageSummary} — ${materialSummary}`;
  }else if(selectedMaterials.length){
    coverageSummary='Pièces sans plastron';
    materialSummary='Aucun PA';
    classification='Pièces sans plastron — aucun PA';
  }

  const helmet=helmetById(pieces.helmet);
  const gorget=gorgetById(pieces.gorget);
  const helmetPoints=hasTorso?(Number(helmet?.points)||0):0;
  const epicPoints=0;
  const bonus=0;
  const physicalPoints=bodyPoints+helmetPoints;
  const total=physicalPoints;

  return {
    pieces,
    selectedMaterials,
    complete,
    hasTorso,
    bodyPoints,
    helmet,
    gorget,
    helmetPoints,
    epicPoints,
    physicalPoints,
    bonus,
    total,
    coverageSummary,
    materialSummary,
    classification
  };
}

function calculateArmorSelection(){
  return calculateArmorValues(getArmorRules(),collectArmorPieces());
}

function updateArmorVisual(result){
  setArmorHelmetEnabled(isArmorHelmetEnabled()||Boolean(result.helmet));
  setArmorGorgetEnabled(isArmorGorgetEnabled()||Boolean(result.gorget));
}

function updateArmorSelection(){
  if(!g('pts-armure'))return;
  updateArmorOrderState();
  const rules=getArmorRules();
  const result=calculateArmorSelection();
  const career=armorCareerConfig();
  const warnings=[];

  g('pts-armure').value=result.total;
  g('pts-armure').max=rules.maxCombinedPoints||13;

  const summary=[result.classification];
  if(result.helmet)summary.push(`casque : ${result.helmet.label} (+${result.helmetPoints} PA)`);
  if(result.gorget)summary.push(`gorget : ${result.gorget.label}`);
  if(g('type-armure'))g('type-armure').value=summary.join(' · ');

  if(result.selectedMaterials.length&&!result.hasTorso){
    warnings.push('Une protection au tronc est obligatoire pour recevoir des points d’armure.');
  }
  if(result.bodyPoints>career.permission){
    warnings.push(`Cette armure de corps donne ${result.bodyPoints} PA, mais la carrière permet ${career.permission} PA.`);
  }
  if(result.helmet?.minimumArmorPermission&&career.permission<result.helmet.minimumArmorPermission){
    warnings.push(`Le casque en métal rigide exige une carrière permettant au moins ${result.helmet.minimumArmorPermission} PA.`);
  }
  if(result.helmet&&!result.hasTorso){
    warnings.push('Le casque ne donne pas de PA sans protection au tronc.');
  }
  if(result.total>(rules.maxCombinedPoints||13)){
    warnings.push(`L’armure dépasse le maximum de ${rules.maxCombinedPoints||13} PA.`);
  }

  const alert=g('alert-armure');
  if(alert){
    alert.innerHTML=warnings.map(warning=>`⚠ ${warning}`).join('<br>');
    alert.classList.toggle('show',warnings.length>0);
  }

  if(g('armor-total-detail')){
    g('armor-total-detail').textContent=`${result.bodyPoints} PA armure + ${result.helmetPoints} PA casque = ${result.total} PA`;
  }
  if(g('armor-throat-detail')){
    const protectedByGorget=Boolean(result.gorget?.throatProtection);
    const protectedByCoif=Boolean(result.helmet?.throatProtection);
    const throatProtectionActive=(protectedByGorget||protectedByCoif)&&result.physicalPoints>0;
    g('armor-throat-detail').textContent=throatProtectionActive
      ? 'Égorgement : protection active si le coup touche le gorget ou la coiffe, tant qu’il reste des PA.'
      : 'Égorgement : aucune protection métallique/semi-métallique active.';
    g('armor-throat-detail').classList.toggle('protected',throatProtectionActive);
  }

  updateArmorVisual(result);
  if(typeof calcStats==='function')calcStats();
}
