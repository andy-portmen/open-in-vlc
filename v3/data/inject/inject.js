'use strict';

[...document.querySelectorAll('.open-in-vlc')].forEach(f => f.remove());

{
  const dialog = document.createElement('dialog');
  dialog.classList.add('open-in-vlc');

  const iframe = document.createElement('iframe');
  const args = new URLSearchParams(location.search);
  args.set('referrer', location.href);
  iframe.src = chrome.runtime.getURL('/data/inject/index.html?' + args.toString());
  dialog.append(iframe);
  document.body.append(dialog);
  dialog.showModal();
}

