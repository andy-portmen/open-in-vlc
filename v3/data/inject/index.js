'use strict';

const select = document.querySelector('select');

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
    const option = document.createElement('option');

    let ext = o && o.type ? o.type : url.split(/[#?]/)[0].split('.').pop().trim();
    if (ext.includes('/')) {
      ext = '';
    }
    ext = ext.substr(0, 6);

    // select media
    if (active === 0) {
      if (ext === 'm3u8' || (o && o.size && Number(o.size) > 1024)) {
        active = index;
      }
    }

    option.title = option.value = url;
    option.textContent = index ? (('0' + index).substr(-2) + '. ' + (ext ? `[${ext}] ` : '') + url) : 'Page URL: ' + url;
    select.appendChild(option);
  });
  select.value = response[active][0];
});
window.addEventListener('load', () => window.setTimeout(() => {
  select.focus();
  window.focus();
}, 0));
// keep focus
window.addEventListener('blur', () => window.setTimeout(() => {
  select.focus();
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
    if (select.options.length > 1) {
      for (const o of [...select.options].slice(1)) {
        o.selected = true;
      }
    }
    else if (select.options.length) {
      select.option[0].selected = true;
    }
  }
  else if (cmd === 'open-in') {
    const urls = [...select.options].filter(e => e.selected).map(e => e.value);
    if (urls.length === 1) {
      chrome.runtime.sendMessage({
        cmd: 'open-in',
        url: urls[0]
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
        urls
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
    const urls = [...select.options].filter(e => e.selected).map(e => e.value);
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
select.addEventListener('dblclick', e => {
  if (e.target.tagName === 'OPTION') {
    document.querySelector('[data-cmd="open-in"]').click();
  }
});
