
'use strict';

const notify = e => chrome.notifications.create({
  type: 'basic',
  iconUrl: '/data/icons/48.png',
  title: chrome.runtime.getManifest().name,
  message: e.message || e
});

const Native = function () {
  this.callback = null;
  this.channel = chrome.runtime.connectNative('com.add0n.node');

  function onDisconnect() {
    chrome.tabs.create({
      url: '/data/helper/index.html'
    });
  }

  this.channel.onDisconnect.addListener(onDisconnect);
  this.channel.onMessage.addListener(res => {
    if (!res) {
      chrome.tabs.create({
        url: '/data/helper/index.html'
      });
    }
    else if (res.code && (res.code !== 0 && (res.code !== 1 || res.stderr !== ''))) {
      notify(`Something went wrong!

-----
Code: ${res.code}
Output: ${res.stdout}
Error: ${res.stderr}`
      );
    }
    else if (this.callback) {
      this.callback(res);
    }
    else {
      console.error(res);
    }
    // https://github.com/andy-portmen/native-client/issues/32#issuecomment-328252287
    if (res && 'code' in res) {
      this.channel.disconnect();
    }
  });
};
Native.prototype.env = function (callback) {
  this.callback = function (res) {
    callback(res);
  };
  this.channel.postMessage({
    cmd: 'env'
  });
};

Native.prototype.exec = function (command, args, callback = function () { }) {
  this.callback = function (res) {
    callback(res);
  };
  this.channel.postMessage({
    cmd: 'exec',
    command,
    arguments: args
  });
};

// handle multiple links
const toM3U8 = (urls, callback) => chrome.runtime.sendNativeMessage('com.add0n.node', {
  permissions: ['crypto', 'fs', 'os', 'path', 'child_process'],
  args: [urls.join('\n')],
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
}, callback);

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
              console.warn('native exited', chrome.runtime.lastError);
            }
            else if (r && r.e) {
              console.warn('unexpected error', r.e);
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

chrome.contextMenus.create({
  id: 'player',
  title: 'Open in VLC',
  contexts: ['video', 'audio'],
  documentUrlPatterns: ['*://*/*', 'file://*/*']
});
chrome.contextMenus.create({
  id: 'link',
  title: 'Open in VLC',
  contexts: ['link'],
  documentUrlPatterns: ['*://*/*', 'file://*/*'],
  targetUrlPatterns: [
    '*://www.youtube.com/watch?v=*',
    '*://www.youtube.com/embed/*',
    '*://www.google.com/url?*www.youtube.com%2Fwatch*',
    '*://*/*.avi*',
    '*://*/*.mp4*',
    '*://*/*.webm*',
    '*://*/*.flv*',
    '*://*/*.mov*',
    '*://*/*.ogv*',
    '*://*/*.3gp*',
    '*://*/*.mpg*',
    '*://*/*.wmv*',
    '*://*/*.swf*',
    '*://*/*.mkv*',
    '*://*/*.pcm*',
    '*://*/*.wav*',
    '*://*/*.aac*',
    '*://*/*.ogg*',
    '*://*/*.wma*',
    '*://*/*.flac*',
    '*://*/*.mid*',
    '*://*/*.mka*',
    '*://*/*.m4a*',
    '*://*/*.mp3*',
    '*://*/*.voc*'
  ]
});
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
  contexts: ['page_action']
});
chrome.contextMenus.create({
  id: 'page-link',
  title: 'Send Page Link to VLC',
  contexts: ['page_action']
});
chrome.contextMenus.create({
  id: 'audio-joiner',
  title: 'Join Audio Files',
  contexts: ['page_action']
});
chrome.contextMenus.create({
  id: 'mp3-converter',
  title: 'Convert to MP3',
  contexts: ['page_action']
});

const tabs = {};
// clean up
chrome.tabs.onRemoved.addListener(tabId => delete tabs[tabId]);

function update(tabId) {
  chrome.pageAction.show(tabId);
  const length = Object.keys(tabs[tabId]).length;
  chrome.pageAction.setTitle({
    tabId,
    title: length + ' media link(s)'
  });
  chrome.pageAction.setIcon({
    tabId,
    path: {
      '16': 'data/icons/' + (length === 1 ? 'single' : 'multiple') + '/16.png',
      '32': 'data/icons/' + (length === 1 ? 'single' : 'multiple') + '/32.png'
    }
  });
}


chrome.webRequest.onHeadersReceived.addListener(d => {
  if (d.type === 'main_frame') {
    tabs[d.tabId] = {};
  }

  let type = d.responseHeaders.filter(h => h.name === 'Content-Type' || h.name === 'content-type')
    .filter(h => h.value.startsWith('video') || h.value.startsWith('audio'))
    .map(h => h.value.split('/')[1].split(';')[0]).shift();
  if (d.url.toLowerCase().indexOf('.m3u8') !== -1) {
    type = 'm3u8';
  }


  if (type) {
    let blacklistArray = []

    tabs[d.tabId] = tabs[d.tabId] || {};

    tabs[d.tabId][d.url] = {
      type,
      size: d.responseHeaders.filter(h => h.name === 'Content-Length' || h.name === 'content-length').map(o => o.value).shift()
    };
    // console.log("tabs", tabs)

    chrome.storage.local.get({
      'blacklist': ''
    }, prefs => {
      if (prefs.blacklist) {
        blacklistArray = prefs.blacklist.split(",")
        // console.log("blacklist", blacklistArray);

        // console.log("Object.keys(tabs[d.tabId])", Object.keys(tabs[d.tabId]));

        Object.keys(tabs[d.tabId]).forEach(url => {
          // console.log("foreach", url);
          if (new RegExp(blacklistArray.join("|")).test(url)) {
            // console.log("Match using '" + url + "'",);
            delete tabs[d.tabId][url]
            // console.log("tabs2", tabs)
          }
        })
      }


      update(d.tabId);
    })
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

function copy(tabId, content) {
  if (/Firefox/.test(navigator.userAgent)) {
    chrome.permissions.request({
      permissions: ['clipboardWrite']
    }, granted => granted && chrome.tabs.executeScript(tabId, {
      runAt: 'document_start',
      code: `
        document.oncopy = event => {
          event.clipboardData.setData('text/plain', '${content}');
          event.preventDefault();
        };
        window.focus();
        document.execCommand('Copy', false, null);
      `
    }, () => {
      if (chrome.runtime.lastError) {
        return notify(chrome.runtime.lastError.message);
      }
      notify('Copied to the clipboard');
    }));
  }
  else {
    document.oncopy = e => {
      e.clipboardData.setData('text/plain', content);
      e.preventDefault();
      copy.urls = [];
      notify('Copied to the clipboard');
    };
    document.execCommand('Copy', false, null);
  }
}

// actions
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'copy-links') {
    const detected = Object.keys(tabs[tab.id] || {});
    if (detected.length) {
      copy(tab.id, detected.join('\n'));
    }
    else {
      notify('There is no media link for this page');
    }
  }
  else if (info.menuItemId === 'page-link') {
    open(tab.url, new Native());
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
  else {
    open(info.srcUrl || info.linkUrl || info.pageUrl, new Native());
  }
});

chrome.pageAction.onClicked.addListener(tab => {
  // VLC can play YouTube. Allow user to send the YouTube link to VLC
  if (tab.url.startsWith('https://www.youtube.com/watch?v=')) {
    const native = new Native();
    open(tab.url, native);
  }
  else {
    const links = Object.keys(tabs[tab.id]);
    if (links.length === 1) {
      const native = new Native();
      open(links[0], native);
    }
    else {
      chrome.tabs.executeScript(tab.id, {
        'runAt': 'document_start',
        'allFrames': false,
        'file': '/data/inject/inject.js'
      });
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.cmd === 'get-links') {
    console.log(sender)
    response([[sender.tab.url], ...Object.entries(tabs[sender.tab.id])]);
  }
  else if (request.cmd === 'copy') {
    copy(sender.tab.id, request.content);
  }
  else if (request.cmd === 'notify') {
    notify(request.message);
  }
  else if (request.cmd === 'close-me') {
    chrome.tabs.executeScript(sender.tab.id, {
      'runAt': 'document_start',
      'allFrames': false,
      'code': `
        if (window.iframe) {
          window.iframe.remove();
          window.iframe = '';
        }
      `
    });
  }
  else if (request.cmd === 'open-in') {
    const native = new Native();
    open(request.url, native);
  }
  else if (request.cmd === 'combine') {
    chrome.storage.local.get({
      'm3u8': true
    }, prefs => {
      const native = new Native();
      if (prefs.m3u8) {
        toM3U8(request.urls, resp => {
          if (resp && resp.err) {
            notify(resp.err);
          }
          else if (resp && resp.filename) {
            open(resp.filename, native);
          }
          else {
            chrome.tabs.create({
              url: '/data/helper/index.html'
            });
          }
        });
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
  const { management, runtime: { onInstalled, setUninstallURL, getManifest }, storage, tabs } = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const { name, version } = getManifest();
    onInstalled.addListener(({ reason, previousVersion }) => {
      management.getSelf(({ installType }) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install'
            });
            storage.local.set({ 'last-update': Date.now() });
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
