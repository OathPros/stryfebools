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

const transitionDuration = 1.65;
let gl, program;
const uniforms = {};
let motionOn = !reducedMotion.matches;
let visible = true;
let rendererReady = false;
let rendererFailed = false;
let current = 0;
let requested = 0;
let transition;
let requestVersion = 0;
let pointer;
let heldPointer;
let staticFocus = 0;
let focusPosition = { x: .5, y: .5 };
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
uniform vec2 uResolution;
uniform float uTime;
uniform float uTransition;
uniform float uAspectCurrent;
uniform float uAspectNext;
uniform float uFocusCurrent;
uniform float uFocusNext;
uniform float uZoomCurrent;
uniform float uZoomNext;
uniform vec3 uSignalFocus;
float hash(vec2 point) {
  vec3 p = fract(vec3(point.xyx) * .1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

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
void main() {
  vec2 uv = vUv;
  float row = floor(uv.y * 290.);
  float field = floor(uTime * 15.);
  float aspect = uResolution.x / uResolution.y;

  // The envelope peaks between pictures while a tracking band rolls over the frame.
  float tuning = smoothstep(0., .42, uTransition) * (1. - smoothstep(.56, 1., uTransition));
  float roll = 1.18 - uTransition * 1.36;
  float tracking = 1. - smoothstep(.012, .115, abs(uv.y - roll));
  float tear = (hash(vec2(row, field)) - .5) * (tuning * .012 + tracking * tuning * .064);
  vec2 separation = (uv - uSignalFocus.xy) * vec2(aspect, 1.);
  float contact = exp(-dot(separation, separation) * 46.) * uSignalFocus.z;
  tear += (hash(vec2(row + 19., field)) - .5) * contact * .048;
  vec2 signal = uv + vec2(tear, 0.);

  vec2 currentUV = cover(signal, uAspectCurrent, uFocusCurrent, uZoomCurrent);
  vec2 nextUV = cover(signal, uAspectNext, uFocusNext, uZoomNext);
  vec3 currentArt = texture2D(uCurrent, clamp(currentUV, 0., 1.)).rgb;
  vec3 nextArt = texture2D(uNext, clamp(nextUV, 0., 1.)).rgb;
  float retune = smoothstep(.44, .59, uTransition + (hash(vec2(row, field)) - .5) * tuning * .11);
  float picture = dot(mix(currentArt, nextArt, retune), vec3(.2126, .7152, .0722)) * .89;

  vec2 cell = floor(uv * vec2(310. * aspect, 310.));
  float snow = hash(cell + vec2(field * 17., field * 11.));
  float streak = hash(vec2(floor(cell.x / 6.), cell.y) + vec2(field, field * 3.));
  // Moderate contrast and a steady mean keep the moving snow from becoming a strobe.
  float interference = .43 + (snow - .5) * .55 + (streak - .5) * .13;
  float scanline = .94 + .06 * cos(uv.y * 290. * 6.283185);
  float noiseMix = clamp(tuning * .90 + tracking * tuning * .16 + contact * .81, 0., .97);
  float gray = mix(picture, interference, noiseMix) * scanline;
  gray *= 1. - .40 * smoothstep(.18, .88, length(uv - .5));
  gl_FragColor = vec4(vec3(gray), 1.);
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
  if (rendererFailed) return false;
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
      'uCurrent', 'uNext', 'uResolution', 'uTime', 'uTransition', 'uSignalFocus',
      'uAspectCurrent', 'uAspectNext', 'uFocusCurrent', 'uFocusNext', 'uZoomCurrent', 'uZoomNext'
    ]) {
      uniforms[key] = gl.getUniformLocation(program, key);
    }
    gl.uniform1i(uniforms.uCurrent, 0);
    gl.uniform1i(uniforms.uNext, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

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
}

function updateControls() {
  motionButton.hidden = rendererFailed;
  motionButton.setAttribute('aria-pressed', String(motionOn));
  motionState.textContent = motionOn ? 'on' : 'off';
  surface.classList.toggle('interactive', rendererReady && motionOn);
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
  }
}

let activeEntry;
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
    updateControls();
    scheduleFrame();

    await loadScene(scenes[(index + 1) % scenes.length]);
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

function moveStaticFocus(event) {
  if (!motionOn || !rendererReady || !event.isPrimary) return;
  pointer = pointOnSurface(event);
}

surface.addEventListener('pointermove', moveStaticFocus);
surface.addEventListener('pointerdown', event => {
  if (!motionOn || !rendererReady || !event.isPrimary || event.button !== 0) return;
  moveStaticFocus(event);
  heldPointer = event.pointerId;
  surface.setPointerCapture(event.pointerId);
});

function releaseStaticFocus(event) {
  if (event.pointerId !== heldPointer) return;
  heldPointer = undefined;
  if (event.pointerType !== 'mouse') pointer = undefined;
}

for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  surface.addEventListener(eventName, releaseStaticFocus);
}
surface.addEventListener('pointerleave', () => { pointer = undefined; });

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
    if (transition.elapsed >= transitionDuration) {
      const { index, url, entry } = transition;
      transition = undefined;
      activeEntry = entry;
      showScene(index, url);
      prepareTextures();
    }
  } else if (sceneTime > hold && requested === current) {
    requestScene((current + 1) % scenes.length);
  }

  const targetFocus = pointer ? (heldPointer === undefined ? .24 : 1) : 0;
  staticFocus += (targetFocus - staticFocus) * (1. - Math.exp(-delta * 10));
  if (pointer) focusPosition = pointer;

  const nextIndex = transition?.index ?? current;
  const nextEntry = transition?.entry ?? activeEntry;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, activeEntry.texture);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, nextEntry.texture);
  gl.uniform2f(uniforms.uResolution, cssWidth, cssHeight);
  gl.uniform1f(uniforms.uTime, clock);
  gl.uniform1f(uniforms.uTransition, (transition?.elapsed ?? 0) / transitionDuration);
  gl.uniform3f(uniforms.uSignalFocus, focusPosition.x, focusPosition.y, staticFocus);
  gl.uniform1f(uniforms.uAspectCurrent, activeEntry.aspect);
  gl.uniform1f(uniforms.uAspectNext, nextEntry.aspect);
  gl.uniform1f(uniforms.uFocusCurrent, scenes[current].focusY);
  gl.uniform1f(uniforms.uFocusNext, scenes[nextIndex].focusY);
  gl.uniform1f(uniforms.uZoomCurrent, scenes[current].zoom);
  gl.uniform1f(uniforms.uZoomNext, scenes[nextIndex].zoom);
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
    pointer = undefined;
    heldPointer = undefined;
    staticFocus = 0;
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
updateControls();
if (motionOn) prepareTextures();
})();
