/* global runtime */
'use strict';

const args = new URLSearchParams(location.search);

document.getElementById('guid').textContent = chrome.runtime.id;

let os = 'windows';
if (/Mac/i.test(navigator.platform)) {
  os = 'mac';
}
else if (/Linux/i.test(navigator.platform)) {
  os = 'linux';
}
else {
  document.querySelector('option[value="org.webextension.bun"]').disabled = true;
}
document.body.dataset.os = (os === 'mac' || os === 'linux') ? 'linux' : 'windows';

if (['Lin', 'Win', 'Mac'].includes(navigator.platform.substr(0, 3)) === false) {
  alert(`Sorry! The "native client" only supports the following operating systems at the moment:

Windows, Mac, and Linux`);
}

const toast = document.getElementById('toast');

document.addEventListener('click', ({target}) => {
  if (target.dataset.cmd === 'download') {
    const repo = runtime.value === 'com.add0n.node' ? 'native-client' : 'native-client-bunjs';

    const next = () => {
      toast.notify('Looking for the latest version of the native-client. Please wait...', 'info', 60000);
      const req = new XMLHttpRequest();
      req.open('GET', 'https://api.github.com/repos/andy-portmen/' + repo + '/releases/latest');
      req.responseType = 'json';
      req.onload = () => {
        chrome.downloads.download({
          filename: os + '.zip',
          url: req.response.assets.filter(a => a.name === os + '.zip')[0].browser_download_url
        }, () => {
          toast.notify('Wait for the download to complete before extracting and installing it.', 'success');
          setTimeout(() => {
            toast.clean();
            document.body.dataset.step = 1;
          }, 3000);
        });
      };
      req.onerror = () => {
        toast.notify('Something went wrong! Please download the package manually', 'error');
        setTimeout(() => {
          window.open('https://github.com/andy-portmen/' + repo + '/releases');
        }, 5000);
      };
      req.send();
    };
    if (chrome.downloads) {
      next();
    }
    else {
      chrome.permissions.request({
        permissions: ['downloads']
      }, granted => {
        if (granted) {
          next();
        }
        else {
          toast.notify('error', 'File downloading cannot be initiated. Proceed to download the file manually.', 60000);
        }
      });
    }
  }
  else if (target.dataset.cmd === 'check') {
    chrome.runtime.sendNativeMessage(runtime.value, {
      cmd: 'version'
    }, response => {
      const e = chrome.runtime.lastError;
      if (response) {
        toast.notify('Native client version is ' + response.version, 'success');
      }
      else {
        toast.notify(
          'Cannot find the native client. Proceed with the instructions for installing the native client:\n\n' +
          e.message,
          'error'
        );
      }
    });
  }
  else if (target.dataset.cmd === 'options') {
    chrome.runtime.openOptionsPage();
  }
});

const boot = () => chrome.storage.local.get({
  'runtime': 'com.add0n.node'
}, prefs => {
  runtime.value = prefs.runtime;
  chrome.runtime.sendNativeMessage(prefs.runtime, {
    cmd: 'version'
  }, response => {
    if (response) {
      document.title = 'Native Client is installed!';
      document.body.dataset.installed = true;
    }
  });
});
boot();

if (args.has('msg')) {
  toast.notify(args.get('msg'), 'info');
}

runtime.addEventListener('change', () => chrome.storage.local.set({
  'runtime': runtime.value
}, boot));
