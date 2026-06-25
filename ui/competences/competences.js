// ===================== COMPÉTENCES =====================
const SURCOUT_CARRIERE_MIXTE = 1;

function carriereEstMixte() {
  return Boolean(getDatabaseCarriereOption(v('carriere'))?.mixte);
}

function isCareerCategory(cat) {
  return String(cat || '').startsWith('Carrière');
}

function getMixedCareerSources() {
  return [];
}

function competenceExisteDansCarriereSource(nom, sourceKey) {
  return false;
}

function getMixedCareerCategory(nom) {
  const sources = getMixedCareerSources();
  if (sources.length === 0) return 'Carrière';

  const matchingSources = sources.filter(source => competenceExisteDansCarriereSource(nom, source.key));
  if (matchingSources.length === 0) return 'Carrière - Mixte';

  return `Carrière - ${matchingSources.map(source => source.label).join(' / ')}`;
}

function annuleSurcoutMixte() {
  return v('race') === 'humain';
}

function competenceEstPermiseParRace(nom) {
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

function xpFinalCompetence(rawXp, cat, gratuit=false) {
  const base = parseXP(rawXp);
  if (gratuit) return 0;

  if (carriereEstMixte() && isCareerCategory(cat) && !annuleSurcoutMixte()) {
    return base + SURCOUT_CARRIERE_MIXTE;
  }

  return base;
}

function noteCoutMixte(cat, gratuit=false) {
  if (gratuit || !carriereEstMixte() || !isCareerCategory(cat)) return '';
  return annuleSurcoutMixte() ? ' [surcoût mixte annulé]' : ' [mixte +1]';
}

function optionKey(option) {
  return `${option.cat}|${option.nom}`;
}

function addOptionUnique(all, option, seen) {
  const key = optionKey(option);
  if (seen.has(key)) return;
  seen.add(key);
  all.push(option);
}

function getRaceOptions() {
  return [];
}

function getRaceCareerOptions() {
  return [];
}

function updateCompetences(){
  const carr=v('carriere');
  const race=v('race');
  const alertEl=g('alert-comp');
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
        onCompSel(sel, tr.id, undefined, undefined, countVal);
      }
    }
  });

  calcXP();
  calcStats();
  updateFaiblessesImmunites();
}

function getCompOptions(){
  const carr=v('carriere');
  const race=v('race');

  return getDatabaseCompetenceOptions().filter(option => {
    const carriereOk=!option.carriere || option.carriere===carr;
    const raceOk=!option.race || option.race===race;
    return carriereOk && raceOk;
  });
}

function rebuildCompSelect(sel){
  const opts=getCompOptions();
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
      const xpNum=xpFinalCompetence(o.xp, o.cat, gratuit);
      const meta=getCompetenceMeta(o.nom, cat);
      const cumulableMax=parseInt(o.cumulableMax,10)||getCumulableMax(o.nom, cat);
      const frequencyLabel=meta.frequence?` · ${meta.frequence}`:'';
      const cumulableLabel=cumulableMax>1?` · max ${cumulableMax}`:'';
      const note=o.note?` [${o.note}]`:noteCoutMixte(o.cat, gratuit);
      const label=o.nom+(gratuit?' [GRATUIT]':note);
      const xpDisplay=gratuit?'GRATUIT':`${xpNum} XP`;
      optHtml+=`<option value="${o.nom}|${xpNum}|${gratuit?'gratuit':''}|${cat}|${cumulableMax}">${label} — ${xpDisplay}${frequencyLabel}${cumulableLabel}</option>`;
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
  const base=parseInt(xpIn?.dataset.baseXp,10)||0;
  const count=parseInt(countSel?.value,10)||1;

  if(xpIn)xpIn.value=base*count;
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
    onCompSel(sel,id,xpVal,freqVal,countVal);
  }
}

function onCompSel(sel,rowId,overrideXP,overrideFreq,overrideCount){
  const row=g(rowId);
  const xpIn=row.querySelector('.comp-xp');
  const freqIn=row.querySelector('.comp-freq');
  const countSel=row.querySelector('.comp-count');
  if(!sel.value){
    if(freqIn)freqIn.value='';
    if(countSel)setCompCountOptions(countSel,1,'1');
    if(xpIn){
      xpIn.value='0';
      xpIn.dataset.baseXp='0';
    }
    updateFaiblessesImmunites();
    calcXP();
    return;
  }

  const parts=sel.value.split('|');
  const nom=parts[0]||'';
  const xpRaw=parts[1]||'';
  const gratuit=parts[2]==='gratuit';
  const cat=parts[3]||'';
  const maxRaw=parts[4]||getCumulableMax(nom, cat);
  const meta=getCompetenceMeta(nom, cat);
  const maxCumulable=parseInt(maxRaw,10)||getCumulableMax(nom, cat);
  const xpNum=gratuit?0:parseXP(xpRaw);
  const count=overrideCount!==undefined&&overrideCount!==''?overrideCount:'1';

  xpIn.dataset.baseXp=String(xpNum);
  if(countSel)setCompCountOptions(countSel,maxCumulable,count);
  xpIn.value=overrideXP!==undefined&&overrideXP!==''?overrideXP:xpNum*(parseInt(countSel?.value,10)||1);
  if(freqIn)freqIn.value=overrideFreq!==undefined&&overrideFreq!==''?overrideFreq:(meta.frequence||'');

  calcXP();
  calcStats();
  updateFaiblessesImmunites();
}
