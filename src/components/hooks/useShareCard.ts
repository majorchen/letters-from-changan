import { useRef, useState, type MutableRefObject } from 'react';
import QRCode from 'qrcode';
import type { ChatMessage } from '@/lib/gameState';
import { getShareExcerpt } from '@/lib/game/shareHelpers';
import type { PlayerState } from '@/lib/prompts';

const GAME_URL = 'https://letterstang.aifisher.cn';

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number): void {
  const chars = text.replace(/\s+/g, '').split('');
  let line = '';
  let currentY = y;
  let lineCount = 0;
  const drawEllipsisLine = (rawLine: string) => {
    let finalLine = rawLine;
    while (finalLine && ctx.measureText(`${finalLine}...`).width > maxWidth) {
      finalLine = finalLine.slice(0, -1);
    }
    ctx.fillText(`${finalLine}...`, x, currentY);
  };

  for (const char of chars) {
    const testLine = line + char;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      if (lineCount >= maxLines - 1) {
        drawEllipsisLine(line);
        return;
      }
      ctx.fillText(line, x, currentY);
      line = char;
      currentY += lineHeight;
      lineCount += 1;
    } else {
      line = testLine;
    }
  }
  if (line && lineCount < maxLines) ctx.fillText(line, x, currentY);
}

interface UseShareCardOptions {
  gameState: PlayerState;
  messagesRef: MutableRefObject<ChatMessage[]>;
  activeLetterContent: string;
  roleName: string;
}

export function useShareCard({ gameState, messagesRef, activeLetterContent, roleName }: UseShareCardOptions) {
  const [shareImageUrl, setShareImageUrl] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const shareRunRef = useRef(0);

  function closeShareCard() {
    shareRunRef.current += 1;
    setShareImageUrl('');
    setShareLoading(false);
  }

  async function handleShareCard(overrideExcerpt = '') {
    const shareExcerpt = overrideExcerpt || getShareExcerpt(messagesRef.current, activeLetterContent);
    if (!shareExcerpt) return;
    const runId = shareRunRef.current + 1;
    shareRunRef.current = runId;
    setShareImageUrl('');
    setShareLoading(true);

    try {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1680;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    await new Promise<void>((resolve) => {
      const bgImg = new window.Image();
      bgImg.crossOrigin = 'anonymous';
      bgImg.onload = () => {
        const imgRatio = bgImg.width / bgImg.height;
        const canvasRatio = canvas.width / canvas.height;
        let sx = 0, sy = 0, sw = bgImg.width, sh = bgImg.height;
        if (imgRatio > canvasRatio) {
          sw = bgImg.height * canvasRatio;
          sx = (bgImg.width - sw) / 2;
        } else {
          sh = bgImg.width / canvasRatio;
          sy = (bgImg.height - sh) / 2;
        }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        const ov = ctx.createLinearGradient(0, 0, 0, canvas.height);
        ov.addColorStop(0, 'rgba(12,10,9,0.84)');
        ov.addColorStop(0.46, 'rgba(12,10,9,0.90)');
        ov.addColorStop(1, 'rgba(12,10,9,0.96)');
        ctx.fillStyle = ov;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        resolve();
      };
      bgImg.onerror = () => {
        const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
        g.addColorStop(0, '#0c0a09'); g.addColorStop(0.55, '#1c1917'); g.addColorStop(1, '#0c0a09');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        resolve();
      };
      bgImg.src = '/bg-changan.webp';
    });

    let curY = 96;

    await new Promise<void>((resolve) => {
      const icon = new window.Image();
      icon.crossOrigin = 'anonymous';
      icon.onload = () => {
        const s = 112;
        const ix = (canvas.width - s) / 2;
        const iy = curY;
        const r = 24;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(ix, iy, s, s, r);
        ctx.clip();
        ctx.drawImage(icon, ix, iy, s, s);
        ctx.restore();
        ctx.strokeStyle = 'rgba(253,230,138,0.24)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(ix, iy, s, s, r);
        ctx.stroke();
        resolve();
      };
      icon.onerror = () => resolve();
      icon.src = '/icon-192.png';
    });

    curY += 230;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde68a';
    ctx.font = '700 68px serif';
    ctx.fillText('来信长安', canvas.width / 2, curY);
    ctx.fillStyle = 'rgba(251,191,36,0.58)';
    ctx.font = 'italic 30px serif';
    ctx.fillText("Letters from Chang'an", canvas.width / 2, curY + 48);
    curY += 142;

    ctx.fillStyle = 'rgba(253,230,138,0.88)';
    ctx.font = '700 42px serif';
    ctx.fillText('你在唐朝收到了一封', canvas.width / 2, curY);
    ctx.fillText('一封来自2077年的信', canvas.width / 2, curY + 58);
    curY += 120;

    ctx.fillStyle = 'rgba(245,158,11,0.60)';
    ctx.font = '26px serif';
    ctx.fillText(`天宝元年 · ${roleName || '旅人'} · ${gameState.location}`, canvas.width / 2, curY);
    curY += 74;

    ctx.textAlign = 'left';
    const excerptX = 128;
    const excerptY = curY;
    const excerptW = 824;
    ctx.fillStyle = 'rgba(254,243,199,0.76)';
    ctx.font = '34px serif';
    wrapCanvasText(ctx, shareExcerpt, excerptX, excerptY, excerptW, 58, 10);

    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, GAME_URL, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 204,
      color: { dark: '#1c1917', light: '#faf7ef' },
    });
    const qrSize = 236;
    const qrX = (canvas.width - qrSize) / 2;
    const qrY = 1320;
    ctx.fillStyle = '#faf7ef';
    ctx.beginPath();
    ctx.roundRect(qrX, qrY, qrSize, qrSize, 20);
    ctx.fill();
    ctx.drawImage(qrCanvas, qrX + 16, qrY + 16, 204, 204);

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(253,230,138,0.78)';
    ctx.font = '700 31px serif';
    ctx.fillText(GAME_URL.replace('https://', ''), canvas.width / 2, 1620);
    ctx.fillStyle = 'rgba(254,243,199,0.58)';
    ctx.font = '26px serif';
    ctx.fillText('AI互动叙事 · 每次都是唯一的故事', canvas.width / 2, 1660);

    const imageUrl = await new Promise<string>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png')),
        'image/jpeg',
        0.9,
      );
    });
    if (shareRunRef.current === runId) {
      setShareImageUrl(imageUrl);
    }
    } finally {
      if (shareRunRef.current === runId) {
        setShareLoading(false);
      }
    }
  }

  return {
    shareImageUrl,
    setShareImageUrl,
    shareLoading,
    closeShareCard,
    handleShareCard,
  };
}
