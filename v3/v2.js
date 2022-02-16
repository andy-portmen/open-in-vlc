chrome.action = chrome.action || chrome.browserAction;

chrome.scripting = chrome.scripting || {
  executeScript({target, files, func, args = []}) {
    const props = {};

    if (files) {
      props.file = files[0];
    }
    if (func) {
      const s = btoa(JSON.stringify(args));
      props.code = '(' + func.toString() + `)(...JSON.parse(atob('${s}')))`;
    }
    if (target.allFrames) {
      props.allFrames = true;
      props.matchAboutBlank = true;
    }

    return new Promise((resolve, reject) => chrome.tabs.executeScript(target.tabId, props, r => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(lastError);
      }
      else {
        resolve(r.map(result => ({result})));
      }
    }));
  }
};

chrome.storage.cache = {};
chrome.storage.session = chrome.storage.session || {
  get(ps, c) {
    const r = {};
    for (const [key, value] of Object.entries(ps)) {
      r[key] = chrome.storage.cache[key] || value;
    }
    c(r);
  },
  set(ps, c) {
    Object.assign(chrome.storage.cache, ps);
    c();
  },
  remove(key) {
    delete chrome.storage.cache[key];
  }
};

chrome.windows.getCurrent = new Proxy(chrome.windows.getCurrent, {
  apply(target, self, args) {
    return new Promise(resolve => Reflect.apply(target, self, [...args, resolve]));
  }
});
