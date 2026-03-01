const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const { data, error } = await supabase
    .from('bettermate_users')
    .insert([
      {
        email: 'fritz@bettermate.com',
        password_hash: '$2b$10$dY5iAtFA0TywCokPn4j99.gNnbH.CHIJwVPFt4X6SVa76Flksp.r6',
      }
    ]);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('User created:', data);
  }
})();
