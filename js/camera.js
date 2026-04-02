window.NC = window.NC || {};

NC.Camera = (function () {

  let _stream = null;
  let _facingMode = 'user';
  let _hasMultipleCameras = false;
  const _videoEl = document.getElementById('video');

  const RESOLUTIONS = {
    1080: { width: { ideal: 1920 }, height: { ideal: 1080 } },
    720:  { width: { ideal: 1280 }, height: { ideal: 720  } },
    480:  { width: { ideal: 854  }, height: { ideal: 480  } }
  };

  async function start(preferredRes = 720, preferredFps = 30) {
    stop();

    const resCon = RESOLUTIONS[preferredRes] || RESOLUTIONS[720];
    const constraints = {
      video: { facingMode: _facingMode, ...resCon, frameRate: { ideal: preferredFps, max: preferredFps } },
      audio: false
    };

    try {
      _stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      _stream = await navigator.mediaDevices.getUserMedia({ video: true });
    }

    // Ask for mic separately so a denial doesn't block the camera
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      audioStream.getAudioTracks().forEach(t => _stream.addTrack(t));
    } catch (_) {}

    _videoEl.srcObject = _stream;
    await _videoEl.play().catch(() => {});
    await checkMultipleCameras();
    return _stream;
  }

  function stop() {
    if (_stream) {
      _stream.getTracks().forEach(t => t.stop());
      _stream = null;
    }
    _videoEl.srcObject = null;
  }

  async function toggle(preferredRes, preferredFps) {
    _facingMode = _facingMode === 'user' ? 'environment' : 'user';
    return start(preferredRes, preferredFps);
  }

  async function checkMultipleCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      _hasMultipleCameras = devices.filter(d => d.kind === 'videoinput').length > 1;
    } catch {
      _hasMultipleCameras = false;
    }
  }

  function hasMultipleCameras() { return _hasMultipleCameras; }
  function getStream()          { return _stream; }
  function getVideoEl()         { return _videoEl; }
  function isSupported()        { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }

  function getVideoTrackSettings() {
    if (!_stream) return null;
    const track = _stream.getVideoTracks()[0];
    return track ? track.getSettings() : null;
  }

  return { start, stop, toggle, hasMultipleCameras, getStream, getVideoEl, getVideoTrackSettings, isSupported };

})();
