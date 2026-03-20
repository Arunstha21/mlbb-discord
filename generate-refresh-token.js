const http = require('http');
const url = require('url');

// Load your credentials
const credentials = require('./credentials.json');

// Generate authorization URL
const authUrl = new URL(credentials.authUri);
authUrl.searchParams.append('client_id', credentials.clientId);
authUrl.searchParams.append('redirect_uri', credentials.redirectUris[0]);
authUrl.searchParams.append('scope', credentials.scopes.join(' '));
authUrl.searchParams.append('response_type', 'code');
authUrl.searchParams.append('access_type', 'offline'); // Important for refresh token
authUrl.searchParams.append('prompt', 'consent'); // Force consent to get refresh token

console.log('========================================');
console.log('STEP 1: Authorize your application');
console.log('========================================');
console.log('\n1. Open this URL in your browser:\n');
console.log(authUrl.toString());
console.log('\n2. Authorize the application');
console.log('3. Copy the authorization code from the redirect\n');

// Simple server to catch the redirect
const server = http.createServer((req, res) => {
  const query = url.parse(req.url, true).query;

  if (query.code) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Authorization successful!</h1><p>You can close this window.</p>');

    console.log('\n========================================');
    console.log('Authorization code received:');
    console.log('========================================');
    console.log(query.code);

    // Now exchange for tokens
    exchangeToken(query.code);

    server.close();
  } else if (query.error) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`<h1>Error: ${query.error}</h1>`);
    console.error('Authorization error:', query.error);
    server.close();
  }
});

server.listen(3000, () => {
  console.log('\nLocal server listening on http://localhost:3000');
  console.log('After authorizing, you\'ll be redirected to localhost');
  console.log('\nWaiting for authorization...\n');
});

function exchangeToken(authCode) {
  // You'll need to implement token exchange
  // or use a tool like Postman/curl with the following:
  console.log('\n========================================');
  console.log('STEP 2: Exchange code for tokens');
  console.log('========================================');
  console.log('\nUse this curl command to get your refresh token:\n');
  console.log(`curl -X POST "${credentials.tokenUri}" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "code=${authCode}" \\
  -d "client_id=${credentials.clientId}" \\
  -d "client_secret=${credentials.clientSecret}" \\
  -d "redirect_uri=${credentials.redirectUris[0]}" \\
  -d "grant_type=authorization_code"`);
}
