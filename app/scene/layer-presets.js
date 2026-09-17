/**
 * Returns the authored defaults used to construct particle layers.
 *
 * Keeping visual configuration separate from browser startup makes the values
 * easy to review without reading renderer and control wiring. A factory is used
 * because the derived tint overrides rely on the application's Three.js build.
 */
export function createLayerPresetConfiguration(THREE){
  const innerBaseColor=[0.95,0.35,0.28];
  const innerLayerPresets=[
    {
      color:innerBaseColor,
      count:1000,
      scale:0.30,
      coreBias:2.4,
      pointSize:5.0,
      glow:7.5,
      brightness:0.95,
      flowAmp:0.10,
    },
    {
      color:innerBaseColor,
      count:1000,
      scale:0.46,
      coreBias:1.4,
      pointSize:3.5,
      glow:6.5,
      brightness:0.70,
      flowAmp:0.20,
      diffSwirl:0.9,
    },
    {
      color:innerBaseColor,
      count:1000,
      scale:0.60,
      coreBias:0.9,
      pointSize:6.0,
      glow:8.0,
      brightness:0.50,
      flowAmp:0.26,
      flowFreq:2.8,
    },
    {
      color:innerBaseColor,
      count:1000,
      scale:0.72,
      coreBias:1.0,
      pointSize:2.5,
      glow:5.5,
      brightness:0.42,
      jitter:0.07,
      jitterSpeed:1.0,
    },
    {
      color:innerBaseColor,
      count:1000,
      scale:0.88,
      coreBias:0.7,
      pointSize:8.0,
      glow:8.5,
      brightness:0.30,
      breathAmp:0.09,
      breathSpeed:0.5,
    },
  ];

  const fireflyEmotionColors={
    red:0xff3b30,
    purple:0xa070ff,
    yellow:0xffc24a,
    blue:0x5599ee,
  };
  const fireflyLayerPresets=[
    // Main body: strictly the selected emotion color.
    {count:120,intensity:3.0,size:1.0,hot:0,spin:0.025,orbit:0.5},
    // Hot accents: brighter and larger, but still visibly tinted.
    {count:40,intensity:4.5,size:1.5,blinkSpeed:1.4,radius:1.3,hot:0.5,spin:-0.04,orbit:0.7},
    // Sparse outer dust with independent motion.
    {count:220,intensity:1.6,size:0.45,radius:1.9,wander:1.4,hot:0,spin:0.015,orbit:0.4},
  ];

  const tintTowardWhite=fraction=>{
    const color=new THREE.Color();
    const white=new THREE.Color(0xffffff);
    return Object.fromEntries(Object.entries(fireflyEmotionColors).map(([name,value])=>{
      color.set(value).lerp(white,fraction);
      return [name,'#'+color.getHexString()];
    }));
  };
  const fireflyLayerOverrides=[
    {},
    tintTowardWhite(0.55),
    tintTowardWhite(0.28),
  ];

  return {
    innerLayerPresets,
    fireflyEmotionColors,
    fireflyLayerPresets,
    fireflyLayerOverrides,
  };
}
