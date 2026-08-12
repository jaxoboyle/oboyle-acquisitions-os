import type { SmsProvider, SmsSendResult } from "./provider";

// Twilio error codes for invalid/unreachable numbers.
// https://www.twilio.com/docs/api/errors
const INVALID_NUMBER_CODES = new Set([21211, 21214, 21217, 21614]);

export class TwilioSmsProvider implements SmsProvider {
  async send(toE164: string, body: string): Promise<SmsSendResult> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return {
        ok: false,
        reason: "not_configured",
        message: "Twilio is not configured on the server. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.",
      };
    }

    try {
      // Lazy import — keeps the Twilio SDK out of any client bundle.
      const { default: twilio } = await import("twilio");
      const client = twilio(accountSid, authToken);
      const message = await client.messages.create({ to: toE164, from: fromNumber, body });
      return { ok: true, providerMessageId: message.sid };
    } catch (err: unknown) {
      const twilioErr = err as { code?: number; status?: number; message?: string };

      if (twilioErr.code && INVALID_NUMBER_CODES.has(twilioErr.code)) {
        return { ok: false, reason: "invalid_number", message: "That phone number could not be reached by Twilio." };
      }
      if (twilioErr.status === 429 || twilioErr.code === 20429) {
        return { ok: false, reason: "rate_limited", message: "Twilio rate limit reached. Try again shortly." };
      }
      return {
        ok: false,
        reason: "provider_error",
        message: twilioErr.message ?? "The SMS provider returned an error.",
      };
    }
  }
}
