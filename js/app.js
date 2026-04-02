(function () {
  'use strict';

  const RESMAP = { 480: [854, 480], 720: [1280, 720], 1080: [1920, 1080] };
  const BURST_COUNT = 5;
  const BURST_DELAY_MS = 250;
  const STORAGE_KEY_GALLERY  = 'nc_gallery';
  const STORAGE_KEY_PRESETS  = 'nc_presets';
  const STORAGE_KEY_THEME    = 'nc_theme';
  const STORAGE_KEY_SETTINGS = 'nc_settings';

  const state = {
    cameraActive:    false,
    mirror:          false,
    zoom:            1,
    currentFilter:   'none',
    intensity:       1,
    adj: {
      brightness:  100,
      contrast:    100,
      saturation:  100,
      warmth:      0,
      sharpness:   0,
      blur:        0,
      vignette:    0,
      grain:       0
    },
    beforeAfterMode: false,
    gridActive:      false,
    aspect:          'free',
    timerSecs:       0,
    resolution:      720,
    fps:             30,
    format:          'jpeg',
    jpegQuality:     0.92,
    isRecording:     false,
    isBursting:      false,
    activeTab:       'filters',
    gallery:         [],
    lightboxIdx:     -1,
    presets:         [],
    rafId:           null,
    canvasStream:    null,
  };

  const $ = id => document.getElementById(id);
  const el = {
    video:             $('video'),
    canvas:            $('preview-canvas'),
    noCamera:          $('no-camera'),
    timerOverlay:      $('timer-overlay'),
    flashOverlay:      $('flash-overlay'),
    beforeLabel:       $('before-label'),
    afterLabel:        $('after-label'),
    recIndicator:      $('rec-indicator'),
    previewWrapper:    $('previewWrapper'),
    previewStats:      $('preview-stats'),
    statFilter:        $('statFilter'),
    statAspect:        $('statAspect'),
    statZoom:          $('statZoom'),
    aspectChips:       $('aspectChips'),
    zoomSlider:        $('zoomSlider'),
    zoomValue:         $('zoomValue'),
    startCameraBtn:    $('startCameraBtn'),
    mirrorBtn:         $('mirrorBtn'),
    switchCameraBtn:   $('switchCameraBtn'),
    beforeAfterBtn:    $('beforeAfterBtn'),
    gridBtn:           $('gridBtn'),
    filterGrid:        $('filterGrid'),
    activeFilterName:  $('activeFilterName'),
    intensitySlider:   $('intensitySlider'),
    intensityValue:    $('intensityValue'),
    brightness:        $('brightness'),
    contrast:          $('contrast'),
    saturation:        $('saturation'),
    warmth:            $('warmth'),
    sharpness:         $('sharpness'),
    blur:              $('blur'),
    vignette:          $('vignette'),
    grain:             $('grain'),
    brightnessVal:     $('brightnessVal'),
    contrastVal:       $('contrastVal'),
    saturationVal:     $('saturationVal'),
    warmthVal:         $('warmthVal'),
    sharpnessVal:      $('sharpnessVal'),
    blurVal:           $('blurVal'),
    vignetteVal:       $('vignetteVal'),
    grainVal:          $('grainVal'),
    resetAdjBtn:       $('resetAdjBtn'),
    resolution:        $('resolution'),
    fps:               $('fps'),
    format:            $('format'),
    jpegQuality:       $('jpegQuality'),
    jpegQualityVal:    $('jpegQualityVal'),
    infoFormat:        $('infoFormat'),
    infoRes:           $('infoRes'),
    presetNameInput:   $('presetNameInput'),
    savePresetBtn:     $('savePresetBtn'),
    presetsList:       $('presetsList'),
    emptyPresets:      $('emptyPresets'),
    shutterWrap:       $('shutterWrap'),
    captureBtn:        $('captureBtn'),
    burstBtn:          $('burstBtn'),
    recordBtn:         $('recordBtn'),
    recordLabel:       $('recordLabel'),
    gallery:           $('gallery'),
    emptyGallery:      $('emptyGallery'),
    galleryCount:      $('galleryCount'),
    clearGalleryBtn:   $('clearGalleryBtn'),
    lightbox:          $('lightbox'),
    lightboxBackdrop:  $('lightboxBackdrop'),
    lightboxImg:       $('lightboxImg'),
    lightboxVideo:     $('lightboxVideo'),
    lightboxDownload:  $('lightboxDownload'),
    lightboxDelete:    $('lightboxDelete'),
    closeLightbox:     $('closeLightbox'),
    shortcutsBtn:      $('shortcutsBtn'),
    shortcutsModal:    $('shortcutsModal'),
    shortcutsBackdrop: $('shortcutsBackdrop'),
    closeShortcuts:    $('closeShortcuts'),
    fullscreenBtn:     $('fullscreenBtn'),
    fsExpandIcon:      $('fsExpandIcon'),
    fsCollapseIcon:    $('fsCollapseIcon'),
    darkModeToggle:    $('darkModeToggle'),
    installBtn:        $('installBtn'),
    toast:             $('toast'),
  };

  const ctx = el.canvas.getContext('2d', { willReadFrequently: true });
  let _gridOverlayEl = null;

  function updateSliderFill(input) {
    const min = parseFloat(input.min) || 0;
    const max = parseFloat(input.max) || 100;
    const pct = ((parseFloat(input.value) - min) / (max - min)) * 100;
    input.style.setProperty('--pct', pct + '%');
  }

  function initAllSliderFills() {
    document.querySelectorAll('input[type="range"]').forEach(updateSliderFill);
  }

  function render() {
    const video = el.video;
    if (!state.cameraActive || video.readyState < 2) {
      state.rafId = requestAnimationFrame(render);
      return;
    }
    const cw = el.canvas.width;
    const ch = el.canvas.height;
    ctx.clearRect(0, 0, cw, ch);
    if (state.beforeAfterMode) {
      renderBeforeAfter(cw, ch, video);
    } else {
      renderFiltered(cw, ch, video);
    }
    state.rafId = requestAnimationFrame(render);
  }

  function renderFiltered(cw, ch, video) {
    ctx.save();
    if (state.mirror) {
      ctx.translate(cw, 0);
      ctx.scale(-1, 1);
    }
    if (state.zoom > 1) {
      const z = state.zoom;
      ctx.translate(cw / 2, ch / 2);
      ctx.scale(z, z);
      ctx.translate(-cw / 2, -ch / 2);
    }
    ctx.filter = NC.Filters.buildCssFilter(state.currentFilter, state.intensity, state.adj);
    ctx.drawImage(video, 0, 0, cw, ch);
    ctx.restore();
    NC.Filters.applyPostProcess(ctx, cw, ch, state.currentFilter, state.intensity, state.adj);
  }

  function renderBeforeAfter(cw, ch, video) {
    const half = Math.floor(cw / 2);

    ctx.save();
    if (state.mirror) { ctx.translate(cw, 0); ctx.scale(-1, 1); }
    ctx.filter = 'none';
    ctx.drawImage(video, 0, 0, cw, ch);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(half, 0, cw - half, ch);
    ctx.clip();
    if (state.mirror) { ctx.translate(cw, 0); ctx.scale(-1, 1); }
    ctx.filter = NC.Filters.buildCssFilter(state.currentFilter, state.intensity, state.adj);
    ctx.drawImage(video, 0, 0, cw, ch);
    ctx.restore();
    NC.Filters.applyPostProcess(ctx, cw, ch, state.currentFilter, state.intensity, state.adj);

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(half, 0);
    ctx.lineTo(half, ch);
    ctx.stroke();
    ctx.restore();
  }

  function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
      btn.setAttribute('aria-selected', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `panel-${tabName}`);
    });
  }

  function setAspect(val) {
    state.aspect = val;
    document.querySelectorAll('.aspect-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.aspect === val);
    });
    updateStatsHUD();
  }

  function toggleGrid() {
    state.gridActive = !state.gridActive;
    el.gridBtn.classList.toggle('active', state.gridActive);
    if (_gridOverlayEl) {
      _gridOverlayEl.classList.toggle('hidden', !state.gridActive);
    }
  }

  function createGridOverlay() {
    _gridOverlayEl = document.createElement('div');
    _gridOverlayEl.className = 'grid-overlay hidden';
    el.previewWrapper.appendChild(_gridOverlayEl);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  function updateFullscreenIcon() {
    const isFs = !!document.fullscreenElement;
    el.fsExpandIcon.classList.toggle('hidden', isFs);
    el.fsCollapseIcon.classList.toggle('hidden', !isFs);
  }

  function openShortcutsModal() {
    el.shortcutsModal.classList.remove('hidden');
    el.shortcutsBackdrop.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeShortcutsModal() {
    el.shortcutsModal.classList.add('hidden');
    el.shortcutsBackdrop.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function updateStatsHUD() {
    if (!state.cameraActive) return;
    const filterName = document.querySelector(`.filter-btn[data-filter="${state.currentFilter}"] span`)?.textContent || state.currentFilter;
    el.statFilter.textContent = filterName;
    const aspectMap = { free: 'Free', '1': '1:1', '1.3333': '4:3', '1.7778': '16:9', '0.5625': '9:16' };
    el.statAspect.textContent = aspectMap[state.aspect] || state.aspect;
    el.statZoom.textContent = `${state.zoom.toFixed(1)}×`;
  }

  function updateExportInfo() {
    const [rw, rh] = RESMAP[state.resolution] || RESMAP[720];
    el.infoRes.textContent = `${rw} × ${rh}`;
    const qPct = Math.round(state.jpegQuality * 100);
    el.infoFormat.textContent = state.format === 'png' ? 'PNG' : `JPEG ${qPct}%`;
  }

  async function startCamera() {
    if (!NC.Camera.isSupported()) {
      showToast('Camera not supported in this browser.');
      return;
    }
    try {
      el.startCameraBtn.disabled = true;
      el.startCameraBtn.innerHTML = '<span>Starting…</span>';

      await NC.Camera.start(state.resolution, state.fps);

      const [rw, rh] = RESMAP[state.resolution] || RESMAP[720];
      el.canvas.width  = rw;
      el.canvas.height = rh;

      const canvasVideo = el.canvas.captureStream(state.fps);
      const audioTracks = NC.Camera.getStream().getAudioTracks();
      if (audioTracks.length > 0) {
        state.canvasStream = new MediaStream([
          ...canvasVideo.getVideoTracks(),
          ...audioTracks
        ]);
      } else {
        state.canvasStream = canvasVideo;
      }

      state.cameraActive = true;
      el.noCamera.classList.add('hidden');
      el.previewStats.classList.remove('hidden');

      el.startCameraBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        Stop Camera`;
      el.startCameraBtn.disabled = false;
      el.startCameraBtn.classList.add('active');

      setControlsEnabled(true);
      el.shutterWrap.classList.add('active');

      if (NC.Camera.hasMultipleCameras()) {
        el.switchCameraBtn.classList.remove('hidden');
        el.switchCameraBtn.disabled = false;
      }

      if (state.rafId) cancelAnimationFrame(state.rafId);
      state.rafId = requestAnimationFrame(render);
      updateStatsHUD();

    } catch (err) {
      console.error('Camera error:', err);
      const msg = err.name === 'NotAllowedError'
        ? 'Camera permission denied. Allow access in browser settings.'
        : `Camera error: ${err.message}`;
      showToast(msg, 4000);
      el.startCameraBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        Start Camera`;
      el.startCameraBtn.disabled = false;
    }
  }

  function stopCamera() {
    NC.Camera.stop();
    state.cameraActive = false;
    if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
    ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
    el.noCamera.classList.remove('hidden');
    el.previewStats.classList.add('hidden');
    el.startCameraBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
      Start Camera`;
    el.startCameraBtn.disabled = false;
    el.startCameraBtn.classList.remove('active');
    setControlsEnabled(false);
    el.switchCameraBtn.classList.add('hidden');
    el.shutterWrap.classList.remove('active');
  }

  function setControlsEnabled(enabled) {
    [el.captureBtn, el.burstBtn, el.recordBtn, el.mirrorBtn, el.beforeAfterBtn, el.gridBtn].forEach(b => {
      if (b) b.disabled = !enabled;
    });
    if (!NC.Recorder.isSupported()) el.recordBtn.disabled = true;
  }

  function doCapture() {
    const [rw, rh] = RESMAP[state.resolution] || RESMAP[720];
    const offscreen = document.createElement('canvas');
    offscreen.width  = rw;
    offscreen.height = rh;
    const octx = offscreen.getContext('2d', { willReadFrequently: true });
    const video = NC.Camera.getVideoEl();

    octx.save();
    if (state.mirror) { octx.translate(rw, 0); octx.scale(-1, 1); }
    if (state.zoom > 1) {
      octx.translate(rw/2, rh/2);
      octx.scale(state.zoom, state.zoom);
      octx.translate(-rw/2, -rh/2);
    }
    octx.filter = NC.Filters.buildCssFilter(state.currentFilter, state.intensity, state.adj);
    octx.drawImage(video, 0, 0, rw, rh);
    octx.restore();
    NC.Filters.applyPostProcess(octx, rw, rh, state.currentFilter, state.intensity, state.adj);

    const mime    = state.format === 'png' ? 'image/png' : 'image/jpeg';
    const qual    = state.format === 'png' ? undefined : state.jpegQuality;
    const dataUrl = offscreen.toDataURL(mime, qual);

    flashEffect();
    addToGallery({ type: 'photo', dataUrl, ts: Date.now() });
    showToast('Photo captured!');
  }

  function captureWithTimer(action) {
    if (!state.cameraActive) return;
    if (state.timerSecs === 0) { action(); return; }

    let countdown = state.timerSecs;
    el.timerOverlay.classList.remove('hidden');
    el.timerOverlay.textContent = countdown;

    const tick = () => {
      countdown--;
      if (countdown <= 0) {
        el.timerOverlay.classList.add('hidden');
        action();
      } else {
        el.timerOverlay.style.animation = 'none';
        el.timerOverlay.textContent = countdown;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => { el.timerOverlay.style.animation = ''; });
        });
        setTimeout(tick, 1000);
      }
    };
    setTimeout(tick, 1000);
  }

  async function doBurst() {
    if (state.isBursting) return;
    state.isBursting = true;
    el.burstBtn.classList.add('active');
    showToast(`Burst: ${BURST_COUNT} photos`);
    for (let i = 0; i < BURST_COUNT; i++) {
      doCapture();
      await sleep(BURST_DELAY_MS);
    }
    state.isBursting = false;
    el.burstBtn.classList.remove('active');
    showToast(`Burst complete — ${BURST_COUNT} photos saved`);
  }

  function toggleRecording() {
    if (NC.Recorder.isRecording()) {
      NC.Recorder.stop();
    } else {
      if (!state.canvasStream) { showToast('Canvas stream not ready'); return; }
      NC.Recorder.start(state.canvasStream, {
        onStop(blob, durationMs) {
          state.isRecording = false;
          el.recIndicator.classList.add('hidden');
          el.recordBtn.classList.remove('active');
          el.recordLabel.textContent = 'Record';
          el.captureBtn.disabled = false;
          el.burstBtn.disabled = false;
          const videoUrl = URL.createObjectURL(blob);
          addToGallery({ type: 'video', videoUrl, blob, ts: Date.now(), durationMs });
          showToast(`Video saved (${formatDuration(durationMs)})`);
        },
        onTick(elapsed) {
          el.recordLabel.textContent = formatDuration(elapsed);
        }
      });
      state.isRecording = true;
      el.recIndicator.classList.remove('hidden');
      el.recordBtn.classList.add('active');
      el.recordLabel.textContent = '0:00';
      el.captureBtn.disabled = true;
      el.burstBtn.disabled = true;
    }
  }

  function addToGallery(item) {
    item.id = Date.now() + Math.random().toString(36).slice(2, 6);
    state.gallery.unshift(item);
    renderGallery();
    if (item.type === 'photo') saveGalleryToStorage();
  }

  function renderGallery() {
    el.gallery.innerHTML = '';
    const hasItems = state.gallery.length > 0;
    el.emptyGallery.classList.toggle('hidden', hasItems);
    el.clearGalleryBtn.classList.toggle('hidden', !hasItems);

    if (hasItems) {
      el.galleryCount.textContent = state.gallery.length;
      el.galleryCount.classList.remove('hidden');
    } else {
      el.galleryCount.classList.add('hidden');
    }

    state.gallery.forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'gallery-item';
      div.dataset.idx = idx;

      if (item.type === 'photo') {
        const img = document.createElement('img');
        img.src = item.dataUrl;
        img.alt = 'Captured photo';
        img.loading = 'lazy';
        div.appendChild(img);
      } else {
        const vid = document.createElement('video');
        vid.src = item.videoUrl;
        vid.preload = 'metadata';
        div.appendChild(vid);
        const badge = document.createElement('span');
        badge.className = 'vid-badge';
        badge.textContent = 'VID';
        div.appendChild(badge);
      }

      div.addEventListener('click', () => openLightbox(idx));
      el.gallery.appendChild(div);
    });
  }

  function openLightbox(idx) {
    state.lightboxIdx = idx;
    const item = state.gallery[idx];
    if (!item) return;

    el.lightboxImg.style.display   = 'none';
    el.lightboxVideo.style.display = 'none';

    if (item.type === 'photo') {
      el.lightboxImg.src = item.dataUrl;
      el.lightboxImg.style.display = 'block';
    } else {
      el.lightboxVideo.src = item.videoUrl;
      el.lightboxVideo.style.display = 'block';
    }

    el.lightbox.classList.remove('hidden');
    el.lightboxBackdrop.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    el.lightbox.classList.add('hidden');
    el.lightboxBackdrop.classList.add('hidden');
    el.lightboxVideo.pause();
    el.lightboxVideo.src = '';
    document.body.style.overflow = '';
    state.lightboxIdx = -1;
  }

  function downloadLightboxItem() {
    const item = state.gallery[state.lightboxIdx];
    if (!item) return;
    const a = document.createElement('a');
    const ts = new Date(item.ts).toISOString().slice(0, 19).replace(/[:T]/g, '-');
    if (item.type === 'photo') {
      a.href = item.dataUrl;
      a.download = `noircam-${ts}.${state.format}`;
    } else {
      a.href = item.videoUrl;
      a.download = `noircam-${ts}.webm`;
    }
    a.click();
  }

  function deleteLightboxItem() {
    if (state.lightboxIdx < 0) return;
    const item = state.gallery[state.lightboxIdx];
    if (item && item.videoUrl) URL.revokeObjectURL(item.videoUrl);
    state.gallery.splice(state.lightboxIdx, 1);
    closeLightbox();
    renderGallery();
    saveGalleryToStorage();
  }

  function clearGallery() {
    if (!confirm('Clear all captures?')) return;
    state.gallery.forEach(item => { if (item.videoUrl) URL.revokeObjectURL(item.videoUrl); });
    state.gallery = [];
    renderGallery();
    saveGalleryToStorage();
  }

  function savePreset() {
    const name = el.presetNameInput.value.trim() || `Preset ${state.presets.length + 1}`;
    state.presets.push({
      id:        Date.now(),
      name,
      filter:    state.currentFilter,
      intensity: state.intensity,
      adj:       { ...state.adj }
    });
    el.presetNameInput.value = '';
    renderPresets();
    savePresetsToStorage();
    showToast(`Preset "${name}" saved`);
  }

  function loadPreset(preset) {
    state.currentFilter = preset.filter;
    state.intensity     = preset.intensity;
    Object.assign(state.adj, preset.adj);
    syncAllUI();
    initAllSliderFills();
    showToast(`Loaded "${preset.name}"`);
  }

  function deletePreset(id) {
    state.presets = state.presets.filter(p => p.id !== id);
    renderPresets();
    savePresetsToStorage();
  }

  function renderPresets() {
    el.presetsList.innerHTML = '';
    const hasPresets = state.presets.length > 0;
    if (el.emptyPresets) el.emptyPresets.classList.toggle('hidden', hasPresets);

    state.presets.forEach(p => {
      const row = document.createElement('div');
      row.className = 'preset-item';

      const name = document.createElement('span');
      name.className = 'preset-name';
      name.textContent = p.name;
      name.title = `Filter: ${p.filter} | Intensity: ${Math.round(p.intensity * 100)}%`;
      name.addEventListener('click', () => loadPreset(p));

      const del = document.createElement('button');
      del.className = 'preset-del';
      del.innerHTML = '&times;';
      del.title = 'Delete preset';
      del.addEventListener('click', () => deletePreset(p.id));

      row.append(name, del);
      el.presetsList.appendChild(row);
    });
  }

  function saveGalleryToStorage() {
    try {
      const photos = state.gallery.filter(i => i.type === 'photo');
      localStorage.setItem(STORAGE_KEY_GALLERY, JSON.stringify(photos));
    } catch (_) {}
  }

  function loadGalleryFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_GALLERY);
      if (raw) state.gallery = JSON.parse(raw);
    } catch (_) {}
  }

  function savePresetsToStorage() {
    try { localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(state.presets)); } catch (_) {}
  }

  function loadPresetsFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PRESETS);
      if (raw) state.presets = JSON.parse(raw);
    } catch (_) {}
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify({
        resolution:  state.resolution,
        fps:         state.fps,
        format:      state.format,
        jpegQuality: state.jpegQuality
      }));
    } catch (_) {}
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.resolution)  state.resolution  = s.resolution;
        if (s.fps)         state.fps         = s.fps;
        if (s.format)      state.format      = s.format;
        if (s.jpegQuality) state.jpegQuality = s.jpegQuality;
      }
    } catch (_) {}
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(STORAGE_KEY_THEME, next); } catch (_) {}
  }

  function loadTheme() {
    try {
      const t = localStorage.getItem(STORAGE_KEY_THEME);
      if (t) document.documentElement.dataset.theme = t;
    } catch (_) {}
  }

  function syncAllUI() {
    document.querySelectorAll('.filter-btn').forEach(b => {
      const isActive = b.dataset.filter === state.currentFilter;
      b.classList.toggle('active', isActive);
      if (isActive && el.activeFilterName) {
        el.activeFilterName.textContent = b.querySelector('span')?.textContent || b.dataset.filter;
      }
    });

    el.intensitySlider.value = Math.round(state.intensity * 100);
    el.intensityValue.textContent = `${Math.round(state.intensity * 100)}%`;

    el.brightness.value  = state.adj.brightness;  el.brightnessVal.textContent  = state.adj.brightness;
    el.contrast.value    = state.adj.contrast;    el.contrastVal.textContent    = state.adj.contrast;
    el.saturation.value  = state.adj.saturation;  el.saturationVal.textContent  = state.adj.saturation;
    el.warmth.value      = state.adj.warmth;      el.warmthVal.textContent      = state.adj.warmth;
    el.sharpness.value   = state.adj.sharpness;   el.sharpnessVal.textContent   = state.adj.sharpness;
    el.blur.value        = state.adj.blur;         el.blurVal.textContent        = state.adj.blur;
    el.vignette.value    = state.adj.vignette;    el.vignetteVal.textContent    = state.adj.vignette;
    el.grain.value       = state.adj.grain;       el.grainVal.textContent       = state.adj.grain;

    el.resolution.value  = state.resolution;
    if (el.fps) el.fps.value = state.fps;
    el.format.value      = state.format;
    const qPct = Math.round(state.jpegQuality * 100);
    el.jpegQuality.value = qPct;
    el.jpegQualityVal.textContent = `${qPct}%`;
    updateExportInfo();

    el.zoomSlider.value = state.zoom;
    el.zoomValue.textContent = `${state.zoom.toFixed(1)}×`;

    el.mirrorBtn.classList.toggle('active', state.mirror);
    el.beforeAfterBtn.classList.toggle('active', state.beforeAfterMode);
    el.gridBtn.classList.toggle('active', state.gridActive);
    el.beforeLabel.classList.toggle('hidden', !state.beforeAfterMode);
    el.afterLabel.classList.toggle('hidden',  !state.beforeAfterMode);

    updateStatsHUD();
  }

  function flashEffect() {
    el.flashOverlay.classList.add('flashing');
    setTimeout(() => el.flashOverlay.classList.remove('flashing'), 70);
  }

  let _toastTimer = null;
  function showToast(msg, durationMs = 2200) {
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.toast.classList.add('hidden'), durationMs);
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function wireEvents() {
    el.startCameraBtn.addEventListener('click', () => {
      if (state.cameraActive) stopCamera(); else startCamera();
    });

    el.mirrorBtn.addEventListener('click', () => {
      state.mirror = !state.mirror;
      el.mirrorBtn.classList.toggle('active', state.mirror);
    });

    el.switchCameraBtn.addEventListener('click', async () => {
      el.switchCameraBtn.disabled = true;
      await NC.Camera.toggle(state.resolution, state.fps);
      el.switchCameraBtn.disabled = false;
    });

    el.beforeAfterBtn.addEventListener('click', () => {
      state.beforeAfterMode = !state.beforeAfterMode;
      el.beforeAfterBtn.classList.toggle('active', state.beforeAfterMode);
      el.beforeLabel.classList.toggle('hidden', !state.beforeAfterMode);
      el.afterLabel.classList.toggle('hidden',  !state.beforeAfterMode);
    });

    el.gridBtn.addEventListener('click', toggleGrid);

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    el.aspectChips.addEventListener('click', e => {
      const chip = e.target.closest('.aspect-chip');
      if (!chip) return;
      setAspect(chip.dataset.aspect);
    });

    el.filterGrid.addEventListener('click', e => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      state.currentFilter = btn.dataset.filter;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b === btn));
      if (el.activeFilterName) {
        el.activeFilterName.textContent = btn.querySelector('span')?.textContent || btn.dataset.filter;
      }
      updateStatsHUD();
    });

    el.intensitySlider.addEventListener('input', () => {
      state.intensity = parseInt(el.intensitySlider.value) / 100;
      el.intensityValue.textContent = `${el.intensitySlider.value}%`;
      updateSliderFill(el.intensitySlider);
    });

    function wireAdj(inputEl, key, valEl) {
      inputEl.addEventListener('input', () => {
        state.adj[key] = parseFloat(inputEl.value);
        valEl.textContent = inputEl.value;
        updateSliderFill(inputEl);
      });
    }
    wireAdj(el.brightness, 'brightness', el.brightnessVal);
    wireAdj(el.contrast,   'contrast',   el.contrastVal);
    wireAdj(el.saturation, 'saturation', el.saturationVal);
    wireAdj(el.warmth,     'warmth',     el.warmthVal);
    wireAdj(el.sharpness,  'sharpness',  el.sharpnessVal);
    wireAdj(el.blur,       'blur',       el.blurVal);
    wireAdj(el.vignette,   'vignette',   el.vignetteVal);
    wireAdj(el.grain,      'grain',      el.grainVal);

    el.resetAdjBtn.addEventListener('click', () => {
      state.adj = { brightness:100, contrast:100, saturation:100, warmth:0, sharpness:0, blur:0, vignette:0, grain:0 };
      syncAllUI();
      initAllSliderFills();
    });

    el.zoomSlider.addEventListener('input', () => {
      state.zoom = parseFloat(el.zoomSlider.value);
      el.zoomValue.textContent = `${state.zoom.toFixed(1)}×`;
      updateSliderFill(el.zoomSlider);
      updateStatsHUD();
    });

    document.querySelectorAll('[data-timer]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.timerSecs = parseInt(btn.dataset.timer);
        document.querySelectorAll('[data-timer]').forEach(b => b.classList.toggle('active', b === btn));
      });
    });

    el.captureBtn.addEventListener('click', () => captureWithTimer(doCapture));
    el.burstBtn.addEventListener('click', () => captureWithTimer(doBurst));
    el.recordBtn.addEventListener('click', toggleRecording);

    el.resolution.addEventListener('change', () => {
      state.resolution = parseInt(el.resolution.value);
      saveSettings();
      updateExportInfo();
      if (state.cameraActive) {
        const [rw, rh] = RESMAP[state.resolution] || RESMAP[720];
        el.canvas.width  = rw;
        el.canvas.height = rh;
      }
    });

    el.fps.addEventListener('change', () => {
      state.fps = parseInt(el.fps.value);
      saveSettings();
      if (state.cameraActive) showToast('Restart camera to apply FPS change');
    });

    el.format.addEventListener('change', () => {
      state.format = el.format.value;
      saveSettings();
      updateExportInfo();
    });

    el.jpegQuality.addEventListener('input', () => {
      const pct = parseInt(el.jpegQuality.value);
      state.jpegQuality = pct / 100;
      el.jpegQualityVal.textContent = `${pct}%`;
      saveSettings();
      updateExportInfo();
      updateSliderFill(el.jpegQuality);
    });

    el.savePresetBtn.addEventListener('click', savePreset);
    el.presetNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') savePreset(); });

    el.clearGalleryBtn.addEventListener('click', clearGallery);

    el.closeLightbox.addEventListener('click', closeLightbox);
    el.lightboxBackdrop.addEventListener('click', closeLightbox);
    el.lightboxDownload.addEventListener('click', downloadLightboxItem);
    el.lightboxDelete.addEventListener('click', deleteLightboxItem);

    el.shortcutsBtn.addEventListener('click', openShortcutsModal);
    el.closeShortcuts.addEventListener('click', closeShortcutsModal);
    el.shortcutsBackdrop.addEventListener('click', closeShortcutsModal);

    el.fullscreenBtn.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', updateFullscreenIcon);

    el.darkModeToggle.addEventListener('click', toggleTheme);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (!el.lightbox.classList.contains('hidden')) { closeLightbox(); return; }
        if (!el.shortcutsModal.classList.contains('hidden')) { closeShortcutsModal(); return; }
      }
      if (e.key === '?') { openShortcutsModal(); return; }
      if (e.target.matches('input, select, textarea')) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (state.cameraActive) captureWithTimer(doCapture);
          break;
        case 'r': case 'R':
          if (state.cameraActive) toggleRecording();
          break;
        case 'm': case 'M':
          if (state.cameraActive) {
            state.mirror = !state.mirror;
            el.mirrorBtn.classList.toggle('active', state.mirror);
          }
          break;
        case 'g': case 'G':
          if (state.cameraActive) toggleGrid();
          break;
        case 'b': case 'B':
          if (state.cameraActive) {
            state.beforeAfterMode = !state.beforeAfterMode;
            el.beforeAfterBtn.classList.toggle('active', state.beforeAfterMode);
            el.beforeLabel.classList.toggle('hidden', !state.beforeAfterMode);
            el.afterLabel.classList.toggle('hidden',  !state.beforeAfterMode);
          }
          break;
        case 'f': case 'F':
          toggleFullscreen();
          break;
        case '1': switchTab('filters');  break;
        case '2': switchTab('adjust');   break;
        case '3': switchTab('export');   break;
        case '4': switchTab('presets');  break;
      }
    });

    let _deferredInstall = null;
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      _deferredInstall = e;
      el.installBtn.classList.remove('hidden');
    });
    el.installBtn.addEventListener('click', async () => {
      if (!_deferredInstall) return;
      _deferredInstall.prompt();
      const { outcome } = await _deferredInstall.userChoice;
      if (outcome === 'accepted') el.installBtn.classList.add('hidden');
      _deferredInstall = null;
    });
  }

  function init() {
    loadTheme();
    loadSettings();
    loadGalleryFromStorage();
    loadPresetsFromStorage();

    createGridOverlay();
    syncAllUI();
    renderGallery();
    renderPresets();
    wireEvents();
    initAllSliderFills();
    updateExportInfo();

    el.canvas.width  = 1280;
    el.canvas.height = 720;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, 1280, 720);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
