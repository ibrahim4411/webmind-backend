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
if (!fs.existsSync(SITES_DIR)) fs.mkdirSync(SITES_DIR);

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

// ── Genera web con IA (Groq — gratis) ──
app.post('/api/generate-web', async (req, res) => {
  const { idea, style } = req.body;

  if (!idea) return res.status(400).json({ error: 'Falta el campo "idea"' });

  const styleGuide = {
    'Oscuro':      'dark theme, black backgrounds (#0a0a0f), neon accent green (#a8ff57), white text',
    'Claro':       'light clean theme, white backgrounds, dark text, subtle elegant accents',
    'Colorido':    'vibrant colorful theme, bold gradients, multiple accent colors, energetic modern feel',
    'Minimalista': 'ultra-minimal, generous whitespace, 1-2 colors max, refined elegant typography'
  };

  const prompt = `You are a world-class professional web developer and copywriter. Create a complete, stunning, production-ready single-page HTML website for this business: "${idea}"

Visual style: ${styleGuide[style] || styleGuide['Oscuro']}

STRICT REQUIREMENTS:
- ONE complete HTML file with ALL CSS in <style> tag and ALL JS before </body>
- Google Fonts import (choose fonts that match the business)
- NO external JS libraries except Google Fonts
- Fully responsive mobile-first design with media queries

REQUIRED SECTIONS:
1. Fixed navigation bar with logo and menu links
2. Hero section with headline, subheadline, CTA buttons
3. Services section with 3-4 services
4. Pricing section with 3 tiers in euros
5. Testimonials with 3 realistic reviews
6. Contact form with JS fake submit
7. Footer

RULES:
- Invent a realistic Spanish business name
- Write ALL text in Spanish
- Use Spanish addresses and phone numbers
- Add hover animations and fade-in on load
- Must look like a professional €3000 agency website

Return ONLY raw HTML. No markdown, no explanation, no code fences.`;

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        max_tokens: 8000,
        messages: [
          {
            role: 'system',
            content: 'You are a professional web developer. Always return only raw HTML code, never markdown or explanations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        timeout: 60000
      }
    );

    // Extraer HTML
    let html = response.data.choices[0].message.content;
    html = html.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();

    // Guardar en disco
    const siteId = 'site-' + Date.now();
    const filePath = path.join(SITES_DIR, `${siteId}.html`);
    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`✅ Web guardada: ${siteId}`);

    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    res.json({
      html,
      siteId,
      publicUrl: `${baseUrl}/sites/${siteId}.html`
    });

  } catch (error) {
    const detail = error.response?.data || error.message;
    console.error('❌ ERROR IA:', detail);
    res.status(500).json({ error: 'Error generando la web', detail });
  }
});

app.listen(PORT, () => {
  console.log(`✅ WebMind Backend corriendo en http://localhost:${PORT}`);
});
