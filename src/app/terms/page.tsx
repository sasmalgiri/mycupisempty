import Link from 'next/link';

export default function TermsPage() {
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
          <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
          <p className="text-gray-500 text-sm mb-8">Last updated: March 2026</p>

          <div className="prose prose-gray max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
              <p className="text-gray-600 leading-relaxed">
                By accessing and using MyCupIsEmpty, you accept and agree to be bound by these Terms of Service. This platform is designed for educational purposes, helping students learn through personalized AI-powered tutoring aligned with the NCERT curriculum.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. User Accounts</h2>
              <p className="text-gray-600 leading-relaxed">
                You are responsible for maintaining the confidentiality of your account credentials. Students under 18 should have parental consent before creating an account. You agree to provide accurate information during registration.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Acceptable Use</h2>
              <p className="text-gray-600 leading-relaxed">
                You agree to use the platform solely for educational purposes. You shall not misuse the AI tutor, attempt to extract harmful content, or use the platform in any way that could harm other users or the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Content & Intellectual Property</h2>
              <p className="text-gray-600 leading-relaxed">
                All explanations and learning content on this platform are AI-generated and original. Our curriculum structure is aligned with the NCERT/CBSE framework for educational reference only. NCERT, CBSE, and ICSE are trademarks of their respective organizations — MyCupIsEmpty is not affiliated with or endorsed by them. AI-generated content is provided as a supplementary learning aid and should not replace formal education or official textbooks.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Privacy</h2>
              <p className="text-gray-600 leading-relaxed">
                Your privacy is important to us. Please review our{' '}
                <Link href="/privacy" className="text-primary-600 hover:underline">Privacy Policy</Link>{' '}
                to understand how we collect, use, and protect your data.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Disclaimer</h2>
              <p className="text-gray-600 leading-relaxed">
                MyCupIsEmpty is an educational tool and is provided &quot;as is&quot;. While we strive for accuracy, AI-generated content may occasionally contain errors. We encourage students to verify information with their teachers and textbooks.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Contact</h2>
              <p className="text-gray-600 leading-relaxed">
                For questions about these terms, please reach out to us through the platform&apos;s support channels.
              </p>
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
