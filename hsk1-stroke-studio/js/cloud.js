/* cloud.js — accounts + cloud-synced progress via Supabase.
 *
 * Design: the cloud is an *enhancement*, never a hard dependency.
 *  - If keys are missing or the library failed to load, Cloud.enabled = false
 *    and every method is a safe no-op; the app runs exactly as local-only.
 *  - Guests use localStorage (handled by storage.js).
 *  - On login we PULL the user's saved blob and hand it to the Store; from
 *    then on, local changes are debounced and PUSHED up as one JSON row.
 *
 * Exposes window.Cloud.
 */
(function () {
  "use strict";

  var URL = window.SUPABASE_URL || "";
  var KEY = window.SUPABASE_ANON_KEY || "";
  var libOK = !!(window.supabase && window.supabase.createClient);
  var enabled = !!(URL && KEY && libOK);

  var client = enabled ? window.supabase.createClient(URL, KEY) : null;
  var currentUser = null;
  var applyingRemote = false;   // suppress push while we load a remote blob
  var pushTimer = null;
  var listeners = [];           // auth-change subscribers
  var statusListeners = [];     // sync-status subscribers

  function emitAuth() { listeners.forEach(function (fn) { try { fn(currentUser); } catch (e) {} }); }
  function emitStatus(s) { statusListeners.forEach(function (fn) { try { fn(s); } catch (e) {} }); }

  /* ---- push / pull ---- */
  function push(state) {
    if (!enabled || !currentUser) return Promise.resolve();
    emitStatus("saving");
    return client.from("progress").upsert({
      user_id: currentUser.id,
      state: state,
      updated_at: new Date().toISOString()
    }).then(function (res) {
      emitStatus(res.error ? "error" : "saved");
      if (res.error) console.warn("Cloud push failed:", res.error.message);
    }, function (e) {
      emitStatus("error"); console.warn("Cloud push error:", e);
    });
  }

  function pull() {
    if (!enabled || !currentUser) return Promise.resolve(null);
    return client.from("progress").select("state").eq("user_id", currentUser.id)
      .maybeSingle()
      .then(function (res) {
        if (res.error) { console.warn("Cloud pull failed:", res.error.message); return null; }
        return res.data ? res.data.state : null;
      }, function (e) { console.warn("Cloud pull error:", e); return null; });
  }

  // storage.js calls this after every local write
  function onLocalChange(state) {
    if (!enabled || !currentUser || applyingRemote) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { push(state); }, 1400);
  }

  /* ---- auth ---- */
  function signUp(email, password) {
    if (!enabled) return Promise.reject(new Error("Accounts are not configured."));
    return client.auth.signUp({ email: email, password: password })
      .then(function (res) { if (res.error) throw res.error; return res.data; });
  }
  function signIn(email, password) {
    if (!enabled) return Promise.reject(new Error("Accounts are not configured."));
    return client.auth.signInWithPassword({ email: email, password: password })
      .then(function (res) { if (res.error) throw res.error; return res.data; });
  }
  function signOut() {
    if (!enabled) return Promise.resolve();
    return client.auth.signOut();
  }

  var Cloud = {
    enabled: enabled,
    libLoaded: libOK,
    user: function () { return currentUser; },
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    pull: pull,
    push: push,
    onLocalChange: onLocalChange,
    beginApply: function () { applyingRemote = true; },
    endApply: function () { applyingRemote = false; },
    onChange: function (fn) { listeners.push(fn); },
    onStatus: function (fn) { statusListeners.push(fn); }
  };

  // Wire Supabase's own auth events -> our listeners.
  if (enabled) {
    client.auth.getSession().then(function (res) {
      currentUser = (res.data && res.data.session && res.data.session.user) || null;
      emitAuth();
    });
    client.auth.onAuthStateChange(function (_event, session) {
      currentUser = (session && session.user) || null;
      emitAuth();
    });
  }

  window.Cloud = Cloud;
})();
