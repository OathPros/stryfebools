/* STRYFEBOOLS // sourced public-domain and CC0 art edition
   Cinematic interaction applied to real artists' existing works. No generated art. */
(() => {
'use strict';
const SCENES = [
  { title:"CINDER CITY", file:"https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e1/John_Martin_-_Sodom_and_Gomorrah.jpg/1280px-John_Martin_-_Sodom_and_Gomorrah.jpg", aspect:1.5686873 },
  { title:"FALLEN SPAN", file:"https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c3/Joseph_Mallord_William_Turner%2C_English_-_The_Burning_of_the_Houses_of_Lords_and_Commons%2C_October_16%2C_1834_-_Google_Art_Project.jpg/1280px-Joseph_Mallord_William_Turner%2C_English_-_The_Burning_of_the_Houses_of_Lords_and_Commons%2C_October_16%2C_1834_-_Google_Art_Project.jpg", aspect:1.3437026 },
  { title:"THE WITNESS", file:"https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e4/The_vague_glimmer_of_a_head_suspended_in_space_MET_DP824902.jpg/960px-The_vague_glimmer_of_a_head_suspended_in_space_MET_DP824902.jpg", aspect:0.7232756 },
  { title:"BLACKOUT", file:"https://upload.wikimedia.org/wikipedia/commons/8/8d/Philipp_Jakob_Loutherbourg_d._J._-_Coalbrookdale_by_Night_-_WGA13730.jpg", aspect:1.5675325 }
];
const $ = id => document.getElementById(id);
const hero = document.querySelector('.hero');
const canvas = $('world');
const fallback = document.querySelector('.hero-static');
const currentLabel = $('scene-title');
const currentIndex = $('scene-index');
const progressBar = $('smudge-progress');
const progressFill = $('smudge-fill');
const progressLabel = $('progress-label');
const progressNumber = $('progress-number');
const nextButton = $('next-button');
const motionButton = $('motion-button');
const motionState = $('motion-state');
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let motionOn = !prefersReduced;
let current = 0;
let next = 1;
let transitioning = false;
let transitionStart = 0;
let transitionValue = 0;
let dragging = false;
let lastPointer = null;
let pointer = {x:0.5,y:0.5};
let trail = [];
let coverage = 0;
const threshold = 0.215;
let visited = new Uint8Array(88*50);
const MASK_W = 512, MASK_H = 288;
const maskCanvas = document.createElement('canvas'); maskCanvas.width = MASK_W; maskCanvas.height = MASK_H;
const maskContext = maskCanvas.getContext('2d', { willReadFrequently:false });
maskContext.fillStyle = 'black';
maskContext.fillRect(0, 0, MASK_W, MASK_H);
let maskDirty = true;
let webglReady = false;
let gl, program, textures = [], maskTexture, uniforms = {}, startTime = performance.now(), previousFrame = 0;
let bleedSeeds = [];
let recentStamps = [];

const vert = `attribute vec2 aPosition;
varying vec2 vUv;
void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;

const frag = `precision highp float;
varying vec2 vUv;
uniform sampler2D uCurrent;
uniform sampler2D uNext;
uniform sampler2D uMask;
uniform vec2 uResolution;
uniform float uTime;
uniform float uTransition;
uniform float uProgress;
uniform float uScene;
uniform float uAspectCurrent;
uniform float uAspectNext;
uniform float uFocusCurrent;
uniform float uFocusNext;
uniform float uMirrorCurrent;
uniform float uMirrorNext;
uniform float uMotion;
uniform vec3 uTrail[12];
uniform float uTrailCount;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,amp=.53;for(int i=0;i<5;i++){v+=amp*noise(p);p=mat2(1.61,-1.15,1.15,1.61)*p;amp*=.5;}return v;}
vec2 cover(vec2 uv,float pictureAspect,float focusY,float mirrorX){float screenAspect=uResolution.x/uResolution.y;if(screenAspect>pictureAspect){uv.y=focusY+(uv.y-.5)*pictureAspect/screenAspect;}else{uv.x=.5+(uv.x-.5)*screenAspect/pictureAspect;}uv.x=mix(uv.x,1.-uv.x,mirrorX);return uv;}
void main(){
 vec2 uv=vUv;
 float t=uTime*.18*uMotion;
 float a=fbm(uv*3.2+vec2(t*.25,-t*.17));
 float b=fbm(uv*6.6+vec2(-t*.32,t*.11));
 vec2 warp=vec2(a-.48,b-.48)*(.016+.013*uMotion);
 float interaction=0.;
 for(int i=0;i<12;i++){
  if(float(i)<uTrailCount){vec3 pt=uTrail[i];vec2 d=uv-pt.xy;float v=exp(-dot(d,d)*71.)*pt.z;interaction+=v;warp+=vec2(-d.y,d.x)*v*.82 + d*v*.09;}
 }
 float turbulence=fbm(uv*8.3+warp*12.0+vec2(t*.19,-t*.42));
 warp+=(vec2(turbulence-.5,a-.5)*(.011+.022*min(1.0,interaction)))*uMotion;
 float smokeField=fbm(uv*vec2(5.0,3.5)+vec2(a*.9,-t*.23)+warp*12.);
 float ghostField=fbm(uv*vec2(6.8,4.4)-vec2(t*.10,t*.04)+warp*10.);
 vec2 photo=cover(uv+warp,uAspectCurrent,uFocusCurrent,uMirrorCurrent);
 vec2 photoNext=cover(uv+warp,uAspectNext,uFocusNext,uMirrorNext);
 vec3 colA=texture2D(uCurrent,clamp(photo,0.001,.999)).rgb;
 vec3 colB=texture2D(uNext,clamp(photoNext+warp*.11,0.001,.999)).rgb;
 float smear=texture2D(uMask,uv).r;
 float contamination=smear + smokeField*(.06+.12*uProgress) + ghostField*.045*uProgress;
 float reveal=smoothstep(.14,.92,contamination);
 reveal=mix(reveal,1.,smoothstep(0.,1.,uTransition));
 vec3 col=mix(colA,colB,reveal);
 float smoky=smoothstep(.44,.78,smokeField)*(.26+.13*uMotion);
 col=mix(col,vec3(.10,.095,.098),smoky);
 float reddish=smoothstep(.63,.86,smokeField)*(.10+.08*uProgress);
 col+=vec3(.36,.06,.015)*reddish;
 vec2 faceUV=vec2(abs(uv.x-.52),uv.y);
 float head=1.-smoothstep(.2,.37,length((uv-vec2(.52,.46))*vec2(.85,1.15)));
 float ink=fbm(faceUV*vec2(9.,6.5)+vec2(2.1,t*.11));
 float blot=smoothstep(.52,.78,ink)*head;
 float leftEye=exp(-((faceUV.x-.107)*(faceUV.x-.107)*256.)-((uv.y-.49)*(uv.y-.49)*729.));
 float skull=blot*.09+leftEye*.055;
 col=mix(col,vec3(.007,.006,.008),skull*(.25+uProgress*.85));
 float heatEdge=smoothstep(.08,.25,smear)-smoothstep(.56,.86,smear);
 col+=vec3(.28,.055,.009)*max(0.,heatEdge)*(.14+.32*uProgress)*(1.-uTransition);
 float embers=hash(floor(gl_FragCoord.xy*.42)+vec2(floor(uTime*17.),floor(uTime*11.)));
 if(embers>.995){col+=vec3(.8,.24,.08)*(embers-.995)*160.;}
 float vignette=1.-.52*smoothstep(.15,.89,length((uv-.5)*vec2(1.0,.86)));
 col*=vignette;
 float grain=(hash(floor(gl_FragCoord.xy*.68)+vec2(floor(uTime*16.),floor(uTime*11.)))-.5)*.045;
 col+=grain;
 gl_FragColor=vec4(col,1.);
}`;

function shader(type, source){
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function texture(img){
  const tx = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tx);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tx;
}

function updateMask(){
  if(!webglReady || !maskDirty) return;
  gl.bindTexture(gl.TEXTURE_2D, maskTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskCanvas);
  maskDirty = false;
}

function sceneAnnouncement(){
  currentIndex.textContent = String(current + 1).padStart(2,'0') + ' / 04';
  currentLabel.textContent = SCENES[current].title;
  fallback.style.backgroundImage = `url('${SCENES[current].file}')`;
}

function resetMask(){
  maskContext.globalCompositeOperation = 'source-over';
  maskContext.globalAlpha = 1;
  maskContext.fillStyle = '#000';
  maskContext.fillRect(0,0,MASK_W,MASK_H);
  visited.fill(0);
  coverage = 0;
  bleedSeeds = [];
  recentStamps = [];
  maskDirty = true;
  setProgress(0);
}

function setProgress(percent){
  let p = Math.max(0, Math.min(100, Math.round(percent)));
  progressBar.setAttribute('aria-valuenow', String(p));
  progressFill.style.width = p + '%';
  progressNumber.textContent = String(p).padStart(2,'0') + '%';
  progressLabel.textContent = p===0 ? 'THE IMAGE IS INTACT' :
    p>=100 ? 'THE NEXT WORLD HAS BROKEN THROUGH' :
    p>=82 ? 'THE BLEED IS TAKING OVER' :
    p>=58 ? 'THE RUIN IS STARTING TO SPREAD' :
    p>=32 ? 'THE SURFACE IS GIVING WAY' :
    'THE SMOKE IS STIRRING';
}

function initGL(){
  gl = canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'low-power'});
  if(!gl) throw new Error('WebGL not available');
  program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, vert));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(program,'aPosition');
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
  ['uCurrent','uNext','uMask','uResolution','uTime','uTransition','uProgress','uScene','uMotion','uTrail','uTrailCount','uAspectCurrent','uAspectNext','uFocusCurrent','uFocusNext','uMirrorCurrent','uMirrorNext'].forEach(k=>uniforms[k]=gl.getUniformLocation(program, k==='uTrail'?'uTrail[0]':k));
  gl.uniform1i(uniforms.uCurrent,0);
  gl.uniform1i(uniforms.uNext,1);
  gl.uniform1i(uniforms.uMask,2);
  maskTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, maskTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  webglReady = true;
  updateMask();
  resize();
}

function resize(){
  if(!gl) return;
  const rect = hero.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1 : 1.15);
  let w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr));
  if(w > 2400){ h = Math.round(h * 2400 / w); w = 2400; }
  if(canvas.width !== w || canvas.height !== h){
    canvas.width = w; canvas.height = h; gl.viewport(0,0,w,h);
  }
}

function startTransition(target){
  if(transitioning || target===current) return;
  if(!webglReady){ dragging=false; current=target; next=(current+1)%SCENES.length; resetMask(); sceneAnnouncement(); return; }
  next = target;
  transitioning = true;
  transitionStart = performance.now();
  transitionValue = 0;
  progressLabel.textContent = 'THE WORLD IS CHANGING';
}

function finishTransition(){
  current = next;
  next = (current+1)%SCENES.length;
  transitioning = false;
  transitionValue = 0;
  resetMask();
  sceneAnnouncement();
}

function pointFromEvent(event){
  const r = hero.getBoundingClientRect();
  return {x:Math.min(1,Math.max(0,(event.clientX-r.left)/r.width)), y:Math.min(1,Math.max(0,1-(event.clientY-r.top)/r.height))};
}

function paintMaskAt(p, radius, innerAlpha, outerAlpha){
  const x = p.x * MASK_W, y = (1 - p.y) * MASK_H;
  const g = maskContext.createRadialGradient(x, y, 2, x, y, radius);
  g.addColorStop(0, `rgba(255,255,255,${innerAlpha})`);
  g.addColorStop(0.42, `rgba(255,255,255,${outerAlpha})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  maskContext.fillStyle = g;
  maskContext.fillRect(x-radius, y-radius, radius*2, radius*2);
  maskDirty = true;
}

function addVisited(p){
  const xCell = Math.floor(p.x*88), yCell = Math.floor((1-p.y)*50), rX = 7, rY = 5;
  for(let j=Math.max(0,yCell-rY); j<=Math.min(49,yCell+rY); j++){
    for(let i=Math.max(0,xCell-rX); i<=Math.min(87,xCell+rX); i++){
      if(((i-xCell)/rX)**2 + ((j-yCell)/rY)**2 < 1){
        const at = j*88 + i;
        if(!visited[at]){ visited[at] = 1; coverage++; }
      }
    }
  }
}

function rememberBleed(p, radius, energy){
  bleedSeeds.unshift({x:p.x, y:p.y, radius, energy, age:0, driftX:(Math.random()-.5)*0.012, driftY:(Math.random()-.5)*0.009, phase:Math.random()*Math.PI*2});
  bleedSeeds = bleedSeeds.slice(0, 36);
  recentStamps.unshift({x:p.x, y:p.y});
  recentStamps = recentStamps.slice(0, 24);
}

function damage(p, force=1){
  if(transitioning) return;
  const radius = 30 + Math.min(22, force * 10);
  paintMaskAt(p, radius, .42, .21);
  paintMaskAt(p, radius*0.58, .22, .08);
  addVisited(p);
  rememberBleed(p, radius, Math.min(1.2, .55 + force*.14));
  const percent = Math.min(100, (coverage/visited.length)/threshold * 100);
  setProgress(percent);
  if(percent >= 100) startTransition((current+1)%SCENES.length);
}

function drawBetween(from, to){
  const dist = Math.hypot((to.x-from.x)*1.777, to.y-from.y);
  const steps = Math.max(1, Math.ceil(dist/.02));
  for(let k=1; k<=steps; k++){
    const p = {x:from.x+(to.x-from.x)*k/steps, y:from.y+(to.y-from.y)*k/steps};
    damage(p, 1 + dist*8);
    if(transitioning || !dragging) break;
  }
}

function updateBleed(dt){
  if(transitioning || !bleedSeeds.length) return;
  const progress = Math.min(1.12, (coverage/visited.length)/threshold);
  const active = Math.min(bleedSeeds.length, progress < 0.22 ? 5 : progress < 0.62 ? 10 : 16);
  for(let i=0; i<active; i++){
    const seed = bleedSeeds[i];
    seed.age += dt;
    const decay = progress > .75 ? .11 : .16;
    seed.energy -= dt * decay;
    seed.radius += dt * (9 + 16*progress);
    const driftScale = .35 + progress*.8;
    const pulse = Math.sin(seed.age*2.8 + seed.phase) * 0.0028;
    seed.x = Math.min(0.985, Math.max(0.015, seed.x + seed.driftX*dt*driftScale + pulse));
    seed.y = Math.min(0.985, Math.max(0.015, seed.y + seed.driftY*dt*driftScale));
    if(seed.energy <= 0) continue;
    const glow = Math.max(0.02, .09 * seed.energy * (.45 + progress));
    paintMaskAt(seed, seed.radius, glow, glow * 0.45);
    if(progress > .52 && Math.random() < dt * (3.5 + progress*3) && recentStamps.length){
      const src = recentStamps[(Math.random()*recentStamps.length)|0];
      const offset = {x:Math.min(0.985, Math.max(0.015, src.x + (Math.random()-.5)*0.08)), y:Math.min(0.985, Math.max(0.015, src.y + (Math.random()-.5)*0.06))};
      paintMaskAt(offset, 22 + Math.random()*22 + progress*18, 0.05 + progress*0.03, 0.02 + progress*0.015);
    }
  }
  bleedSeeds = bleedSeeds.filter(seed => seed.energy > 0);
}

function pointerMove(e){
  const pt = pointFromEvent(e);
  pointer = pt;
  if(motionOn){
    const d = lastPointer ? Math.hypot((pt.x-lastPointer.x)*2, pt.y-lastPointer.y) : 0;
    trail.unshift({x:pt.x, y:pt.y, strength:Math.min(1.7,.25+d*23), life:1});
    trail = trail.slice(0,12);
  }
  if(dragging && !transitioning){
    if(lastPointer) drawBetween(lastPointer, pt); else damage(pt);
  }
  lastPointer = pt;
}

hero.addEventListener('pointerdown', e => {
  if(e.target.closest('a,button')) return;
  if(e.button !== 0) return;
  dragging = true;
  lastPointer = pointFromEvent(e);
  try { hero.setPointerCapture(e.pointerId); } catch(_){}
  damage(lastPointer, 1.2);
});
hero.addEventListener('pointermove', pointerMove);
for(const name of ['pointerup','pointercancel','lostpointercapture']) hero.addEventListener(name, ()=>{dragging=false; lastPointer=null;});
hero.addEventListener('pointerleave', ()=>{ if(!dragging) lastPointer = null; });

nextButton.addEventListener('click', ()=>{
  if(transitioning) return;
  if(!webglReady){ current=(current+1)%SCENES.length; sceneAnnouncement(); resetMask(); return; }
  startTransition((current+1)%SCENES.length);
});

motionButton.addEventListener('click', ()=>{
  motionOn = !motionOn;
  motionButton.setAttribute('aria-pressed', String(!motionOn));
  motionState.textContent = motionOn ? 'ON' : 'OFF';
  trail = [];
});

document.querySelectorAll('[data-scene]').forEach(card => card.addEventListener('click', ()=>{
  const selected = Number(card.dataset.scene);
  window.scrollTo({top:0, behavior:prefersReduced ? 'instant' : 'smooth'});
  if(selected===current) return;
  if(!webglReady){ current=selected; sceneAnnouncement(); return; }
  if(transitioning) return;
  resetMask();
  startTransition(selected);
}));

function drawFrame(now){
  requestAnimationFrame(drawFrame);
  if(!webglReady || document.hidden) return;
  if(now - previousFrame < 22) return;
  const dt = Math.min(.06, (now - previousFrame)/1000 || .016);
  previousFrame = now;
  if(transitioning){
    transitionValue = Math.min(1, (now - transitionStart) / 1350);
    if(transitionValue >= 1) finishTransition();
  }
  trail.forEach(t => t.life -= dt * (motionOn ? 1.45 : 8));
  trail = trail.filter(t => t.life > .025);
  updateBleed(dt);
  updateMask();
  resize();
  gl.useProgram(program);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures[current]);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, textures[transitioning ? next : (current+1)%SCENES.length]);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, maskTexture);
  gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
  gl.uniform1f(uniforms.uTime, motionOn ? (now - startTime)/1000 : 0);
  gl.uniform1f(uniforms.uMotion, motionOn ? 1 : 0);
  gl.uniform1f(uniforms.uTransition, transitionValue);
  gl.uniform1f(uniforms.uProgress, Math.min(1.05, (coverage/visited.length)/threshold));
  gl.uniform1f(uniforms.uScene, current);
  gl.uniform1f(uniforms.uAspectCurrent, SCENES[current].aspect);
  gl.uniform1f(uniforms.uAspectNext, SCENES[transitioning ? next : (current+1)%SCENES.length].aspect);
  gl.uniform1f(uniforms.uFocusCurrent, current === 2 ? .73 : .5);
  gl.uniform1f(uniforms.uFocusNext, (transitioning ? next : (current+1)%SCENES.length) === 2 ? .73 : .5);
  gl.uniform1f(uniforms.uMirrorCurrent, current === 2 ? 1 : 0);
  gl.uniform1f(uniforms.uMirrorNext, (transitioning ? next : (current+1)%SCENES.length) === 2 ? 1 : 0);
  const packed = new Float32Array(36);
  trail.slice(0,12).forEach((p,i)=>{ packed[i*3]=p.x; packed[i*3+1]=p.y; packed[i*3+2]=p.strength*p.life; });
  gl.uniform3fv(uniforms.uTrail, packed);
  gl.uniform1f(uniforms.uTrailCount, trail.length);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

window.addEventListener('resize', resize, { passive:true });
if(prefersReduced){ motionButton.setAttribute('aria-pressed','true'); motionState.textContent='OFF'; }
sceneAnnouncement();
Promise.all(SCENES.map(scene => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error(`Could not load ${scene.file}`));
  img.src = scene.file;
})) ).then(images => {
  try { initGL(); textures = images.map(texture); requestAnimationFrame(drawFrame); }
  catch(err){ console.warn('Visual shader unavailable; using a static illustrated fallback.', err); canvas.style.display='none'; webglReady=false; }
}).catch(err => { console.warn('Source art unavailable. Images are hosted by Wikimedia Commons; check network access and image URLs.', err); canvas.style.display='none'; });
})();
