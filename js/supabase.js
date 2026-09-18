// A anon key pode ficar no frontend. Nunca use a service_role key aqui.
const SUPABASE_URL = window.FITLAB_SUPABASE_URL || 'https://giszuwekscxybjmyqeqx.supabase.co';
const SUPABASE_ANON_KEY = window.FITLAB_SUPABASE_ANON_KEY || 'sb_publishable_VfGhlfQ798a3bRjd_fu76Q_CQqo6y_h';
const supabaseClient = SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase
	? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
	: null;

function hasSupabase() {
	return Boolean(supabaseClient);
}
