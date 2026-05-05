import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { ErrorBoundary } from '../ui/ErrorBoundary';

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header onMenuToggle={() => {}} isMobileMenuOpen={false} />
      
      <main className="overflow-y-auto">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}

// Made with Bob
