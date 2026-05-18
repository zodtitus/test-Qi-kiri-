# L'Épreuve du Mizukage · Test de QI Shinobi

Test de QI basé sur le canon RP officiel de **Kirigakure**. 22 questions de logique, déduction et raisonnement, calcul automatique du QI, tableau d'honneur persistant.

## Caractéristiques

- 🎴 **22 manuscrits** RP : armes ancestrales, clans de la Brume, Genjutsu, déduction
- ⚜ **Question impossible bonus** qui débloque +10 QI
- 📊 **Calcul automatique du QI** (60-180) basé sur score + temps
- 🏆 **Tableau d'honneur** persistant en local (localStorage)
- 🎭 **Rangs shinobi** : D · C · B · A · S · SS · X
- 🌫 **Design RP immersif** — palette brume/abysses, typo Cormorant Garamond

## Lancer en local

```bash
npm install
npm run dev
```

Puis ouvrir `http://localhost:5173`.

## Déployer sur Vercel (recommandé, gratuit)

### Méthode 1 — Vercel CLI (le plus rapide, 1 minute)

```bash
npm install -g vercel
vercel
```

Suis les questions (login GitHub si demandé), valide. Le site est en ligne sur `xxx.vercel.app` en ~30s.

### Méthode 2 — Drag & drop sur le dashboard

1. Crée un compte sur https://vercel.com (login GitHub recommandé)
2. Va sur https://vercel.com/new
3. Drag & drop ce dossier entier sur la page
4. Vercel détecte automatiquement Vite → clique **Deploy**
5. URL en ligne en 30s

### Méthode 3 — Via GitHub (le plus propre)

1. Push ce dossier sur un nouveau repo GitHub
2. Sur https://vercel.com/new → "Import Git Repository"
3. Sélectionne ton repo → **Deploy**
4. Tout commit ultérieur redéploiera automatiquement

## Custom domain

Sur Vercel : Settings → Domains → ajoute ton domaine (ex `qi.tonsite.com`). Tu changes les DNS chez ton registrar comme indiqué.

## Personnaliser

- **Questions** : tableau `QUESTIONS` au début de `src/TestQIShinobi.jsx`
- **Rangs** : tableau `RANKS` (seuils QI, couleurs, descriptions)
- **Calcul du QI** : fonction `computeQI()` — facile à ajuster
- **Effacer le tableau d'honneur** : bouton "Effacer" dans l'interface, ou clé `kiri-qi-leaderboard` dans localStorage du navigateur

## Stack

- React 18
- Vite 5
- Aucune dépendance externe au runtime (juste Google Fonts via CDN)
- localStorage pour le tableau d'honneur (persistant par appareil/navigateur)
