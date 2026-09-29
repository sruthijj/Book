'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, User as UserIcon, Menu, X, Plus } from 'lucide-react'
import { getMe, signOut } from '@/lib/actions/auth.actions'

const navItems = [
    { name: "Library", href: "/" },
    { name: "Add New", href: "/new" },
]

const Navbar = () => {
    const pathname = usePathname()
    const router = useRouter()
    const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null)
    const [loading, setLoading] = useState(true)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    useEffect(() => {
        let isMounted = true;
        getMe()
            .then((currentUser) => {
                if (isMounted) {
                    setUser(currentUser ? { id: currentUser.id, name: currentUser.name, email: currentUser.email } : null)
                    setLoading(false)
                }
            })
            .catch(() => {
                if (isMounted) setLoading(false)
            })

        return () => {
            isMounted = false;
        }
    }, [pathname])

    // Close mobile menu whenever pathname changes
    useEffect(() => {
        setMobileMenuOpen(false)
    }, [pathname])

    const handleSignOut = async () => {
        await signOut()
        setUser(null)
        setMobileMenuOpen(false)
        router.push('/')
        router.refresh()
    }

    return (
        <header className="w-full fixed top-0 left-0 right-0 z-50 bg-[#FFF9ED]/95 backdrop-blur-md border-b border-[#E9E1CC]/60 transition-all">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex justify-between items-center">
                
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
                    <Image
                        src="/assets/logo.png"
                        alt="Bookified"
                        width={34}
                        height={34}
                        className="rounded-full object-cover"
                        priority
                    />
                    <span className="font-serif text-xl sm:text-2xl font-bold text-[#1C1C1C] tracking-tight">
                        Bookified
                    </span>
                </Link>

                {/* Desktop Navigation */}
                <nav className="hidden md:flex items-center gap-7">
                    {navItems.map(({ name, href }) => {
                        const isActive =
                            pathname === href ||
                            (href !== '/' && pathname.startsWith(href))

                        return (
                            <Link
                                key={href}
                                href={href}
                                className={`text-sm font-semibold transition-colors ${
                                    isActive
                                        ? 'text-[#663820] font-bold border-b-2 border-[#663820] pb-0.5'
                                        : 'text-[#4A4A4A] hover:text-[#1C1C1C]'
                                }`}
                            >
                                {name}
                            </Link>
                        )
                    })}

                    {/* Auth Status (Desktop) */}
                    <div className="flex items-center gap-3 pl-2 border-l border-[#E9E1CC] min-h-[40px]">
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <div className="w-16 h-8 rounded-lg bg-[#E9E1CC]/40 animate-pulse" />
                                <div className="w-20 h-8 rounded-xl bg-[#663820]/20 animate-pulse" />
                            </div>
                        ) : user ? (
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F5F0E1] border border-[#E9E1CC] text-xs font-semibold text-[#1C1C1C] max-w-[180px]">
                                    <UserIcon className="w-3.5 h-3.5 text-[#663820] flex-shrink-0" />
                                    <span className="truncate">{user.name}</span>
                                </div>
                                <button
                                    onClick={handleSignOut}
                                    title="Sign Out"
                                    className="p-2 rounded-xl text-[#6B6B6B] hover:text-[#1C1C1C] hover:bg-[#F5F0E1] transition-colors cursor-pointer"
                                >
                                    <LogOut className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Link
                                    href="/sign-in"
                                    className="px-3.5 py-1.5 text-sm font-semibold text-[#1C1C1C] hover:text-[#663820] transition-colors"
                                >
                                    Sign In
                                </Link>
                                <Link
                                    href="/sign-up"
                                    className="px-4 py-2 rounded-xl bg-[#663820] hover:bg-[#4d2814] text-white text-sm font-semibold transition-all shadow-xs"
                                >
                                    Sign Up
                                </Link>
                            </div>
                        )}
                    </div>
                </nav>

                {/* Mobile Menu Toggle Button */}
                <div className="flex md:hidden items-center gap-2">
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="Toggle Menu"
                        className="p-2 rounded-xl text-[#1C1C1C] hover:bg-[#F5F0E1] transition-colors"
                    >
                        {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </div>

            {/* Mobile Dropdown Menu */}
            {mobileMenuOpen && (
                <div className="md:hidden border-b border-[#E9E1CC] bg-[#FFF9ED] px-4 pt-3 pb-6 space-y-4 shadow-lg animate-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-col space-y-2">
                        {navItems.map(({ name, href }) => {
                            const isActive =
                                pathname === href ||
                                (href !== '/' && pathname.startsWith(href))

                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    className={`px-3 py-2.5 rounded-xl text-base font-semibold transition-colors flex items-center justify-between ${
                                        isActive
                                            ? 'bg-[#F5F0E1] text-[#663820]'
                                            : 'text-[#4A4A4A] hover:bg-[#F5F0E1]/60'
                                    }`}
                                >
                                    <span>{name}</span>
                                    {href === '/new' && <Plus className="w-4 h-4 text-[#663820]" />}
                                </Link>
                            )
                        })}
                    </div>

                    <div className="pt-3 border-t border-[#E9E1CC]/80">
                        {user ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#F5F0E1] text-sm font-semibold text-[#1C1C1C]">
                                    <UserIcon className="w-4 h-4 text-[#663820]" />
                                    <span className="truncate">{user.name}</span>
                                </div>
                                <button
                                    onClick={handleSignOut}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 bg-red-50 text-sm font-medium hover:bg-red-100 transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <Link
                                    href="/sign-in"
                                    className="w-full text-center py-2.5 rounded-xl border border-[#E9E1CC] bg-white text-sm font-semibold text-[#1C1C1C] hover:bg-[#F5F0E1] transition-colors"
                                >
                                    Sign In
                                </Link>
                                <Link
                                    href="/sign-up"
                                    className="w-full text-center py-2.5 rounded-xl bg-[#663820] text-white text-sm font-semibold hover:bg-[#4d2814] transition-colors"
                                >
                                    Sign Up
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </header>
    )
}

export default Navbar