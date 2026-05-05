import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Menu, X } from 'lucide-react';
import { AccountSelector } from '../ui/AccountSelector';

interface HeaderProps {
  onMenuToggle?: () => void;
  isMobileMenuOpen?: boolean;
}

export function Header({ onMenuToggle, isMobileMenuOpen }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <button
              onClick={onMenuToggle}
              className="lg:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
            <Link to="/" className="flex items-center ml-2 lg:ml-0">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-semibold text-gray-900">
                IBM Cloud Cost Tracker
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-8">
            <Link
              to="/"
              className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/reports/generate"
              className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
            >
              Generate Report
            </Link>
            <Link
              to="/reports"
              className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
            >
              Reports
            </Link>
            <Link
              to="/user-spending"
              className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
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
