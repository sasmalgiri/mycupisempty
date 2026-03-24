import Link from 'next/link';
import type { Metadata } from 'next';
import { blogPosts } from '@/data/blog-posts';

export const metadata: Metadata = {
  title: 'Blog — Education Insights & Platform Updates',
  description: 'Articles on adaptive learning, teaching methods, Indian education reform, and how AI can personalize learning for every student. By the MyCupIsEmpty team.',
  openGraph: {
    title: 'MyCupIsEmpty Blog — Education Insights',
    description: 'Articles on adaptive learning, teaching methods, and Indian education reform.',
  },
};

const categoryColors: Record<string, string> = {
  education: 'bg-blue-100 text-blue-700',
  features: 'bg-purple-100 text-purple-700',
  impact: 'bg-green-100 text-green-700',
  teaching: 'bg-orange-100 text-orange-700',
  technology: 'bg-cyan-100 text-cyan-700',
};

export default function BlogPage() {
  const sortedPosts = [...blogPosts].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50 to-secondary-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-primary-500/30">
                🧠
              </div>
              <span className="font-bold text-xl gradient-text">MyCupIsEmpty</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/about" className="text-gray-600 hover:text-gray-900 font-medium text-sm">About</Link>
              <Link href="/login" className="text-gray-600 hover:text-gray-900 font-medium text-sm">Login</Link>
              <Link href="/signup" className="btn-primary text-sm px-4 py-2">Start Free</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">Education Insights</span>
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Thoughts on teaching, learning, and building the future of Indian education.
            How every child can learn — in their own way.
          </p>
        </div>

        {/* Featured Post */}
        {sortedPosts[0] && (
          <Link
            href={`/blog/${sortedPosts[0].slug}`}
            className="block mb-12 group"
          >
            <article className="bg-white rounded-3xl shadow-lg hover:shadow-xl transition-all overflow-hidden border border-gray-100">
              <div className="p-8 md:p-12">
                <div className="flex items-center gap-3 mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${categoryColors[sortedPosts[0].category] || 'bg-gray-100 text-gray-700'}`}>
                    {sortedPosts[0].category.charAt(0).toUpperCase() + sortedPosts[0].category.slice(1)}
                  </span>
                  <span className="text-gray-400 text-sm">{sortedPosts[0].readTime} min read</span>
                  <span className="text-gray-400 text-sm">
                    {new Date(sortedPosts[0].date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-start gap-6">
                  <div className="hidden md:flex w-24 h-24 bg-gradient-to-br from-primary-100 to-secondary-100 rounded-2xl items-center justify-center text-5xl shrink-0">
                    {sortedPosts[0].coverEmoji}
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 group-hover:text-primary-600 transition-colors mb-3">
                      {sortedPosts[0].title}
                    </h2>
                    <p className="text-gray-600 text-lg leading-relaxed">
                      {sortedPosts[0].description}
                    </p>
                    <span className="inline-block mt-4 text-primary-600 font-semibold group-hover:underline">
                      Read more →
                    </span>
                  </div>
                </div>
              </div>
            </article>
          </Link>
        )}

        {/* Post Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {sortedPosts.slice(1).map(post => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group"
            >
              <article className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-all p-6 h-full border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{post.coverEmoji}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${categoryColors[post.category] || 'bg-gray-100 text-gray-700'}`}>
                    {post.category.charAt(0).toUpperCase() + post.category.slice(1)}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary-600 transition-colors mb-2 line-clamp-2">
                  {post.title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-4 line-clamp-3">
                  {post.description}
                </p>
                <div className="flex items-center justify-between text-sm text-gray-400">
                  <span>{new Date(post.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <span>{post.readTime} min read</span>
                </div>
              </article>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 text-center bg-gradient-to-r from-primary-500 to-secondary-500 rounded-3xl p-8 md:p-12 text-white">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to Learn Your Way?</h2>
          <p className="text-white/80 text-lg mb-6 max-w-xl mx-auto">
            Join thousands of students learning with AI-powered personalization. Free forever.
          </p>
          <Link href="/signup" className="inline-block bg-white text-primary-600 font-bold px-8 py-4 rounded-xl hover:bg-gray-100 transition-all">
            Start Learning Free →
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} MyCupIsEmpty. Every student can learn — in their own way.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link href="/terms" className="hover:text-gray-700">Terms</Link>
            <Link href="/privacy" className="hover:text-gray-700">Privacy</Link>
            <Link href="/about" className="hover:text-gray-700">About</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
