const cover = document.querySelector('.cover img');
function hideUnavailableCover() {
  document.querySelector('.record').classList.add('without-cover');
}
cover.addEventListener('error', hideUnavailableCover);
if (cover.complete && !cover.naturalWidth) hideUnavailableCover();
