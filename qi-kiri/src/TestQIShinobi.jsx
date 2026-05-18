import { useState, useEffect } from "react";
import {
  LOCAL_LEADERBOARD_KEY,
  clearLocalLeaderboard,
  clearRemoteLeaderboard,
  deleteLocalEntry,
  deleteRemoteLeaderboardEntry,
  fetchAdminLeaderboard,
  fetchLeaderboard,
  loadLocalLeaderboard,
  submitLeaderboardEntry,
} from "./leaderboardClient.js";

/**
 * L'Épreuve du Mizukage — Test de QI shinobi (Kirigakure)
 *
 * QI = 70 + (score_ratio × 75) + bonus_temps + bonus_secret  → 60-180
 * Rangs : D · C · B · A · S · SS · X
 *
 * ┌─────────────────────────────────────┐
 * │  MOT DE PASSE ADMIN — À MODIFIER    │
 * └─────────────────────────────────────┘
 */
const ADMIN_PASSWORD = "inkuze"; // ← Mot de passe de secours pour le mode local

const QUESTIONS = [
  // ─── FONDATIONS ───
  {
    section: "Fondations",
    diff: 1,
    pts: 1,
    q: "Quelle nature de chakra règne à Kiri, considérée comme la « reine » du village ?",
    choices: ["Katon", "Suiton", "Fūton", "Doton"],
    answer: 1,
  },
  {
    section: "Fondations",
    diff: 1,
    pts: 1,
    q: "L'Art Sensoriel reconnaît 7 sens : les 5 fondamentaux, l'Instinct (6e), et ___ (7e).",
    choices: ["L'âme ancestrale", "Le Monde de l'Invisible", "L'écho du chakra", "La voix des abysses"],
    answer: 1,
  },
  {
    section: "Fondations",
    diff: 1,
    pts: 1,
    q: "« Joindre les doigts, c'est rappeler au monde que le silence est une arme. » Combien de mudrās majeurs existent ?",
    choices: ["7", "10", "12", "13"],
    answer: 2,
  },

  // ─── ARMES & FORGES ───
  {
    section: "Armes & Forges",
    diff: 1,
    pts: 1,
    q: "La Saya Naginata fut forgée en hommage à un samouraï tragique, pour offrir une voie aux sans-clan. Qui était-il ?",
    choices: ["Daizo Kurokaze", "Saya Tensho", "Mizugami Hoshigaki", "Kazuyori Karatachi"],
    answer: 1,
  },
  {
    section: "Armes & Forges",
    diff: 2,
    pts: 2,
    q: "La Lame Noire, originelle du Pays du Vent, chante quand un orage approche. Quelle nature de chakra dort dans son noyau ?",
    choices: ["Raiton", "Fūton", "Katon", "Suiton"],
    answer: 1,
  },
  {
    section: "Armes & Forges",
    diff: 2,
    pts: 2,
    q: "Comment un adepte de Jashin active-t-il le lien miroir avec sa victime via la faux à 3 lames ?",
    choices: [
      "Il trace un sceau dans le sang de la victime",
      "Il prononce une prière à Jashin trois fois",
      "Il lèche la lame après y avoir versé son sang",
      "Il transperce sa propre paume avec la faux",
    ],
    answer: 2,
  },
  {
    section: "Armes & Forges",
    diff: 2,
    pts: 2,
    q: "Qui a forgé la Kusarigama empoisonnée — chaîne et faucille dont chaque maillon peut être enduit de poison ?",
    choices: ["Madara Uchiha", "Daizo Kurokaze", "Habizumo Kirizami", "Mizugami Hoshigaki"],
    answer: 1,
  },
  {
    section: "Armes & Forges",
    diff: 3,
    pts: 3,
    q: "Une lame samouraï imbibée de sang séché, qui semble respirer et ne s'éveille qu'au contact d'un véritable combattant — laquelle est-ce ?",
    choices: ["Tenshiken", "Hana no Ken", "Nozarashi", "Saya Naginata"],
    answer: 2,
  },
  {
    section: "Armes & Forges",
    diff: 3,
    pts: 3,
    q: "Lien Jashin scellé : le porteur frappe la victime au sabre dans la main droite tout en se taillant volontairement la main gauche. Que subit la victime ?",
    choices: [
      "Uniquement les dégâts du sabre direct",
      "Uniquement le miroir — le sabre est annulé",
      "Le miroir ET les dégâts du sabre, simultanément",
      "Le lien rituel est rompu par la double action",
    ],
    answer: 2,
  },

  // ─── CLANS DE LA BRUME ───
  {
    section: "Clans de la Brume",
    diff: 1,
    pts: 1,
    q: "Quel Kekkei Genkai définit le clan Hōzuki, leur permettant de liquéfier leur chair entière ?",
    choices: ["Kirisogan", "Suika no Jutsu", "Hyōton", "Mokuton"],
    answer: 1,
  },
  {
    section: "Clans de la Brume",
    diff: 1,
    pts: 1,
    q: "Quelle pupille unique du clan Karatachi perce la brume la plus dense et permet d'en manipuler la densité ?",
    choices: ["Byakugan", "Kirisogan", "Shōton", "Meiton"],
    answer: 1,
  },
  {
    section: "Clans de la Brume",
    diff: 2,
    pts: 2,
    q: "Quel clan dirige l'Académie de Kirigakure, transmettant la philosophie de la Brume Sanglante ?",
    choices: ["Hōzuki", "Karatachi", "Hoshigaki", "Yokushin"],
    answer: 2,
  },
  {
    section: "Clans de la Brume",
    diff: 2,
    pts: 2,
    q: "Les Yokushin — « chiens de brume » sans noms propres — appartiennent corps et âme à quel clan ?",
    choices: ["Karatachi", "Hoshigaki", "Hōzuki", "Aucun — ils sont libres"],
    answer: 2,
  },
  {
    section: "Clans de la Brume",
    diff: 3,
    pts: 3,
    q: "Un Hoshigaki d'une patience infinie qui frappe d'un seul coup chirurgical, sans un mot. À quelle lignée de son clan appartient-il ?",
    choices: ["Requins Noirs", "Requins Blancs", "Lignée Yokushin", "Lignée Karatachi"],
    answer: 1,
  },
  {
    section: "Clans de la Brume",
    diff: 3,
    pts: 3,
    q: "Kazuyori Karatachi, le « Faucheur de la Brume », gouverna durant l'ère la plus sombre. Quel rang occupait-il parmi les Mizukage ?",
    choices: ["2ᵉ Mizukage", "4ᵉ Mizukage", "7ᵉ Mizukage", "12ᵉ Mizukage"],
    answer: 1,
  },

  // ─── COURANTS DU GENJUTSU ───
  {
    section: "Courants du Genjutsu",
    diff: 2,
    pts: 2,
    q: "En Zone Crépusculaire (Jagetsu Hōzuki), le Genjutsu agit sur l'interprétation, pas sur la perception brute. Que vit la cible ?",
    choices: [
      "Elle voit normalement et raisonne clairement",
      "Elle voit mais interprète de façon déformée et perd ses repères",
      "Elle est totalement aveuglée par l'illusion",
      "Elle voit avec une acuité amplifiée",
    ],
    answer: 1,
  },
  {
    section: "Courants du Genjutsu",
    diff: 3,
    pts: 3,
    q: "Un scelleur maîtrise parfaitement son Shodō et son chakra, mais son esprit est troublé par des émotions violentes. Selon les 3 piliers du Fūinjutsu, qu'arrivera-t-il à ses sceaux ?",
    choices: [
      "Ils seront parfaits — la technique compense l'esprit",
      "Ils seront instables — un esprit troublé engendre des sceaux instables",
      "Le chakra explosera immédiatement à l'écriture",
      "Ils seront plus puissants grâce à l'intensité émotionnelle",
    ],
    answer: 1,
  },
  {
    section: "Courants du Genjutsu",
    diff: 4,
    pts: 5,
    q: "Un médecin-ninja attaque un Maître du Genjutsu au Shakuton (chaleur interne, évaporation des fluides, sans contact). Le Maître devrait être protégé par son architecture mentale — pourquoi cela le brise-t-il quand même ?",
    choices: [
      "Le Shakuton désactive les tenketsu et empêche tout Genjutsu",
      "Le Shakuton est immunisé contre le Genjutsu par nature élémentaire",
      "La souffrance interne du Shakuton fissure l'architecture mentale via la « douleur »",
      "Le Shakuton paralyse les mudrās nécessaires à la résistance",
    ],
    answer: 2,
  },

  // ─── RAISONNEMENT ───
  {
    section: "Raisonnement",
    diff: 2,
    pts: 2,
    q: "« Le Kuroi Kaminari est au Raiton classique ce que la Zone Abyssale est à la Zone Lumineuse. » Que doit-on en conclure ?",
    choices: [
      "Le Kuroi Kaminari est une version affaiblie du Raiton",
      "Le Kuroi Kaminari transcende le Raiton, comme l'Abyssale dépasse la Lumineuse",
      "Les deux sont identiques, juste de couleurs différentes",
      "Le Kuroi Kaminari est l'élément opposé du Raiton",
    ],
    answer: 1,
  },
  {
    section: "Raisonnement",
    diff: 3,
    pts: 3,
    q: "Les Karatachi méprisent le clan Mugen de Suna, qualifié de « parodies sans honneur ». Sachant que les Karatachi sont maîtres de l'assassinat silencieux, quelle est la cause LOGIQUE de ce mépris ?",
    choices: [
      "Les Mugen ont trahi un pacte ancien avec Kiri",
      "Les Mugen tentent d'imiter l'art de l'ombre des Karatachi",
      "Les Mugen ont assassiné un Mizukage Karatachi",
      "Les Mugen possèdent un Kekkei Genkai similaire au Kirisogan",
    ],
    answer: 1,
  },
  {
    section: "Raisonnement",
    diff: 4,
    pts: 4,
    q: "La prothèse d'Habizumo connecte des tenketsu synthétiques au moignon, MAIS ne remplace pas les terminaisons nerveuses détruites. Quelle conséquence LOGIQUE pour l'utilisateur ?",
    choices: [
      "La prothèse est inutilisable en combat",
      "L'utilisateur doit acquérir une maîtrise fine du chakra pour piloter le bras",
      "Le bras ne fonctionne qu'avec une infusion constante de Suiton",
      "L'utilisateur perd toute sensation dans son autre bras",
    ],
    answer: 1,
  },

  // ─── ÉPREUVE FINALE ───
  {
    section: "Épreuve Finale",
    diff: 5,
    pts: 12,
    impossible: true,
    q: "Mizugami Hoshigaki, le « Démon de la Brume », fut sensei de Yogetsu Hōzuki, assassina le 6ᵉ Mizukage Reigetsu, et fut exécuté en secret par Nagegetsu — 7ᵉ Mizukage. Yogetsu devint plus tard le 8ᵉ Mizukage. Place ces 5 événements dans l'ordre chronologique strict : (A) Yogetsu devient 8ᵉ Mizukage · (B) Mizugami forme Yogetsu · (C) Mizugami tue Reigetsu · (D) Nagegetsu accède au titre de 7ᵉ Mizukage · (E) Nagegetsu fait exécuter Mizugami en secret.",
    choices: [
      "B → C → D → E → A",
      "C → B → D → E → A",
      "B → D → C → E → A",
      "B → C → E → D → A",
    ],
    answer: 0,
  },
];

const NORMAL_MAX = QUESTIONS.filter((q) => !q.impossible).reduce((s, q) => s + q.pts, 0);
const TOTAL_MAX = QUESTIONS.reduce((s, q) => s + q.pts, 0);
const TIME_BONUS_MAX = 25;
const TIME_ELITE_SEC = 3 * 60;
const TIME_TARGET_SEC = 4 * 60;
const TIME_CAP_100_SEC = 10 * 60;
const TIME_FLOOR_SEC = 15 * 60;
const TIME_PENALTY_AT_10_MIN = -55;
const TIME_PENALTY_MIN = -65;

const RANKS = [
  { label: "X", min: 145, color: "#F0D060", bg: "rgba(240,208,96,0.12)", border: "#F0D060", desc: "Conscience au-delà du classement", flavor: "« La Brume t'a reconnu comme l'une des siennes. »" },
  { label: "SS", min: 130, color: "#7FD4C0", bg: "rgba(127,212,192,0.12)", border: "#7FD4C0", desc: "Maître des courants invisibles", flavor: "« Le Mizukage te convoquera. »" },
  { label: "S", min: 115, color: "#5FA8D4", bg: "rgba(95,168,212,0.12)", border: "#5FA8D4", desc: "Élite shinobi de la Brume", flavor: "« Ton esprit affûté impressionnerait les anciens Hōzuki. »" },
  { label: "A", min: 105, color: "#9F8AE0", bg: "rgba(159,138,224,0.12)", border: "#9F8AE0", desc: "Jōnin accompli", flavor: "« Tu navigues la Brume sans t'y perdre. »" },
  { label: "B", min: 95, color: "#C8A04A", bg: "rgba(200,160,74,0.12)", border: "#C8A04A", desc: "Chūnin prometteur", flavor: "« Tu pressens la déformation. La maîtrise viendra. »" },
  { label: "C", min: 85, color: "#D88A60", bg: "rgba(216,138,96,0.12)", border: "#D88A60", desc: "Genin en formation", flavor: "« La surface t'aveugle encore. Descends plus profond. »" },
  { label: "D", min: 0, color: "#8090A0", bg: "rgba(128,144,160,0.12)", border: "#8090A0", desc: "Académicien débutant", flavor: "« La Brume te reste opaque. Reviens méditer. »" },
];

const DIFF_COLORS = ["", "#7FD4C0", "#C8A04A", "#D88A60", "#E06070", "#F0D060"];
const DIFF_LABELS = ["", "Facile", "Moyen", "Difficile", "Expert", "Impossible"];

function getRank(qi) {
  return RANKS.find((r) => qi >= r.min) || RANKS[RANKS.length - 1];
}

function computeTimeAdjustment(elapsedSec) {
  if (elapsedSec <= TIME_ELITE_SEC) {
    return TIME_BONUS_MAX;
  }

  if (elapsedSec <= TIME_TARGET_SEC) {
    const ratio = (elapsedSec - TIME_ELITE_SEC) / (TIME_TARGET_SEC - TIME_ELITE_SEC);
    return Math.round(TIME_BONUS_MAX * (1 - ratio));
  }

  if (elapsedSec <= TIME_CAP_100_SEC) {
    const ratio = (elapsedSec - TIME_TARGET_SEC) / (TIME_CAP_100_SEC - TIME_TARGET_SEC);
    return Math.round(TIME_PENALTY_AT_10_MIN * ratio);
  }

  if (elapsedSec <= TIME_FLOOR_SEC) {
    const ratio = (elapsedSec - TIME_CAP_100_SEC) / (TIME_FLOOR_SEC - TIME_CAP_100_SEC);
    return Math.round(
      TIME_PENALTY_AT_10_MIN + (TIME_PENALTY_MIN - TIME_PENALTY_AT_10_MIN) * ratio
    );
  }

  return TIME_PENALTY_MIN;
}

function computeQI(score, elapsedSec, bonusEarned) {
  const baseRatio = Math.min(1, score / NORMAL_MAX);
  const base = 70 + baseRatio * 75;
  const timeBonus = computeTimeAdjustment(elapsedSec);
  const secretBonus = bonusEarned ? 10 : 0;
  return Math.max(60, Math.min(180, Math.round(base + timeBonus + secretBonus)));
}

function exportCSV(entries) {
  const headers = ["Rang_classement", "Nom", "QI", "Rang", "Score", "Temps_secondes", "Bonus_resolu", "Date", ...QUESTIONS.map((_, i) => `Q${i + 1}_correct`)];
  const rows = entries.map((e, i) => [
    i + 1,
    `"${e.name.replace(/"/g, '""')}"`,
    e.qi,
    e.rank,
    e.score,
    e.time,
    e.bonus ? "OUI" : "NON",
    e.date,
    ...(e.answers || []).map((a, qi) => (a === QUESTIONS[qi].answer ? "1" : "0")),
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kiri-leaderboard-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function TestQIShinobi() {
  const [screen, setScreen] = useState("intro"); // intro | test | results | admin-login | admin
  const [name, setName] = useState("");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState(() => new Array(QUESTIONS.length).fill(-1));
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentEntryId, setCurrentEntryId] = useState(null);
  const [adminPwd, setAdminPwd] = useState("");
  const [adminSessionPassword, setAdminSessionPassword] = useState("");
  const [adminError, setAdminError] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [syncMode, setSyncMode] = useState("loading");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function refreshLeaderboard() {
    const result = await fetchLeaderboard();
    setLeaderboard(result.entries);
    setSyncMode(result.mode);
  }

  useEffect(() => {
    refreshLeaderboard();
  }, []);

  useEffect(() => {
    if (screen === "admin") return;

    const poll = setInterval(() => {
      refreshLeaderboard();
    }, 4000);

    return () => clearInterval(poll);
  }, [screen]);

  useEffect(() => {
    if (syncMode !== "local") return;

    const handleStorage = (event) => {
      if (!event.key || event.key === LOCAL_LEADERBOARD_KEY) {
        setLeaderboard(loadLocalLeaderboard());
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [syncMode]);

  useEffect(() => {
    if (screen !== "test") return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(t);
  }, [screen, startTime]);

  const handleStart = () => {
    if (!name.trim()) return;
    setAnswers(new Array(QUESTIONS.length).fill(-1));
    setIdx(0);
    setStartTime(Date.now());
    setEndTime(0);
    setElapsed(0);
    setScreen("test");
  };

  const handleSelect = (i) => {
    const next = [...answers];
    next[idx] = i;
    setAnswers(next);
  };

  const handleNext = async () => {
    if (idx < QUESTIONS.length - 1) {
      setIdx(idx + 1);
      return;
    }

    if (isSubmitting) return;

    const finalEnd = Date.now();
    setEndTime(finalEnd);
    setIsSubmitting(true);

    try {
      const totalSec = Math.round((finalEnd - startTime) / 1000);
      const normalScore = QUESTIONS.reduce(
        (s, q, i) => (!q.impossible && answers[i] === q.answer ? s + q.pts : s),
        0
      );
      const bonusEarned = answers[QUESTIONS.length - 1] === QUESTIONS[QUESTIONS.length - 1].answer;
      const qi = computeQI(normalScore, totalSec, bonusEarned);
      const rank = getRank(qi);
      const entryId = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      const entry = {
        id: entryId,
        name: name.trim().slice(0, 24),
        qi,
        rank: rank.label,
        score: normalScore + (bonusEarned ? QUESTIONS[QUESTIONS.length - 1].pts : 0),
        time: totalSec,
        bonus: bonusEarned,
        date: new Date().toISOString(),
        answers: [...answers], // sauvegarde détaillée pour l'admin
      };

      const result = await submitLeaderboardEntry(entry);
      setLeaderboard(result.entries);
      setSyncMode(result.mode);
      setCurrentEntryId(entryId);
      setScreen("results");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrev = () => idx > 0 && setIdx(idx - 1);

  const handleRestart = () => {
    setScreen("intro");
    setIdx(0);
    setName("");
    setCurrentEntryId(null);
    refreshLeaderboard();
  };

  const handleExitAdmin = () => {
    setScreen("intro");
    setExpandedRow(null);
    setAdminPwd("");
    setAdminError(false);
    setAdminSessionPassword("");
    refreshLeaderboard();
  };

  const handleAdminLogin = async () => {
    if (syncMode === "shared") {
      try {
        const result = await fetchAdminLeaderboard(adminPwd);
        setLeaderboard(result.entries);
        setSyncMode(result.mode);
        setAdminSessionPassword(adminPwd);
        setAdminError(false);
        setAdminPwd("");
        setExpandedRow(null);
        setScreen("admin");
      } catch {
        setAdminError(true);
      }
      return;
    }

    if (adminPwd === ADMIN_PASSWORD) {
      setAdminError(false);
      setAdminPwd("");
      setScreen("admin");
    } else {
      setAdminError(true);
    }
  };

  const handleClearLeaderboard = async () => {
    if (confirm("Effacer DÉFINITIVEMENT le tableau d'honneur ?\nCette action est irréversible.")) {
      if (syncMode === "shared") {
        try {
          const result = await clearRemoteLeaderboard(adminSessionPassword);
          setLeaderboard(result.entries);
          setExpandedRow(null);
        } catch {
          setAdminError(true);
        }
        return;
      }

      clearLocalLeaderboard();
      setLeaderboard([]);
      setExpandedRow(null);
    }
  };

  const handleDeleteEntry = async (id) => {
    if (confirm("Supprimer cette entrée du tableau ?")) {
      if (syncMode === "shared") {
        try {
          const result = await deleteRemoteLeaderboardEntry(id, adminSessionPassword);
          setLeaderboard(result.entries);
          setExpandedRow(null);
        } catch {
          setAdminError(true);
        }
        return;
      }

      const updated = deleteLocalEntry(id);
      setLeaderboard(updated);
      setExpandedRow(null);
    }
  };

  const normalScore = QUESTIONS.reduce(
    (s, q, i) => (!q.impossible && answers[i] === q.answer ? s + q.pts : s),
    0
  );
  const bonusEarned = answers[QUESTIONS.length - 1] === QUESTIONS[QUESTIONS.length - 1].answer;
  const totalScore = normalScore + (bonusEarned ? QUESTIONS[QUESTIONS.length - 1].pts : 0);
  const totalSec = Math.round((endTime - startTime) / 1000);
  const qi = screen === "results" ? computeQI(normalScore, totalSec, bonusEarned) : 0;
  const rank = screen === "results" ? getRank(qi) : null;

  const currentQ = QUESTIONS[idx];
  const isImpossible = currentQ?.impossible;

  return (
    <div style={styles.root}>
      <style>{globalCSS}</style>
      <div style={styles.atmosphere} />

      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.crest}>水</div>
          <div style={{ flex: 1 }}>
            <div style={styles.eyebrow}>PARCHEMIN D'ÉVALUATION · BIBLIOTHÈQUE DE LA BRUME</div>
            <h1 style={styles.title}>L'Épreuve du Mizukage</h1>
            <div style={styles.subtitle}>« La Brume ne juge pas ce que tu sais — elle juge ce que tu comprends. »</div>
          </div>
        </div>

        {/* INTRO + NOM + LEADERBOARD COMPLET */}
        {screen === "intro" && (
          <div className="qi-fade">
            <div style={styles.card}>
              <p style={styles.body}>
                <strong>{QUESTIONS.length} questions</strong> sur Kirigakure : armes, clans, Genjutsu, logique. Ton QI dépend de la justesse de tes réponses et de ta vitesse.
              </p>
              <p style={{ ...styles.body, color: "#F0D060", marginTop: 10 }}>
                ⚜ La dernière question est très difficile — la réussir donne <strong>+10 QI</strong>.
              </p>
            </div>

            <div style={styles.card}>
              <label style={styles.cardTitle}>Nom du shinobi</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
                placeholder="Inscris ton nom dans le registre…"
                style={styles.nameInput}
                maxLength={24}
                autoFocus
              />
              <div style={{ fontSize: 11, color: "#8090A0", marginTop: 8 }}>
                Ce nom sera inscrit au Tableau d'Honneur de la Brume.
              </div>
            </div>

            <button
              style={{ ...styles.btnPrimary, opacity: name.trim() ? 1 : 0.5, cursor: name.trim() ? "pointer" : "not-allowed" }}
              onClick={handleStart}
              disabled={!name.trim()}
            >
              ⚔ Commencer l'épreuve
            </button>

            <div style={styles.statGrid}>
              <Stat label="Questions" value={QUESTIONS.length} />
              <Stat label="Points max" value={TOTAL_MAX} />
              <Stat label="Temps cible" value={`~${Math.round(TIME_TARGET_SEC / 60)} min`} />
              <Stat label="Rangs" value="D → X" />
            </div>

            {/* TABLEAU D'HONNEUR COMPLET */}
            <div style={styles.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={styles.cardTitle}>
                  ⛩ Tableau d'Honneur de la Brume {leaderboard.length > 0 && <span style={{ color: "#8090A0", fontSize: 11 }}>({leaderboard.length})</span>}
                </div>
              </div>
              <SyncStatus mode={syncMode} />
              <LeaderboardTable entries={leaderboard} />
            </div>

            <div style={styles.card}>
              <div style={styles.cardTitle}>Échelle des rangs</div>
              <div style={styles.rankGrid}>
                {RANKS.slice().reverse().map((r) => {
                  const next = RANKS[RANKS.findIndex((x) => x.label === r.label) - 1];
                  return (
                    <div key={r.label} style={{ ...styles.rankCell, background: r.bg, border: `1px solid ${r.border}55` }}>
                      <div style={{ color: r.color, fontSize: 18, fontWeight: 600 }}>{r.label}</div>
                      <div style={{ ...styles.dim, fontSize: 11 }}>
                        {r.label === "D" ? "<85" : r.label === "X" ? "≥145" : `${r.min}-${next.min - 1}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* BOUTON ADMIN DISCRET */}
            <div style={{ textAlign: "center", marginTop: 24, opacity: 0.5 }}>
              <button style={styles.linkBtn} onClick={() => setScreen("admin-login")}>
                🔒 Accès administrateur
              </button>
            </div>
          </div>
        )}

        {/* ADMIN LOGIN */}
        {screen === "admin-login" && (
          <div className="qi-fade">
            <div style={styles.card}>
              <div style={styles.cardTitle}>🔒 Accès administrateur</div>
              <p style={{ ...styles.body, fontSize: 13, marginBottom: 16 }}>
                Entre le mot de passe pour accéder aux détails complets du tableau d'honneur.
              </p>
              <input
                type="password"
                value={adminPwd}
                onChange={(e) => { setAdminPwd(e.target.value); setAdminError(false); }}
                onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
                placeholder="Mot de passe"
                style={{ ...styles.nameInput, fontFamily: "'Inter', sans-serif", fontSize: 15, borderColor: adminError ? "#E06070" : "rgba(232,216,184,0.2)" }}
                autoFocus
              />
              {adminError && (
                <div style={{ color: "#E06070", fontSize: 12, marginTop: 8 }}>
                  {syncMode === "shared"
                    ? "Mot de passe incorrect, ou stockage partagé non configuré sur Vercel."
                    : "Mot de passe incorrect."}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button style={styles.btnSecondary} onClick={() => { setScreen("intro"); setAdminPwd(""); setAdminError(false); }}>
                  ← Retour
                </button>
                <button
                  style={{ ...styles.btnPrimary, margin: 0, flex: 1, opacity: adminPwd ? 1 : 0.5, cursor: adminPwd ? "pointer" : "not-allowed" }}
                  onClick={handleAdminLogin}
                  disabled={!adminPwd}
                >
                  Déverrouiller
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ADMIN PANEL */}
        {screen === "admin" && (
          <div className="qi-fade">
            <div style={{ ...styles.card, background: "rgba(240,208,96,0.08)", borderColor: "rgba(240,208,96,0.35)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ ...styles.eyebrow, color: "#F0D060" }}>MODE ADMINISTRATEUR</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: "#F0D060" }}>Détails complets · {leaderboard.length} participant{leaderboard.length > 1 ? "s" : ""}</div>
                </div>
                <button style={styles.btnSecondary} onClick={handleExitAdmin}>
                  Quitter le mode admin
                </button>
              </div>
            </div>

            {/* Stats globales */}
            {leaderboard.length > 0 && (
              <div style={styles.statGrid}>
                <Stat label="Participants" value={leaderboard.length} />
                <Stat label="QI moyen" value={Math.round(leaderboard.reduce((s, e) => s + e.qi, 0) / leaderboard.length)} />
                <Stat label="QI max" value={Math.max(...leaderboard.map((e) => e.qi))} />
                <Stat label="Bonus résolu" value={leaderboard.filter((e) => e.bonus).length} />
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <button
                style={{ ...styles.btnSecondary, opacity: leaderboard.length ? 1 : 0.4 }}
                onClick={() => exportCSV(leaderboard)}
                disabled={!leaderboard.length}
              >
                📥 Exporter en CSV
              </button>
              <button
                style={{ ...styles.btnSecondary, color: "#E06070", borderColor: "rgba(224,96,112,0.4)", opacity: leaderboard.length ? 1 : 0.4 }}
                onClick={handleClearLeaderboard}
                disabled={!leaderboard.length}
              >
                🗑 Tout effacer
              </button>
            </div>

            {/* Tableau détaillé */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>Tous les participants — clique pour voir les détails</div>
              {leaderboard.length === 0 ? (
                <div style={{ fontSize: 13, color: "#8090A0", textAlign: "center", padding: "20px 0" }}>
                  Aucun participant pour l'instant.
                </div>
              ) : (
                <div>
                  {leaderboard.map((e, i) => {
                    const r = RANKS.find((x) => x.label === e.rank) || RANKS[RANKS.length - 1];
                    const isExpanded = expandedRow === e.id;
                    const correctCount = (e.answers || []).filter((a, qi) => a === QUESTIONS[qi].answer).length;
                    return (
                      <div key={e.id} style={{ borderBottom: "1px solid rgba(232,216,184,0.08)" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            padding: "12px 8px",
                            cursor: "pointer",
                            gap: 12,
                            background: isExpanded ? "rgba(127,212,192,0.05)" : "transparent",
                            borderRadius: 6,
                          }}
                          onClick={() => setExpandedRow(isExpanded ? null : e.id)}
                        >
                          <span style={{ color: i < 3 ? "#F0D060" : "#8090A0", fontWeight: 600, minWidth: 24 }}>
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                          </span>
                          <span style={{ flex: 1, color: "#E8D8B8", fontWeight: 500 }}>
                            {e.name}
                            {e.bonus && <span style={{ marginLeft: 6, fontSize: 11, color: "#F0D060" }}>⚜</span>}
                          </span>
                          <span style={{
                            padding: "2px 8px", borderRadius: 4,
                            background: r.bg, color: r.color,
                            fontSize: 12, fontWeight: 600, letterSpacing: 1,
                          }}>{e.rank}</span>
                          <span style={{ color: r.color, fontWeight: 600, minWidth: 36, textAlign: "right" }}>{e.qi}</span>
                          <span style={{ color: "#8090A0", fontSize: 12, minWidth: 30, textAlign: "right" }}>
                            {correctCount}/{QUESTIONS.length}
                          </span>
                          <span style={{ color: "#7FD4C0", fontSize: 18 }}>
                            {isExpanded ? "▾" : "▸"}
                          </span>
                        </div>

                        {/* Détails expand */}
                        {isExpanded && (
                          <div style={{ padding: "16px 12px 20px", background: "rgba(0,0,0,0.15)", borderRadius: 6, marginTop: 4, marginBottom: 8 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginBottom: 16, fontSize: 12 }}>
                              <DetailItem label="Score" value={`${e.score}/${TOTAL_MAX}`} />
                              <DetailItem label="Temps" value={formatTime(e.time)} />
                              <DetailItem label="Précision" value={`${Math.round((e.score / TOTAL_MAX) * 100)}%`} />
                              <DetailItem label="Bonus" value={e.bonus ? "✓ Oui" : "✗ Non"} color={e.bonus ? "#F0D060" : "#8090A0"} />
                              <DetailItem label="Date" value={new Date(e.date).toLocaleDateString("fr-FR")} />
                              <DetailItem label="Heure" value={new Date(e.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} />
                            </div>

                            <div style={{ fontSize: 11, color: "#5FA8D4", letterSpacing: 1.5, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>
                              Réponses détaillées
                            </div>
                            <div>
                              {QUESTIONS.map((q, qi) => {
                                const userAnswer = (e.answers && e.answers[qi] !== undefined) ? e.answers[qi] : -1;
                                const ok = userAnswer === q.answer;
                                return (
                                  <div key={qi} style={{
                                    display: "flex", alignItems: "flex-start",
                                    padding: "8px 10px",
                                    background: ok ? "rgba(127,212,192,0.06)" : "rgba(224,96,112,0.06)",
                                    borderLeft: `3px solid ${ok ? "#7FD4C0" : "#E06070"}`,
                                    borderRadius: 4, marginBottom: 4, fontSize: 12, gap: 10,
                                  }}>
                                    <div style={{ minWidth: 50, color: "#8090A0" }}>
                                      Q{qi + 1}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ color: "#8090A0", fontSize: 11, marginBottom: 3 }}>
                                        {q.section} · {DIFF_LABELS[q.diff]} · {q.pts} pt{q.pts > 1 ? "s" : ""}
                                      </div>
                                      <div style={{ color: "#C8D4DC", marginBottom: 4, lineHeight: 1.4 }}>
                                        {q.q.length > 100 ? q.q.slice(0, 100) + "…" : q.q}
                                      </div>
                                      <div style={{ fontSize: 11 }}>
                                        <span style={{ color: ok ? "#7FD4C0" : "#E06070" }}>
                                          Réponse : {userAnswer >= 0 ? q.choices[userAnswer] : "—"}
                                        </span>
                                        {!ok && (
                                          <span style={{ color: "#7FD4C0", marginLeft: 12 }}>
                                            ↳ Correcte : {q.choices[q.answer]}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <span style={{ color: ok ? "#7FD4C0" : "#E06070", fontWeight: 600, fontSize: 14 }}>
                                      {ok ? "✓" : "✗"}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>

                            <button
                              style={{ ...styles.linkBtn, color: "#E06070", marginTop: 12 }}
                              onClick={(ev) => { ev.stopPropagation(); handleDeleteEntry(e.id); }}
                            >
                              🗑 Supprimer cette entrée
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TEST */}
        {screen === "test" && currentQ && (
          <div className="qi-fade" key={idx}>
            <div style={styles.topBar}>
              <div style={styles.progressBar}>
                <div style={{
                  ...styles.progressFill,
                  width: `${((idx + 1) / QUESTIONS.length) * 100}%`,
                  background: isImpossible ? "linear-gradient(90deg, #F0D060, #E06070)" : "linear-gradient(90deg, #5FA8D4, #7FD4C0)",
                }} />
              </div>
              <div style={styles.topMeta}>
                <span>
                  <span style={{ color: "#7FD4C0" }}>⛩ {name}</span> · Question <strong style={{ color: "#E8D8B8" }}>{idx + 1}</strong> sur {QUESTIONS.length}
                </span>
                <span style={styles.timer}>⏱ {formatTime(elapsed)}</span>
              </div>
            </div>

            {isImpossible && (
              <div style={{ ...styles.card, background: "rgba(240,208,96,0.08)", borderColor: "rgba(240,208,96,0.35)", textAlign: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 11, letterSpacing: 3, color: "#F0D060", fontWeight: 600 }}>⚜ ÉPREUVE FINALE ⚜</div>
                <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 14, color: "#F0D060", margin: "8px 0 0" }}>
                  « Une seule question. Douze points. Croise les chroniques avec ta logique. »
                </p>
              </div>
            )}

            <div style={{ ...styles.card, ...(isImpossible ? { borderColor: "rgba(240,208,96,0.4)", background: "rgba(240,208,96,0.05)" } : {}) }}>
              <div style={styles.qHeader}>
                <span style={{ ...styles.tag, background: isImpossible ? "rgba(240,208,96,0.18)" : "rgba(95,168,212,0.15)", color: isImpossible ? "#F0D060" : "#9CC8E0" }}>
                  {currentQ.section}
                </span>
                <span style={styles.diff}>
                  {Array(currentQ.diff).fill(0).map((_, i) => (
                    <span key={i} style={{ ...styles.dot, background: DIFF_COLORS[currentQ.diff] }} />
                  ))}
                  <span style={{ ...styles.dim, fontSize: 11, marginLeft: 6 }}>
                    {DIFF_LABELS[currentQ.diff]} · {currentQ.pts} pt{currentQ.pts > 1 ? "s" : ""}
                  </span>
                </span>
              </div>
              <p style={styles.question}>{currentQ.q}</p>
            </div>

            <div>
              {currentQ.choices.map((c, i) => {
                const selected = answers[idx] === i;
                return (
                  <button
                    key={i}
                    onClick={() => handleSelect(i)}
                    style={{
                      ...styles.choice,
                      ...(selected ? styles.choiceSelected : {}),
                      ...(isImpossible && selected ? { background: "rgba(240,208,96,0.12)", borderColor: "#F0D060", color: "#FFF2CC" } : {}),
                    }}
                    onMouseEnter={(e) => !selected && (e.currentTarget.style.borderColor = "rgba(232,216,184,0.4)")}
                    onMouseLeave={(e) => !selected && (e.currentTarget.style.borderColor = "rgba(232,216,184,0.15)")}
                  >
                    <span style={{ ...styles.choiceLetter, color: isImpossible ? "#F0D060" : "#7FD4C0" }}>
                      {["A", "B", "C", "D"][i]}
                    </span>
                    <span>{c}</span>
                  </button>
                );
              })}
            </div>

            <div style={styles.nav}>
              <button
                style={{ ...styles.btnSecondary, opacity: idx === 0 ? 0.4 : 1, cursor: idx === 0 ? "not-allowed" : "pointer" }}
                onClick={handlePrev}
                disabled={idx === 0}
              >
                ← Précédent
              </button>
              <button
                style={{
                  ...styles.btnPrimary,
                  opacity: answers[idx] === -1 || isSubmitting ? 0.45 : 1,
                  cursor: answers[idx] === -1 || isSubmitting ? "not-allowed" : "pointer",
                  margin: 0,
                }}
                onClick={handleNext}
                disabled={answers[idx] === -1 || isSubmitting}
              >
                {isSubmitting ? "Inscription au registre..." : idx === QUESTIONS.length - 1 ? "Sceller mon verdict →" : "Suivant →"}
              </button>
            </div>
          </div>
        )}

        {/* RESULTS */}
        {screen === "results" && rank && (
          <div className="qi-fade">
            <div style={{ ...styles.card, textAlign: "center", borderColor: `${rank.border}66` }}>
              <div style={styles.eyebrow}>VERDICT DE LA BRUME · {name}</div>
              <div className="qi-pop" style={{
                fontSize: 64, fontWeight: 700, color: rank.color, lineHeight: 1, margin: "12px 0",
                textShadow: `0 0 30px ${rank.color}66`,
              }}>
                {qi}
              </div>
              <div style={{
                display: "inline-block", padding: "8px 24px",
                background: rank.bg, border: `1.5px solid ${rank.border}`,
                borderRadius: 6, marginBottom: 12,
              }}>
                <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: 4, color: rank.color }}>
                  {rank.label}
                </span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#E8D8B8", marginBottom: 6 }}>
                {rank.desc}
              </div>
              <div style={{ ...styles.quote, fontSize: 13, margin: "8px 0 0" }}>{rank.flavor}</div>

              {bonusEarned && (
                <div style={{
                  marginTop: 16, padding: "10px 16px",
                  background: "rgba(240,208,96,0.12)", border: "1px solid rgba(240,208,96,0.4)",
                  borderRadius: 6, fontSize: 13, color: "#F0D060",
                }}>
                  ⚜ Tu as résolu l'Épreuve Finale. La Bibliothèque inscrit ton nom. <strong>+10 QI</strong>
                </div>
              )}
            </div>

            <div style={styles.statGrid}>
              <Stat label="Score" value={`${totalScore}/${TOTAL_MAX}`} />
              <Stat label="Temps" value={formatTime(totalSec)} />
              <Stat label="Précision" value={`${Math.round((totalScore / TOTAL_MAX) * 100)}%`} />
            </div>

            <div style={styles.card}>
              <div style={styles.cardTitle}>⛩ Tableau d'Honneur de la Brume</div>
              <SyncStatus mode={syncMode} />
              <LeaderboardTable entries={leaderboard} highlightId={currentEntryId} />
            </div>

            <button style={styles.btnPrimary} onClick={handleRestart}>
              ↻ Une autre âme veut tenter l'épreuve
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailItem({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#8090A0", letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: color || "#E8D8B8", marginTop: 2 }}>{value}</div>
    </div>
  );
}

function SyncStatus({ mode }) {
  const isShared = mode === "shared";
  const color = mode === "loading" ? "#8090A0" : isShared ? "#7FD4C0" : "#F0D060";
  const background = mode === "loading"
    ? "rgba(128,144,160,0.08)"
    : isShared
      ? "rgba(127,212,192,0.08)"
      : "rgba(240,208,96,0.08)";
  const borderColor = mode === "loading"
    ? "rgba(128,144,160,0.2)"
    : isShared
      ? "rgba(127,212,192,0.28)"
      : "rgba(240,208,96,0.28)";
  const text = mode === "loading"
    ? "Connexion au registre de la Brume..."
    : isShared
      ? "Classement partagé : les nouveaux scores se mettent à jour automatiquement pour tous."
      : "Mode local : sans Redis branché sur Vercel, chaque navigateur garde son propre classement.";

  return (
    <div style={{
      marginBottom: 12,
      padding: "10px 12px",
      borderRadius: 6,
      background,
      border: `1px solid ${borderColor}`,
      color,
      fontSize: 12,
      lineHeight: 1.5,
    }}>
      {text}
    </div>
  );
}

function LeaderboardTable({ entries, highlightId }) {
  if (!entries.length) {
    return <div style={{ fontSize: 13, color: "#8090A0", textAlign: "center", padding: "20px 0" }}>
      Aucun nom inscrit pour l'instant. Sois le premier.
    </div>;
  }
  return (
    <div style={{ overflowX: "auto", maxHeight: 480, overflowY: "auto" }}>
      <table style={styles.lbTable}>
        <thead>
          <tr>
            <th style={styles.lbTh}>#</th>
            <th style={styles.lbTh}>Shinobi</th>
            <th style={{ ...styles.lbTh, textAlign: "center" }}>Rang</th>
            <th style={{ ...styles.lbTh, textAlign: "right" }}>QI</th>
            <th style={{ ...styles.lbTh, textAlign: "right" }}>Temps</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => {
            const rank = RANKS.find((r) => r.label === e.rank) || RANKS[RANKS.length - 1];
            const isMe = e.id === highlightId;
            return (
              <tr key={e.id || i} style={{ background: isMe ? "rgba(127,212,192,0.08)" : "transparent" }}>
                <td style={styles.lbTd}>
                  <span style={{ color: i < 3 ? "#F0D060" : "#8090A0", fontWeight: i < 3 ? 600 : 400 }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </span>
                </td>
                <td style={styles.lbTd}>
                  <span style={{ color: isMe ? "#7FD4C0" : "#E8D8B8", fontWeight: isMe ? 600 : 400 }}>
                    {e.name}
                    {isMe && <span style={{ marginLeft: 6, fontSize: 10, color: "#7FD4C0" }}>← toi</span>}
                    {e.bonus && <span style={{ marginLeft: 6, fontSize: 11, color: "#F0D060" }}>⚜</span>}
                  </span>
                </td>
                <td style={{ ...styles.lbTd, textAlign: "center" }}>
                  <span style={{
                    display: "inline-block", padding: "2px 8px", borderRadius: 4,
                    background: rank.bg, color: rank.color,
                    fontSize: 12, fontWeight: 600, letterSpacing: 1,
                  }}>{e.rank}</span>
                </td>
                <td style={{ ...styles.lbTd, textAlign: "right", fontWeight: 600, color: rank.color }}>{e.qi}</td>
                <td style={{ ...styles.lbTd, textAlign: "right", color: "#8090A0", fontVariantNumeric: "tabular-nums" }}>
                  {formatTime(e.time)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={styles.statCard}>
      <div style={{ fontSize: 20, fontWeight: 600, color: "#E8D8B8" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#8090A0", letterSpacing: 1, textTransform: "uppercase", marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; }
  .qi-fade { animation: qiFade 0.5s ease-out; }
  @keyframes qiFade {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .qi-pop { animation: qiPop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); }
  @keyframes qiPop {
    0% { opacity: 0; transform: scale(0.5); }
    100% { opacity: 1; transform: scale(1); }
  }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: rgba(232,216,184,0.05); }
  ::-webkit-scrollbar-thumb { background: rgba(127,212,192,0.2); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(127,212,192,0.4); }
`;

const styles = {
  root: {
    minHeight: "100vh", width: "100%",
    background: "#0a1218", color: "#C8D4DC",
    fontFamily: "'Inter', system-ui, sans-serif",
    padding: "32px 16px",
    position: "relative", overflow: "hidden",
  },
  atmosphere: {
    position: "absolute", inset: 0,
    background: `
      radial-gradient(ellipse at 20% 10%, rgba(95,168,212,0.08) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 90%, rgba(127,212,192,0.06) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 50%, rgba(159,138,224,0.04) 0%, transparent 70%)
    `,
    pointerEvents: "none",
  },
  container: { maxWidth: 800, margin: "0 auto", position: "relative", zIndex: 1 },
  header: {
    display: "flex", alignItems: "center", gap: 16,
    marginBottom: 32, paddingBottom: 24,
    borderBottom: "1px solid rgba(232,216,184,0.1)",
  },
  crest: {
    width: 56, height: 56, borderRadius: "50%",
    background: "linear-gradient(135deg, rgba(95,168,212,0.2), rgba(127,212,192,0.2))",
    border: "1px solid rgba(127,212,192,0.4)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 28, color: "#7FD4C0",
    fontFamily: "'Cormorant Garamond', serif", flexShrink: 0,
  },
  eyebrow: { fontSize: 10, letterSpacing: 3, color: "#5FA8D4", fontWeight: 600, marginBottom: 4 },
  title: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 32, fontWeight: 600, margin: "0 0 4px",
    color: "#E8D8B8", letterSpacing: 0.5,
  },
  subtitle: { fontSize: 13, color: "#8090A0", fontStyle: "italic" },
  card: {
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(232,216,184,0.12)",
    borderRadius: 8, padding: "20px 24px", marginBottom: 16,
    backdropFilter: "blur(4px)",
  },
  cardTitle: {
    fontSize: 12, letterSpacing: 2, color: "#5FA8D4",
    fontWeight: 600, marginBottom: 12, textTransform: "uppercase",
    display: "block",
  },
  quote: {
    fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
    fontSize: 16, color: "#9CC8E0", margin: "0 0 16px", lineHeight: 1.6,
  },
  body: { fontSize: 14, color: "#C8D4DC", lineHeight: 1.7, margin: 0 },
  statGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 8, marginBottom: 16,
  },
  statCard: {
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(232,216,184,0.1)",
    borderRadius: 6, padding: "14px 16px", textAlign: "center",
  },
  rankGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 },
  rankCell: { textAlign: "center", padding: "10px 4px", borderRadius: 6 },
  dim: { color: "#8090A0", fontSize: 12 },
  btnPrimary: {
    display: "block", width: "100%",
    background: "linear-gradient(135deg, #5FA8D4, #7FD4C0)",
    border: "none", color: "#0a1218",
    fontFamily: "inherit", fontSize: 15, fontWeight: 600,
    padding: "14px 28px", borderRadius: 8,
    cursor: "pointer", letterSpacing: 0.5,
    transition: "all 0.15s",
    boxShadow: "0 4px 20px rgba(127,212,192,0.2)",
    marginTop: 16,
  },
  btnSecondary: {
    background: "transparent",
    border: "1px solid rgba(232,216,184,0.25)",
    color: "#C8D4DC", fontFamily: "inherit",
    fontSize: 13, padding: "10px 18px", borderRadius: 8,
    cursor: "pointer", transition: "all 0.15s",
  },
  linkBtn: {
    background: "transparent", border: "none",
    color: "#8090A0", fontFamily: "inherit", fontSize: 12,
    cursor: "pointer", textDecoration: "underline", padding: 0,
  },
  nameInput: {
    width: "100%", padding: "12px 16px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(232,216,184,0.2)",
    borderRadius: 6, color: "#E8D8B8",
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 18, outline: "none",
    transition: "border-color 0.15s",
  },
  topBar: { marginBottom: 20 },
  progressBar: {
    height: 3, background: "rgba(232,216,184,0.1)",
    borderRadius: 2, overflow: "hidden", marginBottom: 8,
  },
  progressFill: { height: "100%", transition: "width 0.4s" },
  topMeta: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#8090A0", flexWrap: "wrap", gap: 8 },
  timer: { color: "#7FD4C0", fontVariantNumeric: "tabular-nums" },
  qHeader: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", marginBottom: 14,
    flexWrap: "wrap", gap: 8,
  },
  tag: {
    fontSize: 11, letterSpacing: 1.5, padding: "3px 10px",
    borderRadius: 4, textTransform: "uppercase", fontWeight: 600,
  },
  diff: { display: "flex", alignItems: "center" },
  dot: { display: "inline-block", width: 6, height: 6, borderRadius: "50%", marginLeft: 3 },
  question: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 19, fontWeight: 500, color: "#E8D8B8",
    margin: 0, lineHeight: 1.5,
  },
  choice: {
    display: "flex", alignItems: "flex-start", gap: 12,
    width: "100%", textAlign: "left",
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(232,216,184,0.15)",
    color: "#C8D4DC", fontFamily: "inherit", fontSize: 14,
    padding: "14px 18px", borderRadius: 8,
    cursor: "pointer", marginBottom: 8,
    transition: "all 0.15s", lineHeight: 1.5,
  },
  choiceSelected: {
    background: "rgba(127,212,192,0.1)",
    border: "1.5px solid #7FD4C0", color: "#E8F4F0",
  },
  choiceLetter: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 16, fontWeight: 600,
    flexShrink: 0, minWidth: 16,
  },
  nav: { display: "flex", justifyContent: "space-between", gap: 12, marginTop: 20 },
  lbTable: {
    width: "100%", borderCollapse: "collapse",
    fontSize: 13, marginTop: 4,
  },
  lbTh: {
    textAlign: "left", padding: "8px 10px",
    fontSize: 11, color: "#5FA8D4",
    letterSpacing: 1, textTransform: "uppercase",
    borderBottom: "1px solid rgba(232,216,184,0.1)",
    fontWeight: 600,
    background: "#0a1218",
    position: "sticky", top: 0,
  },
  lbTd: {
    padding: "10px",
    borderBottom: "1px solid rgba(232,216,184,0.05)",
  },
};
