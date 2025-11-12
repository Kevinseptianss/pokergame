"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as PIXI from "pixi.js";

// Target phone viewport (auto-fit)
const getViewportSize = () => ({
  width: window.innerWidth,
  height: window.innerHeight,
});
const PADDING = 20;
const CARD_WIDTH = 80;
const CARD_HEIGHT = 120;
const DEBUG_HOTPINK_BG = false;
const CARD_PAD = 6;

type Card = string;

function createDeck(): Card[] {
  const ranks = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
  ];
  const suits = ["S", "H", "D", "C"];
  const deck: Card[] = [];
  for (const s of suits) {
    for (const r of ranks) {
      deck.push(`${r}${s}`);
    }
  }
  return deck;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function cardFilename(card: Card) {
  const suitMap: Record<string, string> = {
    S: "spades",
    H: "hearts",
    D: "diamonds",
    C: "clubs",
  };
  const suit = card.slice(-1);
  const rank = card.slice(0, card.length - 1);
  let rankName = rank.toLowerCase();
  if (rankName === "a") rankName = "ace";
  if (rankName === "j") rankName = "jack";
  if (rankName === "q") rankName = "queen";
  if (rankName === "k") rankName = "king";
  const suitName = suitMap[suit] || suit.toLowerCase();
  return `/cards/${rankName}_of_${suitName}.png`;
}

function baccaratScore(cards: Card[]) {
  let total = 0;
  for (const c of cards) {
    const rank = c.replace(/[SHDC]/, "");
    if (rank === "A") total += 1;
    else if (["J", "Q", "K"].includes(rank)) total += 0;
    else total += parseInt(rank, 10);
  }
  return total % 10;
}

export default function Baccarat() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const viewportWidthRef = useRef(430);
  const viewportHeightRef = useRef(932);
  const [message, setMessage] = useState("");
  const [money, setMoney] = useState(1000);
  const [betAmount, setBetAmount] = useState(10);
  const [betType, setBetType] = useState<"player" | "banker" | "tie">("player");
  const [isBetPlaced, setIsBetPlaced] = useState(false);
  const [playerCards, setPlayerCards] = useState<Card[]>([]);
  const [bankerCards, setBankerCards] = useState<Card[]>([]);
  const deckRef = useRef<Card[]>([]);
  const texturesRef = useRef<Record<string, PIXI.Texture>>({});

  // Load money from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("baccarat-money");
    if (saved) {
      setMoney(parseInt(saved, 10));
    }
  }, []);

  // Save money to localStorage
  useEffect(() => {
    localStorage.setItem("baccarat-money", money.toString());
  }, [money]);

  function sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }

  function animateCard(
    sprite: PIXI.Sprite,
    toX: number,
    toY: number,
    duration: number = 500
  ) {
    const fromX = sprite.x;
    const fromY = sprite.y;
    const startTime = performance.now();
    const animate = (time: number) => {
      const elapsed = time - startTime;
      const t = Math.min(elapsed / duration, 1);
      sprite.x = fromX + (toX - fromX) * t;
      sprite.y = fromY + (toY - fromY) * t;
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  async function dealCards() {
    const pCards: Card[] = [];
    const bCards: Card[] = [];
    const pad = CARD_PAD;
    const cardWidth = CARD_WIDTH;
    const cardHeight = CARD_HEIGHT;
    const bgW = cardWidth + pad * 2;
    const cardSpacing = cardWidth + 8 + pad * 2;

    // Deal 2 cards to each, staggered
    for (let i = 0; i < 2; i++) {
      // Deal player card
      pCards.push(deckRef.current.pop()!);
      setPlayerCards([...pCards]);
      renderScene();
      // Animate the card
      const app = appRef.current;
      if (app) {
        const playerCardY = Math.round(viewportHeightRef.current * 0.47);
        const playerTotalWidth =
          pCards.length * bgW + Math.max(0, pCards.length - 1) * 8;
        const playerStartX = (viewportWidthRef.current - playerTotalWidth) / 2;
        const container = app.stage.children.find(
          (ch: any) =>
            ch.y === playerCardY &&
            Math.abs(
              ch.x - (playerStartX + (pCards.length - 1) * cardSpacing)
            ) < 1
        );
        if (container) {
          const sprite = container.children.find((c: any) => c.texture);
          if (sprite) {
            sprite.x = viewportWidthRef.current / 2;
            sprite.y = 50;
            animateCard(sprite as PIXI.Sprite, pad, pad);
          }
        }
      }
      await sleep(600);

      // Deal banker card
      bCards.push(deckRef.current.pop()!);
      setBankerCards([...bCards]);
      renderScene();
      // Animate the card
      const app2 = appRef.current;
      if (app2) {
        const bankerCardY = Math.round(viewportHeightRef.current * 0.25);
        const bankerTotalWidth =
          bCards.length * bgW + Math.max(0, bCards.length - 1) * 8;
        const bankerStartX = (viewportWidthRef.current - bankerTotalWidth) / 2;
        const container = app2.stage.children.find(
          (ch: any) =>
            ch.y === bankerCardY &&
            Math.abs(
              ch.x - (bankerStartX + (bCards.length - 1) * cardSpacing)
            ) < 1
        );
        if (container) {
          const sprite = container.children.find((c: any) => c.texture);
          if (sprite) {
            sprite.x = viewportWidthRef.current / 2;
            sprite.y = 50;
            animateCard(sprite as PIXI.Sprite, pad, pad);
          }
        }
      }
      await sleep(600);
    }

    await sleep(500);

    // Check for third card
    const pScore = baccaratScore(pCards);
    if (pScore < 6) {
      pCards.push(deckRef.current.pop()!);
      setPlayerCards([...pCards]);
      renderScene();
      // Animate third card
      const app = appRef.current;
      if (app) {
        const playerCardY = Math.round(viewportHeightRef.current * 0.47);
        const playerTotalWidth =
          pCards.length * bgW + Math.max(0, pCards.length - 1) * 8;
        const playerStartX = (viewportWidthRef.current - playerTotalWidth) / 2;
        const container = app.stage.children.find(
          (ch: any) =>
            ch.y === playerCardY &&
            Math.abs(ch.x - (playerStartX + 2 * cardSpacing)) < 1
        );
        if (container) {
          const sprite = container.children.find((c: any) => c.texture);
          if (sprite) {
            sprite.x = viewportWidthRef.current / 2;
            sprite.y = 50;
            animateCard(sprite as PIXI.Sprite, pad, pad);
          }
        }
      }
      await sleep(600);
    }

    // Banker third card logic
    const finalPScore = baccaratScore(pCards);
    let bankerDraw = false;
    if (bCards.length === 2) {
      const bScore = baccaratScore(bCards);
      if (bScore <= 2) bankerDraw = true;
      else if (bScore === 3 && finalPScore !== 8) bankerDraw = true;
      else if (bScore === 4 && [1, 2, 3, 4, 5, 6, 9, 0].includes(finalPScore))
        bankerDraw = true;
      else if (bScore === 5 && [4, 5, 6, 7].includes(finalPScore))
        bankerDraw = true;
      else if (bScore === 6 && [6, 7].includes(finalPScore)) bankerDraw = true;
    }
    if (bankerDraw) {
      bCards.push(deckRef.current.pop()!);
      setBankerCards([...bCards]);
      renderScene();
      // Animate third card
      const app = appRef.current;
      if (app) {
        const bankerCardY = Math.round(viewportHeightRef.current * 0.25);
        const bankerTotalWidth =
          bCards.length * bgW + Math.max(0, bCards.length - 1) * 8;
        const bankerStartX = (viewportWidthRef.current - bankerTotalWidth) / 2;
        const container = app.stage.children.find(
          (ch: any) =>
            ch.y === bankerCardY &&
            Math.abs(ch.x - (bankerStartX + 2 * cardSpacing)) < 1
        );
        if (container) {
          const sprite = container.children.find((c: any) => c.texture);
          if (sprite) {
            sprite.x = viewportWidthRef.current / 2;
            sprite.y = 50;
            animateCard(sprite as PIXI.Sprite, pad, pad);
          }
        }
      }
      await sleep(600);
    }

    // Determine winner
    const finalBScore = baccaratScore(bCards);
    let winner: "player" | "banker" | "tie";
    if (finalPScore > finalBScore) winner = "player";
    else if (finalBScore > finalPScore) winner = "banker";
    else winner = "tie";

    // Payout
    if (winner === betType) {
      let payout = betAmount;
      if (betType === "banker") payout = Math.floor(betAmount * 0.95);
      else if (betType === "tie") payout = betAmount * 8;
      else payout = betAmount;
      setMoney(money + payout);
      setMessage(`${winner.toUpperCase()} wins! You win $${payout}`);
    } else {
      setMessage(`${winner.toUpperCase()} wins! You lose $${betAmount}`);
    }

    // Reset after delay
    setTimeout(() => startNewGame(), 3000);
  }

  useEffect(() => {
    const { width: viewportWidth, height: viewportHeight } = getViewportSize();
    viewportWidthRef.current = viewportWidth;
    viewportHeightRef.current = viewportHeight;

    // Clear any existing content
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }

    const canvas = document.createElement("canvas");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = viewportWidth * dpr;
    canvas.height = viewportHeight * dpr;

    (async () => {
      const app = new PIXI.Application();
      if ((app as any).init) {
        await (app as any).init({
          canvas: canvas,
          width: viewportWidth,
          height: viewportHeight,
          backgroundColor: 0x0b6623,
          resolution: dpr,
          autoDensity: true,
        });
      } else {
        (app as any).renderer.resize(viewportWidth, viewportHeight);
        (app as any).renderer.backgroundColor = 0x0b6623;
      }
      appRef.current = app;

      if (containerRef.current) {
        containerRef.current.style.width = "100%";
        containerRef.current.style.height = "100%";
        containerRef.current.style.position = "relative";
        containerRef.current.appendChild(canvas);
        canvas.style.width = "100%";
        canvas.style.height = "100%";
      }

      // Preload textures
      (async () => {
        const deck = createDeck();
        const promises: Promise<void>[] = [];
        for (const c of deck) {
          const baseUrl = cardFilename(c);
          const url2x = baseUrl.replace(/(.png)$/, "@2x.png");
          const try2x = (window.devicePixelRatio || 1) > 1;
          const p = (async () => {
            if (try2x) {
              try {
                const tex = await (PIXI.Assets as any).load(url2x);
                texturesRef.current[c] = tex;
                return;
              } catch (e) {
                // fallback
              }
            }
            try {
              const tex = await (PIXI.Assets as any).load(baseUrl);
              texturesRef.current[c] = tex;
            } catch (e) {
              // ignore
            }
          })();
          promises.push(p as Promise<void>);
        }
        // Load table and back
        const tableP = (PIXI.Assets as any)
          .load("/table.png")
          .then((tex: PIXI.Texture) => {
            texturesRef.current["TABLE"] = tex;
          })
          .catch(() => {});
        promises.push(tableP);
        const backUrl =
          (window.devicePixelRatio || 1) > 1
            ? "/cards/back@2x.png"
            : "/cards/back.png";
        const backP = (PIXI.Assets as any)
          .load(backUrl)
          .then((tex: PIXI.Texture) => {
            texturesRef.current["BACK"] = tex;
          })
          .catch(async () => {
            try {
              const tex = await (PIXI.Assets as any).load("/cards/back.png");
              texturesRef.current["BACK"] = tex;
            } catch (e) {}
          });
        promises.push(backP);

        await Promise.all(promises);
        // Start game
        renderScene();
        startNewGame();
      })();
    })();

    return () => {
      // Safely stop ticker and destroy app -- ticker may be undefined on some environments
      if (appRef.current) {
        try {
          if (
            appRef.current.ticker &&
            typeof appRef.current.ticker.stop === "function"
          ) {
            appRef.current.ticker.stop();
          }
        } catch (e) {
          // ignore
        }
        try {
          appRef.current.destroy(true, { children: true });
        } catch (e) {
          // ignore
        }
        appRef.current = null;
      }
    };
  }, []);

  function startNewGame() {
    deckRef.current = shuffle(createDeck());
    setIsBetPlaced(false);
    setMessage("Baccarat - Place your bet!");
  }

  function renderScene() {
    const app = appRef.current;
    if (!app) return;
    app.stage.removeChildren();
    try {
      app.stage.sortableChildren = true;
    } catch (e) {}

    // Table background
    const tableTex = texturesRef.current["TABLE"];
    if (tableTex) {
      const tableSprite = new PIXI.Sprite(tableTex);
      const scale = Math.max(
        app.renderer.width / tableTex.width,
        app.renderer.height / tableTex.height
      );
      tableSprite.scale.set(scale, scale);
      tableSprite.x = (app.renderer.width - tableTex.width * scale) / 2;
      tableSprite.y = (app.renderer.height - tableTex.height * scale) / 2;
      tableSprite.zIndex = 0;
      app.stage.addChild(tableSprite);
    }

    // Display money
    const moneyText = new PIXI.Text({
      text: `Money: $${money}`,
      style: { fill: 0xffffff, fontSize: 18 } as any,
    });
    moneyText.x = 10;
    moneyText.y = 10;
    app.stage.addChild(moneyText);

    // Player and Banker labels and cards
    const playerLabel = new PIXI.Text({
      text: `Player (${baccaratScore(playerCards)})`,
      style: { fill: 0xffffff, fontSize: 18 } as any,
    });
    playerLabel.x = (viewportWidthRef.current - playerLabel.width) / 2;
    playerLabel.y = Math.round(viewportHeightRef.current * 0.47) - 30;
    app.stage.addChild(playerLabel);

    const bankerLabel = new PIXI.Text({
      text: `Banker (${baccaratScore(bankerCards)})`,
      style: { fill: 0xffffff, fontSize: 18 } as any,
    });
    bankerLabel.x = (viewportWidthRef.current - bankerLabel.width) / 2;
    bankerLabel.y = Math.round(viewportHeightRef.current * 0.25) - 30;
    app.stage.addChild(bankerLabel);

    // Render cards
    const cardWidth = CARD_WIDTH;
    const cardHeight = CARD_HEIGHT;
    const pad = CARD_PAD;
    const bgW = cardWidth + pad * 2;
    const bgH = cardHeight + pad * 2;
    const cardSpacing = cardWidth + 8 + pad * 2;

    // Player cards
    const playerCardY = Math.round(viewportHeightRef.current * 0.47);
    const playerTotalWidth =
      playerCards.length * bgW + Math.max(0, playerCards.length - 1) * 8;
    const playerStartX = (viewportWidthRef.current - playerTotalWidth) / 2;
    for (let i = 0; i < playerCards.length; i++) {
      const c = playerCards[i];
      const tex = texturesRef.current[c];
      const cardContainer = new PIXI.Container();
      cardContainer.sortableChildren = true;
      const fillG = new PIXI.Graphics();
      (fillG as any).beginFill(0xffffff, 1);
      (fillG as any).drawRoundedRect(0, 0, bgW, bgH, 10);
      (fillG as any).endFill();
      fillG.zIndex = 1;
      cardContainer.addChild(fillG);
      if (tex) {
        const sprite = new PIXI.Sprite(tex);
        sprite.width = cardWidth;
        sprite.height = cardHeight;
        sprite.x = pad;
        sprite.y = pad;
        sprite.alpha = 1;
        sprite.zIndex = 2;
        cardContainer.addChild(sprite);
      }
      cardContainer.x = playerStartX + i * cardSpacing;
      cardContainer.y = playerCardY;
      cardContainer.zIndex = 10;
      app.stage.addChild(cardContainer);
    }

    // Banker cards
    const bankerCardY = Math.round(viewportHeightRef.current * 0.25);
    const bankerTotalWidth =
      bankerCards.length * bgW + Math.max(0, bankerCards.length - 1) * 8;
    const bankerStartX = (viewportWidthRef.current - bankerTotalWidth) / 2;
    for (let i = 0; i < bankerCards.length; i++) {
      const c = bankerCards[i];
      const tex = texturesRef.current[c];
      const cardContainer = new PIXI.Container();
      cardContainer.sortableChildren = true;
      const fillG = new PIXI.Graphics();
      (fillG as any).beginFill(0xffffff, 1);
      (fillG as any).drawRoundedRect(0, 0, bgW, bgH, 10);
      (fillG as any).endFill();
      fillG.zIndex = 1;
      cardContainer.addChild(fillG);
      if (tex) {
        const sprite = new PIXI.Sprite(tex);
        sprite.width = cardWidth;
        sprite.height = cardHeight;
        sprite.x = pad;
        sprite.y = pad;
        sprite.alpha = 1;
        sprite.zIndex = 2;
        cardContainer.addChild(sprite);
      }
      cardContainer.x = bankerStartX + i * cardSpacing;
      cardContainer.y = bankerCardY;
      cardContainer.zIndex = 10;
      app.stage.addChild(cardContainer);
    }

    // Placeholder message
    if (message) {
      const msg = new PIXI.Text({
        text: message,
        style: { fill: 0xffffff, fontSize: 20 } as any,
      });
      msg.x = (viewportWidthRef.current - msg.width) / 2;
      msg.y = Math.round(viewportHeightRef.current * 0.4);
      app.stage.addChild(msg);
    }

    try {
      app.stage.sortChildren();
    } catch (e) {}
  }

  useEffect(() => {
    renderScene();
  }, [message, money, playerCards, bankerCards]);

  return (
    <div
      style={{
        width: viewportWidthRef.current,
        height: viewportHeightRef.current,
        padding: 0,
        boxSizing: "border-box",
        margin: 0,
        background: "transparent",
        borderRadius: 0,
        boxShadow: "none",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

        {!isBetPlaced && (
          <div
            style={{
              position: "absolute",
              bottom: "20px",
              left: "50%",
              transform: "translateX(-50%)",
              background:
                "linear-gradient(135deg, rgba(0,0,0,0.9), rgba(50,50,50,0.9))",
              padding: "25px",
              borderRadius: "15px",
              color: "white",
              textAlign: "center",
              maxWidth: "90%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(10px)",
            }}
          >
            <h2
              style={{
                margin: "0 0 15px 0",
                fontSize: "24px",
                fontWeight: "bold",
                color: "#FFD700",
              }}
            >
              Place Your Bet
            </h2>
            <p
              style={{ margin: "0 0 20px 0", fontSize: "18px", color: "#FFF" }}
            >
              Money: ${money}
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px",
              }}
            >
              <button
                onClick={() => setBetAmount(Math.max(5, betAmount - 5))}
                style={{
                  background: "linear-gradient(135deg, #FF6B6B, #EE5A52)",
                  color: "white",
                  border: "none",
                  borderRadius: "50%",
                  width: "40px",
                  height: "40px",
                  fontSize: "20px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  marginRight: "10px",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
                  transition: "transform 0.2s",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.transform = "scale(1.1)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.transform = "scale(1)")
                }
              >
                -
              </button>
              <span
                style={{
                  margin: "0 20px",
                  fontSize: "20px",
                  fontWeight: "bold",
                  color: "#FFD700",
                }}
              >
                Bet: ${betAmount}
              </span>
              <button
                onClick={() => setBetAmount(Math.min(money, betAmount + 5))}
                style={{
                  background: "linear-gradient(135deg, #4ECDC4, #44A08D)",
                  color: "white",
                  border: "none",
                  borderRadius: "50%",
                  width: "40px",
                  height: "40px",
                  fontSize: "20px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  marginLeft: "10px",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
                  transition: "transform 0.2s",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.transform = "scale(1.1)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.transform = "scale(1)")
                }
              >
                +
              </button>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: "20px",
              }}
            >
              <button
                onClick={() => setBetType("player")}
                style={{
                  background:
                    betType === "player"
                      ? "linear-gradient(135deg, #FFD700, #FFA500)"
                      : "linear-gradient(135deg, #666, #999)",
                  color: "black",
                  border: "none",
                  borderRadius: "10px",
                  padding: "10px 20px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  margin: "0 5px",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
                  transition: "transform 0.2s",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.transform = "scale(1.05)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.transform = "scale(1)")
                }
              >
                Player
              </button>
              <button
                onClick={() => setBetType("banker")}
                style={{
                  background:
                    betType === "banker"
                      ? "linear-gradient(135deg, #FFD700, #FFA500)"
                      : "linear-gradient(135deg, #666, #999)",
                  color: "black",
                  border: "none",
                  borderRadius: "10px",
                  padding: "10px 20px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  margin: "0 5px",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
                  transition: "transform 0.2s",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.transform = "scale(1.05)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.transform = "scale(1)")
                }
              >
                Banker
              </button>
              <button
                onClick={() => setBetType("tie")}
                style={{
                  background:
                    betType === "tie"
                      ? "linear-gradient(135deg, #FFD700, #FFA500)"
                      : "linear-gradient(135deg, #666, #999)",
                  color: "black",
                  border: "none",
                  borderRadius: "10px",
                  padding: "10px 20px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  margin: "0 5px",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
                  transition: "transform 0.2s",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.transform = "scale(1.05)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.transform = "scale(1)")
                }
              >
                Tie
              </button>
            </div>
            <button
              onClick={() => {
                if (betAmount > money) return;
                setMoney(money - betAmount);
                setIsBetPlaced(true);
                setMessage("Dealing cards...");
                dealCards();
              }}
              style={{
                background: "linear-gradient(135deg, #28A745, #20C997)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                padding: "15px 30px",
                fontSize: "18px",
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
                transition: "transform 0.2s",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.transform = "scale(1.05)")
              }
              onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              Confirm Bet
            </button>
          </div>
        )}

        <Link
          href="/"
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            background: "rgba(0,0,0,0.8)",
            color: "white",
            padding: "10px 15px",
            borderRadius: "5px",
            textDecoration: "none",
            fontSize: "16px",
            zIndex: 1000,
          }}
        >
          Back to Menu
        </Link>

        {/* TODO: Add game buttons */}
      </div>
    </div>
  );
}
