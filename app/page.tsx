"use client";

"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function Home() {
  const [money, setMoney] = useState(1000);

  useEffect(() => {
    const saved = localStorage.getItem("blackjackMoney");
    if (saved) {
      setMoney(parseInt(saved, 10));
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-green-800 to-green-900 font-sans">
      <main className="flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-white mb-4 drop-shadow-lg">
            Poker Games
          </h1>
          <p className="text-xl text-green-100 mb-8">
            Classic card games for your phone
          </p>
          <div className="text-2xl text-yellow-300 font-bold mb-4">
            Money: ${money}
          </div>
        </div>

        <div className="space-y-4 w-full max-w-xs">
          <Link
            href="/game"
            className="block w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 px-6 rounded-lg text-xl transition-colors duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            Play Blackjack
          </Link>
          <Link
            href="/baccarat"
            className="block w-full bg-blue-500 hover:bg-blue-400 text-white font-bold py-4 px-6 rounded-lg text-xl transition-colors duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            Play Baccarat
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
