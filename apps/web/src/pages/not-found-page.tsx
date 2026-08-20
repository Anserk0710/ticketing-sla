import { Link } from 'react-router-dom';
export function NotFoundPage() { return <div className="flex min-h-[60vh] flex-col items-center justify-center text-center"><p className="text-7xl font-black text-iron-grey-200">404</p><h1 className="mt-4 text-2xl font-bold">Halaman tidak ditemukan</h1><Link className="mt-5 font-semibold text-alice-blue-600" to="/">Kembali ke halaman utama</Link></div>; }
