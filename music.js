const player = document.querySelector('#player');
const playerStatus = document.querySelector('#player-status');
const frameSlot = document.querySelector('#player-frame');
const playerLink = document.querySelector('#player-link');
const trackButtons = document.querySelectorAll('.queue');
const widgetOrigin = 'https://w.soundcloud.com';
let activeButton;
let widget;
let readyTimeout;
let streamTimeout;

function showPlayerStatus(text) {
  playerStatus.textContent = text;
  playerStatus.hidden = !text;
}

function playableTrack(button) {
  const track = button.closest('.track');
  const title = track.querySelector('.track-title').textContent;
  playerLink.href = track.querySelector('.track-external').href;

  activeButton?.setAttribute('aria-pressed', 'false');
  activeButton = button;
  button.setAttribute('aria-pressed', 'true');
  player.hidden = false;
  showPlayerStatus(`Loading ${title}…`);

  clearTimeout(readyTimeout);
  clearTimeout(streamTimeout);
  const url = new URL('/player/', widgetOrigin);
  url.search = new URLSearchParams({
    url: `https://api.soundcloud.com/tracks/${button.dataset.track}`,
    color: '#a94437',
    auto_play: 'false',
    show_artwork: 'false',
    show_comments: 'false',
    show_reposts: 'false',
    show_teaser: 'false',
    buying: 'false',
    sharing: 'false',
    download: 'false'
  });
  widget = document.createElement('iframe');
  widget.title = `${title} — SoundCloud player`;
  widget.height = '166';
  widget.src = url.href;
  widget.allow = 'autoplay; encrypted-media';
  widget.referrerPolicy = 'strict-origin-when-cross-origin';
  frameSlot.replaceChildren(widget);
  readyTimeout = setTimeout(() => {
    showPlayerStatus('If the player is unavailable, open the track on SoundCloud.');
  }, 10000);
}

// The widget exposes its readiness over postMessage even when the iframe
// itself reports a successful load for an unavailable track.
window.addEventListener('message', event => {
  if (event.origin !== widgetOrigin || event.source !== widget?.contentWindow) return;
  let message;
  try {
    message = JSON.parse(event.data);
  } catch {
    return;
  }
  switch (message?.method) {
    case 'ready':
      clearTimeout(readyTimeout);
      showPlayerStatus('');
      for (const value of ['error', 'play', 'playProgress', 'pause']) {
        widget.contentWindow.postMessage(
          JSON.stringify({ method: 'addEventListener', value }),
          widgetOrigin
        );
      }
      break;
    case 'play':
      clearTimeout(streamTimeout);
      showPlayerStatus('');
      streamTimeout = setTimeout(() => {
        showPlayerStatus('If playback stalls, open the track on SoundCloud.');
      }, 12000);
      break;
    case 'playProgress':
      if (!(message.value?.currentPosition > 0)) break;
      clearTimeout(streamTimeout);
      if (!playerStatus.hidden) showPlayerStatus('');
      break;
    case 'pause':
      clearTimeout(streamTimeout);
      break;
    case 'error':
      clearTimeout(readyTimeout);
      clearTimeout(streamTimeout);
      showPlayerStatus('SoundCloud could not play this track here. Open it on SoundCloud.');
      break;
  }
});

for (const button of trackButtons) {
  button.hidden = false;
  button.addEventListener('click', () => {
    if (activeButton !== button) playableTrack(button);
    // Put focus on the play controls so the next keyboard action can play.
    widget?.focus();
  });
}

const cover = document.querySelector('.cover img');
function hideUnavailableCover() {
  document.querySelector('.record').classList.add('without-cover');
}
cover.addEventListener('error', hideUnavailableCover);
if (cover.complete && !cover.naturalWidth) hideUnavailableCover();
