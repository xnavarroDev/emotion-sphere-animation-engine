/**
 * Allocate and reuse the offscreen WebGL/readback canvases used by thumbnail
 * capture. Keeping these resources together prevents mismatched buffer sizes
 * and guarantees the old GPU target is disposed whenever dimensions change.
 */
export function createThumbnailRenderSurface({ THREE, documentLike, outputWidth }) {
  let current = null;

  function ensure(sourceWidth, sourceHeight, outputHeight) {
    if (
      current
      && current.sourceWidth === sourceWidth
      && current.sourceHeight === sourceHeight
      && current.outputHeight === outputHeight
    ) return current;

    current?.target.dispose();
    const target = new THREE.WebGLRenderTarget(sourceWidth, sourceHeight);
    const pixelBuffer = new Uint8Array(sourceWidth * sourceHeight * 4);

    // The source canvas receives vertically flipped WebGL pixels. The output
    // canvas then crops and downsamples that image into the cached frame.
    const sourceCanvas = documentLike.createElement('canvas');
    sourceCanvas.width = sourceWidth;
    sourceCanvas.height = sourceHeight;
    const sourceContext = sourceCanvas.getContext('2d');
    const imageData = sourceContext.createImageData(sourceWidth, sourceHeight);

    const outputCanvas = documentLike.createElement('canvas');
    outputCanvas.width = outputWidth;
    outputCanvas.height = outputHeight;
    const outputContext = outputCanvas.getContext('2d');
    outputContext.imageSmoothingEnabled = true;
    outputContext.imageSmoothingQuality = 'high';

    current = {
      imageData,
      outputCanvas,
      outputContext,
      outputHeight,
      pixelBuffer,
      sourceCanvas,
      sourceContext,
      sourceHeight,
      sourceWidth,
      target,
    };
    return current;
  }

  return {
    ensure,
    dispose() {
      current?.target.dispose();
      current = null;
    },
  };
}

/**
 * Plan a centered, aspect-preserving thumbnail crop. Rendering larger than
 * the final frame lets particle cores and halos resolve before downsampling;
 * cropping both axes by the same subject fraction avoids visual distortion.
 */
export function planThumbnailCaptureSurface({
  liveWidth,
  liveHeight,
  outputWidth,
  outputAspect,
  subjectFraction,
  supersampling,
}) {
  const outputHeight = Math.max(1, Math.round(outputWidth / outputAspect));
  const cropWidth = outputWidth * supersampling;
  const cropHeight = outputHeight * supersampling;
  const sourceHeight = Math.max(cropHeight, Math.round(cropHeight / subjectFraction));
  const sourceWidth = Math.max(cropWidth, Math.round(sourceHeight * liveWidth / liveHeight));
  return {
    cropHeight,
    cropWidth,
    cropX: Math.round((sourceWidth - cropWidth) / 2),
    cropY: Math.round((sourceHeight - cropHeight) / 2),
    outputHeight,
    pointScale: sourceWidth / liveWidth,
    sourceHeight,
    sourceWidth,
  };
}
