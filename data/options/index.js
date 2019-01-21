'use strict';

var info = document.getElementById('status');

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get({
    path: ''
  }, prefs => {
    document.getElementById('path').value = prefs.path;
  });
});
document.getElementById('save').addEventListener('click', () => {
  const path = document.getElementById('path').value;
  chrome.storage.local.set({path}, () => {
    info.textContent = 'Options saved.';
    setTimeout(() => info.textContent = '', 750);
  });
});

// reset
document.getElementById('reset').addEventListener('click', e => {
  if (e.detail === 1) {
    info.textContent = 'Double-click to reset!';
    window.setTimeout(() => info.textContent = '', 750);
  }
  else {
    localStorage.clear();
    chrome.storage.local.clear(() => {
      chrome.runtime.reload();
      window.close();
    });
  }
});
// support
document.getElementById('support').addEventListener('click', () => chrome.tabs.create({
  url: chrome.runtime.getManifest().homepage_url + '?rd=donate'
}));
