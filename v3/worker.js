/* global Native */

// self.importScripts('native.js');
// self.importScripts('context.js');

const notify = (e, tabId) => {
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
};

// handle multiple links
const toM3U8 = (urls, callback, title) => chrome.storage.local.get({
  'use-page-title': true
}, prefs => chrome.runtime.sendNativeMessage('com.add0n.node', {
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

const open = (url, native) => {
  // decode
  if (url.startsWith('https://www.google.') && url.indexOf('&url=') !== -1) {
    url = decodeURIComponent(url.split('&url=')[1].split('&')[0]);
  }

  if (navigator.userAgent.indexOf('Mac') !== -1) {
    native.exec('open', ['-a', 'VLC', url]);
  }
  else {
    chrome.storage.local.get({
      path: null
    }, prefs => {
      if (navigator.userAgent.indexOf('Linux') !== -1) {
        native.exec(prefs.path || 'vlc', [url]);
      }
      else if (prefs.path) {
        native.exec(prefs.path, [url]);
      }
      else { // Windows
        native.env(res => {
          const paths = [
            res.env['ProgramFiles(x86)'] + '\\VideoLAN\\VLC\\vlc.exe',
            res.env['ProgramFiles'] + '\\VideoLAN\\VLC\\vlc.exe'
          ];
          chrome.runtime.sendNativeMessage('com.add0n.node', {
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
            }, () => native.exec(path, [url]));
          });
        });
      }
    });
  }
};

// clean up
chrome.tabs.onRemoved.addListener(tabId => {
  chrome.storage.session.remove(tabId + '');
});

function update(tabId) {
  chrome.storage.session.get({
    [tabId]: {}
  }, prefs => {
    const length = Object.keys(prefs[tabId]).length;
    const title = length + ' media link' + (length === 1 ? '' : 's');
    chrome.action.setTitle({
      tabId,
      title
    });
    chrome.action.setIcon({
      tabId,
      path: {
        '16': 'data/icons/' + (length === 1 ? 'single' : 'multiple') + '/16.png',
        '32': 'data/icons/' + (length === 1 ? 'single' : 'multiple') + '/32.png'
      }
    });
  });
}

chrome.webRequest.onHeadersReceived.addListener(async d => {
  if (d.type === 'main_frame') {
    await new Promise(resolve => chrome.storage.session.set({
      [d.tabId]: {}
    }, resolve));
  }
  // do not detect YouTube
  if (d.url && d.url.indexOf('.googlevideo.com/') !== -1) {
    return;
  }
  let type = d.responseHeaders.filter(h => h.name === 'Content-Type' || h.name === 'content-type')
    .filter(h => h.value.startsWith('video') || h.value.startsWith('audio'))
    .map(h => h.value.split('/')[1].split(';')[0]).shift();
  if (d.url.toLowerCase().indexOf('.m3u8') !== -1) {
    type = 'm3u8';
  }

  if (type) {
    chrome.storage.session.get({
      [d.tabId]: {}
    }, prefs => {
      prefs[d.tabId][d.url] = {
        type,
        size: d.responseHeaders.filter(h => h.name === 'Content-Length' || h.name === 'content-length').map(o => o.value).shift()
      };
      chrome.storage.session.set(prefs, () => update(d.tabId));
    });
  }
}, {
  urls: ['*://*/*'],
  types: ['main_frame', 'other', 'xmlhttprequest', 'media']
}, ['responseHeaders']);

chrome.tabs.onUpdated.addListener((id, info, tab) => {
  if (info.url || info.favIconUrl) {
    if (tab.url.startsWith('https://www.youtube.com/watch?v=')) {
      return update(id);
    }
  }
});

const copy = async (tabId, content) => {
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
};

// actions
chrome.action.onClicked.addListener(tab => {
  // VLC can play YouTube. Allow user to send the YouTube link to VLC
  if (tab.url && tab.url.startsWith('https://www.youtube.com/watch?v=')) {
    open(tab.url, new Native(tab.id));
  }
  else {
    chrome.storage.session.get({
      [tab.id]: {}
    }, prefs => {
      const links = Object.keys(prefs[tab.id]);
      if (links.length === 1) {
        const native = new Native(tab.id);
        open(links[0], native);
      }
      else if (links.length > 1) {
        chrome.scripting.executeScript({
          target: {
            tabId: tab.id
          },
          files: ['/data/inject/inject.js']
        });
      }
      else if (tab.url) {
        open(tab.url, new Native(tab.id));
      }
      else {
        notify('Cannot send an internal page to VLC', tab.id);
      }
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.cmd === 'get-links') {
    chrome.storage.session.get({
      [sender.tab.id]: {}
    }, prefs => {
      response([[sender.tab.url], ...Object.entries(prefs[sender.tab.id])]);
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
        try {
          window.iframe.remove();
          window.iframe = '';
        }
        catch (e) {}
      }
    });
  }
  else if (request.cmd === 'open-in') {
    const native = new Native(sender.tab.id);
    open(request.url, native);
  }
  else if (request.cmd === 'combine') {
    chrome.storage.local.get({
      'm3u8': true
    }, prefs => {
      const native = new Native(sender.tab.id);
      if (prefs.m3u8) {
        toM3U8(request.urls, resp => {
          if (resp && resp.err) {
            notify(resp.err, sender.tab.id);
          }
          else if (resp && resp.filename) {
            open(resp.filename, native);
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
          open(url, native);
        }
      }
    });
  }
});

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
