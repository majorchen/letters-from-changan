import fs from 'fs';
import path from 'path';

// Manual .env loading
try {
  ['.env', '.env.local'].forEach(file => {
    const envPath = path.join(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      const env = fs.readFileSync(envPath, 'utf8');
      env.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value.length > 0) {
          process.env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
        }
      });
    }
  });
} catch (e) {}

const AGNES_API_KEY = process.env.AGNES_API_KEY;
const AGNES_API_URL = process.env.AGNES_API_URL || 'https://apihub.agnes-ai.com/v1';

async function generateImage(name, prompt) {
  console.log(`Generating: ${name}...`);
  const baseUrl = AGNES_API_URL.replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AGNES_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'agnes-image-2.0-flash',
      prompt,
      size: '1024x768',
      extra_body: {
        response_format: 'url',
      },
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    console.error(`Error ${name}:`, data);
    return null;
  }
  return data.data[0].url;
}

const COMMON_SCENE = 'Tang Dynasty West Market bazaar, crowded stalls with silk fabrics and pottery, a Chinese merchant trading with a Persian traveler, busy market atmosphere.';
const CONSTRAINT_SUFFIX = 'Correct human anatomy, exactly two arms and two legs per person, natural hands with five fingers, no duplicated face, no duplicated person, no fused bodies, no extra limbs, no malformed hands or feet, no modern clothing, no modern objects, no written text, no subtitles, no logo, no watermark. 16:9 aspect ratio.';

// 1. Current
const CURRENT_PREFIX = 'Warm amber-gold palette, painted on aged silk texture, rich Dunhuang fresco colors, textured painterly digital art with visible brushwork and grain, NOT anime, NOT 3D render, NOT photorealistic. Cinematic film still, clear foreground-midground-background depth, characters captured mid-action with natural body language, facial expressions matching narrative mood (NOT default smiling), characters engaged with each other or environment (NOT looking at camera, NOT posing).';
const prompt1 = `${CURRENT_PREFIX} ${COMMON_SCENE} ${CONSTRAINT_SUFFIX}`;

// 2. Subtractive (Remove Cinematic)
const SUBTRACTIVE_PREFIX = 'Warm amber-gold palette, painted on aged silk texture, rich Dunhuang fresco colors, textured painterly digital art with visible brushwork and grain, NOT anime, NOT 3D render, NOT photorealistic. Characters captured mid-action with natural body language, facial expressions matching narrative mood (NOT default smiling), characters engaged with each other or environment (NOT looking at camera, NOT posing).';
const SUBTRACTIVE_CONSTRAINTS = `${CONSTRAINT_SUFFIX} no realistic skin pores, no realistic shadows, no 3D depth of field, no photography aesthetics.`;
const prompt2 = `${SUBTRACTIVE_PREFIX} ${COMMON_SCENE} ${SUBTRACTIVE_CONSTRAINTS}`;

// 3. Experimental (Add Traditional Art Terms)
const EXPERIMENTAL_PREFIX = 'Warm amber-gold palette, painted on aged silk texture, rich Dunhuang fresco colors, Classical Chinese heavy color painting, bold ink outlines, flat composition with multiple focus points, mineral pigments, thick brushstrokes, textured painterly digital art with visible brushwork and grain, NOT anime, NOT 3D render, NOT photorealistic. Characters captured mid-action with natural body language, characters engaged with each other or environment (NOT looking at camera, NOT posing).';
const prompt3 = `${EXPERIMENTAL_PREFIX} ${COMMON_SCENE} ${SUBTRACTIVE_CONSTRAINTS}`;

async function run() {
  if (!AGNES_API_KEY) {
    console.error('Missing AGNES_API_KEY env var.');
    process.exit(1);
  }
  
  const results = await Promise.all([
    generateImage('1_Current', prompt1),
    generateImage('2_Subtractive', prompt2),
    generateImage('3_Experimental', prompt3)
  ]);
  
  console.log('\n--- Results ---');
  console.log('1. Current Style:', results[0]);
  console.log('2. Subtractive Style (Removed Cinematic):', results[1]);
  console.log('3. Experimental Style (Added Trad Art Terms):', results[2]);
}

run();
