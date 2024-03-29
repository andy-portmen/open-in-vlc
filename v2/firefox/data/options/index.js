'use strict';

const toast = document.getElementById('toast');

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get({
    'path': '',
    'm3u8': true,
    'faqs': true,
    'blacklist': []
  }, prefs => {
    document.getElementById('path').value = prefs.path;
    document.getElementById('m3u8').checked = prefs.m3u8;
    document.getElementById('faqs').checked = prefs.faqs;
    document.getElementById('blacklist').value = prefs.blacklist.join(', ');
  });
});
document.getElementById('save').addEventListener('click', () => {
  const path = document.getElementById('path').value;
  const m3u8 = document.getElementById('m3u8').checked;
  const faqs = document.getElementById('faqs').checked;
  const blacklist = document.getElementById('blacklist').value.split(/\s*,\s*/).filter((s, i, l) => {
    return s && l.indexOf(s) === i;
  });
  chrome.storage.local.set({
    path,
    m3u8,
    faqs,
    blacklist
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
