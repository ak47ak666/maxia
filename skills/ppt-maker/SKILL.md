---
name: ppt-maker
description: "Create professional PowerPoint presentations from outlines or topics. Use when: (1) user needs a complete PPT presentation, (2) converting text outlines to structured slides, (3) generating slide content for specific topics, (4) creating presentation templates, (5) adding speaker notes and timing guidance. NOT for: simple text formatting (use edit tool), one-slide graphics (use canvas tool), or complex data visualization (use coding-agent)."
---

# PPT Maker Skill

Create professional PowerPoint presentations with structured content, design guidance, and speaker notes.

## Quick Start

When a user requests a PPT presentation:

1. **Gather requirements** - Ask about topic, audience, duration, style
2. **Create outline** - Generate slide-by-slide structure
3. **Write content** - Fill each slide with appropriate content
4. **Add design guidance** - Provide visual and layout suggestions
5. **Include speaker notes** - Add presentation tips and timing

## Workflow

### 1. Requirement Gathering
Ask these questions:
- **Topic**: What is the presentation about?
- **Audience**: Who will watch? (students, professionals, general public)
- **Duration**: How long should it be? (5, 10, 15+ minutes)
- **Style**: Formal, casual, creative, minimalist?
- **Tools**: PowerPoint, Google Slides, Canva, Keynote?
- **Special needs**: Brand colors, logos, specific images?

### 2. Outline Creation
Create a logical flow:
```
1. Title Slide
2. Agenda/Overview
3. Problem/Introduction
4. Main Point 1
5. Main Point 2
6. Main Point 3
7. Examples/Case Studies
8. Solution/Recommendations
9. Conclusion
10. Q&A
```

### 3. Content Writing
For each slide:
- **Title**: Clear, concise
- **Content**: Bullet points (3-5 max)
- **Visuals**: Image/icon suggestions
- **Data**: Charts/diagrams if needed
- **Rule**: One idea per slide

### 4. Design Guidance
- **Color schemes**: Provide hex codes
- **Fonts**: Recommend readable combinations
- **Layout**: Suggest slide layouts
- **Images**: Recommend sources (Unsplash, Pixabay)
- **Icons**: Suggest icon libraries

### 5. Speaker Notes
For each slide:
- **Key points**: What to emphasize
- **Timing**: Suggested speaking time
- **Transitions**: How to connect to next slide
- **Questions**: Potential audience questions

## Templates

### Basic Presentation Structure
```markdown
# [Presentation Title]

## Slide 1: Title Slide
- **Title**: [Main Title]
- **Subtitle**: [Optional Subtitle]
- **Presenter**: [Name/Organization]
- **Date**: [Date]

## Slide 2: Agenda
- Overview of presentation
- What we'll cover
- Key takeaways

## Slide 3: [Topic Introduction]
- Context/background
- Why this matters
- Objectives

[Continue with main content slides...]

## Last Slide: Thank You
- Contact information
- Q&A
- Additional resources
```

### Educational Presentation (Students)
- More visuals, less text
- Interactive elements
- Simple language
- Fun facts/trivia
- Summary/review slides

### Business Presentation
- Professional tone
- Data-driven
- Clear conclusions
- Call to action
- Company branding

## Tools Integration

### Canva
- Use templates: "Presentation" category
- Search keywords: "professional", "creative", "minimalist"
- Export as PPTX or PDF

### Google Slides
- Free, collaborative
- Built-in templates
- Easy sharing

### Microsoft PowerPoint
- Most common format (.pptx)
- Rich features
- Professional templates

### Alternative: Markdown to PPT
Tools like Marp, Slidev, Reveal.js for tech-savvy users

## Best Practices

### Content
- **6x6 Rule**: Max 6 words per line, 6 lines per slide
- **Visuals > Text**: Images convey faster than words
- **Consistency**: Same fonts, colors, layout throughout
- **White Space**: Don't overcrowd slides

### Delivery
- **1-2 minutes per slide**
- **Practice timing**
- **Prepare for Q&A**
- **Have backup slides**

### Accessibility
- **High contrast** text/background
- **Large fonts** (24pt minimum)
- **Alt text** for images
- **Simple language**

## Common Use Cases

### 1. School/University Presentations
- Research presentations
- Project demonstrations
- Thesis defenses
- Class lectures

### 2. Business Presentations
- Sales pitches
- Project proposals
- Quarterly reports
- Training materials

### 3. Conference Talks
- Technical presentations
- Workshop materials
- Lightning talks
- Poster sessions

### 4. Personal Use
- Wedding slideshows
- Travel presentations
- Hobby showcases
- Family events

## Output Files

Create these files:
1. `presentation-outline.md` - Detailed slide-by-slide content
2. `design-guidance.md` - Visual/style recommendations
3. `speaker-notes.md` - Presentation delivery tips
4. `image-references.md` - Suggested image sources
5. `[topic]-presentation.md` - Complete bundled package

## Examples

See `references/` directory for:
- `education-presentation-example.md`
- `business-pitch-example.md`
- `conference-talk-example.md`

## Quick Commands

```bash
# Create a new presentation
ppt-maker create --topic "Animal Conservation" --audience students --duration 10

# Convert outline to slides
ppt-maker outline-to-slides --file presentation-outline.md

# Generate speaker notes
ppt-maker add-notes --presentation animal-conservation.pptx
```

---

**Remember**: A great presentation tells a story. Focus on narrative flow, not just information dumping.