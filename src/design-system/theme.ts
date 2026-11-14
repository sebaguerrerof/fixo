export const THEME_STORAGE_KEY = "soyfixo-theme";

/**
 * Runs before first paint so there is no flash of the wrong theme. It only reads a stored "light"/"dark"
 * preference or the OS setting; no user data is involved. Each source is read in its own try/catch, so blocked
 * storage still falls back to the system preference.
 */
export const themeInitScript = `(function(){var d=document.documentElement,s=null,m=false;try{s=localStorage.getItem("${THEME_STORAGE_KEY}")}catch(e){}try{m=window.matchMedia("(prefers-color-scheme: dark)").matches}catch(e){}if(s==="dark"||(s!=="light"&&m))d.classList.add("dark")})();`;
