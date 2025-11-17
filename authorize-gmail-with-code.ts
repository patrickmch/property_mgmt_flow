import { google } from 'googleapis';
import * as fs from 'fs';

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = 'token.json';
const CREDENTIALS_PATH = 'google_credentials.json';

/**
 * Authorize Gmail API access with provided code
 */
async function authorizeWithCode(authCode: string) {
  // Load client secrets from a local file.
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const { client_secret, client_id, redirect_uris } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // Check if we have previously stored a token.
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oAuth2Client.setCredentials(token);
    console.log('✓ Already authorized! Token loaded from token.json');
    console.log('✓ Gmail API is ready to use');
    return oAuth2Client;
  }

  // Exchange authorization code for token
  console.log('Exchanging authorization code for access token...');

  return new Promise((resolve, reject) => {
    oAuth2Client.getToken(authCode, (err: any, token: any) => {
      if (err) {
        console.error('Error retrieving access token:', err);
        reject(err);
        return;
      }
      oAuth2Client.setCredentials(token);

      // Store the token to disk for later program executions
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
      console.log('\n✓ Token stored to', TOKEN_PATH);
      console.log('✓ Authorization complete!');
      console.log('✓ Gmail API is now ready to use');
      resolve(oAuth2Client);
    });
  });
}

// Get authorization code from command line argument
const authCode = process.argv[2];

if (!authCode) {
  console.error('Error: Please provide the authorization code as an argument');
  console.error('Usage: tsx authorize-gmail-with-code.ts <authorization-code>');
  process.exit(1);
}

// Run authorization
authorizeWithCode(authCode)
  .then(() => {
    console.log('\nYou can now use the Gmail API in your scripts!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Authorization failed:', error);
    process.exit(1);
  });
