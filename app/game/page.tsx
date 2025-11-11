import React from "react";
import Game from "./Game";

export const metadata = {
  title: "Blackjack - Phone",
};

export default function Page() {
  return (
    <main
      style={{
        display: "flex",
        justifyContent: "center",
        background: "#ffffff",
        minHeight: "100vh",
      }}
    >
      <Game />
    </main>
  );
}
