import { Outfit } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
});


export const metadata = {
  title: 'ResumeRewire — From rejected to hired',
  description:
    'Paste your LinkedIn profile or upload your old resume. Get an ATS-friendly, recruiter-ready resume in 2 minutes. Completely free.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={outfit.variable}>
      <body>{children}</body>
    </html>
  );
}
