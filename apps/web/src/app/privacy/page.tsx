import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — O'Boyle Acquisition Operating System",
  description: "How O'Boyle Acquisition Operating System handles account and phone/messaging information.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-serif font-bold text-text tracking-tight">Privacy Policy</h1>
          <p className="label-tech mt-1">O&apos;Boyle Acquisition Operating System</p>
          <p className="text-xs text-text-subtle mt-2">Last updated: August 6, 2026</p>
        </div>

        <div className="card p-6 space-y-6 text-sm text-text leading-relaxed">
          <section>
            <p>
              O&apos;Boyle Acquisition Operating System (&quot;OAOS,&quot; &quot;we,&quot; &quot;us&quot;) is a private
              operations system used to run O&apos;Boyle Acquisitions. This page explains what information we collect
              through the app and, specifically, how we handle mobile phone numbers and text messaging.
            </p>
          </section>

          <section>
            <h2 className="font-serif font-semibold text-text mb-2">Information We Collect</h2>
            <p>
              Account information (name, email), business data you enter (leads, deals, tasks, notes, financial
              figures), device/work-session data used to run the app&apos;s scheduling and time-tracking features, and,
              if you choose to provide it, a mobile phone number for text notifications.
            </p>
          </section>

          <section>
            <h2 className="font-serif font-semibold text-text mb-2">Mobile Phone Numbers &amp; Text Messaging</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Mobile phone numbers are never sold.</li>
              <li>Mobile phone numbers are never shared with third parties for marketing purposes.</li>
              <li>
                Your phone number is used only to send the OAOS notifications you specifically enable in Settings —
                nothing else.
              </li>
              <li>
                Messages may include: task reminders, morning plans, overdue task alerts, evening reviews,
                verification codes, and weekly reports.
              </li>
              <li>Message frequency varies based on your activity and the notification types you have enabled.</li>
              <li>Message and data rates may apply.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif font-semibold text-text mb-2">How Phone Information Is Protected</h2>
            <p>
              Your phone number is stored under your own account and is only readable by you and the server-side
              systems that send your notifications. Verification codes are never stored in plain text — only a
              one-way hash is kept, and each code expires shortly after it&apos;s issued. The credentials used to send
              text messages are kept on the server only and are never exposed to the browser or included in any
              client-side code.
            </p>
          </section>

          <section>
            <h2 className="font-serif font-semibold text-text mb-2">Requesting Deletion</h2>
            <p>
              You can remove your saved phone number at any time from Settings → Notifications → Remove Number,
              which deletes it immediately. To request deletion of your phone number, messaging history, or other
              account information directly, email{" "}
              <a href="mailto:jqoboyle@gmail.com" className="text-brand hover:underline">jqoboyle@gmail.com</a>.
            </p>
          </section>

          <section>
            <h2 className="font-serif font-semibold text-text mb-2">Other Services We Use</h2>
            <p>
              OAOS runs on Supabase (database and authentication), Anthropic (Big Stein&apos;s AI responses), and, for
              text messages, Twilio. Push notifications, when enabled, are delivered through your browser&apos;s
              standard Web Push service. None of these providers receive your phone number except Twilio, and only
              for the purpose of delivering the message you requested.
            </p>
          </section>

          <section>
            <h2 className="font-serif font-semibold text-text mb-2">Changes to This Policy</h2>
            <p>
              If this policy changes, the &quot;Last updated&quot; date above will change with it. Continued use of OAOS
              after an update means you accept the revised policy.
            </p>
          </section>

          <section>
            <h2 className="font-serif font-semibold text-text mb-2">Contact</h2>
            <p>
              Questions about this policy or your data:{" "}
              <a href="mailto:jqoboyle@gmail.com" className="text-brand hover:underline">jqoboyle@gmail.com</a>.
            </p>
          </section>
        </div>

        <p className="mt-6 text-center text-xs text-text-subtle">
          <Link href="/terms" className="text-brand hover:underline">Terms &amp; Conditions</Link>
          {" · "}
          <Link href="/auth/login" className="text-brand hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
