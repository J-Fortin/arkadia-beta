// ===================== SORTS =====================
function getSortMaxLevel(){
  const c=CARRIERES[v('carriere')];
  if(!c || !(c.magie || c.ptsMagie>0))return 0;
  return carriereEstMixte()?5:10;
}

function sortXpCost(level){
  return level<=3?2:level<=6?3:level<=9?4:5;
}

function completedSortLevels(excludeRowId=''){
  const levels=new Set();

  document.querySelectorAll('#sorts-tbody tr').forEach(row=>{
    if(row.id===excludeRowId)return;
    const lvl=parseInt(row.querySelector('.sort-lvl-sel')?.value)||0;
    const nom=row.querySelector('.sort-nom-sel')?.value||'';
    if(lvl && nom)levels.add(lvl);
  });

  return levels;
}

function sortLevelIsUnlocked(level, excludeRowId=''){
  if(level<=1)return true;

  const completed=completedSortLevels(excludeRowId);
  for(let required=1; required<level; required++){
    if(!completed.has(required))return false;
  }

  return true;
}

function updateSortLevelOptions(sel,rowId=''){
  const current=sel.value;
  const maxLevel=getSortMaxLevel();

  sel.innerHTML='<option value="">-</option>';

  for(let level=1; level<=maxLevel; level++){
    const option=document.createElement('option');
    option.value=String(level);
    option.textContent=String(level);
    option.disabled=!sortLevelIsUnlocked(level,rowId);
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

  document.querySelectorAll('#sorts-tbody tr').forEach(row=>{
    const lvlSel=row.querySelector('.sort-lvl-sel');
    const nomSel=row.querySelector('.sort-nom-sel');
    const xpIn=row.querySelector('.sort-xp');
    const lvl=parseInt(lvlSel?.value)||0;

    if(!lvl)return;

    if(lvl>maxLevel || !sortLevelIsUnlocked(lvl,row.id)){
      lvlSel.value='';
      nomSel.innerHTML='<option value="">-- Choisir le niveau d\'abord --</option>';
      if(xpIn)xpIn.value='';
      changed=true;
    }
  });

  return changed;
}

function updateSortOptions(sel,level){
  const ecole=v('ecole');
  const lvlSorts=(ecole&&level&&SORTS[ecole])?SORTS[ecole][level]||[]:[];
  const cur=sel.value;
  sel.innerHTML='<option value="">-- Choisir --</option>';

  if(lvlSorts.length>0){
    sortByText(lvlSorts).forEach(s=>{
      const o=document.createElement('option');
      o.value=s;
      o.textContent=s;
      sel.appendChild(o);
    });
  }

  if(cur)sel.value=cur;
}

function refreshAllSortRows(){
  let changed=true;
  let guard=0;
  while(changed && guard<10){
    changed=clearLockedSortRows();
    guard++;
  }

  document.querySelectorAll('#sorts-tbody tr').forEach(row=>{
    const lvlSel=row.querySelector('.sort-lvl-sel');
    const nomSel=row.querySelector('.sort-nom-sel');
    const xpIn=row.querySelector('.sort-xp');
    if(!lvlSel || !nomSel)return;

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

function addSort(nivVal='',nomVal='',xpVal=''){
  sortRows++;
  const id='sort-'+sortRows;
  const lvlNum=parseInt(nivVal)||0;
  const xpCost=xpVal!==''?xpVal:(lvlNum?sortXpCost(lvlNum):'');
  const tr=document.createElement('tr');
  tr.id=id;
  tr.innerHTML=`
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

  const lvlSel=tr.querySelector('.sort-lvl-sel');
  updateSortLevelOptions(lvlSel,id);

  if(nivVal){
    lvlSel.value=String(nivVal);
    onSortLvl(lvlSel,id);

    if(nomVal){
      const nomSel=tr.querySelector('.sort-nom-sel');
      nomSel.value=nomVal;
      if(!nomSel.value)nomSel.value='';
    }
  }

  refreshAllSortRows();
}

function onSortLvl(sel,rowId){
  const row=g(rowId);
  const lvl=parseInt(sel.value)||null;
  const nomSel=row.querySelector('.sort-nom-sel');
  const xpIn=row.querySelector('.sort-xp');

  if(lvl){
    xpIn.value=sortXpCost(lvl);
    updateSortOptions(nomSel,lvl);
  } else {
    xpIn.value='';
    updateSortOptions(nomSel,lvl);
  }

  refreshAllSortRows();
}

function onSortNomSel(sel,rowId){
  refreshAllSortRows();
}
