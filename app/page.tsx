'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) router.replace('/dashboard');
    else router.replace('/login');
  }, []);
  return null;
}
