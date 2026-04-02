window.NC = window.NC || {};

NC.Filters = (function () {

  function drawVignette(ctx, w, h, strength) {
    if (strength <= 0) return;
    const cx = w / 2, cy = h / 2;
    const rad = Math.max(w, h) * 0.75;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0,   'rgba(0,0,0,0)');
    g.addColorStop(0.55,'rgba(0,0,0,0)');
    g.addColorStop(1,   `rgba(0,0,0,${(strength * 0.85).toFixed(2)})`);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function drawGrain(ctx, w, h, strength) {
    if (strength <= 0) return;
    const scale = 2;
    const sw = Math.floor(w / scale), sh = Math.floor(h / scale);
    const imageData = ctx.createImageData(sw, sh);
    const d = imageData.data;
    const alpha = strength * 60;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 2 * alpha;
      d[i] = d[i+1] = d[i+2] = 128 + n;
      d[i+3] = Math.abs(n) * 3;
    }
    const tmp = document.createElement('canvas');
    tmp.width = sw; tmp.height = sh;
    tmp.getContext('2d').putImageData(imageData, 0, 0);
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.globalCompositeOperation = 'overlay';
    ctx.drawImage(tmp, 0, 0, w, h);
    ctx.restore();
  }

  function drawScanlines(ctx, w, h, strength) {
    if (strength <= 0) return;
    ctx.save();
    ctx.globalAlpha = strength * 0.25;
    ctx.fillStyle = '#000';
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1.5);
    ctx.restore();
  }

  function drawChromaShift(ctx, w, h, strength) {
    if (strength <= 0) return;
    const shift = strength * 6;
    const snapshot = ctx.getImageData(0, 0, w, h);
    const src = snapshot.data;
    const out = ctx.createImageData(w, h);
    const dst = out.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i  = (y * w + x) * 4;
        const rx = Math.min(w - 1, x + Math.round(shift));
        const bx = Math.max(0, x - Math.round(shift));
        dst[i]   = src[(y * w + rx) * 4];
        dst[i+1] = src[i+1];
        dst[i+2] = src[(y * w + bx) * 4 + 2];
        dst[i+3] = src[i+3];
      }
    }
    ctx.putImageData(out, 0, 0);
  }

  function applyWarmth(imageData, warmth) {
    if (warmth === 0) return;
    const d = imageData.data;
    const rShift =  warmth * 30;
    const gShift =  warmth * 10;
    const bShift = -warmth * 40;
    for (let i = 0; i < d.length; i += 4) {
      d[i]   = Math.min(255, Math.max(0, d[i]   + rShift));
      d[i+1] = Math.min(255, Math.max(0, d[i+1] + gShift));
      d[i+2] = Math.min(255, Math.max(0, d[i+2] + bShift));
    }
  }

  function applySharpness(ctx, w, h, amount) {
    if (amount <= 0) return;
    const imageData = ctx.getImageData(0, 0, w, h);
    const src = new Uint8ClampedArray(imageData.data);
    const dst = imageData.data;
    const str = amount * 1.2;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        for (let c = 0; c < 3; c++) {
          const i  = (y * w + x) * 4 + c;
          dst[i] = Math.min(255, Math.max(0,
            src[i] * (1 + str) -
            (src[((y-1)*w+x)*4+c] + src[((y+1)*w+x)*4+c] +
             src[(y*w+(x-1))*4+c] + src[(y*w+(x+1))*4+c]) * (str / 4)
          ));
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function drawNeonGlow(ctx, w, h, strength) {
    if (strength <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = strength * 0.35;
    ctx.filter = `blur(${strength * 8}px) saturate(3)`;
    ctx.drawImage(ctx.canvas, 0, 0, w, h);
    ctx.restore();
  }

  function drawDust(ctx, w, h, strength) {
    if (strength <= 0) return;
    const count = Math.floor(strength * 12);
    ctx.save();
    ctx.globalAlpha = 0.35 * strength;
    ctx.fillStyle = '#fff';
    for (let i = 0; i < count; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 1.5 + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const DEFS = {

    none: {
      cssFilter() { return ''; },
      postProcess() {}
    },

    grayscale: {
      cssFilter(i) { return `grayscale(${i})`; },
      postProcess() {}
    },

    sepia: {
      cssFilter(i) { return `sepia(${i})`; },
      postProcess() {}
    },

    cinematic: {
      cssFilter(i) {
        return `grayscale(${i}) contrast(${1 + 0.4*i}) brightness(${1 - 0.05*i})`;
      },
      postProcess(ctx, w, h, i) {
        drawVignette(ctx, w, h, i * 0.7);
      }
    },

    beauty: {
      cssFilter(i) {
        return `brightness(${1 + 0.06*i}) saturate(${1 + 0.12*i}) blur(${i * 1.5}px)`;
      },
      postProcess() {}
    },

    warm: {
      cssFilter(i) {
        return `sepia(${i*0.35}) saturate(${1+0.25*i}) brightness(${1+0.04*i})`;
      },
      postProcess(ctx, w, h, i) {
        if (i <= 0) return;
        const d = ctx.getImageData(0, 0, w, h);
        applyWarmth(d, i * 0.6);
        ctx.putImageData(d, 0, 0);
      }
    },

    cool: {
      cssFilter(i) {
        return `saturate(${1-0.15*i}) brightness(${1+0.03*i}) hue-rotate(${185*i}deg)`;
      },
      postProcess(ctx, w, h, i) {
        if (i <= 0) return;
        const d = ctx.getImageData(0, 0, w, h);
        applyWarmth(d, -i * 0.4);
        ctx.putImageData(d, 0, 0);
      }
    },

    vintage: {
      cssFilter(i) {
        return `sepia(${i*0.55}) contrast(${1-0.12*i}) brightness(${1-0.06*i}) saturate(${1-0.25*i})`;
      },
      postProcess(ctx, w, h, i) {
        drawGrain(ctx, w, h, i * 0.6);
        drawVignette(ctx, w, h, i * 0.55);
        drawDust(ctx, w, h, i * 0.4);
      }
    },

    retro80s: {
      cssFilter(i) {
        return `saturate(${1+0.8*i}) hue-rotate(${12*i}deg) contrast(${1+0.15*i}) brightness(${1+0.05*i})`;
      },
      postProcess(ctx, w, h, i) {
        drawChromaShift(ctx, w, h, i * 0.6);
        drawScanlines(ctx, w, h, i * 0.8);
        drawGrain(ctx, w, h, i * 0.4);
        drawVignette(ctx, w, h, i * 0.4);
      }
    },

    cyberpunk: {
      cssFilter(i) {
        return `contrast(${1+0.5*i}) saturate(${1+1.2*i}) hue-rotate(${-30*i}deg) brightness(${1+0.08*i})`;
      },
      postProcess(ctx, w, h, i) {
        drawNeonGlow(ctx, w, h, i * 0.5);
        drawVignette(ctx, w, h, i * 0.6);
      }
    },

    neon: {
      cssFilter(i) {
        return `contrast(${1+0.4*i}) saturate(${1+2*i}) brightness(${1+0.15*i}) hue-rotate(${270*i}deg)`;
      },
      postProcess(ctx, w, h, i) {
        drawNeonGlow(ctx, w, h, i * 0.65);
      }
    },

    lofi: {
      cssFilter(i) {
        return `contrast(${1+0.1*i}) saturate(${1-0.4*i}) brightness(${1-0.08*i}) sepia(${i*0.3})`;
      },
      postProcess(ctx, w, h, i) {
        drawGrain(ctx, w, h, i * 0.5);
        drawVignette(ctx, w, h, i * 0.45);
      }
    },

    golden: {
      cssFilter(i) {
        return `sepia(${i*0.38}) saturate(${1+0.55*i}) brightness(${1+0.1*i}) hue-rotate(${-14*i}deg) contrast(${1+0.08*i})`;
      },
      postProcess(ctx, w, h, i) {
        if (i <= 0) return;
        const d = ctx.getImageData(0, 0, w, h);
        applyWarmth(d, i * 0.45);
        ctx.putImageData(d, 0, 0);
        drawVignette(ctx, w, h, i * 0.3);
      }
    },

    sunset: {
      cssFilter(i) {
        return `sepia(${i*0.55}) saturate(${1+0.75*i}) hue-rotate(${-18*i}deg) brightness(${1+0.04*i}) contrast(${1+0.14*i})`;
      },
      postProcess(ctx, w, h, i) {
        if (i <= 0) return;
        const d = ctx.getImageData(0, 0, w, h);
        applyWarmth(d, i * 0.75);
        ctx.putImageData(d, 0, 0);
        drawVignette(ctx, w, h, i * 0.5);
      }
    },

    fade: {
      cssFilter(i) {
        return `contrast(${1-0.24*i}) brightness(${1+0.1*i}) saturate(${1-0.28*i})`;
      },
      postProcess(ctx, w, h, i) {
        if (i <= 0) return;
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        const lift = i * 28;
        for (let j = 0; j < d.length; j += 4) {
          d[j]   = Math.min(255, d[j]   + lift * (1 - d[j]   / 255));
          d[j+1] = Math.min(255, d[j+1] + lift * (1 - d[j+1] / 255));
          d[j+2] = Math.min(255, d[j+2] + lift * (1 - d[j+2] / 255));
        }
        ctx.putImageData(imageData, 0, 0);
      }
    },

    matte: {
      cssFilter(i) {
        return `saturate(${1-0.48*i}) contrast(${1-0.14*i}) brightness(${1+0.06*i})`;
      },
      postProcess(ctx, w, h, i) {
        if (i <= 0) return;
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        const lift = i * 18;
        for (let j = 0; j < d.length; j += 4) {
          d[j]   = Math.min(255, d[j]   + lift * 0.9);
          d[j+1] = Math.min(255, d[j+1] + lift * 0.85);
          d[j+2] = Math.min(255, d[j+2] + lift * 1.1);
        }
        ctx.putImageData(imageData, 0, 0);
        drawVignette(ctx, w, h, i * 0.28);
      }
    },

    film: {
      cssFilter(i) {
        return `contrast(${1+0.18*i}) brightness(${1-0.04*i}) saturate(${1-0.1*i})`;
      },
      postProcess(ctx, w, h, i) {
        if (i > 0) {
          const d = ctx.getImageData(0, 0, w, h);
          applyWarmth(d, i * 0.18);
          ctx.putImageData(d, 0, 0);
        }
        drawGrain(ctx, w, h, i * 0.65);
        drawVignette(ctx, w, h, i * 0.5);
        drawDust(ctx, w, h, i * 0.3);
      }
    },

    polaroid: {
      cssFilter(i) {
        return `contrast(${1+0.08*i}) brightness(${1+0.14*i}) saturate(${1-0.12*i}) sepia(${i*0.18})`;
      },
      postProcess(ctx, w, h, i) {
        if (i <= 0) return;
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        const lift = i * 14;
        for (let j = 0; j < d.length; j += 4) {
          d[j+2] = Math.min(255, d[j+2] + lift * 1.3);
          d[j]   = Math.min(255, d[j]   + lift * 0.4);
        }
        ctx.putImageData(imageData, 0, 0);
        drawVignette(ctx, w, h, i * 0.42);
      }
    },

    tokyo: {
      cssFilter(i) {
        return `contrast(${1+0.28*i}) saturate(${1+1.4*i}) hue-rotate(${295*i}deg) brightness(${1+0.08*i})`;
      },
      postProcess(ctx, w, h, i) {
        drawNeonGlow(ctx, w, h, i * 0.38);
        drawVignette(ctx, w, h, i * 0.48);
        drawGrain(ctx, w, h, i * 0.2);
      }
    },

    glitch: {
      cssFilter(i) {
        return `contrast(${1+0.38*i}) saturate(${1+0.45*i}) brightness(${1+0.06*i})`;
      },
      postProcess(ctx, w, h, i) {
        if (i <= 0) return;
        drawChromaShift(ctx, w, h, i * 0.8);
        const blockCount = Math.floor(i * 7);
        ctx.save();
        for (let j = 0; j < blockCount; j++) {
          const bx = Math.random() * w;
          const by = Math.random() * h;
          const bw = Math.random() * 55 + 18;
          const bh = Math.random() * 7 + 2;
          ctx.globalAlpha = 0.65;
          ctx.drawImage(ctx.canvas, bx, by, bw, bh, bx + (Math.random() - 0.5) * 36, by, bw, bh);
        }
        ctx.restore();
        if (Math.random() < i * 0.18) drawScanlines(ctx, w, h, i * 0.45);
      }
    }
  };

  function buildCssFilter(filterKey, intensity, adj) {
    const def = DEFS[filterKey] || DEFS.none;
    const parts = [];
    if (adj.brightness !== 100) parts.push(`brightness(${adj.brightness / 100})`);
    if (adj.contrast   !== 100) parts.push(`contrast(${adj.contrast / 100})`);
    if (adj.saturation !== 100) parts.push(`saturate(${adj.saturation / 100})`);
    if (adj.blur > 0)           parts.push(`blur(${adj.blur}px)`);
    const filterCSS = def.cssFilter(intensity, adj);
    if (filterCSS) parts.push(filterCSS);
    return parts.join(' ') || 'none';
  }

  function applyPostProcess(ctx, w, h, filterKey, intensity, adj) {
    const def = DEFS[filterKey] || DEFS.none;
    const warmthNorm = adj.warmth / 50;
    if (warmthNorm !== 0 && filterKey !== 'warm' && filterKey !== 'cool') {
      const d = ctx.getImageData(0, 0, w, h);
      applyWarmth(d, warmthNorm);
      ctx.putImageData(d, 0, 0);
    }
    if (adj.sharpness > 0) applySharpness(ctx, w, h, adj.sharpness / 100);
    def.postProcess(ctx, w, h, intensity, adj);
    if (adj.vignette > 0) drawVignette(ctx, w, h, adj.vignette / 100);
    if (adj.grain > 0)    drawGrain(ctx, w, h, adj.grain / 100);
  }

  return { DEFS, buildCssFilter, applyPostProcess };

})();
