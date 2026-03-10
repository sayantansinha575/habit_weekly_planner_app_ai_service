import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));

// 🔐 Protect service (VERY IMPORTANT)
app.use((req, res, next) => {
    if (req.path === "/") return next(); // allow health check

    // const secret = req.headers["x-internal-secret"];
    // if (secret !== process.env.INTERNAL_SECRET) {
    //     return res.status(403).json({ error: "Unauthorized" });
    // }
    next();
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-3-flash-preview";

if (!GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY missing");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);


app.post("/analyze-meal", async (req, res) => {
    try {
        const { description, imageBase64 } = req.body;

        if (!description && !imageBase64) {
            return res.status(400).json({
                error: "Description or image required",
            });
        }

            const prompt = `
    Analyze this meal and provide nutritional information using a strict 3-step reasoning process:

    Step 1: Vision detection (Identify specific food items from image and description)
    Step 2: NLP understanding (Categorize the meal, e.g., "healthy", "fast food", etc.)
    Step 3: Knowledge reasoning (Map items to nutritional data: e.g., chicken ≈ protein, rice ≈ carbs, broccoli ≈ fiber)

    If description exists: "${description || "N/A"}".

    Return ONLY a JSON object with this structure:
    {
      "calories": number,
      "protein": number,
      "carbs": number,
      "fats": number,
      "description": "short descriptive meal name",
      "reasoning": {
        "step1_vision": ["item1", "item2"],
        "step2_nlp": "meal category and context",
        "step3_knowledge": "brief nutritional logic"
      }
    }
    If unsure, estimate realistically based on standard portions.
    `;

        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
        });

        const parts = [{ text: prompt }];

        if (imageBase64) {
            parts.push({
                inlineData: {
                    mimeType: "image/jpeg",
                    data: imageBase64,
                },
            });
        }

        const result = await model.generateContent({
            contents: [{
                role: "user",
                parts
            }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        const text = result.response.text();

        if (!text) {
            throw new Error("Empty AI response");
        }

        let analysis;
        try {
            analysis = JSON.parse(text);
        } catch (parseError) {
            console.error("Failed to parse JSON directly, attempting regex extraction:", text);
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("AI response not valid JSON");
            }
            analysis = JSON.parse(jsonMatch[0]);
        }

        // ✅ Return clean JSON
        res.json({
            calories: Number(analysis.calories) || 0,
            protein: Number(analysis.protein) || 0,
            carbs: Number(analysis.carbs) || 0,
            fats: Number(analysis.fats) || 0,
            description: analysis.description || description || "Unknown Meal",
            reasoning: analysis.reasoning || null
        });

    } catch (error) {
        console.error("AI Service Error:", error);

        res.status(500).json({
            error: "Failed to analyze meal",
            message: error.message
        });
    }
});

// Health check
app.get("/", (req, res) => {
    res.send("🚀 AI Service Running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 AI Service running on port ${PORT}`);
});
