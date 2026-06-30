// ===================== RESSOURCES PAR SCENARIO =====================
function getScenarioResourceRules(){
  return getCompetenceRules().scenarioResourceRules || {};
}

function normalizeScenarioResourceCompetenceName(value){
  const normalized=typeof normalizeCompetenceKey==='function'
    ? normalizeCompetenceKey(value)
    : String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  return normalized.replace(/^touche a tout\s+/,'').trim();
}

function getSelectedScenarioResourceKeys(){
  const entries=typeof selectedCompetenceEntries==='function'
    ? selectedCompetenceEntries()
    : selectedCompetenceNames().map(nom=>({nom,count:1}));
  const keys=new Set();

  entries.forEach(entry=>{
    const key=normalizeScenarioResourceCompetenceName(entry.nom);
    if(key)keys.add(key);
  });

  return keys;
}

function scenarioResourceLine(rule){
  return `${rule.label} - ${rule.detail}`;
}

function formatScenarioResourceTemplate(template, values){
  return String(template || '').replace(/\{(\w+)\}/g, (_,key)=>values[key] ?? '');
}

function buildScenarioResourceLines(){
  const rules=getScenarioResourceRules();
  const keys=getSelectedScenarioResourceKeys();
  const lines=[];
  const concoctionRule=rules.concoctionPlantGift || {};
  const selectedConcoctions=(concoctionRule.keys || []).filter(key=>keys.has(key));

  if(selectedConcoctions.length){
    lines.push(scenarioResourceLine(concoctionRule));
  }

  Object.entries(rules.byCompetence || {}).forEach(([key,rule])=>{
    if(keys.has(key))lines.push(scenarioResourceLine(rule));
  });

  const creationRule=rules.creationAccrue;
  if(creationRule?.key && keys.has(creationRule.key)){
    const typeCount=selectedConcoctions.length;
    const total=selectedConcoctions.length*(Number(creationRule.amountPerConcoction)||0);
    const detail=selectedConcoctions.length
      ? formatScenarioResourceTemplate(creationRule.detailWithConcoctions,{
        types:`${typeCount} ${typeCount>1?'types détectés':'type détecté'}`,
        total
      })
      : creationRule.detailWithoutConcoction;
    lines.push(`${creationRule.label} - ${detail}`);
  }

  return lines;
}

function updateScenarioResources(){
  const el=g('ressources');
  if(!el)return;

  const lines=buildScenarioResourceLines();
  el.value=lines.join('\n');
  if(el.tagName==='TEXTAREA')el.rows=Math.max(3,Math.min(8,lines.length || 3));
}
