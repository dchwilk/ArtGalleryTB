// Bootstrap runs last, after DOM references and every feature are available.
const APP_VERSION = '0.4.1';
initCheckboxControls();
initSettings();
document.getElementById('appVersion').textContent = 'ArtGalleryTB ' + APP_VERSION;
setPassepartout(colorIndex);
updatePassepartoutStyle();
initNavigation();
loadAllArtworks();
