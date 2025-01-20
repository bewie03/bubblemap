const fs = require('fs');
const path = require('path');

// Read the contents of env.js
const envPath = path.join(__dirname, '../public/env.js');
let envContent = fs.readFileSync(envPath, 'utf8');

// Replace the placeholder with the actual environment variable
envContent = envContent.replace(
  '"__REACT_APP_BLOCKFROST_API_KEY__"',
  `"${process.env.REACT_APP_BLOCKFROST_API_KEY || ''}"`
);

// Write the modified content back to env.js
fs.writeFileSync(envPath, envContent);
