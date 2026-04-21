import Link from 'next/link';
import LegalDisclaimer from '@/components/LegalDisclaimer';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-primary-500/30">
              🧠
            </div>
            <span className="font-bold text-xl gradient-text">MyCupIsEmpty</span>
          </Link>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12">
          <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
          <p className="text-gray-500 text-sm mb-8">Last updated: March 2026</p>

          <div className="prose prose-gray max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
              <p className="text-gray-600 leading-relaxed">
                We collect information you provide during registration (name, email, class level, role) and learning data generated through your use of the platform (quiz scores, progress, learning style assessments, AI chat interactions).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. How We Use Your Data</h2>
              <p className="text-gray-600 leading-relaxed">
                Your data is used to personalize your learning experience, track your academic progress, adapt AI tutoring to your learning style, and generate growth reports. We do not sell your personal data to third parties.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Data Storage & Security</h2>
              <p className="text-gray-600 leading-relaxed">
                Your data is stored securely using Supabase (built on PostgreSQL) with row-level security policies. We use industry-standard encryption for data in transit and at rest. Authentication is handled through secure OAuth and encrypted password storage.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. AI Interactions</h2>
              <p className="text-gray-600 leading-relaxed">
                Conversations with our AI tutor are used to provide contextual learning support. Chat history is stored to maintain conversation continuity. AI responses are generated in real-time and tailored to your learning profile.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Children&apos;s Privacy</h2>
              <p className="text-gray-600 leading-relaxed">
                MyCupIsEmpty is designed for students of all ages. For users under 13, we recommend parental supervision. Parents can access their child&apos;s learning data through the parent dashboard. We collect only the minimum data necessary for educational functionality.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Your Rights</h2>
              <p className="text-gray-600 leading-relaxed">
                You have the right to access, correct, or delete your personal data. You can export your learning data at any time through the settings page. To delete your account and all associated data, please contact us through the platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Third-Party Services</h2>
              <p className="text-gray-600 leading-relaxed">
                We use the following third-party services: Supabase (database & authentication), xAI/Grok (AI tutoring), and Vercel (hosting). Each service has its own privacy policy. We only share the minimum data required for these services to function.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Contact</h2>
              <p className="text-gray-600 leading-relaxed">
                For privacy-related questions or concerns, please reach out through the platform&apos;s support channels. We take your privacy seriously and will respond to all inquiries promptly.
              </p>
            </section>

            <section className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h2 className="text-lg font-semibold mb-2">Independent Platform</h2>
              <LegalDisclaimer />
            </section>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link href="/signup" className="text-gray-500 hover:text-gray-700 text-sm">
            ← Back to Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
