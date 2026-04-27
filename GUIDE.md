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

Next: **Chapter 3 — The Apps Script editor: your first project.**

