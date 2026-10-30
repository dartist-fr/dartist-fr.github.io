(() => {
'use strict';
const $ = id => document.getElementById(id);
const safeText = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const readQrTheme = () => {
  const ids=['qrFg','qrBg','qrFg2','qrEye','qrEyeCenter','qrGradient','qrGradientType','qrTransparent','qrBodyShape','qrEyeFrameShape','qrEyeCenterShape','qrEcc','qrFrame','qrSize','qrMargin','qrLogoSize','qrCaption','qrCaptionText'];
  return Object.fromEntries(ids.map(id=>[id,$(id)?.type==='checkbox'?$(id).checked:$(id)?.value]).filter(x=>x[1]!==undefined));
};
const applyQrTheme = theme => {
  for(const [id,value] of Object.entries(theme||{})){const el=$(id);if(!el)continue;if(el.type==='checkbox')el.checked=!!value;else el.value=String(value)}
  ['qrGradientFields','qrCaptionField'].forEach((id,i)=>$(id)?.classList.toggle('hidden',!$(i?'qrCaption':'qrGradient')?.checked));
  ['qrLogoSize','qrMargin'].forEach(id=>{const o=$(id+'Value');if(o)o.textContent=$(id).value+'%'});
  $('qrGenerate')?.click();
};
const themeKey='dartist.qr.themes.v1';
const loadThemes=()=>{try{return JSON.parse(localStorage.getItem(themeKey)||'[]')}catch{return[]}};
const saveThemes=items=>localStorage.setItem(themeKey,JSON.stringify(items));
function renderThemes(){
  const host=$('qrThemeList');if(!host)return;const items=loadThemes();host.innerHTML='';
  if(!items.length){host.textContent='Aucun thème enregistré pour le moment.';return}
  items.forEach((item,index)=>{const row=document.createElement('div');row.className='qr-batch-item';const info=document.createElement('div'),title=document.createElement('strong'),sub=document.createElement('small'),actions=document.createElement('div'),use=document.createElement('button'),del=document.createElement('button');title.textContent=item.name;sub.textContent='Thème local';info.append(title,sub);use.className='btn small';use.textContent='Appliquer';use.addEventListener('click',()=>applyQrTheme(item.settings));del.className='btn small';del.textContent='Supprimer';del.addEventListener('click',()=>{const next=loadThemes();next.splice(index,1);saveThemes(next);renderThemes()});actions.append(use,del);row.append(info,actions);host.append(row)});
}
const init = () => {
 if (!$('qrThemeSave')) {
   const observer = new MutationObserver(() => { if ($('qrThemeSave')) { observer.disconnect(); init(); } });
   observer.observe(document.body, { childList: true, subtree: true });
   return;
 }
$('qrThemeSave')?.addEventListener('click',()=>{const name=$('qrThemeName').value.trim();if(!name){$('qrThemeStatus').textContent='Donne un nom à ton thème.';return}const items=loadThemes();items.push({name,settings:readQrTheme()});saveThemes(items);$('qrThemeStatus').textContent='Thème enregistré sur cet appareil.';renderThemes()});
$('qrThemeExport')?.addEventListener('click',()=>{const blob=new Blob([JSON.stringify(loadThemes(),null,2)],{type:'application/json'});downloadBlob(blob,'dartist-qr-themes.json')});
$('qrThemeImportFile')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text());if(!Array.isArray(data)||data.some(x=>!x.name||!x.settings||typeof x.settings!=='object'))throw Error('Structure de fichier incorrecte');saveThemes([...loadThemes(),...data.slice(0,100)]);$('qrThemeStatus').textContent=data.length+' thème(s) importé(s).';renderThemes()}catch(err){$('qrThemeStatus').textContent='Import impossible : '+err.message}e.target.value=''});
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function currentQrCanvas(){return $('qrBox')?.querySelector('canvas')||null}
$('qrEmbedGenerate')?.addEventListener('click',()=>{const canvas=currentQrCanvas();if(!canvas){$('qrEmbedOutput').value='Génère d’abord un QR code.';return}const alt=$('qrEmbedAlt').value||'QR code';$('qrEmbedOutput').value='<img alt="'+alt.replace(/["&<>]/g,'')+'" src="'+canvas.toDataURL('image/png')+'" style="max-width:100%;height:auto">';});
$('qrEmbedCopy')?.addEventListener('click',async()=>{const value=$('qrEmbedOutput').value;if(!value)return;try{await navigator.clipboard.writeText(value);$('qrThemeStatus').textContent='Code HTML copié.'}catch{$('qrEmbedOutput').select();$('qrThemeStatus').textContent='Sélectionne le code puis copie-le.'}});
let cameraStream=null,cameraTimer=null;
const stopCamera=()=>{if(cameraTimer)cancelAnimationFrame(cameraTimer);cameraTimer=null;if(cameraStream)cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;if($('qrCameraVideo')){$('qrCameraVideo').pause();$('qrCameraVideo').srcObject=null;$('qrCameraVideo').classList.add('hidden')}if($('qrCameraStart'))$('qrCameraStart').disabled=false;if($('qrCameraStop'))$('qrCameraStop').disabled=true};
$('qrCameraStop')?.addEventListener('click',stopCamera);
$('qrCameraStart')?.addEventListener('click',async()=>{
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw Error('Caméra indisponible : ouvre cette page en HTTPS sur un navigateur compatible.');
    stopCamera();cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    const video=$('qrCameraVideo');video.srcObject=cameraStream;video.classList.remove('hidden');await video.play();$('qrCameraStart').disabled=true;$('qrCameraStop').disabled=false;
    const detector=('BarcodeDetector'in window)?new BarcodeDetector({formats:['qr_code']}):null;
    const scan=()=>{
      if(!cameraStream)return;
      if(detector&&video.readyState>=2){detector.detect(video).then(codes=>{if(codes.length){$('qrScanResult').value=codes[0].rawValue;$('qrScanCopy').disabled=false;$('qrScanOpen').disabled=!/^https?:\/\//i.test(codes[0].rawValue);$('qrCameraStatus').textContent='QR détecté. Vérifie le contenu avant toute ouverture.'}}).catch(()=>{})}
      else if(window.jsQR&&video.readyState>=2){const c=document.createElement('canvas');c.width=video.videoWidth;c.height=video.videoHeight;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(video,0,0);const code=jsQR(ctx.getImageData(0,0,c.width,c.height).data,c.width,c.height);if(code){$('qrScanResult').value=code.data;$('qrScanCopy').disabled=false;$('qrScanOpen').disabled=!/^https?:\/\//i.test(code.data);$('qrCameraStatus').textContent='QR détecté. Vérifie le contenu avant toute ouverture.'}}
      cameraTimer=requestAnimationFrame(scan);
    };scan();$('qrCameraStatus').textContent='Caméra active. Présente un QR code devant l’objectif.';
  }catch(err){stopCamera();$('qrCameraStatus').textContent='Impossible de démarrer la caméra : '+err.message}
});
window.addEventListener('pagehide',stopCamera);
async function loadImageFile(file){
  if(!file||!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>15*1024*1024)throw Error('Choisis une image PNG, JPG ou WebP de moins de 15 Mo.');
  const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();URL.revokeObjectURL(url);return img}catch(e){URL.revokeObjectURL(url);throw e}
}
let multiResults=[];
function scanQrTiles(canvas){
 const ctx=canvas.getContext('2d',{willReadFrequently:true}),w=canvas.width,h=canvas.height,found=[];
 const add=(code,ox,oy)=>{
  if(!code?.data)return;
  const loc=code.location||{},points=['topLeftCorner','topRightCorner','bottomLeftCorner','bottomRightCorner'].map(k=>loc[k]).filter(Boolean);
  const cx=points.length?points.reduce((v,p)=>v+p.x,0)/points.length+ox:ox;
  const cy=points.length?points.reduce((v,p)=>v+p.y,0)/points.length+oy:oy;
  const duplicate=found.some(item=>item.data===code.data&&Math.hypot(item.x-cx,item.y-cy)<Math.max(24,Math.min(w,h)*.08));
  if(!duplicate)found.push({data:code.data,x:cx,y:cy});
 };
 const scan=(x,y,rw,rh)=>{
  if(rw<80||rh<80)return;
  const pixels=ctx.getImageData(Math.round(x),Math.round(y),Math.round(rw),Math.round(rh));
  const code=jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:'attemptBoth'});
  if(code)add(code,x,y);
 };
 scan(0,0,w,h);
 for(const ratio of [.72,.48]){
  const tw=Math.round(w*ratio),th=Math.round(h*ratio);
  const xs=[0,Math.round((w-tw)/2),w-tw],ys=[0,Math.round((h-th)/2),h-th];
  for(const y of [...new Set(ys)])for(const x of [...new Set(xs)])scan(x,y,tw,th);
  if(found.length>=30)break;
 }
 return found.slice(0,30);
}
function csvCell(value){return '"'+String(value??'').replace(/"/g,'""')+'"'}
$('qrMultiImage')?.addEventListener('change',async e=>{
 const host=$('qrMultiResults'),copy=$('qrMultiCopyAll'),csv=$('qrMultiCsv');multiResults=[];copy.disabled=true;csv.disabled=true;
 try{
  const img=await loadImageFile(e.target.files?.[0]),canvas=document.createElement('canvas');
  const scale=Math.min(1,2600/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,canvas.width,canvas.height);
  if('BarcodeDetector'in window){
   try{const detector=new BarcodeDetector({formats:['qr_code']});const codes=await detector.detect(canvas);multiResults=codes.map(c=>({data:c.rawValue,x:0,y:0})).filter(c=>c.data).slice(0,30)}catch{}
  }
  if(!multiResults.length&&window.jsQR)multiResults=scanQrTiles(canvas);
  host.innerHTML='';
  if(!multiResults.length){host.textContent='Aucun QR code détecté. Essaie une image plus nette, mieux éclairée ou recadrée.';return}
  multiResults.forEach((item,i)=>{
   const row=document.createElement('div');row.className='qr-batch-item';
   const info=document.createElement('div'),title=document.createElement('strong'),value=document.createElement('small');
   title.textContent='QR '+(i+1);value.textContent=item.data;info.append(title,value);
   const button=document.createElement('button');button.className='btn small';button.type='button';button.textContent='Copier';button.addEventListener('click',()=>navigator.clipboard?.writeText(item.data));
   row.append(info,button);host.append(row);
  });
  copy.disabled=false;csv.disabled=false;
  $('qrMultiStatus').textContent=multiResults.length+' QR code(s) extrait(s)'+(multiResults.some(x=>x.x||x.y)?' avec recherche par zones.':' avec le lecteur natif du navigateur.');
 }catch(err){host.textContent=err.message;$('qrMultiStatus').textContent='';}
 finally{e.target.value=''}
});
$('qrMultiCopyAll')?.addEventListener('click',async()=>{if(!multiResults.length)return;try{await navigator.clipboard.writeText(multiResults.map(x=>x.data).join('\n'));$('qrMultiStatus').textContent='Tous les contenus ont été copiés.'}catch{$('qrMultiStatus').textContent='Copie non autorisée par le navigateur.'}});
$('qrMultiCsv')?.addEventListener('click',()=>{if(!multiResults.length)return;const rows=[['numero','contenu'],...multiResults.map((x,i)=>[i+1,x.data])];const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});downloadBlob(blob,'dartist-qr-extraits.csv')});
$('qrAuditImage')?.addEventListener('change',async e=>{
 const host=$('qrAuditResult');try{const img=await loadImageFile(e.target.files?.[0]);const canvas=document.createElement('canvas');const scale=Math.min(1,2200/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,canvas.width,canvas.height);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;let min=255,max=0,sum=0,count=0;for(let i=0;i<data.length;i+=16){const lum=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];min=Math.min(min,lum);max=Math.max(max,lum);sum+=lum;count++}
 let decoded=false,content='';if('BarcodeDetector'in window){const detector=new BarcodeDetector({formats:['qr_code']});const codes=await detector.detect(canvas);decoded=codes.length>0;content=codes[0]?.rawValue||''}else if(window.jsQR){const d=ctx.getImageData(0,0,canvas.width,canvas.height),code=jsQR(d.data,d.width,d.height,{inversionAttempts:'attemptBoth'});decoded=!!code;content=code?.data||''}
 const contrast=max-min;const items=[['Dimensions',img.naturalWidth+' × '+img.naturalHeight+' px'],['Décodage',decoded?'QR lisible par ce navigateur':'Aucun QR décodable détecté'],['Contraste global',contrast>=120?'Étendue de luminance élevée':contrast>=70?'Contraste intermédiaire':'Contraste global faible'],['Dynamique lumineuse',Math.round(contrast)+'/255'],['Contenu',content||'Non détecté']];host.innerHTML=items.map(([k,v])=>'<p><strong>'+safeText(k)+' :</strong> '+safeText(v)+'</p>').join('')+'<p class="hint">Limite : ce contrôle mesure le contraste global de l’image, pas le contraste exact de chaque module ni la marge de silence. Il ne remplace pas un scan sur téléphone.</p>';
 }catch(err){host.textContent=err.message}finally{e.target.value=''}
});
renderThemes();
};
init();
})();