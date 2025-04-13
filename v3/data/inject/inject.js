'use strict';

[...document.querySelectorAll('.open-in-vlc')].forEach(f => f.remove());

{
  const dialog = document.createElement('dialog');
  dialog.classList.add('open-in-vlc');

  const iframe = document.createElement('iframe');
  iframe.onload = () => {
    iframe.contentWindow.postMessage({
      map: self.map,
      referrer: location.href
    }, '*');
    delete self.map;
  };
  iframe.src = chrome.runtime.getURL('/data/inject/index.html');
  dialog.append(iframe);
  document.body.append(dialog);
  dialog.showModal();
}
