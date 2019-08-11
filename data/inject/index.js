'use strict';

const select = document.querySelector('select');

chrome.runtime.sendMessage({
  cmd: 'get-links'
}, response => {
  document.getElementById('number').textContent = response.length;

  response.forEach((url, index) => {
    const option = document.createElement('option');
    option.value = url;
    option.textContent = index ? (index + '. ' + url) : 'Page URL: ' + url;
    select.appendChild(option);
  });
  select.value = response[0];
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
    });
  }
  else if (cmd === 'open-in') {
    const urls = [...select.options].filter(e => e.selected).map(e => e.value);
    if (urls.length === 1) {
      chrome.runtime.sendMessage({
        cmd: 'open-in',
        url: urls[0]
      }, () => chrome.runtime.sendMessage({
        cmd: 'close-me'
      }));
    }
    else if (urls.length > 1) {
      chrome.runtime.sendMessage({
        cmd: 'combine',
        urls
      }, () => chrome.runtime.sendMessage({
        cmd: 'close-me'
      }));
    }
    else {
      window.alert('Please select a media link from the list');
    }
  }
});
select.addEventListener('dblclick', e => {
  if (e.target.tagName === 'OPTION') {
    document.querySelector('[data-cmd="open-in"]').click();
  }
});
