import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-extrabold text-emerald-400">404</h1>
      <p className="mt-2 text-slate-400">Page not found</p>
      <Link
        href="/"
        className="mt-4 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm"
      >
        Return Home
      </Link>
    </div>
  );
}

