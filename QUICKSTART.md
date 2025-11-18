# Quick Start Guide

## 🚀 Phase 1: Core Automation System - BUILT!

All core components have been created! Here's what we built:

### Files Created:
1. ✅ **property_context.json** - Your Lander, WY property details
2. ✅ **database.ts** - SQLite message tracking
3. ✅ **llm-client.ts** - LLM API integration
4. ✅ **error-notifier.ts** - Email error alerts
5. ✅ **message-queue.ts** - Sequential message processing
6. ✅ **cron-gmail-poller.ts** - Gmail monitoring (every 1 min)
7. ✅ **playwright-responder.ts** - Headless browser automation
8. ✅ **server.ts** - Express server orchestration
9. ✅ **.env.example** - Environment variables template
10. ✅ **package.json** - Updated with all dependencies

---

## 📋 Next Steps to Test Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Create `.env` file
```bash
cp .env.example .env
```

Edit `.env` and update:
```env
ERROR_NOTIFICATION_EMAIL=your-email@example.com
```

### 3. Ensure You Have Required Files
Make sure these files exist (you should already have them):
- `google_credentials.json` - Gmail OAuth credentials
- `token.json` - Gmail OAuth token
- `auth-state.json` - Furnished Finder authentication
- `property_context.json` - Property details (already created!)

### 4. Start the Server
```bash
npm start
```

You should see:
```
🚀 FURNISHED FINDER AUTOMATION SYSTEM
================================================================================
🌐 Server running on port 3000
🚀 Starting Gmail poller
📧 Filter: from:furnishedfinder.com
⏱️  Interval: */1 * * * *
✅ System initialized successfully
```

### 5. Test the System

**Check Status:**
```bash
curl http://localhost:3000/status
```

**Health Check:**
```bash
curl http://localhost:3000/health
```

---

## 🧪 Testing Flow

### What Happens When a Message Arrives:

1. **Gmail Poller** (every 60 seconds)
   - Checks Gmail for new Furnished Finder messages
   - Adds new inquiries to database with `pending` status
   - Enqueues message for processing

2. **Message Queue** (sequential processing)
   - Picks up pending message
   - Updates status to `processing`

3. **Playwright Responder**
   - Launches headless browser
   - Navigates to Furnished Finder messages
   - Extracts tenant's actual message

4. **LLM Client**
   - Sends tenant message + property context to your LLM API
   - Receives AI-generated response

5. **Playwright Responder** (again)
   - Types response into Furnished Finder
   - Sends message
   - Closes browser

6. **Database & Notifications**
   - Updates status to `sent`
   - Sends success email notification
   - Queue moves to next message

---

## ⚙️ Configuration Options

### Gmail Polling Interval
Change in `.env`:
```env
# Check every 30 seconds
GMAIL_CHECK_INTERVAL=*/30 * * * * *

# Check every 5 minutes
GMAIL_CHECK_INTERVAL=*/5 * * * *
```

### Gmail Filter
Currently set to production:
```env
GMAIL_FILTER=from:furnishedfinder.com
```

For testing, change to:
```env
GMAIL_FILTER=from:your-test-email@gmail.com
```

### Headless Mode
Run browser visible for debugging:
```env
HEADLESS=false
```

---

## 🐛 Troubleshooting

### Database Issues
If the database has issues, delete and restart:
```bash
rm messages.db
npm start
```

### Gmail Auth Expired
Re-run Gmail authorization:
```bash
npm run authorize-gmail
```

### Furnished Finder Auth Expired
You'll get an email notification. Re-run:
```bash
npm run login
```

### LLM API Down
Check health:
```bash
curl https://llmrouter-production.up.railway.app/health
```

---

## 📊 Monitoring

### Check Queue Status
```bash
curl http://localhost:3000/status | json_pp
```

Returns:
```json
{
  "queue": {
    "queueSize": 2,
    "processing": true,
    "messages": [...]
  },
  "poller": {
    "isRunning": true,
    "interval": "*/1 * * * *"
  },
  "database": {
    "total": 15,
    "pending": 2,
    "processing": 1,
    "sent": 12,
    "failed": 0
  }
}
```

### Check Recent Messages
Database tracks all messages in `messages.db`. You can query it or use the status endpoint.

---

## 🚢 Deploying to Railway (Next Phase)

Once local testing works:

1. Push to GitHub
2. Connect GitHub repo to Railway
3. Add environment variables in Railway dashboard
4. Deploy!

Railway will automatically:
- Detect Node.js project
- Install dependencies
- Run `npm start`

---

## 📝 Key Files to Edit

- **property_context.json** - Update property details, pricing, amenities
- **llm-client.ts** (buildPrompt method) - Customize AI prompt
- **error-notifier.ts** - Customize email notifications
- **cron-gmail-poller.ts** (categorizeEmail method) - Adjust email parsing

---

## ✅ System Architecture

```
Gmail API
  ↓
[Cron Poller] → [Message Queue] → [Process Message]
                                        ↓
                         [1. Playwright Extract Message]
                                        ↓
                         [2. LLM Generate Response]
                                        ↓
                         [3. Playwright Send Response]
                                        ↓
                         [4. Update Database & Notify]
```

---

## 🎯 Success Criteria

Your system is working when:
- ✅ Server starts without errors
- ✅ Gmail poller checks every minute
- ✅ New messages get added to database
- ✅ Queue processes messages sequentially
- ✅ Playwright extracts messages from FF
- ✅ LLM generates appropriate responses
- ✅ Responses get sent successfully
- ✅ You receive success email notifications

---

## 🆘 Get Help

Check logs in terminal for detailed error messages. The system is designed to:
- Email you when errors occur
- Retry failed messages (up to 3 times)
- Save all messages to database for audit trail

---

**Ready to launch? Run `npm start` and watch the magic happen!** 🎉
