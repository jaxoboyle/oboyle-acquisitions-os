// SMS provider adapter interface — swap the implementation returned by
// getSmsProvider() in ./index.ts to add another provider later without
// touching any call site.

export type SmsFailureReason =
  | "not_configured"
  | "invalid_number"
  | "rate_limited"
  | "provider_error";

export type SmsSendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; reason: SmsFailureReason; message: string };

export interface SmsProvider {
  send(toE164: string, body: string): Promise<SmsSendResult>;
}
