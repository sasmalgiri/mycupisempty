import Link from 'next/link';

export const metadata = {
  title: 'About | MyCupIsEmpty',
  description: 'Learn about MyCupIsEmpty - the AI-powered adaptive learning platform for NCERT curriculum',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50 to-secondary-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-primary-500/30">
                🧠
              </div>
              <span className="font-bold text-xl gradient-text">MyCupIsEmpty</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/" className="text-gray-600 hover:text-gray-900 font-medium">
                Home
              </Link>
              <Link href="/about" className="text-primary-600 font-semibold">
                About
              </Link>
              <Link href="/login" className="btn-secondary text-sm">
                Log In
              </Link>
              <Link href="/signup" className="btn-primary text-sm">
                Get Started Free
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-16 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-6">
            About <span className="gradient-text">MyCupIsEmpty</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            We believe every student deserves personalized education that adapts to their unique learning style.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-extrabold mb-6">Our Mission</h2>
              <p className="text-gray-600 mb-4">
                MyCupIsEmpty was born from a simple observation: every student learns differently.
                Some visualize concepts, others prefer hands-on activities, and many learn best
                through reading or listening.
              </p>
              <p className="text-gray-600 mb-4">
                Traditional education often follows a one-size-fits-all approach. We are here to change that.
                Using AI and scientifically-proven learning methods, we create personalized learning
                experiences for every student.
              </p>
              <p className="text-gray-600">
                Our platform covers the complete NCERT curriculum from Classes 1-12, ensuring every
                Indian student has access to quality, adaptive education.
              </p>
            </div>
            <div className="bg-gradient-to-br from-primary-100 to-secondary-100 rounded-3xl p-8">
              <div className="text-6xl text-center mb-6">🎓</div>
              <h3 className="text-xl font-bold text-center mb-4">The Name</h3>
              <p className="text-gray-600 text-center">
                &quot;My cup is empty&quot; comes from the Zen Buddhist concept of approaching learning
                with an open mind - like an empty cup ready to be filled with knowledge.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Learning Methods */}
      <section className="py-16 bg-gradient-to-br from-primary-50 to-secondary-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold text-center mb-12">
            Our Scientific Approach
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: '📊',
                title: 'VARK Learning Styles',
                description: 'We assess whether you are a Visual, Auditory, Reading, or Kinesthetic learner and adapt content accordingly.',
              },
              {
                icon: '🧠',
                title: 'Multiple Intelligences',
                description: 'Based on Howard Gardner\'s theory, we recognize and develop all 8 types of intelligence in every student.',
              },
              {
                icon: '🔺',
                title: 'Bloom\'s Taxonomy',
                description: 'Questions progress through 6 cognitive levels - from remembering to creating - ensuring deep understanding.',
              },
              {
                icon: '🔄',
                title: 'Spaced Repetition',
                description: 'Our flashcard system uses scientifically-optimized intervals for maximum long-term retention.',
              },
              {
                icon: '🎮',
                title: 'Gamification',
                description: 'XP points, streaks, achievements, and levels make learning engaging and motivating.',
              },
              {
                icon: '🤖',
                title: 'AI Tutoring',
                description: 'Our AI tutor explains concepts in your preferred learning style, available 24/7 for doubt clearing.',
              },
            ].map((method) => (
              <div key={method.title} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow">
                <div className="text-4xl mb-4">{method.icon}</div>
                <h3 className="text-xl font-bold mb-2">{method.title}</h3>
                <p className="text-gray-600">{method.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Built for India Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-extrabold mb-6">Built for Indian Students</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            MyCupIsEmpty is designed specifically for the NCERT curriculum, supporting
            both English and Hindi languages, making quality education accessible to all.
          </p>
          <div className="flex justify-center gap-8 flex-wrap">
            <div className="text-center">
              <div className="text-4xl font-extrabold gradient-text">12</div>
              <div className="text-gray-500">Classes Covered</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-extrabold gradient-text">15+</div>
              <div className="text-gray-500">Subjects</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-extrabold gradient-text">100%</div>
              <div className="text-gray-500">NCERT Aligned</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-extrabold gradient-text">24/7</div>
              <div className="text-gray-500">AI Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-r from-primary-600 to-secondary-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-extrabold mb-4">Ready to Start Learning?</h2>
          <p className="text-xl opacity-90 mb-8">
            Discover your learning style and begin your personalized education journey.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-white text-primary-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors shadow-xl"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">
            Made with love for Indian students.
          </p>
        </div>
      </footer>
    </div>
  );
}
