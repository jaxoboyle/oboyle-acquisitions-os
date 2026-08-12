// Single source of truth for the SMS consent wording and its version, so
// the checkbox, the save route, and the audit log all agree on exactly
// what the user agreed to.
export const SMS_CONSENT_VERSION = "v1";

export const SMS_CONSENT_TEXT =
  "I agree to receive automated text messages from O'Boyle Acquisition Operating System regarding task " +
  "reminders, morning plans, overdue tasks, evening reviews, verification codes, and weekly reports. " +
  "Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help. " +
  "I have reviewed the Privacy Policy and Terms.";
