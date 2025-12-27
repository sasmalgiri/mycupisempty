import type { Metadata } from 'next';
import { Nunito, Crimson_Pro, JetBrains_Mono } from 'next/font/google';
import '@/styles/globals.css';

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
  title: 'MyCupIsEmpty - AI-Powered Adaptive Learning Platform',
  description: 'Personalized NCERT education using 15+ scientific learning methods. Every student can learn - in their own way.',
  keywords: ['NCERT', 'education', 'learning', 'AI tutor', 'adaptive learning', 'CBSE', 'Class 1-12'],
  authors: [{ name: 'MyCupIsEmpty' }],
  openGraph: {
    title: 'MyCupIsEmpty - AI-Powered Adaptive Learning',
    description: 'Learn NCERT curriculum with AI-powered personalization based on your unique learning style.',
    type: 'website',
    locale: 'en_IN',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${nunito.variable} ${crimsonPro.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
