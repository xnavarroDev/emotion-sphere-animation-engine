/**
 * Interior nebula — orange default; tints follow emotion identity (blue, purple, red, yellow).
 */
(function (global) {
  const TEXTURE_URL = 'https://assets.codepen.io/682745/cloud2.png';

  const ORANGE_TINT = new THREE.Color(1.0, 0.52, 0.18);
  const ORANGE_DEEP = new THREE.Color(0.55, 0.18, 0.06);
  const RED_ORANGE_TINT = new THREE.Color(1.0, 0.36, 0.1);
  const RED_ORANGE_DEEP = new THREE.Color(0.58, 0.1, 0.04);
  const COOL_PURPLE_TINT = new THREE.Color(0.95, 0.55, 0.72);
  const COOL_PURPLE_DEEP = new THREE.Color(0.22, 0.08, 0.18);
  const CYAN_TINT = new THREE.Color(0.38, 0.9, 1.0);
  const CYAN_DEEP = new THREE.Color(0.05, 0.16, 0.38);
  const YELLOW_TINT = new THREE.Color(1.0, 0.82, 0.28);
  const YELLOW_DEEP = new THREE.Color(0.45, 0.32, 0.05);
  const CLOUD_AMB_DEFAULT = new THREE.Color(0x664422);
  const CLOUD_AMB_RED = new THREE.Color(0x5a2418);
  const CLOUD_AMB_COOL = new THREE.Color(0x281820);
  const CLOUD_AMB_CYAN = new THREE.Color(0x081828);
  const CLOUD_AMB_YELLOW = new THREE.Color(0x4a3808);
  const CLOUD_POINT_DEFAULT = [0xff8833, 0xff4466, 0xffaa66];
  const CLOUD_POINT_RED = [0xff5522, 0xff3355, 0xff7733];
  const CLOUD_POINT_COOL = [0xd888b0, 0xf0b8d0, 0xa86898];
  const CLOUD_POINT_CYAN = [0x44ddff, 0xb8f0ff, 0x28c8f0];
  const CLOUD_POINT_YELLOW = [0xffd040, 0xffe878, 0xf0c820];
  const CLOUD_PT_DEFAULT = CLOUD_POINT_DEFAULT.map((h) => new THREE.Color(h));
  const CLOUD_PT_RED = CLOUD_POINT_RED.map((h) => new THREE.Color(h));
  const CLOUD_PT_COOL = CLOUD_POINT_COOL.map((h) => new THREE.Color(h));
  const CLOUD_PT_CYAN = CLOUD_POINT_CYAN.map((h) => new THREE.Color(h));
  const CLOUD_PT_YELLOW = CLOUD_POINT_YELLOW.map((h) => new THREE.Color(h));

  function patchCloudInsideSphere(mat, uniforms) {
    mat.fog = false;
    mat.customProgramCacheKey = () => 'cloudInsideSphere4';
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.sphereCenterWorld = uniforms.sphereCenterWorld;
      shader.uniforms.sphereRadius = uniforms.sphereRadius;
      shader.uniforms.viewport = uniforms.viewport;
      shader.uniforms.sphereScreenUv = uniforms.sphereScreenUv;
      shader.uniforms.maskRadius = uniforms.maskRadius;
      shader.uniforms.cloudTint = uniforms.cloudTint;
      shader.uniforms.cloudTintDeep = uniforms.cloudTintDeep;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvWorldPos=(modelMatrix*vec4(transformed,1.0)).xyz;'
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vWorldPos;\nuniform vec3 sphereCenterWorld;\nuniform float sphereRadius;\nuniform vec2 viewport;\nuniform vec2 sphereScreenUv;\nuniform float maskRadius;\nuniform vec3 cloudTint;\nuniform vec3 cloudTintDeep;'
        )
        .replace(
          '#include <output_fragment>',
          `float distWorld=distance(vWorldPos,sphereCenterWorld);
float inside=1.0-smoothstep(sphereRadius*0.35,sphereRadius*1.12,distWorld);
vec2 screenUv=gl_FragCoord.xy/viewport;
vec2 screenDelta=screenUv-sphereScreenUv;
screenDelta.x*=viewport.x/viewport.y;
float screenD=length(screenDelta);
float screenMask=1.0-smoothstep(maskRadius*0.88,maskRadius*1.08,screenD);
float vis=inside*screenMask;
float depthMix=smoothstep(sphereRadius*0.15,sphereRadius*0.95,distWorld);
vec3 tintCol=mix(cloudTint,cloudTintDeep,depthMix*0.65);
#include <output_fragment>
outgoingLight*=tintCol*(0.88+0.18*inside);
gl_FragColor.a*=vis*0.9;`
        );
    };
  }

  function seedCloudMotion(cloud, baseScale, scaleY) {
    const ph = Math.random() * Math.PI * 2;
    const ph2 = Math.random() * Math.PI * 2;
    cloud.userData.motion = {
      base: cloud.position.clone(),
      baseScale,
      scaleY: scaleY / baseScale,
      ph,
      ph2,
      drift: (Math.random() - 0.5) * 0.0022,
      spin: (Math.random() - 0.5) * 0.001,
      sx: 0.1 + Math.random() * 0.22,
      sy: 0.09 + Math.random() * 0.2,
      sz: 0.08 + Math.random() * 0.18,
      ax: 0.07 + Math.random() * 0.18,
      ay: 0.06 + Math.random() * 0.16,
      az: 0.05 + Math.random() * 0.14,
      stirSp: 0.12 + Math.random() * 0.28,
      sx2: 0.17 + Math.random() * 0.35,
      sy2: 0.14 + Math.random() * 0.3,
      pulseSp: 0.35 + Math.random() * 0.9,
      pulseAmp: 0.06 + Math.random() * 0.14,
      orbitSp: 0.04 + Math.random() * 0.12,
      orbitR: 0.04 + Math.random() * 0.14,
      tiltX: (Math.random() - 0.5) * 0.35,
      tiltY: (Math.random() - 0.5) * 0.35,
      opacityBase: cloud.material.opacity,
      opacityPulse: 0.015 + Math.random() * 0.035,
      stirX: 0,
      stirY: 0,
      stirZ: 0,
    };
  }

  function createCloudBackground(scene, camera, sphereGroup) {
    const cloudGroup = new THREE.Group();
    cloudGroup.userData.groupPh = Math.random() * Math.PI * 2;

    const amb = new THREE.AmbientLight(0x664422, 0.38);
    cloudGroup.add(amb);
    const pointLights = [];
    [[0.32, 0.18, 0.14], [-0.28, 0.12, -0.1], [0.05, -0.22, 0.12]].forEach(([x, y, z], i) => {
      const pl = new THREE.PointLight(CLOUD_POINT_DEFAULT[i], 0.78, 4.2, 2);
      pl.position.set(x, y, z);
      cloudGroup.add(pl);
      pointLights.push(pl);
    });

    const _ambColor = new THREE.Color();
    const _ptColor = new THREE.Color();
    const _tintTmp = new THREE.Color();
    const cloudMeshes = [];
    const _center = new THREE.Vector3();
    const _edge = new THREE.Vector3();
    const _camWorld = new THREE.Vector3();

    const uniforms = {
      sphereCenterWorld: { value: new THREE.Vector3() },
      sphereRadius: { value: 1.5 },
      viewport: { value: new THREE.Vector2(global.innerWidth, global.innerHeight) },
      sphereScreenUv: { value: new THREE.Vector2(0.5, 0.5) },
      maskRadius: { value: 0.25 },
      cloudTint: { value: ORANGE_TINT.clone() },
      cloudTintDeep: { value: ORANGE_DEEP.clone() },
    };

    function mixCloudColor(out, orange, red, purple, cyan, yellow, wO, wR, wP, wB, wY) {
      const s = Math.max(0.001, wO + wR + wP + wB + wY);
      out.setRGB(
        (orange.r * wO + red.r * wR + purple.r * wP + cyan.r * wB + yellow.r * wY) / s,
        (orange.g * wO + red.g * wR + purple.g * wP + cyan.g * wB + yellow.g * wY) / s,
        (orange.b * wO + red.b * wR + purple.b * wP + cyan.b * wB + yellow.b * wY) / s
      );
    }

    function applyCloudPalette(redMix, purpleMix, blueMix, yellowMix) {
      const r = Math.min(1, Math.max(0, redMix || 0));
      const p = Math.min(1, Math.max(0, purpleMix || 0));
      const b = Math.min(1, Math.max(0, blueMix || 0));
      const y = Math.min(1, Math.max(0, yellowMix || 0));
      const wO = Math.max(0, 1 - r - p - b - y);

      mixCloudColor(uniforms.cloudTint.value, ORANGE_TINT, RED_ORANGE_TINT, COOL_PURPLE_TINT, CYAN_TINT, YELLOW_TINT, wO, r, p, b, y);
      mixCloudColor(uniforms.cloudTintDeep.value, ORANGE_DEEP, RED_ORANGE_DEEP, COOL_PURPLE_DEEP, CYAN_DEEP, YELLOW_DEEP, wO, r, p, b, y);
      mixCloudColor(_ambColor, CLOUD_AMB_DEFAULT, CLOUD_AMB_RED, CLOUD_AMB_COOL, CLOUD_AMB_CYAN, CLOUD_AMB_YELLOW, wO, r, p, b, y);
      amb.color.copy(_ambColor);

      for (let i = 0; i < pointLights.length; i++) {
        mixCloudColor(_ptColor, CLOUD_PT_DEFAULT[i], CLOUD_PT_RED[i], CLOUD_PT_COOL[i], CLOUD_PT_CYAN[i], CLOUD_PT_YELLOW[i], wO, r, p, b, y);
        pointLights[i].color.copy(_ptColor);
      }
    }

    const loader = new THREE.TextureLoader();
    loader.load(TEXTURE_URL, (texture) => {
      texture.minFilter = THREE.LinearFilter;
      const geo = new THREE.PlaneGeometry(1, 1);
      for (let i = 0; i < 18; i++) {
        const mat = new THREE.MeshLambertMaterial({
          map: texture,
          transparent: true,
          opacity: 0.05 + Math.random() * 0.07,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: false,
        });
        patchCloudInsideSphere(mat, uniforms);
        const cloud = new THREE.Mesh(geo, mat);
        const rad = Math.pow(Math.random(), 0.42) * 0.94;
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        cloud.position.set(
          rad * Math.sin(ph) * Math.cos(th),
          rad * Math.sin(ph) * Math.sin(th),
          rad * Math.cos(ph)
        );
        const s = 1.2 + Math.random() * 2.6;
        const sy = s * (0.65 + Math.random() * 0.55);
        cloud.scale.set(s, sy, 1);
        cloud.rotation.set(
          (Math.random() - 0.5) * 0.4,
          (Math.random() - 0.5) * 0.4,
          Math.random() * Math.PI * 2
        );
        cloud.renderOrder = 5;
        seedCloudMotion(cloud, s, sy);
        cloudMeshes.push(cloud);
        cloudGroup.add(cloud);
      }
      sphereGroup.remove(cloudGroup);
      sphereGroup.add(cloudGroup);
    });

    sphereGroup.add(cloudGroup);
    applyCloudPalette(1, 0, 0);

    const stirSites = [
      { sp: 0.18, ph: 0.0, ph2: 0.5, rx: 0.9, ry: 0.55, rz: 0.7 },
      { sp: 0.16, ph: 1.4, ph2: 2.1, rx: 0.65, ry: 0.85, rz: 0.5 },
      { sp: 0.14, ph: 2.8, ph2: 0.9, rx: 0.5, ry: 0.45, rz: 0.95 },
    ];

    function applyAutoStir(c, m, t, worldRadius, groupPh) {
      const px = c.position.x;
      const py = c.position.y;
      const pz = c.position.z;
      const global = 0.78 + 0.22 * Math.sin(t * 0.14 + groupPh);
      const amp = worldRadius * 0.1 * global;

      let ix = 0;
      let iy = 0;
      let iz = 0;
      for (let s = 0; s < stirSites.length; s++) {
        const st = stirSites[s];
        const sx = worldRadius * 0.5 * st.rx * Math.sin(t * st.sp + st.ph);
        const sy = worldRadius * 0.5 * st.ry * Math.cos(t * st.sp * 0.85 + st.ph2);
        const sz = worldRadius * 0.5 * st.rz * Math.sin(t * st.sp * 1.15 + st.ph + st.ph2);
        const dx = px - sx;
        const dy = py - sy;
        const dz = pz - sz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const influence = worldRadius * 0.75;
        if (dist >= influence) continue;
        const u = 1 - dist / influence;
        const falloff = u * u * (3 - 2 * u);
        const inv = dist > 0.02 ? 1 / dist : 40;
        const push = worldRadius * 0.11 * falloff;
        const swirl = Math.sin(t * 1.8 + m.ph + dist * 2.2 + s) * falloff * 0.032 * worldRadius;
        ix += dx * inv * push - dy * inv * swirl;
        iy += dy * inv * push + dz * inv * swirl * 0.65;
        iz += dz * inv * push + dx * inv * swirl;
      }

      const curlX =
        Math.sin(t * m.stirSp + m.ph + py * 1.5) * Math.cos(t * 0.28 + pz * 1.3) * amp * 0.22;
      const curlY =
        Math.cos(t * m.stirSp * 0.9 + m.ph2 + pz * 1.4) * Math.sin(t * 0.26 + px * 1.2) * amp * 0.22;
      const curlZ =
        Math.sin(t * m.stirSp * 1.1 + m.ph * 0.8 + px * 1.6) * Math.cos(t * 0.3 + py * 1.1) * amp * 0.22;
      ix += curlX;
      iy += curlY;
      iz += curlZ;

      m.stirX = m.stirX * 0.94 + ix * 0.07;
      m.stirY = m.stirY * 0.94 + iy * 0.07;
      m.stirZ = m.stirZ * 0.94 + iz * 0.07;
      c.position.x += m.stirX;
      c.position.y += m.stirY;
      c.position.z += m.stirZ;

      const energy = Math.min(1, Math.hypot(m.stirX, m.stirY, m.stirZ) / (worldRadius * 0.14));
      if (energy > 0.12) {
        const sc = 1 + energy * 0.04;
        c.scale.x *= sc;
        c.scale.y *= sc;
        c.material.opacity = Math.min(0.34, c.material.opacity + energy * 0.025);
      }
    }

    return {
      update(sphereGroupRef, sphereScale, worldRadius, time, redMix, purpleMix, blueMix, yellowMix) {
        const t = time || 0;
        applyCloudPalette(redMix, purpleMix, blueMix, yellowMix);
        const r = Math.max(0.5, (worldRadius || 1.5) * 1.05);
        uniforms.sphereRadius.value = r;

        sphereGroupRef.getWorldPosition(uniforms.sphereCenterWorld.value);

        _center.set(0, 0, 0).applyMatrix4(sphereGroupRef.matrixWorld).project(camera);
        _edge.set(r, 0, 0).applyMatrix4(sphereGroupRef.matrixWorld).project(camera);
        uniforms.sphereScreenUv.value.set(_center.x * 0.5 + 0.5, _center.y * 0.5 + 0.5);
        const dx = (_edge.x - _center.x) * 0.5;
        const dy = (_edge.y - _center.y) * 0.5;
        uniforms.maskRadius.value = Math.sqrt(dx * dx + dy * dy) * 1.08;

        const gph = cloudGroup.userData.groupPh;
        cloudGroup.rotation.y = Math.sin(t * 0.045 + gph) * 0.05;
        cloudGroup.rotation.x = Math.sin(t * 0.035 + gph * 1.3) * 0.04;

        camera.getWorldPosition(_camWorld);

        for (let i = 0; i < cloudMeshes.length; i++) {
          const c = cloudMeshes[i];
          const m = c.userData.motion;
          if (!m) continue;

          const bx = m.base.x;
          const by = m.base.y;
          const bz = m.base.z;
          const orbit = m.orbitR * Math.sin(t * m.orbitSp + m.ph);
          c.position.set(
            bx
              + Math.sin(t * m.sx + m.ph) * m.ax
              + Math.cos(t * m.sx2 + m.ph2) * m.ax * 0.55
              + orbit * Math.cos(m.ph2),
            by
              + Math.sin(t * m.sy + m.ph2) * m.ay
              + Math.cos(t * m.sy2 + m.ph) * m.ay * 0.5
              + orbit * Math.sin(m.ph),
            bz
              + Math.sin(t * m.sz + m.ph * 1.1) * m.az
              + Math.sin(t * m.sz * 0.7 + m.ph2) * m.az * 0.45
          );

          const pulse = 1 + Math.sin(t * m.pulseSp + m.ph) * m.pulseAmp;
          const pulse2 = 1 + Math.sin(t * m.pulseSp * 1.37 + m.ph2) * m.pulseAmp * 0.45;
          const sc = m.baseScale * pulse;
          c.scale.set(sc * pulse2, sc * m.scaleY * pulse, 1);

          c.lookAt(_camWorld);
          c.rotateZ(m.drift);
          c.rotation.x += m.tiltX * 0.002 + m.spin * 0.35;
          c.rotation.y += m.tiltY * 0.002;

          const op = m.opacityBase + Math.sin(t * m.pulseSp * 0.9 + m.ph2) * m.opacityPulse;
          c.material.opacity = Math.max(0.04, op);

          applyAutoStir(c, m, t, r, gph);
        }
      },
      onResize(w, h) {
        uniforms.viewport.value.set(w, h);
      },
      setVisible(v) {
        cloudGroup.visible = v !== false;
      },
      get visible() {
        return cloudGroup.visible;
      },
    };
  }

  global.createCloudBackground = createCloudBackground;
})(window);
