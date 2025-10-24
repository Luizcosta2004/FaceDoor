// app.js - FaceDoor PWA (face-api.js)
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const status = document.getElementById('status');
const events = document.getElementById('events');
const btnEnroll = document.getElementById('btnEnroll');
const btnRecognize = document.getElementById('btnRecognize');
const btnStop = document.getElementById('btnStop');
const inputName = document.getElementById('inputName');
const inputHost = document.getElementById('inputHost');
const inputPort = document.getElementById('inputPort');
const inputToken = document.getElementById('inputToken');
const selectCmd = document.getElementById('selectCmd');
const useHttps = document.getElementById('useHttps');
const inputThreshold = document.getElementById('inputThreshold');
const inputMaxSamples = document.getElementById('inputMaxSamples');

let isStreaming = false;
let labeledDescriptors = {}; // {name: [Float32Array,...]}
let modelsLoaded = false;
let recognizeLoop = false;

function logEvent(msg){ const d=document.createElement('div'); d.textContent=(new Date()).toLocaleTimeString()+' - '+msg; events.prepend(d); }

async function ensureModels(){
  if(modelsLoaded) return;
  status.textContent='Status: carregando modelos...';
  const modelBase = '/models';
  await faceapi.nets.tinyFaceDetector.loadFromUri(modelBase);
  await faceapi.nets.faceLandmark68Net.loadFromUri(modelBase);
  await faceapi.nets.faceRecognitionNet.loadFromUri(modelBase);
  modelsLoaded = true;
  status.textContent='Status: modelos carregados';
  logEvent('Modelos carregados');
}

async function startCamera(){
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio:false });
    video.srcObject = stream;
    await video.play();
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
    isStreaming = true;
    logEvent('Camera iniciada');
  }catch(e){
    console.error(e); status.textContent='Erro ao abrir câmera: '+e.message;
  }
}

async function stopCamera(){
  if(video.srcObject){
    video.srcObject.getTracks().forEach(t=>t.stop());
    video.srcObject = null;
  }
  isStreaming=false; overlay.getContext('2d').clearRect(0,0,overlay.width,overlay.height);
  logEvent('Camera parada');
}

async function enrollUser(name, samples){
  await ensureModels();
  if(!isStreaming) await startCamera();
  status.textContent='Status: capturando amostras para '+name;
  let saved = 0;
  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
  while(saved < samples){
    const detections = await faceapi.detectSingleFace(video, opts).withFaceLandmarks().withFaceDescriptor();
    if(detections && detections.descriptor){
      if(!(name in labeledDescriptors)) labeledDescriptors[name]=[];
      labeledDescriptors[name].push(detections.descriptor);
      saved++;
      logEvent('Amostra salva '+saved+'/'+samples);
    }
    await new Promise(r=>setTimeout(r,300));
  }
  status.textContent='Status: enrolamento concluído para '+name;
  logEvent('Enroll concluído: '+name);
}

function distance(d1,d2){
  let s=0; for(let i=0;i<d1.length;i++){ const v=d1[i]-d2[i]; s+=v*v; } return Math.sqrt(s);
}

function findBestMatch(descriptor){
  let best = { name:null, dist:999 };
  for(const name in labeledDescriptors){
    for(const desc of labeledDescriptors[name]){
      const d = distance(descriptor, desc);
      if(d < best.dist) best = { name, dist: d };
    }
  }
  return best;
}

async function recognizeOnce(){
  if(!modelsLoaded) await ensureModels();
  if(!isStreaming) await startCamera();
  status.textContent='Status: reconhecendo...';
  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize:224, scoreThreshold:0.5 });
  const detection = await faceapi.detectSingleFace(video, opts).withFaceLandmarks().withFaceDescriptor();
  ctx.clearRect(0,0,overlay.width,overlay.height);
  if(detection){
    const box = detection.detection.box;
    ctx.strokeStyle='#0f0'; ctx.lineWidth=2;
    ctx.strokeRect(box.x, box.y, box.width, box.height);
    const best = findBestMatch(detection.descriptor);
    const threshold = parseFloat(inputThreshold.value) || 0.6;
    if(best.name && best.dist < threshold){
      logEvent('Reconhecido: '+best.name+' (dist='+best.dist.toFixed(3)+')');
      status.textContent='Status: reconhecido '+best.name;
      await sendCmdToEsp();
      return best.name;
    } else {
      logEvent('Não reconhecido (melhor: '+(best.name||'n/a')+', dist='+best.dist.toFixed(3)+')');
      status.textContent='Status: não reconhecido';
      return null;
    }
  } else {
    status.textContent='Status: nenhuma face detectada';
    return null;
  }
}

async function sendCmdToEsp(){
  try{
    const host = inputHost.value.trim();
    const port = inputPort.value.trim();
    const cmd = selectCmd.value;
    const token = inputToken.value.trim();
    const protocol = useHttps.checked ? 'https' : 'http';
    let url = `${protocol}://${host}:${port}${cmd}`;
    if(token) url += '?token='+encodeURIComponent(token);
    logEvent('Enviando comando GET -> '+url);
    const controller = new AbortController();
    const id = setTimeout(()=>controller.abort(), 6000);
    const res = await fetch(url, { method:'GET', signal: controller.signal });
    clearTimeout(id);
    const text = await res.text();
    logEvent('Resposta ESP: '+res.status+' '+text);
    status.textContent='Status: comando enviado';
  }catch(e){
    console.error(e);
    logEvent('Erro enviando comando: '+e.message);
    status.textContent='Status: erro enviar comando';
  }
}

async function startRecognizeLoop(){
  recognizeLoop = true;
  while(recognizeLoop){
    await recognizeOnce();
    await new Promise(r=>setTimeout(r,800));
  }
}

btnEnroll.addEventListener('click', async ()=>{
  const name = inputName.value.trim() || 'usuario1';
  const max = parseInt(inputMaxSamples.value)||8;
  await enrollUser(name, max);
});

btnRecognize.addEventListener('click', async ()=>{
  if(!recognizeLoop){
    startRecognizeLoop();
    btnRecognize.textContent='Stop Recognize';
  } else {
    recognizeLoop=false; btnRecognize.textContent='Recognize';
  }
});

btnStop.addEventListener('click', async ()=>{
  recognizeLoop=false;
  await stopCamera();
  btnRecognize.textContent='Recognize';
});

(async ()=>{
  try{
    status.textContent='Status: iniciando...';
    await ensureModels();
    await startCamera();
    status.textContent='Status: pronto';
  }catch(e){ console.error(e); status.textContent='Erro: '+e.message; }
})();
