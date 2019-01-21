
'use strict';

var Native = function() {
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
      window.alert(`Something went wrong!

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
Native.prototype.env = function(callback) {
  this.callback = function(res) {
    callback(res);
  };
  this.channel.postMessage({
    cmd: 'env'
  });
};

Native.prototype.exec = function(command, args, callback = function() {}) {
  this.callback = function(res) {
    callback(res);
  };
  this.channel.postMessage({
    cmd: 'exec',
    command,
    arguments: args
  });
};

// handle multiple links
var toM3U8 = (urls, callback) => chrome.runtime.sendNativeMessage('com.add0n.node', {
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

var open = (url, native) => {
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
      else {
        native.env(res => {
          const path = res.env['ProgramFiles(x86)'] + '\\VideoLAN\\VLC\\vlc.exe'
            .replace('(x86)', window.navigator.platform === 'Win32' ? '' : '(x86)');
          chrome.storage.local.set({
            path
          }, () => native.exec(path, [url]));
        });
      }
    });
  }
};

chrome.contextMenus.create({
  id: 'player',
  title: 'Open in VLC',
  contexts: ['video', 'audio'],
  documentUrlPatterns: ['*://*/*']
});
chrome.contextMenus.create({
  id: 'link',
  title: 'Open in VLC',
  contexts: ['link'],
  documentUrlPatterns: ['*://*/*'],
  targetUrlPatterns: [
    '*://www.youtube.com/watch?v=*',
    '*://www.youtube.com/embed/*',
    '*://www.google.com/url?*www.youtube.com%2Fwatch*',
    '*://*/*.mp3*',
    '*://*/*.mp4*',
    '*://*/*.flv*',
    '*://*/*.mkv*',
    '*://*/*.3gp*'
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
  title: 'Copy media links to the Clipboard',
  contexts: ['page_action']
});
chrome.contextMenus.create({
  id: 'page-link',
  title: 'Send page link to VLC',
  contexts: ['page_action']
});

var tabs = {};

function update(tabId) {
  chrome.pageAction.show(tabId);
  chrome.pageAction.setTitle({
    tabId,
    title: Object.keys(tabs[tabId]).length + ' media link(s)'
  });
}

chrome.webRequest.onHeadersReceived.addListener(d => {
  if (d.type === 'main_frame') {
    tabs[d.tabId] = {};
  }

  const types = d.responseHeaders.filter(h => h.name === 'Content-Type' || h.name === 'content-type')
    .map(h => h.value.split('/')[0]).filter(v => v === 'video' || v === 'audio');
  if (types.length) {
    tabs[d.tabId] = tabs[d.tabId] || {};
    tabs[d.tabId][d.url] = true;

    update(d.tabId);
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
// clean up
chrome.tabs.onRemoved.addListener(tabId => delete tabs[tabId]);

function copy(tabId, content) {
  if (/Firefox/.test(navigator.userAgent)) {
    chrome.permissions.request({
      permissions: ['clipboardWrite']
    }, granted => granted && chrome.tabs.executeScript(tabId, {
      runAt: 'document_start',
      code: `
        document.oncopy = (event) => {
          event.clipboardData.setData('text/plain', '${content}');
          event.preventDefault();
        };
        window.focus();
        document.execCommand('Copy', false, null);
      `
    }, () => {
      if (chrome.runtime.lastError) {
        window.alert(chrome.runtime.lastError.message);
      }
    }));
  }
  else {
    document.oncopy = e => {
      e.clipboardData.setData('text/plain', content);
      e.preventDefault();
      copy.urls = [];
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
      window.alert('There is no media link for this page');
    }
  }
  else if (info.menuItemId === 'page-link') {
    open(tab.url, new Native());
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
    response([sender.tab.url, ...Object.keys(tabs[sender.tab.id])]);
  }
  else if (request.cmd === 'close-me') {
    chrome.tabs.executeScript(sender.tab.id, {
      'runAt': 'document_start',
      'allFrames': false,
      'code': `
        if (iframe) {
          iframe.remove();
          iframe = '';
        }
      `
    });
  }
  else if (request.cmd === 'open-in') {
    const native = new Native();
    open(request.url, native);
  }
  else if (request.cmd === 'combine') {
    toM3U8(request.urls, resp => {
      if (resp && resp.err) {
        window.alert(resp.err);
      }
      else if (resp && resp.filename) {
        open(resp.filename, new Native());
      }
      else {
        chrome.tabs.create({
          url: '/data/helper/index.html'
        });
      }
    });
  }
});

// FAQs & Feedback
chrome.storage.local.get({
  'version': null,
  'faqs': true,
  'last-update': 0
}, prefs => {
  const version = chrome.runtime.getManifest().version;

  if (prefs.version ? (prefs.faqs && prefs.version !== version) : true) {
    const now = Date.now();
    const doUpdate = (now - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
    chrome.storage.local.set({
      version,
      'last-update': doUpdate ? Date.now() : prefs['last-update']
    }, () => {
      // do not display the FAQs page if last-update occurred less than 45 days ago.
      if (doUpdate) {
        const p = Boolean(prefs.version);
        chrome.tabs.create({
          url: chrome.runtime.getManifest().homepage_url + '&version=' + version +
            '&type=' + (p ? ('upgrade&p=' + prefs.version) : 'install'),
          active: p === false
        });
      }
    });
  }
});

{
  const {name, version} = chrome.runtime.getManifest();
  chrome.runtime.setUninstallURL(
    chrome.runtime.getManifest().homepage_url + '&rd=feedback&name=' + name + '&version=' + version
  );
}
