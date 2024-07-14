/* global TYPES, Parser */
'use strict';

const toast = document.getElementById('toast');

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get({
    'path': '',
    'm3u8': true,
    'one-instance': true,
    'use-page-title': true, // for M3U8
    'send-title-meta': true, // as VLC argument
    'send-referrer': true, // as VLC argument
    'send-user-agent': true, // as VLC argument
    'faqs': true,
    'blacklist': [],
    'media-types': TYPES,
    'max-number-of-items': 200,
    'user-argument-string': '',
    'runtime': 'com.add0n.node'
  }, prefs => {
    document.getElementById('path').value = prefs.path;
    document.getElementById('m3u8').checked = prefs.m3u8;
    document.getElementById('one-instance').checked = prefs['one-instance'];
    document.getElementById('use-page-title').checked = prefs['use-page-title'];
    document.getElementById('send-title-meta').checked = prefs['send-title-meta'];
    document.getElementById('send-referrer').checked = prefs['send-referrer'];
    document.getElementById('send-user-agent').checked = prefs['send-user-agent'];
    document.getElementById('faqs').checked = prefs.faqs;
    document.getElementById('max-number-of-items').value = prefs['max-number-of-items'];
    document.getElementById('blacklist').value = prefs.blacklist.join(', ');
    document.getElementById('media-types').value = prefs['media-types'].join(', ');
    document.getElementById('user-argument-string').value = prefs['user-argument-string'];
    document.getElementById('runtime').value = prefs['runtime'];
  });
});
document.getElementById('save').addEventListener('click', () => {
  const user = document.getElementById('user-argument-string').value;
  const customArgs = [];
  if (user) {
    try {
      const termref = {
        lineBuffer: user
      };
      const parser = new Parser();
      // fixes https://github.com/andy-portmen/external-application-button/issues/5
      parser.escapeExpressions = {};
      parser.optionChars = {};
      parser.parseLine(termref);

      if (termref.argv.length) {
        customArgs.push(...termref.argv);
      }
    }
    catch (e) {
      console.warn(e);
      alert('cannot parse custom arguments', e.message);
    }
  }

  chrome.storage.local.set({
    'runtime': document.getElementById('runtime').value,
    'path': document.getElementById('path').value,
    'm3u8': document.getElementById('m3u8').checked,
    'faqs': document.getElementById('faqs').checked,
    'one-instance': document.getElementById('one-instance').checked,
    'use-page-title': document.getElementById('use-page-title').checked,
    'send-referrer': document.getElementById('send-referrer').checked,
    'send-user-agent': document.getElementById('send-user-agent').checked,
    'send-title-meta': document.getElementById('send-title-meta').checked,
    'blacklist': document.getElementById('blacklist').value.split(/\s*,\s*/).filter((s, i, l) => {
      return s && l.indexOf(s) === i;
    }),
    'media-types': document.getElementById('media-types').value.split(/\s*,\s*/).filter((s, i, l) => {
      return s && l.indexOf(s) === i;
    }),
    'max-number-of-items': Math.max(5, document.getElementById('max-number-of-items').valueAsNumber) || 200,
    'custom-arguments': customArgs,
    'user-argument-string': user
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

// usage
document.getElementById('usage').addEventListener('click', () => chrome.tabs.create({
  url: 'https://www.youtube.com/watch?v=PtBh9JzeueE'
}));

// helper
document.getElementById('helper').addEventListener('click', () => chrome.tabs.create({
  url: '/data/helper/index.html'
}));

// links
for (const a of [...document.querySelectorAll('[data-href]')]) {
  if (a.hasAttribute('href') === false) {
    a.href = chrome.runtime.getManifest().homepage_url + '#' + a.dataset.href;
  }
}
