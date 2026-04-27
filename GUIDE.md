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



