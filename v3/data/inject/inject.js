'use strict';

[...document.querySelectorAll('.open-in-vlc')].forEach(f => f.remove());

window.iframe = document.createElement('iframe');
window.iframe.classList.add('open-in-vlc');
window.iframe.style = `
  color-scheme: none;
  border: none;
  position: fixed;
  inset: 0 0 auto 0;
  height: 300px;
  width: min(500px, 100vw - 2rem);
  margin-inline: auto;
  z-index: 2147483647;
`;
window.iframe.src = chrome.runtime.getURL('/data/inject/index.html');
document.body.appendChild(window.iframe);
