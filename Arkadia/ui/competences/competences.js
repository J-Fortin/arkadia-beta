// ===================== COMPÉTENCES =====================
const SURCOUT_CARRIERE_MIXTE = 1;

const RACE_COMPETENCE_RULES = {
  'elfe-sauvage': {
    interdites: ['Lecture et écriture']
  },
  'gobelin': {
    interdites: [
      'Arme non conventionnelle (91-130cm)',
      'Arme non conventionnelle (131cm+)',
      'Arme non conventionnelle - 2 mains',
      'Arme non conventionnelle - Colossale'
    ]
  }
};

const RACE_COMPETENCE_OPTIONS = {
  'demi-elfe': [
    { nom: 'Archerie', xp: 2, cat: 'Raciale', note: 'rabais racial' },
    { nom: 'Lecture et écriture', xp: 1, cat: 'Raciale', note: 'rabais racial' }
  ],
  'haut-elfe': [
    { nom: 'Noblesse', xp: 0, cat: 'Raciale', gratuit: true }
  ],
  'nain': [
    { nom: 'Forge', xp: 0, cat: 'Raciale', gratuit: true },
    { nom: 'Bravoure', xp: 0, cat: 'Raciale', gratuit: true }
  ],
  'gobelin': [
    { nom: 'Forge', xp: 0, cat: 'Raciale', gratuit: true }
  ]
};

const RACE_CAREER_COMPETENCE_OPTIONS = [
  {
    nom: 'Rage animale',
    xp: 0,
    cat: 'Raciale',
    races: ['arboreen','corvus','rasgadan','ratfolk','saurien'],
    carrieres: ['totem'],
    gratuit: true
  },
  {
    nom: 'Charognard',
    xp: 0,
    cat: 'Raciale',
    races: ['gobelin','orque','demi-demon','norde','corvus','rasgadan','ratfolk','saurien','morgull'],
    carrieres: null,
    gratuit: true
  },
  {
    nom: 'Art mystique',
    xp: 0,
    cat: 'Raciale',
    races: ['arboreen','corvus','rasgadan','ratfolk','saurien'],
    carrieres: ['totem','druide','chaman','animiste','rodeur'],
    gratuit: true
  }
];

function carriereEstMixte() {
  const carriere = CARRIERES[v('carriere')];
  return Boolean(carriere && /mixte/i.test(carriere.info || ''));
}

function isCareerCategory(cat) {
  return String(cat || '').startsWith('Carrière');
}

function getMixedCareerSources() {
  const carriere = CARRIERES[v('carriere')];
  const info = carriere?.info || '';
  const accessMatch = info.match(/Accès\s*:\s*([^.<]+)/i);
  if (!accessMatch) return [];

  return accessMatch[1]
    .split('+')
    .map(label => label.trim())
    .map(label => {
      const key = Object.keys(CARRIERES).find(carKey => {
        return normalizeCompetenceKey(CARRIERES[carKey].label) === normalizeCompetenceKey(label);
      });

      return key ? { key, label: CARRIERES[key].label } : null;
    })
    .filter(Boolean);
}

function competenceExisteDansCarriereSource(nom, sourceKey) {
  const source = CARRIERES[sourceKey];
  const normalized = normalizeCompetenceKey(nom);
  const sourceCompetences = [
    ...(source?.competences?.carriere || []),
    ...(source?.competences?.privilege || [])
  ];

  return sourceCompetences.some(entry => normalizeCompetenceKey(entry.split('|')[0]) === normalized);
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
  const race = v('race');
  const rules = RACE_COMPETENCE_RULES[race] || {};
  const raceData = RACES[race] || {};
  const interdites = [
    ...(rules.interdites || []),
    ...(raceData.competencesInterdites || [])
  ];
  const requises = [
    ...(rules.mustBe || []),
    ...(raceData.competencesMustBe || [])
  ];

  if (interdites.some(interdite => nom === interdite || nom.startsWith(interdite))) return false;
  if (requises.length > 0 && !requises.some(requise => nom === requise || nom.startsWith(requise))) return false;

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

const LOCAL_CUMULABLE_PATTERNS = [
  /^abjuration$/,
  /^ambidextrie$/,
  /^archerie/,
  /^arme a feu$/,
  /^arme de jet/,
  /^arme non conventionnelle/,
  /^attaque sournoise$/,
  /^baton de pouvoir$/,
  /^bouclier$/,
  /^bouclier avance/,
  /^bravoure$/,
  /^charge$/,
  /^charge accrue$/,
  /^clairvoyance$/,
  /^concoction /,
  /^contact marchand/,
  /^contre charge$/,
  /^coup fracassant$/,
  /^coup puissant$/,
  /^creation accrue$/,
  /^crochetage$/,
  /^deguisement$/,
  /^desarmement$/,
  /^dissimulation d objet$/,
  /^endurance guerriere$/,
  /^endurance naturelle a la magie$/,
  /^endurance simple$/,
  /^falsification$/,
  /^fatigue attenuee$/,
  /^ferveur magique$/,
  /^force brute$/,
  /^forge$/,
  /^heraldique$/,
  /^invocation guerriere$/,
  /^lame affutee$/,
  /^lecture et ecriture/,
  /^maitre ambidextre$/,
  /^messe$/,
  /^mulet de bataille$/,
  /^noblesse$/,
  /^orientation planaire$/,
  /^parchemins magiques/,
  /^port d armure specialisee$/,
  /^rage animale$/,
  /^religion$/,
  /^renvoi de sort$/,
  /^restauration$/,
  /^rituel$/,
  /^sang impur$/,
  /^sang pur$/,
  /^serrurier$/,
  /^talisman avance/,
  /^torture$/,
  /^touche a tout /,
  /^transfert de vitalite en mana$/,
  /^vol a la tire$/
];

function getLocalCumulableMax(nom) {
  const normalized = normalizeCompetenceKey(nom);
  return LOCAL_CUMULABLE_PATTERNS.some(pattern => pattern.test(normalized)) ? 5 : 1;
}

function getCumulableMax(nom, cat='') {
  return parseInt(getCompetenceMeta(nom, cat).cumulableMax, 10) || getLocalCumulableMax(nom);
}

function xpFinalCompetence(rawXp, cat, gratuit=false) {
  const base = parseXP(rawXp);
  if (gratuit) return 0;

  const surcoutMixteDejaInclus = carriereEstMixte() && isCareerCategory(cat);
  if (surcoutMixteDejaInclus && annuleSurcoutMixte()) {
    return Math.max(0, base - SURCOUT_CARRIERE_MIXTE);
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
  return RACE_COMPETENCE_OPTIONS[v('race')] || [];
}

function getRaceCareerOptions() {
  const race = v('race');
  const carriere = v('carriere');

  return RACE_CAREER_COMPETENCE_OPTIONS.filter(option => {
    const raceOk = !option.races || option.races.includes(race);
    const carriereOk = !option.carrieres || option.carrieres.includes(carriere);
    return raceOk && carriereOk;
  });
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
  const c=CARRIERES[carr];
  if(!c)return[];

  const all=[];
  const seen=new Set();
  const gratuits=c.competences.gratuit||[];

  getRaceOptions().forEach(option => {
    if(!competenceEstPermiseParRace(option.nom))return;
    addOptionUnique(all, {...option, gratuit: Boolean(option.gratuit)}, seen);
  });

  getRaceCareerOptions().forEach(option => {
    if(!competenceEstPermiseParRace(option.nom))return;
    addOptionUnique(all, {...option, gratuit: Boolean(option.gratuit)}, seen);
  });

  (c.competences.generales||[]).forEach(x=>{
    const [nom,xp]=x.split('|');
    if(!competenceEstPermiseParRace(nom))return;
    const gratuit=gratuits.some(g=>nom.startsWith(g));
    addOptionUnique(all, {nom,xp:gratuit?'0':xp,cat:'Générale',gratuit}, seen);
  });

  (c.competences.carriere||[]).forEach(x=>{
    const [nom,xp]=x.split('|');
    if(!competenceEstPermiseParRace(nom))return;
    const cat=carriereEstMixte()?getMixedCareerCategory(nom):'Carrière';
    addOptionUnique(all, {nom,xp,cat,gratuit:false}, seen);
  });

  (c.competences.privilege||[]).forEach(x=>{
    const [nom,xp]=x.split('|');
    if(!competenceEstPermiseParRace(nom))return;
    addOptionUnique(all, {nom,xp,cat:'Privilège ★',gratuit:false}, seen);
  });

  return all;
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
      const cumulableMax=getCumulableMax(o.nom, cat);
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
    for(let opt of sel.options){
      if(opt.value.startsWith(nomVal+'|')){sel.value=opt.value;break;}
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
