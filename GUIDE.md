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

Next: **Chapter 2 — What is Google Apps Script.**
