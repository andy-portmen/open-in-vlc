/* global Native, TYPES, copy, notify */

const context = () => {
  chrome.contextMenus.create({
    id: 'player',
    title: 'Open in VLC',
    contexts: ['video', 'audio'],
    documentUrlPatterns: ['*://*/*', 'file://*/*']
  });
  context.link();
  chrome.contextMenus.create({
    id: 'page',
    title: 'Open in VLC',
    contexts: ['page'],
    documentUrlPatterns: [
      '*://www.youtube.com/watch?v=*'
    ]
  });
  chrome.contextMenus.create({
    id: 'copy-links',
    title: 'Copy Media Links to the Clipboard',
    contexts: ['action', 'browser_action']
  });
  chrome.contextMenus.create({
    id: 'page-link',
    title: 'Send Page Link to VLC',
    contexts: ['action', 'browser_action']
  });
  chrome.contextMenus.create({
    id: 'separator',
    type: 'separator',
    contexts: ['action', 'browser_action']
  });
  chrome.contextMenus.create({
    id: 'download-hls',
    title: 'Download Live Streams',
    contexts: ['action', 'browser_action']
  });
  chrome.contextMenus.create({
    id: 'audio-joiner',
    title: 'Join Audio Files',
    contexts: ['action', 'browser_action']
  });
  chrome.contextMenus.create({
    id: 'mp3-converter',
    title: 'Convert to MP3',
    contexts: ['action', 'browser_action']
  });
};
context.link = () => chrome.storage.local.get({
  'media-types': TYPES
}, prefs => {
  chrome.contextMenus.remove('link', () => {
    chrome.runtime.lastError;
    const types = prefs['media-types'];

    if (types.length) {
      chrome.contextMenus.create({
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
      func: () => {
        // sorting
        return Object.entries(self.links || {}).sort(([, aO], [, bO]) => {
          if (bO && bO.type === 'm3u8') {
            return 1;
          }
          if (aO && aO.type === 'm3u8') {
            return -1;
          }
          return aO.date - bO.date;
        }).map(a => a[0]);
      }
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
    open(tab, new Native());
  }
  else if (info.menuItemId === 'audio-joiner') {
    chrome.tabs.create({
      url: 'https://webbrowsertools.com/audio-joiner/'
    });
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
  else {
    open({
      title: tab.title,
      url: info.srcUrl || info.linkUrl || info.pageUrl
    }, new Native());
  }
});
