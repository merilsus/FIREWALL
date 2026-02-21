const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { imageHash } = require("image-hash");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage() });

let foundItems = [];

/* =================================
   IMAGE HASH FUNCTION
================================= */
function getImageHash(imageUrl) {
  return new Promise((resolve, reject) => {
    imageHash(imageUrl, 16, true, (error, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });
}

/* =================================
   HAMMING DISTANCE (Image Compare)
================================= */
function hammingDistance(a, b) {
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) distance++;
  }
  return distance;
}

/* =================================
   KEYWORD MATCHING (0-30)
================================= */
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
   Upload Found Item
================================ */
app.post("/upload-found", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  const stream = cloudinary.uploader.upload_stream(
    { tags: ["found-item"] },
    async (error, result) => {
      if (error) return res.status(500).json(error);

      try {
        const hash = await getImageHash(result.secure_url);

        foundItems.push({
          image: result.secure_url,
          location: req.body.location,
          description: req.body.description,
          imageHash: hash
        });

        res.json({
          message: "Found item stored privately",
        });

      } catch (err) {
        res.status(500).json({ error: "Hash generation failed" });
      }
    }
  );

  stream.end(req.file.buffer);
});

/* ================================
   Upload Lost Item (Full AI Score)
================================ */
app.post("/upload-lost", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No image uploaded");
  }

  const stream = cloudinary.uploader.upload_stream(
    {},
    async (error, result) => {
      if (error) return res.status(500).json(error);

      try {
        const lostHash = await getImageHash(result.secure_url);

        let bestMatch = null;
        let highestScore = 0;

        for (const item of foundItems) {
          let totalScore = 0;

          /* 🖼 IMAGE SIMILARITY (0-50) */
          const distance = hammingDistance(item.imageHash, lostHash);
          const maxBits = item.imageHash.length;
          const imageSimilarity = 100 - (distance / maxBits) * 100;
          const imageScore = (imageSimilarity / 100) * 50;
          totalScore += imageScore;

          /* 📍 LOCATION (0-20) */
          if (item.location === req.body.location) {
            totalScore += 20;
          }

          /* 📝 KEYWORDS (0-30) */
          totalScore += calculateKeywordScore(
            item.description,
            req.body.description
          );

          if (totalScore > highestScore) {
            highestScore = totalScore;
            bestMatch = item;
          }
        }

        if (!bestMatch) {
          return res.send(`
            <h2>No Match Found ❌</h2>
            <a href="/upload-page">Go Back</a>
          `);
        }

        res.send(`
          <h2>🔥 Match Found!</h2>
          <p><strong>Total Score:</strong> ${highestScore.toFixed(2)} / 100</p>
          <p><strong>Location:</strong> ${bestMatch.location}</p>
          <p><strong>Description:</strong> ${bestMatch.description}</p>
          <img src="${bestMatch.image}" width="300" />
          <br/><br/>
          <a href="/upload-page">Go Back</a>
        `);

      } catch (err) {
        res.status(500).json({ error: "Matching failed" });
      }
    }
  );

  stream.end(req.file.buffer);
});

/* ================================
   Simple Browser Test Page
================================ */
app.get("/upload-page", (req, res) => {
  res.send(`
    <h2>🔥 FIREWALL Lost & Found AI</h2>

    <h3>Upload Found Item (Private)</h3>
    <form action="/upload-found" method="POST" enctype="multipart/form-data">
      <input type="file" name="image" required /><br/><br/>
      <input type="text" name="location" placeholder="Location found" required /><br/><br/>
      <input type="text" name="description" placeholder="Describe the item" required /><br/><br/>
      <button type="submit">Upload Found</button>
    </form>

    <hr/>

    <h3>Upload Lost Item</h3>
    <form action="/upload-lost" method="POST" enctype="multipart/form-data">
      <input type="file" name="image" required /><br/><br/>
      <input type="text" name="location" placeholder="Location lost" required /><br/><br/>
      <input type="text" name="description" placeholder="Describe the lost item" required /><br/><br/>
      <button type="submit">Upload Lost</button>
    </form>
  `);
});

app.get("/", (req, res) => {
  res.send("FIREWALL Lost & Found AI running 🔥");
});

app.listen(3000, () => console.log("Server running on port 3000"));