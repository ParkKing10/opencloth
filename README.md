# THREADOS — opencloth

Die All-in-One Fashion Plattform. **Entwirf. Produziere. Skaliere.**
Ein Canva-artiges Design-Tool speziell für Kleidung – von der ersten Idee bis zur Produktion: Design, Tech Packs, Hersteller & mehr an einem Ort.

## Stack

- **Vite** + **React 18** + **TypeScript**
- Token-basiertes CSS (CSS Custom Properties, feature-orientierte Ordnerstruktur)
- Keine schweren UI-Dependencies – das Produkt-Visual ist Inline-SVG

## Entwicklung

```bash
npm install
npm run dev      # Dev-Server auf http://localhost:5173
npm run build    # Produktions-Build (tsc + vite)
npm run preview  # Build lokal ansehen
```

## Struktur

```
src/
├── components/
│   ├── navbar/      # Header, Navigation, Sprachwähler, CTAs
│   ├── hero/        # Headline, CTAs, Produkt-Visual (SVG)
│   ├── logo-bar/    # "Vertraut von" Partner-Wordmarks
│   ├── stats/       # Kennzahlen-Karten
│   └── ui/          # Logo, Icons
└── styles/
    ├── tokens.css   # Design-Tokens (Farben, Typo, Spacing, Motion)
    └── global.css   # Reset, Basis, Buttons
```

## Design-Tokens

- Background `#070708` · Surface `#121214`
- Akzent (Lime) `#D1F94F`
- Font: Inter (400–900)

## Status

Landing-Page Hero-Sektion (Navbar, Hero, Partner-Leiste, Stats) fertig.
Nächste Schritte: weitere Landing-Sektionen, fotorealistischer Produkt-Render, der eigentliche Klamotten-Editor (Canvas).
