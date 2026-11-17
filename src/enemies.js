/**
 * BLOODCORE // ULTRAQUAKE
 * Cyber-Demonic Bot AI, Boss State Machine, Shockwave Rings & Sentry Laser Sights
 */
window.Bloodcore = window.Bloodcore || {};

(function (B) {
  'use strict';

  B.EnemyManager = function (scene, audio) {
    this.scene = scene;
    this.audio = audio;
    this.enemies = [];
    this.shockwaves = []; // Expanding floor rings from Cerberus Stomp / Boss Dive / Player Slam
    this.activeBoss = null;
  };

  B.EnemyManager.prototype.clearAll = function () {
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.parts && e.parts.root) this.scene.remove(e.parts.root);
      if (e.laserMesh) this.scene.remove(e.laserMesh);
    }
    for (var s = 0; s < this.shockwaves.length; s++) {
      this.scene.remove(this.shockwaves[s].mesh);
    }
    this.enemies = [];
    this.shockwaves = [];
    this.activeBoss = null;
  };

  B.EnemyManager.prototype.spawnEnemy = function (type, x, y, z) {
    var def = B.ENEMIES[type] || B.ENEMIES.husk;
    var parts = B.Models.createEnemyMesh(type);
    parts.root.position.set(x, y, z);
    this.scene.add(parts.root);

    // Spawn portal flash ring
    this.spawnShockwave(x, y + 0.2, z, 3.2, def.accent, false, 14.0);

    var enemy = {
      id: Math.random().toString(36).slice(2),
      type: type,
      def: def,
      parts: parts,
      pos: parts.root.position,
      vel: new THREE.Vector3(0, 0, 0),
      hp: def.hp,
      maxHp: def.hp,
      grounded: !def.flying,
      dead: false,
      dyingSpiral: false,
      spiralTimer: 0,
      enraged: false,
      burningTimer: 0,
      burnTick: 0,
      hitFlashTimer: 0,

      // AI state machine
      state: 'chase',
      stateTimer: 0.6 + Math.random() * 0.8,
      attackCooldown: 1.0 + Math.random() * 1.2,
      strafeDir: Math.random() < 0.5 ? -1 : 1,
      strafeTimer: 1.5 + Math.random() * 1.5,
      animPhase: Math.random() * Math.PI * 2,
      isParryable: false,
      laserMesh: null,
      bossPhase: 1,
      comboCount: 0
    };

    // Tag all child meshes with a reference to this enemy for raycast hit detection
    parts.root.traverse(function (child) {
      if (child.isMesh) {
        child.userData.enemy = enemy;
      }
    });

    // Create Sentry tracking laser sight mesh if type === 'sentry'
    if (type === 'sentry') {
      var lGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 5);
      lGeo.rotateX(Math.PI / 2);
      var lMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85 });
      var lMesh = new THREE.Mesh(lGeo, lMat);
      lMesh.visible = false;
      this.scene.add(lMesh);
      enemy.laserMesh = lMesh;
    }

    if (type === 'boss') {
      this.activeBoss = enemy;
    }

    this.enemies.push(enemy);
    return enemy;
  };

  B.EnemyManager.prototype.spawnShockwave = function (x, y, z, maxRadius, colorHex, hurtsPlayer, speed) {
    var geo = new THREE.TorusGeometry(1.0, 0.14, 6, 24);
    geo.rotateX(Math.PI / 2);
    var mat = new THREE.MeshBasicMaterial({
      color: colorHex || 0xef4444,
      transparent: true,
      opacity: 0.9
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + 0.25, z);
    this.scene.add(mesh);

    this.shockwaves.push({
      mesh: mesh,
      mat: mat,
      x: x,
      y: y,
      z: z,
      radius: 0.6,
      maxRadius: maxRadius || 16.0,
      speed: speed || 16.5,
      hurtsPlayer: !!hurtsPlayer,
      hitPlayer: false
    });
  };

  B.EnemyManager.prototype.update = function (dt, time, player, levelMgr, combatMgr) {
    var cols = levelMgr ? levelMgr.colliders : [];

    // 1. Update Expanding Shockwave Rings
    for (var s = this.shockwaves.length - 1; s >= 0; s--) {
      var sw = this.shockwaves[s];
      sw.radius += sw.speed * dt;
      sw.mesh.scale.set(sw.radius, 1, sw.radius);
      sw.mat.opacity = Math.max(0, 1.0 - (sw.radius / sw.maxRadius));

      if (sw.hurtsPlayer && !sw.hitPlayer && player.iFrameTime <= 0) {
        var dx = player.pos.x - sw.x;
        var dz = player.pos.z - sw.z;
        var dist = Math.hypot(dx, dz);
        var heightDiff = player.pos.y - sw.y;
        // Player can jump over the shockwave ring if heightDiff > 1.05m!
        if (Math.abs(dist - sw.radius) < 0.85 && heightDiff >= -0.4 && heightDiff < 1.05) {
          sw.hitPlayer = true;
          combatMgr.damagePlayer(24, false);
          player.vel.y = Math.max(player.vel.y, 10.0);
        }
      }

      if (sw.radius >= sw.maxRadius) {
        this.scene.remove(sw.mesh);
        this.shockwaves.splice(s, 1);
      }
    }

    // 2. Update All Active Enemies
    for (var i = this.enemies.length - 1; i >= 0; i--) {
      var e = this.enemies[i];
      if (e.dead) {
        if (e.parts && e.parts.root) this.scene.remove(e.parts.root);
        if (e.laserMesh) this.scene.remove(e.laserMesh);
        if (this.activeBoss === e) this.activeBoss = null;
        this.enemies.splice(i, 1);
        continue;
      }

      // Hit flash recovery
      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer -= dt;
        if (e.hitFlashTimer <= 0) {
          this.setEnemyFlash(e, false);
        }
      }

      // Burning DoT from Overheat Nailgun
      if (e.burningTimer > 0) {
        e.burningTimer -= dt;
        e.burnTick -= dt;
        if (e.burnTick <= 0) {
          e.burnTick = 0.25;
          combatMgr.damageEnemy(e, 6, e.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), false, 'burn');
        }
      }

      // Seeker Drone Kamikaze Death Spiral
      if (e.dyingSpiral) {
        e.spiralTimer -= dt;
        e.parts.torso.rotation.z += dt * 18.0;
        e.parts.torso.rotation.x += dt * 10.0;
        e.pos.addScaledVector(e.vel, dt);
        if (e.spiralTimer <= 0 || e.pos.distanceTo(player.pos) < 1.8) {
          combatMgr.createExplosion(e.pos.clone(), 5.5, 42, true, e.punchedByPlayer);
          e.dead = true;
        }
        continue;
      }

      // Update AI by Archetype
      this.updateEnemyAI(e, dt, time, player, cols, combatMgr);
    }
  };

  B.EnemyManager.prototype.updateEnemyAI = function (e, dt, time, player, cols, combatMgr) {
    var toPlayer = new THREE.Vector3().subVectors(player.pos, e.pos);
    var flatDist = Math.hypot(toPlayer.x, toPlayer.z);
    var flatDir = new THREE.Vector3(toPlayer.x, 0, toPlayer.z);
    if (flatDir.lengthSq() > 0.001) flatDir.normalize();

    var rightDir = new THREE.Vector3(-flatDir.z, 0, flatDir.x);

    // Smoothly face the player
    var targetYaw = Math.atan2(toPlayer.x, toPlayer.z);
    e.parts.root.rotation.y = targetYaw;

    e.attackCooldown = Math.max(0, e.attackCooldown - dt);
    e.strafeTimer -= dt;
    if (e.strafeTimer <= 0) {
      e.strafeDir = -e.strafeDir;
      e.strafeTimer = 1.2 + Math.random() * 1.6;
    }

    var moveSpd = e.def.speed * (e.enraged ? 1.42 : 1.0);

    // -------------------- 1. FILTH HUSK (MELEE SWARMER) --------------------
    if (e.type === 'husk') {
      if (e.state === 'chase') {
        if (e.grounded) {
          e.vel.x = flatDir.x * moveSpd + rightDir.x * e.strafeDir * 2.5;
          e.vel.z = flatDir.z * moveSpd + rightDir.z * e.strafeDir * 2.5;
        }
        if (flatDist < 4.6 && e.attackCooldown <= 0 && e.grounded) {
          e.state = 'windup';
          e.stateTimer = 0.28;
          e.isParryable = true;
          e.vel.x *= 0.2;
          e.vel.z *= 0.2;
          if (e.parts.eyeMat) e.parts.eyeMat.color.setHex(0x38bdf8); // Parry flash!
        }
      } else if (e.state === 'windup') {
        e.stateTimer -= dt;
        e.parts.leftArm.rotation.x = -1.8;
        e.parts.rightArm.rotation.x = -1.8;
        if (e.stateTimer <= 0) {
          e.state = 'lunge';
          e.stateTimer = 0.35;
          e.vel.x = flatDir.x * 24.0;
          e.vel.z = flatDir.z * 24.0;
          e.vel.y = 6.5;
          e.grounded = false;
        }
      } else if (e.state === 'lunge') {
        e.stateTimer -= dt;
        e.parts.leftArm.rotation.x = 0.6;
        e.parts.rightArm.rotation.x = 0.6;
        if (flatDist < 2.1 && Math.abs(player.pos.y - e.pos.y) < 2.2) {
          combatMgr.damagePlayer(e.def.damage, false);
          e.state = 'chase';
          e.isParryable = false;
          e.attackCooldown = 1.1;
          if (e.parts.eyeMat) e.parts.eyeMat.color.setHex(0xfef08a);
        } else if (e.stateTimer <= 0) {
          e.state = 'chase';
          e.isParryable = false;
          e.attackCooldown = 0.9;
          if (e.parts.eyeMat) e.parts.eyeMat.color.setHex(0xfef08a);
        }
      }
    }

    // -------------------- 2. STRAY SOLDIER (RANGED STRIKER) --------------------
    else if (e.type === 'soldier') {
      if (e.state === 'chase') {
        if (e.grounded) {
          var desiredDist = 14.0;
          var forwardWeight = flatDist > desiredDist + 3 ? 1.0 : (flatDist < desiredDist - 4 ? -0.8 : 0.15);
          e.vel.x = (flatDir.x * forwardWeight + rightDir.x * e.strafeDir * 0.85) * moveSpd;
          e.vel.z = (flatDir.z * forwardWeight + rightDir.z * e.strafeDir * 0.85) * moveSpd;
        }
        if (e.attackCooldown <= 0 && flatDist < 38) {
          e.state = 'charge_orb';
          e.stateTimer = 0.52;
          e.isParryable = true;
          if (e.parts.orbMesh) {
            e.parts.orbMesh.visible = true;
            e.parts.orbMesh.scale.setScalar(0.3);
          }
        }
      } else if (e.state === 'charge_orb') {
        e.stateTimer -= dt;
        e.vel.x *= 0.85;
        e.vel.z *= 0.85;
        e.parts.rightArm.rotation.x = -1.25;
        if (e.parts.orbMesh) {
          var s = 0.3 + (1.0 - e.stateTimer / 0.52) * 1.1;
          e.parts.orbMesh.scale.setScalar(s);
        }
        if (e.stateTimer <= 0) {
          if (e.parts.orbMesh) e.parts.orbMesh.visible = false;
          e.parts.rightArm.rotation.x = 0;
          e.isParryable = false;
          e.state = 'chase';
          e.attackCooldown = 1.65 + Math.random() * 0.6;

          var muzzlePos = e.pos.clone().add(new THREE.Vector3(0, 1.55, 0)).addScaledVector(flatDir, 0.8);
          var aimTarget = player.pos.clone().add(new THREE.Vector3(0, 1.25, 0));
          var shotDir = new THREE.Vector3().subVectors(aimTarget, muzzlePos).normalize();
          combatMgr.spawnEnemyProjectile(muzzlePos, shotDir, 25.0, e.def.damage, 0xf97316, true);
        }
      }
    }

    // -------------------- 3. SEEKER DRONE (AERIAL HARASSER) --------------------
    else if (e.type === 'drone') {
      var targetY = player.pos.y + 3.6 + Math.sin(time * 2.5 + e.animPhase) * 1.1;
      e.vel.y = (targetY - e.pos.y) * 3.5;
      var dWeight = flatDist > 16 ? 0.9 : (flatDist < 8 ? -0.7 : 0.1);
      e.vel.x = (flatDir.x * dWeight + rightDir.x * e.strafeDir) * moveSpd;
      e.vel.z = (flatDir.z * dWeight + rightDir.z * e.strafeDir) * moveSpd;

      // Tilt drone body toward player
      e.parts.torso.rotation.x = Math.atan2(e.pos.y - (player.pos.y + 1.3), Math.max(1, flatDist)) * 0.6;

      if (e.attackCooldown <= 0 && flatDist < 36) {
        e.attackCooldown = 1.85 + Math.random() * 0.6;
        var dMuzzle = e.pos.clone().addScaledVector(flatDir, 0.7);
        var dTarget = player.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
        var dDir = new THREE.Vector3().subVectors(dTarget, dMuzzle).normalize();
        combatMgr.spawnEnemyProjectile(dMuzzle, dDir, 28.0, e.def.damage, 0xe879f9, true);
      }
    }

    // -------------------- 4. CERBERUS JUGGERNAUT (HEAVY COLOSSUS) --------------------
    else if (e.type === 'juggernaut') {
      if (!e.enraged && e.hp <= e.maxHp * 0.5) {
        e.enraged = true;
        if (e.parts.eyeMat) e.parts.eyeMat.color.setHex(0xfef08a);
        this.spawnShockwave(e.pos.x, e.pos.y, e.pos.z, 12.0, 0xef4444, false, 20.0);
      }

      if (e.state === 'chase') {
        e.vel.x = flatDir.x * moveSpd;
        e.vel.z = flatDir.z * moveSpd;
        if (e.attackCooldown <= 0) {
          if (flatDist < 11.5 || Math.random() < 0.45) {
            // Seismic Stomp Shockwave!
            e.state = 'stomp_windup';
            e.stateTimer = e.enraged ? 0.45 : 0.65;
          } else {
            // Hurl Explosive Hell-Sphere!
            e.state = 'throw_windup';
            e.stateTimer = e.enraged ? 0.42 : 0.60;
            e.isParryable = true;
          }
        }
      } else if (e.state === 'stomp_windup') {
        e.stateTimer -= dt;
        e.vel.x = 0;
        e.vel.z = 0;
        e.parts.rightLeg.position.y = 1.85;
        if (e.stateTimer <= 0) {
          e.parts.rightLeg.position.y = 1.35;
          e.state = 'chase';
          e.attackCooldown = e.enraged ? 1.5 : 2.3;
          if (this.audio) this.audio.playSlam();
          this.spawnShockwave(e.pos.x, e.pos.y, e.pos.z, 22.0, 0xef4444, true, e.enraged ? 19.5 : 15.5);
        }
      } else if (e.state === 'throw_windup') {
        e.stateTimer -= dt;
        e.vel.x = 0;
        e.vel.z = 0;
        e.parts.rightArm.rotation.x = -2.2;
        if (e.stateTimer <= 0) {
          e.parts.rightArm.rotation.x = 0;
          e.isParryable = false;
          e.state = 'chase';
          e.attackCooldown = e.enraged ? 1.4 : 2.1;

          var cOrigin = e.pos.clone().add(new THREE.Vector3(0, 2.3, 0)).addScaledVector(flatDir, 1.1);
          var cTarget = player.pos.clone().add(new THREE.Vector3(0, 1.1, 0));
          var cDir = new THREE.Vector3().subVectors(cTarget, cOrigin).normalize();
          combatMgr.spawnEnemyProjectile(cOrigin, cDir, 32.0, e.def.damage, 0xfbbf24, true, true);
        }
      }
    }

    // -------------------- 5. MALICIOUS SENTRY (SNIPER SPECIALIST) --------------------
    else if (e.type === 'sentry') {
      if (e.state === 'chase') {
        e.vel.x = (flatDir.x * 0.35 + rightDir.x * e.strafeDir * 0.65) * moveSpd;
        e.vel.z = (flatDir.z * 0.35 + rightDir.z * e.strafeDir * 0.65) * moveSpd;
        if (e.laserMesh) e.laserMesh.visible = false;

        if (e.attackCooldown <= 0 && flatDist < 48) {
          e.state = 'aim_lock';
          e.stateTimer = 1.65;
          if (this.audio) this.audio.playSentryLock();
        }
      } else if (e.state === 'aim_lock') {
        e.stateTimer -= dt;
        e.vel.x = 0;
        e.vel.z = 0;

        var sOrigin = e.pos.clone().add(new THREE.Vector3(0, 1.55, 0));
        var sTarget = player.pos.clone().add(new THREE.Vector3(0, 1.25, 0));
        var sDist = sOrigin.distanceTo(sTarget);

        if (e.laserMesh) {
          e.laserMesh.visible = true;
          var mid = new THREE.Vector3().addVectors(sOrigin, sTarget).multiplyScalar(0.5);
          e.laserMesh.position.copy(mid);
          e.laserMesh.scale.set(1, 1, sDist);
          e.laserMesh.lookAt(sTarget);
          // Shift color from Cyan -> Yellow -> Flashing Red right before firing
          if (e.stateTimer > 0.7) {
            e.laserMesh.material.color.setHex(0x22d3ee);
          } else if (e.stateTimer > 0.25) {
            e.laserMesh.material.color.setHex(0xfacc15);
          } else {
            e.laserMesh.material.color.setHex(((time * 30) | 0) % 2 ? 0xef4444 : 0xffffff);
            e.isParryable = true;
          }
        }

        if (e.stateTimer <= 0) {
          if (e.laserMesh) e.laserMesh.visible = false;
          e.isParryable = false;
          e.state = 'chase';
          e.attackCooldown = 2.6;
          combatMgr.fireSentrySniperShot(e, sOrigin, sTarget);
        }
      }
    }

    // -------------------- 6. ARCHON V-0 (APEX CYBER-SERAPH BOSS) --------------------
    else if (e.type === 'boss') {
      if (!e.enraged && e.hp <= e.maxHp * 0.5) {
        e.enraged = true;
        e.bossPhase = 2;
        this.spawnShockwave(e.pos.x, e.pos.y, e.pos.z, 26.0, 0xfacc15, false, 24.0);
        combatMgr.addStyle(250, 'PHASE II // ENRAGED', '#fde047');
      }

      // Animate 6 Seraph Light-Wings
      if (e.parts.wings) {
        for (var w = 0; w < e.parts.wings.children.length; w++) {
          var wg = e.parts.wings.children[w];
          var side = w < 3 ? -1 : 1;
          var idx = w % 3;
          wg.rotation.z = side * (0.42 + idx * 0.36 + Math.sin(time * 7.5 + idx) * 0.14);
        }
      }

      if (e.state === 'chase') {
        var hoverY = player.pos.y + 2.8 + Math.sin(time * 3.2) * 0.9;
        e.vel.y = (hoverY - e.pos.y) * 4.5;
        e.vel.x = (flatDir.x * 0.55 + rightDir.x * e.strafeDir * 0.85) * moveSpd;
        e.vel.z = (flatDir.z * 0.55 + rightDir.z * e.strafeDir * 0.85) * moveSpd;

        if (e.attackCooldown <= 0) {
          var roll = Math.random();
          if (roll < 0.38) {
            // Pattern A: Spear of Light Throw (Parryable!)
            e.state = 'boss_spear';
            e.stateTimer = e.enraged ? 0.45 : 0.65;
            e.isParryable = true;
          } else if (roll < 0.72) {
            // Pattern B: Triple Aerial Blade Dash
            e.state = 'boss_dash';
            e.comboCount = e.enraged ? 3 : 2;
            e.stateTimer = 0.32;
            e.vel.x = flatDir.x * 34.0;
            e.vel.z = flatDir.z * 34.0;
            e.vel.y = (player.pos.y + 0.5 - e.pos.y) * 3.0;
            if (this.audio) this.audio.playDash();
          } else {
            // Pattern C: Judgement Dive-Bomb Shockwave
            e.state = 'boss_dive';
            e.pos.y = player.pos.y + 8.5;
            e.vel.set(0, -38.0, 0);
            e.stateTimer = 0.8;
          }
        }
      } else if (e.state === 'boss_spear') {
        e.stateTimer -= dt;
        e.vel.set(0, 0, 0);
        e.parts.rightArm.rotation.x = -2.4;
        if (e.stateTimer <= 0) {
          e.parts.rightArm.rotation.x = 0;
          e.isParryable = false;
          e.state = 'chase';
          e.attackCooldown = e.enraged ? 1.15 : 1.75;
          var bOrigin = e.pos.clone().add(new THREE.Vector3(0, 2.0, 0));
          var bTarget = player.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
          var bDir = new THREE.Vector3().subVectors(bTarget, bOrigin).normalize();
          combatMgr.spawnEnemyProjectile(bOrigin, bDir, 38.0, 30, 0xfef08a, true, true);
        }
      } else if (e.state === 'boss_dash') {
        e.stateTimer -= dt;
        e.parts.leftArm.rotation.x = -1.4;
        e.parts.rightArm.rotation.x = -1.4;
        if (flatDist < 2.6 && Math.abs(player.pos.y - e.pos.y) < 2.5) {
          combatMgr.damagePlayer(24, false);
        }
        if (e.stateTimer <= 0) {
          e.comboCount--;
          if (e.comboCount > 0) {
            e.stateTimer = 0.28;
            e.vel.x = flatDir.x * 34.0;
            e.vel.z = flatDir.z * 34.0;
            if (this.audio) this.audio.playDash();
          } else {
            e.parts.leftArm.rotation.x = 0;
            e.parts.rightArm.rotation.x = 0;
            e.state = 'chase';
            e.attackCooldown = e.enraged ? 1.1 : 1.6;
          }
        }
      } else if (e.state === 'boss_dive') {
        e.stateTimer -= dt;
        if (e.pos.y <= 0.6 || e.stateTimer <= 0) {
          e.pos.y = Math.max(0.4, e.pos.y);
          e.vel.set(0, 0, 0);
          if (this.audio) this.audio.playSlam();
          this.spawnShockwave(e.pos.x, 0.1, e.pos.z, 26.0, 0xfacc15, true, 19.0);
          e.state = 'chase';
          e.attackCooldown = e.enraged ? 1.2 : 1.8;
        }
      }
    }

    // Apply Physics & Procedural Walk Animation
    this.integrateEnemyPhysics(e, dt, cols);
    this.animateEnemyLimbs(e, dt);
  };

  B.EnemyManager.prototype.integrateEnemyPhysics = function (e, dt, cols) {
    if (!e.def.flying) {
      e.vel.y -= B.PHYSICS.GRAVITY * dt;
    }

    var r = e.def.radius;
    var h = e.def.height;

    e.pos.x += e.vel.x * dt;
    e.pos.z += e.vel.z * dt;

    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      if (e.pos.y + h <= c.minY + 0.05 || e.pos.y >= c.maxY - 0.05) continue;
      if (e.pos.x + r > c.minX && e.pos.x - r < c.maxX &&
          e.pos.z + r > c.minZ && e.pos.z - r < c.maxZ) {
        var stepH = c.maxY - e.pos.y;
        if (e.grounded && stepH > 0 && stepH <= 0.85) {
          e.pos.y = c.maxY;
          continue;
        }
        var oL = (e.pos.x + r) - c.minX;
        var oR = c.maxX - (e.pos.x - r);
        var oB = (e.pos.z + r) - c.minZ;
        var oF = c.maxZ - (e.pos.z - r);
        if (Math.min(oL, oR) < Math.min(oB, oF)) {
          e.pos.x = (oL < oR) ? (c.minX - r) : (c.maxX + r);
        } else {
          e.pos.z = (oB < oF) ? (c.minZ - r) : (c.maxZ + r);
        }
      }
    }

    e.pos.y += e.vel.y * dt;
    if (!e.def.flying) {
      e.grounded = false;
      for (var j = 0; j < cols.length; j++) {
        var cy = cols[j];
        if (e.pos.x + r <= cy.minX || e.pos.x - r >= cy.maxX ||
            e.pos.z + r <= cy.minZ || e.pos.z - r >= cy.maxZ) {
          continue;
        }
        if (e.pos.y + h > cy.minY && e.pos.y < cy.maxY) {
          if (e.vel.y <= 0 && Math.abs(e.pos.y - cy.maxY) < 1.2) {
            e.pos.y = cy.maxY;
            e.vel.y = 0;
            e.grounded = true;
          }
        }
      }
      if (e.pos.y < 0) {
        e.pos.y = 0;
        e.vel.y = 0;
        e.grounded = true;
      }
    } else {
      if (e.pos.y < 0.5) e.pos.y = 0.5;
    }
  };

  B.EnemyManager.prototype.animateEnemyLimbs = function (e, dt) {
    var horizSpd = Math.hypot(e.vel.x, e.vel.z);
    if (horizSpd > 0.5 && !e.def.flying) {
      e.animPhase += dt * horizSpd * 0.95;
      var swing = Math.sin(e.animPhase) * 0.65;
      e.parts.leftLeg.rotation.x = swing;
      e.parts.rightLeg.rotation.x = -swing;
      if (e.state === 'chase') {
        e.parts.leftArm.rotation.x = -swing * 0.6;
        e.parts.rightArm.rotation.x = swing * 0.6;
      }
    }
  };

  B.EnemyManager.prototype.setEnemyFlash = function (e, flashOn) {
    if (!e || !e.parts || !e.parts.root) return;
    e.parts.root.traverse(function (m) {
      if (m.isMesh && m.material && m.material.emissive) {
        m.material.emissive.setHex(flashOn ? 0xffffff : 0x000000);
        m.material.emissiveIntensity = flashOn ? 0.65 : 0;
      }
    });
  };

})(window.Bloodcore);
