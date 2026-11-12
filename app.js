const $=id=>document.getElementById(id);let machines=[],shift=null,db,stream=null,detector=null,scanLoop=false;
const DB='mine-fuel-tracker',STORE='transactions';
function defaults(){return {operators:['Operator 1','Operator 2','Operator 3','Operator 4'],trucks:['ST009','ST0066']}}
function settings(){try{return {...defaults(),...JSON.parse(localStorage.getItem('mft-settings')||'{}')}}catch{return defaults()}}
function saveSettings(s){localStorage.setItem('mft-settings',JSON.stringify(s))}
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains(STORE)){const st=d.createObjectStore(STORE,{keyPath:'id'});st.createIndex('shiftId','shiftId')}};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function allEntries(){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).getAll();r.onsuccess=()=>resolve(r.result.sort((a,b)=>b.timestamp-a.timestamp));r.onerror=()=>reject(r.error)})}
function addEntry(e){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).add(e);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
function fillSettings(){const s=settings();$('operator').innerHTML=s.operators.map(x=>`<option>${esc(x)}</option>`).join('');$('truck').innerHTML=s.trucks.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');$('truck').value=s.trucks.includes('ST009')?'ST009':s.trucks[0];$('operatorsText').value=s.operators.join('\n');$('trucksText').value=s.trucks.join('\n')}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fmt(t){return new Date(t).toLocaleString('en-AU',{dateStyle:'medium',timeStyle:'short'})}
function populateMachines(){ $('assetSelect').innerHTML='<option value="">Select a machine or scan its QR code</option>'+machines.map(m=>`<option value="${m.qrId}">${esc(m.assetNumber)} — ${esc(m.description||m.category)}</option>`).join('') }
function showAsset(){const m=machines.find(x=>x.qrId===$('assetSelect').value);$('assetDetails').textContent=m?`${m.assetNumber} · ${m.description||'Description not supplied'} · ${m.category} · QR ${m.qrId}`:'No machine selected'}
function start(){const operator=$('operator').value,truck=$('truck').value,shiftType=document.querySelector('input[name="shift"]:checked').value;if(!operator||!truck)return alert('Please set up an operator and service truck first.');shift={id:crypto.randomUUID(),operator,truck,shiftType,startedAt:Date.now()};$('setup').classList.add('hidden');$('work').classList.remove('hidden');$('shiftSummary').textContent=`${operator} · ${truck} · ${shiftType}`;$('shiftStarted').textContent=`Started ${fmt(shift.startedAt)}`;refresh()}
function endShift(){if(!confirm('End this shift? Fuel entries already saved will remain on this device.'))return;shift=null;$('work').classList.add('hidden');$('setup').classList.remove('hidden');stopScanner()}
async function saveFuel(){const m=machines.find(x=>x.qrId===$('assetSelect').value),litres=Number($('litres').value);if(!m)return alert('Select or scan a machine.');if(!Number.isFinite(litres)||litres<=0)return alert('Enter a valid litres amount.');const e={id:crypto.randomUUID(),shiftId:shift.id,qrId:m.qrId,assetNumber:m.assetNumber,description:m.description,litres,timestamp:Date.now(),operator:shift.operator,truck:shift.truck,shiftType:shift.shiftType,syncStatus:'local-only'};await addEntry(e);$('litres').value='';$('assetSelect').value='';showAsset();$('saveMessage').textContent=`Saved ${litres.toLocaleString('en-AU')} L for ${m.assetNumber}. Stored on this device.`;refresh()}
async function refresh(){renderReports();const es=(await allEntries()).filter(e=>shift&&e.shiftId===shift.id);$('entryCount').textContent=es.length;$('litreTotal').textContent=es.reduce((n,e)=>n+e.litres,0).toLocaleString('en-AU',{maximumFractionDigits:1})+' L';$('pendingCount').textContent=es.length;$('entries').innerHTML=es.length?es.map(e=>`<div class="entry"><div><strong>${esc(e.assetNumber)} · ${esc(e.description||'')}</strong><small>${fmt(e.timestamp)} · ${esc(e.operator)} · ${esc(e.truck)}</small></div><b>${e.litres.toLocaleString('en-AU')} L</b></div>`).join(''):'<p class="muted">No entries recorded yet.</p>'}
function exportCSV(){allEntries().then(es=>{if(!es.length)return alert('No fuel entries to export yet.');const cols=['DateTime','AssetNumber','Description','Litres','Shift','Operator','ServiceTruck','QR_ID','ShiftID'];const lines=[cols.join(','),...es.map(e=>[fmt(e.timestamp),e.assetNumber,e.description,e.litres,e.shiftType,e.operator,e.truck,e.qrId,e.shiftId].map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(','))];const blob=new Blob([lines.join('\r\n')],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='mine-fuel-entries.csv';a.click();URL.revokeObjectURL(a.href)})}
function filteredReportEntries(es){const period=$('reportPeriod').value,now=new Date(),start=new Date(now);if(period==='today')start.setHours(0,0,0,0);else if(period==='week')start.setDate(start.getDate()-6),start.setHours(0,0,0,0);else if(period==='month')start.setDate(1),start.setHours(0,0,0,0);return period==='all'?es:es.filter(e=>e.timestamp>=start.getTime())}
async function renderReports(){if(!db)return;const es=filteredReportEntries(await allEntries()),total=es.reduce((n,e)=>n+Number(e.litres||0),0);$('reportTotal').textContent=total.toLocaleString('en-AU',{maximumFractionDigits:1})+' L';$('reportCount').textContent=es.length+' fuel entries';const mode=$('reportGroup').value,groups={};for(const e of es){let key=mode==='machine'?e.assetNumber:mode==='operator'?e.operator:mode==='truck'?e.truck:mode==='shift'?e.shiftType:new Date(e.timestamp).toLocaleDateString('en-AU');groups[key]=(groups[key]||0)+Number(e.litres||0)}const rows=Object.entries(groups).sort((a,b)=>b[1]-a[1]);$('reportRows').innerHTML=rows.length?rows.map(([k,v])=>`<div class="reportrow"><div><strong>${esc(k||'Unknown')}</strong><small>${(v/Math.max(total,1)*100).toFixed(1)}% of selected fuel</small></div><b>${v.toLocaleString('en-AU',{maximumFractionDigits:1})} L</b></div>`).join(''):'<p class="muted">No fuel entries in this period.</p>'}
async function exportReportCSV(){
 const es=filteredReportEntries(await allEntries());
 if(!es.length)return alert('No fuel entries in the selected period.');
 const csv=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const total=es.reduce((n,e)=>n+Number(e.litres||0),0);
 const lines=[
  'MINE FUEL TRACKER REPORT',
  csv('Period')+','+csv($('reportPeriod').selectedOptions[0]?.textContent||'All recorded entries'),
  csv('Total litres')+','+csv(total.toFixed(1)),
  csv('Number of entries')+','+csv(es.length),
  '',
  'SUMMARY BY MACHINE',csv('Machine')+','+csv('Total litres'),
 ];
 const addSummary=(heading,key)=>{lines.push('',heading,csv('Name')+','+csv('Total litres'));const groups={};for(const e of es){const name=key==='_date'?new Date(e.timestamp).toLocaleDateString('en-AU'):(e[key]||'Unknown');groups[name]=(groups[name]||0)+Number(e.litres||0)}for(const [name,value] of Object.entries(groups).sort((a,b)=>b[1]-a[1]))lines.push(csv(name)+','+csv(value.toFixed(1)))};
 const machineGroups={};for(const e of es){const name=e.assetNumber||'Unknown';machineGroups[name]=(machineGroups[name]||0)+Number(e.litres||0)}
 for(const [name,value] of Object.entries(machineGroups).sort((a,b)=>b[1]-a[1]))lines.push(csv(name)+','+csv(value.toFixed(1)));
 addSummary('SUMMARY BY OPERATOR','operator');
 addSummary('SUMMARY BY SERVICE TRUCK','truck');
 addSummary('SUMMARY BY SHIFT','shiftType');
 addSummary('SUMMARY BY DAY','_date');
 // Include a detailed transaction ledger after the summary for auditing.
 lines.push('','DETAILED FUEL ENTRIES', ['DateTime','AssetNumber','Description','Litres','Shift','Operator','ServiceTruck','QR_ID','ShiftID'].map(csv).join(','));
 for(const e of es)lines.push([new Date(e.timestamp).toLocaleString('en-AU'),e.assetNumber,e.description,e.litres,e.shiftType,e.operator,e.truck,e.qrId,e.shiftId].map(csv).join(','));
 const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mine-fuel-report.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
async function startScanner(){if(!('BarcodeDetector'in window)){alert('This browser does not provide built-in QR scanning. Use the machine list for now, or open this app in a supported Android Chrome browser.');return}try{detector=new BarcodeDetector({formats:['qr_code']});stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});$('video').srcObject=stream;$('scanArea').classList.remove('hidden');await $('video').play();scanLoop=true;scanFrame()}catch(e){alert('Could not start camera. Check camera permission and make sure the app is hosted over HTTPS.') }}
async function scanFrame(){if(!scanLoop)return;try{const codes=await detector.detect($('video'));if(codes.length){const raw=codes[0].rawValue.trim(),m=machines.find(x=>x.qrId===raw||x.assetNumber===raw);if(m){$('assetSelect').value=m.qrId;showAsset();$('saveMessage').textContent=`Identified ${m.assetNumber}`;stopScanner();return}}}catch(e){}requestAnimationFrame(scanFrame)}
function stopScanner(){scanLoop=false;if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}$('video').srcObject=null;$('scanArea').classList.add('hidden')}
function online(){const ok=navigator.onLine;$('connection').textContent=ok?'Online · local storage':'Offline · local storage';$('connection').style.borderColor=ok?'#75b99a':'#e2b66e'}
$('startShift').onclick=start;$('endShift').onclick=endShift;$('saveEntry').onclick=saveFuel;$('assetSelect').onchange=showAsset;$('scanBtn').onclick=startScanner;$('stopScan').onclick=stopScanner;$('exportBtn').onclick=exportCSV;$('reportPeriod').onchange=renderReports;$('reportGroup').onchange=renderReports;$('reportExportBtn').onclick=exportReportCSV;
$('adminOpen').onclick=()=>{$('setup').classList.add('hidden');$('admin').classList.remove('hidden')};$('adminClose').onclick=()=>{$('admin').classList.add('hidden');$('setup').classList.remove('hidden')};$('saveAdmin').onclick=()=>{const operators=$('operatorsText').value.split('\n').map(x=>x.trim()).filter(Boolean),trucks=$('trucksText').value.split('\n').map(x=>x.trim()).filter(Boolean);if(!operators.length||!trucks.length)return alert('Enter at least one operator and one service truck.');saveSettings({operators,trucks});fillSettings();alert('Settings saved on this device.');$('admin').classList.add('hidden');$('setup').classList.remove('hidden')};
window.addEventListener('online',online);window.addEventListener('offline',online);

const SUPABASE_URL = 'https://bzbbwhyauvatueubcjzv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_SL8Soi0Yl9A7W-Mu-mlnHA_0lZz6BkE';

const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

let currentUser = null;
let currentOperator = null;

async function loadOperator(user) {
  if (!supabaseClient) return false;

  const { data, error } = await supabaseClient
    .from('operators')
    .select('id, name, role, active')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (error) {
    $('loginMessage').textContent = 'Operator lookup failed: ' + error.message;
    return false;
  }

  if (!data || data.active === false) {
    await supabaseClient.auth.signOut();
    $('loginMessage').textContent =
      'No active operator account is linked to this login.';
    return false;
  }

  currentUser = user;
  currentOperator = data;

  $('operator').innerHTML =
    `<option value="${esc(data.name)}">${esc(data.name)}</option>`;
  $('operator').value = data.name;
  $('operator').disabled = true;

  $('login').classList.add('hidden');
  $('setup').classList.remove('hidden');

  return true;
}

async function login() {
  if (!supabaseClient) {
    $('loginMessage').textContent = 'Supabase library could not load. Check your internet connection.';
    return;
  }

  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;

  $('loginMessage').textContent = 'Signing in...';

  const { data, error } = await supabaseClient.auth
    .signInWithPassword({ email, password });

  if (error) {
    $('loginMessage').textContent = error.message;
    return;
  }

  await loadOperator(data.user);
}

async function checkLogin() {
  if (!supabaseClient) {
    $('loginMessage').textContent = 'Supabase library could not load.';
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    $('loginMessage').textContent = error.message;
    return;
  }

  if (data.session) {
    await loadOperator(data.session.user);
  }
}

$('loginBtn').onclick = login;
$('logoutBtn').onclick = async () => {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    $('loginMessage').textContent = 'Logout failed: ' + error.message;
    return;
  }

  currentUser = null;
  currentOperator = null;

  $('setup').classList.add('hidden');
  $('login').classList.remove('hidden');

  $('loginEmail').value = '';
  $('loginPassword').value = '';
  $('loginMessage').textContent = 'You have been logged out.';
};
(async()=>{
  try {
    const r = await fetch('data/machines.json');
    machines = await r.json();

    populateMachines();
    db = await openDB();
    fillSettings();
    online();
    renderReports();

    $('dateStamp').textContent =
      'Shift date/time: ' + fmt(Date.now()) + ' (automatic)';

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(()=>{});
    }

    await checkLogin();

  } catch(e) {
    alert('App setup failed: ' + e.message);
  }
})();
