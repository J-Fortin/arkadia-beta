// ===================== SORTS =====================
function getSortMaxLevel(){
  const c=getDatabaseCarriereOption(v('carriere'));
  return getCarriereSortMaxLevel(c);
}

function getAvailableSortSchools(){
  const schools=typeof getSelectedSpellSchools==='function'?getSelectedSpellSchools():[v('ecole')].filter(Boolean);
  return schools;
}

function getDefaultSortSchool(){
  const schools=getAvailableSortSchools();
  return schools.length===1?schools[0]:'';
}

function getRowSortSchool(row){
  return row?.querySelector('.sort-ecole-sel')?.value || getDefaultSortSchool();
}

function sortXpCost(level,ecole=getDefaultSortSchool(),nom=''){
  const databaseXp=typeof getSortXpFromDatabase==='function'?getSortXpFromDatabase(ecole,level,nom):null;
  const semiSurcharge=carriereEstSemiMagique()&&carriereDonneAccesSorts()?1:0;
  if(databaseXp)return databaseXp+semiSurcharge;

  return (level<=3?2:level<=6?3:level<=9?4:5)+semiSurcharge;
}

function completedSortLevels(excludeRowId='',ecole=''){
  const levels=new Set();

  document.querySelectorAll('#sorts-tbody tr').forEach(row=>{
    if(row.id===excludeRowId)return;
    if(ecole && getRowSortSchool(row)!==ecole)return;
    const lvl=parseInt(row.querySelector('.sort-lvl-sel')?.value)||0;
    const nom=row.querySelector('.sort-nom-sel')?.value||'';
    if(lvl && nom)levels.add(lvl);
  });

  return levels;
}

function sortLevelIsUnlocked(level, excludeRowId='', ecole=''){
  if(!ecole)return false;
  if(level<=1)return true;

  const completed=completedSortLevels(excludeRowId,ecole);
  for(let required=1; required<level; required++){
    if(!completed.has(required))return false;
  }

  return true;
}

function updateSortSchoolOptions(sel){
  const current=sel.value;
  const schools=getAvailableSortSchools();

  sel.innerHTML='<option value="">-- École --</option>';
  schools.forEach(ecole=>{
    const option=document.createElement('option');
    option.value=ecole;
    option.textContent=ecole;
    sel.appendChild(option);
  });

  if(current && schools.includes(current)){
    sel.value=current;
  } else if(schools.length===1) {
    sel.value=schools[0];
  } else {
    sel.value='';
  }

  sel.disabled=schools.length<=1;
}

function updateSortLevelOptions(sel,rowId=''){
  const row=g(rowId) || sel.closest('tr');
  const current=sel.value;
  const maxLevel=getSortMaxLevel();
  const ecole=getRowSortSchool(row);

  sel.innerHTML='<option value="">-</option>';
  sel.disabled=!ecole;

  for(let level=1; level<=maxLevel; level++){
    const option=document.createElement('option');
    option.value=String(level);
    option.textContent=String(level);
    option.disabled=!sortLevelIsUnlocked(level,rowId,ecole);
    sel.appendChild(option);
  }

  if(current && [...sel.options].some(option=>option.value===current && !option.disabled)){
    sel.value=current;
  } else if(current) {
    sel.value='';
  }
}

function clearLockedSortRows(){
  let changed=false;
  const maxLevel=getSortMaxLevel();
  const availableSchools=getAvailableSortSchools();

  document.querySelectorAll('#sorts-tbody tr').forEach(row=>{
    const schoolSel=row.querySelector('.sort-ecole-sel');
    const lvlSel=row.querySelector('.sort-lvl-sel');
    const nomSel=row.querySelector('.sort-nom-sel');
    const xpIn=row.querySelector('.sort-xp');

    if(schoolSel){
      const before=schoolSel.value;
      updateSortSchoolOptions(schoolSel);
      if(before && before!==schoolSel.value)changed=true;
    }

    const ecole=getRowSortSchool(row);
    const lvl=parseInt(lvlSel?.value)||0;
    if(!ecole || !availableSchools.includes(ecole)){
      let rowChanged=false;
      if(lvlSel?.value){lvlSel.value='';rowChanged=true;}
      if(nomSel&&nomSel.options[0]?.textContent!=="-- Choisir l'école d'abord --")nomSel.innerHTML='<option value="">-- Choisir l\'école d\'abord --</option>';
      if(xpIn?.value){xpIn.value='';rowChanged=true;}
      if(rowChanged)changed=true;
      return;
    }

    if(!lvl)return;

    if(lvl>maxLevel || !sortLevelIsUnlocked(lvl,row.id,ecole)){
      lvlSel.value='';
      nomSel.innerHTML='<option value="">-- Choisir le niveau d\'abord --</option>';
      if(xpIn)xpIn.value='';
      changed=true;
    }
  });

  return changed;
}

function updateSortOptions(sel,level,ecole=''){
  const row=sel.closest('tr');
  const school=ecole || getRowSortSchool(row);
  const lvlSorts=(school&&level&&typeof getSortEntries==='function')?getSortEntries(school,level):[];
  const cur=sel.value;
  sel.innerHTML=school?'<option value="">-- Choisir --</option>':'<option value="">-- Choisir l\'école d\'abord --</option>';

  if(lvlSorts.length>0){
    sortByText(lvlSorts.map(s=>s.nom)).forEach(s=>{
      const o=document.createElement('option');
      o.value=s;
      o.textContent=s;
      sel.appendChild(o);
    });
  }

  if(cur && [...sel.options].some(option=>option.value===cur)){
    sel.value=cur;
  } else if(cur) {
    sel.value='';
  }
}

function refreshAllSortRows(){
  let changed=true;
  let guard=0;
  while(changed && guard<10){
    changed=clearLockedSortRows();
    guard++;
  }

  document.querySelectorAll('#sorts-tbody tr').forEach(row=>{
    const schoolSel=row.querySelector('.sort-ecole-sel');
    const lvlSel=row.querySelector('.sort-lvl-sel');
    const nomSel=row.querySelector('.sort-nom-sel');
    const xpIn=row.querySelector('.sort-xp');
    if(!lvlSel || !nomSel)return;

    if(schoolSel)updateSortSchoolOptions(schoolSel);
    const previousLevel=lvlSel.value;
    updateSortLevelOptions(lvlSel,row.id);

    if(previousLevel && !lvlSel.value){
      nomSel.innerHTML='<option value="">-- Choisir le niveau d\'abord --</option>';
      if(xpIn)xpIn.value='';
    } else {
      updateSortOptions(nomSel,parseInt(lvlSel.value)||null);
    }
  });

  calcXP();
}

function addSort(nivVal='',nomVal='',xpVal='',ecoleVal=''){
  sortRows++;
  const id='sort-'+sortRows;
  const lvlNum=parseInt(nivVal)||0;
  const initialSchool=ecoleVal || getDefaultSortSchool();
  const xpCost=xpVal!==''?xpVal:(lvlNum&&initialSchool?sortXpCost(lvlNum,initialSchool,nomVal):'');
  const tr=document.createElement('tr');
  tr.id=id;
  tr.innerHTML=`
    <td>
      <select class="sort-ecole-sel" onchange="onSortEcole(this,'${id}')">
        <option value="">-- École --</option>
      </select>
    </td>
    <td>
      <select class="sort-lvl-sel" onchange="onSortLvl(this,'${id}')" style="width:65px">
        <option value="">-</option>
      </select>
    </td>
    <td>
      <select class="sort-nom-sel" onchange="onSortNomSel(this,'${id}')">
        <option value="">-- Choisir le niveau d'abord --</option>
      </select>
    </td>
    <td class="td-xp"><input type="number" class="sort-xp" min="0" value="${xpCost}" oninput="calcXP()"></td>
    <td class="td-btn no-print"><button class="ibtnd" onclick="removeRow('${id}')">x</button></td>
  `;
  g('sorts-tbody').appendChild(tr);

  const schoolSel=tr.querySelector('.sort-ecole-sel');
  const lvlSel=tr.querySelector('.sort-lvl-sel');
  updateSortSchoolOptions(schoolSel);
  if(initialSchool)schoolSel.value=initialSchool;
  updateSortLevelOptions(lvlSel,id);

  if(nivVal){
    lvlSel.value=String(nivVal);
    onSortLvl(lvlSel,id);

    if(nomVal){
      const nomSel=tr.querySelector('.sort-nom-sel');
      nomSel.value=nomVal;
      if(!nomSel.value)nomSel.value='';
      if(xpVal==='')onSortNomSel(nomSel,id);
    }
  }

  refreshAllSortRows();
}

function onSortEcole(sel,rowId){
  const row=g(rowId);
  const lvlSel=row?.querySelector('.sort-lvl-sel');
  const nomSel=row?.querySelector('.sort-nom-sel');
  const xpIn=row?.querySelector('.sort-xp');
  const lvl=parseInt(lvlSel?.value)||null;

  if(lvlSel)updateSortLevelOptions(lvlSel,rowId);
  if(nomSel)updateSortOptions(nomSel,lvl,sel.value);
  if(lvl&&xpIn)xpIn.value=nomSel?.value?sortXpCost(lvl,sel.value,nomSel.value):'';
  refreshAllSortRows();
}

function onSortLvl(sel,rowId){
  const row=g(rowId);
  const lvl=parseInt(sel.value)||null;
  const school=getRowSortSchool(row);
  const nomSel=row.querySelector('.sort-nom-sel');
  const xpIn=row.querySelector('.sort-xp');

  if(lvl&&school){
    xpIn.value=nomSel.value?sortXpCost(lvl,school,nomSel.value):sortXpCost(lvl,school);
    updateSortOptions(nomSel,lvl,school);
  } else {
    xpIn.value='';
    updateSortOptions(nomSel,lvl,school);
  }

  refreshAllSortRows();
}

function onSortNomSel(sel,rowId){
  const row=g(rowId);
  const lvl=parseInt(row?.querySelector('.sort-lvl-sel')?.value)||null;
  const school=getRowSortSchool(row);
  const xpIn=row?.querySelector('.sort-xp');
  if(lvl&&school&&xpIn)xpIn.value=sortXpCost(lvl,school,sel.value);
  refreshAllSortRows();
}
