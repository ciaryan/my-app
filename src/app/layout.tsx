import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Ciarán Ryan — AI Engineer & Data Scientist',
  description:
    'AI Engineer and Data Scientist specialising in agentic workflows, LLMs, and AI for the public good.',
  openGraph: {
    title: 'Ciarán Ryan — AI Engineer & Data Scientist',
    description:
      'AI Engineer and Data Scientist specialising in agentic workflows, LLMs, and AI for the public good.',
    url: 'https://ciaryan.com',
    siteName: 'Ciarán Ryan',
    locale: 'en_GB',
    type: 'website',
  },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
