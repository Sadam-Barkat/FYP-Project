import { redirect } from 'next/navigation';

export default function Home() {
  // For this hospital dashboard, always start at the secure login page.
  redirect('/login');
  return null;
}

