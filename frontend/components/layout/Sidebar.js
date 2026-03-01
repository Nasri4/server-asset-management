'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard, Server, MapPin, Shield,
  AppWindow, Wrench, AlertTriangle, Building2, BarChart3,
  FileText, Settings, ChevronDown, Menu, X, LogOut,
  UserCircle, PanelLeftClose, PanelLeft, Eye, Layers,
  Cpu, Globe, CalendarCheck, Monitor, Router, PackageCheck,
  Network, Users,
} from 'lucide-react';

import Hlogo from '../../app/Hlogo.png';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  {
    label: 'Servers & VMs', icon: Server, children: [
      { label: 'Overview', href: '/servers', icon: Eye },
      { label: 'Hardware', href: '/hardware', icon: Cpu },
      { label: 'Network', href: '/network', icon: Globe },
      { label: 'Security', href: '/security', icon: Shield },
      { label: 'Applications', href: '/applications', icon: AppWindow },
    ],
  },
  { label: 'Workstations / PCs', href: '/workstations', icon: Monitor },
  { label: 'Network Devices', href: '/network-devices', icon: Router },
  { label: 'Software & Licenses', href: '/software', icon: PackageCheck },
  {
    label: 'Locations & Sites', icon: MapPin, children: [
      { label: 'Locations', href: '/locations', icon: MapPin },
      { label: 'Racks & Cabinets', href: '/racks', icon: Layers },
    ],
  },
  { label: 'IPAM', href: '/ipam', icon: Network },
  { label: 'Maintenance', href: '/maintenance', icon: Wrench },
  { label: 'Incidents / Tickets', href: '/incidents', icon: AlertTriangle },
  { label: 'Visits & Access', href: '/visits', icon: CalendarCheck },
  { label: 'Employees / Users', href: '/employees', icon: Users },
  { label: 'Engineers', href: '/engineers', icon: UserCircle },
  { label: 'Departments / Teams', href: '/departments', icon: Building2 },
  { label: 'Reports & Analytics', href: '/reports', icon: BarChart3 },
  { label: 'Audit Logs', href: '/audit-logs', icon: FileText, permission: 'audit.read' },
  { label: 'Administration', href: '/admin', icon: Settings, roles: ['Admin'] },
];

const navSections = [
  { title: 'Overview', items: ['Dashboard'] },
  { title: 'Asset Inventory', items: ['Servers & VMs', 'Workstations / PCs', 'Network Devices', 'Software & Licenses'] },
  { title: 'Datacenter & Infra', items: ['Locations & Sites', 'IPAM'] },
  { title: 'Operations & Service', items: ['Maintenance', 'Incidents / Tickets', 'Visits & Access'] },
  { title: 'Organization', items: ['Employees / Users', 'Engineers', 'Departments / Teams'] },
  { title: 'System & Security', items: ['Reports & Analytics', 'Audit Logs', 'Administration'] },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState({});

  const pathname = usePathname();
  const { user, logout, hasPermission, hasRole } = useAuth();

  useEffect(() => {
    const next = {};
    navItems.forEach(item => { if (item.children) next[item.label] = false; });
    navItems.forEach(item => {
      if (item.children?.some(c => pathname.startsWith(c.href))) next[item.label] = true;
    });
    setExpanded(next);
  }, [pathname]);

  function toggleExpand(label) {
    setExpanded(prev => ({ ...prev, [label]: !prev[label] }));
  }

  function isActive(href) {
    if (href === '/') return pathname === '/' || pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  function canView(item) {
    if (item.roles && !item.roles.some(r => hasRole(r))) return false;
    if (item.permission && !hasPermission(item.permission)) return false;
    return true;
  }

  function ChildItem({ child }) {
    const active = isActive(child.href);
    const Icon = child.icon;
    return (
      <Link
        href={child.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          'flex items-center gap-2.5 ml-9 mr-1.5 py-1.5 pl-3 pr-2 rounded-lg text-[12.5px] transition-all duration-200',
          active
            ? 'text-white font-semibold'
            : 'text-[var(--sidebar-text)] hover:bg-white/5 hover:text-white'
        )}
        style={active ? { background: 'rgba(23,164,247,0.15)' } : {}}
      >
        {Icon && (
          <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', active ? 'text-[var(--sidebar-active-border)]' : 'opacity-40')} />
        )}
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
              'group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-200',
              childActive
                ? 'text-white font-semibold'
                : 'text-[var(--sidebar-text)] hover:bg-white/5 hover:text-white'
            )}
            style={childActive ? { background: 'rgba(23,164,247,0.15)' } : {}}
          >
            <Icon className={cn('w-[18px] h-[18px] flex-shrink-0 transition-colors duration-200', childActive ? 'text-[var(--sidebar-active-border)]' : 'opacity-40 group-hover:opacity-70')} />
            {!collapsed && (
              <>
                <span className="flex-1 text-left truncate">{item.label}</span>
                <ChevronDown className={cn('w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 opacity-30', isExp ? 'rotate-0' : '-rotate-90')} />
              </>
            )}
            {collapsed && <span className="sidebar-tooltip group-hover:opacity-100">{item.label}</span>}
          </button>

          {!collapsed && (
            <div
              className="overflow-hidden transition-[max-height] duration-250 ease-out"
              style={{ maxHeight: isExp ? 44 * item.children.length : 0 }}
            >
              <div className="mt-0.5 pb-1 space-y-0.5 relative">
                {/* Connector line */}
                <div
                  className="absolute left-[22px] top-0 bottom-2 w-px"
                  style={{ background: 'linear-gradient(to bottom, var(--sidebar-divider), transparent)' }}
                />
                {item.children.map((child) => (
                  <ChildItem key={child.href} child={child} />
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
          'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-200',
          active
            ? 'text-white font-semibold'
            : 'text-[var(--sidebar-text)] hover:bg-white/5 hover:text-white'
        )}
        style={active ? { background: 'rgba(23,164,247,0.15)' } : {}}
      >
        <Icon className={cn('w-[18px] h-[18px] flex-shrink-0 transition-colors duration-200', active ? 'text-[var(--sidebar-active-border)]' : 'opacity-40 group-hover:opacity-70')} />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        {collapsed && <span className="sidebar-tooltip group-hover:opacity-100">{item.label}</span>}
      </Link>
    );
  }

  const sidebarContent = (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--sidebar-bg)' }}>

      {/* Logo */}
      <div className="flex-shrink-0">
        <Link
          href="/"
          className={cn(
            'flex items-center h-[70px] px-4 transition-all duration-200 hover:opacity-90',
            collapsed ? 'justify-center' : 'justify-start'
          )}
        >
          <Image
            src={Hlogo}
            alt="TELCO"
            className={cn('w-auto object-contain transition-all duration-200', collapsed ? 'h-12' : 'h-14')}
            priority
          />
        </Link>
        {/* Gradient divider */}
        <div className="mx-4 h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--sidebar-divider), transparent)' }} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-dark py-3 px-2 min-h-0">
        {navSections.map((section) => {
          const sectionItems = navItems.filter(i => section.items.includes(i.label) && canView(i));
          if (sectionItems.length === 0) return null;
          return (
            <div key={section.title} className="mb-5">
              {!collapsed && (
                <div className="px-3 mb-1.5">
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.18em]"
                    style={{ color: 'var(--sidebar-section-text)', opacity: 0.5 }}
                  >
                    {section.title}
                  </span>
                </div>
              )}
              {collapsed && (
                <div className="flex justify-center mb-2">
                  <div className="w-4 h-px" style={{ background: 'var(--sidebar-divider)' }} />
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
      <div className="flex-shrink-0">
        <div className="mx-4 h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--sidebar-divider), transparent)' }} />
        <div className="p-3">
          <div
            className="rounded-2xl p-3"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {!collapsed ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #0B8FDE 100%)', color: 'white' }}
                  >
                    {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-white truncate leading-tight">{user?.full_name}</div>
                    <div className="text-[11px] truncate mt-0.5" style={{ color: 'var(--sidebar-text-muted)' }}>{user?.role_name || user?.role}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="w-full flex items-center justify-center gap-2 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 hover:bg-white/10 hover:text-white"
                  style={{ color: 'var(--sidebar-text)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center justify-center p-2 rounded-xl transition-all duration-200 hover:bg-white/10 hover:text-white"
                style={{ color: 'var(--sidebar-text-muted)' }}
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
          {!collapsed && (
            <div className="text-center pt-2 pb-0.5">
              <span className="text-[10px]" style={{ color: 'var(--sidebar-text-muted)', opacity: 0.5 }}>v3.0 · Enterprise</span>
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
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl border shadow-lg text-white transition-colors"
        style={{ backgroundColor: 'var(--sidebar-bg)', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
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

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-[88px] w-6 h-6 flex items-center justify-center rounded-full bg-white transition-all duration-200 hover:scale-110 hover:text-[var(--primary)] z-10"
          style={{ border: '1.5px solid var(--border)', color: 'var(--text-muted)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <PanelLeft className="w-3 h-3" /> : <PanelLeftClose className="w-3 h-3" />}
        </button>
      </aside>
    </>
  );
}
