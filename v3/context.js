/* global TYPES, copy, notify */

const isFF = /Firefox/.test(navigator.userAgent);
const create = o => chrome.contextMenus.create(o, () => chrome.runtime.lastError);
const context = () => {
  if (context.done) {
    return;
  }
  context.done = true;

  create({
    id: 'player',
    title: 'Open in VLC',
    contexts: ['video', 'audio'],
    documentUrlPatterns: ['*://*/*', 'file://*/*']
  });
  context.link();
  create({
    id: 'page',
    title: 'Open in VLC',
    contexts: ['page'],
    documentUrlPatterns: [
      '*://www.youtube.com/watch?v=*'
    ]
  });
  create({
    id: 'copy-links',
    title: 'Copy Media Links to the Clipboard',
    contexts: ['action']
  });
  create({
    id: 'page-link',
    title: 'Send Page Link to VLC',
    contexts: ['action']
  });
  create({
    id: 'media-player',
    title: 'Change Media Player',
    contexts: ['action']
  });
  chrome.storage.local.get({
    'media-player': 'VLC'
  }, prefs => {
    create({
      id: 'media-player-VLC',
      title: 'VLC (VideoLAN)',
      contexts: ['action'],
      parentId: 'media-player',
      type: 'radio',
      checked: prefs['media-player'] === 'VLC'
    });
    create({
      id: 'media-player-POT',
      title: 'PotPlayer (Windows Only)',
      contexts: ['action'],
      parentId: 'media-player',
      type: 'radio',
      checked: prefs['media-player'] === 'POT'
    });
    create({
      id: 'media-player-QMP',
      title: 'QMPlay2',
      contexts: ['action'],
      parentId: 'media-player',
      type: 'radio',
      checked: prefs['media-player'] === 'QMP'
    });
  });
  if (isFF === false) {
    create({
      id: 'separator',
      type: 'separator',
      contexts: ['action']
    });
  }
  create({
    id: 'download-hls',
    title: 'Download Live Streams',
    contexts: ['action']
  });
  create({
    id: 'mp3-converter',
    title: 'Convert to MP3',
    contexts: ['action']
  });
  if (isFF) {
    create({
      id: 'open-options',
      title: 'Open Options',
      contexts: ['action']
    });
  }
};
context.link = () => chrome.storage.local.get({
  'media-types': TYPES
}, prefs => {
  chrome.contextMenus.remove('link', () => {
    chrome.runtime.lastError;
    const types = prefs['media-types'];

    if (types.length) {
      create({
        id: 'link',
        title: 'Open in VLC',
        contexts: ['link'],
        documentUrlPatterns: ['*://*/*', 'file://*/*'],
        targetUrlPatterns: [
          '*://www.youtube.com/watch?v=*',
          '*://www.youtube.com/embed/*',
          '*://www.google.com/url?*www.youtube.com%2Fwatch*',
          ...types.map(s => `*://*/*.${s}*`)
        ]
      });
    }
  });
});
chrome.runtime.onStartup.addListener(context);
chrome.runtime.onInstalled.addListener(context);
chrome.storage.onChanged.addListener(ps => {
  if (ps['media-types']) {
    context.link();
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'copy-links') {
    chrome.scripting.executeScript({
      target: {
        tabId: tab.id
      },
      func: () => self.links ? [...self.links.keys()] : []
    }).then(r => {
      const links = r[0]?.result || [];
      if (links.length) {
        copy(tab.id, links.join('\n'));
      }
      else {
        notify('There is no media link for this page', tab.id);
      }
    }).catch(e => notify(e.message, tab.id));
  }
  else if (info.menuItemId === 'page-link') {
    chrome.storage.local.get({
      'runtime': 'com.add0n.node'
    }, prefs => open(tab, tab.id, tab.url));
  }
  else if (info.menuItemId === 'mp3-converter') {
    chrome.tabs.create({
      url: 'https://webbrowsertools.com/convert-to-mp3/'
    });
  }
  else if (info.menuItemId === 'download-hls') {
    chrome.tabs.create({
      url: 'https://webextension.org/listing/hls-downloader.html'
    });
  }
  else if (info.menuItemId === 'open-options') {
    chrome.runtime.openOptionsPage();
  }
  else if (info.menuItemId.startsWith('media-player-')) {
    const id = info.menuItemId.replace('media-player-', '');
    const key = 'path-' + id;
    chrome.storage.local.get({
      [key]: ''
    }, prefs => {
      chrome.storage.local.set({
        'media-player': id,
        'path': prefs[key]
      });
    });
  }
  else {
    open({
      title: tab.title,
      url: info.srcUrl || info.linkUrl || info.pageUrl
    }, tab.id, tab.url);
  }
});
