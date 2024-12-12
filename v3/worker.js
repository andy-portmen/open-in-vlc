/* global TYPES */

if (typeof importScripts !== 'undefined') {
  self.importScripts('const.js', 'native.js', 'context.js', 'open.js');
}

const notify = self.notify = (e, tabId) => {
  chrome.action.setTitle({
    tabId,
    title: e.message || e
  });
  chrome.action.setBadgeBackgroundColor({
    tabId,
    color: 'red'
  });
  chrome.action.setBadgeText({
    tabId,
    text: 'E'
  });
  chrome.scripting.executeScript({
    target: {
      tabId
    },
    func: msg => alert(msg),
    args: [e.message || e]
  }).catch(() => {});
};

// handle multiple links
const toM3U8 = (urls, callback, tab) => chrome.storage.local.get({
  'use-page-title': true,
  'send-referrer': true,
  'send-user-agent': true,
  'runtime': 'com.add0n.node'
}, prefs => chrome.runtime.sendNativeMessage(prefs.runtime, {
  permissions: ['crypto', 'fs', 'os', 'path', 'child_process'],
  args: [`#EXTM3U
` + (prefs['send-referrer'] && tab.url ? '#EXTVLCOPT:http-referrer=' + tab.url + '\n' : '') +
    (prefs['send-user-agent'] ? '#EXTVLCOPT:http-user-agent=' + navigator.userAgent + '\n' : '') + urls.map(url => {
    if (tab.title && prefs['use-page-title']) {
      return `#EXTINF:-1,${tab.title}` + '\n' + url;
    }
    return url;
  }).join('\n')],
  script: `
    const path = require('path');

    const filename = path.join(
      require('os').tmpdir(),
      'media-' + require('crypto').randomBytes(4).readUInt32LE(0) + '.m3u8'
    );
    require('fs').writeFile(filename, args[0], err => {
      if (err) {
        push({
          err: err.message || err
        });
        done();
      }
      push({
        filename
      });
      done();
    });
  `
}, callback));

function update(tabId, count = '') {
  const title = count ?
    (count + ' media link' + (count === 1 ? '' : 's')) :
    chrome.runtime.getManifest().action['default_title'];
  chrome.action.setTitle({
    tabId,
    title
  });
  // chrome.action.setBadgeText({
  //   tabId,
  //   text: count && count > 1 ? count.toString() : ''
  // });

  const path = count ? (count === 1 ? 'single/' : 'multiple/') : '';
  chrome.action.setIcon({
    tabId,
    path: {
      '16': '/data/icons/' + path + '16.png',
      '32': '/data/icons/' + path + '32.png'
    }
  });
}

const store = async (d, type, size = '') => {
  if (!store.prefs) {
    store.prefs = await chrome.storage.local.get({
      'blacklist': [],
      'max-number-of-items': 100
    });
    store.check = store.prefs.blacklist.length ? new RegExp(store.prefs.blacklist.join('|')) : false;
  }

  if (store.check && store.check.test(d.href)) {
    return;
  }

  chrome.scripting.executeScript({
    target: {
      tabId: d.tabId
    },
    func: (max, href, type, size) => {
      self.links = self.links || new Map();
      self.links.set(href, {
        type,
        size
      });
      // cleanup
      if (self.links.size > max) {
        const firstKey = self.links.keys().next().value;
        self.links.delete(firstKey);
      }

      return self.links.size;
    },
    args: [store.prefs['max-number-of-items'], d.url, type, size]
  }).then(r => {
    update(d.tabId, r ? r[0]?.result : '');
  });
};

chrome.webRequest.onHeadersReceived.addListener(d => {
  if (d.type === 'main_frame' || d.frameType === 'outermost_frame') {
    if (d.url.startsWith('https://www.youtube.com/watch?v=')) {
      update(d.tabId, 1);
    }
  }

  // do not detect YouTube
  if (d.url && (d.url.includes('.googlevideo.com/') || (d.initiator || '').startsWith('https://www.youtube.com'))) {
    return;
  }

  const href = d.url.toLowerCase();

  let type;
  if (href.includes('.m3u8')) {
    type = 'm3u8';
  }
  else {
    const header = href.includes('.m3u8') ? 'm3u8' : d.responseHeaders.find(h => {
      return (h.name === 'Content-Type' || h.name === 'content-type') &&
        (h.value.startsWith('video') || h.value.startsWith('audio'));
    });
    if (header) {
      type = header.value.split('/')[1].split(';')[0];
    }
  }

  // types from UTL
  if (!type) {
    if (TYPES.regex.test(href)) {
      // Should not match https://s.to/site.webmanifest for instance
      type = TYPES.find(s => (new RegExp('.' + s + '\\b')).test(href));
    }
  }

  if (type) {
    const size = d.responseHeaders.filter(h => h.name.toLowerCase() === 'content-length').map(o => o.value).shift();
    store(d, type, size);
  }
}, {
  urls: ['*://*/*'],
  types: ['main_frame', 'other', 'xmlhttprequest', 'media']
}, ['responseHeaders']);

const copy = async (tabId, content) => {
  try {
    await navigator.clipboard.writeText(content);
  }
  catch (e) {
    const win = await chrome.windows.getCurrent();
    chrome.storage.local.get({
      width: 400,
      height: 300,
      left: win.left + Math.round((win.width - 400) / 2),
      top: win.top + Math.round((win.height - 300) / 2)
    }, prefs => {
      chrome.windows.create({
        url: '/data/copy/index.html?content=' + encodeURIComponent(content),
        width: prefs.width,
        height: prefs.height,
        left: prefs.left,
        top: prefs.top,
        type: 'popup'
      });
    });
  }
};

// actions
chrome.action.onClicked.addListener(tab => {
  // VLC can play YouTube. Allow user to send the YouTube link to VLC
  if (tab.url && tab.url.startsWith('https://www.youtube.com/watch?v=')) {
    open(tab, tab.id, tab.url);
  }
  else {
    chrome.scripting.executeScript({
      target: {
        tabId: tab.id
      },
      func: () => self.links ? [...self.links.keys()] : []
    }).then(async r => {
      if (r) {
        const links = r[0]?.result || [];

        if (links.length === 1) {
          open({
            title: tab.title,
            url: links[0]
          }, tab.id, tab.url);
        }
        else if (links.length > 1) {
          await chrome.scripting.insertCSS({
            target: {
              tabId: tab.id
            },
            files: ['/data/inject/inject.css']
          });
          chrome.scripting.executeScript({
            target: {
              tabId: tab.id
            },
            files: ['/data/inject/inject.js']
          });
        }
        else if (tab.url) {
          open(tab, tab.id, tab.url);
        }
        else {
          notify('Cannot send an internal page to VLC', tab.id);
        }
      }
    }).catch(e => notify(e, tab.id));
  }
});

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.cmd === 'get-links') {
    chrome.scripting.executeScript({
      target: {
        tabId: sender.tab.id
      },
      func: () => self.links ? [...self.links.entries()] : []
    }).then(r => {
      response([[sender.tab.url], ...(r[0].result || [])]);
    });
    return true;
  }
  else if (request.cmd === 'copy') {
    copy(sender.tab.id, request.content);
  }
  else if (request.cmd === 'close-me') {
    chrome.scripting.executeScript({
      target: {
        tabId: sender.tab.id
      },
      func: () => {
        [...document.querySelectorAll('.open-in-vlc')].forEach(f => f.remove());
      }
    });
  }
  else if (request.cmd === 'open-in') {
    open({
      title: sender.tab.title,
      url: request.url
    }, sender.tab.id, request.referrer);
  }
  else if (request.cmd === 'combine') {
    chrome.storage.local.get({
      'm3u8': true
    }, prefs => {
      if (prefs.m3u8) {
        toM3U8(request.urls, resp => {
          if (resp && resp.err) {
            notify(resp.err, sender.tab.id);
          }
          else if (resp && resp.filename) {
            open({
              title: sender.tab.title,
              url: resp.filename
            }, sender.tab.id, request.referrer);
          }
          else {
            chrome.tabs.create({
              url: '/data/helper/index.html'
            });
          }
        }, sender.tab);
      }
      else {
        for (const url of request.urls) {
          open({
            title: sender.tab.title,
            url
          }, sender.tab.id, request.referrer);
        }
      }
    });
  }
});

{
  const once = () => {
    if (once.done) {
      return;
    }
    once.done = true;
    chrome.action.setBadgeBackgroundColor({
      color: '#e17960'
    });
  };
  chrome.runtime.onInstalled.addListener(once);
  chrome.runtime.onStartup.addListener(once);
}

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const {homepage_url: page, name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.query({active: true, lastFocusedWindow: true}, tbs => tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
