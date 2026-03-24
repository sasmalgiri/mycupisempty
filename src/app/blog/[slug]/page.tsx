import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { blogPosts, getBlogPost, getAllBlogSlugs } from '@/data/blog-posts';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllBlogSlugs().map(slug => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return { title: 'Post Not Found' };

  return {
    title: post.title,
    description: post.description,
    keywords: post.tags,
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  // Find related posts (same category, excluding current)
  const relatedPosts = blogPosts
    .filter(p => p.category === post.category && p.slug !== post.slug)
    .slice(0, 2);

  // JSON-LD for blog post
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: {
      '@type': 'Organization',
      name: post.author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'MyCupIsEmpty',
    },
    keywords: post.tags.join(', '),
    articleSection: post.category,
    wordCount: post.content.replace(/<[^>]*>/g, '').split(/\s+/).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50 to-secondary-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-primary-500/30">
                🧠
              </div>
              <span className="font-bold text-xl gradient-text">MyCupIsEmpty</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/blog" className="text-gray-600 hover:text-gray-900 font-medium text-sm">Blog</Link>
              <Link href="/signup" className="btn-primary text-sm px-4 py-2">Start Free</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <nav className="mb-8 text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-700">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/blog" className="hover:text-gray-700">Blog</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">{post.title.slice(0, 40)}...</span>
        </nav>

        <article>
          {/* Post Header */}
          <header className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">{post.coverEmoji}</span>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full font-semibold text-xs">
                  {post.category.charAt(0).toUpperCase() + post.category.slice(1)}
                </span>
                <time dateTime={post.date}>
                  {new Date(post.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </time>
                <span>·</span>
                <span>{post.readTime} min read</span>
              </div>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-4">
              {post.title}
            </h1>

            <p className="text-lg text-gray-600 leading-relaxed">
              {post.description}
            </p>

            <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-200">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-secondary-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                M
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{post.author}</p>
                <p className="text-gray-500 text-xs">Building the future of Indian education</p>
              </div>
            </div>
          </header>

          {/* Post Content */}
          <div
            className="prose prose-lg prose-gray max-w-none
              prose-headings:text-gray-900 prose-headings:font-bold
              prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
              prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
              prose-p:text-gray-600 prose-p:leading-relaxed
              prose-li:text-gray-600
              prose-strong:text-gray-900
              prose-a:text-primary-600 prose-a:no-underline hover:prose-a:underline"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Tags */}
          <div className="mt-10 pt-8 border-t border-gray-200">
            <div className="flex flex-wrap gap-2">
              {post.tags.map(tag => (
                <span key={tag} className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm">
                  #{tag.replace(/\s+/g, '')}
                </span>
              ))}
            </div>
          </div>
        </article>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <section className="mt-16">
            <h2 className="text-2xl font-bold mb-6">Related Articles</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {relatedPosts.map(related => (
                <Link
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  className="group bg-white rounded-2xl shadow-md hover:shadow-lg transition-all p-6 border border-gray-100"
                >
                  <span className="text-2xl">{related.coverEmoji}</span>
                  <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary-600 transition-colors mt-2 mb-2 line-clamp-2">
                    {related.title}
                  </h3>
                  <p className="text-gray-500 text-sm line-clamp-2">{related.description}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="mt-16 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-3xl p-8 md:p-12 text-white text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Experience Personalized Learning</h2>
          <p className="text-white/80 text-lg mb-6 max-w-xl mx-auto">
            See how AI adapts to your unique learning style. Free for all students.
          </p>
          <Link href="/signup" className="inline-block bg-white text-primary-600 font-bold px-8 py-4 rounded-xl hover:bg-gray-100 transition-all">
            Start Learning Free →
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} MyCupIsEmpty. Every student can learn — in their own way.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link href="/blog" className="hover:text-gray-700">Blog</Link>
            <Link href="/terms" className="hover:text-gray-700">Terms</Link>
            <Link href="/privacy" className="hover:text-gray-700">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
