# Furnished Finder Agent

Automated web scraping and interaction tool for Furnished Finder using Playwright with stealth plugins.

## Prerequisites

### Global Dependencies

You need the following installed globally for Claude Desktop MCP integration:

```bash
npm install -g @executeautomation/playwright-mcp-server
```

This MCP server enables Claude to interact with browsers and assist with automation development.

### System Requirements

- Node.js (v18 or higher recommended)
- npm or yarn

## Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd furnished-finder-agent
```

2. Install project dependencies:
```bash
npm install
```

This will install all local dependencies including:
- `@playwright/test` - Playwright testing framework
- `playwright-extra` - Enhanced Playwright with plugin support
- `puppeteer-extra-plugin-stealth` - Stealth plugin to avoid bot detection
- `tsx` - TypeScript execution engine
- `googleapis` - Google APIs client library for Gmail integration

## Project Structure

```
furnished-finder-agent/
├── login.ts                      # Login automation script
├── scrape.ts                     # Main scraping logic
├── check-messages.ts             # Message checking automation
├── extract-first-message.ts      # Extract first inbox message (AI-powered workflow)
├── authorize-gmail.ts            # Gmail OAuth setup (browser-based)
├── authorize-gmail-with-code.ts  # Gmail OAuth setup (code-based)
├── gmail-poller.ts               # Poll Gmail for new booking requests
├── auth-state.json               # Saved Furnished Finder authentication state
├── cookies.json                  # Browser cookies
├── first_message_extracted.json  # Sample extracted message data
├── new_booking_request.json      # Sample booking request data
├── package.json                  # Project dependencies and scripts
└── README.md                     # This file
```

## Usage

The project includes several npm scripts for common automation tasks:

### Login Automation
```bash
npm run login
```
Automates the login process and saves authentication state to `auth-state.json`.

### Scraping
```bash
npm run scrape
```
General scraping functionality.

### Check Messages
```bash
npm run check-messages
```
Check messages with manual navigation support.

### Extract First Message (Recommended)
```bash
npm run extract-first-message
```
**AI-Powered Workflow**: Automatically navigates to messages and extracts the first message data including:
- Sender name and email
- Property details
- Message content
- Rental dates and requirements
- Pet information

Output saved to `first_message_data.json`.

### Gmail Integration

#### Authorize Gmail
```bash
npm run authorize-gmail
```
Sets up Gmail API OAuth2 authentication for monitoring incoming booking requests.

#### Poll Gmail for Booking Requests
```bash
npm run gmail-poller
```
Continuously monitors Gmail inbox for new booking request notifications from Furnished Finder.

## How It Works

### Authentication Workflow

The `extract-first-message.ts` script uses a smart authentication approach:

1. **Load Homepage**: Navigate to furnishedfinder.com
2. **Inject Auth Token**: Use `page.evaluate()` to set the `authdetailnew` localStorage item from `auth-state.json`
3. **Reload Page**: Refresh to apply authentication
4. **Navigate Authenticated**: Access protected pages like dashboard and messages

This approach is more reliable than loading cookies because it directly injects the JWT token that Furnished Finder uses for authentication.

### PHG Pattern (Pattern-Heuristic-Guess)

The workflow uses intelligent navigation:

1. **Pattern**: Try common URL patterns first (`/members/pm-dashboard`, `/members/tenant-message`)
2. **Heuristic**: Search for links and buttons with message-related text
3. **Guess**: Use AI reasoning to understand page structure and find elements dynamically

This makes the script resilient to UI changes.

### Stealth Automation

This project uses `playwright-extra` with the `puppeteer-extra-plugin-stealth` plugin to avoid bot detection. The stealth plugin:

- Masks automation indicators
- Randomizes user agent patterns
- Handles browser fingerprinting
- Bypasses common anti-bot measures

### Gmail Integration Workflow

The project includes Gmail API integration to monitor for new booking requests:

1. **OAuth2 Setup**: Run `authorize-gmail.ts` to authenticate with Gmail API
2. **Token Storage**: Credentials are saved locally for future use
3. **Polling**: `gmail-poller.ts` monitors inbox for Furnished Finder notifications
4. **Trigger**: New booking requests can trigger automated scraping and response workflows

This enables automated monitoring of incoming rental inquiries without manual checking.

### MCP Server Integration

The `@executeautomation/playwright-mcp-server` installed globally allows Claude Desktop to:
- View browser snapshots
- Suggest automation improvements
- Help debug test failures
- Generate new automation scripts

This separation means:
- **Global**: Development tools (MCP servers)
- **Local**: Project code and libraries (version controlled)

## Development

### Adding New Automation Scripts

1. Create a new TypeScript file in the project root
2. Import necessary dependencies:
   ```typescript
   import { chromium } from 'playwright-extra';
   import StealthPlugin from 'puppeteer-extra-plugin-stealth';
   ```
3. Use the stealth plugin:
   ```typescript
   chromium.use(StealthPlugin());
   ```
4. Add a script entry in `package.json`

### Best Practices

- Always use the stealth plugin for production scraping
- Handle errors gracefully with try-catch blocks
- Use appropriate wait strategies (waitForSelector, waitForLoadState)
- Close browser instances properly to avoid resource leaks

## Troubleshooting

### MCP Server Not Found
Ensure `@executeautomation/playwright-mcp-server` is installed globally:
```bash
npm list -g --depth=0 | grep playwright-mcp-server
```

### Stealth Plugin Not Working
Verify local installation:
```bash
npm list playwright-extra puppeteer-extra-plugin-stealth
```

### Browser Detection Issues
Check that you're properly initializing the stealth plugin before launching the browser.

## License

ISC
