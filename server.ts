import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import { OpenAI } from 'openai';
import cors from 'cors';
import fs from 'fs';

const app = express();
const upload = multer({ dest: 'uploads/' });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

app.post('/api/generate-report', upload.single('file'), async (req, res) => {
  const { mapping, agencyTone, agencyName } = req.body;
  const results: any[] = [];

  // 1. Stream the CSV to handle large files professionally
  fs.createReadStream(req.file!.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      
      // 2. Normalize data based on the user's mapping
      const summaryMetrics = results.slice(0, 50).map(row => ({
        date: row[mapping.Date],
        spend: parseFloat(row[mapping.Spend]),
        conversions: parseInt(row[mapping.Conversions])
      }));

      // 3. The "Strategist" Prompt
      try {
        const aiResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { 
              role: "system", 
              content: `You are a high-end marketing consultant for ${agencyName}. 
                        Tone: ${agencyTone}. Analyze the data and provide prioritized actions.` 
            },
            { 
              role: "user", 
              content: `Data: ${JSON.stringify(summaryMetrics)}. Identify the top 3 growth levers.` 
            }
          ],
          response_format: { type: "json_object" }
        });

        // 4. Return clean, structured data
        res.json(JSON.parse(aiResponse.choices[0].message.content!));
      } catch (error) {
        res.status(500).json({ error: "AI generation failed" });
      } finally {
        fs.unlinkSync(req.file!.path); // Clean up temp files
      }
    });
});

app.listen(process.env.PORT || 3000);
