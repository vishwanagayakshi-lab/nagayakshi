// src/i18n/componentMessages.ts

export type NavMessages = {
  poojas: string;
  muttu: string;
  thampuran: string;
  more: string;
  about: string;
  visit: string;
  protocols: string;
  poojaRequest: string;
};

export type FooterMessages = {
  aboutText: string;
  quickLinksHeading: string;
  quickLinks: { about: string; poojas: string; thampuran: string; protocols: string; visit: string };
  servicesHeading: string;
  services: { ayilyam: string; kalaSarpaBali: string; navagrahaHomam: string; muttu: string };
  contactHeading: string;
  darshanTimingsLabel: string;
  morning: string;
  evening: string;
  rightsReserved: string;
};

export const NAV: Record<string, NavMessages> = {
  en: {
    poojas: "Poojas", muttu: "Muttu", thampuran: "Thampuran", more: "More",
    about: "About", visit: "Visit", protocols: "Protocols", poojaRequest: "Pooja Request",
  },
  ml: {
    poojas: "പൂജകൾ", muttu: "മുറ്റ്", thampuran: "തമ്പുരാൻ", more: "കൂടുതൽ",
    about: "ഞങ്ങളെക്കുറിച്ച്", visit: "സന്ദർശനം", protocols: "ആചാരമര്യാദകൾ", poojaRequest: "പൂജ അപേക്ഷ",
  },
  ta: {
    poojas: "பூஜைகள்", muttu: "முட்டு", thampuran: "தம்புரான்", more: "மேலும்",
    about: "எங்களைப் பற்றி", visit: "வருகை", protocols: "ஒழுங்குமுறைகள்", poojaRequest: "பூஜை கோரிக்கை",
  },
  te: {
    poojas: "పూజలు", muttu: "ముట్టు", thampuran: "తంపురాన్", more: "మరిన్ని",
    about: "మా గురించి", visit: "సందర్శన", protocols: "నియమావళి", poojaRequest: "పూజ అభ్యర్థన",
  },
  kn: {
    poojas: "ಪೂಜೆಗಳು", muttu: "ಮುಟ್ಟು", thampuran: "ತಂಪುರಾನ್", more: "ಇನ್ನಷ್ಟು",
    about: "ನಮ್ಮ ಬಗ್ಗೆ", visit: "ಭೇಟಿ", protocols: "ನಿಯಮಗಳು", poojaRequest: "ಪೂಜಾ ಮನವಿ",
  },
};

export const FOOTER: Record<string, FooterMessages> = {
  en: {
    aboutText: "Sacred naga worship temple dedicated to Vishwanagayakshi, Nagaraja, and Sarpayakshi. Offering authentic Vedic remedies for Naga Dosha under the guidance of Ambotti Thampuran.",
    quickLinksHeading: "Quick Links",
    quickLinks: { about: "About the Temple", poojas: "Poojas & Homams", thampuran: "Ambotti Thampuran", protocols: "Temple Protocols", visit: "Visit Us" },
    servicesHeading: "Services",
    services: { ayilyam: "Ayilyam Pooja", kalaSarpaBali: "Kala Sarpa Bali", navagrahaHomam: "Navagraha Homam", muttu: "Muttu" },
    contactHeading: "Contact",
    darshanTimingsLabel: "Darshan Timings:",
    morning: "Morning",
    evening: "Evening",
    rightsReserved: "All rights reserved.",
  },
  ml: {
    aboutText: "വിശ്വനാഗയക്ഷി, നാഗരാജാവ്, സർപ്പയക്ഷി എന്നിവർക്കായി സമർപ്പിച്ച പുണ്യ നാഗാരാധനാ ക്ഷേത്രം. അമ്പോറ്റി തമ്പുരാന്റെ മാർഗ്ഗനിർദ്ദേശത്തിൽ നാഗദോഷത്തിന് ആധികാരിക വൈദിക പരിഹാരങ്ങൾ.",
    quickLinksHeading: "പ്രധാന ലിങ്കുകൾ",
    quickLinks: { about: "ക്ഷേത്രത്തെക്കുറിച്ച്", poojas: "പൂജകളും ഹോമങ്ങളും", thampuran: "അമ്പോറ്റി തമ്പുരാൻ", protocols: "ക്ഷേത്ര ആചാരമര്യാദകൾ", visit: "സന്ദർശിക്കൂ" },
    servicesHeading: "പൂജാവിധികൾ",
    services: { ayilyam: "അയില്യം പൂജ", kalaSarpaBali: "കാലസർപ്പ ബലി", navagrahaHomam: "നവഗ്രഹ ഹോമം", muttu: "മുറ്റ്" },
    contactHeading: "ബന്ധപ്പെടുക",
    darshanTimingsLabel: "ദർശന സമയം:",
    morning: "രാവിലെ",
    evening: "വൈകുന്നേരം",
    rightsReserved: "എല്ലാ അവകാശങ്ങളും സംരക്ഷിതം.",
  },
  ta: {
    aboutText: "விஸ்வநாகயக்ஷி, நாகராஜா, சர்ப்பயக்ஷி ஆகியோருக்கு அர்ப்பணிக்கப்பட்ட புனித நாக வழிபாட்டு கோவில். அம்போற்றி தம்புரானின் வழிகாட்டுதலில் நாக தோஷத்திற்கான தூய வேத பரிகாரங்களை வழங்குகிறோம்.",
    quickLinksHeading: "முக்கிய இணைப்புகள்",
    quickLinks: { about: "கோவிலைப் பற்றி", poojas: "பூஜைகளும் ஹோமங்களும்", thampuran: "அம்போற்றி தம்புரான்", protocols: "கோவில் ஒழுங்குமுறைகள்", visit: "வருகை தரவும்" },
    servicesHeading: "பூஜைகள்",
    services: { ayilyam: "ஆயில்யம் பூஜை", kalaSarpaBali: "காலசர்ப்ப பலி", navagrahaHomam: "நவக்கிரக ஹோமம்", muttu: "முட்டு" },
    contactHeading: "தொடர்பு கொள்ள",
    darshanTimingsLabel: "தரிசன நேரம்:",
    morning: "காலை",
    evening: "மாலை",
    rightsReserved: "அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.",
  },
  te: {
    aboutText: "విశ్వనాగయక్షి, నాగరాజు, సర్పయక్షికి అంకితమైన పవిత్ర నాగారాధన ఆలయం. అంబొట్టి తంపురాన్ మార్గదర్శకత్వంలో నాగ దోషానికి ప్రామాణిక వైదిక పరిహారాలు అందిస్తున్నాం.",
    quickLinksHeading: "ముఖ్య లింకులు",
    quickLinks: { about: "ఆలయం గురించి", poojas: "పూజలు & హోమాలు", thampuran: "అంబొట్టి తంపురాన్", protocols: "ఆలయ నియమావళి", visit: "సందర్శించండి" },
    servicesHeading: "పూజా సేవలు",
    services: { ayilyam: "ఆయిల్యం పూజ", kalaSarpaBali: "కాల సర్ప బలి", navagrahaHomam: "నవగ్రహ హోమం", muttu: "ముట్టు" },
    contactHeading: "సంప్రదించండి",
    darshanTimingsLabel: "దర్శన సమయాలు:",
    morning: "ఉదయం",
    evening: "సాయంత్రం",
    rightsReserved: "అన్ని హక్కులు కలిగి ఉన్నాయి.",
  },
  kn: {
    aboutText: "ವಿಶ್ವನಾಗಯಕ್ಷಿ, ನಾಗರಾಜ, ಸರ್ಪಯಕ್ಷಿಗೆ ಸಮರ್ಪಿತವಾದ ಪವಿತ್ರ ನಾಗಾರಾಧನೆ ದೇವಾಲಯ. ಅಂಬೊಟ್ಟಿ ತಂಪುರಾನ್ ಅವರ ಮಾರ್ಗದರ್ಶನದಲ್ಲಿ ನಾಗ ದೋಷಕ್ಕೆ ಪ್ರಾಮಾಣಿಕ ವೈದಿಕ ಪರಿಹಾರಗಳನ್ನು ನೀಡುತ್ತಿದ್ದೇವೆ.",
    quickLinksHeading: "ಪ್ರಮುಖ ಕೊಂಡಿಗಳು",
    quickLinks: { about: "ದೇವಾಲಯದ ಬಗ್ಗೆ", poojas: "ಪೂಜೆಗಳು & ಹೋಮಗಳು", thampuran: "ಅಂಬೊಟ್ಟಿ ತಂಪುರಾನ್", protocols: "ದೇವಾಲಯದ ನಿಯಮಗಳು", visit: "ಭೇಟಿ ನೀಡಿ" },
    servicesHeading: "ಪೂಜಾ ಸೇವೆಗಳು",
    services: { ayilyam: "ಆಯಿಲ್ಯಂ ಪೂಜೆ", kalaSarpaBali: "ಕಾಲಸರ್ಪ ಬಲಿ", navagrahaHomam: "ನವಗ್ರಹ ಹೋಮ", muttu: "ಮುಟ್ಟು" },
    contactHeading: "ಸಂಪರ್ಕಿಸಿ",
    darshanTimingsLabel: "ದರ್ಶನ ಸಮಯ:",
    morning: "ಬೆಳಿಗ್ಗೆ",
    evening: "ಸಂಜೆ",
    rightsReserved: "ಎಲ್ಲಾ ಹಕ್ಕುಗಳನ್ನು ಕಾಯ್ದಿರಿಸಲಾಗಿದೆ.",
  },
};

export const tNav = (locale: string): NavMessages => NAV[locale] ?? NAV.en;
export const tFooter = (locale: string): FooterMessages => FOOTER[locale] ?? FOOTER.en;
