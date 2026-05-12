const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();

/* 🚀 Railway compatible */
const PORT = process.env.PORT || 8080;

/* 🌐 Middlewares */
app.use(express.json({ limit: '10mb' }));
app.use(cors());

/* 📁 Carpeta donde se guardan las webs generadas */
const SITES_DIR = path.join(__dirname, 'generated');

if (!fs.existsSync(SITES_DIR)) {
  fs.mkdirSync(SITES_DIR);
}

/* 🌍 Servir webs generadas públicamente */
app.use('/sites', express.static(SITES_DIR));

/* ───────────────────────────── */
/* 🧠 ROOT */
/* ───────────────────────────── */

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'WebMind Backend funcionando 🚀',
  });
});

/* ───────────────────────────── */
/* ❤️ HEALTHCHECK */
/* ───────────────────────────── */

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'WebMind Backend',
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

/* ───────────────────────────── */
/* 📚 LISTA DE WEBS GENERADAS */
/* ───────────────────────────── */

app.get('/api/sites', (req, res) => {
  try {
    const files = fs
      .readdirSync(SITES_DIR)
      .filter((f) => f.endsWith('.html'))
      .map((f) => ({
        id: f.replace('.html', ''),
        url: `/sites/${f}`,
        created: fs.statSync(path.join(SITES_DIR, f)).mtime,
      }))
      .sort((a, b) => new Date(b.created) - new Date(a.created));

    res.json({
      success: true,
      count: files.length,
      sites: files,
    });
  } catch (e) {
    console.error('❌ ERROR leyendo sites:', e.message);

    res.status(500).json({
      success: false,
      error: 'Error leyendo las webs generadas',
    });
  }
});

/* ───────────────────────────── */
/* 🤖 GENERADOR IA */
/* ───────────────────────────── */

app.post('/api/generate-web', async (req, res) => {
  const { idea, style } = req.body;

  if (!idea) {
    return res.status(400).json({
      success: false,
      error: 'Falta el campo "idea"',
    });
  }

  const styleGuide = {
    Oscuro:
      'dark theme, black backgrounds (#0a0a0f), neon green accents',
    Claro:
      'white clean theme, elegant minimal design',
    Colorido:
      'vibrant gradients, modern energetic style',
    Minimalista:
      'ultra clean, lots of whitespace, simple typography',
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
- Modern animations
- Beautiful typography
- Sections:
  - hero
  - services
  - pricing
  - testimonials
  - contact
  - footer
- Premium startup quality
- Mobile responsive
- Elegant UI/UX
- CTA buttons
- Smooth scroll

Return ONLY HTML.
`;

  try {
    console.log('🧠 Generando web IA...');

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content:
              'Return only clean production-ready HTML code. No markdown. No explanations.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 8000,
        temperature: 0.8,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        timeout: 60000,
      }
    );

    let html = response.data.choices?.[0]?.message?.content || '';

    /* 🧹 Limpiar markdown fences */
    html = html
      .replace(/```html/g, '')
      .replace(/```/g, '')
      .trim();

    /* 🆔 Crear ID único */
    const siteId = `site-${Date.now()}`;

    /* 💾 Guardar archivo */
    const filePath = path.join(SITES_DIR, `${siteId}.html`);

    fs.writeFileSync(filePath, html, 'utf8');

    /* 🌍 URL pública */
    const baseUrl =
      process.env.BASE_URL ||
      `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` ||
      `http://localhost:${PORT}`;

    console.log(`✅ Web generada: ${siteId}`);

    res.json({
      success: true,
      siteId,
      publicUrl: `${baseUrl}/sites/${siteId}.html`,
      previewUrl: `${baseUrl}/sites/${siteId}.html`,
      html,
    });
  } catch (error) {
    console.error(
      '❌ ERROR IA:',
      error.response?.data || error.message
    );

    res.status(500).json({
      success: false,
      error: 'Error generando la web',
      detail: error.response?.data || error.message,
    });
  }
});

/* ───────────────────────────── */
/* ❌ 404 */
/* ───────────────────────────── */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
  });
});

/* ───────────────────────────── */
/* 🚀 START SERVER */
/* ───────────────────────────── */

app.listen(PORT, () => {
  console.log(`✅ WebMind Backend corriendo en puerto ${PORT}`);
});
});

// ── START SERVER (FIX PRODUCCIÓN) ──
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ WebMind Backend corriendo en puerto ${PORT}`);
});
