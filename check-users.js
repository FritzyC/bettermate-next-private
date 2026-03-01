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
    .limit(10);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('All users:', data);
  }
})();
