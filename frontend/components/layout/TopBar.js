'use client';

import Link from 'next/link';
import { useAuth } from '../../lib/auth';
import api from '../../lib/api';
import { timeAgo, cn } from '../../lib/utils';
import { Settings, User, Bell, Search, ChevronDown, LogOut, Server, Package, UserCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

export default function TopBar() {
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchDebounceRef = useRef(null);
  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
        searchInputRef.current?.blur();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.get('/search', { params: { q: searchQuery.trim() } });
        setSearchResults(res.data);
        setSearchOpen(true);
      } catch {
        setSearchResults({ servers: [], applications: [], engineers: [], incidents: [] });
      } finally {
        setSearchLoading(false);
      }
    }, 280);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery]);

  useEffect(() => {
    if (!searchOpen) return;
    function handleClickOutside(e) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) setSearchOpen(false);
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [searchOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;
    setNotificationsLoading(true);
    api.get('/notifications', { params: { limit: 25 } })
      .then((res) => setNotifications(res.data?.notifications || []))
      .catch(() => setNotifications([]))
      .finally(() => setNotificationsLoading(false));
  }, [notificationsOpen]);

  const totalResults = searchResults
    ? (searchResults.servers?.length || 0) + (searchResults.applications?.length || 0) + (searchResults.engineers?.length || 0) + (searchResults.incidents?.length || 0)
    : 0;

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header
      className="flex-shrink-0 w-full"
      style={{
        backgroundColor: 'var(--topbar-bg)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <div className="flex items-center justify-between h-14 px-4 md:px-6 gap-4">
        {/* Brand */}
        <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0 font-bold text-lg tracking-tight" style={{ color: 'var(--primary)' }}>
          Server
          <span className="font-normal text-sm hidden sm:inline" style={{ color: 'var(--text-secondary)' }}>Asset Management</span>
        </Link>

        {/* Search */}
        <div className="flex-1 flex justify-center max-w-xl mx-auto" ref={searchContainerRef}>
          <div className="hidden md:flex items-center w-full relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults && totalResults > 0 && setSearchOpen(true)}
              placeholder="Search servers, applications, engineers..."
              className="input-field pl-9 pr-16"
              style={{ backgroundColor: 'var(--section-bg)', borderColor: 'var(--border)' }}
            />
            {searchLoading ? (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-muted)' }} />
              </div>
            ) : !searchQuery && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-0.5">
                <kbd className="kbd">Ctrl+K</kbd>
              </div>
            )}
            {searchOpen && searchQuery.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 dropdown-panel max-h-[70vh] overflow-y-auto scrollbar-thin animate-in">
                {totalResults === 0 && !searchLoading ? (
                  <div className="px-4 py-6 text-sm text-center" style={{ color: 'var(--text-secondary)' }}>No results for &quot;{searchQuery}&quot;</div>
                ) : (
                  <div className="py-1">
                    {searchResults?.servers?.length > 0 && (
                      <div className="px-2 py-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-1" style={{ color: 'var(--text-muted)' }}>Servers</p>
                        {searchResults.servers.map((s) => (
                          <Link key={s.server_id} href={`/servers/${s.server_id}`} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm hover:bg-[var(--primary-soft)] transition-colors" style={{ color: 'var(--text-primary)' }} onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>
                            <Server className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--primary)' }} />
                            <span className="font-medium font-mono text-xs">{s.server_code}</span>
                            {s.hostname && <span className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>{s.hostname}</span>}
                          </Link>
                        ))}
                      </div>
                    )}
                    {searchResults?.applications?.length > 0 && (
                      <div className="px-2 py-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-1" style={{ color: 'var(--text-muted)' }}>Applications</p>
                        {searchResults.applications.map((a) => (
                          <Link key={a.application_id} href={`/applications/${a.application_id}`} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm hover:bg-[var(--primary-soft)] transition-colors" style={{ color: 'var(--text-primary)' }} onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>
                            <Package className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--primary)' }} />
                            <span>{a.app_name}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                    {searchResults?.engineers?.length > 0 && (
                      <div className="px-2 py-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-1" style={{ color: 'var(--text-muted)' }}>Engineers</p>
                        {searchResults.engineers.map((e) => (
                          <Link key={e.engineer_id} href={`/engineers/${e.engineer_id}`} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm hover:bg-[var(--primary-soft)] transition-colors" style={{ color: 'var(--text-primary)' }} onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>
                            <UserCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--primary)' }} />
                            <span>{e.full_name}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                    {searchResults?.incidents?.length > 0 && (
                      <div className="px-2 py-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-1" style={{ color: 'var(--text-muted)' }}>Incidents</p>
                        {searchResults.incidents.map((i) => (
                          <Link key={i.incident_id} href={`/incidents?id=${i.incident_id}`} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm hover:bg-[var(--primary-soft)] transition-colors" style={{ color: 'var(--text-primary)' }} onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>
                            <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--primary)' }} />
                            <span className="truncate">{i.title}</span>
                            <span className="text-xs flex-shrink-0 badge-gray">{i.severity}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Notifications */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="btn-icon relative"
            >
              <Bell className="w-[18px] h-[18px]" />
              {(unreadCount > 0 || notifications.length > 0) && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-white" style={{ backgroundColor: 'var(--primary)' }} />
              )}
            </button>
            {notificationsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} aria-hidden />
                <div className="absolute right-0 top-full mt-1.5 w-80 dropdown-panel z-50 animate-in">
                  <div className="px-4 py-3 border-b" style={{ backgroundColor: 'var(--section-bg)', borderColor: 'var(--border)' }}>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Notifications</h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto scrollbar-thin">
                    {notificationsLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--primary)' }} />
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <Bell className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No recent activity</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className="px-4 py-3 hover:bg-[var(--primary-soft)] transition-colors border-b border-[var(--border)] last:border-0">
                          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{n.message}</p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{n.username} · {timeAgo(n.performed_at)}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="px-4 py-2.5 border-t" style={{ backgroundColor: 'var(--section-bg)', borderColor: 'var(--border)' }}>
                    <Link href="/audit-log" className="text-xs font-medium transition-colors hover:opacity-80" style={{ color: 'var(--primary)' }} onClick={() => setNotificationsOpen(false)}>View all activity</Link>
                  </div>
                </div>
              </>
            )}
          </div>

          <Link href="/admin" className="btn-icon" title="Settings">
            <Settings className="w-[18px] h-[18px]" />
          </Link>

          {/* Profile */}
          <div className="relative ml-1">
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 pl-2 pr-2 py-1.5 rounded-lg hover:bg-[var(--primary-soft)] transition-all duration-150"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-semibold text-sm" style={{ backgroundColor: 'var(--primary)' }}>
                {user?.full_name?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <span className="hidden md:inline text-sm font-medium max-w-[120px] truncate" style={{ color: 'var(--text-primary)' }}>
                {user?.full_name || user?.username}
              </span>
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', profileOpen && 'rotate-180')} style={{ color: 'var(--text-muted)' }} />
            </button>
            {profileOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} aria-hidden />
                <div className="absolute right-0 top-full mt-1.5 w-56 dropdown-panel z-50 animate-in">
                  <div className="px-4 py-3 border-b" style={{ backgroundColor: 'var(--section-bg)', borderColor: 'var(--border)' }}>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user?.full_name || user?.username}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{user?.role || user?.role_name || 'User'}</p>
                  </div>
                  <div className="py-1">
                    <Link href="/dashboard" className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-[var(--primary-soft)] transition-colors" style={{ color: 'var(--text-primary)' }} onClick={() => setProfileOpen(false)}>
                      <User className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      Dashboard
                    </Link>
                    <Link href="/admin" className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-[var(--primary-soft)] transition-colors" style={{ color: 'var(--text-primary)' }} onClick={() => setProfileOpen(false)}>
                      <Settings className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      Settings
                    </Link>
                  </div>
                  <div className="divider" />
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => { setProfileOpen(false); logout(); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-[var(--danger-soft)] transition-colors"
                      style={{ color: 'var(--danger)' }}
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
