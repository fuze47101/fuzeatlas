/**
 * Twilio SMS helper.
 *
 * Thin wrapper around the Twilio REST POST /Messages endpoint —
 * mirrors the inline implementation already used in
 * src/app/api/admin/outreach/send/route.ts. Extracted so build-
 * lifecycle notifications (autonomous build phase boundaries,
 * stop/park events) can text Andrew without re-implementing
 * the auth dance.
 *
 * Required env:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 *
 * If any are missing, the helper logs and returns { ok: false }
 * without throwing — calling code can no-op gracefully.
 */

interface SendSMSOpts {
  /** E.164 destination ("+18018096000"). Dots / spaces / dashes are stripped. */
  to: string;
  body: string;
}

interface SendSMSResult {
  ok: boolean;
  sid?: string;
  error?: string;
}

function normalize(num: string): string {
  // Twilio wants E.164: + followed by digits. Strip everything else.
  const trimmed = num.trim();
  const cleaned = "+" + trimmed.replace(/[^\d]/g, "");
  return cleaned;
}

export async function sendSMS({ to, body }: SendSMSOpts): Promise<SendSMSResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    console.warn("[sms] Twilio not configured — skipping SMS to", to);
    return { ok: false, error: "twilio_not_configured" };
  }

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: normalize(to),
        From: from,
        Body: body,
      }),
    });
    const data = await res.json();
    if (res.ok && data.sid) return { ok: true, sid: data.sid };
    return { ok: false, error: data.message || `twilio_${res.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || "twilio_throw" };
  }
}
