import React, { useRef, useEffect } from 'react';

interface ChaosCanvasProps {
  width?: number;
  height?: number;
}

const ChaosCanvas: React.FC<ChaosCanvasProps> = ({ width = 800, height = 600 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const baseWidth = width;
    const baseHeight = height;
    let qualityFactor = 1.0;
    let frameCount = 0;
    let lastFpsTime = performance.now();
    let fpsFrameCount = 0;
    let currentFPS = 60;
    let currentDPR = 1;
    let rafId: number;

    const random = () => Math.random();
    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const tone = (value: number) => Math.floor(clamp(value, 0, 1) * 255);

    const noiseWidth = 64;
    const noiseHeight = 36;
    const noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = noiseWidth;
    noiseCanvas.height = noiseHeight;
    const noiseCtx = noiseCanvas.getContext('2d');
    const noiseImageData = noiseCtx?.createImageData(noiseWidth, noiseHeight);

    const spectrogramWidth = 128;
    const spectrogramHeight = 64;
    const spectrogram = new Float32Array(spectrogramWidth * spectrogramHeight);
    const spectrogramCanvas = document.createElement('canvas');
    spectrogramCanvas.width = spectrogramWidth;
    spectrogramCanvas.height = spectrogramHeight;
    const spectrogramCtx = spectrogramCanvas.getContext('2d');
    const spectrogramImageData = spectrogramCtx?.createImageData(spectrogramWidth, spectrogramHeight);

    const MAX_PARTICLES = 1000;
    const px = new Float32Array(MAX_PARTICLES);
    const py = new Float32Array(MAX_PARTICLES);
    const vx = new Float32Array(MAX_PARTICLES);
    const vy = new Float32Array(MAX_PARTICLES);
    const life = new Uint8Array(MAX_PARTICLES);
    let particleCount = 0;

    const waveform1 = new Float32Array(256);
    const waveform2 = new Float32Array(256);

    const hudState = {
      fps: 60,
      quality: 1.0,
    };

    const resolutionDPR = () => Math.min(window.devicePixelRatio || 1, qualityFactor > 0.7 ? 2 : 1);
    const noiseSkip = () => (qualityFactor > 0.7 ? 3 : qualityFactor > 0.4 ? 4 : 6);
    const spectrogramSkip = () => (qualityFactor > 0.7 ? 2 : qualityFactor > 0.4 ? 3 : 5);
    const renderParticleCount = () => Math.max(120, Math.floor(particleCount * qualityFactor));

    const adjustDPR = (force = false) => {
      const desiredDPR = resolutionDPR();
      if (!force && desiredDPR === currentDPR) return;
      currentDPR = desiredDPR;
      canvas.style.width = `${baseWidth}px`;
      canvas.style.height = `${baseHeight}px`;
      canvas.width = baseWidth * currentDPR;
      canvas.height = baseHeight * currentDPR;
      ctx.setTransform(currentDPR, 0, 0, currentDPR, 0, 0);
      ctx.imageSmoothingEnabled = false;
    };

    const initParticles = () => {
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const edge = random() > 0.6;
        if (edge) {
          const side = Math.floor(random() * 4);
          if (side === 0) {
            px[i] = 0;
            py[i] = random() * baseHeight;
          } else if (side === 1) {
            px[i] = baseWidth;
            py[i] = random() * baseHeight;
          } else if (side === 2) {
            px[i] = random() * baseWidth;
            py[i] = 0;
          } else {
            px[i] = random() * baseWidth;
            py[i] = baseHeight;
          }
          vx[i] = (random() - 0.5) * 4;
          vy[i] = (random() - 0.5) * 4;
        } else {
          const angle = random() * Math.PI * 2;
          const radius = 60 + random() * 40;
          px[i] = baseWidth / 2 + Math.cos(angle) * radius;
          py[i] = baseHeight / 2 + Math.sin(angle) * radius;
          vx[i] = Math.cos(angle) * 1.5 + (random() - 0.5) * 0.5;
          vy[i] = Math.sin(angle) * 1.5 + (random() - 0.5) * 0.5;
        }
        life[i] = Math.floor(random() * 180) + 75;
      }
      particleCount = MAX_PARTICLES;
    };

    const updateNoise = () => {
      if (!noiseCtx || !noiseImageData) return;
      const data = noiseImageData.data;
      for (let i = 0; i < noiseWidth * noiseHeight; i++) {
        const value = Math.floor(random() * 255);
        const idx = i * 4;
        data[idx] = value;
        data[idx + 1] = value;
        data[idx + 2] = value;
        data[idx + 3] = 80;
      }
      noiseCtx.putImageData(noiseImageData, 0, 0);
    };

    const updateWaveforms = () => {
      const time = frameCount * 0.012;
      for (let i = 0; i < waveform1.length; i++) {
        const x = i / waveform1.length;
        waveform1[i] = Math.sin(x * Math.PI * 4 + time) * 0.5 + Math.sin(x * Math.PI * 8 + time * 1.4) * 0.3;
        waveform2[i] = Math.cos(x * Math.PI * 6 + time * 0.9) * 0.4 + Math.sin(x * Math.PI * 12 + time * 2.2) * 0.25;
      }
    };

    const updateSpectrogram = () => {
      if (!spectrogramCtx || !spectrogramImageData) return;

      for (let y = 0; y < spectrogramHeight; y++) {
        for (let x = 0; x < spectrogramWidth - 1; x++) {
          spectrogram[y * spectrogramWidth + x] = spectrogram[y * spectrogramWidth + x + 1];
        }
      }

      for (let y = 0; y < spectrogramHeight; y++) {
        spectrogram[y * spectrogramWidth + (spectrogramWidth - 1)] = random() * 0.8 + 0.2;
      }

      const data = spectrogramImageData.data;
      for (let i = 0; i < spectrogram.length; i++) {
        const value = spectrogram[i];
        const color = tone(value);
        const idx = i * 4;
        data[idx] = color;
        data[idx + 1] = 0;
        data[idx + 2] = 255 - color;
        data[idx + 3] = 255;
      }
      spectrogramCtx.putImageData(spectrogramImageData, 0, 0);
    };

    const updateParticles = () => {
      for (let i = 0; i < particleCount; i++) {
        px[i] += vx[i];
        py[i] += vy[i];
        life[i] = Math.max(0, life[i] - 1);

        if (px[i] < 0 || px[i] > baseWidth) vx[i] *= -1;
        if (py[i] < 0 || py[i] > baseHeight) vy[i] *= -1;

        if (life[i] === 0) {
          const angle = random() * Math.PI * 2;
          const radius = 40 + random() * 40;
          px[i] = baseWidth / 2 + Math.cos(angle) * radius;
          py[i] = baseHeight / 2 + Math.sin(angle) * radius;
          vx[i] = Math.cos(angle) * 1.5 + (random() - 0.5) * 0.3;
          vy[i] = Math.sin(angle) * 1.5 + (random() - 0.5) * 0.3;
          life[i] = 180;
        }
      }
    };

    const updateHUD = () => {
      hudState.fps = Math.round(currentFPS);
      hudState.quality = Number(qualityFactor.toFixed(2));
    };

    const renderNoise = () => {
      if (!noiseCtx) return;
      ctx.globalAlpha = 0.16;
      ctx.drawImage(noiseCanvas, 0, 0, baseWidth, baseHeight);
      ctx.globalAlpha = 1;
    };

    const renderCore = () => {
      ctx.save();
      ctx.translate(baseWidth / 2, baseHeight / 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.7)';
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const radius = 50 + Math.sin(frameCount * 0.06 + i) * 12;
        ctx.beginPath();
        ctx.arc(0, 0, radius, angle, angle + Math.PI / 3);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(255, 0, 255, 0.8)';
      ctx.lineWidth = 3;
      const pulseRadius = 80 + Math.sin(frameCount * 0.1) * 20;
      ctx.beginPath();
      ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(baseWidth / 2, baseHeight / 2, pulseRadius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };

    const renderSlices = () => {
      const sliceCount = 6;
      for (let i = 0; i < sliceCount; i++) {
        const sliceY = Math.floor(random() * baseHeight);
        const sliceH = Math.floor(random() * 16) + 4;
        const offsetX = (random() - 0.5) * 12;
        ctx.drawImage(canvas, 0, sliceY, baseWidth, sliceH, offsetX, sliceY, baseWidth, sliceH);
      }
    };

    const renderEQ = () => {
      const barCount = 28;
      const barWidth = baseWidth / barCount;
      ctx.fillStyle = 'rgba(0, 255, 0, 0.55)';
      for (let i = 0; i < barCount; i++) {
        const barHeight = Math.abs(Math.sin(frameCount * 0.05 + i * 0.2)) * 90 + 10;
        ctx.fillRect(i * barWidth, baseHeight - barHeight - 10, barWidth - 3, barHeight);
      }
    };

    const renderParticles = () => {
      const count = renderParticleCount();
      for (let i = 0; i < count; i++) {
        const alpha = life[i] / 255;
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fillRect(px[i], py[i], 2, 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.35})`;
        ctx.fillRect(px[i] - vx[i], py[i] - vy[i], 2, 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.14})`;
        ctx.fillRect(px[i] - vx[i] * 2, py[i] - vy[i] * 2, 2, 2);
      }
    };

    const renderWaveforms = () => {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)';
      ctx.beginPath();
      for (let i = 0; i < waveform1.length; i++) {
        const x = (i / (waveform1.length - 1)) * baseWidth;
        const y = baseHeight / 2 + waveform1[i] * 50;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 0, 0, 0.85)';
      ctx.beginPath();
      for (let i = 0; i < waveform2.length; i++) {
        const x = (i / (waveform2.length - 1)) * baseWidth;
        const y = baseHeight / 2 + waveform2[i] * 50;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    const renderSpectrogram = () => {
      if (!spectrogramCtx) return;
      const specWidth = 200;
      const specHeight = 100;
      const startX = baseWidth - specWidth - 20;
      const startY = 20;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(spectrogramCanvas, startX, startY, specWidth, specHeight);
      ctx.globalAlpha = 1;
    };

    const renderHUD = () => {
      ctx.save();
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 1;
      const cornerSize = 20;
      ctx.beginPath();
      ctx.moveTo(cornerSize, 0);
      ctx.lineTo(0, 0);
      ctx.lineTo(0, cornerSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(baseWidth - cornerSize, 0);
      ctx.lineTo(baseWidth, 0);
      ctx.lineTo(baseWidth, cornerSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, baseHeight - cornerSize);
      ctx.lineTo(0, baseHeight);
      ctx.lineTo(cornerSize, baseHeight);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(baseWidth - cornerSize, baseHeight);
      ctx.lineTo(baseWidth, baseHeight);
      ctx.lineTo(baseWidth, baseHeight - cornerSize);
      ctx.stroke();

      ctx.fillStyle = 'rgba(0, 255, 255, 0.85)';
      ctx.font = '12px monospace';
      ctx.fillText(`FPS: ${hudState.fps}`, 20, 24);
      ctx.fillText(`Q: ${hudState.quality}`, 20, 42);
      ctx.restore();
    };

    const updateQuality = (now: number) => {
      fpsFrameCount += 1;
      const elapsed = now - lastFpsTime;
      if (elapsed >= 1000) {
        currentFPS = (fpsFrameCount * 1000) / elapsed;
        fpsFrameCount = 0;
        lastFpsTime = now;
        if (currentFPS < 45) {
          qualityFactor = Math.max(0.3, qualityFactor - 0.1);
        } else if (currentFPS > 55) {
          qualityFactor = Math.min(1.0, qualityFactor + 0.05);
        }
        hudState.fps = Math.round(currentFPS);
        hudState.quality = Number(qualityFactor.toFixed(2));
        adjustDPR();
      }
    };

    const renderFrame = () => {
      const now = performance.now();
      frameCount += 1;
      updateQuality(now);

      if (frameCount % noiseSkip() === 0) {
        updateNoise();
      }
      if (frameCount % spectrogramSkip() === 0) {
        updateSpectrogram();
      }
      if (frameCount % 6 === 0) {
        updateHUD();
      }

      updateParticles();
      updateWaveforms();

      ctx.clearRect(0, 0, baseWidth, baseHeight);
      renderNoise();
      renderCore();
      renderSlices();
      renderEQ();
      renderParticles();
      renderWaveforms();
      renderSpectrogram();
      renderHUD();

      rafId = requestAnimationFrame(renderFrame);
    };

    adjustDPR(true);
    initParticles();
    updateNoise();
    updateSpectrogram();
    renderFrame();

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [width, height]);

  return <canvas ref={canvasRef} style={{ border: '1px solid #ccc' }} />;
};

export default ChaosCanvas;
