/* Responsive canvas + full-site theme + actions */
(function(){
 const root=document.documentElement,toggle=document.getElementById('themeToggle'),shell=document.getElementById('canvasShell'),canvas=document.getElementById('canvas'),resetBtn=document.getElementById('resetTool'),pdfBtn=document.getElementById('savePdf'),themeMeta=document.getElementById('themeColorMeta');
 const BASE_W=935,BASE_H=819;
 const logo=document.querySelector('.brand-logo');
 function systemDark(){return window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches}
 function effectiveTheme(){return root.dataset.theme||(systemDark()?'dark':'light')}
 function updateToggle(){const dark=effectiveTheme()==='dark';const icon=document.getElementById('themeIcon');if(icon)icon.textContent=dark?'☀':'☾';toggle.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');toggle.setAttribute('aria-pressed',dark?'true':'false');if(themeMeta)themeMeta.content=dark?'#0B111A':'#f0f4f8'}
 try{const saved=localStorage.getItem('ap-theme');root.dataset.theme=(saved==='light')?'light':'dark'}catch(e){root.dataset.theme='dark'}
 updateToggle();toggle.addEventListener('click',()=>{const next=effectiveTheme()==='dark'?'light':'dark';root.dataset.theme=next;try{localStorage.setItem('ap-theme',next)}catch(e){}updateToggle()});
 if(window.matchMedia){const mq=window.matchMedia('(prefers-color-scheme: dark)');if(mq.addEventListener)mq.addEventListener('change',()=>{if(!root.dataset.theme)updateToggle()})}
 function fitCanvas(){const available=shell.clientWidth||BASE_W,scale=Math.min(1,available/BASE_W);if(!window.matchMedia('print').matches){canvas.style.transform='scale('+scale+')';shell.style.height=(BASE_H*scale)+'px'}}
 fitCanvas();window.addEventListener('resize',fitCanvas,{passive:true});window.addEventListener('afterprint',fitCanvas);if('ResizeObserver'in window)new ResizeObserver(fitCanvas).observe(shell);
 resetBtn.addEventListener('click',()=>{const size=document.getElementById('size'),rating=document.getElementById('rating'),job=document.getElementById('jobNote');if(size){size.selectedIndex=0;size.dispatchEvent(new Event('change',{bubbles:true}));if(rating){rating.selectedIndex=0;rating.dispatchEvent(new Event('change',{bubbles:true}))}}if(job)job.value='';document.querySelectorAll('.val.dim-active').forEach(el=>el.classList.remove('dim-active'));const ds=document.getElementById('dimStatus');if(ds){ds.classList.remove('show');ds.textContent=''}});
 function loadScript(src,check){return new Promise((resolve,reject)=>{if(check())return resolve();const existing=[...document.scripts].find(x=>x.src===src);if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return}const sc=document.createElement('script');sc.src=src;sc.async=true;sc.onload=resolve;sc.onerror=reject;document.head.appendChild(sc)})}
 function pdfFileName(){const size=document.getElementById('size')?.value||'flange',rating=document.getElementById('rating')?.value||'',job=document.getElementById('jobNote')?.value.trim()||'';const cleanSize=size.replace(/"/g,'').replace(/\s+/g,'-').replace(/\//g,'-').replace(/[^0-9A-Za-z.-]/g,'');const cleanRating=String(rating).replace(/[^0-9]/g,'');const cleanJob=job.replace(/[^0-9A-Za-z]+/g,'-').replace(/^-+|-+$/g,'').slice(0,28);if(cleanJob)return cleanJob+'.pdf';const _d=new Date();return _d.getFullYear()+'-'+String(_d.getMonth()+1).padStart(2,'0')+'-'+String(_d.getDate()).padStart(2,'0')+'.pdf'}
 async function downloadPdf(){const originalTheme=root.dataset.theme||'',oldText=pdfBtn.innerHTML;pdfBtn.disabled=true;pdfBtn.textContent='Preparing PDF…';try{await Promise.all([loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',()=>!!window.html2canvas),loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',()=>!!(window.jspdf&&window.jspdf.jsPDF))]);root.dataset.theme='light';document.documentElement.classList.add('pdf-exporting');document.body.classList.add('pdf-exporting');const gd=document.getElementById('pdfGeneratedDate');if(gd)gd.textContent=new Date().toLocaleDateString('en-CA',{year:'numeric',month:'short',day:'2-digit'});const hdr=document.querySelector('header,.site-header');if(hdr)hdr.style.display='none';document.documentElement.style.minHeight='0';document.body.style.minHeight='0';const wm=document.querySelector('.print-watermark');if(wm)wm.style.cssText='display:block!important;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:52pt;font-weight:900;color:#000;opacity:.055;white-space:nowrap;pointer-events:none;z-index:9999;font-family:Arial,sans-serif;letter-spacing:.08em;text-align:center;line-height:1.3';await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const captureEl=document.querySelector('.main')||document.querySelector('.tool-card')||document.body;const shot=await window.html2canvas(captureEl,{scale:1.6,useCORS:true,backgroundColor:'#ffffff',logging:false,scrollX:0,scrollY:0});if(wm)wm.style.cssText='';document.documentElement.style.minHeight='';document.body.style.minHeight='';if(hdr)hdr.style.display='';const {jsPDF}=window.jspdf;const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'letter',compress:true});const pw=pdf.internal.pageSize.getWidth(),ph=pdf.internal.pageSize.getHeight(),margin=5,maxW=pw-margin*2,maxH=ph-margin*2,ratio=Math.min(maxW/shot.width,maxH/shot.height),w=shot.width*ratio,h=shot.height*ratio,x=(pw-w)/2,y=(ph-h)/2;pdf.addImage(shot.toDataURL('image/jpeg',0.94),'JPEG',x,y,w,h,undefined,'FAST');pdf.setProperties({title:'Flange Slide Rule — API 6A',subject:'Selected API 6A flange dimensions',author:'Anjan Patel',creator:'app.anjanpatel.ca'});const dateStamp=new Date().toLocaleDateString('en-CA',{year:'numeric',month:'short',day:'2-digit'});pdf.setFontSize(6.5);pdf.setTextColor(150,150,150);pdf.text('Generated '+dateStamp,pw-margin,ph-margin,{align:'right'});pdf.save(pdfFileName())}catch(err){console.error(err);alert('PDF download could not be generated. In single-file mode, an internet connection is required to load the PDF engine the first time this page is opened.')}finally{document.documentElement.classList.remove('pdf-exporting');document.body.classList.remove('pdf-exporting');if(originalTheme)root.dataset.theme=originalTheme;else delete root.dataset.theme;updateToggle();pdfBtn.disabled=false;pdfBtn.innerHTML=oldText;fitCanvas()}}
 pdfBtn.addEventListener('click',downloadPdf);
 document.getElementById('printBtn').addEventListener('click',function(){window.print()});
 window.addEventListener('beforeprint',function(){var gd=document.getElementById('pdfGeneratedDate');if(gd)gd.textContent=new Date().toLocaleDateString('en-CA',{year:'numeric',month:'short',day:'2-digit'})});
 const cy=new Date().getFullYear(),yr=cy>2026?'2026–'+cy:'2026';['copyrightYear','termsYear','privacyYear'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=yr;});(function(){var c=document.getElementById('privacyContact');if(c){var e='support'+'@'+'app'+'.'+'anjanpatel'+'.'+'ca';c.href='mailto:'+e;c.textContent=e;}})();
 function openModal(id){const overlay=document.getElementById(id);if(!overlay)return;overlay.classList.add('open');const firstFocusable=overlay.querySelector('button,[tabindex]:not([tabindex="-1"]),a,input,select,textarea');if(firstFocusable)setTimeout(()=>firstFocusable.focus(),50);} function closeModal(id){const overlay=document.getElementById(id);if(!overlay)return;overlay.classList.remove('open');} document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal-overlay.open').forEach(m=>closeModal(m.id));if(e.key==='Tab'){const open=document.querySelector('.modal-overlay.open');if(!open)return;const focusable=[...open.querySelectorAll('button,[tabindex]:not([tabindex="-1"]),a,input,select,textarea')];if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey){if(document.activeElement===first){e.preventDefault();last.focus()}}else{if(document.activeElement===last){e.preventDefault();first.focus()}}}});
 const offlineBadge=document.getElementById('offlineBadge'),offlineText=document.getElementById('offlineText');
 function updateOnlineState(){const off=!navigator.onLine;if(offlineBadge)offlineBadge.classList.toggle('offline',off);if(offlineText)offlineText.textContent=off?'Offline — page already open':'Standalone'}
 window.addEventListener('online',updateOnlineState);window.addEventListener('offline',updateOnlineState);updateOnlineState(); const fsBtn=document.getElementById('fsBtn');if(fsBtn){fsBtn.addEventListener('click',()=>{const s=document.getElementById('canvasShell');if(!s)return;if(s.classList.contains('drawing-fullscreen')){s.classList.remove('drawing-fullscreen');fsBtn.textContent='⛶ Full screen';fsBtn.setAttribute('aria-label','View drawing full screen');document.body.style.overflow='';}else{s.classList.add('drawing-fullscreen');fsBtn.textContent='✕ Close';fsBtn.setAttribute('aria-label','Close full screen drawing');document.body.style.overflow='hidden';s.scrollTo(0,0);}});} const mcards=document.querySelectorAll('.mc-card');mcards.forEach(card=>{card.addEventListener('click',()=>{const dimId=card.dataset.dim;const valEl=document.getElementById(dimId);const valSpan=card.querySelector('.mc-val');mcards.forEach(c=>c.classList.remove('mc-active'));card.classList.add('mc-active');if(valEl){valEl.click();}setTimeout(()=>card.classList.remove('mc-active'),1800);});card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();card.click();}});});
 const dimNames={v_od:'Outside diameter',v_rf:'Raised-face diameter',v_god:'Ring groove outside diameter',v_gpd:'Ring groove pitch diameter',v_gid:'Ring groove inside diameter',v_gw:'Ring groove width',v_gd:'Ring groove depth',v_max:'Chamfer / maximum',v_bore:'Bore diameter',v_hub:'Hub diameter',v_min:'Minimum hub dimension',v_radius:'Radius',v_studlen:'Stud length',v_holes:'Number of bolt holes',v_studdia:'Stud diameter',v_bc:'Bolt circle diameter'};
 const dimStatus=document.getElementById('dimStatus');
 document.querySelectorAll('.val').forEach(el=>{el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label',(dimNames[el.id]||'Dimension')+': '+el.textContent);const activate=()=>{document.querySelectorAll('.val.dim-active').forEach(x=>{if(x!==el)x.classList.remove('dim-active')});el.classList.toggle('dim-active');if(dimStatus){if(el.classList.contains('dim-active')){const lbl=(dimNames[el.id]||'Dimension')+' — '+el.textContent;dimStatus.textContent=lbl;dimStatus.classList.add('show');if(navigator.clipboard){const raw=el.textContent.replace(/"$/,'').replace(/ mm$/,'').trim();const dm=raw.match(/\(([^)]+)\)/);navigator.clipboard.writeText(dm?dm[1]:raw).catch(()=>{});dimStatus.textContent='Copied — '+lbl;setTimeout(()=>{if(dimStatus.classList.contains('show'))dimStatus.textContent=lbl},1500)}}else{dimStatus.classList.remove('show');dimStatus.textContent=''}}};el.addEventListener('click',activate);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate()}})});
})();



function toFrac(dec){
  if (dec === undefined) return '–';
  const whole = Math.floor(dec + 1e-6);
  let frac = dec - whole;
  if (frac < 1e-6) return whole ? String(whole) : '0';
  const denoms = [2,4,8,16,32];
  let best = {num:0, den:1, err:1};
  for (const d of denoms){
    const num = Math.round(frac * d);
    const err = Math.abs(frac - num/d);
    if (err < best.err - 1e-9){ best = {num, den:d, err}; }
  }
  if (best.num === 0) return whole ? String(whole) : '0';
  if (best.num === best.den) return String(whole+1);
  const g = gcd(best.num, best.den);
  const n = best.num/g, d = best.den/g;
  return (whole ? whole + ' ' : '') + n + '/' + d;
}
function gcd(a,b){ return b ? gcd(b, a % b) : a; }
function toFracDec(dec){
  if (dec === undefined) return '–';
  return toFrac(dec) + ' (' + dec.toFixed(3) + ')';
}
function toMM(dec){
  if (dec === undefined) return '–';
  // toFixed alone mis-rounds cases like 9.75in -> 247.65mm, since that
  // multiplication lands on 247.64999999999998 in floating point and
  // toFixed(1) rounds down instead of to 247.7. Nudging by Number.EPSILON
  // before rounding corrects that without changing any value meaningfully.
  const mm = dec * 25.4;
  return (Math.round((mm + Number.EPSILON) * 10) / 10).toFixed(1);
}

let metricMode = false;
function dispVal(dec){ return metricMode ? toMM(dec) : toFracDec(dec); }
function unitSuffix(){ return metricMode ? ' mm' : '"'; }

function set(id, val){ const el=document.getElementById(id); if(el) el.textContent=val; }
function setIn(id, val){ const el=document.getElementById(id); if(el) el.textContent=val+unitSuffix(); }

// "13 5/8" and "16 3/4" are deliberately absent — see the note above
// their old data block further down for why.
const sizes = ["2 1/16","2 9/16","3 1/8","4 1/16","5 1/8","7 1/16","9","11"];

const data = {
  "2 1/16": {
    "3000":  {bore:2.09, od:8.50,  rf:4.88, hub:4.12, bc:6.50,  n:8,  boltDia:0.875, boltHole:1.000, studLen:6.00,  chamfer:0.12, hubMin:4.31, ring:24},
    "5000":  {bore:2.09, od:8.50,  rf:4.88, hub:4.12, bc:6.50,  n:8,  boltDia:0.875, boltHole:1.000, studLen:6.00,  chamfer:0.12, hubMin:4.31, ring:24},
    "10000": {bore:2.09, od:11.00, rf:6.75, hub:6.00, bc:8.75,  n:8,  boltDia:1.250, boltHole:1.375, studLen:8.50,  chamfer:0.12, hubMin:5.44, ring:"BX-150"},
    "15000": {bore:2.09, od:12.44, rf:7.81, hub:7.06, bc:9.75,  n:8,  boltDia:1.500, boltHole:1.625, studLen:10.25, chamfer:0.12, hubMin:6.31, ring:"BX-150"},
  },
  "2 9/16": {
    "3000":  {bore:2.59, od:9.62,  rf:5.38, hub:4.88, bc:7.50,  n:8,  boltDia:1.000, boltHole:1.125, studLen:6.50,  chamfer:0.12, hubMin:4.44, ring:27},
    "5000":  {bore:2.59, od:9.62,  rf:5.38, hub:4.88, bc:7.50,  n:8,  boltDia:1.000, boltHole:1.125, studLen:6.50,  chamfer:0.12, hubMin:4.44, ring:27},
    "10000": {bore:2.59, od:12.25, rf:7.75, hub:7.25, bc:10.00, n:8,  boltDia:1.500, boltHole:1.625, studLen:10.25, chamfer:0.12, hubMin:6.44, ring:"BX-151"},
    "15000": {bore:2.59, od:13.25, rf:8.44, hub:8.12, bc:10.75, n:8,  boltDia:1.625, boltHole:1.750, studLen:11.00, chamfer:0.12, hubMin:7.13, ring:"BX-151"},
  },
  "3 1/8": {
    "3000":  {bore:3.22, od:9.50,  rf:6.12, hub:5.00, bc:7.50,  n:8,  boltDia:0.875, boltHole:1.000, studLen:6.00,  chamfer:0.12, hubMin:4.31, ring:31},
    "5000":  {bore:3.22, od:10.50, rf:6.62, hub:5.25, bc:8.00,  n:8,  boltDia:1.125, boltHole:1.250, studLen:7.25,  chamfer:0.12, hubMin:4.94, ring:35},
    "10000": {bore:3.22, od:14.50, rf:8.50, hub:8.50, bc:11.50, n:8,  boltDia:1.625, boltHole:1.750, studLen:11.50, chamfer:0.12, hubMin:7.38, ring:"BX-152"},
    "15000": {bore:3.22, od:15.75, rf:9.75, hub:9.75, bc:12.75, n:8,  boltDia:1.875, boltHole:2.000, studLen:13.25, chamfer:0.12, hubMin:8.63, ring:"BX-152"},
  },
  "4 1/16": {
    "3000":  {bore:4.28, od:11.50, rf:7.12, hub:6.25, bc:9.25,  n:8,  boltDia:1.125, boltHole:1.250, studLen:7.00,  chamfer:0.12, hubMin:4.81, ring:37},
    "5000":  {bore:4.28, od:12.25, rf:7.62, hub:6.38, bc:9.50,  n:8,  boltDia:1.250, boltHole:1.375, studLen:8.00,  chamfer:0.12, hubMin:5.19, ring:39},
    "10000": {bore:4.28, od:16.00, rf:10.00,hub:9.75, bc:13.00, n:12, boltDia:1.500, boltHole:1.625, studLen:11.00, chamfer:0.12, hubMin:8.50, ring:"BX-153"},
    "15000": {bore:4.28, od:18.75, rf:11.50,hub:11.25,bc:15.00, n:8,  boltDia:2.000, boltHole:2.125, studLen:14.50, chamfer:0.12, hubMin:10.00,ring:"BX-153"},
  },
  "5 1/8": {
    "3000":  {bore:5.16, od:13.75, rf:8.50, hub:7.50, bc:11.00, n:8,  boltDia:1.250, boltHole:1.375, studLen:7.75,  chamfer:0.12, hubMin:5.31, ring:41},
    "5000":  {bore:5.16, od:14.75, rf:9.00, hub:7.75, bc:11.50, n:8,  boltDia:1.500, boltHole:1.625, studLen:10.00, chamfer:0.12, hubMin:6.44, ring:44},
    "10000": {bore:5.16, od:20.00, rf:12.50,hub:12.00,bc:16.50, n:12, boltDia:1.875, boltHole:2.000, studLen:14.25, chamfer:0.12, hubMin:9.94, ring:"BX-154"},
    "15000": {bore:5.16, od:22.44, rf:14.19,hub:14.00,bc:18.50, n:8,  boltDia:2.250, boltHole:2.375, studLen:17.00, chamfer:0.12, hubMin:11.94,ring:"BX-154"},
  },
  "7 1/16": {
    "3000":  {bore:7.16, od:15.00, rf:9.50, hub:9.25, bc:12.50, n:12, boltDia:1.125, boltHole:1.250, studLen:8.00,  chamfer:0.25, hubMin:5.81, ring:45},
    "5000":  {bore:7.16, od:15.50, rf:9.75, hub:9.00, bc:12.50, n:12, boltDia:1.375, boltHole:1.500, studLen:10.75, chamfer:0.25, hubMin:7.13, ring:46},
    "10000": {bore:7.16, od:22.00, rf:15.00,hub:14.00,bc:18.50, n:12, boltDia:2.000, boltHole:2.125, studLen:16.00, chamfer:0.25, hubMin:12.06,ring:"BX-155"},
    "15000": {bore:7.16, od:25.81, rf:17.00,hub:17.12,bc:21.50, n:12, boltDia:2.375, boltHole:2.500, studLen:19.25, chamfer:0.25, hubMin:14.00,ring:"BX-155"},
  },
  "9": {
    "3000":  {bore:9.03, od:18.50, rf:12.12,hub:11.75,bc:15.50, n:12, boltDia:1.375, boltHole:1.500, studLen:9.00,  chamfer:0.25, hubMin:6.69, ring:49},
    "5000":  {bore:9.03, od:19.00, rf:12.50,hub:11.50,bc:15.50, n:12, boltDia:1.625, boltHole:1.750, studLen:12.00, chamfer:0.25, hubMin:8.81, ring:50},
    "10000": {bore:9.03, od:26.00, rf:18.00,hub:17.00,bc:22.00, n:16, boltDia:2.000, boltHole:2.125, studLen:17.00, chamfer:0.25, hubMin:13.56,ring:"BX-156"},
    "15000": {bore:9.03, od:32.69, rf:22.31,hub:21.62,bc:27.50, n:12, boltDia:3.000, boltHole:3.125, studLen:25.00, chamfer:0.25, hubMin:18.69,ring:"BX-156"},
  },
  "11": {
    "3000":  {bore:11.03,od:21.50, rf:14.25,hub:14.50,bc:18.50, n:16, boltDia:1.375, boltHole:1.500, studLen:9.50,  chamfer:0.25, hubMin:7.56, ring:53},
    "5000":  {bore:11.03,od:23.00, rf:14.63,hub:14.50,bc:19.00, n:12, boltDia:1.875, boltHole:2.000, studLen:13.75, chamfer:0.25, hubMin:10.44,ring:54},
    "10000": {bore:11.03,od:30.00, rf:21.00,hub:20.00,bc:25.25, n:16, boltDia:2.375, boltHole:2.500, studLen:20.00, chamfer:0.25, hubMin:16.13,ring:"BX-157"},
    "15000": {bore:11.03,od:38.75, rf:26.00,hub:26.50,bc:32.25, n:12, boltDia:3.500, boltHole:3.625, studLen:29.75, chamfer:0.25, hubMin:22.25,ring:"BX-157"},
  },
  // 13 5/8" and 16 3/4" REMOVED (2026-09-19) — a banner warning wasn't
  // enough; these still let someone read, save, and print numbers that
  // disagree with secondary sources at 3000 psi, and are very likely
  // 6BX rather than 6B at 5000 psi (see API 6A Annex I). Rather than
  // guess a fix from unverified secondary sources, they're gone
  // entirely until someone re-keys both ratings for both sizes from a
  // stamped API Spec 6A table — that needs a real source document,
  // not something to reconstruct from web lookups. To re-add: put the
  // corrected rows back here, add the two sizes back to the `sizes`
  // array above (keep them in ascending order), and add their radius
  // values back to the RADIUS map below.
};

const ring = {
  // R-type rings (API 6B flanges, 2 000 – 5 000 psi)
  24:{pd:3.750,  w:0.438, d:0.312},
  27:{pd:4.250,  w:0.438, d:0.312},
  31:{pd:4.844,  w:0.438, d:0.312},
  35:{pd:5.375,  w:0.469, d:0.344},
  37:{pd:5.875,  w:0.469, d:0.344},
  39:{pd:6.375,  w:0.500, d:0.375},
  41:{pd:7.125,  w:0.500, d:0.375},
  44:{pd:7.625,  w:0.531, d:0.406},
  45:{pd:8.313,  w:0.531, d:0.406},
  46:{pd:8.313,  w:0.562, d:0.422},
  49:{pd:10.625, w:0.594, d:0.453},
  50:{pd:10.625, w:0.625, d:0.469},
  53:{pd:12.750, w:0.656, d:0.500},
  54:{pd:12.750, w:0.688, d:0.531},
  // ⚠ R-57/58/65/66 — verify pitch diameters and groove dims vs. API Spec 6A Table 9
  57:{pd:15.188, w:0.719, d:0.547},
  58:{pd:15.188, w:0.750, d:0.562},
  65:{pd:18.500, w:0.813, d:0.625},
  66:{pd:18.500, w:0.844, d:0.641},
  // BX-type rings (API 6BX flanges, 10,000 and 15,000 psi)
  "BX-150":{pd:3.594,  w:0.469, d:0.406},
  "BX-151":{pd:4.094,  w:0.469, d:0.406},
  "BX-152":{pd:5.000,  w:0.500, d:0.438},
  "BX-153":{pd:6.375,  w:0.531, d:0.469},
  "BX-154":{pd:7.938,  w:0.594, d:0.531},
  "BX-155":{pd:10.688, w:0.656, d:0.594},
  "BX-156":{pd:13.063, w:0.719, d:0.656},
  "BX-157":{pd:15.563, w:0.781, d:0.719},
};

const RADIUS = {
  "2 1/16": 0.125, "2 9/16": 0.125, "3 1/8": 0.125,
  "4 1/16": 0.1875, "5 1/8": 0.1875,
  "7 1/16": 0.25, "9": 0.25, "11": 0.375
};

const sizeSel = document.getElementById('size');
const ratingSel = document.getElementById('rating');

sizes.forEach(s => {
  const opt = document.createElement('option');
  opt.value = s; opt.textContent = s + '"';
  sizeSel.appendChild(opt);
});

function refreshRatings(){
  const s = sizeSel.value;
  const avail = Object.keys(data[s]);
  ratingSel.innerHTML = '';
  avail.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r; opt.textContent = Number(r).toLocaleString() + ' psi';
    ratingSel.appendChild(opt);
  });
}

function render(){
  const s = sizeSel.value;
  const r = ratingSel.value;
  const d = data[s][r];
  if (!d) return;

  setIn('v_od', dispVal(d.od));
  setIn('v_rf', dispVal(d.rf));
  setIn('v_max', dispVal(d.chamfer));
  setIn('v_bore', dispVal(d.bore));
  setIn('v_hub', dispVal(d.hub));
  setIn('v_min', dispVal(d.hubMin));
  setIn('v_radius', dispVal(RADIUS[s]));
  setIn('v_studlen', dispVal(d.studLen));
  setIn('v_studdia', dispVal(d.boltDia));
  setIn('v_bc', dispVal(d.bc));
  
  set('v_holes', d.n);

  const rg = ring[d.ring];
  if(rg){
    setIn('v_gpd', dispVal(rg.pd));
    setIn('v_god', dispVal(rg.pd + rg.w));
    setIn('v_gid', dispVal(rg.pd - rg.w));
    setIn('v_gw', dispVal(rg.w));
    setIn('v_gd', dispVal(rg.d));
  }

  const isBX = typeof d.ring === 'string';
  const ringLabel = isBX ? d.ring : 'R-' + d.ring;
  document.getElementById('ringR').textContent = isBX ? d.ring : 'R-' + d.ring;
  document.getElementById('ringRX').textContent = isBX ? '—' : 'RX-' + d.ring;
  const note = document.getElementById('selectionNote');
  if(note) note.textContent = s + '" | ' + Number(r).toLocaleString() + ' psi | ' + ringLabel;
  const dimNames={v_od:'Outside diameter',v_rf:'Raised-face diameter',v_god:'Ring groove outside diameter',v_gpd:'Ring groove pitch diameter',v_gid:'Ring groove inside diameter',v_gw:'Ring groove width',v_gd:'Ring groove depth',v_max:'Chamfer / maximum',v_bore:'Bore diameter',v_hub:'Hub diameter',v_min:'Minimum hub dimension',v_radius:'Radius',v_studlen:'Stud length',v_holes:'Number of bolt holes',v_studdia:'Stud diameter',v_bc:'Bolt circle diameter'};
  document.querySelectorAll('.val').forEach(el=>el.setAttribute('aria-label',(dimNames[el.id]||'Dimension')+': '+el.textContent));
  // Sync mobile cards
  const mcMap={v_bore:'mc_bore',v_od:'mc_od',v_rf:'mc_rf',v_hub:'mc_hub',v_min:'mc_min',v_bc:'mc_bc',v_holes:'mc_holes',v_studdia:'mc_studdia',v_studlen:'mc_studlen',v_radius:'mc_radius',v_max:'mc_max'};
  Object.entries(mcMap).forEach(([vid,mcid])=>{
    const vEl=document.getElementById(vid),mEl=document.querySelector('#'+mcid+' .mc-val');
    if(vEl&&mEl)mEl.textContent=vEl.textContent||'–';
  });
  const mcRing=document.querySelector('#mc_ring .mc-val');
  if(mcRing){const rR=document.getElementById('ringR'),rRX=document.getElementById('ringRX');if(rR)mcRing.textContent=rR.textContent+(rRX?' / '+rRX.textContent:'');}
  // Auto-shrink font if value overflows its box
  document.querySelectorAll('.val').forEach(el=>{
    el.style.fontSize='';
    if(el.scrollWidth>el.clientWidth+1) el.style.fontSize='10px';
    if(el.scrollWidth>el.clientWidth+1) el.style.fontSize='9px';
  });
}

sizeSel.addEventListener('change', () => { refreshRatings(); render(); });
ratingSel.addEventListener('change', render);

const unitBtn = document.getElementById('unitToggle');
if(unitBtn){
  unitBtn.addEventListener('click', () => {
    metricMode = !metricMode;
    unitBtn.textContent = metricMode ? 'mm' : 'in';
    unitBtn.title = metricMode ? 'Switch to inches' : 'Switch to millimetres (mm)';
    unitBtn.classList.toggle('metric-active', metricMode);
    try{ localStorage.setItem('api6a-units', metricMode?'mm':'in'); }catch(e){}
    render();
  });
  try{ if(localStorage.getItem('api6a-units')==='mm'){ metricMode=true; unitBtn.textContent='mm'; unitBtn.classList.add('metric-active'); }}catch(e){}
}

refreshRatings();
render();

/* ── Mobile select sync ── */
(function(){
  var mobSz=document.getElementById('mobSizeSel');
  var mobRt=document.getElementById('mobRatingSel');
  if(!mobSz||!mobRt)return;
  // Populate size options
  Array.from(sizeSel.options).forEach(function(o){mobSz.appendChild(o.cloneNode(true))});
  mobSz.value=sizeSel.value;
  function syncMobRatings(){
    mobRt.innerHTML='';
    Array.from(ratingSel.options).forEach(function(o){mobRt.appendChild(o.cloneNode(true))});
    mobRt.value=ratingSel.value;
  }
  syncMobRatings();
  mobSz.addEventListener('change',function(){
    sizeSel.value=mobSz.value;
    sizeSel.dispatchEvent(new Event('change',{bubbles:true}));
    syncMobRatings();
  });
  mobRt.addEventListener('change',function(){
    ratingSel.value=mobRt.value;
    ratingSel.dispatchEvent(new Event('change',{bubbles:true}));
  });
  // Keep mobile selects in sync when canvas selects update
  sizeSel.addEventListener('change',syncMobRatings);
})();

/* ── Shareable URL ── */
(function(){
  /* Build URL from current tool state */
  function buildParams(){
    var p = new URLSearchParams();
    p.set('size', sizeSel.value);
    p.set('rating', ratingSel.value);
    if(metricMode) p.set('units','mm');
    return p;
  }

  /* Silently update address bar — no history entry, no reload */
  function syncURL(){
    try{
      history.replaceState(null,'', location.pathname + '?' + buildParams().toString());
    }catch(e){}
  }

  /* Apply URL params on first load */
  (function(){
    try{
      var p = new URLSearchParams(location.search);
      var ps = p.get('size');
      var pr = p.get('rating');
      var pu = p.get('units');
      var changed = false;
      if(ps && Array.from(sizeSel.options).some(function(o){return o.value===ps})){
        sizeSel.value = ps; refreshRatings(); changed = true;
      }
      if(pr && Array.from(ratingSel.options).some(function(o){return o.value===pr})){
        ratingSel.value = pr; changed = true;
      }
      if(pu==='mm' && !metricMode){
        metricMode = true;
        if(unitBtn){ unitBtn.textContent='mm'; unitBtn.classList.add('metric-active'); }
        changed = true;
      }
      if(changed) render();
    }catch(e){}
  })();

  /* Keep URL in sync with every selection change */
  sizeSel.addEventListener('change', syncURL);
  ratingSel.addEventListener('change', syncURL);
  if(unitBtn) unitBtn.addEventListener('click', syncURL);

  /* Share button — copy link to clipboard */
  var shareBtn = document.getElementById('shareBtn');
  if(shareBtn){
    var toast = document.createElement('span');
    toast.className = 'share-toast';
    toast.textContent = 'Link copied!';
    shareBtn.appendChild(toast);

    shareBtn.addEventListener('click', function(){
      syncURL();
      var url = location.href;
      function showCopied(){
        shareBtn.classList.add('copied');
        setTimeout(function(){ shareBtn.classList.remove('copied'); }, 2000);
      }
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(url).then(showCopied).catch(fallback);
      } else { fallback(); }
      function fallback(){
        try{
          var ta = document.createElement('textarea');
          ta.value = url; ta.style.position='fixed'; ta.style.opacity='0';
          document.body.appendChild(ta); ta.focus(); ta.select();
          document.execCommand('copy'); document.body.removeChild(ta);
          showCopied();
        }catch(e){}
      }
    });
  }
})();
