// eslint-disable-next-line no-unused-vars
class Native {
  constructor(tabId, runtime) {
    this.tabId = tabId;
    this.runtime = runtime;
  }
  #run(command) {
    return new Promise((resolve, reject) => {
      const channel = chrome.runtime.connectNative(this.runtime);
      channel.onDisconnect.addListener(() => {
        const {lastError} = chrome.runtime;
        const msg = lastError?.message || 'DISCONNECTED';

        reject(Error(msg));
        chrome.tabs.create({
          url: '/data/helper/index.html?msg=' + encodeURIComponent(msg)
        });
      });
      channel.onMessage.addListener(res => {
        if (!res) {
          reject(Error('UNKNOWN_ERROR'));
          chrome.tabs.create({
            url: '/data/helper/?msg=' + encodeURIComponent('native client exited without any response')
          });
        }
        else if (res.code && (res.code !== 0 && (res.code !== 1 || res.stderr !== ''))) {
          reject(Error('ERROR_' + res.code));
          self.notify(`Something went wrong!

    -----
    Code: ${res.code}
    Output: ${res.stdout}
    Error: ${res.stderr}`, this.tabId);
        }
        else {
          resolve(res);
        }

        // https://github.com/andy-portmen/native-client/issues/32#issuecomment-328252287
        if (res && 'code' in res) {
          channel.disconnect();
        }
      });
      channel.postMessage(command);
    });
  }
  env() {
    return this.#run({
      cmd: 'env'
    }); // do not catch here
  }
  exec(command, args) {
    return this.#run({
      cmd: 'exec',
      command,
      arguments: args
    }).catch(e => console.info('native.exec', e));
  }
}
