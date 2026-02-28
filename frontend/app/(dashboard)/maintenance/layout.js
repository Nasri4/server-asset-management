'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { label: 'Dashboard', href: '/maintenance' },
  { label: 'Schedules', href: '/maintenance/schedules' },
  { label: 'Create/Edit', href: '/maintenance/create' },
  { label: 'Calendar', href: '/maintenance/calendar' },
  { label: 'History', href: '/maintenance/history' },
];

export default function MaintenanceLayout({ children }) {
  const pathname = usePathname();

  return (
    <div className="space-y-4">
      <div className="tab-bar rounded-xl overflow-hidden">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== '/maintenance' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={`tab-item ${active ? 'tab-item-active' : ''}`}>
              {item.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
