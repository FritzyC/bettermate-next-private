const bcrypt = require('bcrypt');

const password = 'password123';
const hash = '$2b$10$dY5iAtFA0TywCokPn4j99.gNnbH.CHIJwVPFt4X6SVa76Flksp.r6';

bcrypt.compare(password, hash).then(match => {
  console.log('Password match:', match);
});
