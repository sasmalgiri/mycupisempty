import type { Metadata } from 'next';
import { Nunito, Crimson_Pro, JetBrains_Mono } from 'next/font/google';
import '@/styles/globals.css';
import BuddyAssistant from '@/components/BuddyAssistant';

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
  description: 'Personalized education for CBSE, ICSE, West Bengal Board (WBBSE) & State Boards. Class 1-12 with 20+ teaching methods. AI Guru adapts to your VARK learning style. Free for students.',
  keywords: ['NCERT learning app', 'CBSE online tutor', 'ICSE study platform', 'West Bengal Board WBBSE', 'WBBSE learning app', 'state board education', 'AI tutor India', 'adaptive learning', 'Vedic Math', 'Gurukul method', 'VARK learning style', 'Class 1-12 education', 'personalized learning', 'free education app India', 'Feynman technique', 'spaced repetition', 'interactive learning games'],
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
    description: 'Learn CBSE, ICSE, WBBSE & State Board curriculum with AI that adapts to YOUR learning style. 20+ teaching methods. Free for Class 1-12.',
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
    description: 'Personalized NCERT education for Class 1-12. AI Guru with 20+ teaching methods adapts to your learning style.',
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
  description: 'AI-powered adaptive learning platform for Indian students. NCERT curriculum with 20+ teaching methods personalized to each student\'s learning style.',
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
    educationalFramework: 'CBSE/ICSE/WBBSE/State Boards',
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
      </body>
    </html>
  );
}
