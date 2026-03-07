'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
    SignInButton,
    UserButton,
    useUser
} from '@clerk/nextjs'

const navItems = [
    { name: "Library", href: "/" },
    { name: "Add New", href: "/new" },
]

const Navbar = () => {

    const pathname = usePathname()
    const { user } = useUser()

    return (
        <header className="w-full fixed top-0 z-50 bg-[var(--bg-primary)]">

            <div className="wrapper navbar-height py-4 flex justify-between items-center">

                {/* Logo */}
                <Link href="/" className="flex gap-0.5 items-center">
                    <Image
                        src="/assets/logo.png"
                        alt="Bookified"
                        width={42}
                        height={26}
                        className="rounded-full"
                    />
                    <span className="logo-text">Bookified</span>
                </Link>

                {/* Navigation */}
                <nav className="w-fit flex gap-7 items-center">

                    {navItems.map(({ name, href }) => {

                        const isActive =
                            pathname === href ||
                            (href !== '/' && pathname.startsWith(href))

                        return (
                            <Link
                                key={href}
                                href={href}
                                className={`nav-link-base ${isActive
                                    ? 'nav-link-active'
                                    : 'text-black hover:opacity-70'
                                    }`}
                            >
                                {name}
                            </Link>
                        )
                    })}

                    {/* Signed Out */}
                    {!user && (
                        <SignInButton mode="modal">
                            <button className="px-4 py-2 rounded-lg bg-black text-white hover:bg-black/90 transition-all font-medium">
                                Sign In
                            </button>
                        </SignInButton>
                    )}

                    {/* Signed In */}
                    {user && (
                        <div className="flex gap-3 items-center">
                            <div className="nav-user-link">
                                <UserButton />
                            </div>

                            {user?.firstName && (
                                <Link
                                    href="/subscriptions"
                                    className="nav-user-name"
                                >
                                    {user.firstName}
                                </Link>
                            )}
                        </div>
                    )}

                </nav>

            </div>

        </header>
    )
}

export default Navbar