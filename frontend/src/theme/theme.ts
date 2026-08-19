/** EngageVision "Signal Fusion" visual system.
 *
 * Concept 7 translated into a brighter production palette: champagne for
 * actions, blue/coral for the two input streams, and lifted midnight surfaces
 * for readable depth. The 3D effect comes from highlights, borders and shadow
 * layers rather than decorative assets.
 */
export const colors = {
  background: "#0B1017",
  backgroundAlt: "#111A24",
  backgroundRaised: "#1A2632",
  card: "rgba(22,32,43,0.96)",
  cardTop: "rgba(32,45,58,0.99)",
  cardBottom: "rgba(15,23,33,0.99)",
  cardBorder: "rgba(235,215,184,0.20)",
  cardHighlight: "rgba(255,247,232,0.13)",
  input: "rgba(10,17,25,0.76)",
  text: "#FFF9EF",
  textMuted: "#D4CFC6",
  textFaint: "#9298A2",

  primary: "#E8C58F",
  primarySoft: "rgba(232,197,143,0.14)",
  primaryBorder: "rgba(232,197,143,0.42)",

  gradientStart: "#D8AE73",
  gradientMid: "#E7C893",
  gradientEnd: "#F4DDB4",

  purple: "#B8A2FF",
  purpleSoft: "rgba(139,112,255,0.14)",
  blue: "#4BA8FF",
  cyan: "#43D7CA",
  cyanSoft: "rgba(67,215,202,0.12)",
  coral: "#FF806B",
  coralSoft: "rgba(255,128,107,0.13)",

  green: "#65E3A5",
  greenSoft: "rgba(44,198,132,0.14)",
  greenBorder: "rgba(101,227,165,0.32)",

  red: "#F87171",
  redSoft: "rgba(248,113,113,0.12)",
  redBorder: "rgba(248,113,113,0.32)",

  amber: "#FFCA80",
  amberSoft: "rgba(255,170,76,0.12)",
  amberBorder: "rgba(255,202,128,0.30)",
};

export const gradients = {
  primary: [colors.gradientStart, colors.gradientMid, colors.gradientEnd] as const,
  hero: ["#1E4D82", "#176E89", "#9A5B4D"] as const,
  surface: [colors.cardTop, colors.cardBottom] as const,
  surfaceSoft: ["rgba(37,50,64,0.94)", "rgba(14,22,31,0.98)"] as const,
  success: ["#176F67", "#142C32"] as const,
  warning: ["#8A6032", "#392A2E"] as const,
  signalFusion: ["#2478D4", "#17293B", "#8E463C"] as const,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const typography = {
  h1: { fontSize: 30, fontWeight: "900" as const, letterSpacing: -0.8 },
  h2: { fontSize: 20, fontWeight: "800" as const, letterSpacing: -0.3 },
  h3: { fontSize: 15, fontWeight: "700" as const },
  body: { fontSize: 14, fontWeight: "400" as const },
  caption: { fontSize: 12, fontWeight: "500" as const },
  label: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 0.5 },
};

export const shadows = {
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.34,
    shadowRadius: 22,
    elevation: 10,
  },
  glow: {
    shadowColor: "#E8C58F",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
    elevation: 8,
  },
};
