# Nagayakshi Temple Website

Sacred Naga worship temple website built with Astro - offering authentic Vedic remedies for Naga Dosha under the guidance of Ambotti Thampuran.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Start development server:**
```bash
npm run dev
```

3. **Build for production:**
```bash
npm run build
```

4. **Preview production build:**
```bash
npm run preview
```

## 📁 Project Structure

```
nagayakshi-astro/
├── public/              # Static assets (images, fonts, etc.)
│   └── images/
├── src/
│   ├── components/      # Reusable Astro components
│   │   ├── Navigation.astro
│   │   ├── Footer.astro
│   │   ├── Hero.astro
│   │   └── ServiceCard.astro
│   ├── layouts/         # Page layouts
│   │   └── Layout.astro
│   ├── pages/           # Page routes (file-based routing)
│   │   └── index.astro
│   └── styles/          # Global styles
│       └── global.css
├── astro.config.mjs     # Astro configuration
├── package.json
└── README.md
```

## 🎨 Design System

### Color Palette
- **Emerald** (#0d5c3d) - Primary, spiritual
- **Gold** (#d4a574) - Sacred, prosperity
- **Crimson** (#8b2635) - Action, energy
- **Cream** (#f8f4ed) - Background, peace
- **Brown** (#3d2817) - Text, grounding

### Typography
- **Headings:** Cormorant Garamond (elegant, traditional)
- **Body:** Crimson Text (readable, spiritual)

## 📄 Pages to Create

Based on the navigation structure, you'll need to create these pages:

```
src/pages/
├── index.astro          ✅ Done
├── poojas/
│   ├── index.astro      # All poojas listing
│   ├── ayilyam.astro
│   ├── kala-sarpa-bali.astro
│   ├── navagraha.astro
│   └── onsite.astro
├── about.astro          # About Vishwanagayakshi
├── thampuran.astro      # About Ambotti Thampuran
├── visit.astro          # How to visit, timings
├── support.astro        # Donations, Go Dhanam
├── dosha-guide.astro    # Naga Dosha education
├── protocols.astro      # Temple protocols
├── blog/
│   └── index.astro      # Blog listing
├── book.astro           # Booking page
├── privacy.astro
└── terms.astro
```

## 🛠️ Development Tips

### Adding New Pages
Create a new `.astro` file in `src/pages/`:

```astro
---
import Layout from '../layouts/Layout.astro';
---

<Layout title="Page Title">
  <section>
    <h1>Your Content Here</h1>
  </section>
</Layout>
```

### Creating New Components
```astro
---
export interface Props {
  title: string;
}
const { title } = Astro.props;
---

<div class="component">
  <h2>{title}</h2>
  <slot />
</div>

<style>
.component {
  /* Component styles */
}
</style>
```

### Image Optimization
Place images in `public/images/` and reference as:
```html
<img src="/images/your-image.jpg" alt="Description">
```

## 🔧 Configuration

### Site URL
Update in `astro.config.mjs`:
```javascript
export default defineConfig({
  site: 'https://nagayakshi.org',
  // ...
});
```

### SEO
Each page can have custom meta tags via the Layout props:
```astro
<Layout 
  title="Page Title" 
  description="Page description for SEO"
>
```

## 📱 Responsive Design
The site is fully responsive with breakpoints at:
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

## 🌐 Deployment

### Deploy to Netlify, Vercel, or Cloudflare Pages:

1. **Build the site:**
```bash
npm run build
```

2. **Deploy the `dist/` folder**

### Environment Variables
Add any API keys or sensitive data to `.env`:
```
PUBLIC_API_KEY=your_key_here
```

## 📝 Content Management

### Services Data
Currently hardcoded in `src/pages/index.astro`. Consider moving to:
- JSON files in `src/data/`
- A headless CMS (Sanity, Contentful, etc.)
- Markdown files with frontmatter

### Blog Posts
Use Astro's content collections for blog posts:
```javascript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  schema: z.object({
    title: z.string(),
    date: z.date(),
    author: z.string(),
  }),
});

export const collections = { blog };
```

## 🎯 Next Steps

1. **Replace placeholder images** with actual temple photos
2. **Create remaining pages** (poojas, about, etc.)
3. **Add booking system** (form or integration)
4. **Implement blog** using Astro content collections
5. **Add analytics** (Google Analytics, Plausible, etc.)
6. **Set up contact forms** (Formspree, Netlify Forms, etc.)
7. **Add payment integration** for online bookings

## 📞 Support

For questions about Astro:
- [Astro Documentation](https://docs.astro.build)
- [Astro Discord](https://astro.build/chat)

## 📜 License

All content is property of Shankarodath Kovilakam Trust (Reg: 222/IV/2023)
