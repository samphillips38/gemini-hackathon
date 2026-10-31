import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

// Optional dynamic import of @google/genai SDK if installed locally
let GoogleGenAIClass = null;
try {
  const genaiModule = await import('@google/genai');
  GoogleGenAIClass = genaiModule.GoogleGenAI;
} catch {
  // Fallback to native fetch against https://generativelanguage.googleapis.com/v1beta/interactions
}

/**
 * Helper to call the Gemini Interactions API via @google/genai SDK (if installed)
 * or direct REST call to v1beta/interactions with Api-Revision: 2026-05-20.
 */
async function createGeminiInteraction(params, apiKey) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('Missing GEMINI_API_KEY. Provide an API key in the app settings or environment.');
  }

  if (GoogleGenAIClass) {
    const ai = new GoogleGenAI({ apiKey: key });
    const interaction = await ai.interactions.create(params);
    return {
      id: interaction.id,
      output_text: interaction.output_text ?? extractTextFromSteps(interaction),
      raw: interaction
    };
  }

  // Direct REST call to Gemini Interactions API (2026-05-20 schema)
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': key,
      'Api-Revision': '2026-05-20'
    },
    body: JSON.stringify(params)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errText}`);
  }

  const interaction = await response.json();
  return {
    id: interaction.id,
    output_text: interaction.output_text ?? extractTextFromSteps(interaction),
    raw: interaction
  };
}

function extractTextFromSteps(interaction) {
  if (!interaction) return '';
  if (typeof interaction.output_text === 'string') return interaction.output_text;
  if (Array.isArray(interaction.steps)) {
    const texts = [];
    for (const step of interaction.steps) {
      if (step.type === 'model_output' && Array.isArray(step.content)) {
        for (const part of step.content) {
          if (part.type === 'text' && part.text) {
            texts.push(part.text);
          }
        }
      }
    }
    if (texts.length > 0) return texts.join('\n');
  }
  return '';
}

// Structured Output JSON Schema for Textbook -> 3D World & Historical Characters extraction
const TEXTBOOK_WORLD_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Title of the textbook or historical volume' },
    subtitle: { type: 'string', description: 'Subtitle or era timeframe (e.g., "431–404 BCE • Classical Greece")' },
    author: { type: 'string', description: 'Author or historical source attribution' },
    era: { type: 'string', description: 'Historical period name' },
    themeStyle: {
      type: 'string',
      enum: ['classical', 'revolution', 'imperial', 'medieval', 'renaissance', 'enlightenment'],
      description: '3D architectural and lighting style that best fits the textbook'
    },
    coverColor: { type: 'string', description: 'Hex color for the 3D hardcover book binding (e.g. #6b1d2f)' },
    accentColor: { type: 'string', description: 'Hex color for gold leaf / trim accents (e.g. #e5b84b)' },
    synopsis: { type: 'string', description: '2-3 sentence summary of the textbook content and historical significance' },
    worldSetting: {
      type: 'object',
      properties: {
        locationName: { type: 'string', description: 'Name of the 3D world environment' },
        atmosphereDescription: { type: 'string', description: 'Description of the sights, architecture, and mood' },
        skyColor: { type: 'string', description: 'Hex color for upper sky' },
        horizonColor: { type: 'string', description: 'Hex color for horizon and fog' },
        groundColor: { type: 'string', description: 'Hex color for terrain ground' },
        plazaColor: { type: 'string', description: 'Hex color for central plaza stonework' }
      },
      required: ['locationName', 'atmosphereDescription', 'skyColor', 'horizonColor', 'groundColor', 'plazaColor']
    },
    chapters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          number: { type: 'integer' },
          title: { type: 'string' },
          summary: { type: 'string' },
          keyExcerpt: { type: 'string', description: 'Direct quote or detailed passage from this section of the book' }
        },
        required: ['number', 'title', 'summary', 'keyExcerpt']
      }
    },
    characters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          title: { type: 'string', description: 'Historical role or title (e.g. "Athenian Statesman & Strategos")' },
          faction: { type: 'string', description: 'Group, allegiance, or school of thought' },
          years: { type: 'string', description: 'Lifespan or active years' },
          avatarStyle: {
            type: 'object',
            properties: {
              robeColor: { type: 'string', description: 'Primary garment hex color' },
              cloakColor: { type: 'string', description: 'Secondary cloak/sash hex color' },
              headgear: {
                type: 'string',
                enum: ['laurel', 'helmet', 'crown', 'tricorne', 'scholar_cap', 'hood', 'diadem', 'none']
              },
              prop: {
                type: 'string',
                enum: ['scroll', 'sword', 'staff', 'lantern', 'book', 'compass', 'shield']
              }
            },
            required: ['robeColor', 'cloakColor', 'headgear', 'prop']
          },
          position: {
            type: 'object',
            properties: {
              x: { type: 'number', description: 'X position in 3D world between -28 and 28' },
              z: { type: 'number', description: 'Z position in 3D world between -28 and 28' }
            },
            required: ['x', 'z']
          },
          greeting: { type: 'string', description: 'First-person in-character greeting when the student approaches' },
          bio: { type: 'string', description: 'Detailed historical background based on the textbook' },
          personality: { type: 'string', description: 'Voice, demeanor, and rhetorical style' },
          keyFacts: {
            type: 'array',
            items: { type: 'string' },
            description: '3-4 key historical takeaways this character teaches from the textbook'
          },
          suggestedQuestions: {
            type: 'array',
            items: { type: 'string' },
            description: '3 engaging questions a student can ask this character'
          }
        },
        required: [
          'id',
          'name',
          'title',
          'faction',
          'years',
          'avatarStyle',
          'position',
          'greeting',
          'bio',
          'personality',
          'keyFacts',
          'suggestedQuestions'
        ]
      }
    },
    landmarks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          type: {
            type: 'string',
            enum: ['temple', 'obelisk', 'arch', 'pagoda', 'fortress', 'amphitheater', 'fountain', 'statue']
          },
          description: { type: 'string', description: 'Historical note from the textbook explaining this landmark or artifact' },
          x: { type: 'number' },
          z: { type: 'number' }
        },
        required: ['id', 'name', 'type', 'description', 'x', 'z']
      }
    }
  },
  required: [
    'title',
    'subtitle',
    'author',
    'era',
    'themeStyle',
    'coverColor',
    'accentColor',
    'synopsis',
    'worldSetting',
    'chapters',
    'characters',
    'landmarks'
  ]
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    const maxBytes = 25 * 1024 * 1024; // 25MB for PDF textbook uploads
    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        reject(new Error('Payload too large (max 25MB)'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // Health & API status check
  if (url.pathname === '/api/status' && req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      hasServerApiKey: Boolean(process.env.GEMINI_API_KEY),
      model: 'gemini-3.8-flash',
      sdkInstalled: Boolean(GoogleGenAIClass)
    });
    return;
  }

  // Endpoint 1: Analyze uploaded textbook (PDF or Text) -> 3D Book + World + Characters
  if (url.pathname === '/api/analyze-textbook' && req.method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      const { textContent, pdfBase64, fileName, apiKey, model } = body;
      const selectedModel = model === 'gemini-4-argon' ? 'gemini-4-argon' : 'gemini-3.8-flash';

      const promptInstruction = `You are an expert historian, educator, and 3D world designer.
Analyze the provided textbook material (file: "${fileName || 'Uploaded Textbook'}") and transform it into an interactive 3D Living Textbook experience.
1. Extract the book title, subtitle/timeframe, author, historical era, and a rich synopsis.
2. Design a cohesive 3D historical world setting (colors, architectural themeStyle, and 4-6 distinct landmarks positioned around the plaza between -26 and 26 on X/Z axes, avoiding (0,0) where the player spawns).
3. Extract 4 to 6 key historical figures or characters mentioned or implied in the textbook. Give each character a distinct (x, z) coordinate in the 3D world (spaced out between -20 and 20, at least 7 units apart), historically accurate role, biography grounded in the textbook, vivid first-person greeting, 3-4 key facts from the text, and 3 thought-provoking questions a student can ask them.
4. Extract 3 to 5 structured chapters with summaries and key excerpts from the text.`;

      const inputContent = [];
      if (pdfBase64) {
        inputContent.push({
          type: 'document',
          data: pdfBase64,
          mime_type: 'application/pdf'
        });
      }
      if (textContent) {
        inputContent.push({
          type: 'text',
          text: `Textbook Content:\n${textContent.slice(0, 120000)}`
        });
      }
      inputContent.push({
        type: 'text',
        text: promptInstruction
      });

      const interaction = await createGeminiInteraction(
        {
          model: selectedModel,
          system_instruction:
            'You extract faithful, deeply educational historical characters, chapters, and 3D world specifications from textbooks.',
          input: inputContent,
          response_format: {
            type: 'text',
            mime_type: 'application/json',
            schema: TEXTBOOK_WORLD_SCHEMA
          }
        },
        apiKey
      );

      const parsedWorld = JSON.parse(interaction.output_text);
      sendJson(res, 200, {
        ok: true,
        interactionId: interaction.id,
        worldData: parsedWorld
      });
    } catch (err) {
      sendJson(res, 400, {
        ok: false,
        error: err.message || 'Failed to analyze textbook with Gemini API'
      });
    }
    return;
  }

  // Endpoint 2: Stateful multi-turn chat with a historical character in the 3D world
  if (url.pathname === '/api/character-chat' && req.method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      const {
        character,
        bookContext,
        userMessage,
        previousInteractionId,
        apiKey,
        model
      } = body;

      const selectedModel = model === 'gemini-4-argon' ? 'gemini-4-argon' : 'gemini-3.8-flash';

      // Note: system_instruction is interaction-scoped in the Interactions API and must be re-specified each turn
      const systemInstruction = `You are roleplaying in first person as ${character.name} (${character.title}, ${character.years}) inside an interactive 3D living textbook visualization of "${bookContext.title}" (${bookContext.era}).

Character Biography & Context from the Textbook:
${character.bio}

Personality & Voice:
${character.personality}

Key Textbook Facts to Weave Into Conversation:
${(character.keyFacts || []).map((f, i) => `${i + 1}. ${f}`).join('\n')}

Textbook Synopsis & Chapter Context:
${bookContext.synopsis}
${(bookContext.chapters || []).map((c) => `Chapter ${c.number} (${c.title}): ${c.summary}`).join('\n')}

Guidelines:
- Speak in first person as ${character.name} with authentic period tone while remaining clear, engaging, and educational for a student exploring the 3D world.
- Ground your answers in historical details from the textbook.
- Keep responses concise (2 to 4 short paragraphs max) and end with an inviting historical insight or question that encourages deeper exploration.`;

      const interactionPayload = {
        model: selectedModel,
        system_instruction: systemInstruction,
        input: userMessage,
        generation_config: {
          max_output_tokens: 700
        }
      };

      if (previousInteractionId) {
        interactionPayload.previous_interaction_id = previousInteractionId;
      }

      const interaction = await createGeminiInteraction(interactionPayload, apiKey);

      sendJson(res, 200, {
        ok: true,
        interactionId: interaction.id,
        reply: interaction.output_text
      });
    } catch (err) {
      sendJson(res, 400, {
        ok: false,
        error: err.message || 'Character chat request failed'
      });
    }
    return;
  }

  // Serve static files from ./public
  let filePath = path.join(__dirname, 'public', url.pathname === '/' ? 'index.html' : url.pathname);
  // Prevent directory traversal
  if (!filePath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n==================================================================`);
  console.log(`  Chronicle3D: Living Textbook Visualizer running at:`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`==================================================================\n`);
});
