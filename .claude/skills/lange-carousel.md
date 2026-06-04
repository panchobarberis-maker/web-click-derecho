# Skill: Lange Firm Carousel

Generates a 6-slide Instagram carousel (1080x1350 JPG, 4:5) for **The Lange Firm** — employment law attorneys in Houston, TX. Attorney: **Evan Lange**.

## Trigger

Use this skill when the user sends an employment law topic for The Lange Firm. Examples:
- "wrongful termination"
- "workplace harassment"
- "unpaid wages Texas"
- "discrimination at work"

## What you do

1. Generate content for 6 slides based on the topic (English, serious/professional tone, focused on Texas employment law)
2. Run `scripts/generate_lange.py "<topic>"` 
3. Send all 6 output JPGs to the user

## Slide structure

- **Slide 1** — Cover: bold title + subtitle + safe zone (220px top/bottom margin)
- **Slide 2** — 3 key legal protections (box items)
- **Slide 3** — 1 impactful stat + 3 bullet points (box items)
- **Slide 4** — 3 red flags / signs you have a claim (box items)
- **Slide 5** — 3 action steps (box items)
- **Slide 6** — CTA with Evan Lange photo, "Talk to Evan Now", "Contact Us for a Consultation"

## Content rules

- English only
- **LESS IS MORE** — one strong idea per box, no walls of text
- Box titles: max 6 words, punchy and direct
- Box descriptions: max 8 words, or omit entirely if the title is self-explanatory
- Talk to the reader like a person — "Your hours got cut? That's a problem." Not legal jargon
- Focus on: Does the reader have a problem? What can they get back?
- Always Texas law context — never name specific laws, never say "federal"
- Tone: direct, human, protective — not corporate
- NEVER use the words "Free Consultation" anywhere
- CTA button: "Talk to Evan Now" / tagline: "Contact Us for a Consultation"
- Logo on every slide: THE LANGE FIRM

## Assets (fetched from GitHub on each run)

- Evan's photo: `https://raw.githubusercontent.com/panchobarberis-maker/Carrousels/main/evan.jpeg`
- Background images (5 total): `ChatGPT Image May 21, 2026, 06_41_43 PM (1).png` through `(5).png` in the same repo
- URL-encode spaces as `%20` and commas as `%2C`

## Output

Files saved to `./carruseles/lange/<slug>/slide_01.jpg` through `slide_06.jpg`
