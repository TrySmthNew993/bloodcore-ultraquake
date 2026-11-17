/**
 * BLOODCORE // ULTRAQUAKE
 * Articulated Low-Poly 3D Model Builder (6 Enemy Archetypes + 4 Viewmodel Guns + Feedbacker Arm)
 * Every model is constructed from faceted low-poly geometry with PS1/PS2 textures,
 * articulated limb pivots for procedural animation, and glowing emissive accents.
 */
window.Bloodcore = window.Bloodcore || {};

(function (B) {
  'use strict';

  function makeBox(w, h, d, mat, x, y, z, rx, ry, rz) {
    var geo = new THREE.BoxGeometry(w, h, d);
    var m = new THREE.Mesh(geo, mat);
    if (x || y || z) m.position.set(x || 0, y || 0, z || 0);
    if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  function makeCyl(rt, rb, h, segs, mat, x, y, z, rx, ry, rz) {
    var geo = new THREE.CylinderGeometry(rt, rb, h, segs || 6);
    var m = new THREE.Mesh(geo, mat);
    if (x || y || z) m.position.set(x || 0, y || 0, z || 0);
    if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
    m.castShadow = true;
    return m;
  }

  function makeOcta(r, mat, x, y, z) {
    var geo = new THREE.OctahedronGeometry(r, 0);
    var m = new THREE.Mesh(geo, mat);
    if (x || y || z) m.position.set(x || 0, y || 0, z || 0);
    return m;
  }

  B.Models = {

    // ==================== ENEMY 3D MESH BUILDER ====================
    createEnemyMesh: function (type) {
      var T = B.TextureLibrary;
      var root = new THREE.Group();
      var parts = {
        root: root,
        torso: new THREE.Group(),
        head: new THREE.Group(),
        leftArm: new THREE.Group(),
        rightArm: new THREE.Group(),
        leftLeg: new THREE.Group(),
        rightLeg: new THREE.Group(),
        wings: null,
        orbMesh: null,
        eyeMat: null
      };

      if (type === 'husk') {
        this._buildHusk(parts, T);
      } else if (type === 'soldier') {
        this._buildSoldier(parts, T);
      } else if (type === 'drone') {
        this._buildDrone(parts, T);
      } else if (type === 'juggernaut') {
        this._buildJuggernaut(parts, T);
      } else if (type === 'sentry') {
        this._buildSentry(parts, T);
      } else if (type === 'boss') {
        this._buildBoss(parts, T);
      }

      return parts;
    },

    // 1. FILTH HUSK: Gaunt crimson-and-bone melee runner with spine spikes & scythe claws
    _buildHusk: function (p, T) {
      var fleshMat = T.getEnemyMaterial(0xb91c1c, { roughness: 0.55, metalness: 0.2 });
      var boneMat = T.getEnemyMaterial(0xd6d3d1, { roughness: 0.4, metalness: 0.3 });
      var eyeMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
      p.eyeMat = eyeMat;

      p.torso.position.set(0, 1.05, 0);
      p.torso.rotation.x = 0.22; // hunched predatory posture
      p.root.add(p.torso);

      // Ribcage & Abdomen
      p.torso.add(makeBox(0.62, 0.52, 0.36, fleshMat, 0, 0.18, 0));
      p.torso.add(makeBox(0.42, 0.38, 0.28, fleshMat, 0, -0.22, 0.04));
      // Bone ribs & dorsal spine spikes
      for (var i = 0; i < 3; i++) {
        p.torso.add(makeBox(0.68, 0.07, 0.40, boneMat, 0, 0.04 + i * 0.14, 0.02));
        p.torso.add(makeCyl(0.01, 0.06, 0.22, 4, boneMat, 0, 0.02 + i * 0.16, -0.24, -0.7, 0, 0));
      }

      // Head & Weakpoint
      p.head.position.set(0, 0.55, 0.14);
      p.torso.add(p.head);
      var skull = makeBox(0.38, 0.42, 0.44, boneMat, 0, 0.06, 0);
      skull.userData.isWeakpoint = true;
      p.head.add(skull);
      p.head.add(makeBox(0.28, 0.14, 0.34, fleshMat, 0, -0.14, 0.08)); // jaw
      p.head.add(makeBox(0.11, 0.08, 0.06, eyeMat, -0.1, 0.08, 0.21));
      p.head.add(makeBox(0.11, 0.08, 0.06, eyeMat, 0.1, 0.08, 0.21));
      // Horns
      p.head.add(makeCyl(0.01, 0.06, 0.26, 4, boneMat, -0.15, 0.28, -0.05, -0.3, 0, 0.3));
      p.head.add(makeCyl(0.01, 0.06, 0.26, 4, boneMat, 0.15, 0.28, -0.05, -0.3, 0, -0.3));

      // Arms with Scythe Claws
      p.leftArm.position.set(-0.42, 0.34, 0.05);
      p.rightArm.position.set(0.42, 0.34, 0.05);
      p.torso.add(p.leftArm);
      p.torso.add(p.rightArm);

      [-1, 1].forEach(function (side) {
        var arm = side < 0 ? p.leftArm : p.rightArm;
        arm.add(makeBox(0.16, 0.44, 0.16, fleshMat, 0, -0.18, 0));
        arm.add(makeBox(0.14, 0.42, 0.14, boneMat, 0, -0.52, 0.12, -0.4, 0, 0));
        // Twin Scythe Claws
        arm.add(makeCyl(0.01, 0.05, 0.38, 4, boneMat, -0.04, -0.78, 0.28, 1.1, 0, 0));
        arm.add(makeCyl(0.01, 0.05, 0.38, 4, boneMat, 0.04, -0.78, 0.28, 1.1, 0, 0));
      });

      // Legs
      p.leftLeg.position.set(-0.18, 0.78, 0);
      p.rightLeg.position.set(0.18, 0.78, 0);
      p.root.add(p.leftLeg);
      p.root.add(p.rightLeg);
      [-1, 1].forEach(function (side) {
        var leg = side < 0 ? p.leftLeg : p.rightLeg;
        leg.add(makeBox(0.20, 0.44, 0.20, fleshMat, 0, -0.22, 0));
        leg.add(makeBox(0.16, 0.44, 0.18, boneMat, 0, -0.58, -0.04));
      });
    },

    // 2. STRAY SOLDIER: Cybernetic skeletal trooper with plasma cannon arm & amber visor
    _buildSoldier: function (p, T) {
      var armorMat = T.getEnemyMaterial(0xb45309, { roughness: 0.38, metalness: 0.65 });
      var darkSteel = T.getEnemyMaterial(0x27272a, { roughness: 0.42, metalness: 0.75 });
      var fleshMat = T.getEnemyMaterial(0x7f1d1d, { roughness: 0.6, metalness: 0.2 });
      var visorMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
      var plasmaMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
      p.eyeMat = visorMat;

      p.torso.position.set(0, 1.18, 0);
      p.root.add(p.torso);

      // Armored Cuirass & Pauldrons
      p.torso.add(makeBox(0.74, 0.56, 0.44, armorMat, 0, 0.22, 0));
      p.torso.add(makeBox(0.46, 0.38, 0.32, darkSteel, 0, -0.20, 0));
      p.torso.add(makeBox(0.24, 0.24, 0.12, plasmaMat, 0, 0.24, 0.20)); // Glowing chest core
      p.torso.add(makeBox(0.32, 0.28, 0.46, armorMat, -0.50, 0.38, 0, 0, 0, 0.25));
      p.torso.add(makeBox(0.32, 0.28, 0.46, armorMat, 0.50, 0.38, 0, 0, 0, -0.25));

      // Cyber Helmet & Cyclops Visor
      p.head.position.set(0, 0.64, 0.04);
      p.torso.add(p.head);
      var helm = makeBox(0.44, 0.46, 0.46, darkSteel, 0, 0.1, 0);
      helm.userData.isWeakpoint = true;
      p.head.add(helm);
      p.head.add(makeBox(0.48, 0.14, 0.12, visorMat, 0, 0.12, 0.21));
      p.head.add(makeBox(0.12, 0.22, 0.48, armorMat, 0, 0.32, 0)); // Helmet crest

      // Left Arm (Armored fist) & Right Arm (Plasma Hell-Orb Cannon)
      p.leftArm.position.set(-0.52, 0.32, 0);
      p.rightArm.position.set(0.52, 0.32, 0);
      p.torso.add(p.leftArm);
      p.torso.add(p.rightArm);

      p.leftArm.add(makeBox(0.20, 0.46, 0.20, fleshMat, 0, -0.20, 0));
      p.leftArm.add(makeBox(0.22, 0.42, 0.24, armorMat, 0, -0.56, 0.08, -0.3, 0, 0));

      p.rightArm.add(makeBox(0.22, 0.42, 0.22, darkSteel, 0, -0.18, 0));
      // Heavy Arm Cannon barrel
      p.rightArm.add(makeBox(0.28, 0.28, 0.72, darkSteel, 0, -0.42, 0.32));
      p.rightArm.add(makeBox(0.32, 0.12, 0.52, plasmaMat, 0, -0.42, 0.36));
      var chargeOrb = makeOcta(0.18, plasmaMat, 0, -0.42, 0.76);
      chargeOrb.visible = false;
      p.rightArm.add(chargeOrb);
      p.orbMesh = chargeOrb;

      // Legs
      p.leftLeg.position.set(-0.22, 0.88, 0);
      p.rightLeg.position.set(0.22, 0.88, 0);
      p.root.add(p.leftLeg);
      p.root.add(p.rightLeg);
      [-1, 1].forEach(function (side) {
        var leg = side < 0 ? p.leftLeg : p.rightLeg;
        leg.add(makeBox(0.24, 0.46, 0.24, darkSteel, 0, -0.22, 0));
        leg.add(makeBox(0.26, 0.48, 0.28, armorMat, 0, -0.62, 0));
      });
    },

    // 3. SEEKER DRONE: Faceted hovering armored oculus with twin thrusters & violet lens
    _buildDrone: function (p, T) {
      var shellMat = T.getEnemyMaterial(0x5b21b6, { roughness: 0.35, metalness: 0.75 });
      var steelMat = T.getEnemyMaterial(0x27272a, { roughness: 0.4, metalness: 0.8 });
      var eyeMat = new THREE.MeshBasicMaterial({ color: 0xe879f9 });
      var thrusterMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      p.eyeMat = eyeMat;

      p.torso.position.set(0, 0, 0);
      p.root.add(p.torso);

      // Faceted Octagonal Core Chassis
      var core = makeCyl(0.58, 0.58, 0.68, 8, shellMat, 0, 0, 0, Math.PI / 2, 0, 0);
      core.userData.isWeakpoint = true;
      p.torso.add(core);
      p.torso.add(makeBox(0.86, 0.28, 0.62, steelMat, 0, 0, 0));

      // Glowing Central Lens & Aperture Ring
      p.torso.add(makeCyl(0.34, 0.38, 0.16, 8, steelMat, 0, 0, 0.34, Math.PI / 2, 0, 0));
      var lens = makeOcta(0.28, eyeMat, 0, 0, 0.40);
      lens.userData.isWeakpoint = true;
      p.torso.add(lens);

      // 4 Diagonal Armor Fins
      for (var i = 0; i < 4; i++) {
        var angle = (i * Math.PI / 2) + Math.PI / 4;
        var fx = Math.cos(angle) * 0.58;
        var fy = Math.sin(angle) * 0.58;
        p.torso.add(makeBox(0.16, 0.44, 0.48, shellMat, fx, fy, -0.05, 0, 0, angle));
      }

      // Twin Side Jet Nacelles + Laser Barrels
      [-0.68, 0.68].forEach(function (sx) {
        p.torso.add(makeBox(0.26, 0.32, 0.74, steelMat, sx, 0, -0.05));
        p.torso.add(makeCyl(0.06, 0.06, 0.45, 6, steelMat, sx, -0.1, 0.42, Math.PI / 2, 0, 0));
        p.torso.add(makeOcta(0.12, thrusterMat, sx, 0, -0.45));
      });
    },

    // 4. CERBERUS JUGGERNAUT: Towering 3.4m stone-and-iron colossus holding a blazing Hell-Sphere
    _buildJuggernaut: function (p, T) {
      var stoneMat = T.getEnemyMaterial(0x57534e, { roughness: 0.7, metalness: 0.25 });
      var ironMat = T.getEnemyMaterial(0x292524, { roughness: 0.45, metalness: 0.75 });
      var coreMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      var orbMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
      p.eyeMat = coreMat;

      p.torso.position.set(0, 1.85, 0);
      p.root.add(p.torso);

      // Massive Monolithic Chest & Glowing Seam Core
      p.torso.add(makeBox(1.38, 1.05, 0.78, stoneMat, 0, 0.35, 0));
      p.torso.add(makeBox(0.92, 0.58, 0.58, ironMat, 0, -0.35, 0));
      p.torso.add(makeBox(0.36, 0.68, 0.82, coreMat, 0, 0.36, 0)); // Glowing crimson chest chasm
      p.torso.add(makeBox(1.44, 0.16, 0.84, ironMat, 0, 0.55, 0));
      p.torso.add(makeBox(1.44, 0.16, 0.84, ironMat, 0, 0.15, 0));

      // Giant Fortress Pauldrons
      p.torso.add(makeBox(0.62, 0.62, 0.84, stoneMat, -0.92, 0.62, 0, 0, 0, 0.18));
      p.torso.add(makeBox(0.62, 0.62, 0.84, stoneMat, 0.92, 0.62, 0, 0, 0, -0.18));

      // Guardian Head (Weakpoint)
      p.head.position.set(0, 0.98, 0.08);
      p.torso.add(p.head);
      var headMesh = makeBox(0.58, 0.66, 0.58, stoneMat, 0, 0.22, 0);
      headMesh.userData.isWeakpoint = true;
      p.head.add(headMesh);
      p.head.add(makeBox(0.62, 0.14, 0.62, coreMat, 0, 0.24, 0.02)); // Glowing eye slit
      p.head.add(makeBox(0.18, 0.78, 0.64, ironMat, 0, 0.28, 0)); // Vertical face ridge

      // Left & Right Colossus Arms
      p.leftArm.position.set(-0.98, 0.52, 0);
      p.rightArm.position.set(0.98, 0.52, 0);
      p.torso.add(p.leftArm);
      p.torso.add(p.rightArm);

      p.leftArm.add(makeBox(0.42, 0.78, 0.42, stoneMat, 0, -0.35, 0));
      p.leftArm.add(makeBox(0.46, 0.76, 0.46, ironMat, 0, -0.98, 0.12, -0.25, 0, 0));

      p.rightArm.add(makeBox(0.42, 0.78, 0.42, stoneMat, 0, -0.35, 0));
      p.rightArm.add(makeBox(0.46, 0.76, 0.46, ironMat, 0, -0.98, 0.22, -0.55, 0, 0));
      // Blazing Hell-Sphere held in Right Hand
      var appleOrb = makeOcta(0.38, orbMat, 0, -1.28, 0.58);
      p.rightArm.add(appleOrb);
      p.orbMesh = appleOrb;

      // Pillar Legs
      p.leftLeg.position.set(-0.38, 1.35, 0);
      p.rightLeg.position.set(0.38, 1.35, 0);
      p.root.add(p.leftLeg);
      p.root.add(p.rightLeg);
      [-1, 1].forEach(function (side) {
        var leg = side < 0 ? p.leftLeg : p.rightLeg;
        leg.add(makeBox(0.46, 0.68, 0.48, ironMat, 0, -0.32, 0));
        leg.add(makeBox(0.52, 0.76, 0.56, stoneMat, 0, -0.96, 0));
      });
    },

    // 5. MALICIOUS SENTRY: Tripod rail-sniper turret walker with cyan targeting beacon
    _buildSentry: function (p, T) {
      var tealMat = T.getEnemyMaterial(0x0f766e, { roughness: 0.35, metalness: 0.7 });
      var gunMetal = T.getEnemyMaterial(0x1e293b, { roughness: 0.35, metalness: 0.85 });
      var beaconMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
      p.eyeMat = beaconMat;

      p.torso.position.set(0, 1.35, 0);
      p.root.add(p.torso);

      // Rotating Turret Chassis
      p.torso.add(makeBox(0.76, 0.62, 0.88, tealMat, 0, 0.15, 0));
      // Twin Sniper Rail Barrels extending forward
      p.torso.add(makeBox(0.12, 0.18, 1.65, gunMetal, -0.14, 0.18, 0.75));
      p.torso.add(makeBox(0.12, 0.18, 1.65, gunMetal, 0.14, 0.18, 0.75));
      p.torso.add(makeBox(0.16, 0.10, 1.50, beaconMat, 0, 0.18, 0.72)); // Glowing rail core

      // Sensor Head / Antenna (Weakpoint)
      p.head.position.set(0, 0.56, 0.12);
      p.torso.add(p.head);
      var sensor = makeBox(0.46, 0.38, 0.52, gunMetal, 0, 0.12, 0);
      sensor.userData.isWeakpoint = true;
      p.head.add(sensor);
      var lens = makeOcta(0.22, beaconMat, 0, 0.14, 0.28);
      lens.userData.isWeakpoint = true;
      p.head.add(lens);
      p.head.add(makeCyl(0.02, 0.03, 0.55, 5, beaconMat, 0.18, 0.45, -0.1));

      // Tripod Articulated Legs
      p.leftLeg.position.set(-0.42, 1.15, 0.15);
      p.rightLeg.position.set(0.42, 1.15, 0.15);
      p.root.add(p.leftLeg);
      p.root.add(p.rightLeg);

      p.leftLeg.add(makeBox(0.22, 0.65, 0.22, gunMetal, -0.18, -0.25, 0.1, 0, 0, 0.35));
      p.leftLeg.add(makeBox(0.20, 0.75, 0.24, tealMat, -0.34, -0.78, 0.15, 0, 0, -0.1));

      p.rightLeg.add(makeBox(0.22, 0.65, 0.22, gunMetal, 0.18, -0.25, 0.1, 0, 0, -0.35));
      p.rightLeg.add(makeBox(0.20, 0.75, 0.24, tealMat, 0.34, -0.78, 0.15, 0, 0, 0.1));

      // Rear stabilizer leg attached to root
      p.root.add(makeBox(0.24, 1.25, 0.24, gunMetal, 0, 0.62, -0.52, -0.38, 0, 0));
    },

    // 6. ARCHON V-0 (APEX BOSS): Winged gold-and-crimson Cyber-Seraph with 6 light-wings & twin energy blades
    _buildBoss: function (p, T) {
      var goldMat = T.getEnemyMaterial(0xf59e0b, { roughness: 0.28, metalness: 0.85 });
      var obsidianMat = T.getEnemyMaterial(0x18181b, { roughness: 0.35, metalness: 0.8 });
      var crimsonMat = T.getEnemyMaterial(0xb91c1c, { roughness: 0.4, metalness: 0.5 });
      var wingMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
      var bladeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      p.eyeMat = wingMat;

      p.torso.position.set(0, 1.75, 0);
      p.root.add(p.torso);

      // Paladin Chestplate & Segmented Waist
      p.torso.add(makeBox(1.08, 0.82, 0.58, goldMat, 0, 0.35, 0));
      p.torso.add(makeBox(0.68, 0.48, 0.44, obsidianMat, 0, -0.24, 0));
      p.torso.add(makeBox(0.22, 0.66, 0.62, wingMat, 0, 0.35, 0)); // Glowing cross chest emblem
      p.torso.add(makeBox(0.68, 0.18, 0.62, wingMat, 0, 0.42, 0));

      // Winged Shoulder Pauldrons
      p.torso.add(makeBox(0.48, 0.42, 0.62, goldMat, -0.74, 0.58, 0, 0, 0, 0.3));
      p.torso.add(makeBox(0.48, 0.42, 0.62, goldMat, 0.74, 0.58, 0, 0, 0, -0.3));

      // 6 Articulated Cyber-Seraph Light Wings (3 per side, iconic V1/Gabriel silhouette)
      var wingsGroup = new THREE.Group();
      wingsGroup.position.set(0, 0.48, -0.34);
      p.torso.add(wingsGroup);
      p.wings = wingsGroup;

      [-1, 1].forEach(function (side) {
        for (var w = 0; w < 3; w++) {
          var angleZ = side * (0.45 + w * 0.38);
          var wingHolder = new THREE.Group();
          wingHolder.rotation.z = angleZ;
          wingHolder.rotation.y = -side * 0.22;
          wingHolder.add(makeBox(side * 0.45, 0.14, 0.12, obsidianMat, side * 0.25, 0, 0));
          wingHolder.add(makeBox(side * 1.45, 0.16, 0.06, wingMat, side * 1.15, 0.08, 0));
          wingHolder.add(makeBox(side * 0.95, 0.10, 0.05, crimsonMat, side * 1.0, -0.08, 0));
          wingsGroup.add(wingHolder);
        }
      });

      // Archon Crusader Helm & Floating Halo Crown (Weakpoint)
      p.head.position.set(0, 0.88, 0.04);
      p.torso.add(p.head);
      var helm = makeBox(0.48, 0.58, 0.50, obsidianMat, 0, 0.18, 0);
      helm.userData.isWeakpoint = true;
      p.head.add(helm);
      p.head.add(makeBox(0.52, 0.10, 0.52, wingMat, 0, 0.22, 0.02));
      p.head.add(makeBox(0.10, 0.48, 0.52, wingMat, 0, 0.20, 0.02));
      // Floating Halo behind head
      var haloGeo = new THREE.TorusGeometry(0.48, 0.045, 6, 12);
      var halo = new THREE.Mesh(haloGeo, wingMat);
      halo.position.set(0, 0.32, -0.28);
      p.head.add(halo);

      // Arms wielding Twin Energy Greatswords
      p.leftArm.position.set(-0.76, 0.45, 0);
      p.rightArm.position.set(0.76, 0.45, 0);
      p.torso.add(p.leftArm);
      p.torso.add(p.rightArm);

      [-1, 1].forEach(function (side) {
        var arm = side < 0 ? p.leftArm : p.rightArm;
        var bMat = side < 0 ? bladeMat : wingMat;
        arm.add(makeBox(0.28, 0.56, 0.28, obsidianMat, 0, -0.24, 0));
        arm.add(makeBox(0.30, 0.54, 0.30, goldMat, 0, -0.68, 0.15, -0.45, 0, 0));
        // Energy Greatsword
        arm.add(makeBox(0.36, 0.08, 0.14, goldMat, 0, -0.88, 0.42)); // crossguard
        arm.add(makeBox(0.08, 0.14, 1.55, bMat, 0, -0.88, 1.18)); // glowing blade
      });

      // Armored Greaves
      p.leftLeg.position.set(-0.28, 1.25, 0);
      p.rightLeg.position.set(0.28, 1.25, 0);
      p.root.add(p.leftLeg);
      p.root.add(p.rightLeg);
      [-1, 1].forEach(function (side) {
        var leg = side < 0 ? p.leftLeg : p.rightLeg;
        leg.add(makeBox(0.30, 0.58, 0.30, obsidianMat, 0, -0.28, 0));
        leg.add(makeBox(0.34, 0.66, 0.34, goldMat, 0, -0.82, 0));
      });
    },

    // ==================== FIRST-PERSON VIEWMODEL RIG (4 GUNS + FEEDBACKER PUNCH ARM) ====================
    createViewmodelRig: function (camera) {
      var T = B.TextureLibrary;
      var rig = new THREE.Group();
      camera.add(rig);

      var darkMetal = T.getEnemyMaterial(0x1e293b, { roughness: 0.32, metalness: 0.85 });
      var gunSteel = T.getEnemyMaterial(0x475569, { roughness: 0.38, metalness: 0.78 });
      var brassMat = T.getEnemyMaterial(0xd97706, { roughness: 0.3, metalness: 0.85 });
      var armBlue = T.getEnemyMaterial(0x2563eb, { roughness: 0.38, metalness: 0.72 });

      var goldGlow = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      var orangeGlow = new THREE.MeshBasicMaterial({ color: 0xf97316 });
      var cyanGlow = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      var purpleGlow = new THREE.MeshBasicMaterial({ color: 0xc084fc });

      // Right-hand Weapon Mount
      var gunMount = new THREE.Group();
      gunMount.position.set(0.28, -0.25, -0.46);
      rig.add(gunMount);

      var weapons = {};

      // 1. MARKSMAN REVOLVER (Octagonal slab barrel, revolving cylinder, glowing sight & coin chambers)
      var rev = new THREE.Group();
      rev.add(makeBox(0.08, 0.14, 0.44, gunSteel, 0, 0.04, -0.06)); // Heavy top barrel shroud
      rev.add(makeBox(0.09, 0.06, 0.42, darkMetal, 0, -0.04, -0.05)); // Underbarrel weight
      rev.add(makeBox(0.025, 0.03, 0.38, goldGlow, 0, 0.115, -0.06)); // Glowing top rib
      var revCyl = makeCyl(0.058, 0.058, 0.12, 6, brassMat, 0, 0.01, 0.06, Math.PI / 2, 0, 0);
      rev.add(revCyl);
      rev.userData.cylinder = revCyl;
      rev.add(makeBox(0.07, 0.18, 0.10, darkMetal, 0, -0.11, 0.15, 0.32, 0, 0)); // Grip
      gunMount.add(rev);
      weapons.revolver = rev;

      // 2. CORE-EJECT SHOTGUN (Twin-barrel break-action with glowing orange plasma core chamber)
      var sg = new THREE.Group();
      sg.visible = false;
      sg.add(makeBox(0.14, 0.11, 0.56, darkMetal, 0, 0.02, -0.08)); // Receiver & shroud
      sg.add(makeCyl(0.032, 0.032, 0.58, 6, gunSteel, -0.036, 0.04, -0.12, Math.PI / 2, 0, 0));
      sg.add(makeCyl(0.032, 0.032, 0.58, 6, gunSteel, 0.036, 0.04, -0.12, Math.PI / 2, 0, 0));
      sg.add(makeBox(0.15, 0.045, 0.22, orangeGlow, 0, 0.02, 0.04)); // Glowing plasma core window
      sg.add(makeBox(0.12, 0.07, 0.26, brassMat, 0, -0.045, -0.10)); // Underbarrel core launcher pump
      sg.add(makeBox(0.09, 0.16, 0.18, darkMetal, 0, -0.09, 0.18, 0.25, 0, 0));
      gunMount.add(sg);
      weapons.shotgun = sg;

      // 3. ATTRACTOR NAILGUN (Twin rotary gatling barrels + thermal heat sink coils)
      var ng = new THREE.Group();
      ng.visible = false;
      ng.add(makeBox(0.18, 0.14, 0.36, darkMetal, 0, -0.01, 0.05));
      var rotorGroup = new THREE.Group();
      rotorGroup.position.set(0, 0.02, -0.22);
      for (var b = 0; b < 6; b++) {
        var ang = (b / 6) * Math.PI * 2;
        rotorGroup.add(makeCyl(0.016, 0.016, 0.46, 5, gunSteel, Math.cos(ang) * 0.055, Math.sin(ang) * 0.055, 0, Math.PI / 2, 0, 0));
      }
      rotorGroup.add(makeCyl(0.025, 0.025, 0.48, 6, cyanGlow, 0, 0, 0, Math.PI / 2, 0, 0));
      ng.add(rotorGroup);
      ng.userData.rotor = rotorGroup;
      var heatBar = makeBox(0.19, 0.035, 0.24, cyanGlow, 0, 0.065, 0.02);
      ng.add(heatBar);
      ng.userData.heatBar = heatBar;
      gunMount.add(ng);
      weapons.nailgun = ng;

      // 4. VOLT RAILCANNON / ROCKET (Tri-fork electromagnetic rail cannon with glowing purple core)
      var rc = new THREE.Group();
      rc.visible = false;
      rc.add(makeBox(0.16, 0.16, 0.48, darkMetal, 0, 0.0, 0.02));
      // 3 Outer Rail Forks
      rc.add(makeBox(0.035, 0.04, 0.66, gunSteel, -0.065, 0.05, -0.14));
      rc.add(makeBox(0.035, 0.04, 0.66, gunSteel, 0.065, 0.05, -0.14));
      rc.add(makeBox(0.05, 0.035, 0.66, brassMat, 0, -0.065, -0.14));
      // Inner Lightning Conduit
      var railCore = makeCyl(0.035, 0.035, 0.62, 6, purpleGlow, 0, 0.01, -0.12, Math.PI / 2, 0, 0);
      rc.add(railCore);
      rc.userData.railCore = railCore;
      gunMount.add(rc);
      weapons.railcannon = rc;

      // Left-hand FEEDBACKER PUNCH ARM (Articulated Cyber-Arm for F punch & Parry)
      var punchArm = new THREE.Group();
      punchArm.position.set(-0.34, -0.45, -0.15);
      punchArm.visible = false;
      punchArm.add(makeBox(0.13, 0.13, 0.52, armBlue, 0, 0, 0)); // Forearm chassis
      punchArm.add(makeBox(0.15, 0.06, 0.34, gunSteel, 0, 0.06, -0.04)); // Hydraulic piston rail
      var knuckle = makeBox(0.17, 0.16, 0.16, brassMat, 0, 0.01, -0.28); // Heavy Knuckle duster
      punchArm.add(knuckle);
      punchArm.userData.knuckle = knuckle;
      rig.add(punchArm);

      // Muzzle PointLight attached to camera for dynamic world illumination when firing
      var muzzleLight = new THREE.PointLight(0xffaa33, 0, 14, 2);
      muzzleLight.position.set(0.2, -0.1, -0.8);
      rig.add(muzzleLight);

      return {
        rig: rig,
        gunMount: gunMount,
        weapons: weapons,
        punchArm: punchArm,
        muzzleLight: muzzleLight
      };
    }
  };

})(window.Bloodcore);
