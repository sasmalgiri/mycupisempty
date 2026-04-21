import type { Metadata } from 'next';
import { Nunito, Crimson_Pro, JetBrains_Mono } from 'next/font/google';
import '@/styles/globals.css';
import BuddyAssistant from '@/components/BuddyAssistant';
import PWAInstaller from '@/components/PWAInstaller';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://mycupisempty.com';

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
});

const crimsonPro = Crimson_Pro({
  subsets: ['latin'],
  variable: '--font-crimson',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'MyCupIsEmpty - AI-Powered Adaptive Learning Platform for Indian Students',
    template: '%s | MyCupIsEmpty',
  },
  description: 'Personalised, adaptive learning for Indian school students (Class 1–12). Covers general educational concepts aligned with publicly available CBSE / ICSE / WBBSE / State Board syllabi. Independent platform — not affiliated with any board.',
  keywords: ['Indian school learning app', 'adaptive learning', 'Class 1-12 education', 'personalised learning', 'Vedic Math', 'Gurukul method', 'VARK learning style', 'AI tutor India', 'Feynman technique', 'spaced repetition', 'interactive learning games', 'general educational content', 'independent education platform'],
  authors: [{ name: 'MyCupIsEmpty', url: BASE_URL }],
  creator: 'MyCupIsEmpty',
  publisher: 'MyCupIsEmpty',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'MyCupIsEmpty - AI-Powered Adaptive Learning for Indian Students',
    description: 'Adaptive learning for Indian school students — general educational concepts aligned with publicly available school syllabi. Independent platform; not affiliated with any board.',
    url: BASE_URL,
    siteName: 'MyCupIsEmpty',
    type: 'website',
    locale: 'en_IN',
    images: [
      {
        url: '/assets/og-image.png',
        width: 1200,
        height: 630,
        alt: 'MyCupIsEmpty - AI-Powered Adaptive Learning Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MyCupIsEmpty - AI-Powered Adaptive Learning',
    description: 'Personalised learning for Class 1–12. Covers general educational concepts from publicly available school syllabi. Independent; not affiliated with any board.',
    images: ['/assets/og-image.png'],
  },
  alternates: {
    canonical: BASE_URL,
  },
  category: 'education',
};

// JSON-LD structured data for Google
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'MyCupIsEmpty',
  description: 'AI-powered adaptive learning for Indian students. General educational content aligned with publicly available school syllabi. Independent platform — not affiliated with any education board.',
  url: BASE_URL,
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'INR',
  },
  audience: {
    '@type': 'EducationalAudience',
    educationalRole: 'student',
    suggestedMinAge: 6,
    suggestedMaxAge: 18,
  },
  educationalAlignment: {
    '@type': 'AlignmentObject',
    alignmentType: 'educationalFramework',
    educationalFramework: 'Publicly available Indian school syllabi (aligned to standard Class 1-12 curriculum frameworks)',
    targetName: 'Class 1-12 Multi-Board Curriculum',
  },
  featureList: [
    'AI-powered personalized tutoring',
    'VARK learning style assessment',
    '20+ teaching methods (Feynman, Gurukul, Socratic, Vedic Math)',
    'Spaced repetition flashcards',
    'Interactive learning games',
    'Character and habit building',
    'Teacher dashboard and analytics',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${nunito.variable} ${crimsonPro.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans antialiased">
        {children}
        <BuddyAssistant />
        <PWAInstaller />
      </body>
    </html>
  );
}
