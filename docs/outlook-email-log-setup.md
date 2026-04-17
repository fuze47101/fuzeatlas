# Outlook → Atlas CRM: BCC-to-Atlas Email Log

One-liner: every email you send from Outlook for FUZE47 gets silently BCC'd
to an inbound address that lands it on the matching Contact's timeline in Atlas.

## How it works

```
  Outlook (send) ──► recipient@company.com
       │
       └── auto-BCC ──► log@em.fuzeatlas.com
                               │
                               ▼
                  Inbound provider (CloudMailin / Postmark)
                               │
                               │ POST JSON (with X-Webhook-Secret)
                               ▼
               https://fuzeatlas.com/api/inbound/email
                               │
                               ▼
                  Contact match (by email)  ─► Note {
                                                 noteType: "EMAIL",
                                                 emailDirection: "OUTBOUND",
                                                 ...
                                              }
                               │
                               ▼
               Shows up on the Brand / Factory / Contact
               activity timeline as a sent email.
```

## 1. Pick an inbound provider (choose one)

| Provider    | Price     | Why                                           |
| ----------- | --------- | --------------------------------------------- |
| CloudMailin | $9/mo 10k | Purpose-built for app-inbound, flat JSON POST |
| Postmark    | included  | If you add Postmark for transactional         |
| Mailgun     | usage     | Routes feature, JSON or form POST             |

Recommend **CloudMailin** — simplest setup, works with any MX config.

## 2. Point an address at the webhook

- Sign up; they issue `something@cloudmailin.net`
- Optional: add an MX record for `em.fuzeatlas.com` → CloudMailin, so the
  BCC address is `log@em.fuzeatlas.com` (cleaner than the random hash)
- Set the inbound target in CloudMailin to:

  ```
  https://fuzeatlas.com/api/inbound/email
  ```

- Add a custom header in CloudMailin settings:

  ```
  X-Webhook-Secret: <random-long-string>
  ```

## 3. Set the secret in Vercel

```
INBOUND_EMAIL_SECRET=<the-same-random-long-string>
```

## 4. Outlook auto-BCC rule

Outlook Desktop → File → Manage Rules & Alerts → New Rule:

- "Apply rule on messages I send"
- (no conditions → applies to all outbound)
- Action: **Cc the message to `log@em.fuzeatlas.com`**
  (Outlook exposes Cc in rules, not Bcc — Cc works here since the
  recipient of the BCC address never sees the header, it gets dropped
  after Atlas ingests)
- Save, enable

For FUZE47-only: add a "from account = fuze47@..." condition.

## 5. Test it

```
curl -X POST https://fuzeatlas.com/api/inbound/email \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: <secret>" \
  -d '{
    "from": "andrew@801inc.com",
    "to": "contact@existing-brand.com",
    "subject": "Test",
    "text": "Hello",
    "messageId": "<test-123@example.com>"
  }'
```

Expected: `{ ok: true, matched: 1, created: 1, direction: "OUTBOUND" }`

## Direction logic

- `from` matches a User.email → `OUTBOUND` (we sent it, contact is recipient)
- `from` does NOT match a User.email → `INBOUND` (contact sent it to us)

## Dedup

Each email has a `Message-ID` header; we store it on the Note with a unique
index, so even if the BCC goes through twice, the second one is silently
dropped with `{ ok: true, deduped: true }`.

## What shows up where

| Location                                     | Source                   |
| -------------------------------------------- | ------------------------ |
| Brand activity timeline `/brands/[id]`       | `contact.brandId` bubble |
| Factory activity timeline `/factories/[id]`  | `contact.factoryId`      |
| Contact drawer `/api/contacts/[id]/activity` | `note.contactId`         |

The Note's `content` field is prefixed with `📤 Sent:` or `📥 Received:`
plus the subject and a 2000-char preview of the body.

## Phase 2 (when ready)

Swap BCC-to-Atlas for Microsoft Graph OAuth so we can capture **inbound**
email on the FUZE47 mailbox automatically (not just outbound-via-BCC).
Graph needs an Entra app registration + admin consent. See task #23.
