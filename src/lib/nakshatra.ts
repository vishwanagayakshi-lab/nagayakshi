import type { Nakshatra } from './types';

export const NAKSHATRAS: Nakshatra[] = [
  { key: 'ashwini',            sanskrit: 'Ashwini',            tamil: 'அஸ்வினி (Aswini)',              malayalam: 'അശ്വതി (Ashwathi)'       },
  { key: 'bharani',            sanskrit: 'Bharani',            tamil: 'பரணி (Bharani)',                malayalam: 'ഭരണി (Bharani)'           },
  { key: 'krittika',           sanskrit: 'Krittika',           tamil: 'கார்த்திகை (Karthigai)',        malayalam: 'കാർത്തിക (Karthika)'      },
  { key: 'rohini',             sanskrit: 'Rohini',             tamil: 'ரோகிணி (Rohini)',               malayalam: 'രോഹിണി (Rohini)'          },
  { key: 'mrigashira',         sanskrit: 'Mrigashira',         tamil: 'மிருகசீரிஷம் (Mirugasheersham)', malayalam: 'മകയിരം (Makayiram)'       },
  { key: 'ardra',              sanskrit: 'Ardra',              tamil: 'திருவாதிரை (Thiruvathirai)',     malayalam: 'തിരുവാതിര (Thiruvathira)' },
  { key: 'punarvasu',          sanskrit: 'Punarvasu',          tamil: 'புனர்பூசம் (Punarpoosam)',      malayalam: 'പുണർതം (Punartham)'       },
  { key: 'pushya',             sanskrit: 'Pushya',             tamil: 'பூசம் (Poosam)',                malayalam: 'പൂയം (Pooyam)'            },
  { key: 'ashlesha',           sanskrit: 'Ashlesha',           tamil: 'ஆயில்யம் (Ayilyam)',            malayalam: 'ആയില്യം (Ayilyam)'        },
  { key: 'magha',              sanskrit: 'Magha',              tamil: 'மகம் (Magam)',                  malayalam: 'മകം (Makam)'              },
  { key: 'purva_phalguni',     sanskrit: 'Purva Phalguni',     tamil: 'பூரம் (Pooram)',                malayalam: 'പൂരം (Pooram)'            },
  { key: 'uttara_phalguni',    sanskrit: 'Uttara Phalguni',    tamil: 'உத்திரம் (Uthiram)',            malayalam: 'ഉത്രം (Uthram)'           },
  { key: 'hasta',              sanskrit: 'Hasta',              tamil: 'அஸ்தம் (Astham)',               malayalam: 'അത്തം (Atham)'            },
  { key: 'chitra',             sanskrit: 'Chitra',             tamil: 'சித்திரை (Chittirai)',          malayalam: 'ചിത്തിര (Chithira)'       },
  { key: 'swati',              sanskrit: 'Swati',              tamil: 'சுவாதி (Swathi)',               malayalam: 'ചോതി (Chothi)'           },
  { key: 'vishakha',           sanskrit: 'Vishakha',           tamil: 'விசாகம் (Visakam)',             malayalam: 'വിശാഖം (Vishakham)'       },
  { key: 'anuradha',           sanskrit: 'Anuradha',           tamil: 'அனுஷம் (Anusham)',              malayalam: 'അനിഴം (Anizham)'          },
  { key: 'jyeshtha',           sanskrit: 'Jyeshtha',           tamil: 'கேட்டை (Kettai)',               malayalam: 'തൃക്കേട്ട (Thrikketta)'   },
  { key: 'mula',               sanskrit: 'Mula',               tamil: 'மூலம் (Moolam)',                malayalam: 'മൂലം (Moolam)'            },
  { key: 'purva_ashadha',      sanskrit: 'Purva Ashadha',      tamil: 'பூராடம் (Pooradam)',            malayalam: 'പൂരാടം (Pooradam)'        },
  { key: 'uttara_ashadha',     sanskrit: 'Uttara Ashadha',     tamil: 'உத்திராடம் (Uthiradam)',        malayalam: 'ഉത്രാടം (Uthradam)'       },
  { key: 'shravana',           sanskrit: 'Shravana',           tamil: 'திருவோணம் (Thiruvonam)',        malayalam: 'തിരുവോണം (Thiruvonam)'    },
  { key: 'dhanishtha',         sanskrit: 'Dhanishtha',         tamil: 'அவிட்டம் (Avittam)',            malayalam: 'അവിട്ടം (Avittam)'        },
  { key: 'shatabhisha',        sanskrit: 'Shatabhisha',        tamil: 'சதயம் (Sadayam)',               malayalam: 'ചതയം (Chathayam)'         },
  { key: 'purva_bhadrapada',   sanskrit: 'Purva Bhadrapada',   tamil: 'பூரட்டாதி (Pooratathi)',        malayalam: 'പൂരുരുട്ടാതി (Pooruruttathi)' },
  { key: 'uttara_bhadrapada',  sanskrit: 'Uttara Bhadrapada',  tamil: 'உத்திரட்டாதி (Uthiratatathi)',  malayalam: 'ഉത്തൃട്ടാതി (Uthrittathi)' },
  { key: 'revati',             sanskrit: 'Revati',             tamil: 'ரேவதி (Revathi)',               malayalam: 'രേവതി (Revathi)'          },
];

export function getNakshatraByKey(key: string): Nakshatra | undefined {
  return NAKSHATRAS.find(n => n.key === key);
}

export function nakshatraLabel(n: Nakshatra): string {
  return `${n.sanskrit} · ${n.tamil} · ${n.malayalam}`;
}
