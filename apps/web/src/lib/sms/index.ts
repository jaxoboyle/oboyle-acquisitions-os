import type { SmsProvider } from "./provider";
import { TwilioSmsProvider } from "./twilio";

export type { SmsProvider, SmsSendResult, SmsFailureReason } from "./provider";

/** Central place to swap SMS providers — everything else calls this. */
export function getSmsProvider(): SmsProvider {
  return new TwilioSmsProvider();
}
