//npm install pptxgenjs react react-dom react-icons sharp 
// than run : node presentation.js
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");

// Icon imports
const { FaHeartbeat, FaBrain, FaShieldAlt, FaBookOpen, FaExclamationTriangle,
        FaMobileAlt, FaServer, FaDatabase, FaRobot, FaMapMarkerAlt, FaMicrophone,
        FaCheckCircle, FaCalendarAlt, FaSmile, FaGraduationCap, FaUsers,
        FaBell, FaLock, FaGlobeAsia } = require("react-icons/fa");
const { MdHealthAndSafety, MdEmojiEmotions } = require("react-icons/md");

async function iconToBase64Png(IconComponent, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + pngBuffer.toString("base64");
}

async function main() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.title = "Women Wellness and Safety Platform";

  // Color palette: Berry & Cream meets Midnight executive
  const C = {
    deepPurple:  "2D1B4E",   // dominant dark
    berry:       "7B2D8B",   // vibrant brand purple
    rose:        "C2185B",   // accent rose/pink
    softPink:    "F8BBD9",   // light pink
    lavender:    "EDE7F6",   // very light purple
    cream:       "FFF8F0",   // warm white
    white:       "FFFFFF",
    charcoal:    "1A1A2E",
    midGrey:     "6B7280",
    lightGrey:   "F3F4F6",
    gold:        "F59E0B",
    teal:        "0D9488",
    green:       "059669",
  };

  const makeShadow = () => ({ type: "outer", color: "000000", blur: 8, offset: 3, angle: 45, opacity: 0.18 });

  // ─── SLIDE 1: TITLE SLIDE ───────────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.deepPurple };

    // Top decorative arc shape (oval clipped)
    s.addShape(pres.shapes.OVAL, {
      x: -1.5, y: -2.5, w: 7, h: 5,
      fill: { color: C.berry, transparency: 75 },
      line: { color: C.berry, transparency: 75 }
    });
    s.addShape(pres.shapes.OVAL, {
      x: 6.5, y: 3.5, w: 5, h: 5,
      fill: { color: C.rose, transparency: 80 },
      line: { color: C.rose, transparency: 80 }
    });

    // Institution badge
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.5, y: 0.3, w: 9, h: 0.55,
      fill: { color: C.berry, transparency: 50 },
      line: { color: C.softPink, transparency: 60 },
      rectRadius: 0.1
    });
    s.addText("TRIBHUVAN UNIVERSITY  |  INSTITUTE OF ENGINEERING  |  ACEM, KALANKI", {
      x: 0.5, y: 0.3, w: 9, h: 0.55,
      fontSize: 9, color: C.softPink, align: "center", valign: "middle",
      fontFace: "Calibri", charSpacing: 1, margin: 0
    });

    // Main title
    s.addText("WOMEN WELLNESS &", {
      x: 0.6, y: 1.2, w: 8.8, h: 0.85,
      fontSize: 44, bold: true, color: C.white,
      fontFace: "Cambria", align: "center", margin: 0
    });
    s.addText("SAFETY PLATFORM", {
      x: 0.6, y: 1.95, w: 8.8, h: 0.85,
      fontSize: 44, bold: true, color: C.softPink,
      fontFace: "Cambria", align: "center", margin: 0
    });

    // Subtitle
    s.addText("AI-Assisted Emotional Monitoring & Voice-Triggered Emergency Response", {
      x: 0.8, y: 2.9, w: 8.4, h: 0.5,
      fontSize: 14, color: "D8B4FE", fontFace: "Calibri",
      align: "center", italic: true, margin: 0
    });

    // Divider line
    s.addShape(pres.shapes.RECTANGLE, {
      x: 3.5, y: 3.52, w: 3, h: 0.04,
      fill: { color: C.rose }, line: { color: C.rose }
    });

    // Team info
    s.addText([
      { text: "Saksham Bhujel (ACE080BCT063)  ·  Saroj Singh Dhami (ACE080BCT069)  ·  Sumina Dangol (ACE080BCT084)", options: { breakLine: true } },
      { text: "Department of Electronics and Computer Engineering  |  ENCT 354", options: {} }
    ], {
      x: 0.5, y: 3.7, w: 9, h: 0.8,
      fontSize: 11, color: "C4B5FD", fontFace: "Calibri", align: "center"
    });

    // Date badge
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 3.8, y: 4.7, w: 2.4, h: 0.45,
      fill: { color: C.rose, transparency: 30 },
      line: { color: C.softPink, transparency: 40 },
      rectRadius: 0.2
    });
    s.addText("14th June, 2026", {
      x: 3.8, y: 4.7, w: 2.4, h: 0.45,
      fontSize: 11, color: C.white, fontFace: "Calibri", align: "center",
      valign: "middle", bold: true, margin: 0
    });

    s.addNotes("Welcome everyone. Today we present our minor project on the Women Wellness and Safety Platform.");
  }

  // ─── SLIDE 2: MEET ASHA ─────────────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.lavender };

    // Left big card
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.4, y: 0.35, w: 4.6, h: 4.9,
      fill: { color: C.deepPurple },
      line: { color: C.deepPurple },
      rectRadius: 0.25,
      shadow: makeShadow()
    });

    // Avatar circle
    s.addShape(pres.shapes.OVAL, {
      x: 1.5, y: 0.7, w: 2.4, h: 2.4,
      fill: { color: C.berry },
      line: { color: C.softPink, pt: 3 }
    });
    s.addText("👩‍🎓", {
      x: 1.5, y: 0.7, w: 2.4, h: 2.4,
      fontSize: 60, align: "center", valign: "middle", margin: 0
    });

    s.addText("ASHA", {
      x: 0.4, y: 3.22, w: 4.6, h: 0.55,
      fontSize: 32, bold: true, color: C.white, fontFace: "Cambria",
      align: "center", margin: 0
    });
    s.addText("22 years old  ·  Bachelor's Student  ·  Kathmandu", {
      x: 0.4, y: 3.8, w: 4.6, h: 0.4,
      fontSize: 11, color: C.softPink, fontFace: "Calibri",
      align: "center", italic: true, margin: 0
    });
    s.addText("Asha represents thousands of\nwomen across Nepal who face\nchallenges in health, emotional\nwell-being & personal safety\nevery single day.", {
      x: 0.5, y: 4.25, w: 4.4, h: 1.0,
      fontSize: 12, color: "D8B4FE", fontFace: "Calibri",
      align: "center", margin: 0
    });

    // Right side content
    s.addText("Meet Asha", {
      x: 5.4, y: 0.35, w: 4.2, h: 0.65,
      fontSize: 34, bold: true, color: C.deepPurple,
      fontFace: "Cambria", margin: 0
    });
    s.addText("Her story is at the heart of everything we built.", {
      x: 5.4, y: 1.0, w: 4.2, h: 0.4,
      fontSize: 13, color: C.berry, fontFace: "Calibri", italic: true, margin: 0
    });

    const challenges = [
      { icon: "📅", text: "Irregular menstrual cycles she can't track" },
      { icon: "😰", text: "Stress & anxiety with no outlet" },
      { icon: "❓", text: "Health misinformation online" },
      { icon: "🚨", text: "Personal safety on the streets" },
    ];
    challenges.forEach((c, i) => {
      const yy = 1.65 + i * 0.88;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: 5.4, y: yy, w: 4.2, h: 0.72,
        fill: { color: C.white },
        line: { color: "E9D5FF", pt: 1 },
        rectRadius: 0.12,
        shadow: { type: "outer", color: "000000", blur: 4, offset: 2, angle: 45, opacity: 0.1 }
      });
      s.addText(c.icon + "  " + c.text, {
        x: 5.5, y: yy, w: 4.0, h: 0.72,
        fontSize: 12, color: C.charcoal, fontFace: "Calibri",
        valign: "middle", margin: 0
      });
    });

    s.addNotes("Asha is not just a fictional character. She represents the real challenges faced by women in Nepal. She juggles studies, family, and personal life. Let us walk through her daily struggles.");
  }

  // ─── SLIDE 3: PROBLEM 1 — MENSTRUAL HEALTH ─────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.white };

    // Left band
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 0.18, h: 5.625,
      fill: { color: C.rose }, line: { color: C.rose }
    });

    // Problem number badge
    s.addShape(pres.shapes.OVAL, {
      x: 0.35, y: 0.25, w: 0.8, h: 0.8,
      fill: { color: C.rose }, line: { color: C.rose }
    });
    s.addText("1", {
      x: 0.35, y: 0.25, w: 0.8, h: 0.8,
      fontSize: 22, bold: true, color: C.white, fontFace: "Cambria",
      align: "center", valign: "middle", margin: 0
    });

    s.addText("Irregular Menstrual Cycles", {
      x: 1.3, y: 0.25, w: 7.5, h: 0.55,
      fontSize: 26, bold: true, color: C.deepPurple, fontFace: "Cambria", margin: 0
    });
    s.addText("Asha notices her cycle becoming irregular — and has no way to understand her own body.", {
      x: 1.3, y: 0.82, w: 7.5, h: 0.45,
      fontSize: 13, color: C.midGrey, fontFace: "Calibri", italic: true, margin: 0
    });

    // Problem column
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.35, y: 1.45, w: 4.35, h: 3.7,
      fill: { color: "FFF0F5" }, line: { color: "FECDD3", pt: 1 },
      rectRadius: 0.15, shadow: makeShadow()
    });
    s.addShape(pres.shapes.OVAL, {
      x: 2.08, y: 1.55, w: 0.9, h: 0.9,
      fill: { color: C.rose }, line: { color: C.rose }
    });
    s.addText("😟", {
      x: 2.08, y: 1.55, w: 0.9, h: 0.9,
      fontSize: 22, align: "center", valign: "middle", margin: 0
    });
    s.addText("THE FRICTION", {
      x: 0.55, y: 2.55, w: 3.95, h: 0.4,
      fontSize: 13, bold: true, color: C.rose, fontFace: "Calibri",
      charSpacing: 2, align: "center", margin: 0
    });
    const frictions = [
      "She forgets her previous cycle dates",
      "Doesn't know when her next period is due",
      "Symptoms like fatigue & mood swings feel random",
      "No context to understand what's happening"
    ];
    frictions.forEach((f, i) => {
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: 0.5, y: 3.05 + i * 0.5, w: 4.05, h: 0.4,
        fill: { color: "FFE4E6" }, line: { color: "FCA5A5", pt: 1 }, rectRadius: 0.08
      });
      s.addText("✗  " + f, {
        x: 0.6, y: 3.05 + i * 0.5, w: 3.9, h: 0.4,
        fontSize: 11, color: C.rose, fontFace: "Calibri", valign: "middle", margin: 0
      });
    });

    // Solution column
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 5.05, y: 1.45, w: 4.55, h: 3.7,
      fill: { color: "F0FDF4" }, line: { color: "A7F3D0", pt: 1 },
      rectRadius: 0.15, shadow: makeShadow()
    });
    s.addShape(pres.shapes.OVAL, {
      x: 7.1, y: 1.55, w: 0.9, h: 0.9,
      fill: { color: C.green }, line: { color: C.green }
    });
    s.addText("✦", {
      x: 7.1, y: 1.55, w: 0.9, h: 0.9,
      fontSize: 22, color: C.white, align: "center", valign: "middle", margin: 0
    });
    s.addText("OUR SOLUTION", {
      x: 5.25, y: 2.55, w: 4.15, h: 0.4,
      fontSize: 13, bold: true, color: C.green, fontFace: "Calibri",
      charSpacing: 2, align: "center", margin: 0
    });
    const solutions = [
      "Easy cycle date logging",
      "Predict next period & ovulation window",
      "Record & visualize symptoms beautifully",
      "Track cycle history with charts"
    ];
    solutions.forEach((sol, i) => {
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: 5.2, y: 3.05 + i * 0.5, w: 4.2, h: 0.4,
        fill: { color: "D1FAE5" }, line: { color: "6EE7B7", pt: 1 }, rectRadius: 0.08
      });
      s.addText("✓  " + sol, {
        x: 5.3, y: 3.05 + i * 0.5, w: 4.0, h: 0.4,
        fontSize: 11, color: "065F46", fontFace: "Calibri", valign: "middle", margin: 0
      });
    });

    // Formula box
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.35, y: 5.1, w: 9.25, h: 0.38,
      fill: { color: C.lavender }, line: { color: "C4B5FD", pt: 1 }, rectRadius: 0.1
    });
    s.addText("Formula: Predicted Date = Last Cycle Date + Avg. Cycle Length  |  Ovulation = Predicted − 14  |  Fertile Window = Ovulation ± 5 days", {
      x: 0.4, y: 5.1, w: 9.15, h: 0.38,
      fontSize: 9.5, color: C.deepPurple, fontFace: "Courier New",
      align: "center", valign: "middle", margin: 0
    });

    s.addNotes("Problem 1: Asha's menstrual cycle is irregular. On the left are the real frictions she faces daily. On the right is how our system resolves each one through cycle tracking, symptom logging, and prediction.");
  }

  // ─── SLIDE 4: PROBLEM 2 — EMOTIONAL WELLNESS ────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.deepPurple };

    // Background decorative
    s.addShape(pres.shapes.OVAL, {
      x: 7, y: -1, w: 5, h: 5,
      fill: { color: C.berry, transparency: 80 },
      line: { color: C.berry, transparency: 80 }
    });

    // Badge
    s.addShape(pres.shapes.OVAL, {
      x: 0.4, y: 0.28, w: 0.82, h: 0.82,
      fill: { color: C.gold }, line: { color: C.gold }
    });
    s.addText("2", {
      x: 0.4, y: 0.28, w: 0.82, h: 0.82,
      fontSize: 22, bold: true, color: C.charcoal, fontFace: "Cambria",
      align: "center", valign: "middle", margin: 0
    });
    s.addText("Stress, Anxiety & Mental Well-being", {
      x: 1.38, y: 0.3, w: 8, h: 0.55,
      fontSize: 26, bold: true, color: C.white, fontFace: "Cambria", margin: 0
    });
    s.addText("During exam time, Asha faces heavy stress — and keeps it all inside.", {
      x: 1.38, y: 0.88, w: 8, h: 0.4,
      fontSize: 13, color: "C4B5FD", fontFace: "Calibri", italic: true, margin: 0
    });

    // Quote card
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.4, y: 1.4, w: 9.2, h: 0.88,
      fill: { color: C.berry, transparency: 40 },
      line: { color: C.softPink, transparency: 50, pt: 1 },
      rectRadius: 0.15
    });
    s.addText("\" When you express your pain, it lessens. \"", {
      x: 0.5, y: 1.4, w: 9, h: 0.88,
      fontSize: 20, bold: true, color: C.white, fontFace: "Cambria",
      align: "center", valign: "middle", italic: true, margin: 0
    });

    // Three feature cards
    const cards = [
      { emoji: "📝", title: "Daily Mood Logging", desc: "Quick emoji + note to capture how she feels each day" },
      { emoji: "📓", title: "Personal Journaling", desc: "A safe space to express thoughts & feelings freely" },
      { emoji: "🤖", title: "AI Emotional Analysis", desc: "Gemini API reads journal entries, detects patterns & suggests relief" },
    ];
    cards.forEach((c, i) => {
      const xx = 0.4 + i * 3.2;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: xx, y: 2.55, w: 3.0, h: 2.75,
        fill: { color: C.charcoal }, line: { color: "3D1A5C", pt: 1 },
        rectRadius: 0.18, shadow: makeShadow()
      });
      s.addText(c.emoji, {
        x: xx, y: 2.7, w: 3.0, h: 0.7,
        fontSize: 30, align: "center", margin: 0
      });
      s.addText(c.title, {
        x: xx + 0.1, y: 3.45, w: 2.8, h: 0.5,
        fontSize: 13, bold: true, color: C.gold, fontFace: "Calibri",
        align: "center", margin: 0
      });
      s.addText(c.desc, {
        x: xx + 0.12, y: 3.98, w: 2.76, h: 1.2,
        fontSize: 11, color: "D1D5DB", fontFace: "Calibri",
        align: "center", margin: 0
      });
    });

    // Bottom note
    s.addText("AI-driven suggestions include: Guided Breathing  ·  Relaxation Activities  ·  Motivational Messages", {
      x: 0.4, y: 5.25, w: 9.2, h: 0.3,
      fontSize: 10.5, color: "A78BFA", fontFace: "Calibri", align: "center", italic: true, margin: 0
    });

    s.addNotes("Problem 2: Exam stress builds up silently. Our system offers mood logging and journaling as emotional outlets. The key differentiator is our AI — it doesn't just store data, it analyzes it and recommends personalized relief strategies.");
  }

  // ─── SLIDE 5: PROBLEM 3 — HEALTH AWARENESS ─────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.cream };

    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 0.18, h: 5.625,
      fill: { color: C.teal }, line: { color: C.teal }
    });

    s.addShape(pres.shapes.OVAL, {
      x: 0.35, y: 0.28, w: 0.82, h: 0.82,
      fill: { color: C.teal }, line: { color: C.teal }
    });
    s.addText("3", {
      x: 0.35, y: 0.28, w: 0.82, h: 0.82,
      fontSize: 22, bold: true, color: C.white, fontFace: "Cambria",
      align: "center", valign: "middle", margin: 0
    });
    s.addText("Navigating Health Misinformation", {
      x: 1.33, y: 0.3, w: 8.3, h: 0.55,
      fontSize: 26, bold: true, color: C.deepPurple, fontFace: "Cambria", margin: 0
    });
    s.addText("Asha hears about PCOS from a friend and realizes she knows very little about her own health. Online information is unreliable and not localized.", {
      x: 1.33, y: 0.88, w: 8.3, h: 0.45,
      fontSize: 12, color: C.midGrey, fontFace: "Calibri", italic: true, margin: 0
    });

    // Left: problem
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.35, y: 1.5, w: 2.7, h: 3.8,
      fill: { color: "FEF3C7" }, line: { color: "FDE68A", pt: 1 },
      rectRadius: 0.15, shadow: makeShadow()
    });
    s.addText("⚠️\nThe Problem", {
      x: 0.35, y: 1.55, w: 2.7, h: 1.0,
      fontSize: 15, bold: true, color: "92400E", fontFace: "Calibri",
      align: "center", margin: 0
    });
    const problems = ["Reliable health info hard to find", "Online sources often contradict", "No localized / Nepal-context info", "No preventive guidance provided"];
    problems.forEach((p, i) => {
      s.addText("✗  " + p, {
        x: 0.45, y: 2.65 + i * 0.56, w: 2.5, h: 0.48,
        fontSize: 11, color: "92400E", fontFace: "Calibri", margin: 0
      });
    });

    // Health topics grid
    const topics = [
      { emoji: "🔬", title: "PCOS", sub: "Polycystic Ovary Syndrome — causes, symptoms, management" },
      { emoji: "🫧", title: "Ovarian Cysts", sub: "Types, diagnosis, and when to see a doctor" },
      { emoji: "🎗️", title: "Breast Cancer", sub: "Early signs, self-examination, screening guidelines" },
      { emoji: "🩺", title: "Cervical Cancer", sub: "HPV, Pap smear, prevention strategies" },
      { emoji: "📊", title: "Menstrual Disorders", sub: "Dysmenorrhea, PMDD, amenorrhea explained" },
      { emoji: "💡", title: "Daily Health Tips", sub: "Verified, actionable tips for everyday wellness" },
    ];

    topics.forEach((t, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const xx = 3.3 + col * 2.2;
      const yy = 1.5 + row * 1.9;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: xx, y: yy, w: 2.05, h: 1.72,
        fill: { color: C.white }, line: { color: "CCFBF1", pt: 1 },
        rectRadius: 0.14, shadow: { type: "outer", color: "000000", blur: 5, offset: 2, angle: 45, opacity: 0.1 }
      });
      s.addText(t.emoji, {
        x: xx, y: yy + 0.1, w: 2.05, h: 0.55,
        fontSize: 22, align: "center", margin: 0
      });
      s.addText(t.title, {
        x: xx + 0.08, y: yy + 0.62, w: 1.9, h: 0.35,
        fontSize: 11, bold: true, color: C.teal, fontFace: "Calibri",
        align: "center", margin: 0
      });
      s.addText(t.sub, {
        x: xx + 0.08, y: yy + 0.98, w: 1.9, h: 0.72,
        fontSize: 9, color: C.midGrey, fontFace: "Calibri",
        align: "center", margin: 0
      });
    });

    s.addNotes("Problem 3: Women like Asha lack access to reliable health information. We address this with a curated Awareness Module covering 5 major women's health topics with verified, educational content.");
  }

  // ─── SLIDE 6: PROBLEM 4 — EMERGENCY SAFETY ──────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.charcoal };

    s.addShape(pres.shapes.OVAL, {
      x: -2, y: 2, w: 6, h: 6,
      fill: { color: C.rose, transparency: 88 },
      line: { color: C.rose, transparency: 88 }
    });

    s.addShape(pres.shapes.OVAL, {
      x: 0.35, y: 0.28, w: 0.82, h: 0.82,
      fill: { color: C.rose }, line: { color: C.rose }
    });
    s.addText("4", {
      x: 0.35, y: 0.28, w: 0.82, h: 0.82,
      fontSize: 22, bold: true, color: C.white, fontFace: "Cambria",
      align: "center", valign: "middle", margin: 0
    });
    s.addText("Personal Safety on the Streets", {
      x: 1.33, y: 0.3, w: 8.3, h: 0.55,
      fontSize: 26, bold: true, color: C.white, fontFace: "Cambria", margin: 0
    });
    s.addText("One evening, Asha is returning home and finds herself in an unsafe, isolated situation. Every second counts.", {
      x: 1.33, y: 0.88, w: 8.3, h: 0.4,
      fontSize: 13, color: "FCA5A5", fontFace: "Calibri", italic: true, margin: 0
    });

    // Central SOS card
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 3.2, y: 1.5, w: 3.6, h: 1.7,
      fill: { color: C.rose, transparency: 15 },
      line: { color: C.softPink, pt: 2 },
      rectRadius: 0.2, shadow: { type: "outer", color: C.rose, blur: 20, offset: 0, angle: 45, opacity: 0.5 }
    });
    s.addText("🎙️  SOS", {
      x: 3.2, y: 1.55, w: 3.6, h: 0.75,
      fontSize: 28, bold: true, color: C.white, fontFace: "Cambria",
      align: "center", margin: 0
    });
    s.addText("Asha speaks a voice command.\nEmergency mode activates instantly.", {
      x: 3.3, y: 2.3, w: 3.4, h: 0.75,
      fontSize: 11, color: "FDE8E8", fontFace: "Calibri",
      align: "center", margin: 0
    });

    // Flow steps
    const steps = [
      { n: "01", emoji: "🎤", text: "Voice phrase detected\nOR volume button ×3" },
      { n: "02", emoji: "📍", text: "Real-time GPS location\ncaptured immediately" },
      { n: "03", emoji: "📧", text: "Email alert sent\n(online — with map link)" },
      { n: "04", emoji: "📱", text: "SMS alert sent\n(offline fallback)" },
    ];
    steps.forEach((st, i) => {
      const xx = 0.4 + i * 2.35;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: xx, y: 3.4, w: 2.15, h: 1.95,
        fill: { color: "1F1B2E" }, line: { color: "4A2055", pt: 1 },
        rectRadius: 0.15, shadow: makeShadow()
      });
      s.addShape(pres.shapes.OVAL, {
        x: xx + 0.7, y: 3.52, w: 0.7, h: 0.7,
        fill: { color: C.rose }, line: { color: C.rose }
      });
      s.addText(st.n, {
        x: xx + 0.7, y: 3.52, w: 0.7, h: 0.7,
        fontSize: 11, bold: true, color: C.white, fontFace: "Calibri",
        align: "center", valign: "middle", margin: 0
      });
      s.addText(st.emoji, {
        x: xx, y: 4.22, w: 2.15, h: 0.5,
        fontSize: 20, align: "center", margin: 0
      });
      s.addText(st.text, {
        x: xx + 0.1, y: 4.72, w: 1.95, h: 0.58,
        fontSize: 10, color: "E9D5FF", fontFace: "Calibri",
        align: "center", margin: 0
      });
    });

    s.addNotes("Problem 4 is the most urgent — personal safety. Our voice-triggered SOS needs no manual phone interaction. One voice phrase activates the full emergency chain: GPS capture, email with location link, and offline SMS fallback.");
  }

  // ─── SLIDE 7: SYSTEM ARCHITECTURE ───────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.white };

    // Header
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 10, h: 0.85,
      fill: { color: C.deepPurple }, line: { color: C.deepPurple }
    });
    s.addText("System Architecture", {
      x: 0.4, y: 0, w: 9.2, h: 0.85,
      fontSize: 22, bold: true, color: C.white, fontFace: "Cambria",
      valign: "middle", margin: 0
    });
    s.addText("A layered client-server design connecting mobile, web, AI & database", {
      x: 5, y: 0, w: 4.8, h: 0.85,
      fontSize: 11, color: "D8B4FE", fontFace: "Calibri",
      valign: "middle", align: "right", italic: true, margin: 0
    });

    // Architecture layers — horizontal flow
    const layers = [
      { label: "FRONTEND", sub: "React Native (Mobile)\nReact.js (Web)", color: C.berry, emoji: "📱" },
      { label: "BACKEND", sub: "FastAPI\nBusiness Logic & APIs", color: C.rose, emoji: "⚙️" },
      { label: "DATABASE", sub: "PostgreSQL / SQLite\nSecure Data Storage", color: C.teal, emoji: "🗄️" },
      { label: "AI LAYER", sub: "Google Gemini API\nEmotional Analysis", color: C.gold, emoji: "🤖" },
    ];
    layers.forEach((l, i) => {
      const xx = 0.35 + i * 2.35;
      // Main box
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: xx, y: 1.05, w: 2.15, h: 3.1,
        fill: { color: l.color, transparency: 88 },
        line: { color: l.color, pt: 2 },
        rectRadius: 0.15, shadow: makeShadow()
      });
      // Icon oval
      s.addShape(pres.shapes.OVAL, {
        x: xx + 0.6, y: 1.18, w: 0.95, h: 0.95,
        fill: { color: l.color }, line: { color: l.color }
      });
      s.addText(l.emoji, {
        x: xx + 0.6, y: 1.18, w: 0.95, h: 0.95,
        fontSize: 22, align: "center", valign: "middle", margin: 0
      });
      s.addText(l.label, {
        x: xx + 0.08, y: 2.22, w: 1.99, h: 0.45,
        fontSize: 13, bold: true, color: l.color, fontFace: "Cambria",
        align: "center", charSpacing: 1, margin: 0
      });
      s.addText(l.sub, {
        x: xx + 0.1, y: 2.72, w: 1.95, h: 1.1,
        fontSize: 10.5, color: C.charcoal, fontFace: "Calibri",
        align: "center", margin: 0
      });
      // Arrow (not after last)
      if (i < 3) {
        s.addShape(pres.shapes.RECTANGLE, {
          x: xx + 2.2, y: 2.4, w: 0.12, h: 0.25,
          fill: { color: C.midGrey }, line: { color: C.midGrey }
        });
        s.addText("→", {
          x: xx + 2.17, y: 2.28, w: 0.18, h: 0.4,
          fontSize: 16, color: C.midGrey, align: "center", valign: "middle", margin: 0
        });
      }
    });

    // Security & JWT note
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.35, y: 4.3, w: 4.6, h: 0.78,
      fill: { color: C.lavender }, line: { color: "C4B5FD", pt: 1 }, rectRadius: 0.12
    });
    s.addText("🔒  Security: JWT Authentication · Secure API · PostgreSQL encryption · HTTPS communication", {
      x: 0.5, y: 4.3, w: 4.4, h: 0.78,
      fontSize: 10.5, color: C.deepPurple, fontFace: "Calibri",
      valign: "middle", margin: 0
    });

    // Tech stack summary
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 5.2, y: 4.3, w: 4.45, h: 0.78,
      fill: { color: "E0F2FE" }, line: { color: "BAE6FD", pt: 1 }, rectRadius: 0.12
    });
    s.addText("🛠  Stack: React Native · React.js · FastAPI · PostgreSQL · Google Gemini API · Google Maps API · JWT", {
      x: 5.35, y: 4.3, w: 4.25, h: 0.78,
      fontSize: 10.5, color: "0C4A6E", fontFace: "Calibri",
      valign: "middle", margin: 0
    });

    s.addNotes("Our architecture follows a clean 4-layer client-server model. The frontend captures user inputs, FastAPI backend handles all logic, the database stores securely, and the AI layer adds intelligence via Google Gemini.");
  }

  // ─── SLIDE 8: FUNCTIONAL MODULES ────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.lavender };

    s.addText("Functional Modules", {
      x: 0.4, y: 0.2, w: 9.2, h: 0.6,
      fontSize: 28, bold: true, color: C.deepPurple, fontFace: "Cambria", margin: 0
    });
    s.addText("Six integrated modules working as one unified platform", {
      x: 0.4, y: 0.8, w: 9.2, h: 0.35,
      fontSize: 12, color: C.berry, fontFace: "Calibri", italic: true, margin: 0
    });

    const modules = [
      { emoji: "🔐", title: "Authentication", desc: "JWT registration, login & account security", color: C.midGrey },
      { emoji: "📅", title: "Menstrual Tracking", desc: "Cycle logging, period prediction, symptom visualization", color: C.rose },
      { emoji: "🧠", title: "AI Emotional Monitoring", desc: "Gemini API-powered mood & journal analysis", color: C.berry },
      { emoji: "🆘", title: "SOS Emergency", desc: "Voice-activated alerts & real-time GPS sharing", color: "DC2626" },
      { emoji: "📚", title: "Awareness Module", desc: "PCOS, cancer, menstrual disorder education", color: C.teal },
      { emoji: "🔔", title: "Notifications", desc: "Cycle reminders & daily mood input prompts", color: C.gold },
    ];

    modules.forEach((m, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const xx = 0.4 + col * 3.2;
      const yy = 1.3 + row * 2.05;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: xx, y: yy, w: 2.95, h: 1.85,
        fill: { color: C.white },
        line: { color: m.color, pt: 2 },
        rectRadius: 0.18,
        shadow: { type: "outer", color: "000000", blur: 6, offset: 2, angle: 45, opacity: 0.12 }
      });
      s.addText(m.emoji, {
        x: xx, y: yy + 0.12, w: 2.95, h: 0.6,
        fontSize: 26, align: "center", margin: 0
      });
      s.addText(m.title, {
        x: xx + 0.1, y: yy + 0.72, w: 2.75, h: 0.4,
        fontSize: 12, bold: true, color: m.color, fontFace: "Calibri",
        align: "center", margin: 0
      });
      s.addText(m.desc, {
        x: xx + 0.12, y: yy + 1.12, w: 2.71, h: 0.68,
        fontSize: 10, color: C.charcoal, fontFace: "Calibri",
        align: "center", margin: 0
      });
    });

    s.addNotes("Six modules form the backbone of our platform. Each solves a specific need but they all share data and insights — that interconnection is what makes this system more powerful than any standalone app.");
  }

  // ─── SLIDE 9: COMPARISON TABLE ───────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.white };

    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 10, h: 0.85,
      fill: { color: C.berry }, line: { color: C.berry }
    });
    s.addText("Why Our Platform? — Competitive Comparison", {
      x: 0.4, y: 0, w: 9.2, h: 0.85,
      fontSize: 21, bold: true, color: C.white, fontFace: "Cambria",
      valign: "middle", margin: 0
    });

    // Table header
    const cols = ["Platform", "Menstrual\nHealth", "Emotional\nWellness", "AI\nAnalysis", "Emergency\nSafety", "Unified\nPlatform"];
    const colW = [2.0, 1.45, 1.45, 1.4, 1.45, 1.45];
    let xx = 0.35;
    cols.forEach((col, ci) => {
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: xx, y: 1.05, w: colW[ci], h: 0.7,
        fill: { color: C.deepPurple }, line: { color: C.deepPurple }, rectRadius: 0.06
      });
      s.addText(col, {
        x: xx, y: 1.05, w: colW[ci], h: 0.7,
        fontSize: 10, bold: true, color: C.white, fontFace: "Calibri",
        align: "center", valign: "middle", margin: 0
      });
      xx += colW[ci] + 0.08;
    });

    const rows = [
      ["Flo", "✓", "✗", "✗", "✗", "✗"],
      ["Clue", "✓", "✗", "✗", "✗", "✗"],
      ["bSafe", "✗", "✗", "✗", "✓", "✗"],
      ["Daylio", "✗", "✓", "✗", "✗", "✗"],
      ["NIRAAH", "✗", "✓", "✓", "✗", "✗"],
      ["ANARKI", "✗", "✗", "✗", "✓", "✗"],
      ["Our Platform ✦", "✓", "✓", "✓", "✓", "✓"],
    ];
    const rowColors = ["F9FAFB","F9FAFB","F9FAFB","F9FAFB","F9FAFB","F9FAFB","EDE7F6"];
    const highlightRow = 6;
    rows.forEach((row, ri) => {
      let rx = 0.35;
      row.forEach((cell, ci) => {
        const isLast = ri === highlightRow;
        const isCheck = cell === "✓";
        const isCross = cell === "✗";
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
          x: rx, y: 1.85 + ri * 0.5, w: colW[ci], h: 0.46,
          fill: { color: isLast ? "EDE7F6" : (ri % 2 === 0 ? "F9FAFB" : "FFFFFF") },
          line: { color: "E5E7EB", pt: 0.5 }, rectRadius: 0.04
        });
        const cellColor = isLast ? C.berry : (isCheck ? C.green : (isCross ? C.rose : C.charcoal));
        s.addText(cell, {
          x: rx, y: 1.85 + ri * 0.5, w: colW[ci], h: 0.46,
          fontSize: isLast && ci === 0 ? 10.5 : 13,
          bold: isLast,
          color: cellColor, fontFace: "Calibri",
          align: "center", valign: "middle", margin: 0
        });
        rx += colW[ci] + 0.08;
      });
    });

    s.addNotes("This comparison clearly shows the research gap we identified. Every existing platform solves one problem. Ours is the only system that integrates all five dimensions into one platform.");
  }

  // ─── SLIDE 10: TESTING & TIMELINE ────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.deepPurple };

    s.addShape(pres.shapes.OVAL, {
      x: 7.5, y: -1.5, w: 5, h: 5,
      fill: { color: C.berry, transparency: 82 },
      line: { color: C.berry, transparency: 82 }
    });

    s.addText("Testing, Timeline & Budget", {
      x: 0.4, y: 0.2, w: 9.2, h: 0.65,
      fontSize: 26, bold: true, color: C.white, fontFace: "Cambria", margin: 0
    });

    // Testing column
    const tests = [
      { name: "Unit Testing", desc: "Individual modules tested in isolation" },
      { name: "Integration Testing", desc: "Frontend ↔ Backend ↔ DB ↔ Gemini API" },
      { name: "System Testing", desc: "Full integrated system end-to-end" },
      { name: "Performance Testing", desc: "API response time, responsiveness" },
      { name: "Security Testing", desc: "JWT auth, data protection, API security" },
      { name: "User Acceptance", desc: "Real users evaluate usability & features" },
    ];
    tests.forEach((t, i) => {
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: 0.35, y: 1.05 + i * 0.7, w: 4.5, h: 0.62,
        fill: { color: C.charcoal }, line: { color: "3D1A5C", pt: 1 }, rectRadius: 0.1,
        shadow: { type: "outer", color: "000000", blur: 4, offset: 2, angle: 45, opacity: 0.2 }
      });
      s.addText("✓  " + t.name, {
        x: 0.45, y: 1.05 + i * 0.7, w: 2.1, h: 0.62,
        fontSize: 11, bold: true, color: C.gold, fontFace: "Calibri",
        valign: "middle", margin: 0
      });
      s.addText(t.desc, {
        x: 2.55, y: 1.05 + i * 0.7, w: 2.2, h: 0.62,
        fontSize: 10, color: "C4B5FD", fontFace: "Calibri",
        valign: "middle", margin: 0
      });
    });

    // Timeline summary
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 5.1, y: 1.05, w: 4.55, h: 3.35,
      fill: { color: C.charcoal }, line: { color: "3D1A5C", pt: 1 }, rectRadius: 0.15,
      shadow: makeShadow()
    });
    s.addText("⏱  9-Week Timeline", {
      x: 5.2, y: 1.1, w: 4.35, h: 0.5,
      fontSize: 14, bold: true, color: C.gold, fontFace: "Cambria", align: "center", margin: 0
    });
    const weeks = [
      "W1-2: Requirements & System Design",
      "W2-3: UI/UX Design (Figma)",
      "W3-5: React Native Mobile App",
      "W4-5: FastAPI Backend Development",
      "W4-5: Database Design & Integration",
      "W5:    Gemini API Integration",
      "W6-7: SOS & Location Module",
      "W7:    Testing & Debugging",
      "W8-9: Documentation & Final Review",
    ];
    weeks.forEach((w, i) => {
      s.addText("›  " + w, {
        x: 5.25, y: 1.7 + i * 0.33, w: 4.3, h: 0.32,
        fontSize: 10, color: "D8B4FE", fontFace: "Calibri", margin: 0
      });
    });

    // Budget
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 5.1, y: 4.55, w: 4.55, h: 0.78,
      fill: { color: C.green, transparency: 80 },
      line: { color: C.green, transparency: 50, pt: 1 }, rectRadius: 0.12
    });
    s.addText("💰  Total Estimated Budget: NPR 3,200  (mostly open-source tools)", {
      x: 5.2, y: 4.55, w: 4.35, h: 0.78,
      fontSize: 11, bold: true, color: "D1FAE5", fontFace: "Calibri",
      align: "center", valign: "middle", margin: 0
    });

    s.addNotes("We follow a comprehensive testing strategy covering 6 testing types. The project is scoped to 9 weeks, and our estimated budget is just NPR 3,200 because we leverage free, open-source tools throughout.");
  }

  // ─── SLIDE 11: THE BIGGER PICTURE / CONCLUSION ───────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.deepPurple };

    // Decorative
    s.addShape(pres.shapes.OVAL, {
      x: -1, y: -1.5, w: 6, h: 6,
      fill: { color: C.berry, transparency: 82 },
      line: { color: C.berry, transparency: 82 }
    });
    s.addShape(pres.shapes.OVAL, {
      x: 6.5, y: 2.5, w: 5, h: 5,
      fill: { color: C.rose, transparency: 88 },
      line: { color: C.rose, transparency: 88 }
    });

    s.addText("The Bigger Picture", {
      x: 0.5, y: 0.25, w: 9, h: 0.7,
      fontSize: 32, bold: true, color: C.white, fontFace: "Cambria",
      align: "center", margin: 0
    });

    // Center quote
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.8, y: 1.1, w: 8.4, h: 1.3,
      fill: { color: C.berry, transparency: 50 },
      line: { color: C.softPink, transparency: 40, pt: 1 }, rectRadius: 0.2
    });
    s.addText("\" Even if we make life easier for just one person —\nthat is a massive achievement. \"", {
      x: 0.9, y: 1.1, w: 8.2, h: 1.3,
      fontSize: 18, bold: true, color: C.white, fontFace: "Cambria",
      align: "center", valign: "middle", italic: true, margin: 0
    });

    // Four outcome pillars
    const pillars = [
      { emoji: "❤️", title: "Health", text: "Women understand & manage their reproductive health proactively" },
      { emoji: "🧘", title: "Wellness", text: "Emotional patterns tracked, relief suggestions provided daily" },
      { emoji: "📖", title: "Knowledge", text: "Accurate, verified health education accessible in one place" },
      { emoji: "🛡️", title: "Safety", text: "Instant emergency response when it matters most" },
    ];
    pillars.forEach((p, i) => {
      const xx = 0.4 + i * 2.35;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: xx, y: 2.65, w: 2.15, h: 2.45,
        fill: { color: "1F1B2E" }, line: { color: "4A2055", pt: 1 },
        rectRadius: 0.15, shadow: makeShadow()
      });
      s.addText(p.emoji, {
        x: xx, y: 2.75, w: 2.15, h: 0.6,
        fontSize: 26, align: "center", margin: 0
      });
      s.addText(p.title, {
        x: xx + 0.1, y: 3.4, w: 1.95, h: 0.4,
        fontSize: 13, bold: true, color: C.gold, fontFace: "Cambria",
        align: "center", margin: 0
      });
      s.addText(p.text, {
        x: xx + 0.1, y: 3.82, w: 1.95, h: 1.18,
        fontSize: 10.5, color: "D8B4FE", fontFace: "Calibri",
        align: "center", margin: 0
      });
    });

    s.addNotes("Asha represents thousands of women across Nepal. Our platform provides one intelligent, accessible solution. We don't need to change the world on day one — if we make one woman's life safer and healthier, we've succeeded.");
  }

  // ─── SLIDE 12: THANK YOU ────────────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.white };

    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 10, h: 2.8,
      fill: { color: C.deepPurple }, line: { color: C.deepPurple }
    });
    s.addShape(pres.shapes.OVAL, {
      x: 6, y: -1.5, w: 5, h: 5,
      fill: { color: C.berry, transparency: 80 },
      line: { color: C.berry, transparency: 80 }
    });

    s.addText("Thank You", {
      x: 0.5, y: 0.35, w: 9, h: 1.1,
      fontSize: 54, bold: true, color: C.white, fontFace: "Cambria",
      align: "center", margin: 0
    });
    s.addText("We are happy to take your questions.", {
      x: 0.5, y: 1.52, w: 9, h: 0.55,
      fontSize: 16, color: "D8B4FE", fontFace: "Calibri",
      align: "center", italic: true, margin: 0
    });

    // Team cards
    const team = [
      { name: "Saksham Bhujel", roll: "ACE080BCT063" },
      { name: "Saroj Singh Dhami", roll: "ACE080BCT069" },
      { name: "Sumina Dangol", roll: "ACE080BCT084" },
    ];
    team.forEach((t, i) => {
      const xx = 0.85 + i * 2.85;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: xx, y: 3.0, w: 2.55, h: 1.45,
        fill: { color: C.lavender }, line: { color: "C4B5FD", pt: 1 },
        rectRadius: 0.18, shadow: makeShadow()
      });
      s.addText("👤", {
        x: xx, y: 3.05, w: 2.55, h: 0.55,
        fontSize: 22, align: "center", margin: 0
      });
      s.addText(t.name, {
        x: xx + 0.1, y: 3.6, w: 2.35, h: 0.42,
        fontSize: 11, bold: true, color: C.deepPurple, fontFace: "Calibri",
        align: "center", margin: 0
      });
      s.addText(t.roll, {
        x: xx + 0.1, y: 4.0, w: 2.35, h: 0.35,
        fontSize: 10, color: C.berry, fontFace: "Calibri",
        align: "center", margin: 0
      });
    });

    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 2.5, y: 4.6, w: 5, h: 0.75,
      fill: { color: C.berry, transparency: 88 },
      line: { color: "C4B5FD", pt: 1 }, rectRadius: 0.15
    });
    s.addText("ENCT 354  ·  Department of ECE  ·  ACEM, Kalanki, Kathmandu  ·  14 June 2026", {
      x: 2.5, y: 4.6, w: 5, h: 0.75,
      fontSize: 9.5, color: C.berry, fontFace: "Calibri",
      align: "center", valign: "middle", margin: 0
    });

    s.addNotes("Thank the panel, welcome questions. Key points to prepare for: why Gemini API vs building our own model? Why React Native over Flutter? How does voice SOS handle false positives?");
  }

  await pres.writeFile({ fileName: "Asha_Defense_Presentation.pptx" });
  console.log("Done!");
}

main().catch(console.error);