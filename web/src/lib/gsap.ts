import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export { gsap, ScrollTrigger, useGSAP };

if (import.meta.env.DEV) Object.assign(window, { gsap, ScrollTrigger }); // handy for debugging in devtools
