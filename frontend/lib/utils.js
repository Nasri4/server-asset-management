import { clsx } from 'clsx';
import { format, formatDistanceToNow } from 'date-fns';

export function cn(...inputs) {
  return clsx(inputs);
}

export function formatDate(date) {
  if (!date) return '—';
  return format(new Date(date), 'MMM dd, yyyy');
}

export function formatDateTime(date) {
  if (!date) return '—';
  return format(new Date(date), 'MMM dd, yyyy HH:mm');
}

export function timeAgo(date) {
  if (!date) return '—';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function getStatusColor(status) {
  const map = {
    Active: 'badge-green',
    Inactive: 'badge-gray',
    'Under Maintenance': 'badge-yellow',
    Decommissioned: 'badge-red',
    Open: 'badge-red',
    Investigating: 'badge-yellow',
    Resolved: 'badge-green',
    Closed: 'badge-gray',
    Scheduled: 'badge-blue',
    Pending: 'badge-yellow',
    Completed: 'badge-green',
    Overdue: 'badge-red',
    Critical: 'badge-red',
    High: 'badge-yellow',
    Medium: 'badge-blue',
    Low: 'badge-gray',
    Healthy: 'badge-green',
    Warning: 'badge-yellow',
    Unhealthy: 'badge-red',
    Unknown: 'badge-gray',
    Hardened: 'badge-green',
    'Partially Hardened': 'badge-yellow',
    'Not Hardened': 'badge-red',
  };
  return map[status] || 'badge-gray';
}

export function getSeverityColor(severity) {
  const map = {
    Critical: 'bg-[var(--danger)]',
    High: 'bg-[var(--warning)]',
    Medium: 'bg-[var(--info)]',
    Low: 'bg-[var(--primary)]',
  };
  return map[severity] || 'bg-[var(--text-muted)]';
}
