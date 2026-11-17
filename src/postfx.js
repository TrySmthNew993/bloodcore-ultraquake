/**
 * BLOODCORE // ULTRAQUAKE
 * WebGL Post-Processing Pipeline:
 * - HDR Emissive Bloom & Highlight Halation (glowing enemy cores, coins, lasers, lava)
 * - Configurable PS1/PS2 Bayer Dithering & Color Quantization
 * - High-Speed Dash/Slide Chromatic Fringe & ACES Filmic Contrast
 */
window.Bloodcore = window.Bloodcore || {};

(function (B) {
  'use strict';

  B.PostFXPipeline = function (renderer) {
    this.renderer = renderer;
    this.enabled = true;
    this.ps1Mode = true;
    this.rt = null;

    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.texelSize = new THREE.Vector2(1 / 1280, 1 / 720);

    var supportsFloat = renderer.capabilities.isWebGL2 &&
      !!(renderer.extensions && renderer.extensions.get('EXT_color_buffer_float'));
    this.rtType = supportsFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.rtSamples = renderer.capabilities.isWebGL2 ? 4 : 0;

    this.material = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDiffuse: { value: null },
        uTexelSize: { value: this.texelSize },
        uBloomStrength: { value: 0.44 },
        uPS1Crunch: { value: 0.35 },
        uSpeedFactor: { value: 0.0 }
      },
      vertexShader: [
        'varying vec2 vUv;',
        'void main() {',
        '  vUv = uv;',
        '  gl_Position = vec4(position.xy, 0.0, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'precision highp float;',
        'uniform sampler2D tDiffuse;',
        'uniform vec2 uTexelSize;',
        'uniform float uBloomStrength;',
        'uniform float uPS1Crunch;',
        'uniform float uSpeedFactor;',
        'varying vec2 vUv;',
        '',
        'vec3 brightPass(vec3 c) {',
        '  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));',
        '  float knee = smoothstep(0.52, 1.15, luma);',
        '  return c * knee;',
        '}',
        '',
        'vec3 acesToneMap(vec3 x) {',
        '  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);',
        '}',
        '',
        'void main() {',
        '  vec2 centered = vUv - 0.5;',
        '  float r2 = dot(centered, centered);',
        '  vec2 caOffset = centered * (0.0018 + uSpeedFactor * 0.0045) * r2;',
        '  float cr = texture2D(tDiffuse, vUv + caOffset).r;',
        '  vec3 center = texture2D(tDiffuse, vUv).rgb;',
        '  float cb = texture2D(tDiffuse, vUv - caOffset).b;',
        '  vec3 col = vec3(cr, center.g, cb);',
        '',
        '  // 8-tap Dual-Ring Emissive Halation Bloom',
        '  vec2 b1 = uTexelSize * 3.2;',
        '  vec2 b2 = uTexelSize * 7.5;',
        '  vec3 bloom = vec3(0.0);',
        '  bloom += brightPass(texture2D(tDiffuse, vUv + vec2( b1.x,  b1.y)).rgb);',
        '  bloom += brightPass(texture2D(tDiffuse, vUv + vec2(-b1.x,  b1.y)).rgb);',
        '  bloom += brightPass(texture2D(tDiffuse, vUv + vec2( b1.x, -b1.y)).rgb);',
        '  bloom += brightPass(texture2D(tDiffuse, vUv + vec2(-b1.x, -b1.y)).rgb);',
        '  bloom += brightPass(texture2D(tDiffuse, vUv + vec2( b2.x,  0.0)).rgb) * 0.75;',
        '  bloom += brightPass(texture2D(tDiffuse, vUv + vec2(-b2.x,  0.0)).rgb) * 0.75;',
        '  bloom += brightPass(texture2D(tDiffuse, vUv + vec2( 0.0,  b2.y)).rgb) * 0.75;',
        '  bloom += brightPass(texture2D(tDiffuse, vUv + vec2( 0.0, -b2.y)).rgb) * 0.75;',
        '  bloom *= (1.0 / 7.0);',
        '  col += bloom * uBloomStrength;',
        '',
        '  col = acesToneMap(col * 1.12);',
        '',
        '  // Subtle PS1/PS2 16-bit Dither & Color Quantization',
        '  if (uPS1Crunch > 0.01) {',
        '    vec2 pix = floor(gl_FragCoord.xy * 0.5);',
        '    float dither = (mod(pix.x + pix.y, 2.0) - 0.5) * (1.0 / 36.0) * uPS1Crunch;',
        '    vec3 quant = floor((col + dither) * 32.0 + 0.5) / 32.0;',
        '    col = mix(col, quant, uPS1Crunch * 0.65);',
        '  }',
        '',
        '  // Peripheral Speed & Combat Vignette',
        '  col *= (1.0 - r2 * (0.24 + uSpeedFactor * 0.18));',
        '  col = pow(max(col, 0.0), vec3(1.0 / 2.2));',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    });

    var quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quadScene.add(quad);
  };

  B.PostFXPipeline.prototype.resize = function (width, height, pixelRatio) {
    var w = Math.max(1, Math.floor(width * pixelRatio));
    var h = Math.max(1, Math.floor(height * pixelRatio));
    this.texelSize.set(1 / w, 1 / h);

    if (!this.rt) {
      var opts = {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: this.rtType,
        depthBuffer: true
      };
      if (this.rtSamples > 0 && THREE.WebGLRenderTarget) {
        opts.samples = this.rtSamples;
      }
      this.rt = new THREE.WebGLRenderTarget(w, h, opts);
    } else {
      this.rt.setSize(w, h);
    }
  };

  B.PostFXPipeline.prototype.render = function (scene, camera, speedFactor) {
    if (!this.enabled) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(scene, camera);
      return;
    }
    if (!this.rt) {
      var sz = this.renderer.getSize(new THREE.Vector2());
      this.resize(sz.x, sz.y, this.renderer.getPixelRatio());
    }
    this.material.uniforms.uSpeedFactor.value = speedFactor || 0;
    this.material.uniforms.uPS1Crunch.value = this.ps1Mode ? 0.38 : 0.0;

    this.renderer.setRenderTarget(this.rt);
    this.renderer.clear();
    this.renderer.render(scene, camera);

    this.material.uniforms.tDiffuse.value = this.rt.texture;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCam);
  };

})(window.Bloodcore);
