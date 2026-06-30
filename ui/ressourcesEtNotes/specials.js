// ===================== AJOUTS SPECIAUX ANIMATION =====================
function specialAttr(value){
  return String(value ?? '')
    .replace(/&/g,'&amp;')
    .replace(/"/g,'&quot;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

function addSpecialComp(nomVal='',freqVal='',countVal='1',xpVal='',noteVal=''){
  specialCompRows++;
  const id=`special-comp-${specialCompRows}`;
  const tr=document.createElement('tr');
  tr.id=id;
  tr.innerHTML=`
    <td><input type="text" class="special-comp-nom" value="${specialAttr(nomVal)}" placeholder="Nom de la competence" oninput="calcXP()"></td>
    <td><input type="text" class="special-comp-freq" value="${specialAttr(freqVal)}" placeholder="Frequence"></td>
    <td><input type="number" class="special-comp-count" min="1" value="${specialAttr(countVal || '1')}" oninput="calcXP()"></td>
    <td class="td-xp"><input type="number" class="special-comp-xp" min="0" value="${specialAttr(xpVal || '0')}" oninput="calcXP()"></td>
    <td><input type="text" class="special-comp-note" value="${specialAttr(noteVal)}" placeholder="Titre, race avancee, autorisation..."></td>
    <td class="td-btn no-print"><button class="ibtnd" onclick="removeRow('${id}')">x</button></td>
  `;
  g('special-comp-tbody').appendChild(tr);
  calcXP();
}

function addSpecialSort(ecoleVal='',lvlVal='',nomVal='',xpVal='',noteVal=''){
  specialSortRows++;
  const id=`special-sort-${specialSortRows}`;
  const tr=document.createElement('tr');
  tr.id=id;
  tr.innerHTML=`
    <td><input type="text" class="special-sort-ecole" value="${specialAttr(ecoleVal)}" placeholder="Ecole / source" oninput="calcXP()"></td>
    <td><input type="number" class="special-sort-lvl" min="0" value="${specialAttr(lvlVal)}" oninput="calcXP()"></td>
    <td><input type="text" class="special-sort-nom" value="${specialAttr(nomVal)}" placeholder="Nom du sort" oninput="calcXP()"></td>
    <td class="td-xp"><input type="number" class="special-sort-xp" min="0" value="${specialAttr(xpVal || '0')}" oninput="calcXP()"></td>
    <td><input type="text" class="special-sort-note" value="${specialAttr(noteVal)}" placeholder="Titre, race avancee, autorisation..."></td>
    <td class="td-btn no-print"><button class="ibtnd" onclick="removeRow('${id}')">x</button></td>
  `;
  g('special-sort-tbody').appendChild(tr);
  calcXP();
}

function collectSpecialCompetences(){
  const items=[];
  document.querySelectorAll('#special-comp-tbody tr').forEach(tr=>{
    const nom=tr.querySelector('.special-comp-nom')?.value?.trim() || '';
    const freq=tr.querySelector('.special-comp-freq')?.value?.trim() || '';
    const count=tr.querySelector('.special-comp-count')?.value || '1';
    const xp=tr.querySelector('.special-comp-xp')?.value || '0';
    const note=tr.querySelector('.special-comp-note')?.value?.trim() || '';
    if(nom || freq || note)items.push({nom,freq,count,xp,note});
  });
  return items;
}

function collectSpecialSorts(){
  const items=[];
  document.querySelectorAll('#special-sort-tbody tr').forEach(tr=>{
    const ecole=tr.querySelector('.special-sort-ecole')?.value?.trim() || '';
    const lvl=tr.querySelector('.special-sort-lvl')?.value || '';
    const nom=tr.querySelector('.special-sort-nom')?.value?.trim() || '';
    const xp=tr.querySelector('.special-sort-xp')?.value || '0';
    const note=tr.querySelector('.special-sort-note')?.value?.trim() || '';
    if(ecole || lvl || nom || note)items.push({ecole,lvl,nom,xp,note});
  });
  return items;
}
