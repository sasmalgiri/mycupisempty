import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50 to-secondary-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-primary-500/30">
                🧠
              </div>
              <span className="font-bold text-xl gradient-text">MyCupIsEmpty</span>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/subjects" className="text-gray-600 hover:text-gray-900 font-medium">
                Subjects
              </Link>
              <Link href="/about" className="text-gray-600 hover:text-gray-900 font-medium">
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
      <section className="pt-20 pb-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 rounded-full text-primary-700 font-semibold text-sm mb-8 animate-fade-in">
            <span>🎯</span>
            <span>15+ Scientific Learning Methods</span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold mb-6 animate-fade-in">
            Learn <span className="gradient-text">Your Way</span>
            <br />
            with AI-Powered Education
          </h1>
          
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-10 animate-fade-in">
            Complete NCERT curriculum for Classes 1-12. Personalized learning paths 
            based on your unique learning style. Practice with adaptive questions 
            and get instant help from our AI tutor.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in">
            <Link href="/signup" className="btn-primary text-lg px-8 py-4">
              Start Learning Free →
            </Link>
            <Link href="/demo" className="btn-secondary text-lg px-8 py-4">
              Watch Demo
            </Link>
          </div>

          {/* Learning Style Icons */}
          <div className="flex justify-center gap-6 mb-16">
            {[
              { icon: '👁️', name: 'Visual', color: 'bg-blue-100 text-blue-600' },
              { icon: '👂', name: 'Auditory', color: 'bg-green-100 text-green-600' },
              { icon: '📖', name: 'Reading', color: 'bg-yellow-100 text-yellow-600' },
              { icon: '🖐️', name: 'Kinesthetic', color: 'bg-red-100 text-red-600' },
            ].map((style) => (
              <div key={style.name} className="text-center animate-float">
                <div className={`w-16 h-16 ${style.color} rounded-2xl flex items-center justify-center text-2xl mb-2 shadow-lg`}>
                  {style.icon}
                </div>
                <span className="text-sm font-medium text-gray-600">{style.name}</span>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {[
              { value: '12', label: 'Classes (1-12)' },
              { value: '15+', label: 'Subjects' },
              { value: '10K+', label: 'Questions' },
              { value: '100%', label: 'NCERT Aligned' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl font-extrabold gradient-text mb-1">{stat.value}</div>
                <div className="text-gray-500 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold mb-4">
              How <span className="gradient-text">MyCupIsEmpty</span> Works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              We adapt to your unique learning style using scientifically-proven methods
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: '🎯',
                title: 'Take Assessment',
                description: 'Complete our quick VARK assessment to discover your learning style - Visual, Auditory, Reading, or Kinesthetic.',
              },
              {
                icon: '🧠',
                title: 'Personalized Learning',
                description: 'Get content adapted to your style. Visual learners see diagrams, kinesthetic learners get hands-on activities.',
              },
              {
                icon: '🤖',
                title: 'AI Tutor Support',
                description: 'Ask questions anytime. Our AI tutor explains concepts in your preferred learning style.',
              },
            ].map((feature) => (
              <div key={feature.title} className="bg-gray-50 rounded-3xl p-8 card-hover">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Learning Methods Section */}
      <section className="py-24 bg-gradient-to-br from-primary-50 to-secondary-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold mb-4">
              15+ <span className="gradient-text">Learning Methods</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              We combine the best educational theories for maximum learning effectiveness
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { icon: '📊', name: 'VARK Learning Styles' },
              { icon: '🧠', name: 'Multiple Intelligences' },
              { icon: '🔺', name: "Bloom's Taxonomy" },
              { icon: '🔄', name: "Kolb's Learning Cycle" },
              { icon: '📅', name: 'Spaced Repetition' },
              { icon: '🎮', name: 'Gamification' },
              { icon: '📖', name: 'Story-Based Learning' },
              { icon: '🔧', name: 'Project-Based' },
              { icon: '❓', name: 'Inquiry-Based' },
              { icon: '✅', name: 'Mastery Learning' },
            ].map((method) => (
              <div key={method.name} className="bg-white rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition-shadow">
                <div className="text-2xl mb-2">{method.icon}</div>
                <div className="text-sm font-semibold text-gray-700">{method.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Subjects Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold mb-4">
              Complete <span className="gradient-text">NCERT Curriculum</span>
            </h2>
            <p className="text-xl text-gray-600">
              All subjects from Class 1 to Class 12
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { icon: '📐', name: 'Mathematics', color: 'from-indigo-400 to-indigo-600' },
              { icon: '🔬', name: 'Science', color: 'from-purple-400 to-purple-600' },
              { icon: '📖', name: 'English', color: 'from-pink-400 to-pink-600' },
              { icon: '📝', name: 'Hindi', color: 'from-orange-400 to-orange-600' },
              { icon: '🌍', name: 'Social Science', color: 'from-teal-400 to-teal-600' },
              { icon: '💻', name: 'Computer Science', color: 'from-cyan-400 to-cyan-600' },
              { icon: '⚡', name: 'Physics', color: 'from-blue-400 to-blue-600' },
              { icon: '🧪', name: 'Chemistry', color: 'from-red-400 to-red-600' },
              { icon: '🧬', name: 'Biology', color: 'from-green-400 to-green-600' },
              { icon: '📈', name: 'Economics', color: 'from-emerald-400 to-emerald-600' },
              { icon: '🏛️', name: 'Political Science', color: 'from-violet-400 to-violet-600' },
              { icon: '📜', name: 'History', color: 'from-amber-400 to-amber-600' },
            ].map((subject) => (
              <div key={subject.name} className="group cursor-pointer">
                <div className={`bg-gradient-to-br ${subject.color} rounded-2xl p-6 text-white text-center transform group-hover:scale-105 transition-transform shadow-lg`}>
                  <div className="text-3xl mb-2">{subject.icon}</div>
                  <div className="font-semibold text-sm">{subject.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-primary-600 to-secondary-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-extrabold mb-6">
            Ready to Start Learning Your Way?
          </h2>
          <p className="text-xl opacity-90 mb-10">
            Join thousands of students who are learning more effectively with personalized education
          </p>
          <Link href="/signup" className="inline-block bg-white text-primary-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors shadow-xl">
            Get Started Free →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center text-xl">
                  🧠
                </div>
                <span className="font-bold text-xl">MyCupIsEmpty</span>
              </div>
              <p className="text-gray-400">
                AI-powered adaptive learning for every student.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Classes</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Primary (1-5)</li>
                <li>Middle (6-8)</li>
                <li>Secondary (9-10)</li>
                <li>Senior Secondary (11-12)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Resources</h4>
              <ul className="space-y-2 text-gray-400">
                <li>NCERT Textbooks</li>
                <li>Practice Questions</li>
                <li>AI Tutor</li>
                <li>Study Materials</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Help Center</li>
                <li>Contact Us</li>
                <li>Privacy Policy</li>
                <li>Terms of Service</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-gray-500">
            <p>© 2024 MyCupIsEmpty. All rights reserved. Content sourced from NCERT (ncert.nic.in).</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
