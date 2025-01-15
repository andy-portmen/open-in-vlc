/* global Native */

const is = {
  mac: /Mac/i.test(navigator.platform),
  linux: /Linux/i.test(navigator.platform)
};

const open = async (tab, tabId, referrer) => {
  const {url} = tab;
  const {title} = tab;

  const prefs = await chrome.storage.local.get({
    'media-player': 'VLC',
    'path': null,
    'send-title-meta': true,
    'one-instance': true,
    'send-referrer': true,
    'send-user-agent': true,
    'custom-arguments': [],
    'runtime': 'com.add0n.node'
  });

  const args = {
    pre: [],
    url,
    post: []
  };

  if (prefs['custom-arguments'].length) {
    if (prefs['media-player'] === 'POT') {
      args.post.push(...prefs['custom-arguments']);
    }
    else {
      args.pre.push(...prefs['custom-arguments']);
    }
  }

  // macOS does not support this argument
  if (prefs['one-instance'] && is.mac === false) {
    if (prefs['media-player'] === 'POT') {
      args.post.push('/current');
    }
    else if (prefs['media-player'] === 'QMP') {
      // args.pre.push('--enqueue');
    }
    else {
      args.pre.push('--one-instance');
    }
  }

  if (prefs['send-referrer'] && referrer) {
    if (prefs['media-player'] === 'POT') {
      args.post.push(`/referer="${referrer}"`);
    }
    else if (prefs['media-player'] === 'QMP') {
      // args.pre.push('--referer', referrer);
    }
    else {
      args.pre.push('--http-referrer', referrer);
    }
  }
  if (prefs['send-user-agent']) {
    if (prefs['media-player'] === 'POT') {
      args.post.push(`/user_agent="${navigator.userAgent}"`);
    }
    else if (prefs['media-player'] === 'QMP') {
      // args.pre.push('--user-agent', navigator.userAgent);
    }
    else {
      args.pre.push('--http-user-agent', navigator.userAgent);
    }
  }

  // decode
  if (url.startsWith('https://www.google.') && url.includes('&url=')) {
    args.url = decodeURIComponent(url.split('&url=')[1].split('&')[0]);
  }

  // meta title must be appended to this (https://code.videolan.org/videolan/vlc/-/issues/22560)
  if (title && prefs['send-title-meta']) {
    if (prefs['media-player'] === 'POT') {
      args.post.push(`/title="${title}"`);
    }
    else if (prefs['media-player'] === 'QMP') {
      // does not support title
    }
    else {
      // since we are using "open -a VLC URL --args" we can not send meta data appended after the URL
      if (is.mac && prefs['one-instance']) {
        args.pre.push(`--meta-title=${title}`);
      }
      else {
        args.post.push(`:meta-title=${title}`);
      }
    }
  }

  const native = new Native(tabId, prefs.runtime);

  const executable = await open.executable(prefs);

  if (is.mac) {
    if (prefs['one-instance']) {
      const href = url;

      const mArgs = ['-a', executable.name, href];
      if (args.pre.length > 0 || args.post.length > 0) {
        mArgs.push('--args');
        if (args.pre.length > 0) {
          mArgs.push(...args.pre);
        }
        if (args.post.length > 0) {
          mArgs.push(...args.post);
        }
      }

      native.exec('open', mArgs);
    }
    else {
      native.exec(executable.path, [
        ...args.pre,
        args.url,
        ...args.post
      ]);
    }
  }
  else {
    if (prefs.path) {
      native.exec(prefs.path, [
        ...args.pre,
        args.url,
        ...args.post
      ]);
    }
    else if (is.linux) {
      native.exec(executable.name, [
        ...args.pre,
        args.url,
        ...args.post
      ]);
    }
    else { // Windows
      const res = await native.env();
      const paths = open.suggestions(prefs, res);

      const r = await chrome.runtime.sendNativeMessage(prefs.runtime, {
        permissions: ['fs'],
        args: [...paths],
        script: `
          const fs = require('fs');
          const exist = path => new Promise(resolve => fs.access(path, fs.F_OK, e => {
            resolve(e ? false : true);
          }));
          Promise.all(args.map(exist)).then(d => {
            push({d});
            done();
          }).catch(e => push({e: e.message}));
        `
      }).catch(e => {
        console.warn('Unexpected Error', e);
        return '';
      });

      // VLC is now default to:
      let path = executable.path;
      if (r) {
        if (res.env['ProgramFiles'] && r.d[1]) {
          path = paths[1];
        }
        else if (res.env['ProgramFiles(x86)'] && r.d[0]) {
          path = paths[0];
        }
      }
      await chrome.storage.local.set({
        path,
        ['path-' + prefs['media-player']]: path
      });

      native.exec(path, [
        ...args.pre,
        args.url,
        ...args.post
      ]);
    }
  }
};

open.executable = prefs => {
  if (is.mac) {
    if (prefs.path) {
      return {
        name: prefs.path,
        path: '/Applications/VLC.app/Contents/MacOS/' + prefs.path
      };
    }
    if (prefs['media-player'] === 'QMP') {
      return {
        name: 'QMPlay2',
        path: '/Applications/VLC.app/Contents/MacOS/QMPlay2'
      };
    }
    return {
      name: 'VLC',
      path: '/Applications/VLC.app/Contents/MacOS/VLC'
    };
  }
  else if (is.linux) {
    if (prefs['media-player'] === 'QMP') {
      return {
        name: 'QMPlay2'
      };
    }
    return {
      name: 'vlc'
    };
  }
  else {
    if (prefs['media-player'] === 'POT') {
      return {
        path: 'C:\\Program Files\\DAUM\\PotPlayer\\PotPlayerMini64.exe'
      };
    }
    else if (prefs['media-player'] === 'QMP') {
      return {
        path: 'C:\\Program Files\\QMPlay2\\QMPlay2.exe'
      };
    }
    return {
      path: 'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe'
    };
  }
};

open.suggestions = (prefs, res) => {
  if (prefs['media-player'] === 'POT') {
    return [
      res.env['ProgramFiles(x86)'] + '\\DAUM\\PotPlayer\\PotPlayerMini64.exe',
      res.env['ProgramFiles'] + '\\DAUM\\PotPlayer\\PotPlayerMini64.exe',
      res.env['ProgramFiles(x86)'] + '\\DAUM\\PotPlayer\\PotPlayerMini32.exe',
      res.env['ProgramFiles'] + '\\DAUM\\PotPlayer\\PotPlayerMini32.exe'
    ];
  }
  else if (prefs['media-player'] === 'QMP') {
    return [
      res.env['ProgramFiles(x86)'] + '\\QMPlay2\\QMPlay2.exe',
      res.env['ProgramFiles'] + '\\QMPlay2\\QMPlay2.exe'
    ];
  }
  return [
    res.env['ProgramFiles(x86)'] + '\\VideoLAN\\VLC\\vlc.exe',
    res.env['ProgramFiles'] + '\\VideoLAN\\VLC\\vlc.exe'
  ];
};
