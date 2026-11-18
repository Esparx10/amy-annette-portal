/* portal-key.js — sends the private portal access key with requests to the
 * Walmart portal (added 2026-11-18). The same file is used by the portal's own
 * pages and copied into the GitHub Pages site.
 *
 * - The key is asked for once per browser and kept in localStorage.
 * - A page opened inside a frame gets it from "#pk=..." in its address.
 * - fetch() calls to the portal get an X-Portal-Key header automatically.
 * - Plain links to portal downloads get ?pk= added when clicked.
 * - If the portal answers "Access key required", the page asks for the key
 *   again (once) and retries.
 */
(function () {
  if (window.PortalKey) return;
  var LS = 'aa_portal_key';
  var PORTAL_HOSTS = /(^|\.)ngrok-free\.dev$|(^|\.)ngrok\.io$|^localhost$|^127\.0\.0\.1$/i;
  var asked = false;

  function store(k) { try { if (k) localStorage.setItem(LS, k); else localStorage.removeItem(LS); } catch (e) {} }
  function read() { try { return localStorage.getItem(LS) || ''; } catch (e) { return ''; } }

  // Key handed over in the address (used when a page is shown inside a frame).
  var m = /[#&]pk=([^&]+)/.exec(location.hash || '');
  if (m) {
    store(decodeURIComponent(m[1]));
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  }
  var memKey = m ? decodeURIComponent(m[1]) : read();

  function get(promptIfMissing) {
    if (!memKey && promptIfMissing && !asked) ask();
    return memKey;
  }
  function ask() {
    asked = true;
    var k = '';
    try { k = (window.prompt('Enter the Amy & Annette portal access key.\n(You only need to do this once on this device.)') || '').trim(); } catch (e) {}
    if (k) { memKey = k; store(k); }
    return memKey;
  }
  function isPortalUrl(u) {
    try {
      var url = new URL(u, location.href);
      if (url.origin === location.origin) return PORTAL_HOSTS.test(location.hostname) || url.pathname.indexOf('/api/') === 0;
      return PORTAL_HOSTS.test(url.hostname);
    } catch (e) { return false; }
  }
  function withKey(u) {
    var k = get(true); if (!k || !isPortalUrl(u)) return u;
    var url = new URL(u, location.href); url.searchParams.set('pk', k); return url.toString();
  }

  var origFetch = window.fetch.bind(window);
  function keyedFetch(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || String(input);
    if (!isPortalUrl(url)) return origFetch(input, init);
    // On the portal's own pages a logged-in session usually covers it, so only
    // ask for the key there if the portal actually refuses the request.
    var sameOrigin = false; try { sameOrigin = new URL(url, location.href).origin === location.origin; } catch (e) {}
    var k = sameOrigin ? memKey : get(true);
    var opts = Object.assign({}, init || {});
    var h = new Headers(opts.headers || (input && input.headers) || {});
    if (k) h.set('X-Portal-Key', k);
    opts.headers = h;
    return origFetch(input, opts).then(function (res) {
      if (res.status !== 401 || asked) return res;
      return res.clone().json().then(function (j) {
        if (!j || !j.needKey) return res;
        var nk = ask(); if (!nk) return res;
        h.set('X-Portal-Key', nk); opts.headers = h;
        return origFetch(input, opts);
      }, function () { return res; });
    });
  }
  window.fetch = keyedFetch;

  // Plain download links (e.g. Christy ship-list xlsx) can't send a header.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (/\/api\//.test(href) && isPortalUrl(href) && !/[?&]pk=/.test(href)) a.href = withKey(href);
  }, true);

  window.PortalKey = {
    get: get, ask: ask, withKey: withKey,
    clear: function () { memKey = ''; store(''); },
    // For frames: append the key so the framed portal page can use it.
    frameUrl: function (u) { var k = get(true); return k ? u + '#pk=' + encodeURIComponent(k) : u; }
  };
})();
