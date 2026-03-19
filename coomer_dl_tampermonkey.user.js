// ==UserScript==
// @name         Coomer Downloader
// @namespace    coomer-dl
// @version      2.3.0
// @description  Download all media from Coomer, pack into ZIP via Web Worker (no UI block).
// @author       Claw
// @match        https://coomer.st/onlyfans/user/*
// @match        https://coomer.st/fansly/user/*
// @match        https://coomer.st/candfans/user/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @connect      coomer.st
// @connect      coomer.su
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @run-at       document-idle
// @noframes
// ==/UserScript==

// Coomer Downloader v2.2 - ZIP via Web Worker

(function () {
  'use strict';

  var CONFIG = {
    downloadVideo: true,
    apiOffset: 50,
    delayMs: 200,
  };

  var isDownloading = false;
  var stopRequested = false;
  var totalMedia = 0;
  var downloadedMedia = 0;
  var failedMedia = 0;
  var zipWorker = null;
  var workerBlobUrl = null;
  var record = {};
  var username = '';
  var service = '';  // 'onlyfans' | 'fansly' | 'candfans'

  // CDN failover hosts — 按顺序尝试，有效源只有 coomer.st 和 coomer.su
  var CDN_HOSTS = [
    'https://coomer.st',
    'https://coomer.su',
  ];

  var WORKER_CODE = [
    'var JSC="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";',
    'var zp=null;',
    'function lm(){try{importScripts(JSC);zp=new JSZip();postMessage({t:"ready"})}catch(e){postMessage({t:"err",m:e.message})}};',
    'function gn(){zp.generateAsync({type:"blob",compression:"STORE",compressionOptions:{level:0}},function(m){postMessage({t:"prog",p:Math.round(m.percent)})}).then(function(b){postMessage({t:"done",b:b,s:b.size});zp=new JSZip()}).catch(function(e){postMessage({t:"err",m:e.message})})}',
    'lm();',
    'onmessage=function(e){var d=e.data;if(d.t==="add"){zp.file(d.p,d.b);postMessage({t:"added",p:d.p})}else if(d.t==="gen"){gn()}};',
  ].join('');

  function getUsername() {
    // URL format: https://coomer.st/{service}/user/{username}
    var m = location.pathname.match(/\/([^\/]+)\/user\/([^\/]+)/);
    if (!m) return null;
    service = m[1];  // 'onlyfans' | 'fansly' | 'candfans'
    return m[2];
  }

  function getExt(name) {
    if (!name) return 'bin';
    var ext = name.split('.').pop().toLowerCase();
    if (['mp4', 'webm', 'mov', 'avi'].indexOf(ext) !== -1) return ext;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp'].indexOf(ext) !== -1) return ext;
    return 'bin';
  }

  function isVid(ext) { return ['mp4', 'webm', 'mov', 'avi'].indexOf(ext) !== -1; }

  function fmtDate(s) { return s ? s.substring(0, 10) : 'unknown-date'; }

  function loadRecord() {
    try { return GM_getValue('downloadedRecord', {}) || {}; } catch (e) { return {}; }
  }

  function saveRecord(r) {
    try { GM_setValue('downloadedRecord', r); } catch (e) {}
  }

  function apiGet(url) {
    return new Promise(function (res, rej) {
      GM_xmlhttpRequest({
        method: 'GET', url: url,
        headers: { 'Accept': 'text/css' },
        timeout: 30000,
        onload: function (r) { try { res(JSON.parse(r.responseText)); } catch (e) { res(null); } },
        onerror: rej, ontimeout: rej,
      });
    });
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function fetchPosts(user) {
    var all = [], offset = 0;
    while (true) {
      var posts = await apiGet('/api/v1/' + service + '/user/' + user + '/posts?o=' + offset);
      if (!Array.isArray(posts) || !posts.length) break;
      all = all.concat(posts);
      if (posts.length < CONFIG.apiOffset) break;
      offset += CONFIG.apiOffset;
    }
    return all;
  }

  function collectFiles(posts) {
    var files = [], used = {};
    for (var pi = 0; pi < posts.length; pi++) {
      var post = posts[pi];
      var dp = fmtDate(post.published);

      if (post.file && post.file.path) {
        var u = 'https://coomer.st/data' + post.file.path;
        if (record[u]) continue;
        var ex = getExt(post.file.name);
        var vd = isVid(ex);
        if (vd && !CONFIG.downloadVideo) continue;
        var bn = dp + '_';
        var sq = 1;
        while (used[bn + sq]) sq++;
        used[bn + sq] = true;
        var fn = bn + String(sq).padStart(2, '0') + '.' + ex;
        files.push({ u: u, p: fn });
      }

      if (post.attachments) {
        for (var ai = 0; ai < post.attachments.length; ai++) {
          var at = post.attachments[ai];
          if (!at.path) continue;
          var au = 'https://coomer.st/data' + at.path;
          if (record[au]) continue;
          var ax = getExt(at.name);
          var bn = dp + '_';
          var sq = 1;
          while (used[bn + sq]) sq++;
          used[bn + sq] = true;
          var fn = bn + String(sq).padStart(2, '0') + '.' + ax;
          files.push({ u: au, p: fn });
        }
      }
    }
    return files;
  }

  function addStyles() {
    GM_addStyle([
      '#cdp{position:fixed;top:0;left:0;right:0;z-index:2147483647;background:linear-gradient(135deg,#1a1a2e,#16213e);color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:13px;box-shadow:0 4px 20px rgba(0,0,0,0.5);display:none}',
      '#cdp.op{display:block}',
      '#cdb{display:flex;align-items:center;gap:16px;padding:10px 20px;flex-wrap:wrap}',
      '.cds{flex:1;display:flex;gap:20px;color:#b0b0b0;font-size:12px;min-width:200px}',
      '#cdpw{flex:2;background:#2a2a4a;border-radius:6px;height:8px;overflow:hidden;min-width:120px}',
      '#cdpf{height:100%;background:linear-gradient(90deg,#00d4ff,#00ff88);width:0%;transition:width 0.3s;border-radius:6px}',
      '#cdbtn{display:flex;gap:8px;flex-wrap:wrap}',
      '.cdb2{padding:5px 14px;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.2s}',
      '.cdgo{background:#00d4ff;color:#1a1a2e}',
      '.cdgo:hover{background:#00ff88}',
      '.cdgo:disabled{background:#555;color:#888;cursor:not-allowed}',
      '.cdsm{background:#2a2a4a;color:#e0e0e0;border:1px solid #444}',
      '.cdsm:hover{background:#3a3a5a}',
      '#cdl{max-height:120px;overflow-y:auto;padding:6px 20px;font-family:Consolas,Monaco,monospace;font-size:11px;color:#888;border-top:1px solid #2a2a4a;display:none}',
      '#cdl.op{display:block}',
      '.lok{color:#00ff88}',
      '.lfail{color:#ff6b6b}',
      '.linfo{color:#00d4ff}',
    ].join('\n'));
  }

  function buildPanel() {
    var p = document.createElement('div');
    p.id = 'cdp';
    p.innerHTML = [
      '<div id="cdb">',
        '<div style="font-weight:700;font-size:15px;color:#00d4ff;white-space:nowrap">Coomer DL</div>',
        '<div class="cds">',
          '<span>Files: <b id="cdf">0/0</b></span>',
          '<span>ZIP: <b id="cdz">--</b></span>',
          '<span>Failed: <b id="cdff">0</b></span>',
        '</div>',
        '<div id="cdpw"><div id="cdpf"></div></div>',
        '<div id="cdbtn">',
          '<button class="cdb2 cdgo" id="cdsbtn">Download ZIP</button>',
          '<button class="cdb2 cdsm" id="cdstbtn" style="display:none">Stop</button>',
          '<button class="cdb2 cdsm" id="cdlgbtn">Log</button>',
          '<button class="cdb2 cdsm" id="cdclbtn">Clear</button>',
          '<button class="cdb2 cdsm" id="cdxbtn">X</button>',
        '</div>',
      '</div>',
      '<div id="cdl"></div>',
    ].join('');
    document.body.appendChild(p);
    return p;
  }

  function el(id) { return document.getElementById(id); }

  function setUI() {
    el('cdf').textContent = downloadedMedia + '/' + totalMedia;
    var pct = totalMedia > 0 ? Math.round(downloadedMedia / totalMedia * 100) : 0;
    el('cdpf').style.width = pct + '%';
    el('cdff').textContent = failedMedia;
  }

  function log(msg, cls) {
    cls = cls || '';
    var le = el('cdl');
    if (!le) return;
    var l = document.createElement('div');
    l.className = cls;
    l.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
    le.appendChild(l);
    le.scrollTop = le.scrollHeight;
  }

  function initWorker() {
    if (zipWorker) return;
    var blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
    workerBlobUrl = URL.createObjectURL(blob);
    zipWorker = new Worker(workerBlobUrl);
    zipWorker.onmessage = function (e) {
      var d = e.data;
      if (d.t === 'added') {
        el('cdz').textContent = 'adding...';
      } else if (d.t === 'prog') {
        el('cdz').textContent = 'ZIP ' + d.p + '%';
      } else if (d.t === 'done') {
        el('cdz').textContent = 'done';
        var zipName = username + '_' + new Date().toISOString().substring(0, 10) + '.zip';
        var url = URL.createObjectURL(d.b);
        var a = document.createElement('a');
        a.href = url;
        a.download = zipName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 5000);
        log('ZIP ready: ' + zipName + ' (' + (d.s / 1024 / 1024).toFixed(1) + ' MB)', 'lok');
        isDownloading = false;
        el('cdsbtn').disabled = false;
        el('cdstbtn').style.display = 'none';
        log('Done! ' + downloadedMedia + ' OK, ' + failedMedia + ' failed', 'linfo');
      } else if (d.t === 'err') {
        log('ZIP error: ' + d.m, 'lfail');
        isDownloading = false;
        el('cdsbtn').disabled = false;
        el('cdstbtn').style.display = 'none';
      }
    };
    zipWorker.onerror = function (e) {
      log('Worker error: ' + e.message, 'lfail');
      isDownloading = false;
      el('cdsbtn').disabled = false;
      el('cdstbtn').style.display = 'none';
    };
    log('ZIP Worker ready', 'linfo');
  }

  function fetchBlobSingle(url) {
    return new Promise(function (res) {
      GM_xmlhttpRequest({
        method: 'GET', url: url,
        responseType: 'arraybuffer',
        timeout: 120000,
        onload: function (r) {
          res(r.status >= 200 && r.status < 300 && r.response ? r.response : null);
        },
        onerror: function () { res(null); },
        ontimeout: function () { res(null); },
      });
    });
  }

  // Try each CDN host in order; path comes after /data
  async function fetchBlob(url) {
    var path = url.substring(url.indexOf('/data'));
    for (var ci = 0; ci < CDN_HOSTS.length; ci++) {
      var buf = await fetchBlobSingle(CDN_HOSTS[ci] + path);
      if (buf) return buf;
    }
    return null;
  }

  async function start() {
    if (isDownloading) return;
    isDownloading = true;
    stopRequested = false;
    el('cdsbtn').disabled = true;
    el('cdstbtn').style.display = '';
    downloadedMedia = 0;
    failedMedia = 0;
    totalMedia = 0;
    setUI();
    log('Fetching posts...', 'linfo');

    var posts;
    try {
      posts = await fetchPosts(username);
    } catch (e) {
      log('Fetch failed: ' + e.message, 'lfail');
      isDownloading = false;
      el('cdsbtn').disabled = false;
      el('cdstbtn').style.display = 'none';
      return;
    }

    record = loadRecord();
    var files = collectFiles(posts);
    totalMedia = files.length;
    setUI();
    log(posts.length + ' posts, ' + totalMedia + ' new files', 'linfo');

    if (!totalMedia) {
      log('No new files', 'linfo');
      isDownloading = false;
      el('cdsbtn').disabled = false;
      el('cdstbtn').style.display = 'none';
      return;
    }

    initWorker();
    await sleep(500);

    for (var i = 0; i < files.length; i++) {
      if (stopRequested) {
        log('Download stopped by user', 'lfail');
        isDownloading = false;
        el('cdsbtn').disabled = false;
        return;
      }
      var f = files[i];
      setUI();
      log('[' + (i + 1) + '/' + files.length + '] ' + f.p);

      var buf = await fetchBlob(f.u);
      if (buf) {
        zipWorker.postMessage({ t: 'add', p: f.p, b: buf }, [buf]);
        downloadedMedia++;
        record[f.u] = f.p;
        var sz = buf.byteLength;
        var szStr = (sz / 1024 / 1024).toFixed(1) + ' MB';
        log('  OK (' + szStr + ')', 'lok');
      } else {
        failedMedia++;
        log('  FAILED (all CDN hosts exhausted)', 'lfail');
      }
      setUI();
      await sleep(CONFIG.delayMs);
    }

    saveRecord(record);
    log('Generating ZIP...', 'linfo');
    el('cdz').textContent = 'ZIP 0%';
    zipWorker.postMessage({ t: 'gen' });
  }

  function stopDownload() {
    if (!isDownloading) return;
    stopRequested = true;
    el('cdstbtn').style.display = 'none';
    log('Stop requested, finishing current file...', 'linfo');
  }

  function init() {
    try {
      var old = document.getElementById('cdp');
      if (old) old.parentNode.removeChild(old);
      if (workerBlobUrl) { URL.revokeObjectURL(workerBlobUrl); workerBlobUrl = null; }
      if (zipWorker) { zipWorker.terminate(); zipWorker = null; }

      username = getUsername();
      if (!username) return;

      addStyles();
      var panel = buildPanel();
      panel.classList.add('op');

      el('cdsbtn').addEventListener('click', function () { start(); });
      el('cdstbtn').addEventListener('click', function () { stopDownload(); });
      el('cdlgbtn').addEventListener('click', function () { el('cdl').classList.toggle('op'); });
      el('cdclbtn').addEventListener('click', function () {
        if (confirm('Clear all records?')) {
          GM_setValue('downloadedRecord', {});
          log('Records cleared', 'linfo');
        }
      });
      el('cdxbtn').addEventListener('click', function () { panel.classList.remove('op'); });

      var rc = Object.keys(loadRecord()).length;
      log('Ready. ' + rc + ' files in record.', 'linfo');
      log('ZIP generation via Web Worker (UI stays responsive)', 'linfo');
    } catch (e) {
      console.error('[CoomerDL] Init failed:', e);
    }
  }

  // Watch for SPA navigation (pushState / replaceState / popstate)
  var _pushState = history.pushState;
  var _replaceState = history.replaceState;
  history.pushState = function () {
    _pushState.apply(history, arguments);
    init();
  };
  history.replaceState = function () {
    _replaceState.apply(history, arguments);
    init();
  };
  window.addEventListener('popstate', function () {
    init();
  });

  init();
})();
