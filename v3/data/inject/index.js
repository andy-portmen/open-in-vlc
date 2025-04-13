'use strict';

const args = {};
const list = document.getElementById('list');

const formatBytes = (bytes, decimals = 0) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

onmessage = e => {
  args.referrer = e.data.referrer;

  document.getElementById('number').textContent = e.data.map.length;

  const active = {
    m3u8: -1,
    media: -1
  };

  e.data.map.forEach(([url, o], index) => {
    let ext = o && o.type ? o.type : url.split(/[#?]/)[0].split('.').pop().trim();
    if (ext.includes('/')) {
      ext = '';
    }
    ext = ext.substr(0, 6);

    if (index) {
      // select latest m3u8
      if (ext === 'm3u8') {
        active.m3u8 = index;
      }
      if (active.media === -1 && o && o.size && Number(o.size) > 1024) {
        active.media = index;
      }

      const size = o.size ? formatBytes(Number(o.size)) : '';
      const tooltip = `Type: ${ext}
Size: ${size}
URL: ${url}`;
      const option = list.option([{
        name: index.toString().padStart(2, '0'),
        part: 'index'
      }, {
        name: ext || '',
        part: 'ext'
      }, {
        name: url
      }, {
        name: size,
        part: 'size'
      }], tooltip, url, false);

      option.insert();
    }
    else {
      const option = list.option([{
        name: '00',
        part: 'index'
      }, {
        name: 'Page',
        part: 'ext'
      }, {
        name: url
      }, {
        name: '',
        part: 'size'
      }], url, url, false);

      option.insert();
    }
  });

  // select
  if (active.m3u8 !== -1) {
    list.selectedIndex = active.m3u8 + 1;
  }
  else if (active.media !== -1) {
    list.selectedIndex = active.media + 1;
  }
  else {
    list.selectedIndex = 1;
  }
};

addEventListener('load', () => setTimeout(() => {
  list.focus();
  window.focus();
}, 0));
// keep focus
addEventListener('blur', () => setTimeout(() => {
  list.focus();
  window.focus();
}, 0));

document.addEventListener('keydown', e => {
  if (e.code === 'Escape') {
    document.querySelector('[data-cmd="close-me"]').click();
  }
  if (e.code === 'Enter') {
    document.querySelector('[data-cmd="open-in"]').click();
  }
});

document.addEventListener('click', e => {
  const cmd = e.target.dataset.cmd;
  if (cmd === 'close-me') {
    chrome.runtime.sendMessage({
      cmd: 'close-me'
    }, () => chrome.runtime.lastError);
  }
  else if (cmd === 'select-all') {
    const {options} = list;

    if (options.length > 1) {
      list.selectedIndex = 2;
      for (let n = 1; n < options.length; n += 1) {
        options[n]._internal.option.selected = true;
      }
    }
    else if (options.length) {
      list.selectedIndex = 1;
    }
  }
  else if (cmd === 'open-in') {
    const urls = list.selectedOptions.map(o => o.parts[2].name);
    if (urls.length === 1) {
      chrome.runtime.sendMessage({
        cmd: 'open-in',
        url: urls[0],
        referrer: args.referrer
      }, () => {
        chrome.runtime.lastError;
        chrome.runtime.sendMessage({
          cmd: 'close-me'
        });
      });
    }
    else if (urls.length > 1) {
      chrome.runtime.sendMessage({
        cmd: 'combine',
        urls,
        referrer: args.referrer
      }, () => {
        chrome.runtime.lastError;
        chrome.runtime.sendMessage({
          cmd: 'close-me'
        });
      });
    }
    else {
      alert('Please select a media link from the list');
    }
  }
  else if (cmd === 'copy') {
    const urls = list.selectedOptions.map(o => o.parts[2].name);
    chrome.runtime.sendMessage({
      cmd: 'copy',
      content: urls.join('\n')
    }, () => {
      chrome.runtime.lastError;
      e.target.value = 'Copied';

      setTimeout(() => e.target.value = 'Copy to Clipboard', 1000);
    });
  }
});
list.addEventListener('dblclick', e => {
  document.querySelector('[data-cmd="open-in"]').click();
});
