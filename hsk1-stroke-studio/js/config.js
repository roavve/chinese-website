/* config.js — Supabase connection.
 *
 * These two values are SAFE to ship publicly:
 *   - the project URL is just an address
 *   - the "publishable" / anon key only works through Row Level Security,
 *     so the database still refuses to reveal or change anyone else's rows.
 *
 * Never put the SECRET / service_role key here.
 *
 * To point this at a different Supabase project, replace the two strings.
 * Leave them empty ("") to run the app in pure local-only mode (no accounts).
 */
window.SUPABASE_URL = "https://ewoewvrhuuwtatdkiupu.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_WNLY_CQ1GM7-l2qxWz07Mg_x239TlDj";
