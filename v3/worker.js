/* global Native, TYPES */

self.importScripts('const.js');
self.importScripts('native.js');
self.importScripts('context.js');

const is = {
  mac: /Mac/i.test(navigator.platform),
  linux: /Linux/i.test(navigator.platform)
};

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
const toM3U8 = (urls, callback, title) => chrome.storage.local.get({
  'use-page-title': true,
  'runtime': 'com.add0n.node'
}, prefs => chrome.runtime.sendNativeMessage(prefs.runtime, {
  permissions: ['crypto', 'fs', 'os', 'path', 'child_process'],
  args: [`#EXTM3U
` + urls.map(url => {
    if (title && prefs['use-page-title']) {
      return `#EXTINF:-1,${title}` + '\n' + url;
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

const open = (tab, tabId) => {
  let {url} = tab;
  const {title} = tab;

  chrome.storage.local.get({
    'path': null,
    'send-title-meta': true,
    'one-instance': true,
    'custom-arguments': [],
    'runtime': 'com.add0n.node'
  }, prefs => {
    const args = prefs['custom-arguments'];
    // macOS does not support this argument
    if (prefs['one-instance'] && is.mac === false) {
      args.push('--one-instance');
    }

    // decode
    if (url.startsWith('https://www.google.') && url.includes('&url=')) {
      url = decodeURIComponent(url.split('&url=')[1].split('&')[0]);
    }

    args.push(url); // meta title must be appended to this (https://code.videolan.org/videolan/vlc/-/issues/22560)

    if (title && prefs['send-title-meta']) {
      // since we are using "open -a VLC URL --args" we can not send meta data appended after the URL
      if (is.mac && prefs['one-instance']) {
        args.push(`--meta-title=${title}`);
      }
      else {
        args.push(`:meta-title=${title}`);
      }
    }

    const native = new Native(tabId, prefs.runtime);

    if (is.mac) {
      if (prefs['one-instance']) {
        const href = url;
        args.splice(args.indexOf(url), 1);

        const mArgs = ['-a', 'VLC', href];
        if (args.length > 0) {
          mArgs.push('--args', ...args);
        }

        native.exec('open', mArgs);
      }
      else {
        native.exec('/Applications/VLC.app/Contents/MacOS/VLC', args);
      }
    }
    else {
      if (is.linux) {
        native.exec(prefs.path || 'vlc', args);
      }
      else if (prefs.path) {
        native.exec(prefs.path, args);
      }
      else { // Windows
        native.env().then(res => {
          const paths = [
            res.env['ProgramFiles(x86)'] + '\\VideoLAN\\VLC\\vlc.exe',
            res.env['ProgramFiles'] + '\\VideoLAN\\VLC\\vlc.exe'
          ];
          chrome.runtime.sendNativeMessage(prefs.runtime, {
            permissions: ['fs'],
            args: [...paths],
            script: `
              const fs = require('fs');
              const exist = path => new Promise(resolve => fs.access(path, fs.F_OK, e => {
                resolve(e ? false : true);
              }));
              Promise.all(args.map(exist)).then(d => {
                push({d});
                done();
              }).catch(e => push({e: e.message}));
            `
          }, r => {
            if (!r) {
              console.warn('Native Client Exited', chrome.runtime.lastError);
            }
            else if (r && r.e) {
              console.warn('Unexpected Error', r.e);
            }
            const path = r && r.d[1] ? paths[1] : (res.env['ProgramFiles(x86)'] ? paths[0] : paths[1]);
            chrome.storage.local.set({
              path
            }, () => native.exec(path, args));
          });
        });
      }
    }
  });
};

function update(tabId, count = '') {
  const title = count ? (count + ' media link' + (count === 1 ? '' : 's')) : chrome.runtime.getManifest().action['default_title'];
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

const store = (tabId, href, type, size = '') => {
  const date = Date.now();
  chrome.storage.local.get({
    'blacklist': [],
    'max-number-of-items': 200
  }, ps => {
    if (ps.blacklist.length && new RegExp(ps.blacklist.join('|')).test(href)) {
      return;
    }
    chrome.scripting.executeScript({
      target: {
        tabId: tabId
      },
      func: (max, href, type, size, date) => {
        self.links = self.links || {};
        self.links[href] = {
          type,
          size,
          date
        };
        const c = Object.keys(self.links).length;
        if (c > max) {
          const dates = Object.values(self.links).map(o => o.date);
          dates.sort();

          const rd = dates.slice(0, c - max);

          for (const [href, o] of Object.entries(self.links)) {
            if (rd.includes(o.date)) {
              delete self.links[href];
            }
          }
        }

        return Object.keys(self.links).length;
      },
      args: [ps['max-number-of-items'], href, type, size, date]
    }).then(r => {
      update(tabId, r ? r[0]?.result : '');
    });
  });
};

chrome.webRequest.onHeadersReceived.addListener(d => {
  if (d.type === 'main_frame' || d.frameType === '"outermost_frame"') {
    if (d.url.startsWith('https://www.youtube.com/watch?v=')) {
      update(d.tabId, 1);
    }
  }

  // do not detect YouTube
  if (d.url && (d.url.includes('.googlevideo.com/') || (d.initiator || '').startsWith('https://www.youtube.com'))) {
    return;
  }

  let type = d.responseHeaders.filter(h => h.name === 'Content-Type' || h.name === 'content-type')
    .filter(h => h.value.startsWith('video') || h.value.startsWith('audio'))
    .map(h => h.value.split('/')[1].split(';')[0]).shift();
  const href = d.url.toLowerCase();
  // forced stream detection
  if (href.includes('.m3u8')) {
    type = 'm3u8';
  }
  // types from UTL
  if (!type) {
    type = TYPES.find(s => href.includes('.' + s));
  }

  if (type) {
    const size = d.responseHeaders.filter(h => h.name === 'Content-Length' || h.name === 'content-length').map(o => o.value).shift();
    store(d.tabId, d.url, type, size);
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
    open(tab, tab.id);
  }
  else {
    chrome.scripting.executeScript({
      target: {
        tabId: tab.id
      },
      func: () => Object.keys(self.links || {})
    }).then(async r => {
      if (r) {
        const links = r[0]?.result || [];

        if (links.length === 1) {
          open({
            title: tab.title,
            url: links[0]
          }, tab.id);
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
          open(tab, tab.id);
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
      func: () => self.links || {}
    }).then(r => {
      response([[sender.tab.url], ...Object.entries(r[0]?.result || {})]);
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
    }, sender.tab.id);
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
            }, sender.tab.id);
          }
          else {
            chrome.tabs.create({
              url: '/data/helper/index.html'
            });
          }
        }, sender.tab.title);
      }
      else {
        for (const url of request.urls) {
          open({
            title: sender.tab.title,
            url
          }, sender.tab.id);
        }
      }
    });
  }
});

{
  const once = () => chrome.action.setBadgeBackgroundColor({
    color: '#e17960'
  });
  chrome.runtime.onInstalled.addListener(once);
  chrome.runtime.onStartup.addListener(once);
}

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const {name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.query({active: true, currentWindow: true}, tbs => tabs.create({
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
