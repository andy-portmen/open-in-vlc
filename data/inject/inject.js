'use strict';

try {
  iframe.remove();
}
catch(e) {}
var iframe;

iframe = document.createElement('iframe');
iframe.setAttribute('style', `
  border: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 450px;
  height: 200px;
  max-width: 80%;
  margin-left: auto;
  margin-right: auto;
  background-color: #fff;
  z-index: 10000000000;
`);

document.body.appendChild(iframe);
iframe.src = chrome.runtime.getURL('data/inject/index.html');
