import Link from "next/link";

export const metadata = {
  title: "Terms & Conditions — O'Boyle Acquisition Operating System",
  description: "Terms of use for O'Boyle Acquisition Operating System, including SMS/text messaging terms.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-serif font-bold text-text tracking-tight">Terms &amp; Conditions</h1>
          <p className="label-tech mt-1">O&apos;Boyle Acquisition Operating System</p>
          <p className="text-xs text-text-subtle mt-2">Last updated: August 6, 2026</p>
        </div>

        <div className="card p-6 space-y-6 text-sm text-text leading-relaxed">
          <section>
            <p>
              O&apos;Boyle Acquisition Operating System (&quot;OAOS&quot;) is a private operations system used to run
              O&apos;Boyle Acquisitions. By using it, you agree to the terms below.
            </p>
          </section>

          <section>
            <h2 className="font-serif font-semibold text-text mb-2">Use of the System</h2>
            <p>
              OAOS is intended for authorized use by O&apos;Boyle Acquisitions and its account holders. Access is by
              invitation/authorized login only.
            </p>
          </section>

          <section>
            <h2 className="font-serif font-semibold text-text mb-2">SMS / Text Messaging Terms</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>OAOS text messages are sent only after you give express consent in Settings.</li>
              <li>
                Messages may include: task reminders, morning plans, overdue task alerts, evening reviews,
                verification codes, and weekly reports.
              </li>
              <li>Message frequency varies based on your activity and the notification types you enable.</li>
              <li>Message and data rates may apply.</li>
              <li>Reply <strong>STOP</strong> to unsubscribe from text messages at any time.</li>
              <li>Reply <strong>START</strong> to resubscribe.</li>
              <li>Reply <strong>HELP</strong> for help.</li>
              <li>Consent to receive text messages is not a condition of purchasing anything.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif font-semibold text-text mb-2">Your Content</h2>
            <p>
              Business data you enter into OAOS (leads, deals, tasks, notes, and financial figures) remains yours.
              It is used only to operate the features of the app for your account.
            </p>
          </section>

          <section>
            <h2 className="font-serif font-semibold text-text mb-2">No Warranty</h2>
            <p>
              OAOS is provided as-is, without warranty of any kind. Figures, projections, and AI-generated content
              (including anything written by Big Stein) are tools to support decisions, not guarantees of business
              outcomes.
            </p>
          </section>

          <section>
            <h2 className="font-serif font-semibold text-text mb-2">Changes to These Terms</h2>
            <p>
              If these terms change, the &quot;Last updated&quot; date above will change with it. Continued use of OAOS
              after an update means you accept the revised terms.
            </p>
          </section>

          <section>
            <h2 className="font-serif font-semibold text-text mb-2">Contact</h2>
            <p>
              Questions about these terms:{" "}
              <a href="mailto:jqoboyle@gmail.com" className="text-brand hover:underline">jqoboyle@gmail.com</a>.
            </p>
          </section>
        </div>

        <p className="mt-6 text-center text-xs text-text-subtle">
          <Link href="/privacy" className="text-brand hover:underline">Privacy Policy</Link>
          {" · "}
          <Link href="/auth/login" className="text-brand hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
