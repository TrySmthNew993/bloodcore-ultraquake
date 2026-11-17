/**
 * BLOODCORE // ULTRAQUAKE
 * Level Builder (5 Pre-Made Campaign Gauntlets + Endless Generative Forward Gauntlet)
 * Constructs 3D architecture, AABB colliders, Jump Pads, Hazard Pits, Moving Crushers,
 * Mechanical Blast Doors, Dynamic PointLights, and Extraction Elevators.
 */
window.Bloodcore = window.Bloodcore || {};

(function (B) {
  'use strict';

  B.LevelManager = function (scene, audio) {
    this.scene = scene;
    this.audio = audio;

    this.mode = 'campaign'; // 'campaign' | 'endless'
    this.currentLevelData = null;
    this.rooms = [];
    this.colliders = []; // { minX, maxX, minY, maxY, minZ, maxZ, roomIdx, isWall, isFloor, isCrusher }
    this.jumpPads = [];  // { x, y, z, radius, boostY, boostZ, roomIdx, mesh }
    this.hazards = [];   // { minX, maxX, minY, maxY, minZ, maxZ, damage, type, roomIdx, mesh }
    this.crushers = [];  // { mesh, collider, baseY, amp, speed, phase, roomIdx }
    this.doors = [];     // { group, leftPanel, rightPanel, collider, z, y, isOpen, openProgress, roomIdx, statusMat }
    this.exitZone = null; // { x, y, z, radius, active, mesh }

    this.activeRoomIndex = -1;
    this.currentWaveIndex = 0;
    this.roomLocked = false;
    this.endlessRoomCounter = 0;
    this.nextRoomZ = 0;
  };

  B.LevelManager.prototype.clearAll = function () {
    for (var i = 0; i < this.rooms.length; i++) {
      if (this.rooms[i].group) {
        this.scene.remove(this.rooms[i].group);
      }
    }
    this.rooms = [];
    this.colliders = [];
    this.jumpPads = [];
    this.hazards = [];
    this.crushers = [];
    this.doors = [];
    this.exitZone = null;
    this.activeRoomIndex = -1;
    this.currentWaveIndex = 0;
    this.roomLocked = false;
    this.endlessRoomCounter = 0;
    this.nextRoomZ = 0;
  };

  // Adds a static 3D box mesh AND registers its world AABB collider
  B.LevelManager.prototype.addSolidBox = function (roomGroup, roomIdx, w, h, d, x, y, z, mat, opts) {
    opts = opts || {};
    var geo = new THREE.BoxGeometry(w, h, d);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = !opts.noShadow;
    mesh.receiveShadow = true;
    roomGroup.add(mesh);

    var wx = roomGroup.position.x + x;
    var wy = roomGroup.position.y + y;
    var wz = roomGroup.position.z + z;

    var col = {
      minX: wx - w / 2,
      maxX: wx + w / 2,
      minY: wy - h / 2,
      maxY: wy + h / 2,
      minZ: wz - d / 2,
      maxZ: wz + d / 2,
      roomIdx: roomIdx,
      isWall: opts.isWall !== false && h > 1.2,
      isCrusher: !!opts.isCrusher
    };
    if (!opts.noCollide) {
      this.colliders.push(col);
    }
    return { mesh: mesh, collider: col };
  };

  B.LevelManager.prototype.addJumpPad = function (roomGroup, roomIdx, x, y, z, boostY, boostZ) {
    var padGroup = new THREE.Group();
    padGroup.position.set(x, y + 0.15, z);
    roomGroup.add(padGroup);

    var baseMat = B.TextureLibrary.getEnemyMaterial(0x1e293b, { roughness: 0.4, metalness: 0.8 });
    var glowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    var baseGeo = new THREE.CylinderGeometry(1.45, 1.65, 0.3, 8);
    padGroup.add(new THREE.Mesh(baseGeo, baseMat));

    var ringGeo = new THREE.CylinderGeometry(1.15, 1.15, 0.34, 8);
    var ringMesh = new THREE.Mesh(ringGeo, glowMat);
    padGroup.add(ringMesh);

    this.jumpPads.push({
      x: roomGroup.position.x + x,
      y: roomGroup.position.y + y,
      z: roomGroup.position.z + z,
      radius: 1.75,
      boostY: boostY || 26.5,
      boostZ: boostZ || 0,
      roomIdx: roomIdx,
      mesh: ringMesh
    });
  };

  B.LevelManager.prototype.addHazardPool = function (roomGroup, roomIdx, w, d, x, y, z, hazardType) {
    var T = B.TextureLibrary;
    var isAcid = hazardType === 'acid';
    var mat = T.getWorldMaterial(isAcid ? 'acid' : 'lava', Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(d / 6)), {
      emissive: isAcid ? 0x10b981 : 0xff4500,
      emissiveIntensity: 0.75,
      roughness: 0.3,
      bumpScale: 0.08
    });
    var geo = new THREE.BoxGeometry(w, 0.4, d);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    roomGroup.add(mesh);

    var wx = roomGroup.position.x + x;
    var wy = roomGroup.position.y + y;
    var wz = roomGroup.position.z + z;

    this.hazards.push({
      minX: wx - w / 2,
      maxX: wx + w / 2,
      minY: wy - 1.0,
      maxY: wy + 0.55,
      minZ: wz - d / 2,
      maxZ: wz + d / 2,
      damage: 18,
      type: hazardType,
      roomIdx: roomIdx,
      mesh: mesh
    });
  };

  B.LevelManager.prototype.addBlastDoor = function (roomGroup, roomIdx, x, y, z, startOpen) {
    var T = B.TextureLibrary;
    var doorGroup = new THREE.Group();
    doorGroup.position.set(x, y, z);
    roomGroup.add(doorGroup);

    var frameMat = T.getWorldMaterial('rivetIron', 1, 2);
    var panelMat = T.getWorldMaterial('hazardStripe', 1, 2);
    var statusMat = new THREE.MeshBasicMaterial({ color: startOpen ? 0x4ade80 : 0xef4444 });

    // Door Frame
    var leftFrame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 5.2, 1.2), frameMat);
    leftFrame.position.set(-3.1, 2.6, 0);
    doorGroup.add(leftFrame);

    var rightFrame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 5.2, 1.2), frameMat);
    rightFrame.position.set(3.1, 2.6, 0);
    doorGroup.add(rightFrame);

    var topFrame = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.0, 1.3), frameMat);
    topFrame.position.set(0, 5.1, 0);
    doorGroup.add(topFrame);

    // Status Light Strip
    var lightBar = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.28, 1.36), statusMat);
    lightBar.position.set(0, 5.05, 0);
    doorGroup.add(lightBar);

    // Sliding Door Panels
    var leftPanel = new THREE.Mesh(new THREE.BoxGeometry(2.7, 4.6, 0.65), panelMat);
    var rightPanel = new THREE.Mesh(new THREE.BoxGeometry(2.7, 4.6, 0.65), panelMat);
    var offset = startOpen ? 2.55 : 0;
    leftPanel.position.set(-1.35 - offset, 2.3, 0);
    rightPanel.position.set(1.35 + offset, 2.3, 0);
    doorGroup.add(leftPanel);
    doorGroup.add(rightPanel);

    var wx = roomGroup.position.x + x;
    var wy = roomGroup.position.y + y;
    var wz = roomGroup.position.z + z;

    var col = {
      minX: wx - 2.8,
      maxX: wx + 2.8,
      minY: wy + (startOpen ? 100 : 0),
      maxY: wy + (startOpen ? 105 : 4.6),
      minZ: wz - 0.5,
      maxZ: wz + 0.5,
      roomIdx: roomIdx,
      isWall: true,
      isDoor: true
    };
    this.colliders.push(col);

    var doorObj = {
      group: doorGroup,
      leftPanel: leftPanel,
      rightPanel: rightPanel,
      collider: col,
      baseY: wy,
      z: wz,
      isOpen: !!startOpen,
      openProgress: startOpen ? 1.0 : 0.0,
      roomIdx: roomIdx,
      statusMat: statusMat
    };
    this.doors.push(doorObj);
    return doorObj;
  };

  // ==================== BUILD CAMPAIGN LEVEL ====================
  B.LevelManager.prototype.loadCampaignLevel = function (levelIndex) {
    this.clearAll();
    this.mode = 'campaign';
    var lvl = B.CAMPAIGN_LEVELS[levelIndex] || B.CAMPAIGN_LEVELS[0];
    this.currentLevelData = lvl;
    var biome = B.BIOMES[lvl.biome] || B.BIOMES.furnace;
    this.applyBiomeAtmosphere(biome);

    // Entry Staging Corridor (Spawn room)
    this.buildEntryStagingRoom(biome);

    for (var i = 0; i < lvl.rooms.length; i++) {
      var rDef = lvl.rooms[i];
      var isLast = (i === lvl.rooms.length - 1);
      this.buildCombatRoom(i, rDef, biome, isLast);
    }
  };

  // ==================== START ENDLESS GENERATIVE GAUNTLET ====================
  B.LevelManager.prototype.startEndlessMode = function () {
    this.clearAll();
    this.mode = 'endless';
    this.endlessRoomCounter = 0;
    var biome = B.BIOMES.furnace;
    this.applyBiomeAtmosphere(biome);

    this.buildEntryStagingRoom(biome);
    // Pre-generate Room 1 and Room 2 ahead of the player
    this.generateNextEndlessRoom();
    this.generateNextEndlessRoom();
  };

  B.LevelManager.prototype.generateNextEndlessRoom = function () {
    var idx = this.endlessRoomCounter++;
    var biomeKeys = ['furnace', 'meatgrinder', 'cathedral', 'aqueduct', 'throne'];
    var biomeKey = biomeKeys[Math.floor(idx / 2) % biomeKeys.length];
    var biome = B.BIOMES[biomeKey];

    var roomNum = idx + 1;
    var isBossRoom = (roomNum % 5 === 0);
    var layoutPool = isBossRoom ? ['boss_sanctum'] : [
      'vestibule_pillars',
      'twin_lava_bridges',
      'central_tower_jumppads',
      'crusher_hall',
      'pit_overlook',
      'multi_tier_arena',
      'cathedral_nave'
    ];
    var layout = layoutPool[(idx * 3 + 1) % layoutPool.length];

    var w = isBossRoom ? 48 : (32 + ((idx * 4) % 14));
    var l = isBossRoom ? 50 : (36 + ((idx * 6) % 14));
    var h = isBossRoom ? 22 : (14 + ((idx * 2) % 6));

    // Procedural Wave Generator scaling with roomNum
    var waves = [];
    if (isBossRoom) {
      waves.push([
        { type: 'boss', count: 1 },
        { type: 'husk', count: 4 + Math.min(4, Math.floor(roomNum / 5)) }
      ]);
    } else {
      var numWaves = roomNum >= 3 ? 2 : 1;
      for (var wv = 0; wv < numWaves; wv++) {
        var wave = [];
        wave.push({ type: 'husk', count: 4 + Math.min(6, Math.floor(roomNum * 0.7)) });
        wave.push({ type: 'soldier', count: 2 + Math.min(4, Math.floor(roomNum * 0.45)) });
        if (roomNum >= 2 || wv > 0) {
          wave.push({ type: 'drone', count: 2 + Math.min(3, Math.floor(roomNum * 0.35)) });
        }
        if (roomNum >= 3 && (wv === numWaves - 1)) {
          if (roomNum % 2 === 1) {
            wave.push({ type: 'juggernaut', count: roomNum >= 7 ? 2 : 1 });
          } else {
            wave.push({ type: 'sentry', count: roomNum >= 6 ? 2 : 1 });
          }
        }
        waves.push(wave);
      }
    }

    var rDef = {
      name: isBossRoom ? ('SECTOR ' + roomNum + ' // APEX SANCTUM') : ('SECTOR ' + roomNum + ' // ' + biome.name),
      w: w,
      l: l,
      h: h,
      layout: layout,
      isBossRoom: isBossRoom,
      biomeKey: biomeKey,
      waves: waves
    };

    this.buildCombatRoom(idx, rDef, biome, false);

    // Cleanup old rooms more than 2 rooms behind activeRoomIndex to keep 60+ FPS forever
    this.cleanupOldEndlessRooms();
  };

  B.LevelManager.prototype.cleanupOldEndlessRooms = function () {
    var cutoff = this.activeRoomIndex - 2;
    if (cutoff <= 0) return;
    for (var i = 0; i < this.rooms.length; i++) {
      var r = this.rooms[i];
      if (r.index >= 0 && r.index < cutoff && !r.disposed) {
        r.disposed = true;
        this.scene.remove(r.group);
        var rIdx = r.index;
        this.colliders = this.colliders.filter(function (c) { return c.roomIdx !== rIdx; });
        this.jumpPads = this.jumpPads.filter(function (j) { return j.roomIdx !== rIdx; });
        this.hazards = this.hazards.filter(function (h) { return h.roomIdx !== rIdx; });
        this.crushers = this.crushers.filter(function (cr) { return cr.roomIdx !== rIdx; });
      }
    }
  };

  B.LevelManager.prototype.applyBiomeAtmosphere = function (biome) {
    this.scene.background = new THREE.Color(biome.skyColor);
    this.scene.fog = new THREE.FogExp2(biome.fogColor, 0.014);
    if (this.ambientLight) {
      this.ambientLight.color.setHex(biome.ambientColor);
    } else {
      this.ambientLight = new THREE.AmbientLight(biome.ambientColor, 1.35);
      this.scene.add(this.ambientLight);
    }
  };

  // ==================== BUILD STARTING STAGING AIRLOCK ====================
  B.LevelManager.prototype.buildEntryStagingRoom = function (biome) {
    var T = B.TextureLibrary;
    var group = new THREE.Group();
    group.position.set(0, 0, 0);
    this.scene.add(group);

    var wallMat = T.getWorldMaterial(biome.wallTex, 3, 2);
    var floorMat = T.getWorldMaterial(biome.floorTex, 3, 4);
    var trimMat = T.getWorldMaterial(biome.trimTex, 3, 1);

    // 10m wide x 14m long x 7m high entry bay from z = +6 to z = -8
    this.addSolidBox(group, -1, 10, 1, 14, 0, -0.5, -1, floorMat); // Floor
    this.addSolidBox(group, -1, 10, 1, 14, 0, 7.5, -1, wallMat);   // Ceiling
    this.addSolidBox(group, -1, 10, 8, 1, 0, 3.5, 6.5, wallMat);   // Back Wall
    this.addSolidBox(group, -1, 1, 8, 14, -5.5, 3.5, -1, wallMat); // Left Wall
    this.addSolidBox(group, -1, 1, 8, 14, 5.5, 3.5, -1, wallMat);  // Right Wall
    this.addSolidBox(group, -1, 9.8, 0.6, 13.8, 0, 1.2, -1, trimMat, { noCollide: true });

    var startLight = new THREE.PointLight(biome.mainLightColor, 2.2, 24, 1.6);
    startLight.position.set(0, 5.5, -1);
    group.add(startLight);

    this.rooms.push({
      index: -1,
      group: group,
      zStart: 6,
      zEnd: -8,
      cleared: true
    });
    this.nextRoomZ = -8;
  };

  // ==================== BUILD COMBAT ARENA ROOM ====================
  B.LevelManager.prototype.buildCombatRoom = function (roomIdx, rDef, biome, isLastCampaignRoom) {
    var T = B.TextureLibrary;
    var w = rDef.w;
    var l = rDef.l;
    var h = rDef.h;

    var zStart = this.nextRoomZ;
    var zCenter = zStart - l / 2;
    var zEnd = zStart - l;

    var group = new THREE.Group();
    group.position.set(0, 0, zCenter);
    this.scene.add(group);

    var wallMat = T.getWorldMaterial(biome.wallTex, Math.round(w / 5), Math.round(h / 4));
    var sideWallMat = T.getWorldMaterial(biome.wallTex, Math.round(l / 5), Math.round(h / 4));
    var floorMat = T.getWorldMaterial(biome.floorTex, Math.round(w / 4), Math.round(l / 4));
    var ceilMat = T.getWorldMaterial(biome.pillarTex, Math.round(w / 6), Math.round(l / 6));
    var pillarMat = T.getWorldMaterial(biome.pillarTex, 1, Math.round(h / 3));
    var trimMat = T.getWorldMaterial(biome.trimTex, Math.round(w / 4), 1);

    // Main Floor & Ceiling
    this.addSolidBox(group, roomIdx, w, 1.2, l, 0, -0.6, 0, floorMat);
    this.addSolidBox(group, roomIdx, w, 1.2, l, 0, h + 0.6, 0, ceilMat);

    // Left & Right Outer Walls
    this.addSolidBox(group, roomIdx, 1.4, h, l, -w / 2 - 0.7, h / 2, 0, sideWallMat);
    this.addSolidBox(group, roomIdx, 1.4, h, l, w / 2 + 0.7, h / 2, 0, sideWallMat);

    // Architectural Wall Buttresses / Ceiling Ribs
    for (var rz = -l / 2 + 6; rz <= l / 2 - 6; rz += 10) {
      this.addSolidBox(group, roomIdx, 1.4, h, 1.4, -w / 2 + 0.6, h / 2, rz, pillarMat);
      this.addSolidBox(group, roomIdx, 1.4, h, 1.4, w / 2 - 0.6, h / 2, rz, pillarMat);
      this.addSolidBox(group, roomIdx, w, 1.0, 1.2, 0, h - 0.5, rz, pillarMat, { noCollide: true });
    }

    // Front Wall (at +l/2 local, connecting from previous room with a 5.6m wide doorway)
    var sideW = (w - 5.6) / 2;
    this.addSolidBox(group, roomIdx, sideW, h, 1.4, -(2.8 + sideW / 2), h / 2, l / 2, wallMat);
    this.addSolidBox(group, roomIdx, sideW, h, 1.4, (2.8 + sideW / 2), h / 2, l / 2, wallMat);
    this.addSolidBox(group, roomIdx, 6.0, h - 4.8, 1.4, 0, 4.8 + (h - 4.8) / 2, l / 2, wallMat);

    // Entry Blast Door (Starts OPEN so player can run in, locks behind player when entering)
    var entryDoor = this.addBlastDoor(group, roomIdx, 0, 0, l / 2, true);

    // Back Wall (at -l/2 local, leading to next room or extraction shaft)
    this.addSolidBox(group, roomIdx, sideW, h, 1.4, -(2.8 + sideW / 2), h / 2, -l / 2, wallMat);
    this.addSolidBox(group, roomIdx, sideW, h, 1.4, (2.8 + sideW / 2), h / 2, -l / 2, wallMat);
    this.addSolidBox(group, roomIdx, 6.0, h - 4.8, 1.4, 0, 4.8 + (h - 4.8) / 2, -l / 2, wallMat);

    // Exit Blast Door (Starts CLOSED, opens when all waves in this room are defeated)
    var exitDoor = this.addBlastDoor(group, roomIdx, 0, 0, -l / 2, false);

    // Populate Interior Layout Geometry, Platforms, Jump Pads, Hazards & Spawn Points
    var spawnPoints = this.populateRoomLayout(group, roomIdx, rDef, biome, pillarMat, floorMat, trimMat);

    // Dynamic Colored Room PointLights (PS1/PS2 textures + dynamic colored lights!)
    var light1 = new THREE.PointLight(biome.mainLightColor, 3.0, w * 1.15, 1.45);
    light1.position.set(-w * 0.24, h * 0.72, -l * 0.18);
    group.add(light1);

    var light2 = new THREE.PointLight(biome.accentLightColor, 2.8, w * 1.15, 1.45);
    light2.position.set(w * 0.24, h * 0.68, l * 0.18);
    group.add(light2);

    // Glowing Sconce Meshes on Walls
    var sconceMat = new THREE.MeshBasicMaterial({ color: biome.mainLightColor });
    [-w / 2 + 1.35, w / 2 - 1.35].forEach(function (sx) {
      for (var sz = -l / 3; sz <= l / 3; sz += l / 3) {
        var sc = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.2, 0.45), sconceMat);
        sc.position.set(sx, h * 0.52, sz);
        group.add(sc);
      }
    });

    // Connector Corridor behind Exit Door (-l/2 to -l/2 - 10)
    var corrLen = 10;
    var corrCenterZ = -l / 2 - corrLen / 2;
    this.addSolidBox(group, roomIdx, 8, 1.2, corrLen, 0, -0.6, corrCenterZ, floorMat);
    this.addSolidBox(group, roomIdx, 8, 1.2, corrLen, 0, 6.4, corrCenterZ, ceilMat);
    this.addSolidBox(group, roomIdx, 1.2, 6.5, corrLen, -4.4, 3.0, corrCenterZ, wallMat);
    this.addSolidBox(group, roomIdx, 1.2, 6.5, corrLen, 4.4, 3.0, corrCenterZ, wallMat);

    // If this is the final room of a Campaign Level, cap the corridor with the Extraction Elevator!
    if (isLastCampaignRoom) {
      this.addSolidBox(group, roomIdx, 8, 6.5, 1.2, 0, 3.0, -l / 2 - corrLen, wallMat);
      var exitBeamMat = new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.65
      });
      var exitPad = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 5.5, 8), exitBeamMat);
      exitPad.position.set(0, 2.75, corrCenterZ - 1.5);
      group.add(exitPad);

      var exitLight = new THREE.PointLight(0xfacc15, 2.5, 16, 1.5);
      exitLight.position.set(0, 4.0, corrCenterZ - 1.5);
      group.add(exitLight);

      this.exitZone = {
        x: 0,
        y: 0,
        z: zCenter + corrCenterZ - 1.5,
        radius: 2.8,
        mesh: exitPad
      };
    }

    this.rooms.push({
      index: roomIdx,
      def: rDef,
      biome: biome,
      group: group,
      zStart: zStart,
      zCenter: zCenter,
      zEnd: zEnd,
      entryDoor: entryDoor,
      exitDoor: exitDoor,
      spawnPoints: spawnPoints,
      triggered: false,
      cleared: false,
      disposed: false
    });

    this.nextRoomZ = zEnd - corrLen;
  };

  // ==================== ARCHITECTURAL ARENA TEMPLATES ====================
  B.LevelManager.prototype.populateRoomLayout = function (group, roomIdx, rDef, biome, pillarMat, floorMat, trimMat) {
    var w = rDef.w;
    var l = rDef.l;
    var h = rDef.h;
    var layout = rDef.layout;
    var spawns = [];
    var zCenter = group.position.z;

    function addSpawn(x, y, z) {
      spawns.push({ x: x, y: y, z: zCenter + z });
    }

    if (layout === 'vestibule_pillars') {
      // 4 massive octagonal/square pillars + elevated back gallery + 2 jump pads
      var px = w * 0.24, pz = l * 0.20;
      this.addSolidBox(group, roomIdx, 2.6, h, 2.6, -px, h / 2, pz, pillarMat);
      this.addSolidBox(group, roomIdx, 2.6, h, 2.6, px, h / 2, pz, pillarMat);
      this.addSolidBox(group, roomIdx, 2.6, h, 2.6, -px, h / 2, -pz, pillarMat);
      this.addSolidBox(group, roomIdx, 2.6, h, 2.6, px, h / 2, -pz, pillarMat);

      // Central low altar platform
      this.addSolidBox(group, roomIdx, 8, 1.4, 8, 0, 0.7, 0, trimMat);
      // Side elevated ledges
      this.addSolidBox(group, roomIdx, 4.5, 3.6, l * 0.55, -w / 2 + 2.5, 1.8, 0, floorMat);
      this.addSolidBox(group, roomIdx, 4.5, 3.6, l * 0.55, w / 2 - 2.5, 1.8, 0, floorMat);
      this.addJumpPad(group, roomIdx, -w / 2 + 3.2, 0, l * 0.34, 22, 0);
      this.addJumpPad(group, roomIdx, w / 2 - 3.2, 0, l * 0.34, 22, 0);

      addSpawn(0, 1.6, 0);
      addSpawn(-px * 0.6, 0.2, -pz);
      addSpawn(px * 0.6, 0.2, -pz);
      addSpawn(-w / 2 + 2.5, 3.8, -4);
      addSpawn(w / 2 - 2.5, 3.8, -4);
      addSpawn(0, 0.2, -l * 0.32);

    } else if (layout === 'twin_lava_bridges') {
      // Twin hazard pools flanking a central bridge + high side sniper galleries
      var poolW = w * 0.28;
      var poolL = l * 0.56;
      this.addHazardPool(group, roomIdx, poolW, poolL, -w * 0.22, 0.05, 0, biome.hazardType);
      this.addHazardPool(group, roomIdx, poolW, poolL, w * 0.22, 0.05, 0, biome.hazardType);

      // Raised Central Bridge Spine
      this.addSolidBox(group, roomIdx, 6.5, 1.2, poolL + 4, 0, 0.6, 0, trimMat);
      // Elevated Transverse Overpass Bridge
      this.addSolidBox(group, roomIdx, w - 4, 0.9, 5.0, 0, 4.6, -2, floorMat);
      this.addSolidBox(group, roomIdx, 2.2, 4.6, 2.2, -w * 0.36, 2.3, -2, pillarMat);
      this.addSolidBox(group, roomIdx, 2.2, 4.6, 2.2, w * 0.36, 2.3, -2, pillarMat);

      this.addJumpPad(group, roomIdx, -w * 0.36, 0, l * 0.32, 24, 0);
      this.addJumpPad(group, roomIdx, w * 0.36, 0, l * 0.32, 24, 0);

      addSpawn(0, 1.4, -6);
      addSpawn(0, 5.3, -2);
      addSpawn(-w * 0.30, 5.3, -2);
      addSpawn(w * 0.30, 5.3, -2);
      addSpawn(-w * 0.25, 0.2, -l * 0.36);
      addSpawn(w * 0.25, 0.2, -l * 0.36);

    } else if (layout === 'central_tower_jumppads') {
      // 2-tier Central Bastion Tower + 4 Jump Pads + Corner Columns
      this.addSolidBox(group, roomIdx, 10, 3.8, 10, 0, 1.9, 0, floorMat);
      this.addSolidBox(group, roomIdx, 5.5, 3.6, 5.5, 0, 5.6, 0, trimMat);

      // Corner Pillars
      var cx = w * 0.32, cz = l * 0.30;
      this.addSolidBox(group, roomIdx, 2.8, h, 2.8, -cx, h / 2, cz, pillarMat);
      this.addSolidBox(group, roomIdx, 2.8, h, 2.8, cx, h / 2, cz, pillarMat);
      this.addSolidBox(group, roomIdx, 2.8, h, 2.8, -cx, h / 2, -cz, pillarMat);
      this.addSolidBox(group, roomIdx, 2.8, h, 2.8, cx, h / 2, -cz, pillarMat);

      this.addJumpPad(group, roomIdx, 0, 0, 8.2, 26, 0);
      this.addJumpPad(group, roomIdx, -9.5, 0, 0, 27, 0);
      this.addJumpPad(group, roomIdx, 9.5, 0, 0, 27, 0);

      addSpawn(0, 7.6, 0);
      addSpawn(-3.5, 4.0, 2.5);
      addSpawn(3.5, 4.0, -2.5);
      addSpawn(-cx * 0.75, 0.2, -cz * 0.8);
      addSpawn(cx * 0.75, 0.2, -cz * 0.8);
      addSpawn(0, 0.2, -l * 0.35);

    } else if (layout === 'crusher_hall') {
      // 2 Moving Pneumatic Crusher Columns + Elevated Flanking Catwalks
      this.addSolidBox(group, roomIdx, 4.5, 3.8, l * 0.68, -w / 2 + 2.5, 1.9, 0, floorMat);
      this.addSolidBox(group, roomIdx, 4.5, 3.8, l * 0.68, w / 2 - 2.5, 1.9, 0, floorMat);
      this.addJumpPad(group, roomIdx, -w / 2 + 3.0, 0, l * 0.38, 23, 0);
      this.addJumpPad(group, roomIdx, w / 2 - 3.0, 0, l * 0.38, 23, 0);

      // 2 Animated Crushers in the center lane
      for (var c = 0; c < 2; c++) {
        var czPos = (c === 0) ? 5.5 : -5.5;
        var cr = this.addSolidBox(group, roomIdx, 5.2, 5.5, 4.2, 0, 5.5, czPos, trimMat, { isCrusher: true });
        this.crushers.push({
          mesh: cr.mesh,
          collider: cr.collider,
          baseY: 5.8,
          halfH: 2.75,
          amp: 3.0,
          speed: 3.2,
          phase: c * Math.PI,
          roomIdx: roomIdx
        });
      }

      addSpawn(-w / 2 + 2.5, 4.0, -4);
      addSpawn(w / 2 - 2.5, 4.0, -4);
      addSpawn(-5, 0.2, 0);
      addSpawn(5, 0.2, 0);
      addSpawn(-4, 0.2, -l * 0.32);
      addSpawn(4, 0.2, -l * 0.32);

    } else if (layout === 'pit_overlook') {
      // Central molten/acid pit with perimeter walkways & central island platform
      this.addHazardPool(group, roomIdx, w * 0.46, l * 0.44, 0, 0.05, 0, biome.hazardType);
      this.addSolidBox(group, roomIdx, 7.5, 2.4, 7.5, 0, 1.2, 0, trimMat);

      // Elevated Back Overlook Stage
      this.addSolidBox(group, roomIdx, w * 0.65, 4.2, 7.5, 0, 2.1, -l * 0.28, floorMat);
      this.addJumpPad(group, roomIdx, -w * 0.32, 0, l * 0.22, 25, -8);
      this.addJumpPad(group, roomIdx, w * 0.32, 0, l * 0.22, 25, -8);
      this.addJumpPad(group, roomIdx, 0, 2.4, 0, 26, 0);

      addSpawn(0, 2.6, 0);
      addSpawn(0, 4.5, -l * 0.28);
      addSpawn(-w * 0.22, 4.5, -l * 0.28);
      addSpawn(w * 0.22, 4.5, -l * 0.28);
      addSpawn(-w * 0.34, 0.2, 0);
      addSpawn(w * 0.34, 0.2, 0);

    } else if (layout === 'multi_tier_arena' || layout === 'cathedral_nave') {
      // Grand Colonnade + 2-tier platforms for heavy Juggernaut & Sentry duels
      var colX = w * 0.28;
      for (var z = -l * 0.26; z <= l * 0.26; z += l * 0.26) {
        this.addSolidBox(group, roomIdx, 2.4, h, 2.4, -colX, h / 2, z, pillarMat);
        this.addSolidBox(group, roomIdx, 2.4, h, 2.4, colX, h / 2, z, pillarMat);
      }
      // Elevated Dais at center-back
      this.addSolidBox(group, roomIdx, 12, 2.8, 9, 0, 1.4, -l * 0.16, trimMat);
      this.addJumpPad(group, roomIdx, -colX * 0.65, 0, l * 0.22, 26, 0);
      this.addJumpPad(group, roomIdx, colX * 0.65, 0, l * 0.22, 26, 0);

      addSpawn(0, 3.0, -l * 0.16);
      addSpawn(-4, 3.0, -l * 0.16);
      addSpawn(4, 3.0, -l * 0.16);
      addSpawn(-colX * 0.5, 0.2, l * 0.12);
      addSpawn(colX * 0.5, 0.2, l * 0.12);
      addSpawn(0, 0.2, 0);

    } else if (layout === 'boss_sanctum') {
      // Grand Octagonal-feeling Sanctum for ARCHON V-0 Boss Battle
      var r = w * 0.34;
      for (var a = 0; a < 4; a++) {
        var ang = (a * Math.PI / 2) + Math.PI / 4;
        var bx = Math.cos(ang) * r;
        var bz = Math.sin(ang) * r;
        this.addSolidBox(group, roomIdx, 3.2, h, 3.2, bx, h / 2, bz, pillarMat);
      }
      // Central Throne Altar
      this.addSolidBox(group, roomIdx, 10, 2.2, 10, 0, 1.1, 0, trimMat);
      // 4 Jump Pads around the Sanctum perimeter for high-speed aerial dogfighting
      this.addJumpPad(group, roomIdx, -w * 0.32, 0, 0, 29, 0);
      this.addJumpPad(group, roomIdx, w * 0.32, 0, 0, 29, 0);
      this.addJumpPad(group, roomIdx, 0, 0, l * 0.30, 28, 0);
      this.addJumpPad(group, roomIdx, 0, 0, -l * 0.30, 28, 0);

      addSpawn(0, 4.5, -4);
      addSpawn(-8, 0.2, -6);
      addSpawn(8, 0.2, -6);
      addSpawn(-8, 0.2, 6);
      addSpawn(8, 0.2, 6);
    }

    return spawns;
  };

  // ==================== UPDATE DOORS, CRUSHERS, JUMP PADS & ROOM TRIGGERS ====================
  B.LevelManager.prototype.update = function (dt, time, playerPos, onTriggerWave, onLevelComplete) {
    // 1. Animate Blast Doors
    for (var i = 0; i < this.doors.length; i++) {
      var d = this.doors[i];
      var target = d.isOpen ? 1.0 : 0.0;
      if (Math.abs(d.openProgress - target) > 0.005) {
        d.openProgress += (target - d.openProgress) * Math.min(1, dt * 8.0);
        var offset = d.openProgress * 2.65;
        d.leftPanel.position.x = -1.35 - offset;
        d.rightPanel.position.x = 1.35 + offset;
        if (d.openProgress > 0.75) {
          d.collider.minY = d.baseY + 100;
          d.collider.maxY = d.baseY + 105;
        } else {
          d.collider.minY = d.baseY;
          d.collider.maxY = d.baseY + 4.6;
        }
      }
    }

    // 2. Animate Pneumatic Crushers
    for (var c = 0; c < this.crushers.length; c++) {
      var cr = this.crushers[c];
      var cy = cr.baseY + Math.sin(time * cr.speed + cr.phase) * cr.amp;
      cr.mesh.position.y = cy;
      cr.collider.minY = cy - cr.halfH;
      cr.collider.maxY = cy + cr.halfH;
    }

    // 3. Pulse Jump Pads
    for (var j = 0; j < this.jumpPads.length; j++) {
      var jp = this.jumpPads[j];
      jp.mesh.rotation.y += dt * 2.5;
    }

    // 4. Check if Player stepped into an untriggered Combat Room
    for (var r = 0; r < this.rooms.length; r++) {
      var rm = this.rooms[r];
      if (rm.index >= 0 && !rm.triggered && !rm.cleared) {
        if (playerPos.z < rm.zStart - 2.8 && playerPos.z > rm.zEnd) {
          rm.triggered = true;
          this.activeRoomIndex = rm.index;
          this.currentWaveIndex = 0;
          this.roomLocked = true;

          // Lock entry door behind player
          this.setDoorState(rm.entryDoor, false);
          this.setDoorState(rm.exitDoor, false);

          // Update atmosphere to this room's biome (for Endless mode shifts)
          if (rm.biome) {
            this.applyBiomeAtmosphere(rm.biome);
          }

          if (onTriggerWave) {
            onTriggerWave(rm, 0);
          }
          break;
        }
      }
    }

    // 5. Check Campaign Extraction Elevator
    if (this.exitZone && this.mode === 'campaign') {
      this.exitZone.mesh.rotation.y += dt * 1.8;
      var dx = playerPos.x - this.exitZone.x;
      var dz = playerPos.z - this.exitZone.z;
      if (dx * dx + dz * dz < this.exitZone.radius * this.exitZone.radius) {
        if (onLevelComplete) {
          onLevelComplete();
        }
      }
    }
  };

  B.LevelManager.prototype.setDoorState = function (door, open) {
    if (!door) return;
    if (door.isOpen !== open) {
      door.isOpen = open;
      door.statusMat.color.setHex(open ? 0x4ade80 : 0xef4444);
      if (this.audio) this.audio.playDoorOpen();
    }
  };

  B.LevelManager.prototype.onWaveCleared = function (onSpawnWave, onRoomComplete) {
    var rm = null;
    for (var i = 0; i < this.rooms.length; i++) {
      if (this.rooms[i].index === this.activeRoomIndex) {
        rm = this.rooms[i];
        break;
      }
    }
    if (!rm) return;

    this.currentWaveIndex++;
    if (this.currentWaveIndex < rm.def.waves.length) {
      if (onSpawnWave) onSpawnWave(rm, this.currentWaveIndex);
    } else {
      // Room Cleared! Unlock the far Exit Blast Door!
      rm.cleared = true;
      this.roomLocked = false;
      this.setDoorState(rm.exitDoor, true);

      // In Endless Mode, immediately generate another room ahead so you never hit a dead end!
      if (this.mode === 'endless') {
        this.generateNextEndlessRoom();
      }
      if (onRoomComplete) onRoomComplete(rm);
    }
  };

})(window.Bloodcore);
