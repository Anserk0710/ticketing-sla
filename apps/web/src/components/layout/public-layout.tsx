import { Link, NavLink, Outlet } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

export function PublicLayout() {
  return (
    /* Page background: #ffffff (white) */
    <div className="min-h-screen bg-white text-charcoal-950">
      {/* Header: white bg, border #e1e5f2 */}
      <header className="sticky top-0 z-30 border-b border-lavender-grey-200 bg-white/90 backdrop-blur-md shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          {/* Logo: icon uses #1f7a8c teal, text is navy #022b3a */}
          <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-85">
            <span className="rounded-xl bg-alice-blue-600 p-2.5 shadow-md shadow-alice-blue-600/20">
              <ShieldCheck className="h-5 w-5 text-white" />
            </span>
            <div>
              <strong className="block text-base font-bold tracking-tight text-charcoal-950">Ticketing SLA</strong>
              <span className="block text-xs font-medium text-lavender-grey-600">Field Service Operations</span>
            </div>
          </Link>

          {/* Nav links: muted text, active uses teal #1f7a8c, hover uses #e1e5f2 bg */}
          <div className="flex items-center gap-1 text-sm font-medium">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `rounded-xl px-3.5 py-2 transition-all ${
                  isActive
                    ? 'bg-alice-blue-600 text-white font-semibold shadow-sm'
                    : 'text-charcoal-700 hover:bg-lavender-grey-200 hover:text-charcoal-950'
                }`
              }
            >
              Buat Keluhan
            </NavLink>
            <NavLink
              to="/track"
              className={({ isActive }) =>
                `rounded-xl px-3.5 py-2 transition-all ${
                  isActive
                    ? 'bg-alice-blue-600 text-white font-semibold shadow-sm'
                    : 'text-charcoal-700 hover:bg-lavender-grey-200 hover:text-charcoal-950'
                }`
              }
            >
              Lacak Ticket
            </NavLink>
          </div>
        </div>
      </header>

      {/* Main content: white background */}
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
        <Outlet />
      </main>

      {/* Footer: border #e1e5f2, muted text */}
      <footer className="border-t border-lavender-grey-200 bg-white py-8 text-center text-xs font-medium text-lavender-grey-600">
        <p>Waktu operasional ditampilkan dalam WITA. Data lokasi dan media dilindungi untuk penggunaan internal.</p>
      </footer>
    </div>
  );
}
