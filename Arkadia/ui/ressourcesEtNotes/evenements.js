// ===================== ÉVÉNEMENTS =====================
function addEv(evVal='',saisonVal=''){
  evRows++;
  const id='ev-'+evRows;
  const tr=document.createElement('tr');
  tr.id=id;
  tr.innerHTML=`
    <td><input type="text" value="${evVal}" placeholder="Ex. Événement 125-3" oninput="calcEvXP()"></td>
    <td><input type="text" value="${saisonVal}" placeholder="2025" oninput="calcEvXP()"></td>
    <td class="td-btn"><button class="ibtnd" onclick="removeRow('${id}');calcEvXP()">✕</button></td>
  `;
  g('ev-tbody').appendChild(tr);
  calcEvXP();
}

function calcEvXP(){
  let t=0;
  document.querySelectorAll('#ev-tbody tr').forEach(row=>{
    const inputs=row.querySelectorAll('input[type=text]');
    const hasEvent=Array.from(inputs).some(input=>input.value.trim());
    if(hasEvent)t+=1;
  });
  sv('xp-total',t);
  onEventCountChange();
}

