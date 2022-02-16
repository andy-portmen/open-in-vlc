/* global Native, copy, notify */

const context = () => {
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
chrome.runtime.onStartup.addListener(context);
chrome.runtime.onInstalled.addListener(context);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'copy-links') {
    chrome.storage.session.get({
      [tab.id]: {}
    }, prefs => {
      const detected = Object.keys(prefs[tab.id]);
      if (detected.length) {
        copy(tab.id, detected.join('\n'));
      }
      else {
        notify('There is no media link for this page', tab.id);
      }
    });
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
  else if (info.menuItemId === 'download-hls') {
    chrome.tabs.create({
      url: 'https://add0n.com/hls-downloader.html'
    });
  }
  else {
    open(info.srcUrl || info.linkUrl || info.pageUrl, new Native());
  }
});
