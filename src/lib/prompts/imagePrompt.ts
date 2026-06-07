export const IMAGE_STYLE_PREFIX = `Warm amber-gold palette, painted on aged silk texture, rich Dunhuang fresco colors, textured painterly digital art with visible brushwork and grain, NOT anime, NOT 3D render, NOT photorealistic. Characters captured mid-action with natural body language, facial expressions matching narrative mood (NOT default smiling), characters engaged with each other or environment (NOT looking at camera, NOT posing).`;

export const IMAGE_CONSTRAINT_SUFFIX = `Correct human anatomy, exactly two arms and two legs per person, natural hands with five fingers, no duplicated face, no duplicated person, no fused bodies, no extra limbs, no malformed hands or feet, no modern clothing, no modern objects, no written text, no subtitles, no logo, no watermark, no realistic skin pores, no realistic shadows, no 3D depth of field, no photography aesthetics. 16:9 aspect ratio.`;

/** @deprecated Use IMAGE_STYLE_PREFIX + IMAGE_CONSTRAINT_SUFFIX instead */
export const IMAGE_PROMPT_SUFFIX = `${IMAGE_STYLE_PREFIX} ${IMAGE_CONSTRAINT_SUFFIX}`;
