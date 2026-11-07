import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-stone-200 py-8 dark:border-stone-800">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-stone-500 dark:text-stone-400 sm:flex-row">
        <p>
          Lingo &amp; Karogs — neatkarīgs fanu projekts. Nav saistīts ar Tilde vai
          spēļu oriģinālo izstrādātāju.
        </p>
        <nav className="flex flex-wrap items-center gap-4" aria-label="Kājenes saites">
          <Link href="/ka-spelet" className="hover:text-stone-800 dark:hover:text-stone-200">
            Noteikumi
          </Link>
          <Link href="/par-projektu" className="hover:text-stone-800 dark:hover:text-stone-200">
            Par projektu
          </Link>
          <Link href="/iestatijumi" className="hover:text-stone-800 dark:hover:text-stone-200">
            Privātums
          </Link>
        </nav>
      </div>
    </footer>
  );
}
