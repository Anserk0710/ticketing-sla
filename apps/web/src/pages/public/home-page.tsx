import { ArrowRight, ChartNoAxesCombined, ClipboardList, Clock3, FilePlus2, QrCode, SearchCode, ShieldCheck, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/card';

const features = [
  { icon: FilePlus2, title: 'Pengaduan lebih mudah', description: 'Laporkan kendala di lokasi Anda dan sertakan foto atau video untuk membantu tim memahami masalah.' },
  { icon: Wrench, title: 'Penanganan terkoordinasi', description: 'Keluhan dicatat sebagai tiket dan ditugaskan kepada teknisi untuk ditindaklanjuti di lapangan.' },
  { icon: Clock3, title: 'Pemantauan SLA', description: 'Waktu respons dan pengerjaan dipantau sesuai target layanan untuk membantu tim menjaga kualitas penanganan.' },
  { icon: ChartNoAxesCombined, title: 'Progres terdokumentasi', description: 'Riwayat status, bukti pengerjaan, dan laporan membantu tim mengevaluasi setiap layanan.' }
];

const steps = [
  { title: 'Sampaikan keluhan', description: 'Pindai QR lokasi atau buka formulir keluhan. Lengkapi data kontak, lokasi, dan detail kendala.' },
  { title: 'Tim menindaklanjuti', description: 'Tim mengatur penugasan teknisi, kemudian mencatat proses penanganan hingga pekerjaan selesai.' },
  { title: 'Pantau perkembangannya', description: 'Simpan kode tiket Anda. Gunakan kode tersebut dan nomor kontak pelapor untuk melacak status keluhan.' }
];

export function HomePage() {
  return (
    <div className="space-y-12 sm:space-y-16">
      <section aria-labelledby="home-title" className="grid items-center gap-10 py-4 sm:py-8 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-alice-blue-200 bg-alice-blue-50 px-3 py-1.5 text-xs font-semibold text-alice-blue-700">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            Ticketing & Field Service
          </span>
          <h1 id="home-title" className="mt-5 text-4xl font-black tracking-tight text-charcoal-950 sm:text-5xl lg:text-6xl">
            Layanan terkelola.<br />
            <span className="text-alice-blue-600">Keluhan terpantau.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-charcoal-700 sm:text-lg">
            Ticketing SLA menghubungkan pelapor dan tim layanan dalam satu sistem. Mulai dari pengaduan, penugasan teknisi, hingga pemantauan waktu respons dan penyelesaian pekerjaan.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/complaint" className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-alice-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-alice-blue-700 hover:text-white">
              Buat Keluhan <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            <Link to="/track" className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-white bg-white/70 px-6 py-3.5 text-sm font-semibold text-charcoal-950 hover:bg-white">
              <SearchCode aria-hidden="true" className="h-4 w-4" /> Lacak Ticket
            </Link>
          </div>
          <p className="mt-4 text-sm text-lavender-grey-600">Buat dan lacak keluhan tanpa perlu akun internal.</p>
        </div>

        <aside aria-labelledby="service-title" className="rounded-3xl bg-charcoal-950 p-6 shadow-xl sm:p-8">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-3 text-powder-blue-200"><ClipboardList aria-hidden="true" className="h-6 w-6" /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-powder-blue-200">Satu alur layanan</p>
              <h2 id="service-title" className="mt-1 text-xl font-bold text-white">Dari laporan hingga selesai</h2>
            </div>
          </div>
          <ol className="my-8 space-y-5">
            {['Keluhan dicatat sebagai tiket', 'Teknisi ditugaskan ke lokasi', 'Pengerjaan dan SLA dipantau', 'Hasil penanganan terdokumentasi'].map((label, index) => (
              <li key={label} className="flex items-center gap-3 text-sm text-white">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 text-xs font-bold text-powder-blue-200">0{index + 1}</span>
                {label}
              </li>
            ))}
          </ol>
          <div className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/5 p-4">
            <QrCode aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-powder-blue-200" />
            <p className="text-sm leading-relaxed text-powder-blue-100">Ada QR code di lokasi? Pindai untuk membuka formulir keluhan sesuai lokasi layanan Anda.</p>
          </div>
        </aside>
      </section>

      <section aria-labelledby="features-title">
        <h2 id="features-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Satu sistem untuk setiap tahap layanan</h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-charcoal-700">Informasi keluhan dan aktivitas lapangan tersusun dalam satu tempat agar tindak lanjut lebih mudah dikelola.</p>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, description }) => (
            <Card key={title}>
              <div className="mb-5 inline-flex rounded-xl bg-alice-blue-50 p-3 text-alice-blue-600"><Icon aria-hidden="true" className="h-6 w-6" /></div>
              <h3 className="text-base font-bold">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-charcoal-700">{description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="steps-title">
        <h2 id="steps-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Bagaimana cara menggunakannya?</h2>
        <ol className="mt-7 grid gap-6 md:grid-cols-3">
          {steps.map(({ title, description }, index) => (
            <li key={title} className="border-t border-charcoal-200 pt-5">
              <span className="text-sm font-bold text-alice-blue-600">0{index + 1}</span>
              <h3 className="mt-3 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-charcoal-700">{description}</p>
            </li>
          ))}
        </ol>
      </section>

    </div>
  );
}
