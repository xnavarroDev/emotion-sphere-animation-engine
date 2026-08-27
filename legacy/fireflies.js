/**
 * fireflies.js — dots that spawn one at a time, spiral out from the centre,
 * drift, leave a fading glowing trail, then fade out. (The "appearing firefly"
 * effect from the Emotion Sphere's inner emitter, decoupled from the app.)
 *
 * Works with three.js r128+ (classic <script> global or ES module).
 *
 * Usage (classic script — three as global THREE):
 *   <script src="three.min.js"></script>
 *   <script src="fireflies.js"></script>
 *   <script>
 *     const fireflies = createFireflies(THREE, { color: 0xffd0a0 });
 *     scene.add(fireflies.group);          // adds the dots + their trails
 *     // in your render loop, pass elapsed seconds:
 *     fireflies.update(clock.getElapsedTime());
 *   </script>
 *
 * Usage (ES module):
 *   import * as THREE from 'three';
 *   import { createFireflies } from './fireflies.js';
 *   const fireflies = createFireflies(THREE, { color: 0xffd0a0 });
 *   scene.add(fireflies.group);
 *   // loop: fireflies.update(clock.getElapsedTime());
 *
 * Options (all optional):
 *   count          pool of firefly slots (≈ life/spawnInterval are alive)  (56)
 *   radius         how far they drift out from the centre                  (0.75)
 *   color          tint (hex number or THREE.Color)                        (0xffd0a0)
 *   size           firefly dot size (world units, sizeAttenuation)         (0.06)
 *   opacity        firefly opacity                                         (0.95)
 *   spawnInterval  seconds between births (lower = denser)                 (0.65)
 *   life           seconds each firefly lives                              (5.8)
 *   fade           fade-out duration at end of life                        (1.2)
 *   drift          orbital wobble amplitude while emerging                 (0.34)
 *   wander         gentle ongoing drift once settled                       (0.04)
 *   trail          emit trails?                                            (true)
 *   trailLife      trail dot lifetime (s)                                  (1.55)
 *   trailSize      trail dot size                                          (0.11)
 *   trailPool      max live trail dots                                     (2200)
 *
 * Returns { group, points, trailPoints, update(t), setColor(c), dispose() }.
 * `update` derives dt internally; pass a second arg to override (update(t, dt)).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.createFireflies = api.createFireflies;
})(typeof self !== 'undefined' ? self : this, function () {

  const smoothstep   = (t) => t * t * (3 - 2 * t);
  const smootherstep = (t) => t * t * t * (t * (t * 6 - 15) + 10);

  // Soft radial-gradient sprite → glowing dots under additive blending.
  function makeGlowTexture(THREE) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0,    'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(1,    'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  function createFireflies(THREE, opts) {
    opts = opts || {};
    const count         = opts.count         != null ? opts.count         : 56;
    const radius        = opts.radius        != null ? opts.radius        : 0.75;
    const size          = opts.size          != null ? opts.size          : 0.06;
    const opacity       = opts.opacity       != null ? opts.opacity       : 0.95;
    const spawnInterval = opts.spawnInterval != null ? opts.spawnInterval : 0.65;
    const life          = opts.life          != null ? opts.life          : 5.8;
    const fade          = opts.fade          != null ? opts.fade          : 1.2;
    const drift         = opts.drift         != null ? opts.drift         : 0.34;
    const wander        = opts.wander        != null ? opts.wander        : 0.04;
    const useTrail      = opts.trail         != null ? opts.trail         : true;
    const trailLife     = opts.trailLife     != null ? opts.trailLife     : 1.55;
    const trailSize     = opts.trailSize     != null ? opts.trailSize     : 0.11;
    const trailPool     = opts.trailPool     != null ? opts.trailPool     : 2200;
    const emitStep      = 0.042;

    const tint = new THREE.Color(opts.color != null ? opts.color : 0xffd0a0);
    const texture = makeGlowTexture(THREE);
    const group = new THREE.Group();

    // ---- firefly slots ----------------------------------------------------
    const rest  = new Float32Array(count * 3); // settled position (random in sphere)
    const axis  = new Float32Array(count * 3); // orbit axis (perpendicular to rest dir)
    const phase = new Float32Array(count);
    const birth = new Float32Array(count);     // spawn time; <0 = dead
    const prev  = new Float32Array(count * 3); // last position (for trail emission)
    const pos   = new Float32Array(count * 3);
    const col   = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) initSlot(i);
    function initSlot(i) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const rad = Math.pow(Math.random(), 0.45) * radius; // core-biased
      const x = rad * Math.sin(ph) * Math.cos(th);
      const y = rad * Math.sin(ph) * Math.sin(th);
      const z = rad * Math.cos(ph);
      rest[i*3] = x; rest[i*3+1] = y; rest[i*3+2] = z;
      phase[i] = Math.random() * Math.PI * 2;
      birth[i] = -1;
      // a unit axis perpendicular to the rest direction → orbital plane
      const inv = 1 / (Math.hypot(x, y, z) || 1);
      const ux = x*inv, uy = y*inv, uz = z*inv;
      const rx = Math.random()*2-1, ry = Math.random()*2-1, rz = Math.random()*2-1;
      let ax = uy*rz-uz*ry, ay = uz*rx-ux*rz, az = ux*ry-uy*rx;
      const al = Math.hypot(ax, ay, az) || 1;
      axis[i*3] = ax/al; axis[i*3+1] = ay/al; axis[i*3+2] = az/al;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size, map: texture, vertexColors: true, transparent: true, opacity,
      depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      sizeAttenuation: true, fog: false,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    group.add(points);

    // ---- trail pool (ring buffer of fading dots) --------------------------
    const tPos  = new Float32Array(trailPool * 3);
    const tCol  = new Float32Array(trailPool * 3);
    const tBase = new Float32Array(trailPool * 3);
    const tVel  = new Float32Array(trailPool * 3);
    const tAge  = new Float32Array(trailPool);
    const tAlive  = new Uint8Array(trailPool);
    const tActive = new Uint32Array(trailPool);
    let tActiveN = 0, tHead = 0;

    let trailPoints = null, tGeo = null, tMat = null;
    if (useTrail) {
      tGeo = new THREE.BufferGeometry();
      tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
      tGeo.setAttribute('color',    new THREE.BufferAttribute(tCol, 3));
      tMat = new THREE.PointsMaterial({
        size: trailSize, map: texture, vertexColors: true, transparent: true, opacity: 0.72,
        depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
        sizeAttenuation: true, fog: false,
      });
      trailPoints = new THREE.Points(tGeo, tMat);
      trailPoints.frustumCulled = false;
      group.add(trailPoints);
    }
    function emitTrail(px, py, pz, mx, my, mz, r, g, b) {
      const idx = tHead++ % trailPool, t3 = idx * 3, j = emitStep;
      tPos[t3]   = px + (Math.random()-0.5)*j;
      tPos[t3+1] = py + (Math.random()-0.5)*j;
      tPos[t3+2] = pz + (Math.random()-0.5)*j;
      tVel[t3]   = mx*0.4 + (Math.random()-0.5)*0.028;
      tVel[t3+1] = my*0.4 + (Math.random()-0.5)*0.028 + 0.012;
      tVel[t3+2] = mz*0.4 + (Math.random()-0.5)*0.028;
      tBase[t3] = r; tBase[t3+1] = g; tBase[t3+2] = b;
      tCol[t3]  = r; tCol[t3+1]  = g; tCol[t3+2]  = b;
      tAge[idx] = trailLife;
      if (!tAlive[idx]) { tAlive[idx] = 1; tActive[tActiveN++] = idx; }
    }

    // ---- per-frame --------------------------------------------------------
    let lastT = null, spawnAcc = 0, cursor = 0;

    function update(t, dtArg) {
      const dt = dtArg != null ? dtArg
        : (lastT == null ? 0 : Math.min(Math.max(t - lastT, 0), 0.05));
      lastT = t;

      // spawn one firefly at a time, sparsely
      spawnAcc += dt;
      while (spawnAcc >= spawnInterval) {
        spawnAcc -= spawnInterval;
        const idx = cursor++ % count;
        birth[idx] = t;
        prev[idx*3] = prev[idx*3+1] = prev[idx*3+2] = 0; // trail starts at centre
      }

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        let vis = 0, px = 0, py = 0, pz = 0;
        const b = birth[i];
        if (b >= 0) {
          const age = t - b;
          if (age >= life) {
            birth[i] = -1;
          } else {
            const pe = smootherstep(Math.min(1, age / (life - fade))); // 0→1 emerge
            const visIn  = smoothstep(Math.min(1, age / 0.5));          // fade in
            const visOut = age > life - fade ? smootherstep(Math.max(0, (life - age) / fade)) : 1;
            vis = visIn * visOut;

            const ox = rest[i3], oy = rest[i3+1], oz = rest[i3+2];
            const len = Math.hypot(ox, oy, oz) || 1;
            const nx = ox/len, ny = oy/len, nz = oz/len;
            const ax = axis[i3], ay = axis[i3+1], az = axis[i3+2];
            // second orbital basis vector v = n × axis
            const vx = ny*az - nz*ay, vy = nz*ax - nx*az, vz = nx*ay - ny*ax;
            const ang = t * 1.25 + phase[i] * 8.6;
            const cs = Math.cos(ang), sn = Math.sin(ang);
            const pr = len * pe;                                  // radius grows as it emerges
            const amp = pr * drift * Math.pow(1 - pe, 1.75)       // big wobble while emerging…
                      + len * wander * Math.sin(t * 0.8 + phase[i]); // …gentle drift once settled
            px = nx*pr + (ax*cs + vx*sn) * amp;
            py = ny*pr + (ay*cs + vy*sn) * amp;
            pz = nz*pr + (az*cs + vz*sn) * amp;
          }
        }
        pos[i3] = px; pos[i3+1] = py; pos[i3+2] = pz;
        col[i3] = tint.r * vis; col[i3+1] = tint.g * vis; col[i3+2] = tint.b * vis;

        // emit trail when this firefly has moved far enough
        if (useTrail && vis > 0.05) {
          const dx = px - prev[i3], dy = py - prev[i3+1], dz = pz - prev[i3+2];
          if (Math.hypot(dx, dy, dz) > emitStep) {
            emitTrail(px, py, pz, dx, dy, dz, tint.r*vis, tint.g*vis, tint.b*vis);
            prev[i3] = px; prev[i3+1] = py; prev[i3+2] = pz;
          }
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;

      // age + drift the trail dots
      if (useTrail) {
        for (let a = tActiveN - 1; a >= 0; a--) {
          const idx = tActive[a], t3 = idx * 3;
          let age = tAge[idx] - dt;
          if (age <= 0) {
            tAge[idx] = 0; tAlive[idx] = 0;
            tPos[t3] = tPos[t3+1] = tPos[t3+2] = 0;
            tCol[t3] = tCol[t3+1] = tCol[t3+2] = 0;
            tActive[a] = tActive[--tActiveN];
            continue;
          }
          tAge[idx] = age;
          tPos[t3]   += tVel[t3]   * dt;
          tPos[t3+1] += tVel[t3+1] * dt;
          tPos[t3+2] += tVel[t3+2] * dt;
          tVel[t3] *= 0.985; tVel[t3+1] *= 0.985; tVel[t3+2] *= 0.985;
          const f = Math.pow(age / trailLife, 1.5);              // fade with age
          tCol[t3] = tBase[t3]*f; tCol[t3+1] = tBase[t3+1]*f; tCol[t3+2] = tBase[t3+2]*f;
        }
        tGeo.attributes.position.needsUpdate = true;
        tGeo.attributes.color.needsUpdate = true;
      }
    }

    function setColor(c) { tint.set(c); }

    function dispose() {
      geo.dispose(); mat.dispose(); texture.dispose();
      if (tGeo) tGeo.dispose();
      if (tMat) tMat.dispose();
    }

    return { group, points, trailPoints, update, setColor, dispose };
  }

  return { createFireflies: createFireflies };
});
