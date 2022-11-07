'use strict';

const args = new URLSearchParams(location.search);
const id = args.get('id') || 'com.add0n.node';

let os = 'windows';
if (navigator.userAgent.indexOf('Mac') !== -1) {
  os = 'mac';
}
else if (navigator.userAgent.indexOf('Linux') !== -1) {
  os = 'linux';
}
document.body.dataset.os = (os === 'mac' || os === 'linux') ? 'linux' : 'windows';

if (['Lin', 'Win', 'Mac'].indexOf(navigator.platform.substr(0, 3)) === -1) {
  window.alert(`Sorry! The "native client" only supports the following operating systems at the moment:

Windows, Mac, and Linux`);
}

const toast = document.getElementById('toast');

document.addEventListener('click', ({target}) => {
  if (target.dataset.cmd === 'download') {
    const next = () => {
      toast.notify('Looking for the latest version of the native-client', 'info', 60000);
      const req = new window.XMLHttpRequest();
      req.open('GET', 'https://api.github.com/repos/andy-portmen/native-client/releases/latest');
      req.responseType = 'json';
      req.onload = () => {
        chrome.downloads.download({
          filename: os + '.zip',
          url: req.response.assets.filter(a => a.name === os + '.zip')[0].browser_download_url
        }, () => {
          toast.notify('Download is started. Extract and install when it is done', 'success');
          window.setTimeout(() => {
            toast.clean();
            document.body.dataset.step = 1;
          }, 3000);
        });
      };
      req.onerror = () => {
        toast.notify('Something went wrong! Please download the package manually', 'error');
        window.setTimeout(() => {
          window.open('https://github.com/andy-portmen/native-client/releases');
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
          toast.notify('error', 'Cannot initiate file downloading. Please download the file manually', 60000);
        }
      });
    }
  }
  else if (target.dataset.cmd === 'check') {
    chrome.runtime.sendNativeMessage(id, {
      cmd: 'version'
    }, response => {
      if (response) {
        toast.notify('Native client version is ' + response.version, 'success');
      }
      else {
        toast.notify('Cannot find the native client. Follow the 3 steps to install the native client', 'error');
      }
    });
  }
  else if (target.dataset.cmd === 'options') {
    chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.sendNativeMessage(id, {
  cmd: 'version'
}, response => {
  if (response) {
    document.title = 'Native Client is installed!';
    document.body.dataset.installed = true;
  }
});
