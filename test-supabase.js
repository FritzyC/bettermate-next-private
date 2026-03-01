const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const { data, error } = await supabase
    .from('bettermate_users')
    .select('id, email, password_hash')
    .eq('email', 'fritz@bettermate.com')
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('User found:', data);
    console.log('Password hash:', data.password_hash);
  }
})();
