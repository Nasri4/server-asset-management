'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard, Server, MapPin, Activity, Shield,
  AppWindow, Wrench, AlertTriangle, Building2, BarChart3,
  FileText, Settings, ChevronDown, Menu, X, LogOut,
  UserCircle, PanelLeftClose, PanelLeft, Eye, Gauge, Layers,
  Cpu, Globe, CalendarCheck,
} from 'lucide-react';

import Hlogo from '../../app/Hlogo.png';

// Navigation items remain unchanged
const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  {
    label: 'Servers', icon: Server, children: [
      { label: 'Overview', href: '/servers', icon: Eye },
      { label: 'Hardware', href: '/hardware', icon: Cpu },
      { label: 'Network', href: '/network', icon: Globe },
      { label: 'Security', href: '/security', icon: Shield },
      { label: 'Applications', href: '/applications', icon: AppWindow },
    ],
  },
  {
    label: 'Locations & Racks', icon: MapPin, children: [
      { label: 'Locations', href: '/locations', icon: MapPin },
      { label: 'Racks', href: '/racks', icon: Layers },
    ],
  },
  {
    label: 'Operations', icon: Activity, children: [
      { label: 'Monitoring', href: '/monitoring', icon: Gauge },
      { label: 'Maintenance', href: '/maintenance', icon: Wrench },
      { label: 'Incidents', href: '/incidents', icon: AlertTriangle },
      { label: 'Visits', href: '/visits', icon: CalendarCheck },
    ],
  },
  { label: 'Engineers', href: '/engineers', icon: UserCircle },
  { label: 'Teams / Departments', href: '/teams', icon: Building2 },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Audit Logs', href: '/audit-log', icon: FileText, permission: 'audit.read' },
  { label: 'Administration', href: '/admin', icon: Settings, roles: ['Admin'] },
];

const navSections = [
  { title: 'Overview', items: ['Dashboard'] },
  { title: 'Infrastructure', items: ['Servers', 'Locations & Racks'] },
  { title: 'Operations', items: ['Operations'] },
  { title: 'Organization', items: ['Engineers', 'Teams / Departments'] },
  { title: 'System', items: ['Reports', 'Audit Logs', 'Administration'] },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState({});

  const pathname = usePathname();
  const { user, logout, hasPermission, hasRole } = useAuth();

  // Auto-expand/collapse based on active page
  useEffect(() => {
    const next = {};
    
    // Close all sections first
    navItems.forEach(item => {
      if (item.children) {
        next[item.label] = false;
      }
    });
    
    // Then open only the section that contains the current page
    navItems.forEach(item => {
      if (item.children?.some(c => pathname.startsWith(c.href))) {
        next[item.label] = true;
      }
    });
    
    setExpanded(next);
  }, [pathname]); // Run whenever pathname changes

  function toggleExpand(label) {
    setExpanded(prev => ({ ...prev, [label]: !prev[label] }));
  }

  function isActive(href) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  function canView(item) {
    if (item.roles && !item.roles.some(r => hasRole(r))) return false;
    if (item.permission && !hasPermission(item.permission)) return false;
    return true;
  }

  function ChildItem({ child, isLast }) {
    const active = isActive(child.href);
    const Icon = child.icon;
    return (
      <Link
        href={child.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          'flex items-center gap-2.5 ml-8 mr-2 py-2 pl-3 pr-2 rounded-lg text-[13px] transition-all duration-150',
          active
            ? 'bg-[var(--sidebar-active)] text-white font-medium'
            : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-white'
        )}
      >
        {Icon && <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', active ? 'text-[var(--sidebar-active-border)]' : 'opacity-50')} />}
        <span className="truncate">{child.label}</span>
      </Link>
    );
  }

  function NavItem({ item }) {
    if (!canView(item)) return null;
    const Icon = item.icon;
    const hasChildren = item.children?.length > 0;
    const isExp = expanded[item.label];
    const active = item.href ? isActive(item.href) : false;
    const childActive = hasChildren && item.children?.some(c => isActive(c.href));

    if (hasChildren) {
      return (
        <div>
          <button
            type="button"
            onClick={() => toggleExpand(item.label)}
            className={cn(
              'group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-all duration-150',
              childActive
                ? 'bg-[var(--sidebar-active)] text-white font-medium'
                : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-white'
            )}
          >
            {childActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[var(--sidebar-active-border)]" />
            )}
            <Icon className={cn('w-[18px] h-[18px] flex-shrink-0', childActive ? 'text-[var(--sidebar-active-border)]' : 'opacity-50 group-hover:opacity-80')} />
            {!collapsed && (
              <>
                <span className="flex-1 text-left truncate">{item.label}</span>
                <ChevronDown className={cn('w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 opacity-40', isExp ? 'rotate-0' : '-rotate-90')} />
              </>
            )}
            {collapsed && <span className="sidebar-tooltip group-hover:opacity-100">{item.label}</span>}
          </button>
          {!collapsed && (
            <div
              className="overflow-hidden transition-[max-height] duration-200 ease-out"
              style={{ maxHeight: isExp ? 48 * item.children.length : 0 }}
            >
              <div className="mt-0.5 space-y-0.5 pb-1">
                {item.children.map((child, idx) => (
                  <ChildItem key={child.href} child={child} isLast={idx === item.children.length - 1} />
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-all duration-150',
          active
            ? 'bg-[var(--sidebar-active)] text-white font-medium'
            : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-white'
        )}
      >
        {active && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[var(--sidebar-active-border)]" />
        )}
        <Icon className={cn('w-[18px] h-[18px] flex-shrink-0', active ? 'text-[var(--sidebar-active-border)]' : 'opacity-50 group-hover:opacity-80')} />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        {collapsed && <span className="sidebar-tooltip group-hover:opacity-100">{item.label}</span>}
      </Link>
    );
  }

  const sidebarContent = (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--sidebar-bg)' }}>
      {/* Logo */}
      <div className="flex-shrink-0">
        <Link href="/dashboard" className={cn(
          'flex items-center h-16 px-4 transition-all duration-200 hover:opacity-90',
          collapsed ? 'justify-center' : 'justify-start gap-3'
        )}>
          <Image 
            src={Hlogo} 
            alt="TELCO" 
            className={cn(
              'w-auto object-contain transition-all duration-200',
              collapsed ? 'h-10' : 'h-11'
            )} 
            priority 
          />
        </Link>
        <div className="mx-3 h-px" style={{ background: 'var(--sidebar-divider)' }} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-dark py-3 px-2.5 min-h-0">
        {navSections.map((section) => {
          const sectionItems = navItems.filter(i => section.items.includes(i.label) && canView(i));
          if (sectionItems.length === 0) return null;
          return (
            <div key={section.title} className="mb-4">
              {!collapsed && (
                <div className="px-3 mb-2 pt-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--sidebar-section-text)' }}>
                    {section.title}
                  </span>
                </div>
              )}
              {collapsed && (
                <div className="flex justify-center mb-2">
                  <div className="w-5 h-px" style={{ background: 'var(--sidebar-divider)' }} />
                </div>
              )}
              <div className="space-y-0.5">
                {sectionItems.map(item => (
                  <NavItem key={item.label} item={item} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User panel */}
      <div className="mt-auto flex-shrink-0">
        <div className="mx-3 h-px" style={{ background: 'var(--sidebar-divider)' }} />
        <div className="p-2.5">
          <div className="rounded-xl p-2.5" style={{ background: 'var(--sidebar-surface)', border: '1px solid var(--sidebar-divider)' }}>
            {!collapsed ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5 px-1.5 py-1">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold flex-shrink-0" style={{ background: 'var(--primary)', color: 'white' }}>
                    {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{user?.full_name}</div>
                    <div className="text-xs truncate" style={{ color: 'var(--sidebar-text-muted)' }}>{user?.role_name || user?.role}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all duration-150 hover:bg-[var(--sidebar-hover)] hover:text-white"
                  style={{ color: 'var(--sidebar-text)', border: '1px solid var(--sidebar-divider)' }}
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center justify-center p-2.5 rounded-lg transition-all hover:bg-[var(--sidebar-hover)] hover:text-white"
                style={{ color: 'var(--sidebar-text-muted)' }}
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
          {!collapsed && (
            <div className="text-center pt-2 pb-1">
              <span className="text-[10px]" style={{ color: 'var(--sidebar-text-muted)' }}>v3.0 · Enterprise</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-lg border shadow-lg text-white"
        style={{ backgroundColor: 'var(--sidebar-bg)', borderColor: 'var(--sidebar-divider)' }}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-[#272F3B]/60 backdrop-blur-sm transition-opacity" onClick={() => setMobileOpen(false)} aria-hidden />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-50 w-[260px] transition-transform duration-300 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col relative transition-[width] duration-200 ease-out',
          collapsed ? 'w-[72px]' : 'w-[240px]'
        )}
      >
        {sidebarContent}
        {/* Collapse button */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-28 w-6 h-6 flex items-center justify-center rounded-full border bg-white hover:text-[var(--primary)] hover:border-[var(--primary)] transition-colors z-10"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', boxShadow: 'var(--shadow-sm)' }}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <PanelLeft className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
        </button>
      </aside>
    </>
  );
}