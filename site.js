(() => {
'use strict';

const hero = document.querySelector('.hero');
const heroTitle = document.querySelector('#hero-title');
const surface = document.querySelector('.scene-surface');
const canvas = document.querySelector('#world');
const picture = document.querySelector('.hero-picture');
const sceneSource = picture.querySelector('source');
const sceneImage = picture.querySelector('img');
const captionIndex = document.querySelector('#scene-index');
const captionTitle = document.querySelector('#scene-title');
const controls = document.querySelector('#scene-actions');
const motionButton = document.querySelector('#motion-button');
const motionState = document.querySelector('#motion-state');
const nextButton = document.querySelector('#next-button');
const progress = document.querySelector('#smudge-progress');
const progressPanel = document.querySelector('#smudge-panel');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const smallScreen = matchMedia('(max-width: 760px)');
const scenes = Array.from(document.querySelectorAll('[data-scene]'), plate => {
  const image = plate.querySelector('img');
  return {
    title: plate.querySelector('h3').textContent,
    full: image.src,
    small: image.srcset.trim().split(/\s+/)[0],
    focusY: Number(plate.dataset.focusY ?? .5),
    zoom: Number(plate.dataset.zoom ?? 1),
    button: plate.querySelector('.view-scene'),
    pending: new Map(),
    textures: new Map()
  };
});

if (scenes.length < 2) return;

const mask = document.createElement('canvas');
mask.width = 320;
mask.height = 192;
const paint = mask.getContext('2d');
const gridWidth = 40;
const gridHeight = 24;
const visited = new Uint8Array(gridWidth * gridHeight);
const packedTrail = new Float32Array(18);
const damageThreshold = visited.length * .23;
let gl, program, maskTexture;
const uniforms = {};
let motionOn = !reducedMotion.matches;
let visible = true;
let rendererReady = false;
let rendererFailed = false;
let current = 0;
let requested = 0;
let transition;
let requestVersion = 0;
let pointerId;
let lastPoint;
let trail = [];
let coverage = 0;
let maskDirty = true;
let frame = 0;
let lastFrame = 0;
let clock = 0;
let sceneTime = 0;
let hold = sceneHold();
let cssWidth = 1;
let cssHeight = 1;

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
uniform float uAspectCurrent;
uniform float uAspectNext;
uniform float uFocusCurrent;
uniform float uFocusNext;
uniform float uZoomCurrent;
uniform float uZoomNext;
uniform vec3 uTrail[6];
uniform float uTrailCount;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,amp=.53;for(int i=0;i<4;i++){v+=amp*noise(p);p=mat2(1.61,-1.15,1.15,1.61)*p;amp*=.5;}return v;}
vec2 cover(vec2 uv, float pictureAspect, float focusY, float zoom) {
  vec2 anchor = vec2(.5, focusY);
  uv = anchor + (uv - anchor) / zoom;
  float screenAspect = uResolution.x / uResolution.y;
  if (screenAspect > pictureAspect) {
    float visible = pictureAspect / screenAspect;
    uv.y = (1. - visible) * focusY + uv.y * visible;
  } else {
    uv.x = .5 + (uv.x - .5) * screenAspect / pictureAspect;
  }
  return uv;
}
void main(){
 vec2 uv=vUv;
 float t=uTime*.18;
 float a=fbm(uv*3.2+vec2(t*.25,-t*.17));
 float b=fbm(uv*6.6+vec2(-t*.32,t*.11));
 vec2 warp=vec2(a-.48,b-.48)*.024;
 float interaction=0.;
 for(int i=0;i<6;i++){
  if(float(i)<uTrailCount){vec3 pt=uTrail[i];vec2 d=uv-pt.xy;float v=exp(-dot(d,d)*71.)*pt.z;interaction+=v;warp+=vec2(-d.y,d.x)*v*.82 + d*v*.09;}
 }
 float turbulence=fbm(uv*8.3+warp*12.0+vec2(t*.19,-t*.42));
 warp+=(vec2(turbulence-.5,a-.5)*(.011+.022*min(1.0,interaction)));
 float smokeField=fbm(uv*vec2(5.0,3.5)+vec2(a*.9,-t*.23)+warp*12.);
 float ghostField=fbm(uv*vec2(6.8,4.4)-vec2(t*.10,t*.04)+warp*10.);
 vec2 photo=cover(uv+warp,uAspectCurrent,uFocusCurrent,uZoomCurrent);
 vec2 photoNext=cover(uv+warp,uAspectNext,uFocusNext,uZoomNext);
 vec3 colA=texture2D(uCurrent,clamp(photo,0.001,.999)).rgb;
 vec3 colB=texture2D(uNext,clamp(photoNext+warp*.11,0.001,.999)).rgb;
 float smear=texture2D(uMask,uv).r;
 float contamination=smear + smokeField*(.06+.12*uProgress) + ghostField*.045*uProgress;
 float reveal=smoothstep(.14,.92,contamination);

 // The advancing threshold follows the smoke and begins in damaged areas.
 float edge = clamp(smokeField * .7 + ghostField * .3 + smear * .28, 0., 1.);
 float burn = smoothstep(.37, .63, edge + uTransition * 1.48 - .74);
 reveal = max(reveal, burn);
 vec3 col=mix(colA,colB,reveal);
 float smoky=smoothstep(.44,.78,smokeField)*.31;
 col=mix(col,vec3(.10,.095,.098),smoky);
 float reddish=smoothstep(.63,.86,smokeField)*(.10+.08*uProgress);
 col+=vec3(.36,.06,.015)*reddish;
 float heatEdge=smoothstep(.08,.25,smear)-smoothstep(.56,.86,smear);
 col+=vec3(.28,.055,.009)*max(0.,heatEdge)*(.14+.32*uProgress)*(1.-uTransition);
 float luminance = dot(col, vec3(.2126,.7152,.0722));
 col = mix(col, vec3(luminance), .50) * vec3(.91,.86,.83);
 float vignette=1.-.52*smoothstep(.15,.89,length((uv-.5)*vec2(1.0,.86)));
 col*=vignette;
 float grain=(hash(floor(gl_FragCoord.xy*.68)+vec2(floor(uTime*4.),floor(uTime*3.)))-.5)*.034;
 col+=grain;
 gl_FragColor=vec4(col,1.);
}`;


function sceneHold() {
  return 16 + Math.random() * 10;
}

function variant(scene) {
  return smallScreen.matches ? scene.small : scene.full;
}

function loadScene(scene, url = variant(scene)) {
  if (scene.pending.has(url)) return scene.pending.get(url);

  const image = new Image();
  image.src = url;
  const pending = image.decode().then(() => image).catch(error => {
    scene.pending.delete(url);
    throw error;
  });
  scene.pending.set(url, pending);
  return pending;
}

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

function allocateTexture() {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

function initRenderer() {
  if (!paint || rendererFailed) return false;
  if (rendererReady) return true;

  try {
    gl = canvas.getContext('webgl', {
      alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power'
    });
    if (!gl) throw new Error('WebGL unavailable');
    const vertexShader = compile(gl.VERTEX_SHADER, vert);
    const fragmentShader = compile(gl.FRAGMENT_SHADER, frag);
    program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }

    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    for (const key of [
      'uCurrent', 'uNext', 'uMask', 'uResolution', 'uTime', 'uTransition', 'uProgress',
      'uTrail[0]', 'uTrailCount', 'uAspectCurrent', 'uAspectNext', 'uFocusCurrent', 'uFocusNext', 'uZoomCurrent', 'uZoomNext'
    ]) {
      uniforms[key] = gl.getUniformLocation(program, key);
    }
    gl.uniform1i(uniforms.uCurrent, 0);
    gl.uniform1i(uniforms.uNext, 1);
    gl.uniform1i(uniforms.uMask, 2);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    gl.activeTexture(gl.TEXTURE2);
    maskTexture = allocateTexture();
    rendererReady = true;
    return true;
  } catch {
    rendererFailed = true;
    return false;
  }
}

function uploadScene(index, url, image) {
  const scene = scenes[index];
  if (scene.textures.has(url)) return scene.textures.get(url);
  gl.activeTexture(gl.TEXTURE0);
  const texture = allocateTexture();
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  const entry = { texture, aspect: image.naturalWidth / image.naturalHeight };
  scene.textures.set(url, entry);
  return entry;
}

function clearDamage() {
  trail = [];
  visited.fill(0);
  coverage = 0;
  progress.value = 0;
  if (!paint) return;
  paint.fillStyle = '#000';
  paint.fillRect(0, 0, mask.width, mask.height);
  maskDirty = true;
}

function showScene(index, url) {
  const scene = scenes[index];
  current = index;
  sceneSource.srcset = url === scene.full ? scene.small : url;
  sceneImage.src = url === scene.small ? scene.small : scene.full;
  picture.style.setProperty('--scene-zoom', scene.zoom);
  picture.style.setProperty('--scene-y', `${(1 - scene.focusY) * 100}%`);
  const format = number => String(number).padStart(2, '0');
  captionIndex.textContent = `${format(index + 1)} / ${format(scenes.length)}`;
  captionTitle.textContent = scene.title;
  sceneTime = 0;
  hold = sceneHold();
  clearDamage();
}

function updateControls() {
  motionButton.hidden = rendererFailed;
  motionButton.setAttribute('aria-pressed', String(motionOn));
  motionState.textContent = motionOn ? 'on' : 'off';
  surface.classList.toggle('interactive', rendererReady && motionOn);
  progressPanel.hidden = !rendererReady || !motionOn;
  if (!motionOn || rendererFailed) canvas.classList.remove('is-rendering');
}

async function requestScene(index, animate = true) {
  requested = index;
  const version = ++requestVersion;
  const scene = scenes[index];
  let url = variant(scene);
  try {
    let image;
    try {
      image = await loadScene(scene, url);
    } catch (error) {
      if (url === scene.full) throw error;
      url = scene.full;
      image = await loadScene(scene, url);
    }
    if (version !== requestVersion) return;

    if (animate && motionOn && rendererReady && index !== current) {
      transition = { index, elapsed: 0, url, entry: uploadScene(index, url, image) };
    } else {
      transition = undefined;
      showScene(index, url);
    }
    scheduleFrame();
  } catch {
    if (version !== requestVersion) return;
    requested = current;
    transition = undefined;
    sceneTime = 0;
    captionTitle.textContent = `${scenes[current].title} · Requested artwork unavailable`;
    clearDamage();
  }
}

let activeEntry;
let followingEntry;
let followingIndex;
let preloadVersion = 0;

async function prepareTextures() {
  const version = ++preloadVersion;
  const index = current;
  const scene = scenes[index];
  const url = variant(scene);

  try {
    const image = await loadScene(scene, url);
    if (version !== preloadVersion || !motionOn || !initRenderer()) {
      updateControls();
      return;
    }
    activeEntry = uploadScene(index, url, image);
    followingIndex = (index + 1) % scenes.length;
    followingEntry = undefined;
    updateControls();
    scheduleFrame();

    const upcoming = scenes[followingIndex];
    const nextUrl = variant(upcoming);
    const nextImage = await loadScene(upcoming, nextUrl);
    if (version === preloadVersion && rendererReady) {
      followingEntry = uploadScene(followingIndex, nextUrl, nextImage);
    }
  } catch {
    // The current illustration remains visible. Manual navigation can retry.
  }
}

function pointOnSurface(event) {
  const rect = surface.getBoundingClientRect();
  const clamp = value => Math.max(0, Math.min(.999, value));
  return {
    x: clamp((event.clientX - rect.left) / rect.width),
    y: clamp(1 - (event.clientY - rect.top) / rect.height)
  };
}

function stamp(point) {
  const x = point.x * mask.width;
  const y = (1 - point.y) * mask.height;
  const radius = mask.width * .085;
  const gradient = paint.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, 'rgba(255,255,255,.65)');
  gradient.addColorStop(.45, 'rgba(255,255,255,.26)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  paint.fillStyle = gradient;
  paint.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  maskDirty = true;

  const column = Math.floor(point.x * gridWidth);
  const row = Math.floor((1 - point.y) * (gridHeight - 1));
  for (let j = Math.max(0, row - 2); j <= Math.min(gridHeight - 1, row + 2); j++) {
    for (let i = Math.max(0, column - 3); i <= Math.min(gridWidth - 1, column + 3); i++) {
      const cell = j * gridWidth + i;
      if (visited[cell]) continue;
      visited[cell] = 1;
      coverage++;
    }
  }
  progress.value = Math.min(100, coverage / damageThreshold * 100);
}

surface.addEventListener('pointerdown', event => {
  if (!motionOn || !rendererReady || !event.isPrimary || event.button !== 0) return;
  pointerId = event.pointerId;
  sceneTime = 0;
  lastPoint = pointOnSurface(event);
  surface.setPointerCapture(pointerId);
});

surface.addEventListener('pointermove', event => {
  if (!motionOn || !rendererReady || !event.isPrimary) return;
  const point = pointOnSurface(event);
  trail.unshift({ ...point, strength: event.pointerId === pointerId ? 1.45 : .52 });
  trail.length = Math.min(trail.length, 6);
  if (event.pointerId !== pointerId || !lastPoint || requested !== current) return;

  const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
  if (distance < .009) return;
  const steps = Math.ceil(distance / .025);
  for (let i = 1; i <= steps; i++) {
    stamp({
      x: lastPoint.x + (point.x - lastPoint.x) * i / steps,
      y: lastPoint.y + (point.y - lastPoint.y) * i / steps
    });
  }
  lastPoint = point;
  if (coverage >= damageThreshold) requestScene((current + 1) % scenes.length);
});

for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  surface.addEventListener(eventName, event => {
    if (event.pointerId !== pointerId) return;
    pointerId = undefined;
    lastPoint = undefined;
  });
}

function resize() {
  cssWidth = Math.max(1, surface.clientWidth);
  cssHeight = Math.max(1, surface.clientHeight);
  const resolution = Math.min(1, Math.sqrt(620000 / (cssWidth * cssHeight)));
  canvas.width = Math.max(1, Math.round(cssWidth * resolution));
  canvas.height = Math.max(1, Math.round(cssHeight * resolution));
}

function scheduleFrame() {
  if (frame || !motionOn || !rendererReady || !visible || document.hidden) return;
  frame = requestAnimationFrame(drawFrame);
}

function drawFrame(now) {
  frame = 0;
  if (!motionOn || !visible || document.hidden || !rendererReady || !activeEntry) {
    lastFrame = 0;
    return;
  }
  const interval = (now - lastFrame) / 1000;
  if (lastFrame && interval < 1 / 32) {
    scheduleFrame();
    return;
  }
  const delta = lastFrame ? Math.min(.065, interval) : 0;
  lastFrame = now;
  clock += delta;
  sceneTime += delta;
  if (transition) {
    transition.elapsed += delta;
    if (transition.elapsed >= 1.65) {
      const { index, url, entry } = transition;
      transition = undefined;
      activeEntry = entry;
      followingEntry = undefined;
      showScene(index, url);
      prepareTextures();
    }
  } else if (sceneTime > hold && requested === current && pointerId === undefined) {
    requestScene((current + 1) % scenes.length);
  }

  for (const point of trail) point.strength *= Math.exp(-delta * 3.2);
  trail = trail.filter(point => point.strength > .025);
  for (const [index, point] of trail.entries()) {
    packedTrail.set([point.x, point.y, point.strength], index * 3);
  }

  const nextIndex = transition?.index ?? (followingEntry ? followingIndex : current);
  const nextEntry = transition?.entry ?? followingEntry ?? activeEntry;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, activeEntry.texture);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, nextEntry.texture);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, maskTexture);
  if (maskDirty) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask);
    maskDirty = false;
  }

  gl.uniform2f(uniforms.uResolution, cssWidth, cssHeight);
  gl.uniform1f(uniforms.uTime, clock);
  gl.uniform1f(uniforms.uTransition, (transition?.elapsed ?? 0) / 1.65);
  gl.uniform1f(uniforms.uProgress, Math.min(1, coverage / damageThreshold));
  gl.uniform1f(uniforms.uAspectCurrent, activeEntry.aspect);
  gl.uniform1f(uniforms.uAspectNext, nextEntry.aspect);
  gl.uniform1f(uniforms.uFocusCurrent, scenes[current].focusY);
  gl.uniform1f(uniforms.uFocusNext, scenes[nextIndex].focusY);
  gl.uniform1f(uniforms.uZoomCurrent, scenes[current].zoom);
  gl.uniform1f(uniforms.uZoomNext, scenes[nextIndex].zoom);
  gl.uniform3fv(uniforms['uTrail[0]'], packedTrail);
  gl.uniform1f(uniforms.uTrailCount, trail.length);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  canvas.classList.add('is-rendering');
  scheduleFrame();
}

function setMotion(enabled) {
  motionOn = enabled;
  lastFrame = 0;
  if (motionOn) {
    prepareTextures();
  } else {
    if (requested !== current) requestScene(requested, false);
    clearDamage();
  }
  updateControls();
}

canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  rendererReady = false;
  rendererFailed = true;
  setMotion(false);
});

motionButton.addEventListener('click', () => setMotion(!motionOn));
nextButton.addEventListener('click', () => requestScene((requested + 1) % scenes.length));
reducedMotion.addEventListener('change', event => setMotion(!event.matches));
smallScreen.addEventListener('change', () => {
  if (motionOn) prepareTextures();
});

for (const [index, scene] of scenes.entries()) {
  scene.button.hidden = false;
  scene.button.addEventListener('click', () => {
    requestScene(index, false).then(() => {
      if (motionOn) prepareTextures();
    });
    heroTitle.tabIndex = -1;
    heroTitle.focus({ preventScroll: true });
    hero.scrollIntoView();
  });
}

new ResizeObserver(resize).observe(surface);
new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  if (!visible) lastFrame = 0;
  scheduleFrame();
}).observe(hero);
document.addEventListener('visibilitychange', () => {
  lastFrame = 0;
  scheduleFrame();
});

controls.hidden = false;
resize();
clearDamage();
updateControls();
if (motionOn) prepareTextures();
})();
