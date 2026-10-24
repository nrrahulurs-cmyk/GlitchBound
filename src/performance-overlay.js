const SAMPLE_WINDOW = 360;
const REPORT_INTERVAL_MS = 500;

const percentile = (values, fraction) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
};

const ms = (value) => `${Number.isFinite(value) ? value.toFixed(1) : '—'} ms`;
const kb = (value) => `${Number.isFinite(value) ? (value / 1024).toFixed(0) : '—'} KB`;

/** A query-enabled, low-rate browser overlay for collecting comparable local baselines. */
export function createPerformanceOverlay({ renderer, scene, getStats = () => ({}) }) {
  const enabled = import.meta.env?.DEV === true && new URLSearchParams(location.search).get('perf') === '1';
  if (!enabled) return { enabled: false, markInput() {}, recordFrame() {}, dispose() {} };

  const panel = document.createElement('pre');
  panel.id = 'glitchbound-performance-overlay';
  panel.setAttribute('aria-label', 'GLITCHBOUND performance diagnostics');
  panel.style.cssText = 'position:fixed;z-index:9999;top:64px;right:12px;width:min(440px,calc(100vw - 24px));max-height:calc(100vh - 76px);overflow:hidden;margin:0;padding:12px 14px;border:1px solid rgba(0,229,255,.5);background:rgba(4,9,16,.91);box-shadow:0 8px 28px rgba(0,0,0,.35);color:#d8f2f5;font:11px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;letter-spacing:.025em;text-shadow:0 1px 2px rgba(0,0,0,.9);pointer-events:none;backdrop-filter:blur(8px)';
  const applyViewportStyle = () => {
    const compact = innerWidth <= 720;
    panel.style.top = compact ? '58px' : '64px';
    panel.style.right = compact ? '8px' : '12px';
    panel.style.width = compact ? 'min(370px,calc(100vw - 16px))' : 'min(440px,calc(100vw - 24px))';
    panel.style.fontSize = compact ? '9px' : '11px';
    panel.style.lineHeight = compact ? '1.4' : '1.55';
  };
  applyViewportStyle();
  window.addEventListener('resize', applyViewportStyle);
  document.body.append(panel);

  const frames = [];
  const phaseHistory = new Map();
  const inputLatency = [];
  const longTasks = [];
  let pendingInputAt = null;
  let nextReportAt = 0;
  let nextSceneCountAt = 0;
  let sceneCounts = { objects: 0, meshes: 0, lights: 0, visibleMeshes: 0 };
  let disposed = false;
  let observer = null;

  try {
    if ('PerformanceObserver' in window) {
      observer = new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries()) {
          longTasks.push({ duration: entry.duration, at: performance.now() });
          if (longTasks.length > 120) longTasks.shift();
        }
      });
      observer.observe({ type: 'longtask', buffered: true });
    }
  } catch {
    observer = null;
  }

  const pushBounded = (array, value, limit = SAMPLE_WINDOW) => {
    array.push(value);
    if (array.length > limit) array.shift();
  };

  function countScene() {
    sceneCounts = { objects: 0, meshes: 0, lights: 0, visibleMeshes: 0 };
    scene.traverse((object) => {
      sceneCounts.objects++;
      if (object.isMesh || object.isPoints || object.isLine) {
        sceneCounts.meshes++;
        if (object.visible) sceneCounts.visibleMeshes++;
      }
      if (object.isLight && object.visible) sceneCounts.lights++;
    });
  }

  function loadMetrics() {
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    const assets = resources.filter((entry) => /\/(?:assets\/[^/?]+\.(?:glb|gltf|png|jpe?g|webp|ktx2)|audio\/(?:[^/?]+\/)*[^/?]+\.(?:mp3|wav|ogg|m4a|aac))(?:\?|$)/i.test(entry.name));
    return {
      domReady: navigation?.domContentLoadedEventEnd || 0,
      loadEvent: navigation?.loadEventEnd || 0,
      assetCount: assets.length,
    };
  }

  function readStats() {
    try { return getStats() || {}; } catch { return {}; }
  }

  function render(timestamp) {
    const frameTimes = frames.map((frame) => frame.frameMs);
    const mean = frameTimes.length ? frameTimes.reduce((sum, value) => sum + value, 0) / frameTimes.length : 0;
    const phases = [...phaseHistory].map(([name, values]) => `${name}: ${ms(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length))}`).join('  ');
    const stats = readStats();
    const memory = performance.memory;
    const glMemory = renderer.info.memory;
    const activeBolts = stats.weaponEffects?.activeBolts ?? 0;
    const activeImpacts = stats.weaponEffects?.activeImpacts ?? 0;
    const activeEffects = stats.cinematicEffects ?? 0;
    const audioSamples = stats.audioSamples || { loaded: [], failed: [], timings: {} };
    const audioTimings = Object.values(audioSamples.timings || {});
    const maxAudioFetch = audioTimings.length ? Math.max(...audioTimings.map((sample) => sample.fetchMs || 0)) : 0;
    const maxAudioDecode = audioTimings.length ? Math.max(...audioTimings.map((sample) => sample.decodeMs || 0)) : 0;
    const load = loadMetrics();
    const latestLatency = inputLatency.length ? inputLatency[inputLatency.length - 1] : null;
    const recentLongTasks = longTasks.filter((task) => timestamp - task.at <= 60000);
    const latestLongTask = recentLongTasks.length ? Math.max(...recentLongTasks.map((task) => task.duration)) : 0;
    const lastFrame = frames.length ? frames[frames.length - 1] : null;
    panel.textContent = [
      'GLITCHBOUND // LOCAL PERF DIAGNOSTICS',
      `State ${stats.mode || 'loading'}${stats.inVehicle ? ' · driving' : ''}${stats.cinematicActive ? ' · intro' : ''}   ${innerWidth}×${innerHeight} @ ${Math.min(devicePixelRatio, 1.5).toFixed(2)} DPR`,
      `Frame ${ms(mean)} avg  /  ${ms(percentile(frameTimes, .95))} p95  /  ${ms(frameTimes.length ? Math.max(...frameTimes) : 0)} max   ${mean ? (1000 / mean).toFixed(1) : '—'} FPS avg`,
      `Recent frame ${ms(lastFrame?.frameMs ?? 0)}   >33ms ${frameTimes.filter((value) => value > 33.3).length}/${frameTimes.length}   input→frame ${ms(latestLatency ?? 0)}`,
      `JS phases: ${phases || 'collecting…'}`,
      `Render submit ${renderer.info.render.calls} calls · ${renderer.info.render.triangles.toLocaleString()} tris · ${sceneCounts.visibleMeshes}/${sceneCounts.meshes} visible meshes`,
      `World ${sceneCounts.objects.toLocaleString()} objects · ${sceneCounts.lights} lights · ${stats.physicsBodies ?? '—'} physics bodies · ${stats.shadowUpdates ?? '—'} shadow updates`,
      `GPU resources ${glMemory.geometries} geometries · ${glMemory.textures} textures   JS heap ${memory ? kb(memory.usedJSHeapSize) : 'unavailable'}`,
      `Combat warm-up ${stats.combatShaderState || 'unavailable'} ${ms(stats.combatShaderWarmupMs ?? 0)} · init city ${ms(stats.cityBuildMs ?? 0)} · traffic ${ms(stats.cityLifeBuildMs ?? 0)} · atmosphere ${ms(stats.atmosphereBuildMs ?? 0)}`,
      `Effects ${activeBolts} bolts · ${activeImpacts} impacts · ${activeEffects} cinematic nodes · ${stats.audioVoices ?? '—'} audio voices`,
      `Audio ${audioSamples.loaded.length}/5 decoded · ${audioSamples.failed.length} failed · slowest sample fetch/decode ${ms(maxAudioFetch)} / ${ms(maxAudioDecode)}`,
      `Long tasks ${recentLongTasks.length} (last 60 s) · worst ${ms(latestLongTask)}   Assets ${load.assetCount} timing entries · transfer bytes cache-limited`,
      `GLB load ${ms(stats.glbLoadMs ?? 0)} · remaining init ${ms(stats.postAssetInitMs ?? 0)} · boot ready ${ms(stats.readyMs ?? 0)} · DOM ${ms(load.domReady)} · load ${ms(load.loadEvent)}   Updated ${(timestamp / 1000).toFixed(1)} s`,
      'Refresh to reset the sample window. Overlay is active only with ?perf=1.',
    ].join('\n');
  }

  function markInput() {
    pendingInputAt = performance.now();
  }

  function recordFrame(frameMs, phaseTimes = {}) {
    if (disposed) return;
    const now = performance.now();
    if (Number.isFinite(frameMs) && frameMs >= 0 && frameMs < 2000) {
      pushBounded(frames, { frameMs, phases: phaseTimes });
      for (const [name, duration] of Object.entries(phaseTimes)) {
        if (!phaseHistory.has(name)) phaseHistory.set(name, []);
        pushBounded(phaseHistory.get(name), duration, 120);
      }
    }
    if (pendingInputAt !== null) {
      pushBounded(inputLatency, now - pendingInputAt, 120);
      pendingInputAt = null;
    }
    if (now >= nextSceneCountAt) {
      countScene();
      nextSceneCountAt = now + 2000;
    }
    if (now >= nextReportAt) {
      render(now);
      nextReportAt = now + REPORT_INTERVAL_MS;
    }
  }

  window.__glitchboundPerf = {
    snapshot: () => ({
      enabled, sampleCount: frames.length,
      meanFrameMs: frames.length ? frames.reduce((sum, frame) => sum + frame.frameMs, 0) / frames.length : 0,
      p95FrameMs: percentile(frames.map((frame) => frame.frameMs), .95),
      maxFrameMs: frames.length ? Math.max(...frames.map((frame) => frame.frameMs)) : 0,
      scene: { ...sceneCounts }, renderer: { ...renderer.info.render }, memory: { ...renderer.info.memory },
      longTasks: longTasks.filter((task) => performance.now() - task.at <= 60000).map((task) => ({ ...task })), load: { ...load },
    }),
  };

  return {
    enabled: true,
    markInput,
    recordFrame,
    dispose() {
      if (disposed) return;
      disposed = true;
      observer?.disconnect();
      window.removeEventListener('resize', applyViewportStyle);
      panel.remove();
      delete window.__glitchboundPerf;
    },
  };
}
