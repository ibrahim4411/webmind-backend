const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// ── Carpeta donde se guardan las webs generadas ──
const SITES_DIR = path.join(__dirname, 'generated');
if (!fs.existsSync(SITES_DIR)) {
  fs.mkdirSync(SITES_DIR);
}

// ── Servir webs generadas como URLs públicas ──
app.use('/sites', express.static(SITES_DIR));

// ── Test route ──
app.get('/', (req, res) => {
  res.send('WebMind Backend funcionando 🚀');
});

// ── Lista de webs generadas ──
app.get('/api/sites', (req, res) => {
  try {
    const files = fs.readdirSync(SITES_DIR)
      .filter(f => f.endsWith('.html'))
      .map(f => ({
        id: f.replace('.html', ''),
        url: `/sites/${f}`,
        created: fs.statSync(path.join(SITES_DIR, f)).mtime
      }))
      .sort((a, b) => new Date(b.created) - new Date(a.created));

    res.json({ sites: files });
  } catch (e) {
    res.json({ sites: [] });
  }
});

// ── Genera web con IA (Groq) ──
app.post('/api/generate-web', async (req, res) => {
  const { idea, style } = req.body;

  if (!idea) {
    return res.status(400).json({ error: 'Falta el campo idea' });
  }

  const styleGuide = {
    Oscuro: 'dark theme, black backgrounds (#0a0a0f), neon green accents',
    Claro: 'white clean theme, elegant minimal design',
    Colorido: 'vibrant gradients, modern energetic style',
    Minimalista: 'ultra clean, lots of whitespace, simple typography'
  };

  const prompt = `
Create a professional, production-ready single HTML website.

Business: "${idea}"
Style: ${styleGuide[style] || styleGuide.Oscuro}

REQUIREMENTS:
- Single HTML file
- Internal CSS only
- Internal JS only
- Responsive design
- Spanish content
- Sections: hero, services, pricing, testimonials, contact, footer
- Professional agency quality

Return ONLY HTML.
`;

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'Return only clean HTML code. No explanations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 8000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        timeout: 60000
      }
    );

    let html = response.data.choices[0].message.content || '';

    // limpiar posibles fences
    html = html
      .replace(/```html/g, '')
      .replace(/```/g, '')
      .trim();

    const siteId = 'site-' + Date.now();
    const filePath = path.join(SITES_DIR, `${siteId}.html`);

    fs.writeFileSync(filePath, html, 'utf8');

    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;

    res.json({
      siteId,
      html,
      publicUrl: `${baseUrl}/sites/${siteId}.html`
    });

  } catch (error) {
    console.error('❌ ERROR IA:', error.response?.data || error.message);

    res.status(500).json({
      error: 'Error generando la web',
      detail: error.response?.data || error.message
    });
  }
});

// ── START SERVER (FIX PRODUCCIÓN) ──
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ WebMind Backend corriendo en puerto ${PORT}`);
});
