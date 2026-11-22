const cover = document.querySelector('.cover img');
function hideUnavailableCover() {
  document.querySelector('.record').classList.add('without-cover');
}
cover.addEventListener('error', hideUnavailableCover);
if (cover.complete && !cover.naturalWidth) hideUnavailableCover();

const mobilePlayers = matchMedia('(max-width: 680px)');
let activeTrack;
let widgetLoading = false;

function enhanceMobilePlayers() {
  if (!mobilePlayers.matches || widgetLoading) return;
  widgetLoading = true;

  const script = document.createElement('script');
  script.src = 'https://w.soundcloud.com/player/api.js';
  script.addEventListener('load', () => {
    for (const card of document.querySelectorAll('.soundcloud-player')) setupTrack(card);
  }, { once: true });
  document.head.append(script);
}

function setupTrack(card) {
  const frame = card.querySelector('iframe');
  const title = frame.title.replace(/ — SoundCloud player$/, '');
  const widget = window.SC.Widget(frame);
  const events = window.SC.Widget.Events;
  const controls = document.createElement('div');
  controls.className = 'mobile-track';

  const heading = document.createElement('h4');
  heading.textContent = title;
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-pressed', 'false');
  const mark = document.createElement('span');
  mark.className = 'mobile-play-icon';
  mark.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  button.append(mark, label);
  controls.append(heading, button);
  frame.after(controls);

  let timeout;
  let ready = false;
  let playing = false;
  let pending = false;
  let fallback = false;

  function updateButton(text) {
    label.textContent = text;
    button.setAttribute('aria-label', `${text}: ${title}`);
    button.setAttribute('aria-pressed', String(playing));
  }

  function showNativePlayer() {
    clearTimeout(timeout);
    const moveFocus = controls.contains(document.activeElement);
    fallback = true;
    syncLayout();
    if (moveFocus) frame.focus();
    if (activeTrack === widget) activeTrack = undefined;
  }

  function syncLayout() {
    const enhanced = mobilePlayers.matches && ready && !fallback;
    card.classList.toggle('has-mobile-control', enhanced);
    frame.toggleAttribute('inert', enhanced);
    controls.hidden = !enhanced;
  }

  updateButton('Listen in browser');
  syncLayout();
  mobilePlayers.addEventListener('change', syncLayout);
  widget.bind(events.READY, () => {
    ready = true;
    syncLayout();
  });

  button.addEventListener('click', () => {
    if (pending) return;
    if (playing) {
      widget.pause();
      resetButton();
      return;
    }
    if (activeTrack && activeTrack !== widget) activeTrack.pause();
    activeTrack = widget;
    pending = true;
    updateButton('Starting playback…');
    timeout = setTimeout(showNativePlayer, 20000);
    widget.play();
  });

  widget.bind(events.PLAY_PROGRESS, position => {
    if (fallback || !pending || !(position.currentPosition > 0)) return;
    clearTimeout(timeout);
    pending = false;
    playing = true;
    updateButton('Pause');
  });

  function resetButton() {
    clearTimeout(timeout);
    pending = false;
    playing = false;
    updateButton('Listen in browser');
  }
  widget.bind(events.PAUSE, resetButton);
  widget.bind(events.FINISH, resetButton);
  widget.bind(events.ERROR, showNativePlayer);
}

mobilePlayers.addEventListener('change', enhanceMobilePlayers);
enhanceMobilePlayers();
