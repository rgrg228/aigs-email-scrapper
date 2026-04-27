# The AIGS Lead Automation Handbook

A complete beginner's guide to scraping lead emails out of Gmail and turning them
into automatic WhatsApp messages, using Google Apps Script and Uchat.

## How to use this guide

Read it once front to back to understand **why** the system is built the way it
is. Then keep it as a reference — every chapter is self-contained, so you can
jump back to "Chapter 4: Talking to Gmail" the day you need to change which
emails the bot looks at.

Each chapter has the same shape:

- **What & why** — the concept in plain English
- **How it works** — the moving parts
- **In our project** — how we actually use it
- **Try it yourself** — a small exercise

If you're new to programming, don't skip the exercises. They're 60 seconds each
and they build the muscle memory you need.

## Who this is for

- **You, the founder** — so you can replicate this build for the next form,
  the next product, the next channel.
- **A new hire** — so they can take over the system without bugging you.
- **Future-you, six months from now** — when you've forgotten why the regex
  has that weird `\s*\n*` in it.

## What you'll be able to do by the end

- Read emails from Gmail with code
- Write rows to a Google Sheet from code
- Run code on a schedule (every hour, every day, etc.)
- Build a tiny web dashboard with HTML + JavaScript
- POST data to any external service (Uchat, Slack, your own API)
- Configure Uchat to receive that data and trigger a WhatsApp template
- Debug the whole thing when it breaks

## The example project running through this guide

Throughout the book we'll keep coming back to one real project: **a Gmail-to-
WhatsApp bridge for Chat2Sales lead forms.**

The problem we solved:

> "Leads submit a form on my website. The form's notification email lands in
> my inbox alongside a hundred other unrelated emails. I want a clean list of
> just the leads, and I want to send each one a WhatsApp template via Uchat —
> automatically."

The solution we built:

```
Lead fills form on website
        │
        ▼
Notification email arrives in Gmail
        │
        ▼  (every hour, automatically)
Apps Script searches Gmail for those emails
        │
        ▼
Parses name / phone / email / interest / message
        │
        ▼
Appends a row to a Google Sheet (your CRM)
        │
        ▼  (when you click "Send all pending" — or automatically)
Apps Script POSTs each lead to a Uchat Inbound Webhook
        │
        ▼
Uchat creates the bot user, runs your flow
        │
        ▼
WhatsApp template message lands on the lead's phone
```

That's it. Eight steps. The rest of this book explains every box.

---

# Chapter 2 — What is Google Apps Script

## What & why

**Google Apps Script is a programming environment that lives inside your Google
account.** You write small bits of JavaScript code, and they run on Google's
servers with built-in permission to read your Gmail, edit your Sheets, send
Drive files, post to Calendar, and so on.

Think of it as **a robot assistant that can use any Google product on your
behalf.** You give it instructions ("every hour, check Gmail for new lead
emails and write them into this spreadsheet"), and it does the work.

You don't need:
- A server (Google hosts it for free)
- A login system (it already knows you're you, because it lives in your account)
- A database (use a Sheet)
- A frontend host (Apps Script can serve HTML directly)

You do need:
- A free Google account
- A web browser
- Some patience for the first hour

## How it works

An Apps Script **project** is a folder of files. There are three file types
that matter:

| File type | What it does |
|---|---|
| `.gs` (Google Script) | JavaScript code that runs on Google's servers |
| `.html` | The frontend, if you build a web app |
| `appsscript.json` | The "manifest" — declares what Google permissions your code needs |

Inside the `.gs` files you define **functions**. Each function is a named
chunk of code you can run. Some functions you trigger manually (clicking
"Run" in the editor). Others run automatically — on a **trigger** (every
hour, when a form is submitted, when a sheet is edited).

Apps Script gives you free access to Google's products through built-in
**services**. The names are predictable:

| Service | What you do with it |
|---|---|
| `GmailApp` | Search, read, label, send emails |
| `SpreadsheetApp` | Create sheets, read cells, write rows |
| `DriveApp` | Manage files in Drive |
| `UrlFetchApp` | Make HTTP requests to any external API |
| `HtmlService` | Serve HTML pages (build a web UI) |
| `PropertiesService` | Store small bits of config |
| `ScriptApp` | Manage triggers (schedules) |

You'll see most of these in our project.

## Why we picked it for this project

We had four real options. Here's why Apps Script won:

| Option | Pro | Con |
|---|---|---|
| **Apps Script** ✅ | Free, native Gmail + Sheets, hosted by Google | Browser-based editor is clunky |
| Zapier / Make | No-code, fast to set up | Costs money per task at volume; harder to customise parsing logic |
| n8n self-hosted | Free, powerful, visual | You have to host and maintain a server |
| Node.js + Vercel | Maximum flexibility | OAuth setup is painful; overkill for <10 leads/day |

For this project — **low volume (<10/day), Gmail-as-source, Sheets-as-CRM,
single Uchat destination** — Apps Script is the lightest possible answer.
Zero infra, zero cost, zero auth headache.

When would Apps Script be the wrong choice? Mostly when:
- Volume is huge (thousands of triggers per minute)
- You need a real database with relationships
- Multiple developers need to collaborate with version control as the source
  of truth (Apps Script's git story is awkward)

## Try it yourself

A 60-second exercise to feel how it works:

1. Go to **https://script.google.com**
2. Click **+ New project**
3. Replace the placeholder code with:

   ```javascript
   function helloMe() {
     const email = Session.getActiveUser().getEmail();
     Logger.log('Hello ' + email);
   }
   ```

4. Click **Save**, then **Run** (it'll ask for permissions — allow them)
5. Look at the bottom of the editor — the **execution log** prints
   `Hello your.name@gmail.com`

That's it. You just ran code on Google's servers that knew who you were
without you typing a password. That's the magic.

## In our project

We use:
- **`GmailApp`** to search the inbox for Chat2Sales emails
- **`SpreadsheetApp`** to write each lead into the "Loan Leads CRM" sheet
- **`UrlFetchApp`** to POST to Uchat
- **`HtmlService`** to serve the dashboard
- **`PropertiesService`** to remember the sheet's ID across runs
- **`ScriptApp`** to set up the hourly auto-scrape trigger

Six of the seven services in one small project. That's why Apps Script is
such a natural fit.

---

# Chapter 3 — The Apps Script editor: your first project

## What & why

The Apps Script **editor** is the browser-based IDE where you write, save,
and run your code. It looks scarier than it is. Once you know what each panel
does, you'll move through it on muscle memory.

## A tour of the screen

Open **https://script.google.com**, create a new project, and you'll see:

```
┌─────────────────────────────────────────────────────────────────┐
│  Apps Script  | Project name      [cloud icon]    [Deploy ▾]    │
├──────┬──────────────────────────────────────────────────────────┤
│ [<>] │ Files                  │ Code editor                     │
│ [⌚] │   Code.gs              │   function myFunction() {       │
│ [⏰] │   appsscript.json      │     ...                         │
│ [⚙] │   Index.html           │   }                             │
│ [📋] │                        │                                 │
│      ├────────────────────────┴──────────────────────────────── │
│      │  Run │ Debug │ [function ▾] │ Execution log              │
│      ├──────────────────────────────────────────────────────────┤
│      │  Execution log output goes here                          │
└──────┴──────────────────────────────────────────────────────────┘
```

The icons on the **far left sidebar** are the most important things:

| Icon | Name | What it shows |
|---|---|---|
| `<>` | **Editor** | Your code |
| `⌚` | **Executions** | History of every time a function ran (success or fail) |
| `⏰` | **Triggers** | Scheduled runs (e.g. "every hour") |
| `⚙` | **Project Settings** | Time zone, manifest visibility, script properties |
| `📋` | **Libraries / Services** | Add advanced Google services |

## The toolbar above the code

- **Function dropdown** — pick which function to run when you click "Run".
  This is where most beginners get stuck: if it says `myFunction` but you want
  to run `setup`, change the dropdown first.
- **Run** — executes the selected function. The first run triggers a
  permission dialog.
- **Debug** — runs with breakpoints (advanced; ignore for now).
- **Execution log** — opens the bottom panel showing `Logger.log` output and
  errors.

## Showing the manifest

By default `appsscript.json` is hidden. To see it:

1. **Project Settings** (gear icon)
2. Tick **"Show 'appsscript.json' manifest file in editor"**

Always do this on a new project. The manifest controls which Google services
your script is allowed to use.

## Saving and running

- **Ctrl/Cmd + S** to save. The yellow disk icon next to the file name means
  unsaved.
- Apps Script auto-runs **nothing** on save — you have to click **Run**
  explicitly the first time.

## The first-run permission dance

The first time you run any function that touches Gmail, Sheets, or external
URLs, Google shows a scary screen: *"Google hasn't verified this app."*

This is normal because the app **is your own private script**. To proceed:

1. **Review permissions** → pick your account
2. On the warning page → **Advanced** (small text, bottom left)
3. **Go to [Project Name] (unsafe)** — "unsafe" just means "not reviewed by
   Google", not "actually unsafe"
4. **Allow** the requested scopes

You only do this once per project. After that, "Run" just runs.

## Try it yourself

1. In your hello-world project from Chapter 2, add a second function:

   ```javascript
   function readMyInbox() {
     const threads = GmailApp.search('newer_than:1d', 0, 5);
     Logger.log('Found ' + threads.length + ' threads in the last day');
   }
   ```

2. Function dropdown → pick `readMyInbox` → **Run**
3. Approve Gmail permissions
4. Look at the execution log — you should see something like
   `Found 5 threads in the last day`

You just talked to Gmail with code. Three lines.

## In our project

Open the AIGS project and you'll find:

- **`Code.gs`** — all our functions (`setup`, `scrapeInbox`, `sendToUchat`,
  `sendAllPending`, `getLeads`, etc.)
- **`appsscript.json`** — declares scopes for Gmail, Sheets, Drive, external
  fetch
- **`Index.html`** — the dashboard UI

The function dropdown will list every function you can run manually. The two
you'll use most often during setup are `setup` (one-time) and `scrapeInbox`
(test). Once it's all wired, you mostly run nothing manually — the hourly
trigger does it for you.

---

# Chapter 4 — Talking to Gmail

## What & why

`GmailApp` is Apps Script's built-in service for reading and modifying your
inbox. It's a thin wrapper around Gmail's normal search and label features.

The mental model: **anything you can do in the Gmail web UI, you can do in
code.** Searching with `from:` and `subject:` filters? Yes. Applying a label?
Yes. Reading the body? Yes. Sending mail? Yes (we don't, but we could).

## How it works

Three concepts:

1. **Threads** — a conversation (a thread can have many messages)
2. **Messages** — a single email inside a thread
3. **Labels** — Gmail's tags (folders, basically)

The pattern we use throughout the project:

```javascript
const threads = GmailApp.search('your search query', 0, 50);
threads.forEach(thread => {
  thread.getMessages().forEach(msg => {
    const body = msg.getPlainBody();
    // do something with the body
  });
  thread.addLabel(myLabel);  // mark it as processed
});
```

Notice: we search → loop threads → loop each message in each thread → label
the thread when done so we don't process it twice.

### Search queries

The search string is the **same syntax you type into Gmail's search bar**.
Useful operators:

| Operator | Example | Meaning |
|---|---|---|
| `from:` | `from:noreply@chat2sales.ai` | sender's address contains... |
| `to:` | `to:hello@yourdomain.com` | recipient's address contains... |
| `subject:` | `subject:"New demo request"` | subject contains the phrase |
| `label:` | `label:scrapped` | has this label |
| `-label:` | `-label:scrapped` | does NOT have this label |
| `newer_than:` | `newer_than:30d` | within last N days |
| `has:attachment` | `has:attachment` | has any attachment |

Combine them with spaces (treated as AND):

```
from:chat2sales subject:"New demo request" newer_than:30d -label:scrapped
```

This says: emails from any chat2sales address, with that subject, in the last
30 days, that we haven't already processed.

### Getting the body

```javascript
msg.getPlainBody()   // text only — what we use for parsing
msg.getBody()        // full HTML
msg.getSubject()     // subject line
msg.getFrom()        // sender ("Name <addr@x.com>")
msg.getDate()        // when it arrived (a Date object)
msg.getId()          // unique ID — useful for deduplication
```

### Labels

```javascript
let label = GmailApp.getUserLabelByName('scrapped');
if (!label) label = GmailApp.createLabel('scrapped');
thread.addLabel(label);
```

Labels are **persistent** — even if your script forgets which threads it's
processed, Gmail remembers via the label. That's why we use a label as our
"already processed" marker.

## Try it yourself

Add this to your test project:

```javascript
function listLeadEmails() {
  const threads = GmailApp.search('subject:"New demo request" newer_than:7d', 0, 10);
  threads.forEach(t => {
    const msg = t.getMessages()[0];
    Logger.log(msg.getDate() + ' | ' + msg.getFrom() + ' | ' + msg.getSubject());
  });
}
```

Run it. The log should print each matching email. If nothing matches, broaden
the search (`newer_than:30d`).

## In our project

`scrapeInbox()` in `Code.gs` is built on this exact pattern:

1. Build the search query from `CONFIG.GMAIL_QUERY` plus `-label:scrapped`
2. Loop threads, loop messages
3. Skip any message ID already in the sheet (second-line dedupe)
4. Run a regex parser on the body to extract fields
5. Append a row to the sheet
6. Add the `scrapped` label to the thread

Two layers of dedupe (label + message ID) means nothing gets processed twice
even if a thread gets a new message later.

---

# Chapter 5 — Talking to Sheets

## What & why

`SpreadsheetApp` is the Apps Script service for reading and writing Google
Sheets. We use a sheet as our **CRM database** — it's free, you can sort and
filter in the UI, and you can hand it to a non-technical teammate without
training.

A spreadsheet has:
- **Spreadsheet** — the file in Drive
- **Sheets** (tabs) — each tab is a `Sheet` object
- **Ranges** — rectangular selections within a sheet
- **Cells** — individual addressable squares

## How it works

### Open or create

```javascript
const ss = SpreadsheetApp.create('My CRM');         // creates new
const ss = SpreadsheetApp.openById('1abc...xyz');   // opens existing
const sheet = ss.getSheetByName('Leads');           // get a tab
```

The **ID** is the long string in the spreadsheet's URL between `/d/` and
`/edit`. Save it somewhere — you'll need it again. We save it in
`PropertiesService` so we don't have to hardcode it.

### Reading rows

```javascript
const last = sheet.getLastRow();          // last row with data
const values = sheet.getRange(2, 1, last - 1, 10).getValues();
// 2 = start row (skip header)
// 1 = start column
// last - 1 = number of rows
// 10 = number of columns
// returns: 2D array, [row][col]
```

### Writing rows

```javascript
sheet.appendRow(['col1', 'col2', 'col3']);  // append at the bottom
sheet.getRange(rowIndex, 1).setValue('hello');  // set one cell
```

`appendRow` is what we use for new leads. Single-cell `setValue` is what we
use for updating status (e.g. flipping `pending` → `sent`).

### Headers as a contract

We define `SHEET_HEADERS` as a JavaScript array at the top of `Code.gs`:

```javascript
const SHEET_HEADERS = [
  'Received At', 'Message ID', 'Name', 'Phone', ...
];
```

Then everywhere in the code, we look up columns **by header name**, not by
position. That way if you reorder or insert a column, the code still works.

### Storing config — `PropertiesService`

We need to remember the sheet's ID between runs without hardcoding it. That's
what script properties are for:

```javascript
const PROPS = PropertiesService.getScriptProperties();
PROPS.setProperty('SHEET_ID', '1abc...');
const id = PROPS.getProperty('SHEET_ID');
```

It's a simple key-value store scoped to your script. You can also view and
edit it manually in **Project Settings → Script Properties**, which is useful
when something goes wrong.

## Try it yourself

```javascript
function makeMyFirstSheet() {
  const ss = SpreadsheetApp.create('Test CRM');
  const sheet = ss.getSheets()[0];
  sheet.appendRow(['Name', 'Phone']);
  sheet.appendRow(['Alice', '60123456789']);
  sheet.appendRow(['Bob', '60198765432']);
  Logger.log(ss.getUrl());
}
```

Run it. Open the URL in the log. You just created a spreadsheet and wrote
three rows from code.

## In our project

- `setup()` — creates the sheet on first run, saves its ID, writes headers.
- `scrapeInbox()` — `appendRow` for each new lead.
- `sendToUchat()` — `setValue` to flip `WA Status` from `pending` to `sent`
  or `error 4xx`.
- `getLeads()` — reads everything for the dashboard UI.

The header-name lookup pattern (`indexOf_('WA Status')`) means you can drag
columns around in Sheets without breaking anything, as long as the headers
match.

---

# Chapter 6 — Triggers & web apps

## What & why

So far you've been clicking **Run** manually. Two features make Apps Script
actually useful in production:

1. **Triggers** — code that runs automatically on a schedule or event
2. **Web apps** — your script exposed as a URL with a real HTML UI

Together, they turn a one-off script into a **service**.

## Triggers

A trigger is a rule that says "run function X when event Y happens." Types:

| Type | Example |
|---|---|
| **Time-based** | Every hour, every day at 9am, every 5 minutes |
| **On-edit** | When someone edits a sheet |
| **On-form-submit** | When someone submits a Google Form |
| **On-open** | When the user opens a doc/sheet |

We use **time-based** for our hourly auto-scrape.

### Installing a trigger from code

```javascript
function installHourlyTrigger() {
  // Clean up any old ones first
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'scrapeInbox') ScriptApp.deleteTrigger(t);
  });
  // Install a new one
  ScriptApp.newTrigger('scrapeInbox').timeBased().everyHours(1).create();
}
```

This says: "every 1 hour, call the function named `scrapeInbox`."

You can also install triggers manually via the **Triggers** panel (clock icon
in the left sidebar).

### Trigger gotchas

- **Triggers run as you** — they have access to your Gmail and your Drive.
  Don't install random scripts from strangers.
- **6-minute execution limit** per run. Long jobs need to be broken into
  chunks. Not a problem at our volume.
- **Quotas** — Apps Script has daily limits (e.g. 20,000 URL fetch calls per
  day for free accounts). Way beyond what we need.

## Web apps

A web app is your script published as a URL. When someone visits the URL,
Apps Script runs your `doGet()` function and serves what it returns.

### The simplest possible web app

```javascript
function doGet() {
  return HtmlService.createHtmlOutput('<h1>Hello</h1>');
}
```

Deploy this and visit the URL. You'll see "Hello" in the browser.

### Loading from an HTML file

In real apps you keep the HTML in a separate file:

```javascript
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('My Dashboard');
}
```

Apps Script will read `Index.html` from your project files.

### Calling backend functions from the frontend

This is the magic. Inside your HTML:

```javascript
google.script.run
  .withSuccessHandler(data => console.log(data))
  .withFailureHandler(err => console.error(err))
  .getLeads();
```

This calls the `getLeads()` function inside your `.gs` files and runs the
success handler with whatever it returned. No REST API to set up. No CORS
nightmare. Just function calls across the wire.

### Deploying

1. Top right → **Deploy → New deployment**
2. Type: **Web app**
3. **Execute as: Me** (so it runs with your Gmail/Sheets access)
4. **Who has access: Only myself** (private to your account)
5. **Deploy** → copy the URL → bookmark it

When you change your code, the **deployed version doesn't auto-update**. You
have to either:
- **Manage deployments → ✏ edit → New version → Deploy** (cleaner)
- Or just **Deploy → Test deployments** for the latest unsaved changes

## Try it yourself

```javascript
function doGet() {
  return HtmlService.createHtmlOutput(
    '<h1>Hi ' + Session.getActiveUser().getEmail() + '</h1>'
  );
}
```

Deploy it as a web app, open the URL. You've just built a personalised
website in 4 lines. (Take that, Webflow.)

## In our project

- `installHourlyTrigger()` — installs the auto-scrape trigger
- `doGet()` — serves `Index.html` (the dashboard)
- `Index.html` — calls `getLeads()`, `scrapeInbox()`, `sendToUchat()`,
  `sendAllPending()`, and `exportXlsxUrl()` via `google.script.run`

The dashboard is just one HTML file with vanilla JavaScript talking to our
backend functions. No frameworks.

---

# Chapter 7 — Calling external APIs

## What & why

Apps Script can talk to **any HTTP API** in the world via `UrlFetchApp`.
Stripe, Slack, OpenAI, your own Node server, Uchat — same tool for all of
them.

This is the bridge between your private Google universe and the rest of the
internet.

## How it works

The basic call:

```javascript
const response = UrlFetchApp.fetch('https://example.com/api/something', {
  method: 'post',
  contentType: 'application/json',
  payload: JSON.stringify({ name: 'Bill', phone: '60166482234' }),
  muteHttpExceptions: true,
});

const code = response.getResponseCode();   // 200, 404, 500, etc.
const text = response.getContentText();    // raw response body
const data = JSON.parse(text);             // if JSON
```

Three things to know:

### 1. `muteHttpExceptions: true`

Without this, any non-2xx response **throws an exception** and stops your
script. With it, you can inspect `getResponseCode()` and decide what to do.
Always set it to `true` so you can show useful error messages.

### 2. Headers (e.g. for auth)

```javascript
UrlFetchApp.fetch(url, {
  method: 'post',
  headers: { 'Authorization': 'Bearer ' + token },
  contentType: 'application/json',
  payload: JSON.stringify(body),
  muteHttpExceptions: true,
});
```

Most APIs need an auth token in a header. Uchat's inbound webhook is one of
the rare ones that doesn't — the secret is baked into the URL itself.

### 3. Quotas

Free accounts get **20,000 URL fetch calls per day**. At 10 leads/day, you
could send each one 2,000 WhatsApps before hitting the limit. We're fine.

## Try it yourself

```javascript
function pingClaude() {
  const res = UrlFetchApp.fetch('https://httpbin.org/post', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ hello: 'world' }),
    muteHttpExceptions: true,
  });
  Logger.log(res.getResponseCode());
  Logger.log(res.getContentText());
}
```

`httpbin.org` is a free echo service that returns whatever you sent. The log
shows your own request bounced back. Good for proving your `fetch` setup
works before pointing it at Uchat.

## In our project

`sendToUchat(messageId)`:

1. Reads a row from the sheet
2. Builds a JSON payload with `phone`, `name`, `interested_in`, `message`,
   etc.
3. POSTs to `CONFIG.UCHAT_TRIGGER_URL`
4. Reads the response code
5. Updates the row's `WA Status` (`sent` or `error 4xx`) and dumps any error
   body into `Notes`

That last point is critical — when Uchat rejects a payload, the error
response goes straight into the sheet so you can see what went wrong without
opening the execution log.

---

# Chapter 8 — What is Uchat

## What & why

**Uchat is a chatbot platform.** It sits between you and the messaging
channels your customers actually use — WhatsApp, Facebook Messenger,
Instagram, Telegram, SMS, and so on. You build conversations once, and Uchat
delivers them across all those channels.

For our project, Uchat is the thing that actually sends WhatsApp messages.
Apps Script can't talk to WhatsApp directly (Meta requires you to be a
Business Solution Provider). Uchat **is** a Business Solution Provider, so
we lean on them.

## The vocabulary

Five terms you'll hear constantly. Learn these first.

| Term | What it is |
|---|---|
| **Channel** | A connection to one messaging platform (e.g. one WhatsApp number). One Uchat account can have many channels. |
| **Bot user** (or **subscriber**) | A person who has interacted with your bot. Identified by phone number on WhatsApp. |
| **Custom field** | A piece of data attached to a bot user (e.g. `interested_in`, `lead_message`). Like database columns for each contact. |
| **Flow** | A visual diagram of what the bot does. Triggered by something (a keyword, an inbound webhook, etc.) and runs through nodes one by one. |
| **Template** | A pre-approved WhatsApp message format. Required because WhatsApp blocks freeform messages to people who haven't messaged you in 24h. |

## How a flow works

Think of a flow like a flowchart:

```
[Trigger: inbound webhook]
        │
        ▼
[Send WhatsApp Template]   ← uses {{name}}, {{interested_in}}
        │
        ▼
[Wait 1 day]
        │
        ▼
[Send follow-up template]
```

Each box is a **node**. You drag them in, connect them, and Uchat walks the
diagram for each new bot user that hits the trigger.

## WhatsApp templates — the rule you can't ignore

WhatsApp business messaging has a strict rule:

> If a user hasn't messaged you in the last 24 hours, you can only send them
> a **pre-approved template**.

You submit your template text to Meta (via Uchat's UI), they review it
(usually within hours), and once approved you can send it any time. Templates
have **placeholders** like `{{1}}`, `{{2}}` that you fill at send time.

Example approved template:

> "Hi {{1}}, thanks for your interest in {{2}}. We'll be in touch shortly."

When sending, you tell Uchat: `{{1}} = name`, `{{2}} = interested_in`. Uchat
substitutes the values and sends the final message.

If your template ever needs to change, you must submit a new version and
wait for re-approval. So design carefully the first time.

## Inbound vs outbound webhooks (don't confuse these)

This tripped us up early in the build, so it's worth being explicit:

| Direction | What it is | What it's called in Uchat |
|---|---|---|
| **Outbound** (Uchat → outside) | A flow node that calls an external API (e.g. your CRM) | "External Request" |
| **Inbound** (outside → Uchat) | An endpoint that receives data and starts a flow | "Inbound Webhook" |

We use the **inbound webhook**: Apps Script POSTs to Uchat to push a new lead
in. Don't get them mixed up.

## In our project

We use:
- **One channel** — your WhatsApp number
- **One inbound webhook** — `Demo Lead Trigger`, with the JSON-mapping
  configuration we set up
- **Several custom fields** — `lead_name`, `interested_in`, `lead_message`,
  `received_at`
- **One flow** — your existing template-sending flow
- **One template** — the pre-approved WhatsApp message you saved

That's the entire Uchat side. Most projects don't need more.

---

# Chapter 9 — Uchat inbound webhooks (deep dive)

## What & why

The inbound webhook is **the bridge** between your code and Uchat. It's a
unique URL that accepts a POST request with a JSON body. When data arrives,
Uchat:

1. Parses the JSON
2. Finds (or creates) a bot user by the phone number you provided
3. Saves the rest of the data into custom fields
4. Triggers a flow

That's the whole loop.

## Anatomy of the setup

When you create an inbound webhook in Uchat, you fill in five things:

### 1. Webhook URL (Uchat gives this to you)

Looks like:
```
https://app.chat2sales.ai/api/iwh/7231123b6e7edbf0b3b681fa988b17b0
```

The long string at the end is the secret. Whoever has this URL can push data
into your bot, so treat it like a password — don't paste it into Slack or
GitHub Issues.

### 2. Sample JSON (you provide)

You paste an example of what your data will look like:

```json
{
  "phone": "60166482234",
  "name": "Bill Gates",
  "email": "billgates@gmail.com",
  "interested_in": "Affiliate Partner",
  "message": "I want to make you rich"
}
```

This isn't the data Uchat uses at runtime — it's just so the UI can give you
dropdowns based on field names.

### 3. User identification paths

You tell Uchat **where in the JSON** to find the phone and email.

The `$.` prefix means "root of the JSON object". So `$.phone` means "the
`phone` key at the top level."

```
Phone: $.phone
Email: $.email
```

Uchat checks user_ns first (skip), then phone, then email. If no match, it
**creates a new bot user** under the channel you selected.

### 4. Channel (you select)

Which channel new bot users should be created under. Almost always your
WhatsApp channel.

### 5. Field mapping (you build)

For every other piece of data in your JSON, you decide which **custom field**
on the bot user it should be saved to:

```
$.name           →  lead_name
$.interested_in  →  interested_in
$.message        →  lead_message
$.received_at    →  received_at
```

The custom fields can then be referenced inside any flow as `{{lead_name}}`,
`{{interested_in}}`, etc.

## The "no auth header" oddity

Most APIs you'll integrate with require an `Authorization: Bearer ...`
header. Uchat's inbound webhook **doesn't** — the secret is the URL itself.

Pros: simple to call, no token rotation.
Cons: if the URL leaks, anyone can spam your bot. Don't put it in public
repos. Our `Code.gs` has it as `''` and you fill it in your private copy.

## Activating the webhook

**This is the step that gets forgotten.** Uchat webhooks come in inactive by
default. Even after you've configured everything, no flow will run until you
flip the **Activate** toggle and save.

If your test POSTs return `webhook inactive`, that's the only fix.

## How a flow gets triggered

After the webhook saves the bot user and fields, it triggers the flow you
chose. The flow's nodes can use any custom field via `{{field_name}}`. So
your `Send WhatsApp Template` node can reference `{{lead_name}}` directly,
because the webhook just populated it.

## Logs — your friend when debugging

Every webhook keeps **logs** of every request it received, including the raw
JSON. If something doesn't fire, check:

1. Did the request reach Uchat? (logs show it = yes)
2. Did identification succeed? (logs show user found/created = yes)
3. Did mapping succeed? (logs show fields filled = yes)
4. Did the flow run? (check the bot user's history in Uchat)

Walk that ladder top to bottom and you'll find the broken rung.

## In our project

`sendToUchat()` in `Code.gs` builds the JSON exactly to match the sample we
gave Uchat:

```javascript
const payload = { phone: record['Phone'] };
Object.keys(CONFIG.FIELDS).forEach(field => {
  if (field === 'Phone') return;
  const key = field.toLowerCase().replace(/\s+/g, '_');
  payload[key] = record[field];
});
```

The function dynamically builds keys from `CONFIG.FIELDS`. If you add a new
field to `CONFIG.FIELDS` (say `'Loan Amount'`), the payload will gain a
`loan_amount` key automatically. You then have to add `$.loan_amount` to
the Uchat mapping. Two places to change, but they stay in sync via this
naming convention.

---

# Chapter 10 — The full project: architecture & file walkthrough

## What we built

Eight files. Three you'll touch, five you won't.

```
aigs-email-scrapper/
├── Code.gs            ← all the backend logic (touch this most)
├── Index.html         ← the dashboard UI
├── appsscript.json    ← scopes manifest
├── GUIDE.md           ← this book
├── .gitignore
└── .git/              ← (ignore)
```

## The architecture, end to end

```
┌──────────────────────┐
│ Lead fills your form │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Chat2Sales sends an  │
│ email notification   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────────────────────┐
│              Gmail inbox                          │
│    label: scrapped (added after processing)      │
└──────────┬───────────────────────────────────────┘
           │  every hour, GmailApp.search()
           ▼
┌──────────────────────────────────────────────────┐
│              Apps Script: scrapeInbox()           │
│   • dedupe by Message ID + label                  │
│   • regex parse: Name, Phone, Email, ...          │
│   • normalize phone to E.164 (60xxx...)           │
└──────────┬───────────────────────────────────────┘
           │  appendRow
           ▼
┌──────────────────────────────────────────────────┐
│         Google Sheet: "Loan Leads CRM"            │
│   columns: Received At, Message ID, Name, Phone,  │
│            Email, Interested In, Message,         │
│            WA Status, WA Sent At, Notes           │
└──────────┬───────────────────────────────────────┘
           │  click "Send all pending" in dashboard
           ▼  (or call sendToUchat per row)
┌──────────────────────────────────────────────────┐
│     Apps Script: sendToUchat() / sendAllPending() │
│   • build JSON from row                           │
│   • POST to CONFIG.UCHAT_TRIGGER_URL              │
│   • write back WA Status + Notes                  │
└──────────┬───────────────────────────────────────┘
           │  HTTPS POST
           ▼
┌──────────────────────────────────────────────────┐
│          Uchat inbound webhook                    │
│   • create/find bot user by phone                 │
│   • save fields to custom fields                  │
│   • trigger flow                                  │
└──────────┬───────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────┐
│       Uchat flow: Demo Lead Welcome               │
│   • Send WhatsApp Template node                   │
│   • placeholders filled from custom fields        │
└──────────┬───────────────────────────────────────┘
           │
           ▼
       📱 WhatsApp delivered to lead
```

## File walkthrough

### `appsscript.json`

The manifest. Tells Google **what permissions our script needs**:

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/script.external_request",
    ...
  ]
}
```

`gmail.readonly` lets us search and read. `gmail.modify` lets us add labels.
`spreadsheets` lets us write rows. `script.external_request` lets us POST to
Uchat. Don't add scopes you don't use — Google scolds you for it.

### `Code.gs` — the brain

Top section: **`CONFIG`** — every value you need to customise lives here.
Search query, country code, Uchat URL, regex for each field. Editing this
file *should* be 90% of customisation work; you shouldn't need to touch the
function bodies for normal tweaks.

Then a constant `SHEET_HEADERS` that's auto-built from `CONFIG.FIELDS`.

Then the functions, grouped:

| Function | What it does | When it runs |
|---|---|---|
| `doGet()` | Serves the dashboard | When someone opens the web app URL |
| `setup()` | Creates the sheet, label, and headers | Once, manually |
| `installHourlyTrigger()` | Sets up auto-scrape | Once, manually |
| `scrapeInbox()` | Finds and parses new lead emails | Hourly (and manually) |
| `parseBody_()` | Runs regex on email body | Called by scrapeInbox |
| `normalizePhone_()` | Cleans phone to E.164 | Called by parseBody |
| `sendToUchat(messageId)` | POSTs one lead to Uchat | When you click "Send WA" on a row |
| `sendAllPending()` | Sends every `pending` row | When you click "Send all pending" |
| `getLeads()` | Returns all rows for the dashboard | Called by Index.html on page load |
| `exportXlsxUrl()` | Returns the Sheet's xlsx export URL | Called by "Export Excel" button |

The functions ending with `_` (like `parseBody_`) are **private** — Apps
Script convention says scripts can't call them from outside (e.g. from
`google.script.run`). Just an organisational marker.

### `Index.html` — the dashboard

Three sections:
- **CSS** at the top — dark mode styling
- **HTML** in the middle — header, button bar, table container
- **JavaScript** at the bottom — calls backend functions and renders rows

The JS is plain (no React, no jQuery). It uses `google.script.run` to call
backend functions and `withSuccessHandler` to render results. Total: ~80
lines.

## The mental model in one sentence

> **Apps Script reads Gmail, writes to Sheet, and POSTs to Uchat. Uchat
> creates a contact and sends WhatsApp. The Sheet is the source of truth.**

If you remember that one sentence, you can reason about anything that goes
wrong.

---

# Chapter 11 — Daily operation

## What a normal day looks like

Once everything is set up, your daily loop should be **less than two minutes**:

1. **Morning** — open the dashboard URL bookmark
2. Glance at the leads table — any new ones from overnight will already be
   there (the hourly trigger ran while you slept)
3. Click **Send all pending → Uchat**
4. Done

That's it. The hourly trigger does the scraping; you do the sending.

## What gets logged where

| What | Where | When |
|---|---|---|
| Lead arrived | Sheet, new row, status `pending` | Within 1 hour of the email |
| WhatsApp sent | Sheet, status flips to `sent`, `WA Sent At` filled | Right after you click Send |
| Send failed | Sheet, status `error 4xx`, `Notes` has the response | Right after the failure |
| Email already processed | Gmail label `scrapped` on the thread | After scrape |
| Code execution failure | Apps Script → Executions panel | When it happened |

## Reading the sheet

Three columns to watch:

- **WA Status** — `pending`, `sent`, or `error <code>`
- **WA Sent At** — empty until sent, then a timestamp
- **Notes** — error responses from Uchat (only filled when something fails)

If a row says `error 4xx`, click the cell, read the Notes, fix the issue
(usually a bad phone number or an inactive webhook), then **manually edit
the WA Status back to `pending`** and click Send all pending again.

## Pausing the system

Going on holiday and don't want WhatsApps blasting?

- **Disable the trigger**: Apps Script → ⏰ Triggers → click the row → trash
  icon. New leads will pile up in Gmail labelled `scrapped`-less, and the
  next time you run `scrapeInbox` they'll all flow in.

- Or just **don't open the dashboard** — the auto-scrape doesn't auto-send.
  Leads will pile up at status `pending` and you can send them all when you
  return.

## Resending a message to a single lead

The lead said "didn't get it"? Or the first send had a typo?

1. Open the sheet
2. Find their row
3. Edit **WA Status** back to `pending` (just type it)
4. Open the dashboard → click **Send WA** on that row

Uchat will treat it as a fresh trigger and the flow will run again.

## Updating the deployed dashboard

When you (or I) change `Code.gs` or `Index.html`, the deployed web app
**doesn't auto-update**. You have to redeploy:

1. **Deploy → Manage deployments**
2. Click the ✏ pencil icon next to the active deployment
3. Version dropdown → **New version**
4. **Deploy**

Same URL, new code. Refresh the dashboard tab.

---

# Chapter 12 — Customising for a new form

The whole point of this build is that you can re-use it. Here's the recipe
for adapting it to a new lead source (different form, different email
format, different fields).

## Scenario: a new product

Suppose you launch a second product and the form notification email looks
like this:

```
Subject: New consult booking — Jane Smith

Hi team, you've got a new booking:

Full Name: Jane Smith
Mobile: +60 12-3456789
Email: jane@example.com
Service: Annual Health Check
Preferred Date: 2026-05-10

Sent from MyClinic.com
```

Your tasks:

### 1. Update `CONFIG.GMAIL_QUERY`

```javascript
GMAIL_QUERY: 'from:noreply@myclinic.com subject:"New consult booking"',
```

Test in Gmail's search bar first.

### 2. Update `CONFIG.FIELDS`

The new form's labels are different. Map each one:

```javascript
FIELDS: {
  'Name':           /Full Name\s*[:\-]\s*(.+)/i,
  'Phone':          /Mobile\s*[:\-]\s*([+\d\s\-()]+)/i,
  'Email':          /Email\s*[:\-]\s*([^\s<>]+@[^\s<>]+)/i,
  'Service':        /Service\s*[:\-]\s*(.+)/i,
  'Preferred Date': /Preferred Date\s*[:\-]\s*([\d\-\/]+)/i,
},
```

### 3. Reset the sheet

Headers come from `CONFIG.FIELDS`, so if you've changed the keys you need
fresh headers:

1. Open the sheet
2. Delete row 1 (the headers)
3. Run `setup` again — it'll write new headers

If you've already got data in the sheet from the old form, **copy it to a
new tab first** so you don't lose it.

### 4. Create a new Uchat inbound webhook

Each form/product = one webhook. Don't reuse the old one.

1. Tools → Inbound Webhooks → + New
2. Name: `Consult Booking Trigger`
3. Paste a sample JSON like:
   ```json
   {
     "phone": "60123456789",
     "name": "Jane Smith",
     "email": "jane@example.com",
     "service": "Annual Health Check",
     "preferred_date": "2026-05-10"
   }
   ```
4. Map: `$.phone` for identification, custom fields for everything else
5. Connect to a new flow with the appropriate template
6. Activate

### 5. Update `CONFIG.UCHAT_TRIGGER_URL`

Paste the new webhook URL.

### 6. Test with one row

Manually submit the form, wait an hour (or click Scrape), click Send WA.
Watch the WhatsApp arrive.

## What if you have **two** different lead sources at once?

Two options:

**Option A — Two separate Apps Script projects.** Cleanest. Copy the whole
project, change the CONFIG, deploy a separate dashboard. Each has its own
hourly trigger. Recommended.

**Option B — One project, multiple configs.** More advanced; you'd refactor
`CONFIG` into an array and run `scrapeInbox` once per config. Skip until
you have 3+ sources and the duplication actually hurts.

## What if the email format changes?

Forms change their notification template once in a while. Symptoms:

- Sheet stops getting new rows even though emails are arriving
- Or rows arrive but Name/Phone are blank

Fix:

1. Open one of the recent emails in Gmail
2. Compare the labels in the body to your `CONFIG.FIELDS` regex
3. Update the regex
4. Re-test with `scrapeInbox`

The original loose patterns I wrote (`(?:Phone|Mobile|WhatsApp)`) handle
most variations, but very different formats will need new regex.

---

# Chapter 13 — Troubleshooting

A flat catalogue of failures we've seen, what causes them, and how to fix.
Skim it now; come back when something breaks.

## Apps Script side

### "Function dropdown only shows `myFunction`"

You pasted my code **inside** the default `function myFunction() { ... }`
wrapper. Delete the wrapper (line 1 and the closing `}` at the bottom) so
my functions are top-level.

### "Run setup first" thrown error

You haven't run `setup()` yet, so `SHEET_ID` isn't saved. Run it once.

### "Unauthorized" or "OAuth permission required"

You skipped or cancelled the permission dialog. Run the function again,
click through *Advanced → Go to (unsafe) → Allow*.

### Sheet doesn't appear in Drive after running setup

- Wrong Google account? Apps Script may have run as a different login than
  the Drive tab you're checking.
- Did setup actually run? Check the **Executions** panel. If empty, you
  never clicked Run.

### Scrape adds 0 rows even though emails are in the inbox

- Run your `GMAIL_QUERY` directly in Gmail's search bar. If it returns
  nothing, fix the query.
- Are the emails labelled `scrapped` already? They'll be excluded.
- Did one of your fields fail to parse? `hasMinimum_()` requires Name +
  Phone. If either regex misses, the row is skipped silently.

### Phone numbers come out wrong (`919...` instead of `60...`)

`DEFAULT_COUNTRY_CODE` in `CONFIG` is wrong. Change it. The fix applies to
**future** scrapes only — existing rows in the sheet won't auto-update.

### Hourly trigger doesn't seem to run

- Triggers panel: is there a row for `scrapeInbox` time-based? If no,
  `installHourlyTrigger` never ran.
- Triggers panel: any "Failure" indications? Click the row to see the
  recent execution history.
- Triggers run on Google's clock, not yours. Could be 10-15 min late.

## Uchat side

### Test POST returns "webhook inactive"

You haven't toggled the webhook to **Active** yet. It's the on/off switch
at the top of the webhook editor.

### Test POST returns "phone is invalid"

The phone in the payload isn't in E.164. Check `normalizePhone_()` worked —
the value in the sheet's Phone column should be all digits, no `+` or
spaces, starting with the country code.

### Test POST succeeds but WhatsApp never arrives

Walk down the ladder:

1. Uchat webhook **Logs** — does the request appear?
2. Uchat **bot users** — was a user created with that phone?
3. The user's **history** — did the flow run?
4. The flow's **template node** — did it send?

If all show success but no WhatsApp, the issue is on the WhatsApp side
(template not approved, or the user's number isn't reachable, or Meta
blocked it for spam reasons).

### "Channel not specified" or similar

In the webhook editor's identification section, the **channel** dropdown
isn't filled. Set it to your WhatsApp channel.

### Template variables come through blank or as literal `{{1}}`

Uchat couldn't find the custom field for that placeholder. Either:
- The custom field name in the mapping doesn't match what the template
  references
- The mapping in the webhook didn't save
- The custom field was created but on a different channel

Open the bot user's profile in Uchat — you should see all custom fields
filled. If they're empty, the webhook mapping is broken.

## Misc

### "I deleted the sheet by accident"

The script properties still have `SHEET_ID` pointing at a dead file. Apps
Script editor → Project Settings → Script Properties → delete `SHEET_ID`.
Run `setup` again. New sheet, fresh start.

### "I want to start completely over"

1. Delete the sheet from Drive
2. Apps Script → Project Settings → Script Properties → delete `SHEET_ID`
3. Gmail → remove the `scrapped` label from any threads (or just delete the
   label entirely, it'll get recreated)
4. Run `setup` again
5. Run `scrapeInbox` — everything that ever matched will reappear in the
   fresh sheet

---

# Chapter 14 — Glossary

A quick reference for the jargon used in this guide.

| Term | Definition |
|---|---|
| **Apps Script** | Google's JavaScript runtime hosted inside your Google account. Lets you script Gmail, Sheets, Drive, etc. |
| **Bot user / subscriber** | A contact known to Uchat (identified by phone for WhatsApp). |
| **Channel** | A connection from Uchat to one messaging platform (e.g. one WhatsApp number). |
| **CONFIG** | The block at the top of `Code.gs` that holds all customisable values. |
| **Custom field** | A piece of data attached to a bot user. Like a database column. |
| **Dashboard** | The web UI served by `doGet()` — a bookmark-able URL that shows the leads table. |
| **Deployment** | A frozen version of your Apps Script web app, accessible by URL. |
| **doGet()** | The function Apps Script calls when someone visits your web app URL. |
| **E.164** | The international phone format with country code and no symbols (e.g. `60166482234`). |
| **Execution log** | The bottom panel of the Apps Script editor that shows `Logger.log` output and errors from your last run. |
| **Flow** | A visual diagram in Uchat representing what the bot does. |
| **GmailApp** | The Apps Script service for reading and modifying Gmail. |
| **HtmlService** | The Apps Script service for serving HTML pages. |
| **Inbound webhook** | A Uchat URL that accepts JSON and triggers a flow. |
| **Manifest** | The `appsscript.json` file. Declares what permissions your script needs. |
| **Message ID** | Gmail's unique ID for a single email. We store it as a dedupe key. |
| **Outbound webhook / External Request** | A node *inside* a Uchat flow that POSTs to your external system. (We don't use this.) |
| **PropertiesService** | A simple key-value store for script config. We use it for `SHEET_ID`. |
| **Regex** | Regular expression — a pattern for matching text. We use them to extract fields from email bodies. |
| **Scope** | A specific permission your script asks for (e.g. read Gmail, edit Sheets). |
| **`scrapeInbox()`** | Our function that pulls new lead emails into the sheet. |
| **`sendToUchat()`** | Our function that POSTs one row to the Uchat webhook. |
| **Service** | A built-in Apps Script API like GmailApp, SpreadsheetApp, UrlFetchApp. |
| **`setup()`** | Our one-time function that creates the sheet, label, and headers. |
| **`SHEET_HEADERS`** | The array of column names. Auto-built from `CONFIG.FIELDS`. |
| **SpreadsheetApp** | The Apps Script service for reading and writing Google Sheets. |
| **Template (WhatsApp)** | A Meta-approved message format with placeholders. Required outside the 24-hour window. |
| **Trigger** | Apps Script's mechanism for running code automatically on a schedule or event. |
| **UrlFetchApp** | The Apps Script service for making HTTP requests to external APIs. |
| **`user_ns`** | Uchat's internal subscriber ID. We don't use it directly — we identify by phone. |
| **Web app** | An Apps Script project deployed as a URL with HTML output. |

---

# Final words

If you've read this far, you know:

- What Apps Script is and why it's the right tool for low-volume Google
  automation
- How to read Gmail, write to Sheets, and call external APIs from code
- How to deploy a private web dashboard for non-technical use
- How Uchat thinks about channels, bot users, custom fields, and flows
- How the inbound webhook bridges your code to Uchat
- How every file in this project fits into the bigger picture
- How to extend it for a new lead source
- How to debug it when it breaks

That's enough to be dangerous. Build something with it.

— end of book —






