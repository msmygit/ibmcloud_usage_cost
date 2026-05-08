import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  Users,
  Layers,
  Package,
  TrendingUp,
} from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const navItems: NavItem[] = [
  {
    name: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    description: 'Overview and summary',
  },
  {
    name: 'Active Resources',
    path: '/active-resources',
    icon: Package,
    description: 'Resources by creator',
  },
  {
    name: 'Generate Report',
    path: '/reports/generate',
    icon: PlusCircle,
    description: 'Create new report',
  },
  {
    name: 'Reports',
    path: '/reports',
    icon: FileText,
    description: 'View all reports',
  },
  {
    name: 'User Spending',
    path: '/user-spending',
    icon: Users,
    description: 'User cost analysis',
  },
  {
    name: 'Resource Groups',
    path: '/resource-groups',
    icon: Layers,
    description: 'Cost by resource group',
  },
];

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-foreground bg-opacity-75 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 bg-background border-r border-border transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full pt-20 lg:pt-5">
          {/* Navigation */}
          <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={clsx(
                    'flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors group',
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-foreground hover:bg-muted hover:text-foreground'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon
                    className={clsx(
                      'mr-3 h-5 w-5 flex-shrink-0',
                      active
                        ? 'text-blue-600'
                        : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    <div
                      className={clsx(
                        'text-xs mt-0.5',
                        active ? 'text-blue-600' : 'text-muted-foreground'
                      )}
                    >
                      {item.description}
                    </div>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-4 w-4 mr-2 text-green-500" />
              <span>System Status: Operational</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

// Made with Bob
