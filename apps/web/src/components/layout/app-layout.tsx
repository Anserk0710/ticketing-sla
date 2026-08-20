import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  ClipboardList,
  FileSpreadsheet,
  Gauge,
  LogOut,
  Menu,
  Settings,
  UserCheck,
  Wrench,
  X,
} from 'lucide-react';
import { useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
} from 'react-router-dom';
import { apiRequest } from '../../api/http-client';
import { useAuth } from '../../features/auth/auth-context';
import type { UnreadNotificationCount } from '../../types/api';
import { Badge } from '../ui/badge';

const links = [
  {
    to: '/app/dashboard',
    label: 'Dashboard',
    icon: Gauge,
    permission: 'report.read',
  },
  {
    to: '/app/tickets',
    label: 'Tickets',
    icon: ClipboardList,
    permission: 'ticket.read.assigned',
  },
  {
    to: '/app/assignments',
    label: 'My Assignments',
    icon: Wrench,
    permission: 'ticket.read.assigned',
    technicianOnly: true,
  },
  {
    to: '/app/approvals',
    label: 'Approval Teknisi',
    icon: UserCheck,
    permission: 'technician.approve',
  },
  {
    to: '/app/reports',
    label: 'Reports',
    icon: FileSpreadsheet,
    permission: 'report.read',
  },
  {
    to: '/app/settings',
    label: 'Master Data',
    icon: Settings,
    permission: 'catalog.read',
  },
];

export function AppLayout() {
  const {
    session,
    logout,
    hasPermission,
  } = useAuth();

  const [open, setOpen] =
    useState(false);

  /*
   * Phase 9:
   *
   * Gunakan COUNT endpoint.
   *
   * Sebelumnya frontend mengambil list unread
   * maksimum 100 records hanya untuk mendapatkan
   * jumlah badge.
   */
  const notifications =
    useQuery({
      queryKey: [
        'notifications',
        'unread-count',
      ],

      queryFn: () =>
        apiRequest<UnreadNotificationCount>(
          '/notifications/unread-count',
        ),

      refetchInterval:
        30_000,
    });

  const unreadCount =
    notifications.data?.count ??
    0;

  const isTechnician =
    session?.user.roles.includes(
      'TECHNICIAN',
    );

  const visible =
    links.filter(
      (item) =>
        hasPermission(
          item.permission,
        ) &&
        (
          !item.technicianOnly ||
          isTechnician
        ),
    );

  return (
    <div className="min-h-screen bg-white text-charcoal-950">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-powder-blue-800 bg-powder-blue-950 text-white transition-transform lg:translate-x-0 ${open
            ? 'translate-x-0'
            : '-translate-x-full'
          }`}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
          <Link
            to="/app/dashboard"
            className="flex items-center gap-3"
          >
            <span className="rounded-lg bg-alice-blue-600 p-2 shadow-md shadow-alice-blue-600/30">
              <Gauge className="h-4 w-4 text-white" />
            </span>

            <div>
              <strong className="block text-base font-bold tracking-tight text-white">
                Ticketing SLA
              </strong>

              <span className="block text-[11px] font-medium text-alice-blue-300">
                Operations Console
              </span>
            </div>
          </Link>

          <button
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() =>
              setOpen(false)
            }
            aria-label="Tutup Menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="space-y-1 p-4">
          {visible.map(
            (item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() =>
                  setOpen(false)
                }
                className={({
                  isActive,
                }) =>
                  `flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-all ${isActive
                    ? 'bg-alice-blue-600 font-semibold text-white shadow-md shadow-alice-blue-600/30'
                    : 'text-white/65 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />

                {item.label}
              </NavLink>
            ),
          )}
        </nav>

        <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
          <p className="text-sm font-semibold text-white">
            {
              session?.user
                .displayName
            }
          </p>

          <p className="mt-0.5 truncate text-xs text-alice-blue-300">
            {
              session?.user
                .email
            }
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {session?.user.roles.map(
              (role) => (
                <Badge
                  key={role}
                  value={role}
                  variant="dark"
                  className="px-2 py-0.5 text-[10px] font-semibold"
                />
              ),
            )}
          </div>
        </div>
      </aside>

      {open && (
        <button
          aria-label="Tutup menu"
          className="fixed inset-0 z-30 bg-powder-blue-950/50 backdrop-blur-sm lg:hidden"
          onClick={() =>
            setOpen(false)
          }
        />
      )}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-lavender-grey-200 bg-white/90 px-4 backdrop-blur-md md:px-8">
          <div className="flex items-center gap-3">
            <button
              className="rounded-xl border border-lavender-grey-200 p-2 text-charcoal-700 hover:bg-lavender-grey-200 hover:text-charcoal-950 lg:hidden"
              onClick={() =>
                setOpen(true)
              }
              aria-label="Buka Menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-alice-blue-600">
                Operational Workspace
              </p>

              <p className="text-sm font-semibold text-charcoal-950">
                SLA Respond &amp; SLA Pengerjaan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/app/notifications"
              className="relative rounded-xl p-2.5 text-charcoal-600 transition-colors hover:bg-lavender-grey-200 hover:text-charcoal-950"
              title="Notifikasi"
              aria-label={
                `Notifikasi${unreadCount > 0
                  ? `, ${unreadCount} belum dibaca`
                  : ''
                }`
              }
            >
              <Bell className="h-5 w-5" />

              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm">
                  {
                    unreadCount > 99
                      ? '99+'
                      : unreadCount
                  }
                </span>
              )}
            </Link>

            <button
              onClick={() =>
                void logout()
              }
              className="rounded-xl p-2.5 text-charcoal-600 transition-colors hover:bg-rose-50 hover:text-rose-600"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}