import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cloudinary from "cloudinary";
import multer from "multer";
import { imageHash } from "image-hash";
import { fileURLToPath } from "url";
import path from "path";

/* ================================
   SETUP __dirname (ESM SAFE)
================================ */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================================
   ENV + APP INIT
================================ */
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ================================
   CLOUDINARY
================================ */
cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

/* ================================
   MULTER
================================ */
const upload = multer({ storage: multer.memoryStorage() });

let foundItems = [];

/* ================================
   IMAGE HASH
================================ */
function getImageHash(imageUrl) {
  return new Promise((resolve, reject) => {
    imageHash(imageUrl, 16, true, (error, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });
}

/* ================================
   HAMMING DISTANCE
================================ */
function hammingDistance(a, b) {
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) distance++;
  }
  return distance;
}

/* ================================
   KEYWORD SCORE
================================ */
function calculateKeywordScore(desc1, desc2) {
  if (!desc1 || !desc2) return 0;

  const words1 = desc1.toLowerCase().split(" ");
  const words2 = desc2.toLowerCase().split(" ");

  let matchCount = 0;
  words1.forEach(word => {
    if (words2.includes(word)) matchCount++;
  });

  const maxWords = Math.max(words1.length, words2.length);
  return (matchCount / maxWords) * 30;
}

/* ================================
   UPLOAD FOUND
================================ */
app.post("/upload-found", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });

  const stream = cloudinary.v2.uploader.upload_stream(
    { tags: ["found-item"] },
    async (error, result) => {
      if (error) return res.status(500).json(error);

      const hash = await getImageHash(result.secure_url);

      foundItems.push({
        image: result.secure_url,
        location: req.body.location,
        description: req.body.description,
        imageHash: hash,
      });

      res.json({ message: "Found item stored privately" });
    }
  );

  stream.end(req.file.buffer);
});

/* ================================
   UPLOAD LOST
================================ */
app.post("/upload-lost", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).send("No image uploaded");

  const stream = cloudinary.v2.uploader.upload_stream(
    {},
    async (error, result) => {
      if (error) return res.status(500).json(error);

      const lostHash = await getImageHash(result.secure_url);

      let bestMatch = null;
      let highestScore = 0;

      for (const item of foundItems) {
        let score = 0;

        const distance = hammingDistance(item.imageHash, lostHash);
        const imageScore = ((100 - (distance / item.imageHash.length) * 100) / 100) * 50;
        score += imageScore;

        if (item.location === req.body.location) score += 20;

        score += calculateKeywordScore(item.description, req.body.description);

        if (score > highestScore) {
          highestScore = score;
          bestMatch = item;
        }
      }

      if (!bestMatch) {
        return res.send("<h2>No Match Found ❌</h2>");
      }

      res.send(`
        <h2>🔥 Match Found!</h2>
        <p>Score: ${highestScore.toFixed(2)} / 100</p>
        <p>${bestMatch.description}</p>
        <img src="${bestMatch.image}" width="300"/>
      `);
    }
  );

  stream.end(req.file.buffer);
});

/* ================================
   ROOT
================================ */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ================================
   START SERVER
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🔥 FIREWALL running on port ${PORT}`)
);