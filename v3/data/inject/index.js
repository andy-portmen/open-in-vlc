'use strict';

const args = new URLSearchParams(location.search);
const list = document.getElementById('list');

const formatBytes = (bytes, decimals = 0) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

chrome.runtime.sendMessage({
  cmd: 'get-links'
}, response => {
  document.getElementById('number').textContent = response.length;

  let active = 0;
  response = [response[0], ...response.slice(1).sort(([, aO], [, bO]) => {
    if (bO && bO.type === 'm3u8') {
      return 1;
    }
    if (aO && aO.type === 'm3u8') {
      return -1;
    }
    return aO.date - bO.date;
  })];

  response.forEach(([url, o], index) => {
    let ext = o && o.type ? o.type : url.split(/[#?]/)[0].split('.').pop().trim();
    if (ext.includes('/')) {
      ext = '';
    }
    ext = ext.substr(0, 6);

    if (index) {
      // select media
      if (active === 0) {
        if (ext === 'm3u8' || (o && o.size && Number(o.size) > 1024)) {
          active = index;
        }
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

  list.selectedIndex = active + 1;
});
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
        referrer: args.get('referrer')
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
        referrer: args.get('referrer')
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
