// ===================== SAVE / LOAD =====================
function collecterFiche(){
  const data={v:'2.4',
    joueur:{nom:v('j-nom'),naiss:v('j-naiss'),premier:v('j-premier'),tel:v('j-tel'),email:v('j-email'),allergies:v('j-allergies'),u1nom:v('u1-nom'),u1tel:v('u1-tel'),u2nom:v('u2-nom'),u2tel:v('u2-tel')},
    personnage:{nom:v('p-nom'),premier:v('p-premier'),race:v('race'),carriere:v('carriere'),moralite:v('moralite'),religion:v('religion'),ecole:v('ecole'),maison:v('maison'),noblesse:v('noblesse'),ptsArmure:v('pts-armure'),typeArmure:v('type-armure'),faiblesses:v('faiblesses'),immunites:v('immunites'),evenementsParticipes:v('xp-total'),xpEvenements:(parseInt(v('xp-total'))||0)*3,xpTotal:v('xp-total'),ressources:v('ressources'),titres:v('titres'),notes:v('notes'),bg:v('bg')},
    audit:{eventCountBaseline,eventCountCurrent:parseInt(v('xp-total'))||0,eventAbuseWarning:getEventAbuseWarning()},
    competences:[],sorts:[],evenements:[]
  };

  document.querySelectorAll('#comp-tbody tr').forEach(tr=>{
    const sel=tr.querySelector('.comp-sel');
    const freq=tr.querySelector('.comp-freq');
    const count=tr.querySelector('.comp-count');
    const xp=tr.querySelector('.comp-xp');
    const parts=sel?.value?.split('|')||[];
    const nom=parts[0]||'';
    if(nom)data.competences.push({nom,freq:freq?.value||'',count:count?.value||'1',xp:xp?.value||'0'});
  });

  document.querySelectorAll('#sorts-tbody tr').forEach(tr=>{
    const lvl=tr.querySelector('.sort-lvl-sel')?.value||'';
    const nom=tr.querySelector('.sort-nom-sel')?.value||'';
    const xp=tr.querySelector('.sort-xp')?.value||'0';
    if(lvl||nom)data.sorts.push({lvl,nom,xp});
  });

  document.querySelectorAll('#ev-tbody tr').forEach(tr=>{
    const ins=tr.querySelectorAll('input');
    if(ins.length>=2 && (ins[0].value.trim() || ins[1].value.trim())){
      data.evenements.push({ev:ins[0].value,saison:ins[1].value,xp:3});
    }
  });

  return data;
}

function telechargerBlob(blob, filename){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function sauver(){
  if(!formulaireEstValidePourExport())return;
  const data=collecterFiche();
  telechargerBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),'arkadia_'+(v('p-nom')||'personnage').replace(/\s+/g,'_')+'.json');
}

async function exporterExcel(){
  if(!formulaireEstValidePourExport())return;

  try{
    const data=collecterFiche();
    const blob=await exporterFicheExcel(data);
    const nom=(v('p-nom')||'personnage').replace(/\s+/g,'_');
    telechargerBlob(blob,`arkadia_${nom}.xlsx`);
  }catch(error){
    console.error(error);
    alert("Impossible de générer le fichier Excel. Vérifie que le backend est démarré.");
  }
}

async function envoyer(){
  if(!formulaireEstValidePourExport())return;

  try{
    const result=await envoyerFicheParCourriel(collecterFiche());
    alert(result.message || "Fiche envoyée.");
  }catch(error){
    console.error(error);
    alert("Impossible d'envoyer la fiche. Vérifie que le backend est démarré et configuré.");
  }
}

async function lire(event){
  const file=event.target.files[0];if(!file)return;

  if(file.name.toLowerCase().endsWith('.xlsx')){
    try{
      charger(await importerFicheExcel(file));
    }catch(error){
      console.error(error);
      alert("Fichier Excel invalide ou backend non disponible.");
    }
    return;
  }

  const reader=new FileReader();
  reader.onload=e=>{try{charger(JSON.parse(e.target.result));}catch{alert('Fichier invalide.');}};
  reader.readAsText(file);
}

function normaliserEvenementsParticipes(valeur, version='2.2'){
  const raw=parseInt(valeur)||0;
  if(version==='2.1' && raw>0 && raw%3===0)return raw/3;
  return raw;
}

function charger(d){
  if(d.joueur){
    sv('j-nom',d.joueur.nom);sv('j-naiss',d.joueur.naiss);sv('j-premier',d.joueur.premier);
    sv('j-tel',d.joueur.tel);sv('j-email',d.joueur.email);sv('j-allergies',d.joueur.allergies);
    sv('u1-nom',d.joueur.u1nom);sv('u1-tel',d.joueur.u1tel);sv('u2-nom',d.joueur.u2nom);sv('u2-tel',d.joueur.u2tel);
  }
  if(d.personnage){
    const p=d.personnage;
    sv('p-nom',p.nom);sv('p-premier',p.premier);
    sv('race',p.race);onRace();
    sv('carriere',p.carriere);onCarriere();
    sv('religion',p.religion);onReligion();
    sv('moralite',p.moralite);onMoralite();
    setTimeout(()=>{sv('ecole',p.ecole);onEcole();},50);
    sv('maison',p.maison);sv('noblesse',p.noblesse);
    sv('pts-armure',p.ptsArmure);sv('type-armure',p.typeArmure);
    sv('faiblesses',p.faiblesses);sv('immunites',p.immunites);
    sv('xp-total',p.evenementsParticipes ?? normaliserEvenementsParticipes(p.xpTotal,d.v));sv('ressources',p.ressources);
    eventCountBaseline=parseInt(v('xp-total'))||0;
    sv('titres',p.titres);sv('notes',p.notes);sv('bg',p.bg);
  }
  g('comp-tbody').innerHTML='';compRows=0;
  (d.competences||[]).forEach(c=>addComp(c.nom,c.xp,c.freq,c.count||'1'));
  g('sorts-tbody').innerHTML='';sortRows=0;
  (d.sorts||[]).forEach(s=>addSort(s.lvl,s.nom,s.xp));
  g('ev-tbody').innerHTML='';evRows=0;
  (d.evenements||[]).forEach(e=>addEv(e.ev,e.saison));
  calcEvXP();
  calcXP();calcStats();
  validerCombinaisonRaceCarriere();
  validerMoraliteDivinite();
}
