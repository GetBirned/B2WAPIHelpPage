/* B2W API Help Guide — page behaviour. Plain JS, no dependencies. */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  };
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var icon = function (id) { return '<svg class="ic" aria-hidden="true"><use href="#' + id + '"/></svg>'; };
  var root = document.documentElement;

  /* ------------------------------------------------------------ theme */
  function effectiveTheme() {
    var t = root.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  var themeBtn = $('#theme-btn');
  function labelTheme() {
    themeBtn.setAttribute('aria-label', effectiveTheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
  themeBtn.addEventListener('click', function () {
    var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    store.set('opsapi-guide-theme', next);
    labelTheme();
  });
  labelTheme();

  /* ------------------------------------------------------------ print */
  var printTheme = null;
  $('#print-btn').addEventListener('click', function () { window.print(); });
  window.addEventListener('beforeprint', function () {
    printTheme = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'light');
    $$('details').forEach(function (d) { d.dataset.wasOpen = d.open ? '1' : ''; d.open = true; });
  });
  window.addEventListener('afterprint', function () {
    if (printTheme) root.setAttribute('data-theme', printTheme); else root.removeAttribute('data-theme');
    $$('details').forEach(function (d) { d.open = d.dataset.wasOpen === '1'; });
  });

  /* ------------------------------------------------- sidebar (mobile) */
  var toc = $('#toc'), scrim = $('#scrim'), menuBtn = $('#menu-btn');
  var isDrawer = function () { return window.matchMedia('(max-width: 1100px)').matches; };
  function setDrawer(open) {
    toc.classList.toggle('open', open);
    scrim.hidden = !open;
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn.setAttribute('aria-label', open ? 'Close contents' : 'Open contents');
  }
  menuBtn.addEventListener('click', function () { setDrawer(!toc.classList.contains('open')); });
  scrim.addEventListener('click', function () { setDrawer(false); });
  toc.addEventListener('click', function (e) {
    if (e.target.closest('a') && isDrawer()) setDrawer(false);
  });

  /* --------------------------------------------------- question finder */
  var filter = $('#toc-filter'), tocEmpty = $('#toc-empty');
  var norm = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
  var tocLinks = $$('.toc a');
  tocLinks.forEach(function (a) { a.dataset.hay = norm(a.textContent + ' ' + (a.dataset.k || '')).replace(/ /g, ''); a.dataset.hayw = norm(a.textContent + ' ' + (a.dataset.k || '')); });
  function tocBlock() { return $('.toc-product[data-for="' + currentProduct() + '"]'); }
  function runFilter() {
    var q = norm(filter.value);
    var words = q ? q.split(' ') : [];
    var anyShown = false;
    $$('.toc-group', tocBlock()).forEach(function (g) {
      var groupShown = false;
      $$('li', g).forEach(function (li) {
        var a = $('a', li);
        var ok = words.every(function (w) { return a.dataset.hayw.indexOf(w) > -1 || a.dataset.hay.indexOf(w) > -1; });
        li.hidden = !ok;
        if (ok) groupShown = true;
      });
      g.hidden = !groupShown;
      if (groupShown) anyShown = true;
    });
    tocEmpty.hidden = anyShown;
  }
  filter.addEventListener('input', runFilter);
  filter.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      var first = $$('a', tocBlock()).filter(function (a) { return !a.closest('li').hidden; })[0];
      if (first) { e.preventDefault(); first.click(); location.hash = first.getAttribute('href'); filter.blur(); }
    } else if (e.key === 'Escape') {
      filter.value = ''; runFilter(); filter.blur();
    }
  });
  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    var typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && !openDialog) {
      e.preventDefault();
      if (isDrawer()) setDrawer(true);
      filter.focus();
    } else if (e.key === 'Escape') {
      if (!$('#lightbox').hidden) closeLightbox();
      else if (openDialog) closeModal();
      else if (toc.classList.contains('open')) { setDrawer(false); menuBtn.focus(); }
    }
  });

  /* -------------------------------- scroll: progress, current section, top */
  var sections = [];   // the current guide's questions, set by setProduct()
  var bar = $('#progress-bar'), toTop = $('#to-top');
  var linkFor = {};
  tocLinks.forEach(function (a) { linkFor[a.getAttribute('href').slice(1)] = a; });
  var current = null, ticking = false;
  function onScroll() {
    ticking = false;
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    bar.style.width = (max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0) + '%';
    toTop.hidden = window.scrollY < 700;
    if (!sections.length) return;
    var line = 140, active = null;
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().top - line <= 0) active = sections[i]; else break;
    }
    if (window.innerHeight + window.scrollY >= doc.scrollHeight - 4) active = sections[sections.length - 1];
    var id = active ? active.id : null;
    if (id !== current) {
      if (current && linkFor[current]) linkFor[current].removeAttribute('aria-current');
      current = id;
      var link = id && linkFor[id];
      if (link) {
        link.setAttribute('aria-current', 'true');
        if (!isDrawer()) {
          var r = link.getBoundingClientRect(), tr = toc.getBoundingClientRect();
          if (r.top < tr.top + 60 || r.bottom > tr.bottom - 40) toc.scrollTop += r.top - tr.top - tr.height / 3;
        }
      }
    }
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  window.addEventListener('resize', function () { if (!isDrawer()) setDrawer(false); onScroll(); });
  function viewHeading() { return $('.product-view[data-view="' + currentProduct() + '"] h1'); }
  toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); viewHeading().focus({ preventScroll: true }); });
  $$('.product-view h1').forEach(function (h) { h.setAttribute('tabindex', '-1'); });

  /* ------------------------------------------------------ API switcher */
  var HOST = 'https://b2w-eus10.b2w.trimble.com/';
  var PRODUCTS = {
    ops: { title: 'B2W Ops API Help Guide', hash: '', docs: HOST + 'OpsAPI_B2WTechSupport/doc/index.html',
      collection: 'https://drive.google.com/file/d/1fJfhAF0z383mx1Io5qvFcJEHLsStrS9R/view?usp=sharing' },
    est: { title: 'B2W Estimate API Help Guide', hash: 'estimate-api', docs: HOST + 'EstAPI_B2WTechSupport/doc/index.html',
      collection: HOST + 'EstAPI_B2WTechSupport/Documentation/EstAPI.postman_collection.json' },
    mr: { title: 'B2W Management Reporting API Help Guide', hash: 'reporting-api', docs: HOST + 'MRAPI_B2WTechSupport/doc/index.html',
      collection: HOST + 'MRAPI_B2WTechSupport/Documentation/MRAPI.postman_collection.json' }
  };
  var productFromHash = { 'estimate-api': 'est', 'reporting-api': 'mr', 'ops-api': 'ops' };
  // Which guide a link like #bearer-token, #est-login, or #mr-headers belongs to.
  function productForHash(id) {
    if (productFromHash[id]) return productFromHash[id];
    var target = id && document.getElementById(id);
    var view = target && target.closest('[data-view]');
    return view ? view.getAttribute('data-view') : null;
  }
  var switchBtns = $$('.product-switch button');
  function currentProduct() { return root.getAttribute('data-product') || 'ops'; }
  function setProduct(p, opts) {
    opts = opts || {};
    if (!PRODUCTS[p]) p = 'ops';
    var changed = p !== currentProduct();
    root.setAttribute('data-product', p);
    switchBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-product') === p ? 'true' : 'false'); });
    document.title = PRODUCTS[p].title;
    var icon = $('#favicon');
    if (icon) icon.href = icon.getAttribute('data-icon-' + p);
    $('#foot-name').textContent = PRODUCTS[p].title;
    $('#hdr-docs').href = PRODUCTS[p].docs;
    $('#hdr-collection').href = PRODUCTS[p].collection;
    sections = $$('.product-view[data-view="' + p + '"] .q[id]');
    if (changed && filter.value) { filter.value = ''; }
    runFilter();
    setDrawer(false);
    if (opts.updateLink) {
      // Keep the address shareable: #estimate-api / #reporting-api open those guides directly.
      try { history.replaceState(null, '', location.pathname + location.search + (PRODUCTS[p].hash ? '#' + PRODUCTS[p].hash : '')); } catch (e) { /* file: URLs in some browsers */ }
    }
    if (changed && opts.toTop) { window.scrollTo(0, 0); viewHeading().focus({ preventScroll: true }); }
    if (current && linkFor[current]) linkFor[current].removeAttribute('aria-current');
    current = null;
    onScroll();
  }
  switchBtns.forEach(function (b) {
    b.addEventListener('click', function () { setProduct(b.getAttribute('data-product'), { updateLink: true, toTop: true }); });
  });
  document.addEventListener('click', function (e) {
    var go = e.target.closest('[data-go]');
    if (go) setProduct(go.getAttribute('data-go'), { updateLink: true, toTop: true });
  });
  $('#brand-link').addEventListener('click', function (e) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  window.addEventListener('hashchange', function () {
    var id = location.hash.slice(1);
    if (productFromHash[id]) { setProduct(productFromHash[id], { toTop: true }); return; }
    // A link to another guide's question opens that guide first.
    var p = productForHash(id);
    if (p && p !== currentProduct()) {
      setProduct(p);
      document.getElementById(id).scrollIntoView();
    }
  });
  setProduct(productForHash(location.hash.slice(1)) || 'ops');
  if (location.hash.length > 1 && !productFromHash[location.hash.slice(1)]) {
    var deep = document.getElementById(location.hash.slice(1));
    if (deep) requestAnimationFrame(function () { deep.scrollIntoView(); });
  }

  /* ----------------------------------------------------------- copying */
  function flash(btn, ok) {
    if (!btn) return;
    var original = btn.dataset.label || btn.innerHTML;
    btn.dataset.label = original;
    btn.classList.add('done');
    btn.innerHTML = icon(ok ? 'i-check' : 'i-alert') + (ok ? 'Copied' : 'Press Ctrl+C');
    clearTimeout(btn._t);
    btn._t = setTimeout(function () { btn.classList.remove('done'); btn.innerHTML = original; }, 1600);
  }
  function copyText(text, btn) {
    var fallback = function () {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-1000px';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      flash(btn, ok);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { flash(btn, true); }, fallback);
    } else { fallback(); }
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.copy-btn, [data-copy]');
    if (!btn) return;
    if (btn.hasAttribute('data-copy')) { copyText(btn.getAttribute('data-copy'), btn); return; }
    var pre = btn.closest('.code') && $('pre', btn.closest('.code'));
    if (pre) copyText(pre.textContent.replace(/\s+$/, ''), btn);
  });

  /* ------------------------------------------------------ syntax colour */
  var RULES = {
    json: [
      [/"(?:[^"\\\n]|\\.)*"(?=\s*:)/y, 'k'],
      [/"(?:[^"\\\n]|\\.)*"/y, 's'],
      [/\b(?:true|false|null)\b/y, 'kw'],
      [/-?\b\d+(?:\.\d+)?\b/y, 'n']
    ],
    http: [
      [/#[^\n]*/y, 'c'],
      [/^(?:GET|POST|PUT|DELETE|PATCH)\b/my, 'kw'],
      [/HTTP\/1\.1/y, 'c'],
      [/^[A-Za-z][\w-]*(?=:)/my, 'k'],
      [/<[^>\n]+>/y, 'v'],
      [/\$\w+/y, 'kw'],
      [/"(?:[^"\\\n]|\\.)*"(?=\s*:)/y, 'k'],
      [/"(?:[^"\\\n]|\\.)*"/y, 's'],
      [/\b(?:true|false|null)\b/y, 'kw']
    ],
    powershell: [
      [/#[^\n]*/y, 'c'],
      [/"(?:[^"`\n]|`.)*"|'[^'\n]*'/y, 's'],
      [/\$[A-Za-z_]\w*/y, 'v'],
      [/\b[A-Z][A-Za-z]+-[A-Z][A-Za-z]+\b/y, 'kw'],
      [/(?<=\s)-[A-Z][A-Za-z]+\b/y, 'k'],
      [/\b\d+\b/y, 'n']
    ],
    bash: [
      [/(?:^|(?<=\s))#[^\n]*/my, 'c'],
      [/^curl\b/my, 'kw'],
      [/'[^']*'|"(?:[^"\\]|\\.)*"/y, 's'],
      [/(?<=\s)--?[A-Za-z][\w-]*/y, 'k']
    ],
    url: [
      [/#[^\n]*/y, 'c'],
      [/\{\{\w+\}\}/y, 'v'],
      [/\$\w+/y, 'kw'],
      [/'[^'\n]*'/y, 's'],
      [/\b(?:eq|ne|gt|ge|lt|le|and|or|asc|desc|true|false)\b/y, 'k'],
      [/\b\d+\b/y, 'n']
    ]
  };
  function highlight(text, rules) {
    var out = '', plain = '', i = 0;
    while (i < text.length) {
      var hit = null;
      for (var r = 0; r < rules.length; r++) {
        var re = rules[r][0];
        re.lastIndex = i;
        var m = re.exec(text);
        if (m && m[0].length) { hit = [m[0], rules[r][1]]; break; }
      }
      if (hit) {
        if (plain) { out += esc(plain); plain = ''; }
        out += '<span class="tok-' + hit[1] + '">' + esc(hit[0]) + '</span>';
        i += hit[0].length;
      } else { plain += text[i]; i++; }
    }
    return out + esc(plain);
  }
  $$('pre[data-lang]').forEach(function (pre) {
    var rules = RULES[pre.getAttribute('data-lang')];
    var code = $('code', pre) || pre;
    if (rules) { try { code.innerHTML = highlight(code.textContent, rules); } catch (e) { /* leave plain */ } }
  });

  /* -------------------------------------------------------------- tabs */
  var TAB_KEY = 'opsapi-guide-tab';
  function selectTab(group, name, persist) {
    $$('.tabs[data-tabgroup="' + group + '"]').forEach(function (tabs) {
      var hasIt = $('[data-tab="' + name + '"]', tabs);
      if (!hasIt) return;
      $$('[role="tab"]', tabs).forEach(function (b) {
        var on = b.getAttribute('data-tab') === name;
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      });
      $$('[role="tabpanel"]', tabs).forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== name; });
    });
    if (persist) store.set(TAB_KEY, name);
  }
  // Wires one tab set. Also used for tab sets that tools build later, such as the request builder's.
  function initTabs(tabs, n) {
    $$('[role="tab"]', tabs).forEach(function (b) {
      var panel = $('[data-panel="' + b.getAttribute('data-tab') + '"]', tabs);
      var id = 'tab-' + n + '-' + b.getAttribute('data-tab');
      b.id = id;
      b.tabIndex = b.getAttribute('aria-selected') === 'true' ? 0 : -1;
      if (panel) { panel.setAttribute('aria-labelledby', id); panel.id = id + '-panel'; b.setAttribute('aria-controls', panel.id); }
    });
    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('[role="tab"]');
      if (b) selectTab(tabs.getAttribute('data-tabgroup'), b.getAttribute('data-tab'), true);
    });
    tabs.addEventListener('keydown', function (e) {
      var b = e.target.closest('[role="tab"]');
      if (!b || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
      var list = $$('[role="tab"]', tabs), i = list.indexOf(b);
      var next = list[(i + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
      selectTab(tabs.getAttribute('data-tabgroup'), next.getAttribute('data-tab'), true);
      next.focus();
    });
  }
  $$('.tabs').forEach(initTabs);
  var savedTab = store.get(TAB_KEY);
  if (savedTab) selectTab('client', savedTab, false);

  /* ------------------------------------------------ environment checker */
  // Paste a customer's Ops address; get all three API addresses and a live check of each.
  // Browsers can't read replies from another site (the APIs send no CORS headers), so each check
  // sends GET /Ping/hello (any answer proves the server is reachable) and loads the API's Swagger
  // icon (it loads only when that API is serving this environment; a wrong name returns 404).
  var APIS = [
    { key: 'ops', name: 'Ops API', prefix: 'OpsAPI_' },
    { key: 'est', name: 'Estimate API', prefix: 'EstAPI_' },
    { key: 'mr', name: 'Management Reporting API', prefix: 'MRAPI_' }
  ];
  var DEFAULT_ENV_URL = 'https://b2w-eus10.b2w.trimble.com/B2WTechSupport';
  var CHECK_TIMEOUT = 12000;
  var chk = { input: DEFAULT_ENV_URL, cluster: 'b2w-eus10.b2w.trimble.com', env: 'B2WTechSupport', error: '', results: {}, runId: 0 };
  var checkers = [];

  function parseEnv(raw) {
    var v = String(raw || '').trim();
    if (!v) return { error: 'Paste a B2W address, such as ' + DEFAULT_ENV_URL + '.' };
    var u;
    try { u = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v); } catch (e) { return { error: 'That doesn’t look like a web address. Paste the full address, such as ' + DEFAULT_ENV_URL + '.' }; }
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(u.hostname)) return { error: 'Include the host, such as b2w-eus10.b2w.trimble.com, before the environment name.' };
    var first = u.pathname.split('/').filter(Boolean)[0] || '';
    var env = decodeURIComponent(first).replace(/^(opsapi|estapi|mrapi)_/i, '');
    if (!env || !/^[A-Za-z0-9_-]+$/.test(env)) return { error: 'Add the environment name after the host, for example …/B2WTechSupport.' };
    return { cluster: u.hostname.toLowerCase(), env: env };
  }
  function apiUrl(a) { return 'https://' + chk.cluster + '/' + a.prefix + chk.env; }

  function probe(base) {
    var started = performance.now();
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, CHECK_TIMEOUT);
    var ping = fetch(base + '/Ping/hello', { mode: 'no-cors', cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then(function () { return { reached: true, ms: Math.round(performance.now() - started) }; },
            function (e) { return { reached: false, timeout: !!(e && e.name === 'AbortError') }; })
      .then(function (r) { clearTimeout(timer); return r; });
    var served = new Promise(function (resolve) {
      var img = new Image(), done = false;
      var finish = function (ok) { if (!done) { done = true; resolve(ok); } };
      setTimeout(function () { finish(false); }, CHECK_TIMEOUT);
      img.onload = function () { finish(true); };
      img.onerror = function () { finish(false); };
      img.src = base + '/doc/favicon-16x16.png?check=' + Date.now();
    });
    return Promise.all([ping, served]).then(function (x) {
      var p = x[0], ok = x[1];
      if (ok) return { state: 'up', ms: p.reached ? p.ms : null };
      if (!p.reached) return { state: 'down', timeout: p.timeout };
      return { state: 'missing' };
    });
  }

  function runChecks() {
    if (chk.error) return;
    var run = ++chk.runId;
    APIS.forEach(function (a) { chk.results[a.key] = { state: 'checking' }; });
    renderCheckers();
    APIS.forEach(function (a) {
      probe(apiUrl(a)).then(function (r) {
        if (run !== chk.runId) return;   // a newer check replaced this one
        chk.results[a.key] = r;
        renderCheckers();
      });
    });
  }

  var STATUS = {
    idle: ['', 'Not checked'],
    checking: ['checking', 'Checking…'],
    up: ['up', 'Up'],
    missing: ['missing', 'Not found'],
    down: ['down', 'No response']
  };
  function statusDetail(a, r) {
    if (r.state === 'up') return r.ms ? 'Answered in ' + r.ms + ' ms' : 'Answered';
    if (r.state === 'missing') return 'The server answered, but there is no ' + a.name + ' at this address';
    if (r.state === 'down') return r.timeout ? 'No answer within ' + CHECK_TIMEOUT / 1000 + ' seconds' : 'Couldn’t reach the server';
    if (r.state === 'checking') return 'Sending GET /Ping/hello…';
    return 'Press Check to test it';
  }
  function powershellFor() {
    return 'foreach ($api in "OpsAPI", "EstAPI", "MRAPI") {\n' +
      '    $url = "https://' + chk.cluster + '/$($api)_' + chk.env + '/Ping/hello"\n' +
      '    try   { "{0,-7} {1}" -f $api, (Invoke-RestMethod $url -TimeoutSec 15) }\n' +
      '    catch { "{0,-7} FAILED: {1}" -f $api, $_.Exception.Message }\n' +
      '}';
  }
  function renderCheckers() {
    var states = APIS.map(function (a) { return (chk.results[a.key] || { state: 'idle' }).state; });
    var done = states.filter(function (s) { return s === 'up' || s === 'missing' || s === 'down'; }).length;
    var up = states.filter(function (s) { return s === 'up'; }).length;
    var summary = '', summaryCls = '';
    if (states.indexOf('checking') > -1) { summary = 'Checking ' + APIS.length + ' APIs…'; }
    else if (done === APIS.length) {
      summary = up === APIS.length ? 'All three APIs are up for ' + chk.env + '.' : up + ' of 3 APIs answered for ' + chk.env + '. Check the ones marked Not found or No response.';
      summaryCls = up === APIS.length ? 'ok' : 'warn';
    }
    checkers.forEach(function (c) {
      if (chk.error) {
        c.parsed.className = 'chk-parsed warn';
        c.parsed.textContent = chk.error;
        c.rows.innerHTML = '';
        c.summary.textContent = '';
        return;
      }
      var opsSite = 'https://' + chk.cluster + '/' + chk.env;
      c.parsed.className = 'chk-parsed';
      c.parsed.innerHTML = 'Cluster <code>' + esc(chk.cluster) + '</code> · Environment <code>' + esc(chk.env) + '</code> · <a href="' + esc(opsSite) + '" target="_blank" rel="noopener">Ops site</a>' +
        (/\.b2w\.trimble\.com$/.test(chk.cluster) ? '' : '<span class="chk-warn">Cloud clusters usually end in .b2w.trimble.com</span>');
      c.rows.innerHTML = APIS.map(function (a) {
        var url = apiUrl(a), r = chk.results[a.key] || { state: 'idle' }, st = STATUS[r.state];
        return '<div class="chk-row">' +
          '<span class="chk-name"><span class="sw sw-' + a.key + '" aria-hidden="true"></span>' + esc(a.name) + '</span>' +
          '<code class="chk-url">' + esc(url) + '</code>' +
          '<span class="chk-status ' + st[0] + '"><span class="pill">' + st[1] + '</span><span class="chk-detail">' + esc(statusDetail(a, r)) + '</span></span>' +
          '<span class="acts">' +
            '<button class="mini-btn" type="button" data-copy="' + esc(url) + '" aria-label="Copy the ' + esc(a.name) + ' address">' + icon('i-copy') + 'Copy</button>' +
            '<a class="mini-btn" href="' + esc(url) + '/doc/index.html" target="_blank" rel="noopener" aria-label="Open the ' + esc(a.name) + ' docs">' + icon('i-book') + 'Docs</a>' +
            '<a class="mini-btn" href="' + esc(url) + '/Ping/hello" target="_blank" rel="noopener" aria-label="Open the ' + esc(a.name) + ' ping reply">' + icon('i-external') + 'Ping</a>' +
          '</span></div>';
      }).join('');
      c.summary.className = 'chk-summary ' + summaryCls;
      c.summary.textContent = summary;
      var ps = $('pre code', c.more);
      if (ps) ps.innerHTML = highlight(powershellFor(), RULES.powershell);
    });
  }
  function setEnvInput(value, from) {
    chk.input = value;
    var r = parseEnv(value);
    chk.error = r.error || '';
    if (!r.error) {
      if (r.cluster !== chk.cluster || r.env !== chk.env) { chk.results = {}; chk.runId++; }
      chk.cluster = r.cluster;
      chk.env = r.env;
    }
    checkers.forEach(function (c) { if (c !== from) c.input.value = value; });
    renderCheckers();
  }
  function mountChecker(el, n) {
    var id = 'chk-input-' + n;
    el.innerHTML =
      '<div class="tool checker">' +
        '<div class="tool-head"><span class="tool-tag">Tool</span><h4>Environment checker</h4><span class="meta">Builds all three API addresses and checks each one</span></div>' +
        '<div class="tool-body">' +
          '<form class="chk-form" novalidate>' +
            '<label for="' + id + '">Customer’s Ops address</label>' +
            '<div class="chk-input"><input id="' + id + '" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="' + DEFAULT_ENV_URL + '">' +
            '<button class="btn btn-primary" type="submit">' + icon('i-signal') + 'Check</button></div>' +
            '<p class="chk-hint">Paste the Ops site, any API address, or a Swagger link. Pasting runs the check right away.</p>' +
          '</form>' +
          '<p class="chk-parsed" aria-live="polite"></p>' +
          '<div class="chk-rows"></div>' +
          '<p class="chk-summary" aria-live="polite"></p>' +
          '<details class="chk-more"><summary>How the check works, and how to see the raw replies</summary><div class="chk-more-body">' +
            '<p>Your browser sends <code>GET /Ping/hello</code> to each API, the same app-up test the API docs describe. Browsers can’t read replies from another site, so the checker also loads each API’s documentation icon, which only loads when that API is serving this environment. No credentials are sent.</p>' +
            '<p><b>Up</b> means the API answered. <b>Not found</b> means the server answered but has no API at that address, usually a misspelled environment name. <b>No response</b> means the site, IIS, or the network is down, or you are offline.</p>' +
            '<p>To see the actual replies, run this in PowerShell. Each line should end with <code>hello|</code>.</p>' +
            '<div class="code"><div class="code-head"><span>PowerShell</span><button class="copy-btn" type="button">' + icon('i-copy') + 'Copy</button></div><pre data-lang="powershell"><code></code></pre></div>' +
          '</div></details>' +
        '</div>' +
      '</div>';
    var c = { el: el, input: $('input', el), rows: $('.chk-rows', el), parsed: $('.chk-parsed', el), summary: $('.chk-summary', el), more: $('.chk-more-body', el) };
    c.input.value = chk.input;
    $('form', el).addEventListener('submit', function (e) { e.preventDefault(); setEnvInput(c.input.value, c); runChecks(); });
    c.input.addEventListener('input', function () { setEnvInput(c.input.value, c); });
    c.input.addEventListener('paste', function () {
      setTimeout(function () { setEnvInput(c.input.value, c); if (!chk.error) runChecks(); }, 0);
    });
    checkers.push(c);
  }
  $$('[data-checker]').forEach(mountChecker);
  renderCheckers();

  // Dialogs: the checker and the error decoder, opened from the header or any
  // data-open-modal="checker|decoder" button.
  var openDialog = null, modalReturn = null;
  function openModal(name, trigger) {
    if (openDialog) closeModal(false);
    var m = $('#' + name + '-modal');
    if (!m) return;
    // Opened from inside another dialog: focus goes back to whatever opened that one.
    if (!(trigger && trigger.closest('.modal'))) modalReturn = trigger || null;
    m.hidden = false;
    openDialog = m;
    document.body.style.overflow = 'hidden';
    var input = $('textarea, input', m);
    input.focus();
    input.select();
    if (name === 'checker') {
      var anyChecked = APIS.some(function (a) { return chk.results[a.key]; });
      if (!anyChecked && !chk.error) runChecks();
    }
    if (name === 'builder' && builders.length && !(trigger && trigger.hasAttribute('data-build'))) builders[0].follow(currentProduct());
  }
  function closeModal(restoreFocus) {
    if (!openDialog) return;
    // A pasted token never outlives the dialog it was pasted into.
    if (openDialog.id === 'token-modal' && tokenTool) tokenTool.clear();
    openDialog.hidden = true;
    openDialog = null;
    document.body.style.overflow = '';
    if (restoreFocus !== false && modalReturn) modalReturn.focus();
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-open-modal]');
    if (t) { openModal(t.getAttribute('data-open-modal'), t); return; }
    if (!openDialog) return;
    if (e.target.closest('[data-close-modal]') || e.target === openDialog) { closeModal(); return; }
    // A link to a section of the guide closes the dialog so the reader lands on it.
    var a = e.target.closest('a[href^="#"]');
    if (a && openDialog.contains(a)) closeModal(false);
  });
  $$('.modal').forEach(function (m) {
    m.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = $$('button, a[href], input, textarea, select, summary', m).filter(function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
  });

  /* ------------------------------------------------- endpoint explorers */
  var chip = function (m) { return '<span class="m m-sm m-' + m.toLowerCase() + '">' + m + '</span>'; };
  var FULL = ['GET', 'POST', 'PUT', 'DELETE'];
  // Ops API: [name, group, base methods, has /schema, extra routes [method, path], note]
  var OPS_EP = [
    ['Login', 'auth', ['GET'], false, [], 'Credentials in headers → AccessToken'],
    ['LoginWithTID', 'auth', ['GET'], false, [], 'Trimble ID token → Ops AccessToken'],
    ['Ping', 'auth', [], false, [['GET', '/{input}']], 'No login needed'],
    ['Version', 'auth', ['GET'], false, [], 'No login needed'],
    ['SystemInfo', 'auth', ['GET'], false, [], 'Trimble ID mode and licensing'],
    ['Job', 'jobs', FULL, true, []],
    ['JobChangeOrder', 'jobs', FULL, true, []],
    ['JobCostBreakdownElement', 'jobs', FULL, true, []],
    ['JobCostBreakdownElementMaterial', 'jobs', FULL, true, []],
    ['JobEstimateItem', 'jobs', FULL, true, []],
    ['JobFileAttachment', 'jobs', FULL, true, []],
    ['JobLaborRateClass', 'jobs', ['GET', 'POST', 'DELETE'], true, []],
    ['JobMaterial', 'jobs', FULL, true, []],
    ['JobOrganization', 'jobs', ['GET', 'POST', 'DELETE'], true, []],
    ['JobOverheadAccount', 'jobs', FULL, true, []],
    ['JobProductionAccount', 'jobs', FULL, true, []],
    ['JobProductionTarget', 'jobs', FULL, true, []],
    ['JobProjectManager', 'jobs', ['GET', 'POST', 'DELETE'], true, []],
    ['JobSite', 'jobs', FULL, true, []],
    ['JobSubcontractorQuote', 'jobs', FULL, true, []],
    ['JobTnMWorkItem', 'jobs', FULL, true, []],
    ['ConnectProjectInformation', 'jobs', ['GET', 'POST', 'DELETE'], true, []],
    ['BusinessUnit', 'people', ['GET'], true, []],
    ['Contact', 'people', FULL, true, []],
    ['Employee', 'people', FULL, true, []],
    ['EmployeeCertification', 'people', FULL, true, []],
    ['Organization', 'people', FULL, true, []],
    ['User', 'people', FULL, true, []],
    ['LaborType', 'people', FULL, true, []],
    ['LaborTypeRate', 'people', FULL, true, []],
    ['LaborRateClass', 'people', FULL, true, []],
    ['Equipment', 'equip', FULL, true, []],
    ['EquipmentLocation', 'equip', ['GET'], true, []],
    ['EquipmentRate', 'equip', FULL, true, []],
    ['EquipmentRateClass', 'equip', FULL, true, []],
    ['EquipmentType', 'equip', FULL, true, []],
    ['InternalTruck', 'equip', FULL, true, []],
    ['SubcontractedTruck', 'equip', FULL, true, []],
    ['MaintenanceRequest', 'equip', FULL, true, [['GET', '/enums']]],
    ['MaintenanceRequestAttachment', 'equip', FULL, true, [['GET', '/withBytes']]],
    ['MaintenanceRequestComment', 'equip', FULL, true, []],
    ['Part', 'equip', FULL, true, []],
    ['PartInventory', 'equip', FULL, true, []],
    ['TrackWorkOrder', 'equip', FULL, true, []],
    ['Category', 'lists', FULL, true, []],
    ['Subcategory', 'lists', FULL, true, []],
    ['Factor', 'lists', FULL, true, []],
    ['Material', 'lists', FULL, true, []],
    ['Miscellaneous', 'lists', FULL, true, []],
    ['OverheadAccount', 'lists', FULL, true, []],
    ['ProductionAccount', 'lists', FULL, true, []],
    ['Place', 'lists', FULL, true, []],
    ['UnitOfMeasure', 'lists', ['GET'], true, []],
    ['ExternalSystem', 'lists', FULL, true, []],
    ['ExternalUMMapping', 'lists', FULL, true, []],
    ['ResourceEvent', 'field', FULL, true, []],
    ['ProductionCrewTemplate', 'field', ['GET'], true, []],
    ['TransportCrewTemplate', 'field', ['GET'], true, []],
    ['FieldLogWorkLogStatus', 'field', ['GET', 'PUT'], true, []],
    ['IntegrationAndAddInExecution', 'int', ['GET'], true, []],
    ['IntegrationAndAddInExecutionExportItem', 'int', ['GET'], true, []],
    ['IntegrationAndAddInExecutionExportItemRecord', 'int', ['GET'], true, []],
    ['TrueUpMaterialBatch', 'int', ['GET', 'POST', 'DELETE'], false, [['GET', '/{TrueUpBatchNumber}/TrueUpMaterial'], ['GET', '/{TrueUpBatchNumber}/TrueUpAccountMaterial']]],
    ['TrueUpPriceAndCostBatch', 'int', ['GET', 'POST', 'DELETE'], false, [['GET', '/{TrueUpBatchNumber}/TrueUpAccount'], ['GET', '/{TrueUpBatchNumber}/TrueUpEstimateItem']]]
  ];
  // Estimate and MR APIs, from their catalogs: [path, methods, has /schema, needs EstimateREF header]
  var EST_EP = [
    ['/Login', 'GET', 0, 0], ['/Ping/{input}', 'GET', 0, 0],
    ['/Estimate', 'GET,POST,PUT', 1, 0], ['/BidSchedule', 'GET,POST,PUT', 1, 0], ['/Estimate/MinorityParticipationRequirement', 'GET,POST,PUT', 1, 0],
    ['/Estimate/BidAs', 'GET', 0, 1], ['/Estimate/EquipmentRateClass', 'GET', 0, 1], ['/Estimate/EstimateType', 'GET', 0, 1], ['/Estimate/EstimateStatus', 'GET', 0, 1],
    ['/Estimate/JobCostID', 'GET', 0, 1], ['/Estimate/LaborRateClass', 'GET', 0, 1], ['/Estimate/MinorityType', 'GET', 0, 1], ['/Estimate/UserDefinedField', 'GET', 0, 1], ['/Estimate/WorkRule', 'GET', 0, 1],
    ['/Estimate/IndirectItem', 'GET', 0, 0], ['/Estimate/PayItem', 'GET', 0, 0], ['/Estimate/WBSLevel', 'GET', 0, 0], ['/Estimate/WBSApportioning', 'GET', 0, 0],
    ['/Estimate/TaskComponent', 'GET', 0, 0], ['/Estimate/MaterialComponent', 'GET', 0, 0], ['/Estimate/LaborComponent', 'GET', 0, 0], ['/Estimate/EquipmentComponent', 'GET', 0, 0], ['/Estimate/CrewComponent', 'GET', 0, 0],
    ['/Resource/Equipment', 'GET,PUT', 1, 0], ['/Resource/EquipmentBurden', 'GET,POST,PUT', 1, 0], ['/Resource/EquipmentBurdenInstance', 'GET,POST,PUT', 1, 0], ['/Resource/EquipmentRateClass', 'GET', 1, 0],
    ['/Resource/EquipmentRateClassBurden', 'GET', 1, 0], ['/Resource/EquipmentType', 'GET,POST,PUT', 1, 0], ['/Resource/JobCostID', 'GET,POST,PUT', 1, 0], ['/Resource/LaborBurden', 'GET,POST,PUT', 1, 0],
    ['/Resource/Laborer', 'GET,PUT', 1, 0], ['/Resource/LaborerBurden', 'GET,POST,PUT', 1, 0], ['/Resource/LaborRateClass', 'GET', 1, 0], ['/Resource/LaborRateClassBurden', 'GET', 1, 0],
    ['/Resource/LaborType', 'GET,POST,PUT', 1, 0], ['/Resource/Material', 'GET,POST,PUT', 1, 0], ['/Resource/MinorityType', 'GET,POST,PUT', 1, 0], ['/Resource/Miscellaneous', 'GET,POST,PUT', 1, 0], ['/Resource/UserDefinedField', 'GET,POST,PUT', 1, 0],
    ['/Resource/Organization/Competitor', 'GET,POST,PUT', 1, 0], ['/Resource/Organization/Competitor/Category', 'GET', 0, 1], ['/Resource/Organization/Contact', 'GET,POST,PUT', 1, 0],
    ['/Resource/Organization/Customer', 'GET,POST,PUT', 1, 0], ['/Resource/Organization/Customer/Category', 'GET', 0, 1], ['/Resource/Organization/EngineerArchitect', 'GET,POST,PUT', 1, 0],
    ['/Resource/Organization/EngineerArchitect/Category', 'GET', 0, 1], ['/Resource/Organization/Manufacturer', 'GET,POST,PUT', 1, 0], ['/Resource/Organization/Manufacturer/Category', 'GET', 0, 1],
    ['/Resource/Organization/ManufacturerMaterial', 'GET,POST,PUT', 1, 0], ['/Resource/Organization/OrganizationMaterialCategory', 'GET,POST', 1, 0], ['/Resource/Organization/OrganizationMaterialSubcategory', 'GET,POST', 1, 0],
    ['/Resource/Organization/OrganizationMinorityType', 'GET,POST,PUT', 1, 0], ['/Resource/Organization/OrganizationWorkSubtype', 'GET,POST', 1, 0], ['/Resource/Organization/OrganizationWorkType', 'GET,POST', 1, 0],
    ['/Resource/Organization/Subcontractor', 'GET,POST,PUT', 1, 0], ['/Resource/Organization/Subcontractor/Category', 'GET', 0, 1], ['/Resource/Organization/Vendor', 'GET,POST,PUT', 1, 0],
    ['/Resource/Organization/Vendor/Category', 'GET', 0, 1], ['/Resource/Organization/VendorMaterial', 'GET,POST,PUT', 1, 0],
    ['/Resource/Category/BidAs', 'GET,POST,PUT', 1, 0], ['/Resource/Category/CompetitorCategory', 'GET,POST,PUT', 1, 0], ['/Resource/Category/CustomerCategory', 'GET,POST,PUT', 1, 0],
    ['/Resource/Category/EngineerArchitectCategory', 'GET,POST,PUT', 1, 0], ['/Resource/Category/EquipmentBurdenCategory', 'GET,POST,PUT', 1, 0], ['/Resource/Category/EquipmentCategory', 'GET,POST,PUT', 1, 0],
    ['/Resource/Category/EstimateStatus', 'GET,POST,PUT', 1, 0], ['/Resource/Category/EstimateType', 'GET,POST,PUT', 1, 0], ['/Resource/Category/LaborBurdenCategory', 'GET,POST,PUT', 1, 0],
    ['/Resource/Category/LaborCategory', 'GET,POST,PUT', 1, 0], ['/Resource/Category/ManufacturerCategory', 'GET,POST,PUT', 1, 0], ['/Resource/Category/MaterialCategory', 'GET,POST,PUT', 1, 0],
    ['/Resource/Category/SubcontractorCategory', 'GET,POST,PUT', 1, 0], ['/Resource/Category/Tag', 'GET,POST,PUT', 1, 0], ['/Resource/Category/VendorCategory', 'GET,POST,PUT', 1, 0],
    ['/Resource/Category/WorkType', 'GET,POST,PUT', 1, 0], ['/Resource/Subcategory/MaterialSubcategory', 'GET,POST,PUT', 1, 0], ['/Resource/Subcategory/TagValue', 'GET,POST,PUT', 1, 0],
    ['/Resource/Subcategory/WorkSubtype', 'GET,POST,PUT', 1, 0], ['/Options/MaterialSettings', 'GET,PUT', 1, 0]
  ];
  var MR_EP = [
    ['/Login', 'GET', 0, 0], ['/Ping/{input}', 'GET', 0, 0],
    ['/Estimate', 'GET', 1, 0], ['/Estimate/PayItem', 'GET', 1, 1], ['/Estimate/PayItemDetail', 'GET', 1, 1], ['/Estimate/PayItemAll', 'GET', 1, 0],
    ['/Estimate/IndirectItem', 'GET', 1, 1], ['/Estimate/IndirectItemDetail', 'GET', 1, 1], ['/Estimate/IndirectItemAll', 'GET', 1, 0],
    ['/Estimate/Task', 'GET', 1, 1], ['/Estimate/TaskDetail', 'GET', 1, 1], ['/Estimate/TaskAll', 'GET', 1, 0],
    ['/Estimate/WBSLevel', 'GET', 1, 1], ['/Estimate/WBSLevelDetail', 'GET', 1, 1], ['/Estimate/WBSLevelAll', 'GET', 1, 0],
    ['/BidResultsCompetitor', 'GET', 1, 0], ['/BidResultsCompetitorItemPrice', 'GET', 1, 0], ['/BidResultsItem', 'GET', 1, 0], ['/BidResultsSettings', 'GET', 1, 0],
    ['/BidSchedule', 'GET', 1, 0], ['/ItemBidClosingInformation', 'GET', 1, 0], ['/MinorityParticipationSummary', 'GET', 1, 0],
    ['/CrewComponent', 'GET', 1, 0], ['/EquipmentComponent', 'GET', 1, 0], ['/LaborComponent', 'GET', 1, 0], ['/MaterialComponent', 'GET', 1, 0], ['/MiscellaneousComponent', 'GET', 1, 0],
    ['/TruckingComponent', 'GET', 1, 0], ['/EquipmentBurdenInstance', 'GET', 1, 0], ['/LaborBurdenInstance', 'GET', 1, 0], ['/TruckingTimeBreakdownInstance', 'GET', 1, 0],
    ['/ItemTaskComponent', 'GET', 1, 0], ['/ItemTaskQuickCostCategory', 'GET', 1, 0], ['/ItemTaskSubcontractorQuote', 'GET', 1, 0], ['/CostComponentTag', 'GET', 1, 0],
    ['/Customer', 'GET', 1, 0], ['/Competitor', 'GET', 1, 0], ['/Vendor', 'GET', 1, 0], ['/Subcontractor', 'GET', 1, 0], ['/Material', 'GET', 1, 0], ['/MaterialManufacturer', 'GET', 1, 0],
    ['/VendorQuote', 'GET', 1, 0], ['/RFQGroupVendor', 'GET', 1, 0], ['/RFQGroupSubcontractor', 'GET', 1, 0], ['/VendorRFQGroup', 'GET', 1, 0], ['/SubcontractorRFQGroup', 'GET', 1, 0],
    ['/ChangeOrder', 'GET', 1, 0], ['/ChangeOrderLog', 'GET', 1, 0],
    ['/DataWarehouseInformation', 'GET', 1, 0], ['/SourceDatabase', 'GET', 1, 0], ['/CompatibleSourceDatabaseVersion', 'GET', 1, 0], ['/GlobalOptions', 'GET', 1, 0],
    ['/CategorizedValueInformation', 'GET', 1, 0], ['/UserDefinedField', 'GET', 1, 0]
  ];
  function estGroup(p) {
    if (p === '/Login' || p.indexOf('/Ping') === 0) return 'auth';
    if (p.indexOf('/Estimate') === 0 || p === '/BidSchedule') return 'est';
    if (p.indexOf('/Resource/Organization/') === 0) return 'org';
    if (p.indexOf('/Resource/Category/') === 0 || p.indexOf('/Resource/Subcategory/') === 0) return 'cat';
    if (p.indexOf('/Options/') === 0) return 'opt';
    return 'res';
  }
  function mrGroup(p) {
    if (p === '/Login' || p.indexOf('/Ping') === 0) return 'auth';
    if (p.indexOf('/Estimate') === 0) return 'est';
    if (/^\/(BidResults|BidSchedule|ItemBidClosingInformation|MinorityParticipationSummary)/.test(p)) return 'bid';
    if (/Component|BurdenInstance|ItemTask|TruckingTimeBreakdown/.test(p)) return 'cost';
    if (/^\/ChangeOrder/.test(p)) return 'co';
    if (/^\/(Customer|Competitor|Vendor|Subcontractor|Material|RFQGroup)/.test(p)) return 'org';
    return 'sys';
  }
  var CATALOG_NOTES = { '/Login': 'userName + password headers → AccessToken', '/Ping/{input}': 'No login needed' };
  function fromCatalog(rows, groupOf) {
    return rows.map(function (r) {
      return { name: r[0], group: groupOf(r[0]), methods: r[1].split(','), schema: !!r[2], ref: !!r[3], extras: [], note: CATALOG_NOTES[r[0]] || '' };
    });
  }
  var EXPLORERS = {
    ops: {
      entries: OPS_EP.map(function (e) {
        return { name: '/' + e[0], group: e[1], methods: e[2], schema: e[3], ref: false, note: e[5] || '',
          extras: e[4].map(function (x) { return [x[0], '/' + e[0] + x[1]]; }) };
      }),
      groups: [['all', 'All'], ['auth', 'Sign-in & service'], ['jobs', 'Jobs'], ['people', 'People & organizations'], ['equip', 'Equipment & maintenance'],
        ['lists', 'Materials, accounts & lists'], ['field', 'Scheduling & field'], ['int', 'Integrations & true-up']],
      placeholder: 'Try “job”, “equipment”, or “true-up”', methods: ['GET', 'POST', 'PUT', 'DELETE']
    },
    est: {
      entries: fromCatalog(EST_EP, estGroup),
      groups: [['all', 'All'], ['est', 'Estimates'], ['res', 'Resources'], ['org', 'Organizations'], ['cat', 'Categories & lists'], ['opt', 'Settings'], ['auth', 'Sign-in & service']],
      placeholder: 'Try “vendor”, “material”, or “pay item”', methods: ['GET', 'POST', 'PUT']
    },
    mr: {
      entries: fromCatalog(MR_EP, mrGroup),
      groups: [['all', 'All'], ['est', 'Estimates'], ['bid', 'Bid results'], ['cost', 'Cost components'], ['org', 'Organizations & quotes'],
        ['co', 'Change orders'], ['sys', 'Data Warehouse & lists'], ['auth', 'Sign-in & service']],
      placeholder: 'Try “pay item”, “bid results”, or “vendor”', methods: ['GET']
    }
  };
  function mountExplorer(el, n) {
    var cfg = EXPLORERS[el.getAttribute('data-explorer')];
    if (!cfg) return;
    var sid = 'ep-search-' + n, group = 'all';
    var labels = {}; cfg.groups.forEach(function (g) { labels[g[0]] = g[1]; });
    var total = cfg.entries.reduce(function (s, e) { return s + e.methods.length + (e.schema ? 1 : 0) + e.extras.length; }, 0);
    var hasRef = cfg.entries.some(function (e) { return e.ref; });
    el.innerHTML =
      '<div class="tool-head"><span class="tool-tag">Tool</span><h4>Endpoint explorer</h4><span class="meta ep-count" aria-live="polite"></span></div>' +
      '<div class="tool-body"><div class="ep-controls">' +
        '<div class="field"><label for="' + sid + '">Search endpoints</label><input id="' + sid + '" class="ep-search" type="search" placeholder="' + esc(cfg.placeholder) + '" autocomplete="off" spellcheck="false"></div>' +
        '<div class="ep-filters" role="group" aria-label="Filter by area">' + cfg.groups.map(function (g) {
          return '<button type="button" data-g="' + g[0] + '" aria-pressed="' + (g[0] === 'all') + '">' + esc(g[1]) + '</button>';
        }).join('') + '</div>' +
      '</div><div class="ep-list"></div>' +
      '<div class="ep-legend">' + cfg.methods.map(function (m) { return '<span>' + chip(m) + ' ' + { GET: 'read', POST: 'create', PUT: 'update', DELETE: 'remove' }[m] + '</span>'; }).join('') +
        '<span><code>/schema</code> field definitions</span>' + (hasRef ? '<span><span class="ep-tag">EstimateREF</span> needs that header</span>' : '') + '</div></div>';
    var search = $('.ep-search', el), list = $('.ep-list', el), count = $('.ep-count', el), filters = $('.ep-filters', el);
    function render() {
      var q = norm(search.value).replace(/ /g, '');
      var shown = cfg.entries.filter(function (e) {
        if (group !== 'all' && e.group !== group) return false;
        if (!q) return true;
        var hay = norm(e.name + ' ' + labels[e.group] + ' ' + e.note + (e.ref ? ' estimateref' : '')).replace(/ /g, '');
        return hay.indexOf(q) > -1;
      });
      list.innerHTML = shown.map(function (e) {
        var base = e.methods.length ? '<div class="ep-methods">' + e.methods.map(chip).join('') + (e.schema ? ' <span class="ep-extra">+ /schema</span>' : '') + (e.ref ? ' <span class="ep-tag">EstimateREF</span>' : '') + '</div>' : '';
        var extra = e.extras.map(function (x) { return '<div class="ep-extra">' + chip(x[0]) + ' ' + esc(x[1]) + '</div>'; }).join('');
        var target = (e.methods.length ? e.name : e.extras.length ? e.extras[0][1] : '').replace(/\{input\}/, 'hello');
        var build = target ? '<button class="mini-btn ep-build" type="button" data-build="' + esc(target) + '" aria-label="Build a request for ' + esc(target) + '">' + icon('i-wrench') + 'Build</button>' : '';
        return '<div class="ep"><div class="ep-head"><div class="ep-name">' + esc(e.name) + '</div>' + build + '</div>' + base + extra + (e.note ? '<div class="ep-extra">' + esc(e.note) + '</div>' : '') + '</div>';
      }).join('') || '<p class="ep-count">No endpoints match. Try a shorter word.</p>';
      count.textContent = 'Showing ' + shown.length + ' of ' + cfg.entries.length + ' endpoint groups · ' + total + ' operations in all';
    }
    filters.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-g]');
      if (!b) return;
      group = b.getAttribute('data-g');
      $$('button', filters).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      render();
    });
    search.addEventListener('input', render);
    render();
  }
  $$('[data-explorer]').forEach(mountExplorer);

  /* ------------------------------------------------------ troubleshooter */
  var TS = {
    start: {
      q: 'What does the customer’s request or response look like?',
      help: 'Diagnostic question 1: which API surface is this?',
      options: [
        { label: 'JSON, or an address that contains OpsAPI_', next: 'ping', tag: 'Ops API (JSON)' },
        { label: 'XML, a SOAP envelope, or an .asmx address', next: 'r_soap', tag: 'SOAP XML' }
      ]
    },
    ping: {
      q: 'Open {baseUrl}/Ping/hello in a browser. What comes back?',
      help: 'Diagnostic question 2: base URL and connectivity. Ping needs no login.',
      options: [
        { label: 'The server name and “hello”, such as (b2w-eus10-iis2) hello|', next: 'method', tag: 'Ping works' },
        { label: 'An HTML “404” error page', next: 'r_badurl', tag: 'Ping 404' },
        { label: 'A timeout or “connection refused”', next: 'r_down', tag: 'No response' }
      ]
    },
    method: {
      q: 'How does the integration sign in?',
      help: 'Diagnostic question 3: authentication method. Look at the headers on the login call.',
      options: [
        { label: 'TID UUID + User API Secret (tiduuid and apiSecret headers)', next: 'login', set: 'tid', tag: 'TID UUID' },
        { label: 'Client ID + client secret', next: 'login', set: 'client', tag: 'Client ID' },
        { label: 'Username + password', next: 'login', set: 'user', tag: 'Username' },
        { label: 'LoginWithTID (a Trimble ID token)', next: 'login', set: 'lwt', tag: 'LoginWithTID' },
        { label: 'Not sure', next: 'r_unknown', tag: 'Not sure' }
      ]
    },
    login: {
      q: 'What does the login call return, on its own?',
      help: 'Diagnostic question 4: look at the login’s status code and body separately from the data call.',
      options: [
        { label: '200 OK with an AccessToken', next: 'data', tag: 'Login 200' },
        { label: '400 Bad Request', next: 'r_login400', tag: 'Login 400' },
        { label: '401 Unauthorized', next: 'r_login401_', tag: 'Login 401' },
        { label: '404 Not Found', next: 'r_login404_', tag: 'Login 404' },
        { label: '406 Not Acceptable', next: 'r_login406', tag: 'Login 406' },
        { label: '500 Internal Server Error', next: 'r_500', tag: 'Login 500' }
      ]
    },
    data: {
      q: 'The login works. What does the data call return?',
      help: 'Diagnostic question 5: is the AccessToken in the Authorization header?',
      options: [
        { label: '401 Unauthorized', next: 'r_data401', tag: 'Data 401' },
        { label: '403 Forbidden (“insufficient privileges”)', next: 'r_403', tag: 'Data 403' },
        { label: '400 Bad Request', next: 'r_data400', tag: 'Data 400' },
        { label: '404 Not Found', next: 'r_data404', tag: 'Data 404' },
        { label: '409 Conflict on a PUT', next: 'r_409', tag: 'Data 409' },
        { label: '422 on a POST or PUT', next: 'r_422', tag: 'Data 422' },
        { label: '200 OK, but exactly 100 records', next: 'r_100', tag: '100 records' },
        { label: '500 Internal Server Error', next: 'r_500', tag: 'Data 500' }
      ]
    },
    r_soap: { sev: 'info', title: 'This is the legacy SOAP Web Services, not the Ops API', body: '<p>XML message bodies and <code>.asmx</code> addresses belong to the older SOAP Web Services. They don’t map to Ops API 2.0 endpoints, so handle it as a Web Services ticket.</p><p>Where it makes sense, recommend moving the integration to the Ops API.</p>', link: ['#what-is-ops-api', 'Ops API vs. legacy Web Services'] },
    r_badurl: { sev: 'warn', title: 'The address is wrong', body: '<p>The server answered, so it is up, but that path doesn’t exist. Usually the environment name is misspelled or the <code>OpsAPI_</code> prefix is missing.</p><p>Rebuild the URL as <code>https://{cluster}/OpsAPI_{environment}</code> and try <code>/Ping/hello</code> again.</p>', link: ['#find-api-url', 'Build the URL'] },
    r_down: { sev: 'danger', title: 'The site, IIS, or the network is down', body: '<p>When Ping gets no answer at all, the API site, the IIS web server, or the network is down entirely.</p><ul><li>Check the customer’s network connectivity and routing, including firewalls, proxies, and DNS.</li><li>Check the IIS service host status.</li><li>Escalate if the site itself is down.</li></ul>', link: ['#connectivity', 'Connectivity checks'] },
    r_unknown: { sev: 'info', title: 'Find out the sign-in method first', body: '<p>Look at the headers on their login call:</p><ul><li><code>tiduuid</code> + <code>apiSecret</code>: TID UUID and User API Secret</li><li><code>clientId</code> + <code>clientSecret</code>: client credentials</li><li><code>userName</code> + <code>password</code>: username and password</li><li>A call to <code>/LoginWithTID</code>: a Trimble ID token</li></ul><p>Then go back one step and pick that method.</p>', link: ['#login-methods', 'Login methods'] },
    r_login400: { sev: 'warn', title: 'No credentials in the headers', body: '<p><code>/Login</code> only reads credentials from HTTP headers. Without a complete pair it returns 400 and <code>"Authentication information must be specified in the request header"</code>.</p><ul><li>Move the credentials out of the URL or body and into headers.</li><li>Check the header names exactly: <code>tiduuid</code>/<code>apiSecret</code>, <code>clientId</code>/<code>clientSecret</code>, or <code>userName</code>/<code>password</code>.</li><li>With a username, use the format <code>DOMAIN\\user</code> or <code>user@domain</code>.</li></ul>', link: ['#login-methods', 'How /Login reads headers'] },
    r_login401_tid: { sev: 'warn', title: 'The TID ID or User API Secret doesn’t match', body: '<p>Re-copy both values from the user’s <strong>User API Secret</strong> dialog. Ask whether someone generated a new secret recently; anything using the old secret needs the new value.</p>', link: ['#find-tid-secret', 'Find the TID UUID and secret'] },
    r_login401_client: { sev: 'warn', title: 'The client ID or secret doesn’t match Ops system settings', body: '<p>Client credentials must match the values stored in Ops. Re-copy them from <strong>Integrations &amp; Add-ins → Manage API Key</strong>, and ask whether a new key was generated recently.</p>', link: ['#find-client-id', 'Find the client ID and secret'] },
    r_login401_user: { sev: 'warn', title: 'Windows rejected the password', body: '<p>Ops checks username-and-password logins against the Windows domain controller, and it refused this one. Confirm the password, and that the account isn’t locked or expired.</p><p>This method is being retired, so it is a good moment to move the integration to TID or client credentials.</p>', link: ['#login-methods', 'Login methods'] },
    r_login401_lwt: { sev: 'warn', title: 'The Trimble ID token is missing, invalid, or expired', body: '<p>LoginWithTID needs a current Trimble ID access token as its bearer token. Have the person sign in to Trimble ID again for a fresh token, then retry.</p>', link: ['#login-methods', 'LoginWithTID'] },
    r_login404_tid: { sev: 'warn', title: 'No Ops user matches those credentials', body: '<p>Check that the user exists and is active in Ops, and that their <strong>TID / Mobile E-mail Address</strong> is filled in on the User View page.</p>', link: ['#find-tid-secret', 'User View'] },
    r_login404_client: { sev: 'danger', title: 'The built-in System Administrator record is missing', body: '<p>The client credentials were valid, but Ops couldn’t find the built-in System Administrator record to issue a token for. Escalate this one.</p>', link: ['#find-client-id', 'Client credentials'] },
    r_login404_user: { sev: 'warn', title: 'The account isn’t set up as an Ops user', body: '<p>No Ops user matches that Windows account name. Check the Ops user record and its Windows account name.</p>', link: ['#login-methods', 'Username and password details'] },
    r_login404_lwt: { sev: 'warn', title: 'The Trimble user isn’t linked to an Ops user', body: '<p>Trimble accepted and authenticated the person, but no Ops user matches their Trimble ID or mobile email address.</p><ul><li>Fix the link on the Ops user record: <strong>TID / Mobile E-mail Address</strong>.</li><li><strong>Do not reset the password.</strong> The Trimble sign-in is already valid.</li></ul>', link: ['#common-errors', 'LoginWithTID 404'] },
    r_login406: { sev: 'danger', title: 'The System Administrator account name is in an unexpected format', body: '<p>The catalog documents 406 as “SysAdmin WindowsAccountName is not in the expected format”. Capture the details and escalate.</p>', link: ['#status-codes', 'Status codes'] },
    r_500: { sev: 'danger', title: 'An unexpected internal Ops error', body: '<p>Capture the request with secrets removed, the full response body, and the date, time, and time zone, then escalate. The API logs server-side exceptions in its Logs folder.</p>', link: ['#work-a-ticket', 'What to collect'] },
    r_data401: { sev: 'warn', title: 'The bearer token is missing or expired', body: '<p>Login worked, so the credentials are fine. The data call isn’t carrying a valid token.</p><ul><li>Check the header reads exactly <code>Authorization: Bearer &lt;AccessToken&gt;</code>.</li><li>Tokens last 1 day, and a newer login retires the old one. Log in again and use the latest token.</li></ul>', link: ['#use-token', 'Using the token'] },
    r_403: { sev: 'warn', title: 'The security role lacks the API permission', body: '<p>The caller is known but not allowed. The response’s InternalMessage names the missing privilege, such as <code>ApiEmployee.Read</code>.</p><ul><li>Open the user’s security role and find the API section and that area’s row.</li><li>Grant the action they need: View for GET, Create for POST, Edit for PUT, Delete for DELETE.</li><li>Check their license too. A read-only license can’t make changes.</li></ul>', link: ['#fix-403', 'Fix a 403'] },
    r_data400: { sev: 'warn', title: 'The request is malformed', body: '<p>Check the query and the body against Swagger.</p><ul><li>OData text values need single quotes, for example <code>$filter=LastName eq \'Newman\'</code>.</li><li>Field names must match the catalog exactly.</li></ul>', link: ['#filter-page', 'OData syntax'] },
    r_data404: { sev: 'info', title: 'The record or endpoint wasn’t found', body: '<p>Check the functional area name in the path and the <code>ObjectID</code> you are targeting. An HTML 404 page instead of JSON means the base URL itself is wrong.</p>', link: ['#endpoints', 'Endpoint explorer'] },
    r_409: { sev: 'info', title: 'The update conflicts with the current record', body: '<p>The record most likely changed after it was read. GET it again, reapply the change, and PUT the whole record back with its current <code>RowVersion</code>.</p>', link: ['#create-update-delete', 'Updating a record'] },
    r_422: { sev: 'warn', title: 'The body isn’t a valid record', body: '<p>A required field may be missing, a field name misspelled, or the JSON malformed. Compare it with a GET of an existing record or with <code>/schema</code>.</p>', link: ['#create-update-delete', 'Creating a record'] },
    r_100: { sev: 'ok', title: 'That is the page size, not missing data', body: '<p>Each GET returns at most 100 records. Page with <code>$top=100&amp;$skip=100</code>, then <code>$skip=200</code>, until a page comes back with fewer than 100.</p>', link: ['#filter-page', 'Paging'] }
  };
  var sevLabel = { ok: 'Not an error', info: 'Likely cause', warn: 'Likely cause', danger: 'Likely cause · escalate if needed' };
  var tsStage = $('#ts-stage'), tsTrail = $('#ts-trail'), tsStep = $('#ts-step');
  var ts = { path: ['start'], tags: [], method: null, methods: [] };
  function tsRender(focus) {
    var id = ts.path[ts.path.length - 1], node = TS[id];
    tsTrail.innerHTML = ts.tags.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('');
    tsTrail.hidden = !ts.tags.length;
    var nav = '<div class="ts-actions">' +
      (ts.path.length > 1 ? '<button class="btn btn-sm" type="button" data-ts="back">Back</button>' : '') +
      (ts.path.length > 1 ? '<button class="btn btn-sm" type="button" data-ts="restart">Start over</button>' : '') + '</div>';
    if (node.options) {
      tsStep.textContent = 'Question ' + ts.path.length;
      tsStage.innerHTML = '<p class="ts-q" tabindex="-1">' + esc(node.q) + '</p><p class="ts-help">' + esc(node.help) + '</p><div class="ts-options">' +
        node.options.map(function (o, i) { return '<button type="button" data-opt="' + i + '"><span>' + esc(o.label) + '</span>' + icon('i-arrow') + '</button>'; }).join('') + '</div>' + nav;
    } else {
      tsStep.textContent = 'Result';
      tsStage.innerHTML = '<div class="ts-result sev-' + node.sev + '"><span class="lbl">' + sevLabel[node.sev] + '</span><h5 tabindex="-1">' + esc(node.title) + '</h5>' + node.body +
        '<p><a href="' + node.link[0] + '">Read more: ' + esc(node.link[1]) + ' →</a></p></div>' + nav;
    }
    if (focus) { var f = $('[tabindex="-1"]', tsStage); if (f) f.focus({ preventScroll: true }); }
  }
  tsStage.addEventListener('click', function (e) {
    var opt = e.target.closest('[data-opt]'), act = e.target.closest('[data-ts]');
    if (opt) {
      var node = TS[ts.path[ts.path.length - 1]], o = node.options[+opt.getAttribute('data-opt')];
      ts.methods.push(ts.method);
      if (o.set) ts.method = o.set;
      var next = /_$/.test(o.next) ? o.next + (ts.method || 'tid') : o.next;
      ts.path.push(next); ts.tags.push(o.tag);
      tsRender(true);
    } else if (act && act.getAttribute('data-ts') === 'back') {
      ts.path.pop(); ts.tags.pop(); ts.method = ts.methods.pop();
      tsRender(true);
    } else if (act && act.getAttribute('data-ts') === 'restart') {
      ts = { path: ['start'], tags: [], method: null, methods: [] };
      tsRender(true);
    }
  });
  tsRender(false);

  /* ------------------------------------------------------- error decoder */
  // Reads a pasted error (a status line, a response body, Postman or PowerShell output, a request
  // URL) and names the likely cause and fix. It all runs in the page: nothing pasted is sent or saved.
  var DEC_API = { ops: 'Ops API', est: 'Estimate API', mr: 'Management Reporting API' };
  var DEC_SHORT = { ops: 'Ops', est: 'Estimate', mr: 'MR' };
  var DEC_PREFIX = { ops: 'OpsAPI_', est: 'EstAPI_', mr: 'MRAPI_' };
  var DEC_POOL = { ops: 'the Ops API’s', est: 'the <strong>EstAPI</strong>', mr: 'the <strong>MRAPI</strong>' };
  var DEC_LINK = {
    url: { ops: ['#find-api-url', 'Build the URL'], est: ['#est-url', 'Build the URL'], mr: ['#mr-url', 'Build the URL'] },
    connect: { ops: ['#connectivity', 'Connectivity checks'], est: ['#est-troubleshoot', 'The app-up test'], mr: ['#mr-troubleshoot', 'The app-up test'] },
    login: { ops: ['#login-methods', 'Login methods'], est: ['#est-login', 'Logging in'], mr: ['#mr-login', 'Logging in'] },
    token: { ops: ['#use-token', 'Using the token'], est: ['#est-login', 'Logging in'], mr: ['#mr-login', 'Logging in'] },
    headers: { ops: ['#use-token', 'Using the token'], est: ['#est-headers', 'Headers every call needs'], mr: ['#mr-headers', 'Headers every call needs'] },
    query: { ops: ['#filter-page', 'Filter and page'], est: ['#est-query', 'Read, filter, and page'], mr: ['#mr-query', 'Read, filter, and page'] },
    endpoints: { ops: ['#endpoints', 'Endpoint explorer'], est: ['#est-endpoints', 'Endpoint explorer'], mr: ['#mr-endpoints', 'Endpoint explorer'] },
    write: { ops: ['#create-update-delete', 'Create, update, and delete'], est: ['#est-write', 'Create and update'], mr: ['#mr-what', 'What the MR API does'] },
    trouble: { ops: ['#work-a-ticket', 'What to collect'], est: ['#est-troubleshoot', 'Troubleshooting'], mr: ['#mr-troubleshoot', 'Troubleshooting'] }
  };
  function decLink(kind, api) { return DEC_LINK[kind][api] || DEC_LINK[kind].ops; }
  var codeTag = function (s) { return '<code>' + esc(s) + '</code>'; };

  var DEC_CODES = { 200: 'OK', 201: 'Created', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
    405: 'Method Not Allowed', 406: 'Not Acceptable', 409: 'Conflict', 415: 'Unsupported Media Type', 422: 'Unprocessable Entity',
    500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout' };
  var DEC_REASON = { 'unprocessable content': 422, 'gateway time-out': 504 };
  Object.keys(DEC_CODES).forEach(function (k) { DEC_REASON[DEC_CODES[k].toLowerCase()] = +k; });
  var reasonRx = function (list) {
    return list.sort(function (a, b) { return b.length - a.length; }).map(function (r) { return r.replace(/-/g, '\\-').replace(/ /g, '\\s+'); }).join('|');
  };
  var codeAlt = Object.keys(DEC_CODES).join('|');
  // "403 Forbidden", "(401) Unauthorized", "401 (Unauthorized)", "HTTP/1.1 404 Not Found"
  var RX_CODE_REASON = new RegExp('\\b(' + codeAlt + ')\\)?\\s*[-:]?\\s*\\(?(?:' + reasonRx(Object.keys(DEC_REASON)) + ')\\b', 'i');
  // A reason phrase on its own. Words like OK and Conflict are too common in ordinary text to count.
  var RX_REASON_ONLY = new RegExp('\\b(' + reasonRx(Object.keys(DEC_REASON).filter(function (r) { return !/^(ok|created|no content|conflict)$/.test(r); })) + ')\\b', 'i');
  function decStatus(t) {
    var m = RX_CODE_REASON.exec(t);
    if (m) return +m[1];
    m = /\bHTTP\/\d(?:\.\d)?\s+(\d{3})\b/i.exec(t) || /\bstatus(?:\s*code)?["']?\s*[:=]\s*["']?(\d{3})\b/i.exec(t) ||
      /\b(?:error|code|returned)\s*:?\s*\(?(\d{3})\b/i.exec(t);
    if (m && DEC_CODES[m[1]]) return +m[1];
    m = RX_REASON_ONLY.exec(t);
    if (m) return DEC_REASON[m[1].toLowerCase().replace(/\s+/g, ' ')];
    // Just a number, such as "401"
    if (t.trim().length <= 40) { m = new RegExp('\\b(' + codeAlt + ')\\b').exec(t); if (m) return +m[1]; }
    return null;
  }

  // Phrases that only one API (or two) uses: [pattern, apis, weight]
  var DEC_SIGNS = [
    [/Authentication information must be specified|insufficient privileges|required privilege|permission was not granted|WindowsAccountName/i, 'ops', 6],
    [/\bLoginWithTID\b|\btiduuid\b|\bapiSecret\b|\bRowVersion\b|\bCustomMessage\b|\bInternalMessage\b/i, 'ops', 3],
    [/Both userName and password must be specified|not authorized for this API/i, 'est mr', 6],
    [/\bAntiTamperToken\b|Operation is not allowed/i, 'est', 6],
    [/\bEstimateREF\b|\bDatabaseName\b/i, 'est mr', 3],
    [/NT AUTHORITY\\+NETWORK SERVICE|Cannot open database/i, 'est mr', 4],
    [/LastRetrievedFromSourceDatabaseOn|Data ?Warehouse|"Pagination"|\bTotalItems\b|\bItemsOnPage\b/i, 'mr', 5]
  ];
  var DEC_HEADERS = ['authorization', 'databasename', 'estimateref', 'clientid', 'clientsecret', 'content-type', 'accept',
    'username', 'password', 'tiduuid', 'apisecret'];

  // Every documented path for each API, from the endpoint explorers' lists.
  var DEC_CATALOG = {};
  Object.keys(EXPLORERS).forEach(function (k) {
    DEC_CATALOG[k] = EXPLORERS[k].entries.map(function (e) {
      var paths = [e.name].concat(e.extras.map(function (x) { return x[1]; }));
      return {
        name: e.name, ref: e.ref, key: e.name.toLowerCase().replace(/\/\{[^}]+\}/g, ''),
        methods: e.methods.concat(e.extras.map(function (x) { return x[0]; })),
        rx: paths.map(function (p) {
          return new RegExp('^' + p.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^}]+\}/g, '[^/]+') + '(?:/schema)?$', 'i');
        })
      };
    });
  });
  function decCleanPath(p) {
    return '/' + p.split(/[?#]/)[0].split('/').filter(function (s) {
      return s && !/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+|\{\{[^}]*\}\}|:\w+)$/i.test(s);
    }).join('/');
  }
  function editDistance(a, b) {
    var row = [], i, j, prev, tmp;
    for (j = 0; j <= b.length; j++) row[j] = j;
    for (i = 1; i <= a.length; i++) {
      prev = row[0]; row[0] = i;
      for (j = 1; j <= b.length; j++) {
        tmp = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = tmp;
      }
    }
    return row[b.length];
  }
  function decFindEndpoint(api, path) {
    var list = DEC_CATALOG[api] || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].rx.some(function (r) { return r.test(path); })) return list[i];
    }
    return null;
  }
  function decEndpoint(c) {
    var hit = decFindEndpoint(c.api, c.path);
    if (hit) {
      var badMethod = c.method && hit.methods.length && hit.methods.indexOf(c.method) < 0 && !/\/schema$/i.test(c.path);
      return { known: true, name: hit.name, methods: hit.methods, ref: hit.ref, badMethod: badMethod };
    }
    var low = c.path.toLowerCase(), best = null, bestD = 99;
    DEC_CATALOG[c.api].forEach(function (e) {
      var d = editDistance(low, e.key);
      if (d < bestD) { bestD = d; best = e; }
    });
    var other = Object.keys(DEC_CATALOG).filter(function (k) { return k !== c.api && decFindEndpoint(k, c.path); })[0] || null;
    return { known: false, suggest: best && bestD <= Math.min(3, Math.floor(low.length / 4)) ? best.name : null, otherApi: other };
  }

  function decJson(t) {
    var starts = [], rx = /^[ \t]*[[{]/gm, m;
    while ((m = rx.exec(t)) && starts.length < 6) starts.push(m.index);
    for (var i = 0; i < starts.length; i++) {
      var s = t.slice(starts[i]).trim();
      try { return JSON.parse(s); } catch (e) { /* try the next candidate */ }
      var end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
      if (end > 0) { try { return JSON.parse(s.slice(0, end + 1)); } catch (e) { /* not JSON */ } }
    }
    return null;
  }

  function decAnalyze(text, pick) {
    var t = text, c = { text: t };
    // Request headers pasted as "Name: value" lines
    var hdr = {}, hdrCount = 0;
    c.body = t.split(/\r?\n/).filter(function (ln) {
      var m = /^\s*([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(ln);
      if (m && DEC_HEADERS.indexOf(m[1].toLowerCase()) > -1) { hdr[m[1].toLowerCase()] = m[2].trim(); hdrCount++; return false; }
      return true;
    }).join('\n');
    c.headers = hdrCount >= 2 || hdr.authorization != null ? hdr : null;
    c.status = decStatus(t);
    c.soap = /<soap:|soap:Envelope|soap12:|\.asmx\b/i.test(t);
    c.html404 = /File or directory not found|HTTP Error 404|The resource you are looking for has been removed|<title>\s*404/i.test(t);

    // Address: an API URL tells us the API, environment, and path.
    var u = /https?:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)*)(?::\d+)?\/(OpsAPI|EstAPI|MRAPI)_([^\/\s?#"'<>\\]+)([^\s?#"'<>\\]*)/i.exec(t);
    var raw = null, urlApi = null;
    if (u) {
      urlApi = { opsapi: 'ops', estapi: 'est', mrapi: 'mr' }[u[2].toLowerCase()];
      c.site = { host: u[1], env: u[3] };
      raw = u[4];
    } else {
      // The Ops website's address used as if it were the API
      var np = /https?:\/\/([a-z0-9-]+\.b2w\.trimble\.com)\/([^\/\s?#"'<>\\]+)(\/[^\s?#"'<>\\]*)?/i.exec(t);
      if (np && !/^(?:doc|Documentation)$/i.test(np[2])) {
        c.site = { host: np[1], env: np[2] };
        c.noPrefix = { host: np[1], env: np[2], rest: (np[3] || '').replace(/\/$/, '') };
        raw = np[3] || null;
      }
    }
    if (!raw) {
      var rp = /\{\{\s*base_?url\s*\}\}(\/[^\s?#"'<>\\]*)/i.exec(t) || /\b(?:GET|POST|PUT|PATCH|DELETE)\s+(\/[A-Za-z][^\s?#"'<>\\]*)/.exec(t);
      if (rp) raw = rp[1];
    }
    c.path = raw ? decCleanPath(raw) : null;
    if (c.path === '/') c.path = null;

    // Which API
    var sc = { ops: 0, est: 0, mr: 0 };
    DEC_SIGNS.forEach(function (s) { if (s[0].test(t)) s[1].split(' ').forEach(function (k) { sc[k] += s[2]; }); });
    var best = Math.max(sc.ops, sc.est, sc.mr);
    var top = ['ops', 'est', 'mr'].filter(function (k) { return best > 0 && sc[k] === best; });
    if (pick.api) { c.api = pick.api; c.apiFrom = 'your choice'; }
    else if (urlApi) { c.api = urlApi; c.apiFrom = 'from the address'; }
    else if (top.length) {
      c.api = top.indexOf(currentProduct()) > -1 ? currentProduct() : top[0];
      c.apiFrom = top.length > 1 ? 'the message fits ' + top.map(function (k) { return DEC_SHORT[k]; }).join(' and ') : 'from the message';
    } else { c.api = currentProduct(); c.apiFrom = 'assumed from this guide'; }

    var mm = /http method '(GET|POST|PUT|PATCH|DELETE)'/i.exec(t) || /\b(GET|POST|PUT|PATCH|DELETE)\b/.exec(t);
    c.method = mm ? mm[1].toUpperCase() : null;
    c.priv = null;
    var pv = /privilege|permission/i.test(t) && /\b(Api([A-Z][A-Za-z0-9]*)\.([A-Za-z]+))\b/.exec(t);
    if (pv) c.priv = { raw: pv[1], area: pv[2], action: pv[3] };

    // Which call: the login, a data call, or a service check
    var first = c.path ? c.path.split('/')[1].toLowerCase() : '';
    var lwt = first === 'loginwithtid' || /\bLoginWithTID\b/i.test(t);
    if (pick.call) { c.call = pick.call === 'login' && lwt ? 'lwt' : pick.call; c.callFrom = 'your choice'; }
    else if (lwt) c.call = 'lwt';
    else if (first === 'login' || /\/Login(?!\w)/i.test(t) || /Authentication information must be specified|Both userName and password must be specified/i.test(t)) c.call = 'login';
    else if (/^(ping|version|systeminfo)$/.test(first)) c.call = 'ping';
    else if (first === 'doc') c.call = 'doc';
    else if (first || c.priv || /Operation for type|^\s*Authorization\s*:/im.test(t)) c.call = 'data';
    else c.call = null;
    c.loginWith = /\btiduuid\b|\bapiSecret\b/i.test(t) ? 'tid' : /\bclientId\b|\bclientSecret\b/i.test(t) ? 'client' : /\buserName\b|\bpassword\b/i.test(t) ? 'user' : null;
    c.endpoint = c.path && c.call === 'data' ? decEndpoint(c) : null;

    // What the API said, from JSON or XML error bodies
    c.said = [];
    var seen = {}, m2;
    // Case-sensitive on purpose: records have a "Title" field, and only error bodies use "title".
    var sayRx = [/"(CustomMessage|InternalMessage|[Mm]essage|ExceptionMessage|MessageDetail|error_description|[Ee]rror|title|detail)"\s*:\s*"((?:[^"\\]|\\.)*)"/g,
      /<(Message|ExceptionMessage|MessageDetail|CustomMessage|InternalMessage|faultstring)>([^<]{1,600})<\/\1>/gi];
    sayRx.forEach(function (rx) {
      while ((m2 = rx.exec(t)) && c.said.length < 4) {
        var v = m2[2];
        try { v = JSON.parse('"' + v + '"'); } catch (e) { /* keep it as written */ }
        v = v.trim();
        if (v && !seen[v]) { seen[v] = 1; c.said.push([m2[1], v.length > 400 ? v.slice(0, 400) + '…' : v]); }
      }
    });
    c.json = decJson(t);
    c.secret = /\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{5,}/.test(t) ||
      /\b(?:apiSecret|clientSecret|password)\b["']?\s*[:=]\s*["']?(?!\{\{|<|\*{3}|•)[^\s"',]{6,}/i.test(t);
    return c;
  }

  // Cards for causes the troubleshooter doesn't already cover
  var LOGIN401_ANY = { sev: 'warn', title: 'Login rejected the credentials', body: '<p>What a 401 from <code>/Login</code> means depends on how they sign in:</p><ul><li><code>tiduuid</code> + <code>apiSecret</code>: the TID ID or User API Secret is wrong.</li><li><code>clientId</code> + <code>clientSecret</code>: they don’t match Ops system settings.</li><li><code>userName</code> + <code>password</code>: Windows rejected the password.</li></ul><p>Re-copy the values from their source and ask whether anyone generated a new secret or key recently.</p>', link: ['#login-methods', 'Login methods'] };
  var LOGIN404_ANY = { sev: 'warn', title: 'No Ops user matches the credentials', body: '<p>What a 404 from <code>/Login</code> means depends on how they sign in:</p><ul><li>TID UUID: the user isn’t active in Ops, or their <strong>TID / Mobile E-mail Address</strong> is empty on the User View page.</li><li>Username: no Ops user has that Windows account name.</li><li>Client credentials: the built-in System Administrator record is missing. Escalate this one.</li></ul>', link: ['#login-methods', 'Login methods'] };
  var ANTITAMPER = { sev: 'warn', title: 'The AntiTamperToken was changed or left out', body: '<p>A PUT must send back the whole record with its <code>AntiTamperToken</code> exactly as the GET returned it.</p><ol><li>GET the record again.</li><li>Change only the fields you need.</li><li>PUT the whole record back with the new AntiTamperToken untouched.</li></ol>', link: ['#est-write', 'Updating a record'] };
  var DEC_ACTION = { read: 'View', view: 'View', get: 'View', create: 'Create', add: 'Create', insert: 'Create', post: 'Create',
    update: 'Edit', edit: 'Edit', modify: 'Edit', write: 'Edit', put: 'Edit', delete: 'Delete', remove: 'Delete' };
  var DEC_VERB = { View: 'GET', Create: 'POST', Edit: 'PUT', Delete: 'DELETE' };
  function estOrMr(api) { return api === 'ops' ? (currentProduct() === 'mr' ? 'mr' : 'est') : api; }
  function dbKind(api) { return api === 'mr' ? 'Data Warehouse database' : 'Estimate database'; }
  function badUrlCard(api) {
    return { sev: 'warn', title: 'The address is wrong', body: '<p>The server answered, so it is up, but that path doesn’t exist. Usually the environment name is misspelled or the <code>' + DEC_PREFIX[api] + '</code> prefix is missing.</p><p>Rebuild the URL as <code>https://{cluster}/' + DEC_PREFIX[api] + '{environment}</code> and try <code>/Ping/hello</code> again.</p>', link: decLink('url', api) };
  }
  function downCard(api) {
    if (api === 'ops') return TS.r_down;
    return { sev: 'danger', title: 'The site, IIS, or the network is down', body: '<p>No answer at all means the request never got a reply.</p><ul><li>Check the customer’s network: firewall, proxy, and DNS.</li><li>On-premises: check that IIS and ' + DEC_POOL[api] + ' application pool are running.</li><li>Cloud: escalate if <code>/Ping/hello</code> fails from more than one network.</li></ul>', link: decLink('connect', api) };
  }
  function estData401(api) {
    return { sev: 'warn', title: 'The token or the client values were rejected', body: '<p>Data calls return 401 for two reasons:</p><ul><li><strong>The token.</strong> The <code>Authorization</code> header is missing or misspelled, or the token expired. Log in again and send <code>Authorization: Bearer &lt;AccessToken&gt;</code>.</li><li><strong>Client ID Security.</strong> When it is on, every call also needs <code>ClientID</code> and <code>ClientSecret</code> headers that match the customer’s settings.</li></ul><p>Use a token from this API’s own <code>/Login</code>, in the same environment.</p>', link: decLink('headers', api) };
  }
  function estLogin401(api) {
    return { sev: 'warn', title: 'The account was rejected', body: '<p>The domain controller refused the account' + (api === 'est' ? ', or the account has no access to the Estimate data' : '') + '.</p><ul><li>Check the account format: <code>DOMAIN\\user</code>.</li><li>Confirm the password, and that the account isn’t locked or expired.</li></ul>', link: decLink('login', api) };
  }
  function dbNameCard(api) {
    return { sev: 'warn', title: 'The DatabaseName header is missing or wrong', body: '<p>Every data call needs a <code>DatabaseName</code> header naming the customer’s ' + dbKind(api) + '. Without it, or with the wrong name, calls fail, come back empty, or return another company’s data.</p><p>Confirm the exact database name with the customer and resend.</p>', link: decLink('headers', api) };
  }
  function estimateRefCard(api) {
    return { sev: 'warn', title: 'The EstimateREF header is missing or wrong', body: '<p>Estimate-specific calls need an <code>EstimateREF</code> header holding the estimate’s <code>ObjectID</code>. Get it from <code>GET /Estimate</code>' + (api === 'mr' ? ', or use the <code>…All</code> version of the call, which covers every estimate' : '') + '.</p>', link: decLink('headers', api) };
  }
  function emptyCard(api) {
    if (api === 'ops') return { sev: 'info', title: 'The call worked but matched no records', body: '<p>An empty list isn’t an error. Check the <code>$filter</code>: text values need single quotes, and field names must match the catalog exactly.</p>', link: decLink('query', api) };
    return { sev: 'info', title: 'The call worked but returned no items', body: '<p>An empty <code>Items</code> list isn’t an error, but check:</p><ul><li><code>DatabaseName</code> names the right ' + dbKind(api) + '.</li><li><code>EstimateREF</code> is set on estimate-specific calls' + (api === 'mr' ? ', or use the <code>…All</code> call' : '') + '.</li><li>The <code>$filter</code> isn’t too narrow. Text values need single quotes.</li></ul>', link: decLink('headers', api) };
  }
  function privCard(c) {
    var p = c.priv, area = p.area.replace(/([a-z])([A-Z])/g, '$1 $2');
    var col = DEC_ACTION[p.action.toLowerCase()] || ({ GET: 'View', POST: 'Create', PUT: 'Edit', DELETE: 'Delete' })[c.method] || 'View';
    return { sev: 'warn', title: 'The security role is missing ' + codeTag(p.raw), body:
      '<p>The user is known but not allowed. Their Ops security role doesn’t grant <code>' + esc(p.raw) + '</code>, so the API refused the call.</p>' +
      '<ol><li>Open the user’s security role in Ops. From their User View, click the role name.</li>' +
      '<li>In the <strong>API</strong> section, find the <strong>' + esc(area) + '</strong> row.</li>' +
      '<li>Grant <strong>' + col + '</strong>, which ' + DEC_VERB[col] + ' calls need.</li></ol>' +
      '<p>If the role already grants it, check the license. A read-only license can’t make changes.</p>', link: ['#fix-403', 'Fix a 403'] };
  }
  function fmtDate(s) {
    var d = new Date(s.trim().replace(' ', 'T'));
    return isNaN(d) ? s : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  function errorish(c) { return (c.status && c.status >= 400) || /\berror|invalid|required|missing|not (?:valid|found|specified)|mismatch|must\b/i.test(c.body); }

  // Each rule returns null, [score, card], or a list of them. Specific messages score highest,
  // then status codes in context, then status codes alone.
  var DEC_RULES = [
    function (c) { return c.soap ? [95, TS.r_soap] : null; },
    function (c) {
      if (!/ENOTFOUND|EAI_AGAIN|getaddrinfo|remote name could not be resolved|No such host is known|Name or service not known|could not resolve host/i.test(c.text)) return null;
      return [92, { sev: 'warn', title: 'The server name doesn’t resolve', body: '<p>DNS couldn’t find the host in the address, so the request never reached B2W.</p><ul><li>Check the cluster for typos. Cloud clusters look like <code>b2w-eus10.b2w.trimble.com</code>.</li><li>If the name is right, the customer’s network or DNS can’t see it. Try from another network.</li></ul>', link: decLink('url', c.api) }];
    },
    function (c) {
      if (!/\bSSL\b|\bTLS\b|certificate|CERT_|self[- ]signed|trust relationship|secure channel/i.test(c.text)) return null;
      return [88, { sev: 'warn', title: 'The secure connection failed', body: '<p>The HTTPS handshake failed before the API saw the request.</p><ul><li>A proxy or firewall that inspects HTTPS traffic is the usual cause. Have the customer’s IT allow the B2W cluster.</li><li>On-premises servers: check that the site’s certificate is current and trusted.</li><li>Older clients may need TLS 1.2 turned on.</li></ul>', link: decLink('connect', c.api) }];
    },
    function (c) {
      if (!/ECONNREFUSED|ETIMEDOUT|ECONNRESET|ESOCKETTIMEDOUT|Could not get (?:any )?response|Unable to connect to the remote server|No connection could be made|connection (?:was )?(?:refused|closed|reset)|operation (?:has )?timed out|request timed out/i.test(c.text)) return null;
      return [86, downCard(c.api)];
    },
    function (c) {
      var msg = /HTTP Error 503\. The service is unavailable/i.test(c.text);
      if (!msg && c.status !== 503) return null;
      return [msg ? 92 : 70, { sev: 'danger', title: 'The API’s application pool is stopped', body: '<p>IIS answers 503 when the site is up but the application behind it isn’t running, usually because its application pool stopped or keeps crashing.</p><ul><li>On-premises: start ' + DEC_POOL[c.api] + ' application pool in IIS and check the Windows event log for why it stopped.</li><li>Cloud: escalate to the team that hosts the environment.</li></ul>', link: decLink('connect', c.api) }];
    },
    function (c) {
      if (c.status !== 502 && c.status !== 504) return null;
      return [65, c.status === 504
        ? { sev: 'warn', title: 'The call took too long', body: '<p>A proxy or load balancer gave up waiting for the API.</p><ul><li>Large unfiltered GETs are the usual cause. Narrow the call with <code>$filter</code>, <code>$select</code>, and <code>$top</code>.</li><li>If <code>/Ping/hello</code> also times out, treat the API as down.</li></ul>', link: decLink('query', c.api) }
        : { sev: 'warn', title: 'A gateway couldn’t reach the API', body: '<p>A proxy or load balancer in front of the API got no valid answer from it.</p><ul><li>Run <code>/Ping/hello</code>. If it fails too, the API site or its application pool is down.</li><li>If Ping works, retry the call and note the time for escalation.</li></ul>', link: decLink('connect', c.api) }];
    },
    function (c) { return c.html404 ? [90, badUrlCard(c.api)] : null; },
    function (c) {
      if (!c.noPrefix) return null;
      var np = c.noPrefix, rest = np.rest;
      if (c.endpoint && !c.endpoint.known && c.endpoint.suggest) rest = c.endpoint.suggest;
      var fixed = 'https://' + np.host + '/' + DEC_PREFIX[c.api] + np.env + rest;
      return [np.rest || c.status === 404 ? 84 : 50, { sev: 'warn', title: 'That is the Ops website’s address, not the API', body:
        '<p>The address is missing the API prefix. <code>https://' + esc(np.host) + '/' + esc(np.env) + '</code> is the Ops site people sign in to; the ' + DEC_API[c.api] + ' lives beside it with <code>' + DEC_PREFIX[c.api] + '</code> in front of the environment name.</p><p>Use this instead:</p>' +
        '<div class="copyline"><code>' + esc(fixed) + '</code><button class="mini-btn" type="button" data-copy="' + esc(fixed) + '" aria-label="Copy the corrected address">' + icon('i-copy') + 'Copy</button></div>', link: decLink('url', c.api) }];
    },
    function (c) {
      var msg = /No HTTP resource was found that matches the request URI|No type was found that matches the controller/i.test(c.text);
      var ep = c.endpoint;
      if (ep && !ep.known) {
        return [msg || c.status === 404 ? 88 : 62, { sev: 'warn', title: codeTag(c.path) + ' isn’t an ' + DEC_SHORT[c.api] + ' API endpoint', body:
          '<p>The ' + DEC_API[c.api] + ' has no endpoint at that path.' + (ep.suggest ? ' Did you mean <code>' + esc(ep.suggest) + '</code>?' : '') + '</p>' +
          (ep.otherApi ? '<p>That path belongs to the ' + DEC_API[ep.otherApi] + '. Check that the base URL uses <code>' + DEC_PREFIX[ep.otherApi] + '</code>.</p>' : '') +
          '<p>Endpoint names must match the catalog exactly. Search for it in the endpoint explorer.</p>', link: decLink('endpoints', c.api) }];
      }
      if (ep && ep.badMethod) {
        var why = c.api === 'mr' ? ' The MR API is read-only, so every endpoint is GET.' : c.api === 'est' && c.method === 'DELETE' ? ' The Estimate API has no DELETE.' : '';
        return [c.status === 404 || c.status === 405 || msg ? 87 : 60, { sev: 'warn', title: codeTag(ep.name) + ' doesn’t accept ' + c.method, body:
          '<p>The endpoint exists, but it only takes ' + ep.methods.join(', ') + '.' + why + '</p>', link: decLink('endpoints', c.api) }];
      }
      if (msg) return [80, { sev: 'warn', title: 'The base URL is right, but the endpoint isn’t', body: '<p>The API answered, so the cluster and environment are fine. The path after the base URL doesn’t match an endpoint, or the endpoint doesn’t take this method.</p><p>Compare the path and method with the endpoint explorer. Names must match exactly.</p>', link: decLink('endpoints', c.api) }];
      return null;
    },
    function (c) {
      var msg = /does not support http method/i.test(c.text);
      if ((c.status !== 405 && !msg) || (c.endpoint && c.endpoint.badMethod)) return null;
      var why = { ops: '<li><code>/Login</code> and <code>/LoginWithTID</code> only accept GET.</li><li>Some areas don’t take every method. The endpoint explorer shows which ones each area takes.</li>',
        est: '<li>The Estimate API has no DELETE, and some areas are GET only, or GET and PUT.</li><li><code>/Login</code> only accepts GET.</li>',
        mr: '<li>The Management Reporting API is read-only. Every endpoint is GET.</li>' };
      return [msg ? 82 : 68, { sev: 'warn', title: 'That endpoint doesn’t accept ' + (c.method || 'this method'), body: '<p>The address exists, but not for this HTTP method.</p><ul>' + why[c.api] + '</ul>', link: decLink('endpoints', c.api) }];
    },
    function (c) {
      var msg = /media type '?[^'\n]*'? is not supported/i.test(c.text);
      if (!msg && c.status !== 415) return null;
      return [msg ? 86 : 70, { sev: 'warn', title: 'The body isn’t marked as JSON', body: '<p>POST and PUT need <code>Content-Type: application/json</code>, and the body must be raw JSON. In Postman, pick <strong>Body → raw → JSON</strong>.</p>', link: decLink('write', c.api) }];
    },
    // Sign-in
    function (c) { return /Authentication information must be specified/i.test(c.text) ? [100, TS.r_login400] : null; },
    function (c) {
      var msg = /Both userName and password must be specified/i.test(c.text);
      if (!msg && !(c.status === 400 && c.call === 'login' && c.api !== 'ops')) return null;
      var api = estOrMr(c.api);
      return [msg ? 100 : 70, { sev: 'warn', title: 'The login is missing its userName or password header', body: '<p><code>/Login</code> reads the account from two headers and needs both: <code>userName</code> and <code>password</code>.</p><ul><li>Send them as headers, not in the URL or body.</li><li>Use the Active Directory account in the format <code>DOMAIN\\user</code>.</li></ul>', link: decLink('login', api) }];
    },
    function (c) {
      if (!/IDX10223|lifetime validation failed|token (?:is |has )?expired|expired token/i.test(c.text)) return null;
      return [96, { sev: 'warn', title: 'The token has expired', body: '<p>The API recognized the token, but it is past its expiry time.' + (c.api === 'ops' ? ' Ops API tokens last 1 day, and a newer login retires the old one.' : '') + '</p><p>Log in again and use the new AccessToken. Integrations should log in again when they get a 401 rather than reuse a saved token.</p>', link: decLink('token', c.api) }];
    },
    function (c) {
      if (!/IDX10503|IDX10501|IDX10511|signature validation failed|invalid signature|invalid_token/i.test(c.text)) return null;
      return [92, { sev: 'warn', title: 'The token wasn’t accepted by this API', body: '<p>The API couldn’t validate the token. It is usually a token from a different API or environment, or one that got cut off when it was copied.</p><ul><li>Log in to the same API and environment you are calling, and use that AccessToken.</li><li>Copy the whole token. It is one long line with two dots in it.</li></ul>', link: decLink('token', c.api) }];
    },
    function (c) {
      if (!/Authorization has been denied for this request/i.test(c.text)) return null;
      return [94, c.api === 'ops' ? TS.r_data401 : estData401(c.api)];
    },
    function (c) {
      var h = c.headers && c.headers.authorization;
      if (h == null || /^Bearer\s+\S/i.test(h)) return null;
      return [80, { sev: 'warn', title: 'The Authorization header is malformed', body: '<p>It reads <code>Authorization: ' + esc(h.length > 24 ? h.slice(0, 12) + '…' : h || '(empty)') + '</code>. It should be the word <code>Bearer</code>, a space, then the AccessToken from the login:</p><p><code>Authorization: Bearer eyJhbGciOi…</code></p>', link: decLink('token', c.api) }];
    },
    function (c) {
      if (!c.headers || c.call !== 'data') return null;
      var out = [];
      if (c.headers.authorization == null) out.push([66, { sev: 'warn', title: 'The call has no Authorization header', body: '<p>Every data call needs the token from the login: <code>Authorization: Bearer &lt;AccessToken&gt;</code>. Without it the API answers 401.</p>', link: decLink('token', c.api) }]);
      if (c.api !== 'ops' && c.headers.databasename == null) out.push([66, dbNameCard(c.api)]);
      if (c.api !== 'ops' && c.endpoint && c.endpoint.ref && c.headers.estimateref == null) out.push([70, estimateRefCard(c.api)]);
      if ((c.method === 'POST' || c.method === 'PUT') && c.headers['content-type'] == null) out.push([50, { sev: 'info', title: 'There is no Content-Type header', body: '<p>POST and PUT need <code>Content-Type: application/json</code>, or the API can’t read the body.</p>', link: decLink('write', c.api) }]);
      return out.length ? out : null;
    },
    function (c) {
      if (c.api !== 'ops' || c.status !== 400) return null;
      if (c.call === 'login' || c.call === 'lwt') return [70, TS.r_login400];
      if (c.call === 'data') return [70, TS.r_data400];
      return [[45, TS.r_data400], [42, TS.r_login400]];
    },
    function (c) {
      if (c.api === 'ops' || c.status !== 400 || c.call === 'login') return null;
      return [c.call === 'data' ? 62 : 45, { sev: 'warn', title: 'The request is malformed', body: '<p>Check the query and the headers against Swagger.</p><ul><li>OData text values need single quotes, for example <code>$filter=Title eq \'Fox Hill\'</code>.</li><li>Field names must match the catalog exactly.</li><li><code>DatabaseName</code>' + (c.endpoint && c.endpoint.ref ? ' and <code>EstimateREF</code>' : '') + ' must be present and valid.</li></ul>', link: decLink('query', c.api) }];
    },
    function (c) {
      if (c.api !== 'ops' || c.status !== 401) return null;
      var lcard = c.call === 'lwt' ? TS.r_login401_lwt : (TS['r_login401_' + c.loginWith] || LOGIN401_ANY);
      if (c.call === 'login' || c.call === 'lwt') return [72, lcard];
      if (c.call === 'data') return [72, TS.r_data401];
      return [[50, TS.r_data401], [46, lcard]];
    },
    function (c) {
      var msg = /not authorized for this API/i.test(c.text);
      if (!msg && !(c.status === 401 && c.api !== 'ops')) return null;
      var api = estOrMr(c.api);
      if (c.call === 'login') return [msg ? 100 : 72, estLogin401(api)];
      if (c.call === 'data') return [msg ? 100 : 72, estData401(api)];
      return [[msg ? 100 : 50, estData401(api)], [msg ? 40 : 46, estLogin401(api)]];
    },
    // Permissions and allowed changes
    function (c) {
      var msg = /insufficient privileges|required privilege|permission was not granted/i.test(c.text);
      if (!msg && !(c.status === 403 && c.api === 'ops')) return null;
      return [msg ? 100 : 70, c.priv ? privCard(c) : TS.r_403];
    },
    function (c) {
      var msg = /Operation is not allowed/i.test(c.text);
      if (!msg && !(c.status === 403 && c.api === 'est')) return null;
      return [msg ? 100 : 70, { sev: 'info', title: 'The Estimate API doesn’t allow this change', body: '<p>Some changes have no API route, such as the cost structure, container components, or organizations in an estimate. The API refuses them with 403.</p><p>Make that change in Estimate itself.</p>', link: ['#est-write', 'What the API can’t change'] }];
    },
    function (c) {
      if (c.api !== 'ops' || c.status !== 404 || c.html404 || c.noPrefix || (c.endpoint && !c.endpoint.known)) return null;
      if (c.call === 'lwt') return [80, TS.r_login404_lwt];
      var lcard = TS['r_login404_' + c.loginWith] || LOGIN404_ANY;
      if (c.call === 'login') return [72, lcard];
      if (c.call === 'data') return [62, TS.r_data404];
      return [[42, TS.r_data404], [40, lcard]];
    },
    function (c) {
      if (c.api === 'ops' || c.status !== 404 || c.html404 || c.noPrefix || (c.endpoint && !c.endpoint.known)) return null;
      return [c.call === 'data' ? 60 : 42, { sev: 'info', title: 'The record or endpoint wasn’t found', body: '<p>Check the path against the endpoint explorer and the <code>ObjectID</code> you are targeting. An HTML 404 page instead of JSON means the base URL itself is wrong.</p>', link: decLink('endpoints', c.api) }];
    },
    function (c) {
      var msg = /WindowsAccountName/i.test(c.text);
      return msg || (c.status === 406 && c.api === 'ops') ? [msg ? 92 : 70, TS.r_login406] : null;
    },
    // Writes
    function (c) { return /AntiTamperToken/i.test(c.body) && errorish(c) ? [90, ANTITAMPER] : null; },
    function (c) {
      if (c.status !== 409) return null;
      return [70, c.api === 'ops' ? TS.r_409 : { sev: 'info', title: 'The update conflicts with the current record', body: '<p>The record most likely changed after it was read. GET it again, reapply the change, and PUT the whole record back with its current <code>AntiTamperToken</code>.</p>', link: decLink('write', c.api) }];
    },
    function (c) {
      if (c.status !== 422) return null;
      if (c.api === 'ops') return [70, TS.r_422];
      return [70, { sev: 'warn', title: 'The body isn’t a valid record', body: c.api === 'est'
        ? '<p>A required field is missing, a field name is wrong, the JSON is malformed, or a PUT left out fields or changed the AntiTamperToken.</p><p>GET the record again and PUT the whole record back with its AntiTamperToken unchanged. For a POST, compare the body with <code>/schema</code>.</p>'
        : '<p>The MR API is read-only, so it doesn’t take a body. Use GET.</p>', link: decLink('write', c.api) }];
    },
    // Database
    function (c) {
      var m = /Login failed for user '([^']+)'/i.exec(c.text);
      if (!m) return null;
      if (c.api === 'ops') return [95, { sev: 'danger', title: 'SQL Server refused the API’s database login', body: '<p>The API couldn’t sign in to its database as <code>' + esc(m[1]) + '</code>. This is a server setup problem, not the caller’s credentials.</p><p>Capture the full response and escalate.</p>', link: decLink('trouble', 'ops') }];
      var ns = /NETWORK SERVICE/i.test(m[1]);
      return [100, { sev: 'danger', title: ns ? 'The API’s service account can’t open the ' + dbKind(c.api) : 'SQL Server refused the API’s database login', body:
        '<p>The API signs in to SQL Server as <code>' + esc(m[1]) + '</code>' + (ns ? ', which needs db_owner access to the ' + dbKind(c.api) : '') + '. SQL Server refused that login, so the call failed before it reached any data. This isn’t the caller’s fault.</p>' +
        '<ul><li>On-premises: grant the access' + (c.api === 'est' ? ' with the ConfigureDB commands' : '') + ' (the API docs’ Post-Installation Step)' + (c.api === 'mr' ? ', and check the API’s SQL Server connection string' : '') + '.</li><li>Cloud: escalate to the team that hosts the environment.</li></ul>', link: decLink('trouble', c.api) }];
    },
    function (c) {
      var m = /Cannot open database "?([^"\n]+?)"? requested by the login/i.exec(c.text);
      if (!m) return null;
      if (c.api === 'ops') return [97, { sev: 'danger', title: 'SQL Server can’t open the database ' + codeTag(m[1]), body: '<p>The API couldn’t open its database. This is a server setup problem, not the caller’s request. Capture the full response and escalate.</p>', link: decLink('trouble', 'ops') }];
      return [97, { sev: 'warn', title: 'SQL Server can’t open the database ' + codeTag(m[1]), body: '<p>On the ' + DEC_API[c.api] + ', the database comes from the <code>DatabaseName</code> header. If <code>' + esc(m[1]) + '</code> is what they sent:</p><ul><li>Check the spelling against the customer’s ' + dbKind(c.api) + ' and resend.</li><li>If the name is right, the API’s service account can’t access that database. On-premises: grant it. Cloud: escalate.</li></ul>', link: decLink('headers', c.api) }];
    },
    function (c) {
      if (c.api === 'ops' || !/\bDatabaseName\b/i.test(c.body) || !errorish(c)) return null;
      return [/DatabaseName[^\n]{0,60}(?:required|missing|invalid|not)/i.test(c.body) ? 88 : 55, dbNameCard(c.api)];
    },
    function (c) {
      if (c.api === 'ops' || !/\bEstimateREF\b/i.test(c.body) || !errorish(c)) return null;
      return [/EstimateREF[^\n]{0,60}(?:required|missing|invalid|not)/i.test(c.body) ? 88 : 55, estimateRefCard(c.api)];
    },
    function (c) {
      if (c.status !== 500 || /Login failed for user|Cannot open database/i.test(c.text)) return null;
      if (c.api === 'ops') return [42, TS.r_500];
      return [42, { sev: 'danger', title: 'An unexpected API error', body: '<p>Look for a SQL Server message in the full response first: “Login failed” or “Cannot open database” point to database access, not a bug.</p><p>Otherwise, capture the request with secrets removed, the full response, and the date, time, and time zone, then escalate.</p>', link: decLink('trouble', c.api) }];
    },
    // Successful responses that still raise questions
    function (c) {
      var m = /"?LastRetrievedFromSourceDatabaseOn"?\s*[:=]\s*"?(\d{4}-\d\d-\d\d[T ][\d:.]+)/i.exec(c.text);
      if (!m) return null;
      return [errorish(c) ? 20 : 48, { sev: 'info', title: 'This record was loaded on ' + esc(fmtDate(m[1])), body: '<p>The MR API reads the Data Warehouse, not Estimate directly. <code>LastRetrievedFromSourceDatabaseOn</code> says when this record was last copied from its source database.</p><p>If the customer sees old numbers, a change made after that time hasn’t reached the Data Warehouse yet. Check the Data Warehouse load for that source database.</p>', link: ['#mr-troubleshoot', 'Old data'] }];
    },
    function (c) {
      var j = c.json;
      if (!j || (c.status && c.status >= 300)) return null;
      if (Array.isArray(j)) {
        if (j.length === 100) return [58, TS.r_100];
        return j.length === 0 ? [44, emptyCard(c.api)] : null;
      }
      if (!Array.isArray(j.Items)) return null;
      var n = j.Items.length, total = +((j.Pagination || {}).TotalItems);
      var api = estOrMr(c.api);
      if (n === 0) return [50, emptyCard(api)];
      if (total > n) return [52, { sev: 'ok', title: 'There are more pages: ' + n + ' of ' + total + ' records', body: '<p>This response holds ' + n + ' records, and <code>Pagination.TotalItems</code> says ' + total + ' match. Add <code>$skip</code> in steps of your <code>$top</code> (100 at most) to get the rest.</p>', link: decLink('query', api) }];
      if (n === 100) return [56, { sev: 'ok', title: 'That is the page size, not missing data', body: '<p>Each GET returns at most 100 items. Page with <code>$top=100&amp;$skip=100</code>, then <code>$skip=200</code>, until a page comes back with fewer than 100.</p>', link: decLink('query', api) }];
      return null;
    },
    function (c) {
      if (!/"?AccessToken"?\s*:/i.test(c.text) || (c.status && c.status >= 300)) return null;
      return [40, { sev: 'ok', title: 'The login worked', body: '<p>The response holds an AccessToken, so the credentials are fine. Send it on every data call as <code>Authorization: Bearer &lt;AccessToken&gt;</code>.</p><p>If a data call still fails, decode that call’s response instead.</p>', link: decLink('token', c.api) }];
    },
    function (c) {
      if (!c.status || c.status >= 300) return null;
      var what = { 200: 'The call worked.', 201: 'The record was created.', 204: 'The call worked and had nothing to return, as a DELETE does.' }[c.status];
      return [25, { sev: 'ok', title: c.status + ' ' + DEC_CODES[c.status] + ' is a success', body: '<p>' + what + ' If the customer still says something is wrong, look at the data rather than the connection: the filter, the paging, and the headers that pick the data.</p>', link: decLink('query', c.api) }];
    },
    // Anything else with a status code
    function (c) {
      if (!c.status || c.status < 400) return null;
      return [20, { sev: c.status >= 500 ? 'danger' : 'info', title: c.status + ' ' + DEC_CODES[c.status] + ' from the ' + DEC_API[c.api], body: '<p>The decoder has no specific cause for this one. Capture the request with secrets removed, the full response body, and the date, time, and time zone. Then work the ticket from the troubleshooting steps.</p>', link: decLink('trouble', c.api) }];
    }
  ];

  function decRun(c) {
    var found = [];
    DEC_RULES.forEach(function (rule) {
      var r = rule(c);
      if (!r) return;
      (Array.isArray(r[0]) ? r : [r]).forEach(function (x) { found.push({ score: x[0], card: x[1] }); });
    });
    found.sort(function (a, b) { return b.score - a.score; });
    var seen = {};
    return found.filter(function (f) { if (seen[f.card.title]) return false; seen[f.card.title] = 1; return true; });
  }

  var DEC_CALL = { login: 'Login', lwt: 'LoginWithTID', ping: 'Service check', doc: 'API docs', data: 'Data call' };
  function decCard(card, label) {
    var p = productForHash(card.link[0].slice(1));
    var where = p && p !== currentProduct() ? ' in the ' + DEC_API[p] + ' guide' : '';
    return '<div class="ts-result sev-' + card.sev + '"><span class="lbl">' + label + '</span><h5>' + card.title + '</h5>' + card.body +
      '<p><a href="' + card.link[0] + '">Read more' + where + ': ' + esc(card.link[1]) + ' →</a></p></div>';
  }
  function decFacts(c) {
    var f = [['API', esc(DEC_API[c.api]) + ' <small>' + esc(c.apiFrom) + '</small>']];
    if (c.status) f.push(['Status', '<span class="sc ' + (c.status < 300 ? 'sc-2' : c.status < 500 ? 'sc-4' : 'sc-5') + '">' + c.status + ' ' + esc(DEC_CODES[c.status]) + '</span>']);
    if (c.call || c.path) {
      f.push(['Call', esc(DEC_CALL[c.call] || 'Request') + (c.path ? ' <code>' + esc((c.method ? c.method + ' ' : '') + c.path) + '</code>' : c.method ? ' <code>' + c.method + '</code>' : '')]);
    } else if (c.status === 400 || c.status === 401 || c.status === 404) {
      f.push(['Call', 'Not detected <small>set it above for a sharper answer</small>']);
    }
    if (c.endpoint) {
      f.push(['Endpoint', c.endpoint.known
        ? '<span class="dec-ok">' + icon('i-check') + 'In the ' + DEC_SHORT[c.api] + ' catalog</span>'
        : '<span class="dec-bad">' + icon('i-alert') + 'Not in the ' + DEC_SHORT[c.api] + ' catalog</span>']);
    }
    if (c.priv) f.push(['Privilege', '<code>' + esc(c.priv.raw) + '</code>']);
    if (c.site) {
      var site = 'https://' + c.site.host + '/' + c.site.env;
      f.push(['Environment', '<code>' + esc(c.site.env) + '</code> <small>' + esc(c.site.host) + '</small> <button class="mini-btn" type="button" data-dec-check="' + esc(site) + '">' + icon('i-signal') + 'Check it</button>']);
    }
    return '<dl class="dec-facts">' + f.map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + x[1] + '</dd></div>'; }).join('') + '</dl>';
  }
  function htmlText(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    $$('ol, ul', tmp).forEach(function (list) {
      $$('li', list).forEach(function (li, i) { li.insertAdjacentText('afterbegin', list.tagName === 'OL' ? (i + 1) + '. ' : '- '); });
    });
    $$('p, li', tmp).forEach(function (el) { el.insertAdjacentText('beforeend', '\n'); });
    $$('.copyline button', tmp).forEach(function (b) { b.remove(); });
    return tmp.textContent.replace(/\n{2,}/g, '\n').trim();
  }
  function decSummary(c, card) {
    var lines = ['API: ' + DEC_API[c.api] + (c.site ? ' (' + c.site.env + ' on ' + c.site.host + ')' : '')];
    if (c.status) lines.push('Status: ' + c.status + ' ' + DEC_CODES[c.status]);
    if (c.call || c.path) lines.push('Call: ' + (DEC_CALL[c.call] || 'Request') + (c.path ? ' ' + (c.method ? c.method + ' ' : '') + c.path : ''));
    lines.push('', 'Likely cause: ' + htmlText(card.title), htmlText(card.body));
    if (/^https?:/.test(location.protocol)) lines.push('', 'Guide: ' + location.href.split('#')[0] + card.link[0]);
    return lines.join('\n');
  }

  var DEC_SAMPLES = [
    ['Ops 403', 'GET https://b2w-eus10.b2w.trimble.com/OpsAPI_B2WTechSupport/Employee\n403 Forbidden\n{\n    "CustomMessage": "Error occurred: Unable to perform request due to insufficient privileges.",\n    "InternalMessage": "Operation for type Employee required privilege \'ApiEmployee.Read\'; permission was not granted."\n}'],
    ['Ops login 400', 'GET https://b2w-eus10.b2w.trimble.com/OpsAPI_B2WTechSupport/Login\n400 Bad Request\nAuthentication information must be specified in the request header'],
    ['LoginWithTID 404', 'GET https://b2w-eus10.b2w.trimble.com/OpsAPI_B2WTechSupport/LoginWithTID\n404 Not Found'],
    ['PowerShell 401', 'Invoke-RestMethod : The remote server returned an error: (401) Unauthorized.\nAt line:1 char:1\n+ Invoke-RestMethod -Uri "https://b2w-eus10.b2w.trimble.com/OpsAPI_B2WTechSupport/Job" -Headers $headers'],
    ['Estimate 401', 'GET https://b2w-eus10.b2w.trimble.com/EstAPI_B2WTechSupport/Estimate\n401 Unauthorized\nThe user is not authorized for this API.'],
    ['MR SQL login', 'GET https://b2w-eus10.b2w.trimble.com/MRAPI_B2WTechSupport/Estimate/PayItem\n500 Internal Server Error\nLogin failed for user \'NT AUTHORITY\\NETWORK SERVICE\'.'],
    ['Wrong address', 'GET https://b2w-eus10.b2w.trimble.com/B2WTechSupport/Employee\n404 Not Found']
  ];
  function mountDecoder(el, n) {
    var id = 'dec-input-' + n;
    el.innerHTML =
      '<div class="tool decoder">' +
        '<div class="tool-head"><span class="tool-tag">Tool</span><h4>Error decoder</h4><span class="meta">Runs in your browser. Nothing you paste is sent or saved.</span></div>' +
        '<div class="tool-body">' +
          '<form class="dec-form" novalidate>' +
            '<label class="dec-label" for="' + id + '">Paste the error</label>' +
            '<textarea id="' + id + '" rows="6" spellcheck="false" autocomplete="off" placeholder="403 Forbidden&#10;{ &quot;InternalMessage&quot;: &quot;Operation for type Employee required privilege \'ApiEmployee.Read\'; permission was not granted.&quot; }"></textarea>' +
            '<p class="chk-hint">A status line, a response body, a Postman or PowerShell error, or the request URL. Paste the URL with the response for the sharpest answer.</p>' +
            '<div class="dec-bar">' +
              '<div class="dec-opts">' +
                '<label>API <select data-pick="api"><option value="">Auto-detect</option><option value="ops">Ops API</option><option value="est">Estimate API</option><option value="mr">Management Reporting API</option></select></label>' +
                '<label>Call <select data-pick="call"><option value="">Auto-detect</option><option value="login">Login</option><option value="data">Data call</option></select></label>' +
              '</div>' +
              '<div class="dec-btns"><button class="btn btn-sm" type="button" data-dec="clear">Clear</button><button class="btn btn-primary btn-sm" type="submit">' + icon('i-decode') + 'Decode</button></div>' +
            '</div>' +
            '<div class="dec-samples"><span>Try an example:</span>' + DEC_SAMPLES.map(function (s, i) { return '<button type="button" data-sample="' + i + '">' + esc(s[0]) + '</button>'; }).join('') + '</div>' +
          '</form>' +
          '<p class="visually-hidden" aria-live="polite"></p>' +
          '<div class="dec-out"></div>' +
        '</div>' +
      '</div>';
    var input = $('textarea', el), out = $('.dec-out', el), live = $('[aria-live]', el);
    var pickApi = $('[data-pick="api"]', el), pickCall = $('[data-pick="call"]', el);
    var last = null, timer = null;
    function decode() {
      clearTimeout(timer);
      var text = input.value;
      if (!text.trim()) { out.innerHTML = ''; live.textContent = ''; last = null; return; }
      var c = decAnalyze(text, { api: pickApi.value, call: pickCall.value });
      var hasJwt = /eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/.test(text);
      var found = decRun(c), top = found[0];
      var html = decFacts(c);
      if (c.said.length) {
        html += '<div class="dec-said"><span class="lbl">What the API said</span>' + c.said.map(function (s) { return '<p><b>' + esc(s[0]) + '</b> ' + esc(s[1]) + '</p>'; }).join('') + '</div>';
      }
      if (top) {
        html += decCard(top.card, sevLabel[top.card.sev]);
        var also = found.slice(1).filter(function (f) { return f.score >= 35; }).slice(0, 3);
        if (also.length) {
          html += '<div class="dec-also"><p class="dec-also-title">Also check</p>' + also.map(function (f) {
            return '<details class="dec-alt sev-' + f.card.sev + '"><summary>' + f.card.title + '</summary>' + decCard(f.card, sevLabel[f.card.sev]) + '</details>';
          }).join('') + '</div>';
        }
        html += '<div class="dec-actions"><button class="mini-btn" type="button" data-dec="summary">' + icon('i-copy') + 'Copy a summary for the ticket</button>' +
          (c.status === 401 && !hasJwt ? '<button class="mini-btn" type="button" data-open-modal="token">' + icon('i-key') + 'Inspect a token</button>' : '') + '</div>';
        live.textContent = 'Likely cause: ' + htmlText(top.card.title);
      } else {
        html += '<div class="ts-result sev-info"><span class="lbl">No match yet</span><h5>Nothing here the decoder recognizes</h5>' +
          '<p>Paste the status line and the full response body. Messages such as “insufficient privileges” or “not authorized for this API” are what it reads, and the request URL tells it the API and endpoint.</p>' +
          '<p><a href="' + (c.api === 'ops' ? '#troubleshooter' : decLink('trouble', c.api)[0]) + '">' + (c.api === 'ops' ? 'Walk through the troubleshooter instead →' : 'Read the troubleshooting steps →') + '</a></p></div>';
        live.textContent = 'No match yet';
      }
      if (c.secret) {
        html += '<div class="callout warn dec-secret">' + icon('i-shield') + '<div><span class="callout-title">This text includes a live token or secret</span><p>It stays in your browser, but remove it before you paste this into a ticket, chat, or email.</p>' +
          (hasJwt ? '<p><button class="mini-btn" type="button" data-dec="inspect">' + icon('i-key') + 'Inspect the token</button></p>' : '') + '</div></div>';
      }
      out.innerHTML = html;
      last = { c: c, top: top };
    }
    $('form', el).addEventListener('submit', function (e) { e.preventDefault(); decode(); });
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(decode, 250); });
    input.addEventListener('paste', function () { setTimeout(decode, 0); });
    pickApi.addEventListener('change', decode);
    pickCall.addEventListener('change', decode);
    el.addEventListener('click', function (e) {
      var s = e.target.closest('[data-sample]'), act = e.target.closest('[data-dec]'), chkBtn = e.target.closest('[data-dec-check]');
      if (s) {
        input.value = DEC_SAMPLES[+s.getAttribute('data-sample')][1];
        pickApi.value = ''; pickCall.value = '';
        decode();
      } else if (act && act.getAttribute('data-dec') === 'clear') {
        input.value = ''; pickApi.value = ''; pickCall.value = '';
        decode();
        input.focus();
      } else if (act && act.getAttribute('data-dec') === 'inspect') {
        inspectToken(input.value, act);
      } else if (act && act.getAttribute('data-dec') === 'summary' && last && last.top) {
        copyText(decSummary(last.c, last.top.card), act);
      } else if (chkBtn) {
        setEnvInput(chkBtn.getAttribute('data-dec-check'));
        openModal('checker', chkBtn);
      }
    });
  }
  $$('[data-decoder]').forEach(mountDecoder);

  /* ----------------------------------------------------- request builder */
  // Builds one request four ways (Postman, PowerShell, cURL, raw HTTP) for any environment, API,
  // sign-in method, and endpoint. Credentials always stay placeholders, so no secret is typed into
  // the page or copied into a ticket by accident.
  var RB_LOGIN = {
    tid: { label: 'TID UUID + User API Secret', h: [['tiduuid', '<your TID ID>', '{{tidUuid}}'], ['apiSecret', '<your User API Secret>', '{{apiSecret}}']] },
    client: { label: 'Client ID + client secret', h: [['clientId', '<client ID>', '{{clientId}}'], ['clientSecret', '<client secret>', '{{clientSecret}}']] },
    user: { label: 'Username + password (being retired)', h: [['userName', 'DOMAIN\\user', '{{userName}}'], ['password', '<password>', '{{password}}']] },
    lwt: { label: 'LoginWithTID (a Trimble ID token)', path: '/LoginWithTID', h: [['Authorization', 'Bearer <Trimble ID access token>', 'Bearer {{trimbleToken}}']] },
    ad: { h: [['userName', 'DOMAIN\\jsmith', '{{UserName}}'], ['password', '<password>', '{{Password}}']] }
  };
  var RB_PM = { ops: { base: 'baseUrl', token: '{{accessToken}}' }, est: { base: 'BaseURL', token: '{{Token}}' }, mr: { base: 'BaseURL', token: '{{Token}}' } };
  var RB_DEFAULT = { ops: '/Employee', est: '/Estimate', mr: '/Estimate' };
  var RB_HINTS = {
    ops: { filter: 'LastName eq \'Newman\'', select: 'EmployeeID,FirstName,LastName', orderby: 'LastName' },
    est: { filter: 'Number eq \'0006\'', select: 'Number,Name,EstimateStatus', orderby: 'Number desc' },
    mr: { filter: 'contains(Title, \'Fox Hill\')', select: 'Title,EstimateNumber,TotalBidPriceWithTax', orderby: 'Title' }
  };
  var RB_METHODS = { ops: ['GET', 'POST', 'PUT', 'DELETE'], est: ['GET', 'POST', 'PUT'], mr: ['GET'] };
  var RB_QUERY = ['$filter', '$select', '$orderby', '$top', '$skip'];

  // $filter helper: conditions in, correctly quoted OData v4 out. Field lists come from fields.js,
  // generated from each API's OpenAPI document. Syntax follows the APIs' own examples:
  // contains(Name, 'x'), EstimateREF eq <GUID> without quotes, BidDate ge 2024-01-01T00:00:00Z.
  var FH_TYPE = { s: 'text', n: 'number', b: 'true/false', d: 'date', D: 'date', g: 'ID' };
  var FH_OPS = {
    s: [['eq', 'is'], ['ne', 'is not'], ['contains', 'contains'], ['startswith', 'starts with'], ['endswith', 'ends with']],
    n: [['eq', 'equals'], ['ne', 'doesn’t equal'], ['gt', 'is more than'], ['ge', 'is at least'], ['lt', 'is less than'], ['le', 'is at most']],
    b: [['true', 'is true'], ['false', 'is false']],
    d: [['on', 'is on'], ['ge', 'is on or after'], ['after', 'is after'], ['lt', 'is before'], ['le', 'is on or before']],
    g: [['eq', 'is'], ['ne', 'is not']]
  };
  FH_OPS.D = FH_OPS.d;
  var FH_PH = { s: 'Text', n: 'A number, like 42', g: 'An ID, like 02e2bd02-b667-4478-a1c6-76dedfb8958f' };
  // Only the Ops docs show endswith(), so the other APIs don't offer it.
  function fhOps(api, t) { return FH_OPS[t || 's'].filter(function (o) { return !(o[0] === 'endswith' && api !== 'ops'); }); }
  function fhFields(api, path) {
    var all = window.B2W_FIELDS && window.B2W_FIELDS[api];
    if (!all) return null;
    var hit = decFindEndpoint(api, path);
    return all[hit ? hit.name : path] || null;
  }
  function fhDay(ymd, add) {
    var d = new Date(ymd + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + add);
    return d.toISOString().slice(0, 10);
  }
  function fhCond(api, r) {
    var f = (r.field || '').trim(), t = r.type || 's', v = (r.value || '').trim();
    if (!f) return {};
    if (!/^[A-Za-z_][\w./]*$/.test(f)) return { error: '“' + f + '” isn’t a field name: use letters and numbers only' };
    if (t === 'b') return { expr: f + ' eq ' + r.op };
    if (!v) return {};
    if (t === 's') {
      var q = '\'' + v.replace(/'/g, '\'\'') + '\'';   // OData escapes a quote by doubling it
      return { expr: /^(eq|ne)$/.test(r.op) ? f + ' ' + r.op + ' ' + q : r.op + '(' + f + ', ' + q + ')' };
    }
    if (t === 'n') return /^-?\d+(\.\d+)?$/.test(v) ? { expr: f + ' ' + r.op + ' ' + v } : { error: f + ' needs a number, like 42 or 3.5' };
    if (t === 'g') return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? { expr: f + ' ' + r.op + ' ' + v } : { error: f + ' needs a full ID, like 02e2bd02-b667-4478-a1c6-76dedfb8958f' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return { error: f + ' needs a date' };
    // Dates compare by whole day. The Estimate docs use date-only values; Ops and MR use midnight UTC.
    var lit = function (ymd) { return api === 'est' || t === 'D' ? ymd : ymd + 'T00:00:00Z'; };
    var a = lit(v), b = lit(fhDay(v, 1));
    return { expr: { on: f + ' ge ' + a + ' and ' + f + ' lt ' + b, ge: f + ' ge ' + a, after: f + ' ge ' + b, lt: f + ' lt ' + a, le: f + ' lt ' + b }[r.op], group: r.op === 'on' };
  }
  function fhExpr(api, rows, join) {
    var parts = [], problems = [];
    rows.forEach(function (r) { var c = fhCond(api, r); if (c.error) problems.push(c.error); else if (c.expr) parts.push(c); });
    var multi = parts.length > 1;
    return { expr: parts.map(function (c) { return c.group && multi ? '(' + c.expr + ')' : c.expr; }).join(' ' + join + ' '), problems: problems, count: parts.length };
  }

  // Quoting for each shell
  function psStr(v) { return '"' + String(v).replace(/[`"$]/g, '`$&') + '"'; }
  function shArg(v) { v = String(v); return v.indexOf('\'') < 0 ? '\'' + v + '\'' : '"' + v.replace(/[\\"$`]/g, '\\$&') + '"'; }
  function qsEnc(v) {
    if (/^<[^>]+>$/.test(v)) return v;
    return encodeURIComponent(v).replace(/%24/g, '$').replace(/%2C/gi, ',').replace(/%3A/gi, ':').replace(/%2F/gi, '/');
  }
  function psKey(k) { return /^[A-Za-z]\w*$/.test(k) ? k : '\'' + k + '\''; }
  function psHash(pairs, indent) {
    var w = Math.max.apply(null, pairs.map(function (p) { return psKey(p[0]).length; }));
    return pairs.map(function (p) { var k = psKey(p[0]); return indent + k + new Array(w - k.length + 2).join(' ') + '= ' + p[1]; }).join('\n');
  }
  function rbMethods(api, path) {
    if (/\/schema$/i.test(path)) return ['GET'];
    var hit = decFindEndpoint(api, path);
    var allowed = RB_METHODS[api];
    return hit && hit.methods.length ? allowed.filter(function (m) { return hit.methods.indexOf(m) > -1; }) : allowed;
  }

  // Everything the four outputs share
  function rbModel(s) {
    var api = s.api, host = s.host, base = 'https://' + host + '/' + DEC_PREFIX[api] + s.env;
    var path = '/' + s.path.trim().replace(/^\/+/, '').split(/[?#]/)[0];
    var lg = api === 'ops' ? RB_LOGIN[s.login] : RB_LOGIN.ad;
    var isLogin = /^\/login(withtid)?$/i.test(path);
    var open = /^\/(ping|version)(\/|$)/i.test(path);
    var m = { api: api, host: host, base: base, basePath: '/' + DEC_PREFIX[api] + s.env, path: path, method: s.method, open: open };
    var loginHeaders = lg.h.map(function (h) { return { k: h[0], v: h[1], pm: h[2] }; });
    if (api !== 'ops' && s.clientSec) loginHeaders.push({ k: 'ClientID', v: '<client ID>', pm: '{{ClientID}}' }, { k: 'ClientSecret', v: '<client secret>', pm: '{{ClientSecret}}' });
    var loginPath = isLogin ? (api === 'ops' && /withtid/i.test(path) ? '/LoginWithTID' : path) : (lg.path || '/Login');
    m.login = (s.doLogin && !open) || isLogin ? { path: loginPath, headers: isLogin && /withtid/i.test(path) ? [{ k: 'Authorization', v: 'Bearer <Trimble ID access token>', pm: 'Bearer {{trimbleToken}}' }] : loginHeaders } : null;
    if (isLogin) { m.call = null; return m; }
    var c = { method: s.method, path: path, query: [], headers: [] };
    if (s.method === 'GET' && !open) RB_QUERY.forEach(function (k) { var v = (s.q[k] || '').trim(); if (v) c.query.push([k, v]); });
    if (s.method === 'DELETE') c.query.push(['ObjectID', s.objectId.trim() || '<ObjectID>']);
    if (!open) {
      c.headers.push({ k: 'Authorization', v: 'Bearer <AccessToken>', pm: 'Bearer ' + RB_PM[api].token, auth: true });
      if (api !== 'ops') {
        c.headers.push({ k: 'DatabaseName', v: s.db.trim() || '<' + (api === 'mr' ? 'Data Warehouse' : 'Estimate') + ' database name>', pm: '{{DatabaseName}}' });
        if (s.clientSec) c.headers.push({ k: 'ClientID', v: '<client ID>', pm: '{{ClientID}}' }, { k: 'ClientSecret', v: '<client secret>', pm: '{{ClientSecret}}' });
        var hit = decFindEndpoint(api, path);
        if (s.ref.trim() || (hit && hit.ref)) c.headers.push({ k: 'EstimateREF', v: s.ref.trim() || '<estimate ObjectID>', pm: s.ref.trim() || '{{EstimateREF}}' });
      }
    }
    if (s.method === 'POST' || s.method === 'PUT') {
      c.headers.push({ k: 'Content-Type', v: 'application/json', pm: 'application/json', ct: true });
      var raw = s.body.trim(), json = null;
      try { json = raw ? JSON.parse(raw) : null; } catch (e) { json = null; }
      c.body = json !== null ? JSON.stringify(json, null, 2) : raw || (s.method === 'PUT' ? '<the whole record from a GET, with your changes>' : '<the new record as JSON>');
      c.bodyCompact = json !== null ? JSON.stringify(json) : c.body.replace(/\s*\n\s*/g, ' ');
    }
    c.qs = c.query.length ? '?' + c.query.map(function (q) { return q[0] + '=' + qsEnc(q[1]); }).join('&') : '';
    // Postman encodes the URL itself, so its card shows the query the way people type it.
    c.qsPlain = c.query.length ? '?' + c.query.map(function (q) { return q[0] + '=' + q[1]; }).join('&') : '';
    m.call = c;
    return m;
  }

  function rbPowerShell(m) {
    var L = ['$baseUrl = ' + psStr(m.base), ''];
    if (m.login) {
      L.push('# ' + (m.call ? '1. ' : '') + 'Log in. Credentials go in headers, never in the URL or the body.');
      L.push((m.call ? '$login = ' : '$login = ') + 'Invoke-RestMethod -Method Get -Uri "$baseUrl' + m.login.path + '" -Headers @{');
      L.push(psHash(m.login.headers.map(function (h) { return [h.k, psStr(h.v)]; }), '    '));
      L.push('}');
      if (!m.call) { L.push('$login.AccessToken   # this is your bearer token'); return L.join('\n'); }
      L.push('');
    }
    var c = m.call, verb = c.method.charAt(0) + c.method.slice(1).toLowerCase();
    L.push('# ' + (m.login ? '2. ' : '') + 'Call the API');
    var hs = c.headers.filter(function (h) { return !h.ct; }).map(function (h) {
      return [h.k, h.auth && m.login ? '"Bearer $($login.AccessToken)"' : psStr(h.v)];
    });
    if (hs.length) { L.push('$headers = @{', psHash(hs, '    '), '}'); }
    var uri = '"$baseUrl' + c.path.replace(/[`"$]/g, '`$&') + (c.method === 'DELETE' ? c.qs.replace(/[`"$]/g, '`$&') : '') + '"';
    var call = '$result = Invoke-RestMethod -Method ' + verb + ' -Uri ' + uri + (hs.length ? ' -Headers $headers' : '');
    if (c.method === 'GET' && c.query.length) {
      L.push('$query = @{', psHash(c.query.map(function (q) { return [q[0], /^\d+$/.test(q[1]) ? q[1] : psStr(q[1])]; }), '    '), '}');
      L.push('', '# For GET, -Body becomes the query string');
      call += ' -Body $query';
    }
    if (c.body !== undefined) {
      L.push('$body = @\'', c.body, '\'@');
      call += ' -Body $body -ContentType "application/json"';
    }
    L.push(call);
    if (c.method === 'GET') L.push(m.api === 'ops' || m.open ? '$result' : '$result.Items' + (m.api === 'mr' ? '\n$result.Pagination   # CurrentPage, ItemsOnPage, PageSize, TotalItems' : ''));
    else L.push('$result');
    return L.join('\n');
  }

  function rbCurl(m) {
    var L = [];
    var hdr = function (h, viaVar) { return '  -H ' + (viaVar ? '"' + h.k + ': Bearer $TOKEN"' : shArg(h.k + ': ' + h.v)); };
    if (m.login) {
      var lines = m.login.headers.map(function (h) { return hdr(h); });
      if (m.call) {
        L.push('# 1. Log in and keep the token');
        L.push('TOKEN=$(curl -s ' + shArg(m.base + m.login.path) + ' \\');
        L.push(lines.join(' \\\n') + ' \\');
        L.push('  | sed -E \'s/.*"AccessToken" *: *"([^"]+)".*/\\1/\')', '');
      } else {
        L.push('curl -s ' + shArg(m.base + m.login.path) + ' \\', lines.join(' \\\n'));
        return L.join('\n');
      }
    }
    var c = m.call, parts = [];
    if (m.login) L.push('# 2. Call the API');
    var url = m.base + c.path + (c.method === 'DELETE' ? c.qs : '');
    var first = 'curl -s' + (c.method === 'GET' ? (c.query.length ? ' -G' : '') : ' -X ' + c.method) + ' ' + shArg(url);
    if (c.method === 'GET') c.query.forEach(function (q) { parts.push('  --data-urlencode ' + shArg(q[0] + '=' + q[1])); });
    c.headers.forEach(function (h) { parts.push(hdr(h, h.auth && m.login)); });
    if (c.body !== undefined) parts.push('  -d ' + shArg(c.bodyCompact));
    L.push(parts.length ? first + ' \\\n' + parts.join(' \\\n') : first);
    return L.join('\n');
  }

  function rbHttp(m) {
    var L = [];
    if (m.login) {
      L.push('GET ' + m.basePath + m.login.path + ' HTTP/1.1', 'Host: ' + m.host);
      m.login.headers.forEach(function (h) { L.push(h.k + ': ' + h.v); });
      if (!m.call) return L.join('\n');
      L.push('', '# Then, with the AccessToken from the response:', '');
    }
    var c = m.call;
    L.push(c.method + ' ' + m.basePath + c.path + c.qs + ' HTTP/1.1', 'Host: ' + m.host);
    c.headers.forEach(function (h) { L.push(h.k + ': ' + h.v); });
    if (c.body !== undefined) L.push('', c.body);
    return L.join('\n');
  }

  function rbPostman(m) {
    var pm = RB_PM[m.api], row = function (k, v) { return '<p class="k">' + esc(k) + '</p><p>' + v + '</p>'; };
    var pv = function (s) { return esc(s).replace(/\{\{(\w+)\}\}/g, '<span class="var">{{$1}}</span>'); };
    var html = '<div class="req rb-vars"><div class="req-rows"><p class="sec">Collection variables</p>' +
      row(pm.base, '<code>' + esc(m.base) + '</code>');
    if (m.api !== 'ops') {
      var db = m.call && m.call.headers.filter(function (h) { return h.k === 'DatabaseName'; })[0];
      html += row('DatabaseName', db ? esc(db.v) : 'The customer’s database') + row('UserName · Password', 'The Active Directory account and its password');
    } else if (m.login) {
      html += row(m.login.headers.map(function (h) { return h.pm.replace(/^Bearer /, '').replace(/[{}]/g, ''); }).join(' · '), 'Your own values');
    }
    html += '</div></div>';
    var reqCard = function (method, path, qs, headers, body, title, note) {
      var out = '<p class="rb-pm-step">' + title + '</p><div class="req"><div class="req-line"><span class="m m-' + method.toLowerCase() + '">' + method + '</span><code><span class="var">{{' + pm.base + '}}</span>' + esc(path + qs) + '</code></div><div class="req-rows">';
      if (headers.length) out += '<p class="sec">Headers</p>' + headers.map(function (h) { return row(h.k, pv(h.pm)); }).join('');
      if (body !== undefined) out += '<p class="sec">Body · raw · JSON</p><p class="k">JSON</p><p><code>' + esc(body.length > 160 ? body.slice(0, 160) + '…' : body) + '</code></p>';
      if (note) out += '<p class="sec">Note</p><p class="k">Tip</p><p>' + note + '</p>';
      return out + '</div></div>';
    };
    if (m.login && m.api === 'ops') {
      html += reqCard('GET', m.login.path, '', m.login.headers, undefined, m.call ? 'Step 1 · Log in (the Auth folder has this request)' : 'Log in (the Auth folder has this request)',
        'Put the AccessToken from the response in the <code>accessToken</code> variable.');
    } else if (m.login && !m.call) {
      html += reqCard('GET', m.login.path, '', m.login.headers, undefined, 'Log in', 'The official collection’s pre-request script does this before every request.');
    }
    if (m.call) {
      var hs = m.call.headers.filter(function (h) { return !(m.api !== 'ops' && /^(Authorization|ClientID|ClientSecret)$/.test(h.k)); });
      var note = m.api === 'ops' ? 'Authorization comes from the collection: Bearer Token, <span class="var">{{accessToken}}</span>.'
        : 'The collection’s pre-request script logs in and adds the token' + (m.call.headers.some(function (h) { return h.k === 'ClientID'; }) ? ', ClientID, and ClientSecret' : '') + ' for you.';
      if (m.api === 'ops') hs = hs.filter(function (h) { return !h.auth; });
      html += reqCard(m.call.method, m.call.path, m.call.qsPlain, hs, m.call.body, m.login && m.api === 'ops' ? 'Step 2 · The call' : 'The call', m.open ? 'No login needed for this one.' : note);
    }
    return html;
  }

  var builders = [];
  function mountBuilder(el, n) {
    var view = el.closest('[data-view]');
    var s = { api: view ? view.getAttribute('data-view') : currentProduct(), login: 'tid', doLogin: true, clientSec: false,
      method: 'GET', db: '', ref: '', objectId: '', body: '', q: { $top: '5' }, host: chk.cluster, env: chk.env };
    s.path = RB_DEFAULT[s.api];
    var id = function (k) { return 'rb-' + n + '-' + k; };
    var field = function (key, label, attrs, cls) {
      return '<div class="field ' + (cls || '') + '"><label for="' + id(key) + '">' + label + '</label><input id="' + id(key) + '" data-rb="' + key + '" type="text" spellcheck="false" autocomplete="off"' + (attrs || '') + '></div>';
    };
    el.innerHTML =
      '<div class="tool builder">' +
        '<div class="tool-head"><span class="tool-tag">Tool</span><h4>Request builder</h4><span class="meta">Credentials stay placeholders. Nothing is sent.</span></div>' +
        '<div class="tool-body">' +
          '<form class="rb-form" novalidate>' +
            '<fieldset class="rb-step"><legend><span class="rb-n">1</span>Environment and API</legend><div class="fields">' +
              field('env', 'Customer’s Ops address', ' inputmode="url" placeholder="' + DEFAULT_ENV_URL + '"', 'span-2') +
              '<div class="field span-2"><span class="rb-label" id="' + id('apilbl') + '">API</span><div class="rb-seg" role="group" aria-labelledby="' + id('apilbl') + '">' +
                ['ops', 'est', 'mr'].map(function (k) { return '<button type="button" data-api="' + k + '"><span class="sw sw-' + k + '" aria-hidden="true"></span>' + DEC_SHORT[k] + '</button>'; }).join('') +
              '</div></div>' +
              '<p class="rb-base span-2" aria-live="polite"></p>' +
            '</div></fieldset>' +
            '<fieldset class="rb-step"><legend><span class="rb-n">2</span>Sign in</legend><div class="fields">' +
              '<div class="field span-2" data-show="ops"><label for="' + id('login') + '">Login method</label><select id="' + id('login') + '" data-rb="login">' +
                ['tid', 'client', 'user', 'lwt'].map(function (k) { return '<option value="' + k + '">' + RB_LOGIN[k].label + '</option>'; }).join('') + '</select></div>' +
              '<p class="rb-fixed span-2" data-show="est mr">Login takes an Active Directory account, as <code>DOMAIN\\user</code>, in the <code>userName</code> and <code>password</code> headers.</p>' +
              '<label class="rb-check span-2"><input type="checkbox" data-rb="doLogin" checked>Include the login step</label>' +
              '<label class="rb-check span-2" data-show="est mr"><input type="checkbox" data-rb="clientSec">Client ID Security is on</label>' +
            '</div></fieldset>' +
            '<fieldset class="rb-step rb-call"><legend><span class="rb-n">3</span>The call</legend><div class="fields">' +
              '<div class="field"><label for="' + id('path') + '">Endpoint</label><input id="' + id('path') + '" data-rb="path" type="text" list="' + id('list') + '" spellcheck="false" autocomplete="off"><datalist id="' + id('list') + '"></datalist><span class="hint rb-path-hint"></span></div>' +
              '<div class="field"><label for="' + id('method') + '">Method</label><select id="' + id('method') + '" data-rb="method"></select></div>' +
              field('db', 'DatabaseName', '', 'rb-db" data-show="est mr') +
              field('ref', 'EstimateREF <span class="rb-req" hidden>needed for this call</span>', ' placeholder="The estimate’s ObjectID"', 'rb-ref" data-show="est mr') +
              field('q-$filter', '<code>$filter</code>', '', 'span-2" data-method="GET') +
              '<div class="rb-fh span-2" data-method="GET">' +
                '<button type="button" class="rb-fh-toggle" aria-expanded="false" aria-controls="' + id('fh') + '">' + icon('i-plus') + '<span>Build the filter with the helper</span></button>' +
                '<div class="rb-fh-panel" id="' + id('fh') + '" hidden>' +
                  '<div class="rb-fh-rows"></div>' +
                  '<div class="rb-fh-foot"><button class="mini-btn" type="button" data-fh="add">' + icon('i-plus') + 'Add a condition</button>' +
                    '<div class="rb-fh-join" role="radiogroup" aria-label="How to combine the conditions"><span>Match</span>' +
                      '<label><input type="radio" name="' + id('join') + '" value="and" data-fh="join" checked>all of them</label>' +
                      '<label><input type="radio" name="' + id('join') + '" value="or" data-fh="join">any of them</label></div>' +
                  '</div>' +
                  '<p class="hint rb-fh-note"></p>' +
                '</div>' +
              '</div>' +
              field('q-$select', '<code>$select</code>', '', '" data-method="GET') +
              field('q-$orderby', '<code>$orderby</code>', '', '" data-method="GET') +
              field('q-$top', '<code>$top</code>', ' inputmode="numeric" placeholder="100 at most"', '" data-method="GET') +
              field('q-$skip', '<code>$skip</code>', ' inputmode="numeric" placeholder="0"', '" data-method="GET') +
              field('objectId', 'ObjectID of the record', ' placeholder="a4066d42-4027-4d5d-87a0-a30600f8d4cf"', 'span-2" data-method="DELETE') +
              '<div class="field span-2" data-method="POST PUT"><label for="' + id('body') + '">Body (JSON)</label><textarea id="' + id('body') + '" data-rb="body" rows="6" spellcheck="false"></textarea><span class="hint rb-body-hint"></span></div>' +
            '</div></fieldset>' +
          '</form>' +
          '<div class="rb-notes"></div>' +
          '<div class="tabs" data-tabgroup="client">' +
            '<div class="tablist" role="tablist" aria-label="Choose a tool">' +
              [['postman', 'Postman'], ['powershell', 'PowerShell'], ['curl', 'cURL'], ['http', 'Raw HTTP']].map(function (t, i) {
                return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (i === 0) + '">' + t[1] + '</button>';
              }).join('') +
            '</div>' +
            '<div class="tabpanel" role="tabpanel" data-panel="postman"><div class="rb-pm"></div></div>' +
            [['powershell', 'PowerShell', 'powershell'], ['curl', 'cURL · bash, macOS, Git Bash', 'bash'], ['http', 'HTTP request', 'http']].map(function (t) {
              return '<div class="tabpanel" role="tabpanel" data-panel="' + t[0] + '" hidden><div class="code"><div class="code-head"><span>' + t[1] + '</span><button class="copy-btn" type="button">' + icon('i-copy') + 'Copy</button></div><pre data-lang="' + t[2] + '"><code></code></pre></div></div>';
            }).join('') +
          '</div>' +
        '</div>' +
      '</div>';
    var get = function (k) { return $('[data-rb="' + k + '"]', el); };
    var envIn = get('env'), pathIn = get('path'), methodSel = get('method'), bodyIn = get('body');
    envIn.value = chk.input;
    var tabs = $('.tabs', el);
    initTabs(tabs, 'rb' + n);
    var saved = store.get(TAB_KEY);
    if (saved) selectTab('client', saved, false);

    function syncForm() {
      $$('.rb-seg button', el).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-api') === s.api ? 'true' : 'false'); });
      el.setAttribute('data-rb-api', s.api);
      $$('[data-show]', el).forEach(function (x) { x.hidden = x.getAttribute('data-show').split(' ').indexOf(s.api) < 0; });
      // Methods this endpoint takes
      var methods = rbMethods(s.api, '/' + s.path.trim().replace(/^\/+/, '').split(/[?#]/)[0]);
      if (methods.indexOf(s.method) < 0) s.method = methods[0];
      methodSel.innerHTML = methods.map(function (mm) { return '<option' + (mm === s.method ? ' selected' : '') + '>' + mm + '</option>'; }).join('');
      // Login, Ping, and Version take no query, body, or ObjectID.
      var plain = /^\/*(login(withtid)?|ping|version)(\/|$)/i.test(s.path.trim());
      $$('[data-method]', el).forEach(function (x) { x.hidden = plain || x.getAttribute('data-method').split(' ').indexOf(s.method) < 0 || (s.api !== 'ops' && x.getAttribute('data-method') === 'DELETE'); });
      var h = RB_HINTS[s.api];
      get('q-$filter').placeholder = h.filter; get('q-$select').placeholder = h.select; get('q-$orderby').placeholder = h.orderby;
      get('db').placeholder = s.api === 'mr' ? 'The Data Warehouse database' : 'The Estimate database, such as B2WSample';
      bodyIn.placeholder = s.method === 'PUT' ? 'Paste the whole record from a GET, with your changes' : 'Paste the new record. Tip: GET an existing record first and use it as the outline.';
      $('datalist', el).innerHTML = EXPLORERS[s.api].entries.map(function (e) {
        return e.methods.length ? e.name : e.extras.length ? e.extras[0][1].replace(/\{input\}/, 'hello') : '';
      }).filter(Boolean).map(function (p) { return '<option value="' + esc(p) + '">'; }).join('');
      fhSync();
    }

    // ---- $filter helper
    var fh = { rows: [{}], join: 'and', fields: null, key: '', wrote: false };
    var fhPanel = $('.rb-fh-panel', el), fhToggle = $('.rb-fh-toggle', el), fhRows = $('.rb-fh-rows', el);
    function fhRowHtml(r, i) {
      var fields = fh.fields, free = !fields || r.other;
      var ops = fhOps(s.api, r.type);
      if (!ops.some(function (o) { return o[0] === r.op; })) r.op = ops[0][0];
      var html = '<div class="rb-fh-row" data-i="' + i + '">';
      if (fields) {
        html += '<select data-fh="field" aria-label="Field"><option value="">Pick a field</option>' + fields.map(function (f) {
          return '<option value="' + esc(f[0]) + '"' + (!r.other && f[0] === r.field ? ' selected' : '') + '>' + esc(f[0]) + ' · ' + FH_TYPE[f[1]] + '</option>';
        }).join('') + '<option value="__other"' + (r.other ? ' selected' : '') + '>Another field…</option></select>';
      }
      if (free) {
        html += '<input data-fh="name" type="text" aria-label="Field name" placeholder="Field name" spellcheck="false" autocomplete="off" value="' + esc(r.field || '') + '">' +
          '<select data-fh="type" aria-label="Field type">' + ['s', 'n', 'b', 'd', 'g'].map(function (t) { return '<option value="' + t + '"' + (t === (r.type || 's') ? ' selected' : '') + '>' + FH_TYPE[t] + '</option>'; }).join('') + '</select>';
      }
      html += '<select data-fh="op" aria-label="Condition">' + ops.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === r.op ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
      if (r.type !== 'b') {
        var date = r.type === 'd' || r.type === 'D';
        html += '<input data-fh="value" type="' + (date ? 'date' : 'text') + '" aria-label="Value" spellcheck="false" autocomplete="off"' + (r.type === 'n' ? ' inputmode="decimal"' : '') +
          ' placeholder="' + esc(r.ex && !date ? 'e.g. ' + r.ex : FH_PH[r.type || 's'] || '') + '" value="' + esc(r.value || '') + '">';
      }
      return html + '<button class="rb-fh-x" type="button" data-fh="remove" aria-label="Remove this condition">' + icon('i-x') + '</button></div>';
    }
    function fhDraw() { fhRows.innerHTML = fh.rows.map(fhRowHtml).join(''); }
    function fhApply() {
      var res = fhExpr(s.api, fh.rows, fh.join), note = $('.rb-fh-note', el);
      if (res.count || fh.wrote) {
        s.q.$filter = res.expr; get('q-$filter').value = res.expr;
        fh.wrote = true; edited = true;
      }
      var dated = fh.rows.some(function (r) { return (r.type === 'd' || r.type === 'D') && r.value; });
      note.innerHTML = res.problems.length ? '<span class="rb-warn">' + esc(res.problems.join('. ')) + '.</span>'
        : dated ? 'Dates compare by whole day, starting at midnight' + (s.api === 'est' ? '' : ' UTC') + '. Records store local times, so if one near midnight goes missing, widen the range by a day.'
        : res.count ? 'The helper writes the <code>$filter</code> box above, with the quotes and format each field needs.'
        : fh.fields ? 'Pick a field, a condition, and a value. Fields come from this endpoint’s API documentation.'
        : 'This endpoint has no field list, so type the field name and pick its type.';
      render();
    }
    // A new endpoint keeps the conditions whose fields it also has.
    function fhSync() {
      var path = '/' + s.path.trim().replace(/^\/+/, '').split(/[?#]/)[0], key = s.api + path;
      if (key === fh.key) return;
      fh.key = key;
      fh.fields = fhFields(s.api, path);
      fh.rows = fh.rows.filter(function (r) {
        if (!r.field || r.other) return !!r.other;
        var f = fh.fields && fh.fields.filter(function (x) { return x[0] === r.field; })[0];
        if (f) { r.type = f[1]; r.ex = f[2]; }
        return !!f;
      });
      if (!fh.rows.length) fh.rows = [{}];
      fhDraw();
      // If the helper wrote the filter, rewrite it so conditions that just went away leave it too.
      if (fh.wrote) fhApply();
    }
    function fhOpen(open) {
      fhPanel.hidden = !open;
      fhToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      $('span', fhToggle).textContent = open ? 'Hide the filter helper' : 'Build the filter with the helper';
      if (open) { fhDraw(); fhApply(); }
    }
    fhToggle.addEventListener('click', function () { fhOpen(fhPanel.hidden); });
    function fhEvent(e) {
      var k = e.target.getAttribute('data-fh'), row = e.target.closest('.rb-fh-row');
      if (!k) return;
      var r = row ? fh.rows[+row.getAttribute('data-i')] : null, redraw = false;
      if (k === 'join') fh.join = e.target.value;
      else if (k === 'field') {
        var v = e.target.value;
        if (v === '__other') { r.other = true; r.field = ''; r.type = 's'; r.ex = ''; }
        else {
          var f = fh.fields.filter(function (x) { return x[0] === v; })[0];
          r.other = false; r.field = v; r.type = f ? f[1] : 's'; r.ex = f ? f[2] : '';
        }
        r.value = ''; r.op = ''; redraw = true;
      } else if (k === 'name') r.field = e.target.value;
      else if (k === 'type') { r.type = e.target.value; r.value = ''; r.op = ''; redraw = true; }
      else if (k === 'op') r.op = e.target.value;
      else if (k === 'value') r.value = e.target.value;
      if (redraw) {
        fhDraw();
        var next = k === 'field' && r.other ? 'name' : r.type === 'b' ? 'op' : 'value';
        var again = $('.rb-fh-row[data-i="' + row.getAttribute('data-i') + '"] [data-fh="' + next + '"]', el);
        if (again) again.focus();
      }
      fhApply();
    }
    // Typing goes through input; the pickers go through change, so each edit is handled once.
    fhPanel.addEventListener('input', function (e) { if (/^(name|value)$/.test(e.target.getAttribute('data-fh'))) fhEvent(e); });
    fhPanel.addEventListener('change', function (e) { if (/^(field|type|op|join)$/.test(e.target.getAttribute('data-fh'))) fhEvent(e); });
    fhPanel.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-fh]');
      if (!b) return;
      if (b.getAttribute('data-fh') === 'add') {
        fh.rows.push({});
        fhDraw();
        var last = $('.rb-fh-row:last-child', el);
        $('select, input', last).focus();
      } else if (b.getAttribute('data-fh') === 'remove') {
        fh.rows.splice(+b.closest('.rb-fh-row').getAttribute('data-i'), 1);
        if (!fh.rows.length) fh.rows = [{}];
        fhDraw();
      }
      fhApply();
    });
    function render() {
      var r = parseEnv(envIn.value || DEFAULT_ENV_URL);
      if (!r.error) { s.host = r.cluster; s.env = r.env; }
      var m = rbModel(s), notes = [];
      $('.rb-base', el).innerHTML = r.error ? '<span class="rb-warn">' + esc(r.error) + '</span>'
        : 'Base URL <code>' + esc(m.base) + '</code>';
      // Endpoint check against the catalog
      var hit = decFindEndpoint(s.api, m.path), hint = $('.rb-path-hint', el);
      if (!hit && !/^\/login(withtid)?$/i.test(m.path)) {
        var low = m.path.toLowerCase(), best = null, bestD = 99;
        DEC_CATALOG[s.api].forEach(function (e) { var d = editDistance(low, e.key); if (d < bestD) { bestD = d; best = e; } });
        hint.innerHTML = '<span class="rb-warn">Not in the ' + DEC_SHORT[s.api] + ' catalog.' + (best && bestD <= Math.min(3, Math.floor(low.length / 4)) ? ' Did you mean <code>' + esc(best.name) + '</code>?' : '') + '</span>';
      } else hint.textContent = hit && hit.ref ? 'This call needs EstimateREF.' : '';
      $('.rb-req', el).hidden = !(hit && hit.ref);
      var bodyHint = $('.rb-body-hint', el);
      bodyHint.textContent = '';
      if (m.call && m.call.body !== undefined && s.body.trim()) {
        try { JSON.parse(s.body); bodyHint.textContent = 'Valid JSON.'; bodyHint.className = 'hint rb-body-hint ok'; }
        catch (e) { bodyHint.textContent = 'Not valid JSON yet: ' + e.message; bodyHint.className = 'hint rb-body-hint rb-warn'; }
      }
      // Notes
      if (m.call && /^(POST|PUT|DELETE)$/.test(m.call.method)) {
        notes.push(['warn', m.call.method + ' changes real data. Practice in B2WTechSupport. In a customer’s environment, run it only when they asked for the change.']);
        if (m.call.method === 'PUT') notes.push(['info', m.api === 'est' ? 'Send the whole record from a fresh GET, with its <code>AntiTamperToken</code> unchanged (<a href="#est-write">question 8</a>).' : 'Send the whole record from a fresh GET, with its <code>ObjectID</code> and <code>RowVersion</code> unchanged (<a href="#create-update-delete">question 15</a>).']);
      }
      if (m.call && m.call.method === 'GET' && !m.open && !(s.q.$top || '').trim()) notes.push(['info', 'Without <code>$top</code>, a GET returns up to 100 records. Page with <code>$top</code> and <code>$skip</code>.']);
      if (m.api !== 'ops' && m.call && !m.open && !s.db.trim()) notes.push(['info', 'Fill in <b>DatabaseName</b>. The output shows a placeholder until you do.']);
      if (m.api === 'ops' && s.login === 'lwt' && m.login) notes.push(['info', 'LoginWithTID takes a Trimble ID access token from the person’s own Trimble ID sign-in. It returns an Ops token for the linked Ops user.']);
      if (m.api === 'ops' && s.login === 'client' && m.login) notes.push(['info', 'Client credentials run as the built-in System Administrator, so the call isn’t limited by a user’s security role.']);
      $('.rb-notes', el).innerHTML = notes.map(function (x) { return '<p class="rb-note ' + x[0] + '">' + icon(x[0] === 'warn' ? 'i-alert' : 'i-info') + '<span>' + x[1] + '</span></p>'; }).join('');
      // Outputs
      $('.rb-pm', el).innerHTML = rbPostman(m);
      $('[data-panel="powershell"] code', el).innerHTML = highlight(rbPowerShell(m), RULES.powershell);
      $('[data-panel="curl"] code', el).innerHTML = highlight(rbCurl(m), RULES.bash);
      $('[data-panel="http"] code', el).innerHTML = highlight(rbHttp(m), RULES.http);
    }
    var edited = false;   // until someone edits it, the builder follows the guide being read
    function setApi(api) {
      if (api === s.api) return;
      s.api = api; s.path = RB_DEFAULT[api]; pathIn.value = s.path;
      syncForm(); render();
    }
    $('form', el).addEventListener('submit', function (e) { e.preventDefault(); });
    $('form', el).addEventListener('input', function (e) {
      var k = e.target.getAttribute('data-rb');
      if (!k) return;
      edited = true;
      if (k.indexOf('q-') === 0) s.q[k.slice(2)] = e.target.value;
      else if (e.target.type === 'checkbox') s[k] = e.target.checked;
      else if (k !== 'env') s[k] = e.target.value;
      if (k === 'path' || k === 'method') syncForm();
      render();
    });
    $('form', el).addEventListener('change', function (e) {
      var k = e.target.getAttribute('data-rb');
      if (k === 'login' || k === 'method') { s[k] = e.target.value; syncForm(); render(); }
    });
    $('.rb-seg', el).addEventListener('click', function (e) { var b = e.target.closest('[data-api]'); if (b) setApi(b.getAttribute('data-api')); });
    pathIn.value = s.path;
    get('q-$top').value = s.q.$top;
    syncForm();
    render();
    builders.push({
      el: el,
      // Opened from the top bar: switch to the guide being read, unless the reader has edited it.
      follow: function (p) { if (!edited) setApi(p); },
      // Opened from a "filter helper" link: show the helper on a GET.
      openFilter: function () {
        if (s.method !== 'GET' && rbMethods(s.api, s.path).indexOf('GET') > -1) { s.method = 'GET'; syncForm(); render(); }
        fhOpen(true);
        setTimeout(function () { fhToggle.scrollIntoView({ block: 'center' }); }, 0);
      },
      // Opened from an explorer's Build button: that API and endpoint, ready to fill in.
      load: function (path, p) {
        if (p) s.api = p;
        s.path = path; pathIn.value = path;
        s.method = rbMethods(s.api, path)[0];
        edited = true;
        syncForm(); render();
      }
    });
  }
  $$('[data-builder]').forEach(mountBuilder);
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-open-filter]');
    if (!b || !builders.length) return;
    openModal('builder', b);
    builders[0].openFilter();
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-build]');
    if (!b || !builders.length) return;
    var view = b.closest('[data-view]');
    builders[0].load(b.getAttribute('data-build'), view ? view.getAttribute('data-view') : currentProduct());
    openModal('builder', b);
    var input = $('[data-rb="path"]', builders[0].el);
    if (input) { input.focus(); input.select(); }
  });

  /* ----------------------------------------------------- token inspector */
  // Decodes an AccessToken (a JWT) on this page: when it was issued, when it expires, who it is for,
  // and what that means for a 401. Nothing is sent or saved, and the token is cleared when the
  // dialog closes. The signature can't be checked here: that needs the server's key.
  var TOK_LINK = {
    renew: { ops: ['#bearer-token', 'Generate a bearer token'], est: ['#est-login', 'Logging in'], mr: ['#mr-login', 'Logging in'] },
    use: { ops: ['#use-token', 'Using the token'], est: ['#est-headers', 'Headers every call needs'], mr: ['#mr-headers', 'Headers every call needs'] }
  };
  var XMLC = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/', MSC = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/';
  var TOK_CLAIMS = {
    iss: ['Issued by', 'Who created and signed the token'],
    aud: ['Audience', 'The service the token is meant for'],
    sub: ['Subject', 'The user or client the token stands for'],
    exp: ['Expires', 'The token stops working at this time'],
    iat: ['Issued', 'When the token was created'],
    nbf: ['Not before', 'The token isn’t valid before this time'],
    auth_time: ['Signed in', 'When the person signed in'],
    jti: ['Token ID', 'A unique ID for this token'],
    name: ['Name'], unique_name: ['User name'], given_name: ['First name'], family_name: ['Last name'],
    email: ['Email'], upn: ['User principal name'], preferred_username: ['User name'],
    role: ['Role'], roles: ['Roles'], scope: ['Scope', 'What the token may be used for'], scp: ['Scope', 'What the token may be used for'],
    azp: ['Requesting app', 'The app that asked for the token'], client_id: ['Client ID', 'The app that asked for the token'],
    amr: ['Sign-in method'], typ: ['Type'], alg: ['Algorithm']
  };
  TOK_CLAIMS[XMLC + 'name'] = ['User name']; TOK_CLAIMS[XMLC + 'emailaddress'] = ['Email'];
  TOK_CLAIMS[XMLC + 'nameidentifier'] = ['User ID']; TOK_CLAIMS[XMLC + 'upn'] = ['User principal name'];
  TOK_CLAIMS[MSC + 'role'] = ['Role']; TOK_CLAIMS[MSC + 'windowsaccountname'] = ['Windows account'];
  var TOK_DATES = { exp: 1, iat: 1, nbf: 1, auth_time: 1 };
  var TOK_WHO = ['name', 'unique_name', XMLC + 'name', 'preferred_username', 'email', XMLC + 'emailaddress', 'upn', MSC + 'windowsaccountname', 'sub', XMLC + 'nameidentifier'];

  function b64json(part) {
    var b = part.replace(/-/g, '+').replace(/_/g, '/');
    b += '===='.slice(0, (4 - b.length % 4) % 4);
    var bin = atob(b), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder('utf-8').decode(bytes));
  }
  // Every token in the pasted text, labeled by the field or header it came from
  function tokFind(text) {
    var out = [], rx = /eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g, m;
    while ((m = rx.exec(text)) && out.length < 6) {
      var before = text.slice(Math.max(0, m.index - 60), m.index);
      var key = /"?([A-Za-z_]\w*)"?\s*[:=]\s*"?(?:Bearer\s+)?$/i.exec(before);
      var label = /Bearer\s+$/i.test(before) ? 'Bearer token' : key ? key[1] : 'Token ' + (out.length + 1);
      out.push({ jwt: m[0], label: label });
    }
    return out;
  }
  function tokDecode(jwt) {
    var parts = jwt.split('.'), r = { jwt: jwt, parts: parts.length };
    try { r.header = b64json(parts[0]); } catch (e) { r.error = 'header'; return r; }
    try { r.claims = b64json(parts[1]); } catch (e) { r.error = 'payload'; return r; }
    if (!parts[2]) r.unsigned = true;
    return r;
  }
  function relTime(ms) {
    var m = Math.round(Math.abs(ms) / 60000);
    if (m < 1) return 'less than a minute';
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60), mm = m % 60;
    if (h < 24) return h + ' h' + (mm ? ' ' + mm + ' min' : '');
    var d = Math.floor(h / 24), hh = h % 24;
    return d + (d === 1 ? ' day' : ' days') + (hh && d < 3 ? ' ' + hh + ' h' : '');
  }
  function tokTime(sec) {
    var d = new Date(sec * 1000);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) +
      ' (' + d.toISOString().slice(11, 16) + ' UTC)';
  }
  function tokValue(k, v) {
    if (TOK_DATES[k] && typeof v === 'number') return tokTime(v);
    return typeof v === 'string' ? v : JSON.stringify(v);
  }
  // What kind of token this is, from its issuer
  function tokKind(c) {
    var iss = String(c.iss || ''), aud = [].concat(c.aud || []).join(' ');
    var m = /(OpsAPI|EstAPI|MRAPI)_([A-Za-z0-9_-]+)/i.exec(iss + ' ' + aud);
    if (m) return { api: { opsapi: 'ops', estapi: 'est', mrapi: 'mr' }[m[1].toLowerCase()], env: m[2] };
    if (/trimble\.com/i.test(iss) && !/b2w/i.test(iss)) return { tid: true };
    return {};
  }

  // The verdict and what to do about it
  function tokVerdict(r, at) {
    var c = r.claims, kind = tokKind(c), api = kind.api || currentProduct(), now = at || Date.now();
    var when = at ? 'At the time you picked' : 'Right now';
    var v = { kind: kind, api: api };
    if (typeof c.exp !== 'number') {
      v.pill = ['info', 'No expiry time'];
      v.card = { sev: 'info', title: 'This token has no expiry time', body: '<p>It has no <code>exp</code> claim, so time can’t be the problem. If calls with it still fail, check the header format and that it came from the API and environment you are calling.</p>', link: TOK_LINK.use[api] };
    } else if (now >= c.exp * 1000) {
      var ago = relTime(now - c.exp * 1000);
      v.pill = ['bad', 'Expired ' + ago + (at ? ' earlier' : ' ago')];
      v.card = { sev: 'warn', title: (at ? 'At that time, it had expired ' + ago + ' earlier' : 'This token expired ' + ago + ' ago'), body:
        '<p>Every call with it returns <span class="sc sc-4">401</span>. Log in again for a new AccessToken' + (api === 'ops' ? ', and use the newest one: Ops tokens last 1 day by default, and a newer login also retires older tokens.' : '.') + '</p>' +
        '<p>Integrations should log in again when they get a 401 instead of reusing a saved token.</p>', link: TOK_LINK.renew[api] };
    } else if (typeof (c.nbf != null ? c.nbf : c.iat) === 'number' && now < (c.nbf != null ? c.nbf : c.iat) * 1000) {
      var later = relTime((c.nbf != null ? c.nbf : c.iat) * 1000 - now);
      v.pill = ['warn', at ? 'Not issued yet at that time' : 'Not valid yet'];
      v.card = at
        ? { sev: 'info', title: 'At that time, this token didn’t exist yet', body: '<p>It was issued ' + later + ' after the time you picked, so the call at that time must have used a different, older token. Ask for the token from the failing call itself.</p>', link: TOK_LINK.renew[api] }
        : { sev: 'warn', title: 'This token isn’t valid yet', body: '<p>Its start time is ' + later + ' in the future. That usually means the clock is wrong on the machine that made the call, or on this computer. Check both clocks, then log in again.</p>', link: TOK_LINK.renew[api] };
    } else {
      v.pill = ['ok', 'Valid · expires in ' + relTime(c.exp * 1000 - now)];
      v.card = { sev: 'ok', title: when + ', the token hasn’t expired', body: '<p>Time isn’t the problem. If calls with it still return 401, check:</p><ul>' +
        '<li>The header reads exactly <code>Authorization: Bearer &lt;token&gt;</code>.</li>' +
        '<li>It came from the same API and environment the call goes to.</li>' +
        (api === 'ops' ? '<li>Nobody logged in again since. A newer login retires older tokens.</li>' : '<li><code>ClientID</code> and <code>ClientSecret</code>, if Client ID Security is on.</li>') +
        '</ul>', link: TOK_LINK.use[api] };
    }
    if (kind.tid) {
      v.card = { sev: 'info', title: 'This is a Trimble ID token, not an Ops token', body: '<p>Its issuer is Trimble ID. Ops data calls don’t accept it directly: send it to <code>/LoginWithTID</code>, which exchanges it for an Ops AccessToken for the linked Ops user.</p><p>' + esc(v.pill[1]) + '.</p>', link: ['#login-methods', 'LoginWithTID'] };
    }
    return v;
  }

  var tokenTool = null;
  function mountToken(el) {
    el.innerHTML =
      '<div class="tool token">' +
        '<div class="tool-head"><span class="tool-tag">Tool</span><h4>Token inspector</h4></div>' +
        '<div class="tool-body">' +
          '<label class="dec-label" for="tok-input">Paste a token</label>' +
          '<textarea id="tok-input" rows="4" spellcheck="false" autocomplete="off" data-lpignore="true" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOi…"></textarea>' +
          '<p class="chk-hint">An AccessToken, an <code>Authorization: Bearer</code> header, or the whole login response. Postman, PowerShell, and cURL output work too.</p>' +
          '<div class="tok-bar">' +
            '<label class="tok-at" for="tok-at">Check against <input id="tok-at" type="datetime-local"><span class="tok-at-hint">Leave empty for right now. Pick the time a call failed to see whether the token had expired then.</span></label>' +
            '<button class="btn btn-sm" type="button" data-tok="clear">Clear</button>' +
          '</div>' +
          '<p class="visually-hidden" aria-live="polite"></p>' +
          '<div class="tok-out"></div>' +
        '</div>' +
      '</div>';
    var input = $('textarea', el), at = $('#tok-at', el), out = $('.tok-out', el), live = $('[aria-live]', el);
    var found = [], pick = 0, timer = null, last = null;
    function render() {
      var text = input.value.trim();
      found = text ? tokFind(text) : [];
      if (pick >= found.length) pick = 0;
      if (!text) { out.innerHTML = ''; live.textContent = ''; last = null; return; }
      if (!found.length && /\beyJ[A-Za-z0-9_-]{8,}(\.[A-Za-z0-9_-]*)?\s*$/.test(text)) {
        out.innerHTML = '<div class="ts-result sev-warn"><span class="lbl">Can’t read it</span><h5>This token was cut off</h5><p>It starts like a token but stops before its third part. A whole AccessToken is one long line with two dots in it. Copy it again, all the way to the end.</p></div>';
        live.textContent = 'This token was cut off'; last = null; return;
      }
      if (!found.length) {
        var opaque = /^(Bearer\s+)?[A-Za-z0-9._~+\/=-]{16,}$/.test(text);
        out.innerHTML = '<div class="ts-result sev-info"><span class="lbl">Nothing to decode</span><h5>' + (opaque ? 'This isn’t a JWT' : 'No token found in this text') + '</h5>' +
          '<p>' + (opaque ? 'A JWT is three parts separated by dots, and starts with <code>eyJ</code>. This value has no readable parts inside, like the RefreshToken from a login.' : 'An AccessToken starts with <code>eyJ</code> and is one long line with two dots in it. Paste the token, the Authorization header, or the whole login response.') + '</p></div>';
        live.textContent = 'No token found'; last = null; return;
      }
      var r = tokDecode(found[pick].jwt);
      var html = found.length > 1 ? '<div class="tok-pick"><label for="tok-which">Found ' + found.length + ' tokens</label><select id="tok-which">' +
        found.map(function (f, i) { return '<option value="' + i + '"' + (i === pick ? ' selected' : '') + '>' + esc(f.label) + '</option>'; }).join('') + '</select></div>' : '';
      if (r.error || r.parts !== 3) {
        out.innerHTML = html + '<div class="ts-result sev-warn"><span class="lbl">Can’t read it</span><h5>This doesn’t decode as a token</h5><p>' +
          (r.parts !== 3 ? 'A JWT has exactly three parts separated by dots; this one has ' + r.parts + '.' : 'The ' + r.error + ' part isn’t valid.') +
          ' It was most likely cut off or changed when it was copied. Copy the whole AccessToken again: it is one long line.</p></div>';
        live.textContent = 'This doesn’t decode as a token'; last = null; return;
      }
      var atMs = at.value ? new Date(at.value).getTime() : null;
      var v = tokVerdict(r, atMs), c = r.claims;
      var who = TOK_WHO.filter(function (k) { return c[k] != null; })[0];
      var facts = [['Status', '<span class="tok-pill ' + v.pill[0] + '">' + esc(v.pill[1]) + '</span>']];
      if (typeof c.iat === 'number') facts.push(['Issued', esc(tokTime(c.iat))]);
      if (typeof c.exp === 'number') facts.push(['Expires', esc(tokTime(c.exp))]);
      if (typeof c.iat === 'number' && typeof c.exp === 'number') {
        var life = (c.exp - c.iat) * 1000;
        facts.push(['Lifetime', esc(relTime(life)) + (v.api === 'ops' && !v.kind.tid ? (Math.abs(life - 864e5) < 6e4 ? ' <small>the Ops default</small>' : ' <small>Ops default is 1 day</small>') : '')]);
      }
      if (who) facts.push(['User', esc(tokValue(who, c[who])) + ' <small>' + esc((TOK_CLAIMS[who] || [who])[0]) + '</small>']);
      if (v.kind.env) facts.push(['Environment', '<code>' + esc(v.kind.env) + '</code> <small>' + esc(DEC_API[v.kind.api]) + '</small>']);
      if (c.iss) facts.push(['Issued by', '<code>' + esc(String(c.iss)) + '</code>']);
      if (c.aud) facts.push(['Audience', '<code>' + esc([].concat(c.aud).join(', ')) + '</code>']);
      facts.push(['Signature', esc(r.header.alg || 'unknown') + (r.unsigned ? ' <small>no signature: not a real AccessToken</small>' : ' <small>not checked here, that needs the server’s key</small>')]);
      html += '<dl class="dec-facts">' + facts.map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + x[1] + '</dd></div>'; }).join('') + '</dl>';
      html += decCard(v.card, v.card.sev === 'ok' ? 'Not an expiry problem' : v.card.sev === 'info' ? 'Good to know' : 'Likely cause');
      var rows = Object.keys(c).map(function (k) {
        var meta = TOK_CLAIMS[k] || [];
        return '<tr><td><code>' + esc(k.replace(XMLC, '…/').replace(MSC, '…/')) + '</code>' + (meta[0] ? '<br><small>' + esc(meta[0]) + '</small>' : '') + '</td><td>' + esc(tokValue(k, c[k])) + (meta[1] ? '<br><small>' + esc(meta[1]) + '</small>' : '') + '</td></tr>';
      }).join('');
      html += '<details class="tok-claims"><summary>Everything inside the token (' + Object.keys(c).length + ' claims)</summary><div class="table-wrap"><table><thead><tr><th scope="col">Claim</th><th scope="col">Value</th></tr></thead><tbody>' + rows + '</tbody></table></div></details>';
      html += '<div class="dec-actions"><button class="mini-btn" type="button" data-tok="summary">' + icon('i-copy') + 'Copy findings for the ticket</button><span class="tok-note">The token itself is never included.</span></div>';
      out.innerHTML = html;
      live.textContent = v.pill[1];
      last = { v: v, c: c, who: who, r: r };
    }
    function summary() {
      var c = last.c, lines = ['Token check (decoded locally; the token itself is not included)', 'Status: ' + last.v.pill[1] + (at.value ? ' (checked against ' + new Date(at.value).toLocaleString('en-US') + ')' : '')];
      if (typeof c.iat === 'number') lines.push('Issued: ' + tokTime(c.iat));
      if (typeof c.exp === 'number') lines.push('Expires: ' + tokTime(c.exp));
      if (last.who) lines.push('User: ' + tokValue(last.who, c[last.who]));
      if (c.iss) lines.push('Issued by: ' + c.iss);
      if (c.aud) lines.push('Audience: ' + [].concat(c.aud).join(', '));
      lines.push('', 'Likely cause: ' + htmlText(last.v.card.title), htmlText(last.v.card.body));
      return lines.join('\n');
    }
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(render, 150); });
    input.addEventListener('paste', function () { setTimeout(render, 0); });
    at.addEventListener('input', render);
    el.addEventListener('change', function (e) { if (e.target.id === 'tok-which') { pick = +e.target.value; render(); } });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tok]');
      if (!b) return;
      if (b.getAttribute('data-tok') === 'clear') { tokenTool.clear(); input.focus(); }
      else if (b.getAttribute('data-tok') === 'summary' && last) copyText(summary(), b);
    });
    // Keep "expires in" current while the dialog is open
    setInterval(function () { if (last && !el.closest('.modal').hidden && !at.value) render(); }, 30000);
    tokenTool = {
      load: function (text) { input.value = text || ''; pick = 0; render(); },
      clear: function () { input.value = ''; at.value = ''; pick = 0; render(); }
    };
  }
  $$('[data-token]').forEach(mountToken);
  // Open the inspector with a token from elsewhere on the page (the decoder hands one over)
  function inspectToken(text, trigger) {
    if (!tokenTool) return;
    openModal('token', trigger);
    tokenTool.load(text);
  }

  /* ---------------------------------------------------------------- quiz */
  var quizItems = $$('.quiz-item'), scoreText = $('#quiz-score-text'), meter = $('#quiz-meter');
  function updateScore() {
    var answered = 0, right = 0;
    quizItems.forEach(function (it) { if (it.dataset.done) { answered++; if (it.dataset.done === 'right') right++; } });
    scoreText.textContent = answered === quizItems.length
      ? 'You got ' + right + ' of ' + quizItems.length + ' right'
      : answered + ' of ' + quizItems.length + ' answered · ' + right + ' right';
    meter.style.width = (right / quizItems.length * 100) + '%';
  }
  quizItems.forEach(function (it) {
    it.addEventListener('change', function (e) {
      if (it.dataset.done || e.target.type !== 'radio') return;
      var correct = it.getAttribute('data-answer'), picked = e.target.value, ok = picked === correct;
      it.dataset.done = ok ? 'right' : 'wrong';
      $$('input', it).forEach(function (inp) {
        inp.disabled = true;
        var lab = inp.closest('label');
        if (inp.value === correct) lab.classList.add('right');
        else if (inp.value === picked) lab.classList.add('wrong');
      });
      var fb = $('.quiz-fb', it);
      fb.className = 'quiz-fb ' + (ok ? 'right' : 'wrong');
      fb.innerHTML = '<b>' + (ok ? 'Correct.' : 'Not quite.') + '</b>' + esc(fb.getAttribute('data-why'));
      fb.hidden = false;
      updateScore();
    });
  });
  $('#quiz-reset').addEventListener('click', function () {
    quizItems.forEach(function (it) {
      delete it.dataset.done;
      $$('input', it).forEach(function (inp) { inp.disabled = false; inp.checked = false; inp.closest('label').classList.remove('right', 'wrong'); });
      $('.quiz-fb', it).hidden = true;
    });
    updateScore();
  });
  updateScore();

  /* ------------------------------------------------------------ lightbox */
  var lb = $('#lightbox'), lbImg = $('#lightbox-img'), lbCap = $('#lightbox-cap'), lbClose = $('#lightbox-close'), lbReturn = null;
  function openLightbox(frame) {
    var img = $('img', frame), cap = frame.closest('figure') && $('figcaption', frame.closest('figure'));
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt;
    lbCap.textContent = cap ? cap.textContent : '';
    lbReturn = frame;
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    lbClose.focus();
  }
  function closeLightbox() {
    lb.hidden = true;
    document.body.style.overflow = '';
    if (lbReturn) lbReturn.focus();
  }
  document.addEventListener('click', function (e) {
    var frame = e.target.closest('figure.shot .frame');
    if (frame) openLightbox(frame);
  });
  lbClose.addEventListener('click', closeLightbox);
  lb.addEventListener('click', function (e) { if (e.target === lb || e.target === lbImg) closeLightbox(); });
  lb.addEventListener('keydown', function (e) { if (e.key === 'Tab') { e.preventDefault(); lbClose.focus(); } });
})();
