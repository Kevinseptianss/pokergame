"use client";

import React, { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";

// Target phone viewport (approx. iPhone-16) - now auto-fit
const getViewportSize = () => ({
  width: window.innerWidth,
  height: window.innerHeight,
});
const PADDING = 20; // safe padding inside the phone viewport
const CARD_WIDTH = 80;
const CARD_HEIGHT = 120;
// set to true to draw hot-pink background behind cards for debugging layering
const DEBUG_HOTPINK_BG = false;
// extra padding inside the card container (space between bg and card sprite)
const CARD_PAD = 6;

type Card = string; // card id like 'AS', '10H', etc.

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
  const suits = ["S", "H", "D", "C"]; // Spades, Hearts, Diamonds, Clubs
  const deck: Card[] = [];
  for (const s of suits) {
    for (const r of ranks) {
      deck.push(`${r}${s}`);
    }
  }
  return deck;
}

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function cardFilename(card: Card) {
  // Map internal card id like 'AS' or '10H' to filenames in public/cards/
  // Filenames follow the pattern: "rank_of_suit.png" where rank is
  // ace, 2-10, jack, queen, king and suit is clubs/hearts/diamonds/spades.
  const suitMap: Record<string, string> = {
    S: "spades",
    H: "hearts",
    D: "diamonds",
    C: "clubs",
  };
  // extract rank (could be 10 or letter)
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

function scoreHand(cards: Card[]) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const rank = c.replace(/[SHDC]/, "");
    if (rank === "A") {
      aces++;
      total += 11;
    } else if (["J", "Q", "K"].includes(rank)) {
      total += 10;
    } else {
      total += parseInt(rank, 10);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function getRankDisplay(card: Card) {
  // return a human-friendly short rank for overlay, e.g. 'A', '10', 'J'
  return card.slice(0, card.length - 1);
}

export default function Game() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const viewportWidthRef = useRef(430);
  const viewportHeightRef = useRef(932);
  const [message, setMessage] = useState("");
  type GameState = "idle" | "dealing" | "player" | "dealer" | "settled";
  const [gameState, setGameState] = useState<GameState>("idle");
  const [playerCards, setPlayerCards] = useState<Card[]>([]);
  const [dealerCards, setDealerCards] = useState<Card[]>([]);
  const deckRef = useRef<Card[]>([]);
  const texturesRef = useRef<Record<string, PIXI.Texture>>({});

  function sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }

  // reveal the dealer's hole card with a simple flip animation
  function revealDealerHoleWithFlip(duration = 360) {
    return new Promise<void>((resolve) => {
      const app = appRef.current;
      if (!app) return resolve();
      // find the dealer's first card container at expected position
      const targetX = (viewportWidthRef.current - 80) / 2; // approx center minus half card
      const targetY = 290;
      const container = app.stage.children.find((ch) => {
        try {
          return (ch as any).x === targetX && (ch as any).y === targetY;
        } catch (e) {
          return false;
        }
      }) as unknown as PIXI.Container | undefined;
      if (!container) return resolve();

      // find the first Sprite inside the container (the card sprite)
      const sprite = container.children.find(
        (c) => (c as any).texture
      ) as unknown as PIXI.Sprite | undefined;
      if (!sprite) return resolve();

      const holeCard = dealerCards[0];
      const faceTex = texturesRef.current[holeCard] || null;

      // prepare sprite anchor for centered flip
      try {
        sprite.anchor = sprite.anchor || ({ x: 0, y: 0 } as any);
        (sprite as any).anchor.set?.(0.5, 0.5);
      } catch (e) {
        // ignore if not supported
      }
      // position sprite center
      sprite.x = CARD_WIDTH / 2;
      sprite.y = CARD_HEIGHT / 2;

      const half = duration / 2;
      const start = performance.now();
      let swapped = false;

      function step(now: number) {
        const s = sprite!;
        const elapsed = now - start;
        if (elapsed < half) {
          const t = elapsed / half;
          (s.scale as any).x = 1 - t;
          requestAnimationFrame(step);
        } else if (elapsed < duration) {
          if (!swapped) {
            if (faceTex) s.texture = faceTex;
            swapped = true;
          }
          const t = (elapsed - half) / half;
          (s.scale as any).x = t;
          requestAnimationFrame(step);
        } else {
          (s.scale as any).x = 1;
          resolve();
        }
      }
      requestAnimationFrame(step);
    });
  }

  useEffect(() => {
    const { width: viewportWidth, height: viewportHeight } = getViewportSize();
    viewportWidthRef.current = viewportWidth;
    viewportHeightRef.current = viewportHeight;
    // create Pixi app -- create a canvas first and initialize the Application
    const canvas = document.createElement("canvas");
    // make the canvas cover the full phone viewport (no extra white padding)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = viewportWidth * dpr;
    canvas.height = viewportHeight * dpr;

    const app = new PIXI.Application();
    // Use the recommended init() API for Pixi v8+ and pass `canvas` (not `view`)
    if ((app as any).init) {
      (app as any).init({
        canvas: canvas,
        width: viewportWidth,
        height: viewportHeight,
        // green felt table background
        backgroundColor: 0x0b6623,
        resolution: dpr,
        autoDensity: true,
      });
    } else {
      // fallback for older API versions
      (app as any).renderer.resize(viewportWidth, viewportHeight);
      (app as any).renderer.backgroundColor = 0x0b6623;
    }
    appRef.current = app;
    if (containerRef.current) {
      // ensure the container fills available area then append the Pixi canvas
      containerRef.current.style.width = "100%";
      containerRef.current.style.height = "100%";
      containerRef.current.style.position = "relative";
      containerRef.current.appendChild(canvas);
      // ensure the canvas scales to the container size on the page
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    }

    // Preload card textures (attempt common 52 names) using Texture.fromURL
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
              // fallback to normal
            }
          }
          try {
            const tex = await (PIXI.Assets as any).load(baseUrl);
            texturesRef.current[c] = tex;
          } catch (e) {
            // missing texture; we'll fallback to placeholder when rendering
          }
        })();
        promises.push(p as Promise<void>);
      }
      // load table background image
      const tableP = (PIXI.Assets as any)
        .load("/table.png")
        .then((tex: PIXI.Texture) => {
          texturesRef.current["TABLE"] = tex;
        })
        .catch(() => {
          // ignore
        });
      promises.push(tableP);
      // load card back (and prefer back@2x on high DPR if present)
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
          // fallback to non-@2x
          try {
            const tex = await (PIXI.Assets as any).load("/cards/back.png");
            texturesRef.current["BACK"] = tex;
          } catch (e) {
            /* ignore */
          }
        });
      promises.push(backP);

      await Promise.all(promises);
      // start a new game once textures are ready
      startNewGame();
    })();

    return () => {
      app.destroy(true, { children: true });
      appRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function renderScene() {
    const app = appRef.current;
    if (!app) return;
    app.stage.removeChildren();
    // allow ordering with zIndex on the stage
    try {
      app.stage.sortableChildren = true;
    } catch (e) {
      /* ignore */
    }

    // consider the game over when state is 'settled' (used to reveal dealer's hole card)
    const isGameOver = gameState === "settled";

    const spacing = 30;
    const cardWidth = CARD_WIDTH;
    const cardHeight = CARD_HEIGHT;
    const pad = CARD_PAD;
    const bgW = cardWidth + pad * 2;
    const bgH = cardHeight + pad * 2;
    const cardSpacing = cardWidth + 8 + pad * 2;

    // We'll draw rounded backgrounds with Graphics directly per-card to
    // ensure the rounded corners and soft-red back are visible. Generating
    // textures at runtime proved fragile across renderers, so use Graphics
    // (added before the sprite) and rely on zIndex / sortableChildren.
    // helper to add a rounded bg Graphics to a container
    function addRoundedBg(
      container: PIXI.Container,
      opts: { isBack?: boolean }
    ) {
      const isBack = !!opts.isBack;
      const bg = new PIXI.Graphics();
      // prefer beginFill/drawRoundedRect if available (works across versions)
      try {
        if ((bg as any).beginFill && (bg as any).drawRoundedRect) {
          (bg as any).lineStyle?.(2, isBack ? 0xcc3333 : 0x000000);
          (bg as any).beginFill(isBack ? 0xffdddd : 0xffffff, 1);
          (bg as any).drawRoundedRect(0, 0, bgW, bgH, 10);
          (bg as any).endFill?.();
        } else {
          // modern API
          (bg as any).setStrokeStyle?.(2, {
            color: isBack ? 0xcc3333 : 0x000000,
          });
          (bg as any).fill({ color: isBack ? 0xffdddd : 0xffffff, alpha: 1 });
          (bg as any).roundRect(0, 0, bgW, bgH, 10);
        }
      } catch (e) {
        // last-resort: plain white rect
        (bg as any).fill({ color: 0xffffff, alpha: 1 });
        (bg as any).roundRect(0, 0, bgW, bgH, 10);
      }
      bg.zIndex = 1;
      container.addChild(bg);
      return bg;
    }

    // Table background (draw first so everything else sits above)
    const tableTex = texturesRef.current["TABLE"];
    if (tableTex) {
      const tableSprite = new PIXI.Sprite(tableTex);
      // preserve aspect ratio and scale to cover the view (like CSS 'cover')
      const scale = Math.max(
        app.renderer.width / tableTex.width,
        app.renderer.height / tableTex.height
      );
      tableSprite.scale.set(scale, scale);
      // center the scaled image
      tableSprite.x = (app.renderer.width - tableTex.width * scale) / 2;
      tableSprite.y = (app.renderer.height - tableTex.height * scale) / 2;
      // ensure table renders behind other layers
      tableSprite.zIndex = 0;
      app.stage.addChild(tableSprite);
    }

    // Dealer
    const dealerScore = scoreHand(dealerCards);
    const dealerLabel = new PIXI.Text({
      text:
        gameState !== "player" && gameState !== "dealing"
          ? `Dealer (${dealerScore})`
          : "Dealer",
      style: { fill: 0xffffff, fontSize: 18 } as any,
    });
    dealerLabel.x = (viewportWidthRef.current - dealerLabel.width) / 2;
    dealerLabel.y = 260;
    app.stage.addChild(dealerLabel);

    // Calculate total width for dealer cards to center them
    const dealerTotalWidth =
      dealerCards.length * bgW + Math.max(0, dealerCards.length - 1) * 8;
    const dealerStartX = (viewportWidthRef.current - dealerTotalWidth) / 2;

    for (let i = 0; i < dealerCards.length; i++) {
      const c = dealerCards[i];
      // keep the dealer's first card face-down while the game is in progress
      const hideHole = gameState === "player" || gameState === "dealing";
      const key = i === 0 && dealerCards.length > 1 && hideHole ? "BACK" : c;
      const tex = texturesRef.current[key];

      const cardContainer = new PIXI.Container();
      // allow explicit z-ordering of children so background stays behind the sprite
      cardContainer.sortableChildren = true;

      // soft shadow sized to padded background
      const shadow = new PIXI.Graphics();
      (shadow as any).fill({ color: 0x000000, alpha: 0.14 });
      (shadow as any).roundRect(
        4,
        6,
        cardWidth + pad * 2,
        cardHeight + pad * 2,
        12
      );
      shadow.zIndex = 0;
      cardContainer.addChild(shadow);

      // draw rounded border (outer) and inner fill so the rounded shape is
      // always visible even if a sprite covers part of it.
      const isBack = key === "BACK";
      const fillG = new PIXI.Graphics();
      (fillG as any).beginFill(isBack ? 0xffdddd : 0xffffff, 1);
      (fillG as any).drawRoundedRect(0, 0, bgW, bgH, 10);
      (fillG as any).endFill();
      fillG.zIndex = 1;
      cardContainer.addChild(fillG);

      const borderG = new PIXI.Graphics();
      try {
        (borderG as any).lineStyle?.(2, isBack ? 0xcc3333 : 0x000000, 1);
        (borderG as any).drawRoundedRect?.(0, 0, bgW, bgH, 10);
      } catch (e) {
        try {
          (borderG as any).setStrokeStyle?.(2, {
            color: isBack ? 0xcc3333 : 0x000000,
          });
          (borderG as any).roundRect(0, 0, bgW, bgH, 10);
        } catch (e2) {
          // ignore
        }
      }
      borderG.zIndex = 1;
      cardContainer.addChild(borderG);

      // if this is the dealer's facedown BACK while hiding the hole, don't draw the back texture
      const showSprite = !(isBack && hideHole);
      if (tex) {
        const sprite = new PIXI.Sprite(tex);
        sprite.width = cardWidth;
        sprite.height = cardHeight;
        // position sprite inside padded background
        sprite.x = pad;
        sprite.y = pad;
        // ensure sprite renders above bg and is fully opaque
        sprite.alpha = 1;
        // force normal blending and try to avoid premultiplied-alpha artifacts
        try {
          // set blend mode defensively (some pixi builds may not expose BLEND_MODES on the namespace)
          (sprite as any).blendMode =
            ((PIXI as any).BLEND_MODES && (PIXI as any).BLEND_MODES.NORMAL) ||
            0;
          // set premultipliedAlpha defensively (may be ignored if texture already uploaded)
          if (sprite.texture && (sprite.texture.baseTexture as any)) {
            (sprite.texture.baseTexture as any).premultipliedAlpha = false;
          }
        } catch (e) {
          /* ignore */
        }
        sprite.zIndex = 2;
        cardContainer.addChild(sprite);
      } else {
        const placeholder = drawPlaceholderCard(bgW, bgH, c);
        // placeholder already draws its own white background; add it above bg
        cardContainer.addChild(placeholder);
      }

      // ensure children are sorted by zIndex so bg remains behind the sprite
      try {
        (cardContainer as any).sortChildren();
      } catch (e) {
        // ignore if sortChildren not available
      }

      cardContainer.x = dealerStartX + i * cardSpacing;
      cardContainer.y = 290;
      // keep card containers above the table
      cardContainer.zIndex = 10;
      app.stage.addChild(cardContainer);
    }

    // Player
    const playerScore = scoreHand(playerCards);
    const playerLabel = new PIXI.Text({
      text: `Player (${playerScore})`,
      style: { fill: 0xffffff, fontSize: 18 } as any,
    });
    playerLabel.x = (viewportWidthRef.current - playerLabel.width) / 2;
    playerLabel.y = 510;
    app.stage.addChild(playerLabel);

    // Calculate total width for player cards to center them
    const playerTotalWidth =
      playerCards.length * bgW + Math.max(0, playerCards.length - 1) * 8;
    const playerStartX = (viewportWidthRef.current - playerTotalWidth) / 2;

    for (let i = 0; i < playerCards.length; i++) {
      const c = playerCards[i];
      const tex = texturesRef.current[c];

      const cardContainer = new PIXI.Container();
      cardContainer.sortableChildren = true;
      const shadow = new PIXI.Graphics();
      (shadow as any).fill({ color: 0x000000, alpha: 0.14 });
      (shadow as any).roundRect(
        4,
        6,
        cardWidth + pad * 2,
        cardHeight + pad * 2,
        12
      );
      shadow.zIndex = 0;
      cardContainer.addChild(shadow);

      const fillG2 = new PIXI.Graphics();
      (fillG2 as any).beginFill(0xffffff, 1);
      (fillG2 as any).drawRoundedRect(0, 0, bgW, bgH, 10);
      (fillG2 as any).endFill();
      fillG2.zIndex = 1;
      cardContainer.addChild(fillG2);

      const borderG2 = new PIXI.Graphics();
      try {
        (borderG2 as any).lineStyle?.(2, 0x000000, 1);
        (borderG2 as any).drawRoundedRect?.(0, 0, bgW, bgH, 10);
      } catch (e) {
        try {
          (borderG2 as any).setStrokeStyle?.(2, { color: 0x000000 });
          (borderG2 as any).roundRect(0, 0, bgW, bgH, 10);
        } catch (e2) {}
      }
      borderG2.zIndex = 1;
      cardContainer.addChild(borderG2);
      if (tex) {
        const sprite = new PIXI.Sprite(tex);
        sprite.width = cardWidth;
        sprite.height = cardHeight;
        sprite.x = pad;
        sprite.y = pad;
        sprite.alpha = 1;
        try {
          (sprite as any).blendMode =
            ((PIXI as any).BLEND_MODES && (PIXI as any).BLEND_MODES.NORMAL) ||
            0;
          if (sprite.texture && (sprite.texture.baseTexture as any)) {
            (sprite.texture.baseTexture as any).premultipliedAlpha = false;
          }
        } catch (e) {
          /* ignore */
        }
        sprite.zIndex = 2;
        cardContainer.addChild(sprite);
      } else {
        const placeholder = drawPlaceholderCard(bgW, bgH, c);
        cardContainer.addChild(placeholder);
      }

      // ensure children order
      try {
        (cardContainer as any).sortChildren();
      } catch (e) {
        /* ignore */
      }

      // removed internal rank label for cleaner card visuals

      cardContainer.x = playerStartX + i * cardSpacing;
      cardContainer.y = 540;
      cardContainer.zIndex = 10;
      app.stage.addChild(cardContainer);
    }

    // message
    if (message) {
      const msg = new PIXI.Text({
        text: message,
        style: { fill: 0xffffff, fontSize: 20 } as any,
      });
      msg.x = (viewportWidthRef.current - msg.width) / 2;
      msg.y = 540 + 120 + 30;
      app.stage.addChild(msg);
    }

    // finalize ordering: ensure stage sorts children by zIndex
    try {
      app.stage.sortChildren();
    } catch (e) {
      /* ignore */
    }

    // Debug overlay: when DEBUG_HOTPINK_BG is true, draw translucent hot-pink
    // rectangles at each card container position and log child types so we
    // can confirm whether the rounded bg Graphics were added and visible.
    if (DEBUG_HOTPINK_BG) {
      try {
        const cardContainers = app.stage.children.filter(
          (ch) => (ch as any).zIndex === 10
        ) as any[];
        cardContainers.forEach((cont, idx) => {
          try {
            console.log(
              `card[${idx}] children:`,
              (cont as any).children?.map((c: any) => c.constructor?.name)
            );
            const dbg = new PIXI.Graphics();
            if ((dbg as any).beginFill && (dbg as any).drawRect) {
              (dbg as any).beginFill(0xff00ff, 0.18);
              (dbg as any).drawRect((cont as any).x, (cont as any).y, bgW, bgH);
              (dbg as any).endFill?.();
            } else {
              (dbg as any).fill({ color: 0xff00ff, alpha: 0.18 });
              (dbg as any).rect((cont as any).x, (cont as any).y, bgW, bgH);
            }
            dbg.zIndex = 2000;
            app.stage.addChild(dbg);
          } catch (err) {
            /* ignore per-card errors */
          }
        });
        // ensure overlays draw on top
        try {
          app.stage.sortChildren();
        } catch (e) {}
      } catch (err) {
        console.log("debug overlay error", err);
      }
    }
  }

  function drawPlaceholderCard(w: number, h: number, label: string) {
    const g = new PIXI.Graphics();
    (g as any).fill({ color: 0xffffff, alpha: 1 });
    (g as any).setStrokeStyle(2, { color: 0x000000 });
    (g as any).roundRect(0, 0, w, h, 8);
    // no internal text in placeholder - keep card visuals clean
    return g as unknown as PIXI.Sprite;
  }

  function startNewGame() {
    // perform a dealing animation: player, dealer, player, dealer (hole)
    (async () => {
      setMessage("");
      setGameState("dealing");
      const deck = createDeck();
      shuffle(deck);
      deckRef.current = deck;
      // start empty hands
      setPlayerCards([]);
      setDealerCards([]);
      // small delay before dealing
      await sleep(120);

      // deal 1 -> player
      const p1 = deckRef.current.pop()!;
      setPlayerCards((prev) => [...prev, p1]);
      await sleep(220);

      // deal 1 -> dealer (face-up)
      const d1 = deckRef.current.pop()!;
      setDealerCards((prev) => [...prev, d1]);
      await sleep(220);

      // deal 2 -> player
      const p2 = deckRef.current.pop()!;
      setPlayerCards((prev) => [...prev, p2]);
      await sleep(220);

      // deal 2 -> dealer (hole, still face-down until dealer turn)
      const d2 = deckRef.current.pop()!;
      setDealerCards((prev) => [...prev, d2]);

      // small pause then evaluate naturals
      await sleep(200);

      // check for naturals
      const playerScore = scoreHand([p1, p2]);
      const dealerScore = scoreHand([d1, d2]);
      const playerNatural = playerScore === 21;
      const dealerNatural = dealerScore === 21;

      if (playerNatural || dealerNatural) {
        // reveal dealer and settle immediately with flip animation
        if (appRef.current) {
          await revealDealerHoleWithFlip();
        }
        if (playerNatural && !dealerNatural) {
          setMessage(`Blackjack! You win (${playerScore})`);
        } else if (!playerNatural && dealerNatural) {
          setMessage(`Dealer has Blackjack (${dealerScore}) - You lose`);
        } else {
          setMessage(`Push (both Blackjack)`);
        }
        setGameState("settled");
      } else {
        setGameState("player");
      }
    })();
  }

  function playerHit() {
    if (gameState !== "player") return;
    if (deckRef.current.length === 0) return;
    const c = deckRef.current.pop()!;
    const next = [...playerCards, c];
    setPlayerCards(next);
    const s = scoreHand(next);
    if (s > 21) {
      setMessage(`Busted (${s}) - You lose`);
      setGameState("settled");
    }
  }

  function playerStand() {
    if (gameState !== "player") return;
    // start dealer turn flow
    (async () => {
      setGameState("dealer");
      // reveal hole card immediately (render will show it because gameState !== 'player')
      await sleep(300);
      if (appRef.current) await revealDealerHoleWithFlip();

      let d = [...dealerCards];
      // draw until 17 or bust
      while (scoreHand(d) < 17) {
        const c = deckRef.current.pop();
        if (!c) break;
        d.push(c);
        setDealerCards([...d]);
        // small delay between dealer draws for clarity
        await sleep(350);
      }

      // settle
      const playerScore = scoreHand(playerCards);
      const dealerScore = scoreHand(d);
      if (playerScore > 21) setMessage(`Busted (${playerScore}) - You lose`);
      else if (dealerScore > 21)
        setMessage(`Dealer busted (${dealerScore}) - You win`);
      else if (playerScore > dealerScore)
        setMessage(`You win (${playerScore} vs ${dealerScore})`);
      else if (playerScore < dealerScore)
        setMessage(`You lose (${playerScore} vs ${dealerScore})`);
      else setMessage(`Push (${playerScore})`);

      setGameState("settled");
    })();
  }

  // re-render when cards or message change
  useEffect(() => {
    renderScene();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerCards, dealerCards, message, gameState]);

  return (
    <div
      style={{
        width: viewportWidthRef.current,
        height: viewportHeightRef.current,
        padding: 0,
        boxSizing: "border-box",
        margin: 0,
        // transparent frame so the table image fills the phone viewport fully
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

        {/* Buttons overlayed on top of the table, inside the phone viewport */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 18,
            transform: "translateX(-50%)",
            display: "flex",
            gap: 12,
            alignItems: "center",
            pointerEvents: "none", // allow individual buttons to control pointerEvents
          }}
        >
          <button
            onClick={playerHit}
            style={{
              ...buttonStyle,
              pointerEvents: gameState === "player" ? "auto" : "none",
              opacity: gameState === "player" ? 1 : 0.5,
            }}
            aria-label="Hit"
            disabled={gameState !== "player"}
          >
            Hit
          </button>
          <button
            onClick={playerStand}
            style={{
              ...buttonStyle,
              pointerEvents: gameState === "player" ? "auto" : "none",
              opacity: gameState === "player" ? 1 : 0.5,
            }}
            aria-label="Stand"
            disabled={gameState !== "player"}
          >
            Stand
          </button>
          <button
            onClick={() => {
              startNewGame();
            }}
            style={{ ...buttonStyle, pointerEvents: "auto" }}
            aria-label="New Game"
          >
            New Game
          </button>
        </div>
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: 16,
  borderRadius: 8,
  border: "none",
  background: "#111827",
  color: "white",
};
