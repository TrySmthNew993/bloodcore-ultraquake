/**
 * BLOODCORE // ULTRAQUAKE
 * Weapons, Coin Ricochets, Core Nukes, Projectile Boost, Feedbacker Parry,
 * Blood-is-Fuel Healing, Dynamic Explosion Lights & Low-Poly Voxel Gibs.
 */
window.Bloodcore = window.Bloodcore || {};

(function (B) {
  'use strict';

  B.CombatManager = function (scene, camera, player, enemyMgr, viewmodel, audio, onStyleEvent, onKillEvent, onScreenFlash) {
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.enemyMgr = enemyMgr;
    this.viewmodel = viewmodel;
    this.audio = audio;
    this.onStyleEvent = onStyleEvent;
    this.onKillEvent = onKillEvent;
    this.onScreenFlash = onScreenFlash;

    this.currentWeaponIdx = 0;
    this.previousWeaponIdx = 1;
    this.fireCooldown = 0;

    // Weapon-specific meters & cooldowns
    this.coins = 4.0; // up to 4.0 coins
    this.activeCoins = []; // Airborne 3D coins
    this.coreCooldown = 0;
    this.activeCores = []; // Airborne Shotgun plasma cores
    this.nailHeat = 0;
    this.overheatBurstLeft = 0;
    this.railCharge = 1.0; // 0.0 to 1.0

    // Punch & Projectile Boost state
    this.punchCooldown = 0;
    this.punchAnimTimer = 0;
    this.projBoostWindow = 0;
    this.hitstopTimer = 0;

    // Active projectiles, beams, explosions & gore particles
    this.playerProjectiles = [];
    this.enemyProjectiles = [];
    this.beams = [];
    this.explosions = [];
    this.particles = [];

    this.raycaster = new THREE.Raycaster();
  };

  B.CombatManager.prototype.reset = function () {
    var i;
    for (i = 0; i < this.activeCoins.length; i++) this.scene.remove(this.activeCoins[i].mesh);
    for (i = 0; i < this.activeCores.length; i++) this.scene.remove(this.activeCores[i].mesh);
    for (i = 0; i < this.playerProjectiles.length; i++) this.scene.remove(this.playerProjectiles[i].mesh);
    for (i = 0; i < this.enemyProjectiles.length; i++) this.scene.remove(this.enemyProjectiles[i].mesh);
    for (i = 0; i < this.beams.length; i++) this.scene.remove(this.beams[i].mesh);
    for (i = 0; i < this.explosions.length; i++) {
      this.scene.remove(this.explosions[i].mesh);
      if (this.explosions[i].light) this.scene.remove(this.explosions[i].light);
    }
    for (i = 0; i < this.particles.length; i++) this.scene.remove(this.particles[i].mesh);

    this.activeCoins = [];
    this.activeCores = [];
    this.playerProjectiles = [];
    this.enemyProjectiles = [];
    this.beams = [];
    this.explosions = [];
    this.particles = [];

    this.currentWeaponIdx = 0;
    this.previousWeaponIdx = 1;
    this.fireCooldown = 0;
    this.coins = 4.0;
    this.coreCooldown = 0;
    this.nailHeat = 0;
    this.overheatBurstLeft = 0;
    this.railCharge = 1.0;
    this.punchCooldown = 0;
    this.punchAnimTimer = 0;
    this.projBoostWindow = 0;
    this.hitstopTimer = 0;
    this.switchWeapon(0);
  };

  B.CombatManager.prototype.switchWeapon = function (idx) {
    if (idx < 0 || idx >= B.WEAPONS.length) return;
    if (idx !== this.currentWeaponIdx) {
      this.previousWeaponIdx = this.currentWeaponIdx;
      this.currentWeaponIdx = idx;
      this.fireCooldown = Math.min(this.fireCooldown, 0.12);
    }
    var wId = B.WEAPONS[this.currentWeaponIdx].id;
    for (var k in this.viewmodel.weapons) {
      this.viewmodel.weapons[k].visible = (k === wId);
    }
    this.viewmodel.gunMount.position.y = -0.36; // quick draw dip
  };

  B.CombatManager.prototype.quickSwap = function () {
    this.switchWeapon(this.previousWeaponIdx);
  };

  B.CombatManager.prototype.addStyle = function (points, label, color) {
    if (this.onStyleEvent) this.onStyleEvent(points, label, color);
  };

  // ==================== PRIMARY FIRE (LMB) ====================
  B.CombatManager.prototype.firePrimary = function () {
    if (this.fireCooldown > 0) return;
    var w = B.WEAPONS[this.currentWeaponIdx];
    var fwd = this.player.getForwardVector();
    var muzzleOrigin = this.camera.position.clone()
      .addScaledVector(fwd, 0.55)
      .add(new THREE.Vector3(0, -0.12, 0));

    // 1. MARKSMAN REVOLVER (Precision Hitscan + Coin Check)
    if (w.id === 'revolver') {
      this.fireCooldown = w.fireRate;
      this.player.recoilPitch += 0.045;
      this.viewmodel.gunMount.position.z = -0.32;
      this.viewmodel.muzzleLight.color.setHex(0xfacc15);
      this.viewmodel.muzzleLight.intensity = 3.5;
      if (this.viewmodel.weapons.revolver.userData.cylinder) {
        this.viewmodel.weapons.revolver.userData.cylinder.rotation.y += Math.PI / 3;
      }
      if (this.audio) this.audio.playRevolver();

      this.fireHitscanBeam(this.camera.position.clone(), fwd, w.damage, 0xfacc15, false, muzzleOrigin);
    }

    // 2. CORE-EJECT SHOTGUN (12-Pellet Spread + Projectile Boost Window)
    else if (w.id === 'shotgun') {
      this.fireCooldown = w.fireRate;
      this.projBoostWindow = 0.20; // Press F within 0.20s to +PROJECTILE BOOST!
      this.player.recoilPitch += 0.075;
      this.player.screenShake = Math.max(this.player.screenShake, 0.22);
      this.viewmodel.gunMount.position.z = -0.26;
      this.viewmodel.muzzleLight.color.setHex(0xf97316);
      this.viewmodel.muzzleLight.intensity = 4.2;
      if (this.audio) this.audio.playShotgun();

      var right = this.player.getFlatRight();
      var up = new THREE.Vector3().crossVectors(right, fwd).normalize();

      for (var p = 0; p < w.pellets; p++) {
        var rx = (Math.random() - 0.5) * w.spread * 2;
        var ry = (Math.random() - 0.5) * w.spread * 2;
        var pDir = fwd.clone().addScaledVector(right, rx).addScaledVector(up, ry).normalize();
        this.fireHitscanBeam(this.camera.position.clone(), pDir, w.pelletDamage, 0xfb923c, false, muzzleOrigin, true);
      }
    }

    // 3. ATTRACTOR NAILGUN (Rapid Twin-Barrel Physical Nails)
    else if (w.id === 'nailgun') {
      var isOverheat = this.overheatBurstLeft > 0;
      this.fireCooldown = isOverheat ? 0.036 : w.fireRate;
      if (!isOverheat) {
        this.nailHeat = Math.min(1.0, this.nailHeat + w.heatPerShot);
      }
      this.player.recoilPitch += 0.012;
      this.viewmodel.gunMount.position.z = -0.40;
      this.viewmodel.muzzleLight.color.setHex(isOverheat ? 0xf97316 : 0x38bdf8);
      this.viewmodel.muzzleLight.intensity = 2.2;
      if (this.viewmodel.weapons.nailgun.userData.rotor) {
        this.viewmodel.weapons.nailgun.userData.rotor.rotation.z += 0.65;
      }
      if (this.audio) this.audio.playNailgun(isOverheat);

      var spread = isOverheat ? 0.055 : 0.028;
      var nDir = fwd.clone();
      nDir.x += (Math.random() - 0.5) * spread;
      nDir.y += (Math.random() - 0.5) * spread;
      nDir.z += (Math.random() - 0.5) * spread;
      nDir.normalize();

      this.spawnPlayerProjectile({
        pos: muzzleOrigin,
        vel: nDir.multiplyScalar(w.nailSpeed),
        damage: isOverheat ? w.nailDamage * 1.35 : w.nailDamage,
        radius: 0.25,
        color: isOverheat ? 0xf97316 : 0x38bdf8,
        type: isOverheat ? 'burn_nail' : 'nail',
        gravity: 3.5,
        life: 2.2
      });
    }

    // 4. ROCKET LAUNCHER (Slot 4 Primary Fire: High-Velocity Rocket + Rocket Jump)
    else if (w.id === 'railcannon') {
      this.fireCooldown = w.rocketFireRate;
      this.player.recoilPitch += 0.065;
      this.viewmodel.gunMount.position.z = -0.28;
      this.viewmodel.muzzleLight.color.setHex(0xc084fc);
      this.viewmodel.muzzleLight.intensity = 3.8;
      if (this.audio) this.audio.playRocket();

      this.spawnPlayerProjectile({
        pos: muzzleOrigin,
        vel: fwd.clone().multiplyScalar(w.rocketSpeed),
        damage: w.rocketDamage,
        radius: 0.42,
        splashRadius: w.rocketRadius,
        color: 0xf43f5e,
        type: 'rocket',
        gravity: 0,
        life: 4.0
      });
    }
  };

  // ==================== ALT-FIRE (RMB) ====================
  B.CombatManager.prototype.fireAlt = function () {
    var w = B.WEAPONS[this.currentWeaponIdx];
    var fwd = this.player.getForwardVector();

    // 1. REVOLVER ALT: COIN TOSS!
    if (w.id === 'revolver') {
      if (this.coins < 1.0) return;
      this.coins -= 1.0;
      if (this.audio) this.audio.playCoinToss(this.activeCoins.length);

      var coinGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.05, 8);
      var coinMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
      var coinMesh = new THREE.Mesh(coinGeo, coinMat);

      // Add a glowing glint ring around the coin so it's easy to spot and shoot in mid-air!
      var ringGeo = new THREE.TorusGeometry(0.38, 0.03, 4, 12);
      var ringMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.75 });
      coinMesh.add(new THREE.Mesh(ringGeo, ringMat));

      var cPos = this.camera.position.clone().addScaledVector(fwd, 0.8);
      coinMesh.position.copy(cPos);
      this.scene.add(coinMesh);

      // Coin inherits player velocity + upward/forward arc along crosshair!
      var cVel = new THREE.Vector3(
        this.player.vel.x * 0.75 + fwd.x * 13.5,
        Math.max(0, this.player.vel.y * 0.5) + fwd.y * 11.0 + 10.5,
        this.player.vel.z * 0.75 + fwd.z * 13.5
      );

      this.activeCoins.push({
        mesh: coinMesh,
        pos: coinMesh.position,
        vel: cVel,
        life: 4.0
      });
    }

    // 2. SHOTGUN ALT: CORE EJECT GRENADE!
    else if (w.id === 'shotgun') {
      if (this.coreCooldown > 0) return;
      this.coreCooldown = w.coreCooldown;
      this.player.recoilPitch += 0.05;
      this.viewmodel.gunMount.position.z = -0.30;
      if (this.audio) this.audio.playCoreEject();

      var coreGeo = new THREE.OctahedronGeometry(0.34, 0);
      var coreMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
      var coreMesh = new THREE.Mesh(coreGeo, coreMat);
      var corePos = this.camera.position.clone().addScaledVector(fwd, 0.85);
      coreMesh.position.copy(corePos);
      this.scene.add(coreMesh);

      var coreVel = new THREE.Vector3(
        this.player.vel.x * 0.5 + fwd.x * 26.0,
        fwd.y * 24.0 + 6.5,
        this.player.vel.z * 0.5 + fwd.z * 26.0
      );

      this.activeCores.push({
        mesh: coreMesh,
        pos: coreMesh.position,
        vel: coreVel,
        damage: w.coreDamage,
        life: 3.5
      });
    }

    // 3. NAILGUN ALT: OVERHEAT HEATSINK SALVO!
    else if (w.id === 'nailgun') {
      if (this.nailHeat < 0.22 || this.overheatBurstLeft > 0) return;
      this.overheatBurstLeft = 0.55 + this.nailHeat * 0.75;
      this.nailHeat = 0;
      this.addStyle(75, '+OVERHEAT SALVO', '#fb923c');
    }

    // 4. ELECTRIC RAILCANNON (Slot 4 Alt-Fire: Instant Piercing Lightning Beam!)
    else if (w.id === 'railcannon') {
      if (this.railCharge < 1.0) return;
      this.railCharge = 0;
      this.player.recoilPitch += 0.095;
      this.player.screenShake = Math.max(this.player.screenShake, 0.42);
      this.viewmodel.gunMount.position.z = -0.22;
      this.viewmodel.muzzleLight.color.setHex(0x38bdf8);
      this.viewmodel.muzzleLight.intensity = 6.0;
      if (this.audio) this.audio.playRailcannon();
      if (this.onScreenFlash) this.onScreenFlash('rgba(56, 189, 248, 0.28)');

      var muzzleOrigin = this.camera.position.clone()
        .addScaledVector(fwd, 0.6)
        .add(new THREE.Vector3(0, -0.1, 0));

      this.fireHitscanBeam(this.camera.position.clone(), fwd, w.railDamage, 0x38bdf8, true, muzzleOrigin);
    }
  };

  // ==================== FEEDBACKER PUNCH & PARRY (F KEY) ====================
  B.CombatManager.prototype.triggerPunch = function () {
    if (this.punchCooldown > 0) return;
    this.punchCooldown = 0.36;
    this.punchAnimTimer = 0.24;
    if (this.audio) this.audio.playPunch();

    var fwd = this.player.getForwardVector();
    var camPos = this.camera.position.clone();

    // 1. Check Shotgun +PROJECTILE BOOST (Punching your own just-fired shotgun pellets!)
    if (this.projBoostWindow > 0 && B.WEAPONS[this.currentWeaponIdx].id === 'shotgun') {
      this.projBoostWindow = 0;
      this.hitstopTimer = 0.065;
      if (this.audio) this.audio.playParry();
      if (this.onScreenFlash) this.onScreenFlash('rgba(251, 146, 60, 0.32)');
      this.addStyle(150, '+PROJECTILE BOOST', '#fb923c');

      this.spawnPlayerProjectile({
        pos: camPos.clone().addScaledVector(fwd, 0.8),
        vel: fwd.clone().multiplyScalar(58.0),
        damage: 85,
        radius: 0.45,
        splashRadius: 6.5,
        color: 0xfde047,
        type: 'proj_boost',
        gravity: 0,
        life: 3.0
      });
      return;
    }

    // 2. Check Incoming Enemy Projectiles for +PARRY!
    for (var i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      var ep = this.enemyProjectiles[i];
      if (!ep.parryable) continue;
      var toProj = new THREE.Vector3().subVectors(ep.pos, camPos);
      var dist = toProj.length();
      if (dist < 5.2 && toProj.normalize().dot(fwd) > 0.45) {
        // PARRY SUCCESS!
        this.scene.remove(ep.mesh);
        this.enemyProjectiles.splice(i, 1);

        this.executeParrySuccess();
        this.spawnPlayerProjectile({
          pos: camPos.clone().addScaledVector(fwd, 0.9),
          vel: fwd.clone().multiplyScalar(64.0),
          damage: 120,
          radius: 0.5,
          splashRadius: 7.5,
          color: 0xfde047,
          type: 'parried_orb',
          gravity: 0,
          life: 3.5
        });
        return;
      }
    }

    // 3. Check Enemies in Melee Cone (Parryable Windup, Dying Drone Homerun, or Direct Punch)
    for (var eIdx = 0; eIdx < this.enemyMgr.enemies.length; eIdx++) {
      var e = this.enemyMgr.enemies[eIdx];
      if (e.dead) continue;
      var eCenter = e.pos.clone().add(new THREE.Vector3(0, e.def.height * 0.55, 0));
      var toEnemy = new THREE.Vector3().subVectors(eCenter, camPos);
      var eDist = toEnemy.length();

      if (eDist < 4.8 && toEnemy.normalize().dot(fwd) > 0.48) {
        if (e.dyingSpiral) {
          // +HOMERUN: Punch spiraling Seeker Drone like a missile!
          e.vel.copy(fwd).multiplyScalar(48.0);
          e.spiralTimer = 1.5;
          e.punchedByPlayer = true;
          this.executeParrySuccess('+HOMERUN');
          return;
        } else if (e.isParryable) {
          // +PARRY on enemy melee/charge windup!
          e.isParryable = false;
          e.state = 'chase';
          e.attackCooldown = 1.6;
          this.executeParrySuccess('+PARRY');
          this.createExplosion(eCenter, 6.0, 110, false, true);
          return;
        } else {
          // Standard heavy knuckle punch
          this.damageEnemy(e, 30, eCenter, false, 'punch');
          e.vel.addScaledVector(fwd, 16.0);
          if (e.def.lightweight) e.vel.y = Math.max(e.vel.y, 9.0);
          return;
        }
      }
    }
  };

  B.CombatManager.prototype.executeParrySuccess = function (customStyleText) {
    this.hitstopTimer = 0.085; // Crisp 85ms frame freeze!
    this.player.hardDamage = 0;
    this.healPlayer(50);
    this.player.stamina = B.PHYSICS.STAMINA_MAX;
    this.player.screenShake = Math.max(this.player.screenShake, 0.42);
    if (this.audio) this.audio.playParry();
    if (this.onScreenFlash) this.onScreenFlash('rgba(250, 204, 21, 0.42)');
    this.addStyle(180, customStyleText || '+PARRY', '#fde047');
  };

  // ==================== HITSCAN RAYCAST, COIN RICOCHET & CORE NUKE ====================
  B.CombatManager.prototype.fireHitscanBeam = function (origin, dir, damage, colorHex, isPiercing, visualStart, isPellet) {
    var vStart = visualStart || origin;

    // 1. Check if Shot Hits an Airborne Shotgun Plasma Core (+CORE NUKE!)
    if (!isPellet) {
      for (var c = this.activeCores.length - 1; c >= 0; c--) {
        var core = this.activeCores[c];
        var toCore = new THREE.Vector3().subVectors(core.pos, origin);
        var projLen = toCore.dot(dir);
        if (projLen > 0) {
          var closestPt = origin.clone().addScaledVector(dir, projLen);
          if (closestPt.distanceTo(core.pos) < 0.95) {
            var nukePos = core.pos.clone();
            this.scene.remove(core.mesh);
            this.activeCores.splice(c, 1);

            this.spawnBeam(vStart, nukePos, isPiercing ? 0x38bdf8 : 0xfde047, 0.14);
            this.hitstopTimer = 0.075;
            if (this.onScreenFlash) this.onScreenFlash('rgba(251, 146, 60, 0.42)');
            this.addStyle(isPiercing ? 320 : 240, isPiercing ? '+ULTRANUKE' : '+CORE NUKE', '#fde047');
            this.createExplosion(nukePos, isPiercing ? 14.5 : 11.5, isPiercing ? 210 : 145, false, true);
            return;
          }
        }
      }
    }

    // 2. Check if Shot Hits an Airborne Coin (+RICOSHOT / +ULTRARICOSHOT!)
    if (!isPellet) {
      for (var k = this.activeCoins.length - 1; k >= 0; k--) {
        var coin = this.activeCoins[k];
        var toCoin = new THREE.Vector3().subVectors(coin.pos, origin);
        var cProj = toCoin.dot(dir);
        if (cProj > 0) {
          var cClosest = origin.clone().addScaledVector(dir, cProj);
          if (cClosest.distanceTo(coin.pos) < 1.05) {
            this.triggerCoinRicochet(coin, k, vStart, damage, isPiercing, 1);
            return;
          }
        }
      }
    }

    // 3. Raycast against Enemies & World Architecture
    this.raycaster.set(origin, dir);
    this.raycaster.near = 0.1;
    this.raycaster.far = 110;

    var intersects = this.raycaster.intersectObjects(this.scene.children, true);
    var endPoint = origin.clone().addScaledVector(dir, 90);
    var hitEnemiesCount = 0;
    var hitEnemySet = {};

    for (var i = 0; i < intersects.length; i++) {
      var hit = intersects[i];
      var obj = hit.object;

      // Ignore viewmodel, coins, lasers, shockwaves, particles
      if (!obj.visible) continue;
      var enemy = obj.userData ? obj.userData.enemy : null;

      if (enemy && !enemy.dead) {
        if (hitEnemySet[enemy.id]) continue;
        hitEnemySet[enemy.id] = true;
        hitEnemiesCount++;

        var isHeadshot = !!(obj.userData && obj.userData.isWeakpoint) ||
                         (hit.point.y > enemy.pos.y + enemy.def.height * 0.68);
        var finalDmg = isHeadshot && !isPellet ? damage * 1.85 : damage;

        this.damageEnemy(enemy, finalDmg, hit.point, isHeadshot && !isPellet, isPiercing ? 'rail' : 'gun');

        if (!isPiercing) {
          endPoint.copy(hit.point);
          break;
        }
      } else if (obj.receiveShadow && !enemy) {
        // Hit world wall/floor geometry
        endPoint.copy(hit.point);
        this.spawnImpactSparks(hit.point, colorHex, isPellet ? 2 : 6);
        break;
      }
    }

    if (isPiercing && hitEnemiesCount >= 2) {
      this.addStyle(180 * hitEnemiesCount, '+CONDUCTOR x' + hitEnemiesCount, '#38bdf8');
    }

    this.spawnBeam(vStart, endPoint, colorHex, isPiercing ? 0.15 : (isPellet ? 0.025 : 0.055));
  };

  // Chains across all airborne coins and auto-targets a Core Nuke, Sentry Chargeback, or Enemy Weakpoint!
  B.CombatManager.prototype.triggerCoinRicochet = function (coin, coinIdx, fromPos, baseDamage, isRail, chainCount) {
    var coinPos = coin.pos.clone();
    this.scene.remove(coin.mesh);
    this.activeCoins.splice(coinIdx, 1);

    this.spawnBeam(fromPos, coinPos, isRail ? 0x38bdf8 : 0xfde047, 0.11);
    this.spawnImpactSparks(coinPos, 0xfde047, 10);
    if (this.audio) this.audio.playRicoshot(chainCount);
    this.hitstopTimer = Math.max(this.hitstopTimer, 0.055);

    // Check if another coin is airborne to chain into (+ULTRARICOSHOT!)
    if (this.activeCoins.length > 0) {
      var nextCoin = this.activeCoins[0];
      this.triggerCoinRicochet(nextCoin, 0, coinPos, baseDamage, isRail, chainCount + 1);
      return;
    }

    // Priority 1: Airborne Shotgun Core -> Auto-Core Nuke!
    if (this.activeCores.length > 0) {
      var core = this.activeCores.pop();
      var corePos = core.pos.clone();
      this.scene.remove(core.mesh);
      this.spawnBeam(coinPos, corePos, 0xfde047, 0.14);
      this.addStyle(300, '+RICOSHOT NUKE', '#fde047');
      this.createExplosion(corePos, 13.0, 175, false, true);
      return;
    }

    // Priority 2: Closest Live Enemy Weakpoint!
    var bestEnemy = null;
    var bestDist = Infinity;
    for (var i = 0; i < this.enemyMgr.enemies.length; i++) {
      var e = this.enemyMgr.enemies[i];
      if (e.dead) continue;
      var d = e.pos.distanceTo(coinPos);
      if (d < bestDist) {
        bestDist = d;
        bestEnemy = e;
      }
    }

    if (bestEnemy) {
      var targetPt = bestEnemy.pos.clone().add(new THREE.Vector3(0, bestEnemy.def.height * 0.78, 0));
      this.spawnBeam(coinPos, targetPt, isRail ? 0x38bdf8 : 0xfde047, 0.12);

      var ricoDmg = (isRail ? 185 : 72) + (chainCount - 1) * 48;
      if (bestEnemy.type === 'sentry' && bestEnemy.state === 'aim_lock') {
        bestEnemy.state = 'chase';
        if (bestEnemy.laserMesh) bestEnemy.laserMesh.visible = false;
        ricoDmg *= 1.8;
        this.addStyle(280, '+CHARGEBACK', '#22d3ee');
      } else {
        var styleName = chainCount > 1 ? ('+ULTRARICOSHOT x' + chainCount) : '+RICOSHOT';
        this.addStyle(110 * chainCount, styleName, '#fde047');
      }

      this.damageEnemy(bestEnemy, ricoDmg, targetPt, true, 'ricoshot');
      if (isRail) {
        this.createExplosion(targetPt, 8.5, 95, false, true);
      }
    } else {
      // No enemy found: ricochet into the distance
      var randEnd = coinPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 20, 8, -25));
      this.spawnBeam(coinPos, randEnd, 0xfde047, 0.09);
    }
  };

  B.CombatManager.prototype.fireSentrySniperShot = function (sentry, origin, targetPos) {
    if (this.audio) this.audio.playRailcannon();
    // If player threw a coin near the beam line, auto-deflect (+CHARGEBACK)!
    var dir = new THREE.Vector3().subVectors(targetPos, origin).normalize();
    for (var c = this.activeCoins.length - 1; c >= 0; c--) {
      var coin = this.activeCoins[c];
      var toCoin = new THREE.Vector3().subVectors(coin.pos, origin);
      var proj = toCoin.dot(dir);
      if (proj > 0) {
        var pt = origin.clone().addScaledVector(dir, proj);
        if (pt.distanceTo(coin.pos) < 1.8) {
          this.triggerCoinRicochet(coin, c, origin, 140, true, 1);
          return;
        }
      }
    }

    this.spawnBeam(origin, targetPos, 0xef4444, 0.11);
    if (this.player.iFrameTime <= 0 && this.player.pos.distanceTo(targetPos) < 2.2) {
      this.damagePlayer(sentry.def.damage, false);
    }
  };

  // ==================== DAMAGE, GIBS & BLOOD-IS-FUEL HEALING ====================
  B.CombatManager.prototype.damageEnemy = function (enemy, amount, hitPoint, isHeadshot, sourceType) {
    if (!enemy || enemy.dead) return;

    // Bonus style for hitting airborne enemies!
    var isAirborne = !enemy.grounded && !enemy.def.flying && enemy.pos.y > 1.2;
    if (isAirborne && sourceType !== 'burn') {
      amount *= 1.25;
      this.addStyle(70, '+AIRSHOT', '#38bdf8');
    } else if (isHeadshot && sourceType === 'gun') {
      this.addStyle(65, '+HEADSHOT', '#facc15');
    }

    enemy.hp -= amount;
    enemy.hitFlashTimer = 0.09;
    this.enemyMgr.setEnemyFlash(enemy, true);

    if (sourceType === 'burn_nail') {
      enemy.burningTimer = 3.5;
    }

    // Spawn Blood Splash & check close-range Blood-is-Fuel Heal!
    var bloodCount = Math.min(14, Math.max(3, Math.round(amount / 10)));
    this.spawnBloodAndGibs(hitPoint || enemy.pos, bloodCount, false);

    var distToPlayer = this.player.pos.distanceTo(enemy.pos);
    if (distToPlayer <= B.PHYSICS.BLOOD_HEAL_RADIUS) {
      this.healPlayer(Math.min(28, amount * 0.36));
    }

    // Check Death
    if (enemy.hp <= 0 && !enemy.dyingSpiral) {
      if (enemy.type === 'drone' && sourceType !== 'explosion') {
        // Seeker Drone enters Kamikaze Death Spiral toward player (can be punched for +HOMERUN!)
        enemy.dyingSpiral = true;
        enemy.spiralTimer = 1.15;
        var toP = new THREE.Vector3().subVectors(this.player.pos, enemy.pos).normalize();
        enemy.vel.copy(toP).multiplyScalar(17.5);
        return;
      }

      enemy.dead = true;
      var deathCenter = enemy.pos.clone().add(new THREE.Vector3(0, enemy.def.height * 0.5, 0));
      this.spawnBloodAndGibs(deathCenter, enemy.def.bloodAmount, true);

      if (distToPlayer <= B.PHYSICS.BLOOD_HEAL_RADIUS + 2.5) {
        this.healPlayer(enemy.def.bloodAmount * 1.1);
      }

      if (this.audio) this.audio.playEnemyDeath(!enemy.def.lightweight);
      if (isAirborne && sourceType === 'explosion') {
        this.addStyle(140, '+FIREWORKS', '#f43f5e');
      } else {
        this.addStyle(enemy.def.score, '+KILL // ' + enemy.def.name.split(' ')[0], '#f87171');
      }
      if (this.onKillEvent) this.onKillEvent(enemy);
    }
  };

  B.CombatManager.prototype.healPlayer = function (rawHeal) {
    if (this.player.hp <= 0) return;
    var cap = Math.max(15, 100 - this.player.hardDamage);
    if (this.player.hp < cap) {
      var prev = this.player.hp;
      this.player.hp = Math.min(cap, this.player.hp + rawHeal);
      if (this.player.hp - prev >= 5 && this.audio) {
        this.audio.playBloodHeal();
      }
    }
  };

  B.CombatManager.prototype.damagePlayer = function (amount, isHazard) {
    if (this.player.iFrameTime > 0 || this.player.hp <= 0) return;
    this.player.hp = Math.max(0, this.player.hp - amount);
    if (!isHazard) {
      this.player.hardDamage = Math.min(65, this.player.hardDamage + amount * 0.35);
      this.player.iFrameTime = 0.32;
    }
    this.player.screenShake = Math.max(this.player.screenShake, 0.38);
    if (this.audio) this.audio.playPlayerHurt();
    if (this.onScreenFlash) this.onScreenFlash('rgba(239, 68, 68, 0.45)');
  };

  // ==================== PROJECTILES, EXPLOSIONS, BEAMS & GIBS ====================
  B.CombatManager.prototype.spawnPlayerProjectile = function (cfg) {
    var geo = cfg.type === 'nail' || cfg.type === 'burn_nail'
      ? new THREE.CylinderGeometry(0.04, 0.04, 0.55, 5)
      : new THREE.OctahedronGeometry(cfg.radius || 0.32, 0);
    if (cfg.type === 'nail' || cfg.type === 'burn_nail') {
      geo.rotateX(Math.PI / 2);
    }
    var mat = new THREE.MeshBasicMaterial({ color: cfg.color || 0xfacc15 });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(cfg.pos);
    mesh.lookAt(cfg.pos.clone().add(cfg.vel));
    this.scene.add(mesh);

    this.playerProjectiles.push({
      mesh: mesh,
      pos: mesh.position,
      vel: cfg.vel,
      damage: cfg.damage,
      radius: cfg.radius || 0.3,
      splashRadius: cfg.splashRadius || 0,
      color: cfg.color,
      type: cfg.type,
      gravity: cfg.gravity || 0,
      life: cfg.life || 3.0
    });
  };

  B.CombatManager.prototype.spawnEnemyProjectile = function (pos, dir, speed, damage, colorHex, parryable, explosive) {
    var geo = new THREE.OctahedronGeometry(explosive ? 0.38 : 0.28, 0);
    var mat = new THREE.MeshBasicMaterial({ color: colorHex || 0xf97316 });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    this.scene.add(mesh);

    this.enemyProjectiles.push({
      mesh: mesh,
      pos: mesh.position,
      vel: dir.clone().multiplyScalar(speed),
      damage: damage,
      color: colorHex,
      parryable: parryable !== false,
      explosive: !!explosive,
      life: 4.5
    });
  };

  B.CombatManager.prototype.createExplosion = function (pos, radius, damage, canHurtPlayer, isMega) {
    if (this.audio) this.audio.playExplosion(isMega);
    this.player.screenShake = Math.max(this.player.screenShake, isMega ? 0.52 : 0.28);

    var geo = new THREE.OctahedronGeometry(1.0, 1);
    var mat = new THREE.MeshBasicMaterial({
      color: isMega ? 0xfde047 : 0xf97316,
      transparent: true,
      opacity: 0.88,
      wireframe: false
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    this.scene.add(mesh);

    var light = new THREE.PointLight(isMega ? 0xfacc15 : 0xff5500, isMega ? 6.0 : 3.5, radius * 2.5, 1.5);
    light.position.copy(pos);
    this.scene.add(light);

    this.explosions.push({
      mesh: mesh,
      mat: mat,
      light: light,
      maxRadius: radius,
      age: 0,
      duration: isMega ? 0.42 : 0.28
    });

    // Damage & Launch Enemies inside Blast Radius
    for (var i = 0; i < this.enemyMgr.enemies.length; i++) {
      var e = this.enemyMgr.enemies[i];
      if (e.dead) continue;
      var eCenter = e.pos.clone().add(new THREE.Vector3(0, e.def.height * 0.5, 0));
      var d = eCenter.distanceTo(pos);
      if (d <= radius) {
        var falloff = 1.0 - (d / radius) * 0.45;
        this.damageEnemy(e, damage * falloff, eCenter, false, 'explosion');
        var push = new THREE.Vector3().subVectors(eCenter, pos).normalize();
        e.vel.addScaledVector(push, isMega ? 22.0 : 15.0);
        if (e.def.lightweight) {
          e.vel.y = Math.max(e.vel.y, isMega ? 18.5 : 14.0);
          e.grounded = false;
        }
      }
    }

    // Check Rocket-Jumping / Player Knockback!
    var pDist = this.player.pos.distanceTo(pos);
    if (pDist < radius) {
      var pPush = new THREE.Vector3().subVectors(
        this.player.pos.clone().add(new THREE.Vector3(0, 1.0, 0)),
        pos
      ).normalize();
      var impulse = (1.0 - pDist / radius) * (isMega ? 26.0 : 21.0);
      this.player.vel.x += pPush.x * impulse;
      this.player.vel.z += pPush.z * impulse;
      this.player.vel.y = Math.max(this.player.vel.y, 14.5 + impulse * 0.55);
      this.player.grounded = false;

      if (canHurtPlayer) {
        this.damagePlayer(14, false); // Forgiving self-damage for stylish Rocket-Jumping!
        if (impulse > 9.0) {
          this.addStyle(60, '+ROCKET JUMP', '#c084fc');
        }
      }
    }
  };

  B.CombatManager.prototype.spawnBeam = function (start, end, colorHex, thickness) {
    var dist = start.distanceTo(end);
    if (dist < 0.05) return;
    var geo = new THREE.CylinderGeometry(thickness, thickness, dist, 5);
    geo.rotateX(Math.PI / 2);
    var mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.95
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.addVectors(start, end).multiplyScalar(0.5);
    mesh.lookAt(end);
    this.scene.add(mesh);

    this.beams.push({
      mesh: mesh,
      mat: mat,
      age: 0,
      duration: thickness > 0.1 ? 0.34 : 0.14
    });
  };

  B.CombatManager.prototype.spawnBloodAndGibs = function (pos, count, isKillGibs) {
    var maxParticles = 140;
    while (this.particles.length > maxParticles) {
      var old = this.particles.shift();
      this.scene.remove(old.mesh);
    }

    for (var i = 0; i < count; i++) {
      var isGib = isKillGibs && (i % 3 === 0);
      var size = isGib ? (0.16 + Math.random() * 0.18) : (0.08 + Math.random() * 0.09);
      var geo = new THREE.BoxGeometry(size, size, size);
      var col = isGib ? (Math.random() < 0.4 ? 0xd6d3d1 : 0x991b1b) : 0xdc2626;
      var mat = new THREE.MeshBasicMaterial({ color: col });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      this.scene.add(mesh);

      var vel = new THREE.Vector3(
        (Math.random() - 0.5) * 16.0,
        3.5 + Math.random() * 11.0,
        (Math.random() - 0.5) * 16.0
      );

      this.particles.push({
        mesh: mesh,
        pos: mesh.position,
        vel: vel,
        gravity: 28.0,
        life: 0.55 + Math.random() * 0.55
      });
    }
  };

  B.CombatManager.prototype.spawnImpactSparks = function (pos, colorHex, count) {
    for (var i = 0; i < count; i++) {
      var geo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
      var mat = new THREE.MeshBasicMaterial({ color: colorHex });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      this.scene.add(mesh);

      this.particles.push({
        mesh: mesh,
        pos: mesh.position,
        vel: new THREE.Vector3((Math.random() - 0.5) * 12, 2 + Math.random() * 8, (Math.random() - 0.5) * 12),
        gravity: 22.0,
        life: 0.25 + Math.random() * 0.2
      });
    }
  };

  // ==================== UPDATE WEAPONS, COINS, CORES, PROJECTILES & VFX ====================
  B.CombatManager.prototype.update = function (dt, time, input, levelMgr) {
    // Cooldowns & Recharges
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.coreCooldown > 0) this.coreCooldown = Math.max(0, this.coreCooldown - dt);
    if (this.punchCooldown > 0) this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    if (this.projBoostWindow > 0) this.projBoostWindow = Math.max(0, this.projBoostWindow - dt);

    // Regenerate Marksman Coins (up to 4)
    if (this.coins < 4.0) {
      this.coins = Math.min(4.0, this.coins + dt / B.WEAPONS[0].coinRegenTime);
    }

    // Regenerate Railcannon Battery
    if (this.railCharge < 1.0) {
      this.railCharge = Math.min(1.0, this.railCharge + dt / B.WEAPONS[3].railCooldown);
    }

    // Nailgun Heat & Overheat Salvo
    if (this.overheatBurstLeft > 0) {
      this.overheatBurstLeft -= dt;
      if (B.WEAPONS[this.currentWeaponIdx].id === 'nailgun') {
        this.firePrimary();
      }
    } else if (!input.fireHeld || B.WEAPONS[this.currentWeaponIdx].id !== 'nailgun') {
      this.nailHeat = Math.max(0, this.nailHeat - B.WEAPONS[2].heatDecay * dt);
    }

    // Automatic Continuous Firing when LMB held
    if (input.fireHeld) {
      this.firePrimary();
    }

    // Viewmodel spring return & muzzle light decay
    this.viewmodel.gunMount.position.y += (-0.25 - this.viewmodel.gunMount.position.y) * Math.min(1, dt * 14);
    this.viewmodel.gunMount.position.z += (-0.46 - this.viewmodel.gunMount.position.z) * Math.min(1, dt * 16);
    if (this.viewmodel.muzzleLight.intensity > 0) {
      this.viewmodel.muzzleLight.intensity = Math.max(0, this.viewmodel.muzzleLight.intensity - dt * 28);
    }

    // Animate Feedbacker Punch Arm
    if (this.punchAnimTimer > 0) {
      this.punchAnimTimer -= dt;
      this.viewmodel.punchArm.visible = true;
      var pProg = Math.sin((1.0 - this.punchAnimTimer / 0.24) * Math.PI);
      this.viewmodel.punchArm.position.set(-0.28 + pProg * 0.22, -0.32 + pProg * 0.16, -0.15 - pProg * 0.58);
      if (this.punchAnimTimer <= 0) {
        this.viewmodel.punchArm.visible = false;
      }
    }

    // 1. Update Airborne Coins
    for (var c = this.activeCoins.length - 1; c >= 0; c--) {
      var coin = this.activeCoins[c];
      coin.life -= dt;
      coin.vel.y -= 22.0 * dt; // Slightly floaty gravity so coins are a joy to shoot!
      coin.pos.addScaledVector(coin.vel, dt);
      coin.mesh.rotation.x += dt * 18.0;
      coin.mesh.rotation.z += dt * 12.0;

      if (coin.pos.y <= 0.15 || coin.life <= 0) {
        this.scene.remove(coin.mesh);
        this.activeCoins.splice(c, 1);
      }
    }

    // 2. Update Airborne Shotgun Cores
    for (var cr = this.activeCores.length - 1; cr >= 0; cr--) {
      var core = this.activeCores[cr];
      core.life -= dt;
      core.vel.y -= 26.0 * dt;
      core.pos.addScaledVector(core.vel, dt);
      core.mesh.rotation.x += dt * 10;
      core.mesh.rotation.y += dt * 14;

      var hitSurface = core.pos.y <= 0.25 || core.life <= 0 || this.checkPointInCollider(core.pos, levelMgr);
      if (!hitSurface) {
        for (var ce = 0; ce < this.enemyMgr.enemies.length; ce++) {
          var en = this.enemyMgr.enemies[ce];
          if (!en.dead && core.pos.distanceTo(en.pos.clone().add(new THREE.Vector3(0, 1.1, 0))) < en.def.radius + 0.6) {
            hitSurface = true;
            break;
          }
        }
      }
      if (hitSurface) {
        var cPos = core.pos.clone();
        this.scene.remove(core.mesh);
        this.activeCores.splice(cr, 1);
        this.createExplosion(cPos, 7.0, core.damage, true, false);
      }
    }

    // 3. Update Player Projectiles (Nails, Rockets, Parried Orbs, Projectile Boosts)
    for (var p = this.playerProjectiles.length - 1; p >= 0; p--) {
      var pr = this.playerProjectiles[p];
      pr.life -= dt;
      if (pr.gravity) pr.vel.y -= pr.gravity * dt;
      pr.pos.addScaledVector(pr.vel, dt);

      var removeProj = pr.life <= 0 || pr.pos.y <= 0.05 || this.checkPointInCollider(pr.pos, levelMgr);
      var hitEnemy = null;

      if (!removeProj) {
        for (var pe = 0; pe < this.enemyMgr.enemies.length; pe++) {
          var targetE = this.enemyMgr.enemies[pe];
          if (targetE.dead) continue;
          var eMid = targetE.pos.clone().add(new THREE.Vector3(0, targetE.def.height * 0.52, 0));
          if (pr.pos.distanceTo(eMid) < targetE.def.radius + pr.radius) {
            hitEnemy = targetE;
            removeProj = true;
            break;
          }
        }
      }

      if (removeProj) {
        var hitPos = pr.pos.clone();
        this.scene.remove(pr.mesh);
        this.playerProjectiles.splice(p, 1);

        if (pr.splashRadius > 0) {
          var isMega = pr.type === 'parried_orb' || pr.type === 'proj_boost';
          this.createExplosion(hitPos, pr.splashRadius, pr.damage, pr.type === 'rocket', isMega);
        } else if (hitEnemy) {
          this.damageEnemy(hitEnemy, pr.damage, hitPos, false, pr.type);
        } else {
          this.spawnImpactSparks(hitPos, pr.color, 3);
        }
      }
    }

    // 4. Update Enemy Projectiles
    for (var epIdx = this.enemyProjectiles.length - 1; epIdx >= 0; epIdx--) {
      var ep = this.enemyProjectiles[epIdx];
      ep.life -= dt;
      ep.pos.addScaledVector(ep.vel, dt);
      ep.mesh.rotation.x += dt * 8;
      ep.mesh.rotation.y += dt * 10;

      var pCenter = this.player.pos.clone().add(new THREE.Vector3(0, 1.1, 0));
      var hitPlayer = ep.pos.distanceTo(pCenter) < 1.05;
      var hitWall = ep.life <= 0 || ep.pos.y <= 0.05 || this.checkPointInCollider(ep.pos, levelMgr);

      if (hitPlayer || hitWall) {
        var epPos = ep.pos.clone();
        this.scene.remove(ep.mesh);
        this.enemyProjectiles.splice(epIdx, 1);
        if (ep.explosive) {
          this.createExplosion(epPos, 5.5, ep.damage, true, false);
        } else if (hitPlayer) {
          this.damagePlayer(ep.damage, false);
        } else {
          this.spawnImpactSparks(epPos, ep.color, 4);
        }
      }
    }

    // 5. Update Beams, Explosions & Particles
    for (var b = this.beams.length - 1; b >= 0; b--) {
      var bm = this.beams[b];
      bm.age += dt;
      bm.mat.opacity = Math.max(0, 1.0 - bm.age / bm.duration);
      if (bm.age >= bm.duration) {
        this.scene.remove(bm.mesh);
        this.beams.splice(b, 1);
      }
    }

    for (var ex = this.explosions.length - 1; ex >= 0; ex--) {
      var exp = this.explosions[ex];
      exp.age += dt;
      var t = exp.age / exp.duration;
      exp.mesh.scale.setScalar(0.5 + t * exp.maxRadius * 0.85);
      exp.mat.opacity = Math.max(0, 0.9 * (1.0 - t));
      if (exp.light) exp.light.intensity = Math.max(0, (1.0 - t) * 5.0);
      if (exp.age >= exp.duration) {
        this.scene.remove(exp.mesh);
        if (exp.light) this.scene.remove(exp.light);
        this.explosions.splice(ex, 1);
      }
    }

    for (var pt = this.particles.length - 1; pt >= 0; pt--) {
      var part = this.particles[pt];
      part.life -= dt;
      part.vel.y -= part.gravity * dt;
      part.pos.addScaledVector(part.vel, dt);
      part.mesh.rotation.x += dt * 6;
      if (part.pos.y < 0.08) {
        part.pos.y = 0.08;
        part.vel.x *= 0.6;
        part.vel.z *= 0.6;
        part.vel.y = 0;
      }
      if (part.life <= 0) {
        this.scene.remove(part.mesh);
        this.particles.splice(pt, 1);
      }
    }
  };

  B.CombatManager.prototype.checkPointInCollider = function (pt, levelMgr) {
    if (!levelMgr) return false;
    var cols = levelMgr.colliders;
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      if (pt.x >= c.minX && pt.x <= c.maxX &&
          pt.y >= c.minY && pt.y <= c.maxY &&
          pt.z >= c.minZ && pt.z <= c.maxZ) {
        return true;
      }
    }
    return false;
  };

})(window.Bloodcore);
