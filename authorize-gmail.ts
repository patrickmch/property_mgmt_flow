import { google } from 'googleapis';
import * as fs from 'fs';
import * as readline from 'readline';

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = 'token.json';
const CREDENTIALS_PATH = 'google_credentials.json';

/**
 * Authorize Gmail API access
 */
async function authorize() {
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

  // Get new token
  return getNewToken(oAuth2Client);
}

/**
 * Get and store new token after prompting for user authorization
 */
function getNewToken(oAuth2Client: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    console.log('\n=== Gmail API Authorization ===\n');
    console.log('To authorize this app to send emails via Gmail:');
    console.log('\n1. Open this URL in your browser:\n');
    console.log(authUrl);
    console.log('\n2. Authorize the application');
    console.log('3. Copy the code from the redirect URL\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('Enter the authorization code here: ', (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err: any, token: any) => {
        if (err) {
          console.error('Error retrieving access token:', err);
          reject(err);
          return;
        }
        oAuth2Client.setCredentials(token);

        // Store the token to disk for later program executions
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
        console.log('\n✓ Token stored to', TOKEN_PATH);
        console.log('✓ Authorization complete!');
        console.log('✓ Gmail API is now ready to use');
        resolve(oAuth2Client);
      });
    });
  });
}

// Run authorization
authorize()
  .then(() => {
    console.log('\nYou can now use the Gmail API in your scripts!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Authorization failed:', error);
    process.exit(1);
  });
