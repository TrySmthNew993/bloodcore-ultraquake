/**
 * BLOODCORE // ULTRAQUAKE
 * PS1 / PS2 Procedural Pixel Texture & Dynamic-Lit Material Generator
 * Generates crisp 64x64 and 128x128 NearestFilter textures with Bayer dithering
 * and matching pixel bump maps so dynamic point lights catch every pixel rivet & brick.
 */
window.Bloodcore = window.Bloodcore || {};

(function (B) {
  'use strict';

  var BAYER_4X4 = [
    [ 0,  8,  2, 10],
    [12,  4, 14,  6],
    [ 3, 11,  1,  9],
    [15,  7, 13,  5]
  ];

  function hash2D(x, y, seed) {
    var n = Math.sin(x * 127.1 + y * 311.7 + (seed || 0) * 74.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function clampByte(v) {
    return v < 0 ? 0 : (v > 255 ? 255 : (v | 0));
  }

  function createPS1CanvasTexture(size, drawFn, repeatX, repeatY) {
    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');
    var img = ctx.createImageData(size, size);
    var bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    var bumpCtx = bumpCanvas.getContext('2d');
    var bumpImg = bumpCtx.createImageData(size, size);

    drawFn(img.data, bumpImg.data, size);

    ctx.putImageData(img, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);

    var tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX || 1, repeatY || 1);
    tex.needsUpdate = true;

    var bumpTex = new THREE.CanvasTexture(bumpCanvas);
    bumpTex.magFilter = THREE.NearestFilter;
    bumpTex.minFilter = THREE.NearestFilter;
    bumpTex.wrapS = THREE.RepeatWrapping;
    bumpTex.wrapT = THREE.RepeatWrapping;
    bumpTex.repeat.set(repeatX || 1, repeatY || 1);
    bumpTex.needsUpdate = true;

    return { map: tex, bumpMap: bumpTex, canvas: canvas, bumpCanvas: bumpCanvas };
  }

  function setPixel(data, bumpData, size, x, y, r, g, b, heightVal) {
    var idx = (y * size + x) * 4;
    var bayer = (BAYER_4X4[y & 3][x & 3] - 7.5) * 1.45;
    // Quantize to 5-bit per channel (PS1 15-bit RGB feel)
    var qr = clampByte(Math.round((r + bayer) / 8) * 8);
    var qg = clampByte(Math.round((g + bayer) / 8) * 8);
    var qb = clampByte(Math.round((b + bayer) / 8) * 8);
    data[idx] = qr;
    data[idx + 1] = qg;
    data[idx + 2] = qb;
    data[idx + 3] = 255;

    var h = clampByte(heightVal === undefined ? 128 : heightVal);
    bumpData[idx] = h;
    bumpData[idx + 1] = h;
    bumpData[idx + 2] = h;
    bumpData[idx + 3] = 255;
  }

  B.TextureLibrary = {
    cache: {},
    materials: {},

    init: function () {
      if (this.initialized) return;
      this.initialized = true;

      // 1. Riveted Rusted Metal Wall (PS1 Quake / ULTRAKILL Industrial)
      this.cache.rustMetal = createPS1CanvasTexture(64, function (d, bd, s) {
        for (var y = 0; y < s; y++) {
          for (var x = 0; x < s; x++) {
            var n = hash2D(x, y, 11);
            var rust = Math.sin(x * 0.19 + y * 0.13) * 0.5 + 0.5;
            var r = 68 + rust * 42 + n * 18;
            var g = 46 + rust * 14 + n * 12;
            var b = 42 + n * 10;
            var h = 128 + n * 24;

            // Panel seams
            var bx = x % 32, by = y % 32;
            if (bx === 0 || by === 0) {
              r *= 0.42; g *= 0.42; b *= 0.42; h = 35;
            } else if (bx === 1 || by === 1) {
              r *= 1.25; g *= 1.22; b *= 1.18; h = 195;
            }

            // Corner rivets
            if ((bx === 4 || bx === 27) && (by === 4 || by === 27)) {
              r = 145; g = 115; b = 95; h = 235;
            }
            // Vertical grime streaks
            var streak = hash2D(x, 0, 99);
            if (streak > 0.65 && y > 8) {
              r -= 16; g -= 14; b -= 12;
            }
            setPixel(d, bd, s, x, y, r, g, b, h);
          }
        }
      }, 1, 1);

      // 2. Brutalist Blood-Stained Concrete
      this.cache.bloodConcrete = createPS1CanvasTexture(64, function (d, bd, s) {
        for (var y = 0; y < s; y++) {
          for (var x = 0; x < s; x++) {
            var n = hash2D(x, y, 23);
            var coarse = hash2D(x >> 1, y >> 1, 29);
            var r = 74 + coarse * 22 + n * 14;
            var g = 68 + coarse * 20 + n * 14;
            var b = 72 + coarse * 22 + n * 14;
            var h = 120 + coarse * 45 + n * 20;

            // Horizontal formwork lines
            if (y % 16 === 0) {
              r *= 0.55; g *= 0.55; b *= 0.55; h = 50;
            }
            // Dried crimson splatter
            var splatter = Math.sin(x * 0.14) * Math.cos(y * 0.17) + coarse * 0.55;
            if (splatter > 0.78) {
              r = 105 + n * 25;
              g = 22 + n * 8;
              b = 26 + n * 8;
              h = 100;
            }
            setPixel(d, bd, s, x, y, r, g, b, h);
          }
        }
      }, 1, 1);

      // 3. Gothic Cathedral Stonework
      this.cache.gothicStone = createPS1CanvasTexture(64, function (d, bd, s) {
        for (var y = 0; y < s; y++) {
          var row = (y / 16) | 0;
          var offset = (row & 1) * 16;
          for (var x = 0; x < s; x++) {
            var bx = (x + offset) % 32;
            var by = y % 16;
            var brickSeed = row * 7 + (((x + offset) / 32) | 0) * 13;
            var brickTint = hash2D(brickSeed, row, 41) * 24 - 12;
            var n = hash2D(x, y, 43);

            var r = 56 + brickTint + n * 16;
            var g = 58 + brickTint + n * 16;
            var b = 76 + brickTint + n * 20;
            var h = 140 + n * 35;

            if (bx === 0 || by === 0) {
              r = 22; g = 24; b = 34; h = 30;
            } else if (bx === 1 || by === 1) {
              r += 22; g += 22; b += 28; h = 200;
            } else if (bx === 31 || by === 15) {
              r -= 18; g -= 18; b -= 18; h = 80;
            }
            setPixel(d, bd, s, x, y, r, g, b, h);
          }
        }
      }, 1, 1);

      // 4. Heavy Riveted Iron Pillars & Bulkheads
      this.cache.rivetIron = createPS1CanvasTexture(64, function (d, bd, s) {
        for (var y = 0; y < s; y++) {
          for (var x = 0; x < s; x++) {
            var n = hash2D(x, y, 53);
            var r = 52 + n * 16;
            var g = 58 + n * 18;
            var b = 66 + n * 20;
            var h = 130 + n * 20;

            // Ribbed vertical grooves
            if (x % 8 === 0) {
              r *= 0.5; g *= 0.5; b *= 0.5; h = 45;
            } else if (x % 8 === 1) {
              r *= 1.3; g *= 1.3; b *= 1.3; h = 210;
            }
            if (y % 16 === 0) {
              r *= 0.45; g *= 0.45; b *= 0.45; h = 40;
            }
            if ((x % 8 === 4) && (y % 16 === 4 || y % 16 === 12)) {
              r = 120; g = 130; b = 142; h = 240;
            }
            setPixel(d, bd, s, x, y, r, g, b, h);
          }
        }
      }, 1, 1);

      // 5. Industrial Grate Floor
      this.cache.grateFloor = createPS1CanvasTexture(64, function (d, bd, s) {
        for (var y = 0; y < s; y++) {
          for (var x = 0; x < s; x++) {
            var n = hash2D(x, y, 61);
            var gx = x % 8, gy = y % 8;
            var isBar = (gx < 2 || gy < 2);
            var Frame = (x < 2 || y < 2 || x === 31 || y === 31);
            var r, g, b, h;
            if (Frame) {
              r = 86 + n * 16; g = 74 + n * 14; b = 68 + n * 12; h = 210;
            } else if (isBar) {
              r = 66 + n * 15; g = 64 + n * 15; b = 68 + n * 15; h = 165;
            } else {
              // Dark sub-floor cavity with faint warm glow
              r = 24 + n * 8; g = 14 + n * 6; b = 14 + n * 6; h = 20;
            }
            setPixel(d, bd, s, x, y, r, g, b, h);
          }
        }
      }, 1, 1);

      // 6. Dark Checkered / Beveled Arena Floor Tile
      this.cache.darkTile = createPS1CanvasTexture(64, function (d, bd, s) {
        for (var y = 0; y < s; y++) {
          for (var x = 0; x < s; x++) {
            var n = hash2D(x, y, 71);
            var tx = (x / 32) | 0;
            var ty = (y / 32) | 0;
            var alt = (tx ^ ty) & 1;
            var base = alt ? 58 : 44;
            var r = base + n * 14;
            var g = base - 4 + n * 12;
            var b = base + 2 + n * 14;
            var h = 135 + n * 25;

            var lx = x % 32, ly = y % 32;
            if (lx === 0 || ly === 0) {
              r = 20; g = 18; b = 22; h = 30;
            } else if (lx === 1 || ly === 1) {
              r += 20; g += 18; b += 22; h = 195;
            }
            setPixel(d, bd, s, x, y, r, g, b, h);
          }
        }
      }, 1, 1);

      // 7. Gothic Stone Floor Tile
      this.cache.stoneTile = createPS1CanvasTexture(64, function (d, bd, s) {
        for (var y = 0; y < s; y++) {
          for (var x = 0; x < s; x++) {
            var n = hash2D(x, y, 79);
            var lx = x % 32, ly = y % 32;
            var diag = Math.abs(lx - 16) + Math.abs(ly - 16);
            var r = 50 + n * 16;
            var g = 52 + n * 16;
            var b = 66 + n * 18;
            var h = 135 + n * 25;

            if (diag === 12) {
              r = 95; g = 86; b = 60; h = 190;
            }
            if (lx === 0 || ly === 0) {
              r = 22; g = 22; b = 30; h = 30;
            }
            setPixel(d, bd, s, x, y, r, g, b, h);
          }
        }
      }, 1, 1);

      // 8. Gold & Obsidian Sanctum Texture (Level 5 Throne)
      this.cache.goldObsidian = createPS1CanvasTexture(64, function (d, bd, s) {
        for (var y = 0; y < s; y++) {
          for (var x = 0; x < s; x++) {
            var n = hash2D(x, y, 83);
            var lx = x % 32, ly = y % 32;
            var isGoldTrim = (lx < 3 || lx > 29 || ly < 3 || ly > 29 || (Math.abs(lx - 16) < 2 && ly > 6 && ly < 26));
            var r, g, b, h;
            if (isGoldTrim) {
              r = 185 + n * 35; g = 138 + n * 28; b = 42 + n * 15; h = 220;
            } else {
              r = 34 + n * 12; g = 26 + n * 10; b = 38 + n * 14; h = 110 + n * 20;
            }
            setPixel(d, bd, s, x, y, r, g, b, h);
          }
        }
      }, 1, 1);

      // 9. Hazard Chevron Stripes
      this.cache.hazardStripe = createPS1CanvasTexture(64, function (d, bd, s) {
        for (var y = 0; y < s; y++) {
          for (var x = 0; x < s; x++) {
            var n = hash2D(x, y, 89);
            var stripe = ((x + y) >> 3) & 1;
            var r = stripe ? (210 + n * 20) : (32 + n * 10);
            var g = stripe ? (155 + n * 18) : (28 + n * 10);
            var b = stripe ? (20 + n * 10)  : (28 + n * 10);
            var h = stripe ? 175 : 95;
            if (y < 3 || y > 60) {
              r = 90; g = 85; b = 80; h = 210;
            }
            setPixel(d, bd, s, x, y, r, g, b, h);
          }
        }
      }, 1, 1);

      // 10. Glowing Neon / Cyber Circuit Trim
      this.cache.neonTrim = createPS1CanvasTexture(64, function (d, bd, s) {
        for (var y = 0; y < s; y++) {
          for (var x = 0; x < s; x++) {
            var n = hash2D(x, y, 97);
            var glow = (y > 24 && y < 40) || (x % 16 < 3 && y > 16 && y < 48);
            var r = glow ? 165 : (38 + n * 10);
            var g = glow ? 120 : (40 + n * 10);
            var b = glow ? 250 : (62 + n * 12);
            var h = glow ? 230 : 100;
            setPixel(d, bd, s, x, y, r, g, b, h);
          }
        }
      }, 1, 1);

      // 11. Acid Conduit Trim
      this.cache.acidTrim = createPS1CanvasTexture(64, function (d, bd, s) {
        for (var y = 0; y < s; y++) {
          for (var x = 0; x < s; x++) {
            var n = hash2D(x, y, 101);
            var glow = (y > 24 && y < 40);
            var r = glow ? 40 : (36 + n * 10);
            var g = glow ? 235 : (52 + n * 10);
            var b = glow ? 165 : (48 + n * 10);
            var h = glow ? 220 : 100;
            setPixel(d, bd, s, x, y, r, g, b, h);
          }
        }
      }, 1, 1);

      // 12. Gold Sanctum Trim
      this.cache.goldTrim = createPS1CanvasTexture(64, function (d, bd, s) {
        for (var y = 0; y < s; y++) {
          for (var x = 0; x < s; x++) {
            var n = hash2D(x, y, 103);
            var ornate = (y > 18 && y < 46 && ((x + y) % 8 < 4));
            var r = ornate ? 245 : (65 + n * 12);
            var g = ornate ? 190 : (45 + n * 10);
            var b = ornate ? 65  : (28 + n * 10);
            var h = ornate ? 235 : 105;
            setPixel(d, bd, s, x, y, r, g, b, h);
          }
        }
      }, 1, 1);

      // 13. Molten Lava / Blood Hazard Surface
      this.cache.lava = createPS1CanvasTexture(64, function (d, bd, s) {
        for (var y = 0; y < s; y++) {
          for (var x = 0; x < s; x++) {
            var n = hash2D(x, y, 109);
            var wave = Math.sin(x * 0.22 + Math.cos(y * 0.2) * 2.5) * Math.cos(y * 0.22) * 0.5 + 0.5;
            var r = 180 + wave * 75;
            var g = 35 + wave * 145 + n * 20;
            var b = 12 + wave * 30;
            setPixel(d, bd, s, x, y, r, g, b, 128 + wave * 90);
          }
        }
      }, 2, 2);

      // 14. Toxic Cyber-Acid Surface
      this.cache.acid = createPS1CanvasTexture(64, function (d, bd, s) {
        for (var y = 0; y < s; y++) {
          for (var x = 0; x < s; x++) {
            var n = hash2D(x, y, 113);
            var wave = Math.sin(x * 0.24) * Math.cos(y * 0.24) * 0.5 + 0.5;
            var r = 20 + wave * 60;
            var g = 165 + wave * 88;
            var b = 95 + wave * 90 + n * 20;
            setPixel(d, bd, s, x, y, r, g, b, 128 + wave * 80);
          }
        }
      }, 2, 2);

      // 15. Enemy Flesh & Cyber Armor Textures
      this.cache.enemyArmor = createPS1CanvasTexture(32, function (d, bd, s) {
        for (var y = 0; y < s; y++) {
          for (var x = 0; x < s; x++) {
            var n = hash2D(x, y, 131);
            var edge = (x === 0 || y === 0 || x === s - 1 || y === s - 1 || x === 16 || y === 16);
            var v = edge ? 110 : (185 + n * 45);
            setPixel(d, bd, s, x, y, v, v, v, edge ? 60 : 185);
          }
        }
      }, 1, 1);
    },

    // Creates a tiled world material with crisp PS1 nearest-neighbor filtering & bump relief
    getWorldMaterial: function (texName, repeatX, repeatY, opts) {
      this.init();
      opts = opts || {};
      var base = this.cache[texName] || this.cache.rustMetal;

      var map = base.map.clone();
      map.magFilter = THREE.NearestFilter;
      map.minFilter = THREE.NearestFilter;
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(repeatX || 1, repeatY || 1);
      map.needsUpdate = true;

      var bump = base.bumpMap.clone();
      bump.magFilter = THREE.NearestFilter;
      bump.minFilter = THREE.NearestFilter;
      bump.wrapS = THREE.RepeatWrapping;
      bump.wrapT = THREE.RepeatWrapping;
      bump.repeat.set(repeatX || 1, repeatY || 1);
      bump.needsUpdate = true;

      return new THREE.MeshStandardMaterial({
        map: map,
        bumpMap: bump,
        bumpScale: opts.bumpScale !== undefined ? opts.bumpScale : 0.14,
        roughness: opts.roughness !== undefined ? opts.roughness : 0.62,
        metalness: opts.metalness !== undefined ? opts.metalness : 0.28,
        color: opts.color !== undefined ? opts.color : 0xffffff,
        emissive: opts.emissive !== undefined ? opts.emissive : 0x000000,
        emissiveIntensity: opts.emissiveIntensity || 0
      });
    },

    getEnemyMaterial: function (colorHex, opts) {
      this.init();
      opts = opts || {};
      return new THREE.MeshStandardMaterial({
        map: this.cache.enemyArmor.map,
        bumpMap: this.cache.enemyArmor.bumpMap,
        bumpScale: 0.08,
        color: colorHex,
        roughness: opts.roughness !== undefined ? opts.roughness : 0.45,
        metalness: opts.metalness !== undefined ? opts.metalness : 0.45,
        emissive: opts.emissive !== undefined ? opts.emissive : 0x000000,
        emissiveIntensity: opts.emissiveIntensity || 0,
        flatShading: true
      });
    }
  };

})(window.Bloodcore);
