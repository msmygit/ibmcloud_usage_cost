import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Menu, X } from 'lucide-react';
import { AccountSelector } from '../ui/AccountSelector';
import { ThemeToggle } from '../ui/ThemeToggle';

interface HeaderProps {
  onMenuToggle?: () => void;
  isMobileMenuOpen?: boolean;
}

export function Header({ onMenuToggle, isMobileMenuOpen }: HeaderProps) {
  return (
    <header className="bg-background border-b border-border sticky top-0 z-50">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onMenuToggle}
              className="lg:hidden p-2 rounded-md text-foreground hover:text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
            <ThemeToggle />
            <Link to="/" className="flex items-center">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-semibold text-foreground">
                IBM Cloud Cost Tracker
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-8">
            <Link
              to="/"
              className="text-foreground hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/reports/generate"
              className="text-foreground hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
            >
              Generate Report
            </Link>
            <Link
              to="/reports"
              className="text-foreground hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
            >
              Reports
            </Link>
            <Link
              to="/user-spending"
              className="text-foreground hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
            >
              User Spending
            </Link>
          </nav>

          {/* Account Selector */}
          <div className="flex items-center">
            <div className="hidden sm:block">
              <AccountSelector />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

// Made with Bob
