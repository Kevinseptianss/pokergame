import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-green-800 to-green-900 font-sans">
      <main className="flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-white mb-4 drop-shadow-lg">
            Blackjack
          </h1>
          <p className="text-xl text-green-100 mb-8">
            Classic card game for your phone
          </p>
        </div>

        <div className="space-y-4 w-full max-w-xs">
          <Link href="/game" legacyBehavior>
            <a className="block w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 px-6 rounded-lg text-xl transition-colors duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
              Play Now
            </a>
          </Link>
          <p className="text-sm text-green-200">
            Optimized for mobile • iPhone 16 viewport
          </p>
        </div>

        <div className="mt-12 text-green-300 text-sm">
          <p>Built with Next.js & PixiJS</p>
        </div>
      </main>
    </div>
  );
}
