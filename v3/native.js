const Native = function(tabId) {
  this.callback = null;
  this.tabId = tabId;
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
      self.notify(`Something went wrong!

-----
Code: ${res.code}
Output: ${res.stdout}
Error: ${res.stderr}`, this.tabId);
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
