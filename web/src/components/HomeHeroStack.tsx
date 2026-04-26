import { useEffect, useState } from "react";

const HERO_CARDS = [
  {
    id: "card-1",
    label: "Recipe fragment",
    title: "Panela, cloves, and a missing word",
    body: "A brittle card, a half-faded ingredient, and the one pronunciation only an elder still remembers.",
  },
  {
    id: "card-2",
    label: "Family letter",
    title: "A note written between three languages",
    body: "Handwritten lines drift between memory and translation until a speaker brings the real meaning back.",
  },
  {
    id: "card-3",
    label: "Song scrap",
    title: "Lyrics carried by voice, not spelling",
    body: "The page keeps the words. The recording keeps the breath, rhythm, and the way the family actually says them.",
  },
];

export function HomeHeroStack() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % HERO_CARDS.length);
    }, 3400);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="home-stack" aria-hidden="true">
      {HERO_CARDS.map((card, index) => {
        const offset = (index - activeIndex + HERO_CARDS.length) % HERO_CARDS.length;
        const slotClass =
          offset === 0 ? " is-front" :
          offset === 1 ? " is-mid" :
          " is-back";

        return (
          <article key={card.id} className={`home-stack-card${slotClass}`}>
            <div className="home-stack-card-no">{card.label}</div>
            <h3 className="home-stack-card-title">{card.title}</h3>
            <div className="home-stack-card-rule" />
            <p className="home-stack-card-body">{card.body}</p>
            <span className="home-stack-card-grain" />
          </article>
        );
      })}
      <div className="home-stack-glow" />
    </div>
  );
}
