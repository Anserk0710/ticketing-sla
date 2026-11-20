import { Link, NavLink, Outlet } from 'react-router-dom';
import { ShieldCheck, FilePlus2, House, SearchCode } from 'lucide-react';

const navigation = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/complaint', label: 'Buat Keluhan', icon: FilePlus2 },
  { to: '/track', label: 'Lacak Ticket', icon: SearchCode }
];

export function PublicLayout() {
  return (
    /* Page background: #ffffff (white) */
    <div className="flex min-h-screen flex-col bg-transparent text-charcoal-950">
      {/* Header: white bg, border #e1e5f2 */}
      <header className="sticky top-0 z-30 border-b border-white/40 bg-lavender-grey-200/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:py-4 md:px-6 lg:px-8">
          {/* Logo: icon uses #1f7a8c teal, text is navy #022b3a */}
          <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-85 sm:gap-3">
            <span className="neo-soft rounded-xl p-2 sm:rounded-2xl sm:p-2.5">
              <ShieldCheck className="h-4 w-4 text-alice-blue-600 sm:h-5 sm:w-5" />
            </span>
            <div>
              <strong className="block text-sm font-bold tracking-tight text-charcoal-950 sm:text-base">Ticketing SLA</strong>
              <span className="hidden text-xs font-medium text-lavender-grey-600 sm:block">Field Service Operations</span>
            </div>
          </Link>

          {/* Nav links: hidden on mobile (replaced by bottom nav), visible sm+ */}
          <nav aria-label="Navigasi utama" className="hidden items-center gap-1 text-sm font-medium sm:flex">
            {navigation.map(({ to, label, end }) => <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `focus-ring rounded-xl px-2.5 py-2.5 transition-all duration-150 md:px-3.5 ${
                  isActive
                    ? 'bg-alice-blue-600 font-semibold text-white hover:text-white shadow-[4px_4px_10px_rgba(2,43,58,0.16),-3px_-3px_8px_rgba(255,255,255,0.55)]'
                    : 'text-charcoal-700 hover:bg-lavender-grey-200 hover:text-charcoal-950'
                }`
              }
            >
              {label}
            </NavLink>)}
          </nav>
        </div>
      </header>

      {/* Main content */}
      {/* pb-20 on mobile to clear the bottom nav */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 sm:pb-6 md:px-6 md:py-10 lg:px-8">
        <Outlet />
      </main>

      {/* Footer: hidden on mobile (bottom nav takes the role), visible sm+ */}
      <footer className="hidden border-t border-white/50 bg-lavender-grey-200/60 py-8 text-center text-xs font-medium text-charcoal-600 backdrop-blur-sm sm:mt-8 sm:block">
        <p>Waktu operasional ditampilkan dalam WITA. Data lokasi dan media dilindungi untuk penggunaan internal.</p>
      </footer>

      {/* Bottom Navigation — mobile only (hidden sm+) */}
      <nav aria-label="Navigasi utama ponsel" className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/40 bg-lavender-grey-200/90 backdrop-blur-xl sm:hidden">
        <div className="mx-auto flex max-w-sm items-center justify-around px-2 py-2">
          {navigation.map(({ to, label, icon: Icon, end }) => <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `focus-ring flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-semibold transition-all duration-150 ${
                isActive
                  ? 'bg-alice-blue-600 text-white hover:text-white shadow-[4px_4px_10px_rgba(2,43,58,0.2),-3px_-3px_8px_rgba(255,255,255,0.5)]'
                  : 'text-charcoal-500'
              }`
            }
          >
            <Icon aria-hidden="true" className="h-5 w-5" />
            <span className="text-inherit">{label}</span>
          </NavLink>)}
        </div>

        {/* Safe area spacer for iOS notch */}
        <div className="h-safe-area-inset-bottom" />
      </nav>
    </div>
  );
}
