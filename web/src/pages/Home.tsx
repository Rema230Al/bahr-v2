import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Dive from "../components/sections/Dive";
import Contact from "../components/sections/Contact";
import Finale from "../components/sections/Finale";
import { ScrollTrigger } from "../lib/gsap";
import { scrollToStop, scrollToTarget } from "../lib/scroll";

const STOPS = ["agency", "expertise", "work", "deeper"];

export default function Home() {
  const { hash } = useLocation();

  // Deep links like /#work from other pages: wait for the pinned timeline to measure, then dive there.
  useEffect(() => {
    const id = hash.replace("#", "");
    if (!id) return;
    const timer = window.setTimeout(() => {
      ScrollTrigger.refresh();
      const i = STOPS.indexOf(id);
      if (i >= 0) scrollToStop(id, i);
      else if (id === "contact") scrollToTarget("#contact", 2.5);
    }, 350);
    return () => clearTimeout(timer);
  }, [hash]);

  return (
    <>
      <Dive />
      <Contact />
      <Finale />
    </>
  );
}
