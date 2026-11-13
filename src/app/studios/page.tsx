import type { Metadata } from 'next';
import Studios from './Studios';

export const metadata: Metadata = {
  title: 'Studios — Ciarán Ryan',
  robots: { index: false, follow: false },
};

export default function StudiosPage() {
  return <Studios />;
}
