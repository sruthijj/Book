'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserPlus, ArrowRight, Mail, Lock, User, AlertCircle } from 'lucide-react';
import { signUp } from '@/lib/actions/auth.actions';

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signUp({ name, email, password });
      if (!res.success) {
        setError(res.error || 'Failed to create account');
      } else {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-80px)] pt-24 sm:pt-28 pb-12 sm:pb-16 flex items-center justify-center px-4">
      <div className="w-full max-w-md sm:max-w-lg bg-white rounded-2xl sm:rounded-[32px] p-5 sm:p-8 md:p-12 border border-[#E9E1CC] shadow-sm">
        
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#F5F0E1] text-[#663820] flex items-center justify-center mx-auto mb-3.5 border border-[#E9E1CC]">
            <UserPlus className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1C1C1C] tracking-tight mb-1.5">
            Join Bookified
          </h1>
          <p className="text-[#6B6B6B] text-xs sm:text-sm">
            Create an account to start conversing with your favorite books
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-2.5 sm:gap-3">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold block mb-0.5">Notice</span>
              {error}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <div>
            <label className="text-xs sm:text-sm font-semibold text-[#1C1C1C] mb-1.5 block" htmlFor="name">
              Full Name
            </label>
            <div className="relative">
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Austen"
                className="w-full h-11 sm:h-12 pl-10 sm:pl-11 pr-4 bg-[#FFF9ED]/40 border border-[#E9E1CC] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#663820]/20 focus:border-[#663820] transition-all"
              />
              <User className="w-4 h-4 text-[#A89F8F] absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-semibold text-[#1C1C1C] mb-1.5 block" htmlFor="email">
              Email Address
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full h-11 sm:h-12 pl-10 sm:pl-11 pr-4 bg-[#FFF9ED]/40 border border-[#E9E1CC] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#663820]/20 focus:border-[#663820] transition-all"
              />
              <Mail className="w-4 h-4 text-[#A89F8F] absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-semibold text-[#1C1C1C] mb-1.5 block" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full h-11 sm:h-12 pl-10 sm:pl-11 pr-4 bg-[#FFF9ED]/40 border border-[#E9E1CC] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#663820]/20 focus:border-[#663820] transition-all"
              />
              <Lock className="w-4 h-4 text-[#A89F8F] absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 sm:h-14 bg-[#663820] hover:bg-[#4d2814] text-white text-sm sm:text-base font-semibold font-serif rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-3"
          >
            {loading ? (
              <span>Creating account...</span>
            ) : (
              <>
                <span>Create Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-[#E9E1CC]/50 text-center">
          <p className="text-sm text-[#6B6B6B]">
            Already have an account?{' '}
            <Link
              href="/sign-in"
              className="font-bold text-[#663820] hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
