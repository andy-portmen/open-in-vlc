'use strict';

const toast = document.getElementById('toast');

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get({
    'path': '',
    'm3u8': true,
    'use-page-title': true,
    'faqs': true
  }, prefs => {
    document.getElementById('path').value = prefs.path;
    document.getElementById('m3u8').checked = prefs.m3u8;
    document.getElementById('use-page-title').checked = prefs['use-page-title'];
    document.getElementById('faqs').checked = prefs.faqs;
  });
});
document.getElementById('save').addEventListener('click', () => {
  chrome.storage.local.set({
    'path': document.getElementById('path').value,
    'm3u8': document.getElementById('m3u8').checked,
    'faqs': document.getElementById('faqs').checked,
    'use-page-title': document.getElementById('use-page-title').checked
  }, () => {
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
