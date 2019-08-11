'use strict';

const toast = document.getElementById('toast');

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
    toast.textContent = 'Options saved.';
    setTimeout(() => toast.textContent = '', 750);
  });
});

// reset
document.getElementById('reset').addEventListener('click', e => {
  if (e.detail === 1) {
    toast.textContent = 'Double-click to reset!';
    window.setTimeout(() => toast.textContent = '', 750);
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
