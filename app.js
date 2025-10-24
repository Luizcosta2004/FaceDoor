// FaceDoor PWA v2 - app.js (local face-api.js + WS then HTTP fallback)
// Notes: Put models in ./models/ (tiny_face_detector, face_landmark_68, face_recognition)
// This script tries WebSocket first (auto), then uses HTTP GET if WS not available.

const video = document.getElementById('inputVideo');
const canvas = document.getElementById('overlay');
const logEl = document.getElementById('log');
const confRange = document.getElementById('confThreshold');
const confValue = document.getElementById('confValue');
const enrollBtn = document.getElementById('enrollBtn');
const clearDbBtn = document.getElementById('clearDbBtn');
const connectBtn = document.getElementById('connectBtn');
const connStatus = document.getElementById('connStatus');
const protocolSelect = document.getElementById('protocolSelect');
const installBtn = document.getElementById('installBtn');

let labeledDescriptors = [];
let faceMatcher = null;
let ws = null;
let espHost = '';
let espPort = 81;
let protocol = 'auto';

confRange.addEventListener('input', ()=>{confValue.textContent = parseFloat(confRange.value).toFixed(2)});

function writeLog(s){
  const t = new Date().toLocaleTimeString();
  logEl.textContent = `[${t}] ${s}\n` + logEl.textContent;
}

async function startVideo(){
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode: 'user' }, audio:false });
    video.srcObject = stream;
    await video.play();
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }catch(err){
    console.error(err); writeLog('Erro ao acessar camera: '+err.message);
  }
}

async function loadModels(){
  writeLog('Carregando modelos...');
  const MODEL_URL = './models';
  try{
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    writeLog('Modelos carregados.');
  }catch(e){
    writeLog('Erro ao carregar modelos: '+e.message);
  }
}

function saveDB(){ localStorage.setItem('facedoor_db', JSON.stringify(labeledDescriptors.map(ld=>({label:ld.label, descriptors: ld.descriptors.map(d=>Array.from(d))})))); }
function loadDB(){
  const raw = localStorage.getItem('facedoor_db');
  if(!raw) return;
  const arr = JSON.parse(raw);
  labeledDescriptors = arr.map(item=>({label:item.label, descriptors: item.descriptors.map(d=>new Float32Array(d))}));
  try{ faceMatcher = new faceapi.FaceMatcher(labeledDescriptors.map(ld=>new faceapi.LabeledFaceDescriptors(ld.label, ld.descriptors)), parseFloat(confRange.value)); }
  catch(e){ writeLog('Erro ao criar faceMatcher: '+e.message); }
  writeLog('DB carregada: '+labeledDescriptors.length+' labels');
}

async function enroll(){
  writeLog('Cadastro: aproxime o rosto e confirme');
  const label = prompt('Nome para cadastro:');
  if(!label) { writeLog('Cadastro cancelado'); return; }
  const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
  if(!detection){ writeLog('Nenhum rosto detectado'); return; }
  labeledDescriptors.push({label, descriptors:[detection.descriptor]});
  saveDB();
  loadDB();
  writeLog('Rosto cadastrado: '+label);
}

enrollBtn.onclick = enroll;
clearDbBtn.onclick = ()=>{ if(confirm('Limpar banco de rostos?')){ localStorage.removeItem('facedoor_db'); labeledDescriptors=[]; faceMatcher=null; writeLog('DB limpa.'); }}

connectBtn.onclick = ()=>{
  espHost = document.getElementById('espHost').value || '192.168.4.1';
  espPort = parseInt(document.getElementById('espPort').value) || 81;
  protocol = document.getElementById('protocolSelect').value;
  if(protocol === 'ws' || protocol === 'auto') openWebSocket();
  else connStatus.textContent = 'Usando HTTP GET';
}

function openWebSocket(){
  if(ws){ ws.close(); ws = null; }
  const url = `ws://${espHost}:${espPort}`;
  writeLog('Tentando WS em '+url);
  try{
    ws = new WebSocket(url);
    ws.onopen = ()=>{ connStatus.textContent='Conectado (WebSocket)'; writeLog('WS aberto'); }
    ws.onclose = ()=>{ connStatus.textContent='Desconectado'; writeLog('WS fechado'); if(protocol==='auto') connStatus.textContent='Desconectado (HTTP fallback disponível)'; }
    ws.onerror = (e)=>{ writeLog('Erro WS'); if(protocol==='auto') connStatus.textContent='Erro WS (HTTP fallback)'; }
    ws.onmessage = (m)=>{ writeLog('ESP: '+m.data); }
  }catch(e){ writeLog('WS exception: '+e.message); }
}

function sendCommand(cmd){
  if((protocol === 'ws' || protocol === 'auto') && ws && ws.readyState === WebSocket.OPEN){ ws.send(cmd); writeLog('Enviado (ws): '+cmd); return; }
  const url = `http://${espHost}:${espPort}/?cmd=${encodeURIComponent(cmd)}`;
  fetch(url).then(r=>r.text()).then(t=>writeLog('Resposta HTTP: '+t)).catch(e=>writeLog('Erro HTTP: '+e.message));
  writeLog('Enviado (http): '+cmd);
}

async function onPlay(){
  if(video.paused || video.ended) return setTimeout(()=>onPlay(), 200);
  const options = new faceapi.TinyFaceDetectorOptions();
  const detections = await faceapi.detectAllFaces(video, options).withFaceLandmarks().withFaceDescriptors();
  const ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.font = '14px sans-serif';

  if(detections.length > 0 && faceMatcher){
    const results = detections.map(d => faceMatcher.findBestMatch(d.descriptor));
    results.forEach((res,i)=>{
      const box = detections[i].detection.box;
      const text = `${res.toString()}`;
      const score = parseFloat(res.distance);
      ctx.strokeStyle = score <= parseFloat(confRange.value) ? '#0f0' : '#f00';
      ctx.lineWidth = 2; ctx.strokeRect(box.x, box.y, box.width, box.height);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(box.x, box.y - 20, box.width, 18);
      ctx.fillStyle = '#fff'; ctx.fillText(text, box.x + 4, box.y - 6);
      if(score <= parseFloat(confRange.value)){
        writeLog('Reconhecido: '+res.label+' (dist='+score.toFixed(3)+')');
        if(document.getElementById('autoOpen').checked){ sendCommand('OPEN'); }
      }
    });
  }
  requestAnimationFrame(onPlay);
}

(async function init(){
  await loadModels();
  await startVideo();
  loadDB();
  video.addEventListener('play', onPlay);

  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./service-worker.js').then(()=>console.log('SW registrado')).catch(()=>console.warn('SW falhou'));
  }

  // PWA install prompt handling
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e)=>{
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
    installBtn.onclick = async ()=>{
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      writeLog('Instalar: '+choice.outcome);
      installBtn.hidden = true;
      deferredPrompt = null;
    };
  });
})();
