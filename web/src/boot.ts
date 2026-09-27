// Runs before React: apply saved theme + language so there's no flash of the wrong one.
import { applyPrefs, readPrefs } from "./lib/prefs";

applyPrefs(readPrefs());
