/* B2W Ops API Help Guide — page behaviour. Plain JS, no dependencies. */
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
  function runFilter() {
    var q = norm(filter.value);
    var words = q ? q.split(' ') : [];
    var anyShown = false;
    $$('.toc-group').forEach(function (g) {
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
      var first = tocLinks.filter(function (a) { return !a.closest('li').hidden; })[0];
      if (first) { e.preventDefault(); first.click(); location.hash = first.getAttribute('href'); filter.blur(); }
    } else if (e.key === 'Escape') {
      filter.value = ''; runFilter(); filter.blur();
    }
  });
  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    var typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && currentProduct() === 'ops') {
      e.preventDefault();
      if (isDrawer()) setDrawer(true);
      filter.focus();
    } else if (e.key === 'Escape') {
      if (!$('#lightbox').hidden) closeLightbox();
      else if (toc.classList.contains('open')) { setDrawer(false); menuBtn.focus(); }
    }
  });

  /* -------------------------------- scroll: progress, current section, top */
  var sections = $$('main .q[id]');
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
    if (currentProduct() !== 'ops') return;   // the question index only exists for the Ops API
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
  var PRODUCTS = {
    ops: { title: 'B2W Ops API Help Guide', hash: '', docs: 'https://b2w-eus10.b2w.trimble.com/OpsAPI_B2WTechSupport/doc/index.html' },
    est: { title: 'B2W Estimate API Help Guide', hash: 'estimate-api', docs: 'https://b2w-eus10.b2w.trimble.com/EstAPI_B2WTechSupport/doc/index.html' },
    mr: { title: 'B2W Management Reporting API Help Guide', hash: 'reporting-api', docs: 'https://b2w-eus10.b2w.trimble.com/MRAPI_B2WTechSupport/doc/index.html' }
  };
  var productFromHash = { 'estimate-api': 'est', 'reporting-api': 'mr', 'ops-api': 'ops' };
  var switchBtns = $$('.product-switch button');
  function currentProduct() { return root.getAttribute('data-product') || 'ops'; }
  function setProduct(p, opts) {
    opts = opts || {};
    if (!PRODUCTS[p]) p = 'ops';
    var changed = p !== currentProduct();
    root.setAttribute('data-product', p);
    switchBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-product') === p ? 'true' : 'false'); });
    document.title = PRODUCTS[p].title;
    $('#foot-name').textContent = PRODUCTS[p].title;
    $('#hdr-docs').href = PRODUCTS[p].docs;
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
    var id = location.hash.slice(1), p = productFromHash[id];
    if (p) { setProduct(p, { toTop: true }); return; }
    // A link to an Ops API question opens the Ops API guide first.
    var target = id && document.getElementById(id);
    if (target && target.closest('[data-view="ops"]') && currentProduct() !== 'ops') {
      setProduct('ops');
      target.scrollIntoView();
    }
  });
  setProduct(productFromHash[location.hash.slice(1)] || 'ops');

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
  $$('.tabs').forEach(function (tabs, n) {
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
  });
  var savedTab = store.get(TAB_KEY);
  if (savedTab) selectTab('client', savedTab, false);

  /* ------------------------------------------------------- URL builder */
  var ubPaste = $('#ub-paste'), ubCluster = $('#ub-cluster'), ubEnv = $('#ub-env'), ubOut = $('#ub-out'), ubMsg = $('#ub-msg');
  function cleanCluster(v) { return v.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase(); }
  function cleanEnv(v) { return v.trim().replace(/^\/+|\/+$/g, '').replace(/\/.*$/, '').replace(/^(opsapi|estapi|mrapi)_/i, ''); }
  function buildUrls() {
    var c = cleanCluster(ubCluster.value), env = cleanEnv(ubEnv.value);
    var okHost = /^[a-z0-9.-]+\.[a-z]{2,}$/.test(c), okEnv = /^[A-Za-z0-9_-]+$/.test(env);
    if (!okHost || !okEnv) {
      ubOut.innerHTML = '';
      ubMsg.className = 'builder-msg warn';
      ubMsg.textContent = !okHost ? 'Enter a cluster host such as b2w-eus10.b2w.trimble.com.' : 'Enter an environment name such as B2WTechSupport.';
      return;
    }
    var api = 'https://' + c + '/OpsAPI_' + env;
    var rows = [
      ['Ops website', 'https://' + c + '/' + env],
      ['Ops API (baseUrl)', api],
      ['API docs (Swagger)', api + '/doc/index.html'],
      ['Ping (no login)', api + '/Ping/hello'],
      ['Version (no login)', api + '/Version'],
      ['SystemInfo', api + '/SystemInfo']
    ];
    ubOut.innerHTML = rows.map(function (r) {
      return '<div class="out-row"><span class="lbl">' + esc(r[0]) + '</span><code>' + esc(r[1]) + '</code><span class="acts">' +
        '<a class="mini-btn" href="' + esc(r[1]) + '" target="_blank" rel="noopener">' + icon('i-external') + 'Open</a>' +
        '<button class="mini-btn" type="button" data-copy="' + esc(r[1]) + '" aria-label="Copy ' + esc(r[0]) + '">' + icon('i-copy') + 'Copy</button></span></div>';
    }).join('');
    var cloud = /\.b2w\.trimble\.com$/.test(c);
    ubMsg.className = 'builder-msg' + (cloud ? '' : ' warn');
    ubMsg.textContent = cloud
      ? 'Open the Ping link to confirm the address. It answers without a login.'
      : 'Cloud clusters usually end in .b2w.trimble.com. Double-check the host.';
  }
  ubPaste.addEventListener('input', function () {
    var v = ubPaste.value.trim();
    if (!v) return;
    try {
      var u = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v);
      var first = u.pathname.split('/').filter(Boolean)[0] || '';
      ubCluster.value = u.hostname;
      if (first) ubEnv.value = cleanEnv(decodeURIComponent(first));
      buildUrls();
    } catch (e) { /* keep typing */ }
  });
  [ubCluster, ubEnv].forEach(function (el) { el.addEventListener('input', buildUrls); });
  buildUrls();

  /* -------------------------------------------------- endpoint explorer */
  var FULL = ['GET', 'POST', 'PUT', 'DELETE'];
  var GROUPS = [
    ['all', 'All'],
    ['auth', 'Sign-in & service'],
    ['jobs', 'Jobs'],
    ['people', 'People & organizations'],
    ['equip', 'Equipment & maintenance'],
    ['lists', 'Materials, accounts & lists'],
    ['field', 'Scheduling & field'],
    ['int', 'Integrations & true-up']
  ];
  // [name, group, base methods, has /schema, extra routes [method, path], note]
  var EP = [
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
  var opCount = function (e) { return e[2].length + (e[3] ? 1 : 0) + e[4].length; };
  var TOTAL_OPS = EP.reduce(function (s, e) { return s + opCount(e); }, 0);
  var groupLabel = {}; GROUPS.forEach(function (g) { groupLabel[g[0]] = g[1]; });
  var epGroup = 'all';
  var epSearch = $('#ep-search'), epList = $('#ep-list'), epCount = $('#ep-count'), epFilters = $('#ep-filters');
  var chip = function (m) { return '<span class="m m-sm m-' + m.toLowerCase() + '">' + m + '</span>'; };
  epFilters.innerHTML = GROUPS.map(function (g) {
    return '<button type="button" data-g="' + g[0] + '" aria-pressed="' + (g[0] === 'all') + '">' + esc(g[1]) + '</button>';
  }).join('');
  function renderEndpoints() {
    var q = norm(epSearch.value).replace(/ /g, '');
    var shown = EP.filter(function (e) {
      if (epGroup !== 'all' && e[1] !== epGroup) return false;
      if (!q) return true;
      var hay = norm(e[0] + ' ' + groupLabel[e[1]] + ' ' + (e[5] || '') + ' ' + e[4].map(function (x) { return x[1]; }).join(' ')).replace(/ /g, '');
      return hay.indexOf(q) > -1;
    });
    epList.innerHTML = shown.map(function (e) {
      var extra = e[4].map(function (x) { return '<div class="ep-extra">' + chip(x[0]) + ' /' + esc(e[0]) + esc(x[1]) + '</div>'; }).join('');
      var base = e[2].length ? '<div class="ep-methods">' + e[2].map(chip).join('') + (e[3] ? ' <span class="ep-extra">+ /schema</span>' : '') + '</div>' : '';
      return '<div class="ep"><div class="ep-name">/' + esc(e[0]) + '</div>' + base + extra + (e[5] ? '<div class="ep-extra">' + esc(e[5]) + '</div>' : '') + '</div>';
    }).join('') || '<p class="ep-count">No endpoints match. Try a shorter word, such as “job” or “truck”.</p>';
    epCount.textContent = 'Showing ' + shown.length + ' of ' + EP.length + ' endpoint groups · ' + TOTAL_OPS + ' operations in all';
  }
  epFilters.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-g]');
    if (!b) return;
    epGroup = b.getAttribute('data-g');
    $$('button', epFilters).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    renderEndpoints();
  });
  epSearch.addEventListener('input', renderEndpoints);
  renderEndpoints();

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
