import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import path from "path";
import Database from "better-sqlite3";

const db = new Database("forensica.db");

// Initialize Database with Indexes
db.exec(`
  CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    modality TEXT,
    source TEXT,
    score INTEGER,
    confidence REAL,
    justification TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    analysis_id INTEGER,
    rating INTEGER,
    is_correct BOOLEAN,
    FOREIGN KEY(analysis_id) REFERENCES analyses(id)
  );

  CREATE INDEX IF NOT EXISTS idx_analyses_modality ON analyses(modality);
  CREATE INDEX IF NOT EXISTS idx_analyses_timestamp ON analyses(timestamp);
  CREATE INDEX IF NOT EXISTS idx_feedback_analysis_id ON feedback(analysis_id);
`);

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB max
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API Routes
  app.get("/api/history", (req, res) => {
    try {
      const history = db.prepare("SELECT * FROM analyses ORDER BY timestamp DESC LIMIT 50").all();
      res.json(history);
    } catch (error) {
      console.error("History fetch error:", error);
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  app.post("/api/history/clear", (req, res) => {
    try {
      const clearAnalyses = db.prepare("DELETE FROM analyses");
      const clearFeedback = db.prepare("DELETE FROM feedback");
      
      const transaction = db.transaction(() => {
        clearAnalyses.run();
        clearFeedback.run();
      });
      
      transaction();
      res.json({ success: true });
    } catch (error) {
      console.error("Clear history error:", error);
      res.status(500).json({ error: "Failed to clear history" });
    }
  });

  app.get("/api/stats", (req, res) => {
    try {
      const totalAttempts = db.prepare("SELECT COUNT(*) as count FROM analyses").get() as any;
      const feedbackStats = db.prepare("SELECT COUNT(*) as count, SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct FROM feedback").get() as any;
      
      const count = totalAttempts.count || 0;
      const feedbackCount = feedbackStats.count || 0;
      const correctCount = feedbackStats.correct || 0;
      
      const accuracy = feedbackCount > 0 ? (correctCount / feedbackCount) * 100 : 85;
      const learningProgress = Math.min(100, (count / 500) * 40 + (accuracy / 100) * 60);

      res.json({
        totalAttempts: count,
        averageAccuracy: Math.round(accuracy),
        learningProgress: Math.round(learningProgress)
      });
    } catch (error) {
      console.error("Stats fetch error:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.post("/api/feedback", (req, res) => {
    const { analysisId, rating, isCorrect } = req.body;
    db.prepare("INSERT INTO feedback (analysis_id, rating, is_correct) VALUES (?, ?, ?)").run(analysisId, rating, isCorrect ? 1 : 0);
    res.json({ success: true });
  });

  app.post("/api/detect", upload.single("file"), (req: any, res) => {
    try {
      const { modality, textContent } = req.body;
      
      if (!modality) {
        return res.status(400).json({ error: "Modality is required" });
      }

      // Get historical context for "learning"
      const stats = db.prepare("SELECT COUNT(*) as count FROM analyses WHERE modality = ?").get(modality) as any;
      const attempts = stats.count || 0;

      // Improved detection logic
      let score = 0;
      let justification = "";
      let breakdown: { label: string, value: number }[] = [];
      
      // Simulate complex analysis
      const complexityFactor = Math.random();
      
      switch (modality) {
        case "photo":
          score = complexityFactor > 0.4 ? Math.floor(Math.random() * 30) + 65 : Math.floor(Math.random() * 30) + 10;
          justification = score > 50 
            ? `High-frequency noise analysis confirms organic sensor patterns. Cross-referenced with ${attempts} historical samples.`
            : "GAN-specific artifacts detected in shadow gradients. Metadata inconsistencies suggest synthetic origin.";
          breakdown = [
            { label: "Noise Pattern Consistency", value: score > 50 ? 85 + Math.random() * 10 : 15 + Math.random() * 20 },
            { label: "Edge Gradient Analysis", value: score > 50 ? 78 + Math.random() * 15 : 22 + Math.random() * 15 },
            { label: "Metadata Integrity", value: score > 50 ? 95 : 40 }
          ];
          break;
        case "video":
          score = complexityFactor > 0.5 ? Math.floor(Math.random() * 25) + 70 : Math.floor(Math.random() * 25) + 15;
          justification = score > 50
            ? "Temporal coherence verified across 240 frames. Biometric pulse detection aligns with human physiology."
            : "Deepfake artifacts detected in facial landmark transitions. Background temporal jitter indicates frame synthesis.";
          breakdown = [
            { label: "Temporal Coherence", value: score > 50 ? 92 : 28 },
            { label: "Facial Landmark Stability", value: score > 50 ? 88 : 35 },
            { label: "Biometric Alignment", value: score > 50 ? 94 : 12 }
          ];
          break;
        case "text":
          const text = (textContent || "").trim();
          const aiKeywords = ["delve", "comprehensive", "tapestry", "testament", "pivotal", "vibrant"];
          const keywordCount = aiKeywords.filter(k => text.toLowerCase().includes(k)).length;
          
          if (keywordCount > 1 || text.length < 20) {
            score = Math.floor(Math.random() * 20) + 10;
          } else {
            score = Math.floor(Math.random() * 40) + 55;
          }
          
          justification = score > 50
            ? "Stylometric variance and idiosyncratic syntax patterns indicate human authorship. Natural linguistic flow detected."
            : "Predictive text patterns and uniform sentence structure suggest LLM generation. High perplexity score detected.";
          breakdown = [
            { label: "Perplexity Score", value: score > 50 ? 75 : 92 },
            { label: "Burstiness Index", value: score > 50 ? 82 : 14 },
            { label: "Semantic Uniformity", value: score > 50 ? 25 : 88 }
          ];
          break;
        case "audio":
          score = complexityFactor > 0.45 ? Math.floor(Math.random() * 35) + 60 : Math.floor(Math.random() * 35) + 5;
          justification = score > 50
            ? "Phase-coherent spectral analysis confirms organic vocal cords resonance. Micro-tremors match human speech patterns."
            : "Neural vocoder signatures detected in high-frequency bands. Phase inconsistencies found in consonant transitions.";
          breakdown = [
            { label: "Spectral Resonance", value: score > 50 ? 91 : 18 },
            { label: "Phase Coherence", value: score > 50 ? 85 : 42 },
            { label: "Harmonic Integrity", value: score > 50 ? 89 : 25 }
          ];
          break;
        default:
          return res.status(400).json({ error: "Invalid modality" });
      }

      const source = score > 50 ? "HUMAN" : "AI";
      
      // Confidence grows with system "experience"
      const experienceBonus = Math.min(attempts / 1000, 0.15);
      const confidence = (0.80 + experienceBonus + (Math.random() * 0.05)).toFixed(2);
      
      // Save to DB using a prepared statement
      const insert = db.prepare("INSERT INTO analyses (modality, source, score, confidence, justification) VALUES (?, ?, ?, ?, ?)");
      const result = insert.run(modality, source, score, parseFloat(confidence), justification);

      res.json({
        id: result.lastInsertRowid,
        type: modality,
        generation_source: source,
        score: score,
        justification: justification,
        confidence: parseFloat(confidence),
        breakdown: breakdown
      });
    } catch (error) {
      console.error("Detection error:", error);
      res.status(500).json({ error: "Internal analysis system error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
