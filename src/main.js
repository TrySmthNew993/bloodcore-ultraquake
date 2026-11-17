/**
 * BLOODCORE // ULTRAQUAKE
 * Main Game Loop, Style Rank Manager, CRT Cyber-Terminal UI, & Progression Persistence
 */
window.Bloodcore = window.Bloodcore || {};

(function (B) {
  'use strict';

  B.Game = function () {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap; // Crisp PS1/PS2 shadow edges

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(98, window.innerWidth / window.innerHeight, 0.08, 160);
    this.scene.add(this.camera);

    B.TextureLibrary.init();

    this.audio = new B.AudioEngine();
    this.postfx = new B.PostFXPipeline(this.renderer);
    this.postfx.resize(window.innerWidth, window.innerHeight, this.renderer.getPixelRatio());

    this.viewmodel = B.Models.createViewmodelRig(this.camera);
    this.player = new B.PlayerController(this.camera, this.audio);
    this.levelMgr = new B.LevelManager(this.scene, this.audio);
    this.enemyMgr = new B.EnemyManager(this.scene, this.audio);

    var self = this;
    this.combatMgr = new B.CombatManager(
      this.scene,
      this.camera,
      this.player,
      this.enemyMgr,
      this.viewmodel,
      this.audio,
      function (pts, label, color) { self.onStyleBonus(pts, label, color); },
      function (enemy) { self.onEnemyKilled(enemy); },
      function (flashColor) { self.triggerScreenFlash(flashColor); }
    );

    // Game State
    this.state = 'MENU'; // 'MENU' | 'PLAYING' | 'PAUSED' | 'LEVEL_COMPLETE' | 'GAME_OVER'
    this.mode = 'campaign';
    this.selectedLevelIdx = 0;

    // Run Metrics
    this.runTime = 0;
    this.runKills = 0;
    this.runTotalStyle = 0;
    this.styleMeter = 0;
    this.styleFeed = [];
    this.restartsInLevel = 0;

    // Input State
    this.input = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jumpPressed: false,
      slidePressed: false,
      slideHeld: false,
      fireHeld: false
    };

    // Settings
    this.settings = {
      sensitivity: 0.0022,
      fov: 98,
      ps1Filter: true,
      bloom: true,
      crtScanlines: true
    };

    this.saveData = this.loadSaveData();
    this.clock = new THREE.Clock();
    this.elapsedTime = 0;

    this.initUI();
    this.initInputListeners();
    this.buildMenuShowcaseScene();
    this.animate();
  };

  // ==================== PERSISTENCE (LOCALSTORAGE) ====================
  B.Game.prototype.loadSaveData = function () {
    var def = {
      levels: {},
      endlessBestRoom: 0,
      endlessBestKills: 0,
      endlessBestStyle: 0
    };
    try {
      var raw = localStorage.getItem(B.STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        return Object.assign(def, parsed);
      }
    } catch (e) {}
    return def;
  };

  B.Game.prototype.writeSaveData = function () {
    try {
      localStorage.setItem(B.STORAGE_KEY, JSON.stringify(this.saveData));
    } catch (e) {}
  };

  // ==================== 3D MENU DIORAMA SHOWCASE ====================
  B.Game.prototype.buildMenuShowcaseScene = function () {
    this.levelMgr.loadCampaignLevel(0);
    this.enemyMgr.clearAll();
    // Spawn a dramatic Cerberus Juggernaut & Archon V-0 statue showcase in the entry room
    var bossPreview = B.Models.createEnemyMesh('boss');
    bossPreview.root.position.set(0, 0.2, -3.5);
    this.scene.add(bossPreview.root);
    this.showcaseMesh = bossPreview.root;
    this.viewmodel.rig.visible = false;
  };

  // ==================== UI & MENU BINDINGS ====================
  B.Game.prototype.initUI = function () {
    var self = this;

    // Render Campaign Level Cards
    this.renderCampaignCards();
    this.renderCodexCards();
    this.updateEndlessBannerStats();

    // Menu Tabs
    var tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        tabBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var target = btn.getAttribute('data-tab');
        document.querySelectorAll('.tab-panel').forEach(function (p) {
          p.classList.toggle('active', p.id === target);
        });
      });
    });

    // Launch Campaign Button
    var btnStartCampaign = document.getElementById('btn-launch-campaign');
    if (btnStartCampaign) {
      btnStartCampaign.addEventListener('click', function () {
        self.startCampaign(self.selectedLevelIdx);
      });
    }

    // Launch Endless Generative Mode Button
    var btnStartEndless = document.getElementById('btn-launch-endless');
    if (btnStartEndless) {
      btnStartEndless.addEventListener('click', function () {
        self.startEndless();
      });
    }

    // Pause / Result Modal Buttons
    document.getElementById('btn-resume').addEventListener('click', function () {
      self.resumeGame();
    });
    document.getElementById('btn-restart').addEventListener('click', function () {
      self.restartsInLevel++;
      if (self.mode === 'campaign') self.startCampaign(self.selectedLevelIdx, true);
      else self.startEndless();
    });
    document.getElementById('btn-quit-menu').addEventListener('click', function () {
      self.returnToMenu();
    });

    document.getElementById('btn-eval-retry').addEventListener('click', function () {
      if (self.mode === 'campaign') self.startCampaign(self.selectedLevelIdx);
      else self.startEndless();
    });
    document.getElementById('btn-eval-next').addEventListener('click', function () {
      if (self.mode === 'campaign') {
        var nextIdx = (self.selectedLevelIdx + 1) % B.CAMPAIGN_LEVELS.length;
        self.selectedLevelIdx = nextIdx;
        self.startCampaign(nextIdx);
      } else {
        self.startEndless();
      }
    });
    document.getElementById('btn-eval-menu').addEventListener('click', function () {
      self.returnToMenu();
    });

    // Settings Controls
    var sensInput = document.getElementById('opt-sens');
    var fovInput = document.getElementById('opt-fov');
    var sfxInput = document.getElementById('opt-sfx');
    var musicInput = document.getElementById('opt-music');
    var ps1Toggle = document.getElementById('opt-ps1');
    var bloomToggle = document.getElementById('opt-bloom');

    if (sensInput) {
      sensInput.addEventListener('input', function () {
        self.settings.sensitivity = parseFloat(sensInput.value) * 0.001;
        document.getElementById('val-sens').textContent = parseFloat(sensInput.value).toFixed(1);
      });
    }
    if (fovInput) {
      fovInput.addEventListener('input', function () {
        self.settings.fov = parseInt(fovInput.value, 10);
        self.camera.fov = self.settings.fov;
        self.camera.updateProjectionMatrix();
        document.getElementById('val-fov').textContent = self.settings.fov + '°';
      });
    }
    if (sfxInput && musicInput) {
      var updateAudio = function () {
        var s = parseFloat(sfxInput.value);
        var m = parseFloat(musicInput.value);
        self.audio.setVolumes(s, m);
        document.getElementById('val-sfx').textContent = Math.round(s * 100) + '%';
        document.getElementById('val-music').textContent = Math.round(m * 100) + '%';
      };
      sfxInput.addEventListener('input', updateAudio);
      musicInput.addEventListener('input', updateAudio);
    }
    if (ps1Toggle) {
      ps1Toggle.addEventListener('change', function () {
        self.settings.ps1Filter = ps1Toggle.checked;
        self.postfx.ps1Mode = ps1Toggle.checked;
        document.body.classList.toggle('no-crt', !ps1Toggle.checked);
      });
    }
    if (bloomToggle) {
      bloomToggle.addEventListener('change', function () {
        self.settings.bloom = bloomToggle.checked;
        self.postfx.enabled = bloomToggle.checked;
      });
    }
  };

  B.Game.prototype.renderCampaignCards = function () {
    var grid = document.getElementById('campaign-level-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var self = this;

    B.CAMPAIGN_LEVELS.forEach(function (lvl, idx) {
      var saved = self.saveData.levels[lvl.id] || null;
      var rankBadge = saved ? saved.rank : '—';
      var rankClass = saved ? ('rank-' + saved.rank.toLowerCase()) : 'rank-none';
      var bestTimeStr = saved ? self.formatTime(saved.bestTime) : '--:--.--';

      var card = document.createElement('div');
      card.className = 'level-card' + (idx === self.selectedLevelIdx ? ' selected' : '');
      card.innerHTML =
        '<div class="level-card-header">' +
          '<span class="level-code">LAYER // ' + lvl.code + '</span>' +
          '<span class="level-rank-badge ' + rankClass + '">' + rankBadge + '</span>' +
        '</div>' +
        '<h3 class="level-title">' + lvl.title + '</h3>' +
        '<div class="level-sub">' + lvl.subtitle + '</div>' +
        '<p class="level-brief">' + lvl.briefing + '</p>' +
        '<div class="level-meta">' +
          '<span>PAR: ' + self.formatTime(lvl.parTime) + '</span>' +
          '<span>BEST: ' + bestTimeStr + '</span>' +
        '</div>';

      card.addEventListener('click', function () {
        self.selectedLevelIdx = idx;
        self.renderCampaignCards();
      });
      card.addEventListener('dblclick', function () {
        self.selectedLevelIdx = idx;
        self.startCampaign(idx);
      });
      grid.appendChild(card);
    });
  };

  B.Game.prototype.renderCodexCards = function () {
    var wGrid = document.getElementById('codex-weapons-grid');
    var eGrid = document.getElementById('codex-enemies-grid');
    if (wGrid) {
      wGrid.innerHTML = B.WEAPONS.map(function (w) {
        return '<div class="codex-card" style="border-left-color:' + w.color + '">' +
          '<div class="codex-kicker">SLOT [0' + w.slot + '] // ' + w.subtitle + '</div>' +
          '<h4>' + w.name + '</h4>' +
          '<p>' + w.desc + '</p>' +
        '</div>';
      }).join('');
    }
    if (eGrid) {
      eGrid.innerHTML = Object.keys(B.ENEMIES).map(function (k) {
        var e = B.ENEMIES[k];
        var hex = '#' + e.accent.toString(16).padStart(6, '0');
        return '<div class="codex-card" style="border-left-color:' + hex + '">' +
          '<div class="codex-kicker">' + e.role + ' // HP: ' + e.hp + '</div>' +
          '<h4>' + e.name + '</h4>' +
          '<p>' + e.desc + '</p>' +
        '</div>';
      }).join('');
    }
  };

  B.Game.prototype.updateEndlessBannerStats = function () {
    var elRoom = document.getElementById('endless-best-room');
    var elKills = document.getElementById('endless-best-kills');
    var elStyle = document.getElementById('endless-best-style');
    if (elRoom) elRoom.textContent = 'SECTOR ' + (this.saveData.endlessBestRoom || 0);
    if (elKills) elKills.textContent = this.saveData.endlessBestKills || 0;
    if (elStyle) elStyle.textContent = this.saveData.endlessBestStyle || 0;
  };

  // ==================== START / CONTROL GAME MODES ====================
  B.Game.prototype.startCampaign = function (levelIdx, isRetry) {
    this.audio.init();
    this.mode = 'campaign';
    this.selectedLevelIdx = levelIdx;
    if (!isRetry) this.restartsInLevel = 0;

    if (this.showcaseMesh) {
      this.scene.remove(this.showcaseMesh);
      this.showcaseMesh = null;
    }

    this.enemyMgr.clearAll();
    this.combatMgr.reset();
    this.levelMgr.loadCampaignLevel(levelIdx);
    this.player.reset(0, 0.2, 3.5);
    this.viewmodel.rig.visible = true;

    this.runTime = 0;
    this.runKills = 0;
    this.runTotalStyle = 0;
    this.styleMeter = 0;
    this.styleFeed = [];

    this.state = 'PLAYING';
    this.audio.setCombatState(0.05);
    this.syncOverlays();
    this.lockPointer();

    var lvl = B.CAMPAIGN_LEVELS[levelIdx];
    this.showBannerAnnouncement(lvl.code + ' // ' + lvl.title, lvl.subtitle);
  };

  B.Game.prototype.startEndless = function () {
    this.audio.init();
    this.mode = 'endless';
    this.restartsInLevel = 0;

    if (this.showcaseMesh) {
      this.scene.remove(this.showcaseMesh);
      this.showcaseMesh = null;
    }

    this.enemyMgr.clearAll();
    this.combatMgr.reset();
    this.levelMgr.startEndlessMode();
    this.player.reset(0, 0.2, 3.5);
    this.viewmodel.rig.visible = true;

    this.runTime = 0;
    this.runKills = 0;
    this.runTotalStyle = 0;
    this.styleMeter = 0;
    this.styleFeed = [];

    this.state = 'PLAYING';
    this.audio.setCombatState(0.05);
    this.syncOverlays();
    this.lockPointer();

    this.showBannerAnnouncement('ENDLESS CYBER-GAUNTLET', 'KEEP GOING // CLEAR ROOMS TO UNLOCK AIRLOCKS');
  };

  B.Game.prototype.pauseGame = function () {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    this.input.fireHeld = false;
    this.audio.setCombatState(0);
    if (document.pointerLockElement) document.exitPointerLock();
    this.syncOverlays();
  };

  B.Game.prototype.resumeGame = function () {
    if (this.state !== 'PAUSED') return;
    this.state = 'PLAYING';
    this.syncOverlays();
    this.lockPointer();
  };

  B.Game.prototype.returnToMenu = function () {
    this.state = 'MENU';
    this.input.fireHeld = false;
    this.audio.setCombatState(0);
    if (document.pointerLockElement) document.exitPointerLock();
    this.enemyMgr.clearAll();
    this.combatMgr.reset();
    this.buildMenuShowcaseScene();
    this.renderCampaignCards();
    this.updateEndlessBannerStats();
    this.syncOverlays();
  };

  B.Game.prototype.lockPointer = function () {
    try {
      if (this.canvas.requestPointerLock) {
        this.canvas.requestPointerLock();
      }
    } catch (e) {}
  };

  B.Game.prototype.syncOverlays = function () {
    document.getElementById('main-menu').classList.toggle('hidden', this.state !== 'MENU');
    document.getElementById('hud-overlay').classList.toggle('hidden', this.state !== 'PLAYING');
    document.getElementById('pause-modal').classList.toggle('hidden', this.state !== 'PAUSED');
    document.getElementById('eval-modal').classList.toggle('hidden', this.state !== 'LEVEL_COMPLETE' && this.state !== 'GAME_OVER');
  };

  // ==================== WAVE SPAWNING & LEVEL / ROOM COMPLETION ====================
  B.Game.prototype.spawnRoomWave = function (room, waveIdx) {
    var waveDef = room.def.waves[waveIdx];
    if (!waveDef) return;

    var spawns = room.spawnPoints;
    var sIdx = 0;

    for (var i = 0; i < waveDef.length; i++) {
      var group = waveDef[i];
      for (var c = 0; c < group.count; c++) {
        var sp = spawns[sIdx % spawns.length] || { x: 0, y: 0.5, z: room.zCenter };
        var jitterX = (Math.random() - 0.5) * 4.5;
        var jitterZ = (Math.random() - 0.5) * 4.5;
        this.enemyMgr.spawnEnemy(group.type, sp.x + jitterX, sp.y, sp.z + jitterZ);
        sIdx++;
      }
    }

    var isBoss = !!room.def.isBossRoom;
    this.audio.setCombatState(isBoss ? 1.5 : 1.0);
    this.showBannerAnnouncement(
      room.def.name,
      isBoss ? 'SUPREME MACHINE DETECTED // ARCHON V-0' : ('WAVE ' + (waveIdx + 1) + ' OF ' + room.def.waves.length)
    );
  };

  B.Game.prototype.onEnemyKilled = function () {
    this.runKills++;
    var self = this;

    // Check if all live enemies in current wave are dead
    var aliveCount = 0;
    for (var i = 0; i < this.enemyMgr.enemies.length; i++) {
      if (!this.enemyMgr.enemies[i].dead) aliveCount++;
    }

    if (aliveCount === 0 && this.levelMgr.roomLocked) {
      this.levelMgr.onWaveCleared(
        function (rm, nextWaveIdx) {
          self.spawnRoomWave(rm, nextWaveIdx);
        },
        function (clearedRoom) {
          self.audio.setCombatState(0.08);
          if (self.mode === 'endless') {
            var sectorNum = clearedRoom.index + 1;
            if (sectorNum > self.saveData.endlessBestRoom) {
              self.saveData.endlessBestRoom = sectorNum;
            }
            if (self.runKills > self.saveData.endlessBestKills) {
              self.saveData.endlessBestKills = self.runKills;
            }
            if (Math.round(self.runTotalStyle) > self.saveData.endlessBestStyle) {
              self.saveData.endlessBestStyle = Math.round(self.runTotalStyle);
            }
            self.writeSaveData();
            self.showBannerAnnouncement('SECTOR ' + sectorNum + ' CLEARED', 'BLAST DOOR UNLOCKED // ADVANCE FORWARD');
          } else {
            var isFinalRoom = (clearedRoom.index === self.levelMgr.currentLevelData.rooms.length - 1);
            self.showBannerAnnouncement(
              'ARENA CLEARED',
              isFinalRoom ? 'PROCEED TO EXTRACTION SHAFT AHEAD' : 'AIRLOCK OPEN // ADVANCE TO NEXT CHAMBER'
            );
          }
        }
      );
    }
  };

  B.Game.prototype.completeCampaignLevel = function () {
    if (this.state !== 'PLAYING') return;
    this.state = 'LEVEL_COMPLETE';
    this.input.fireHeld = false;
    this.audio.setCombatState(0);
    if (document.pointerLockElement) document.exitPointerLock();

    var lvl = this.levelMgr.currentLevelData;
    var timeGrade = this.runTime <= lvl.parTime ? 'S' : (this.runTime <= lvl.parTime * 1.35 ? 'A' : 'B');
    var styleGrade = this.runTotalStyle >= lvl.parStyle ? 'S' : (this.runTotalStyle >= lvl.parStyle * 0.7 ? 'A' : 'B');
    var killsGrade = this.runKills >= 8 ? 'S' : 'A';

    var finalRank = 'A';
    if (timeGrade === 'S' && styleGrade === 'S' && killsGrade === 'S' && this.restartsInLevel === 0) {
      finalRank = 'P';
    } else if (timeGrade === 'S' && styleGrade === 'S') {
      finalRank = 'S';
    } else if (timeGrade === 'B' && styleGrade === 'B') {
      finalRank = 'B';
    }

    // Save Best Record
    var prev = this.saveData.levels[lvl.id];
    var rankOrder = { P: 6, S: 5, A: 4, B: 3, C: 2, D: 1 };
    if (!prev || (rankOrder[finalRank] || 0) >= (rankOrder[prev.rank] || 0)) {
      this.saveData.levels[lvl.id] = {
        rank: finalRank,
        bestTime: prev ? Math.min(prev.bestTime, this.runTime) : this.runTime,
        bestStyle: prev ? Math.max(prev.bestStyle, Math.round(this.runTotalStyle)) : Math.round(this.runTotalStyle)
      };
      this.writeSaveData();
    }

    this.populateEvalModal(true, lvl.code + ' // ' + lvl.title, finalRank);
    this.syncOverlays();
  };

  B.Game.prototype.triggerGameOver = function () {
    if (this.state !== 'PLAYING') return;
    this.state = 'GAME_OVER';
    this.input.fireHeld = false;
    this.audio.setCombatState(0);
    if (document.pointerLockElement) document.exitPointerLock();

    if (this.mode === 'endless') {
      var sectorReached = Math.max(1, this.levelMgr.activeRoomIndex + 1);
      if (sectorReached > this.saveData.endlessBestRoom) this.saveData.endlessBestRoom = sectorReached;
      if (this.runKills > this.saveData.endlessBestKills) this.saveData.endlessBestKills = this.runKills;
      if (Math.round(this.runTotalStyle) > this.saveData.endlessBestStyle) this.saveData.endlessBestStyle = Math.round(this.runTotalStyle);
      this.writeSaveData();
      this.populateEvalModal(false, 'ENDLESS GAUNTLET // SECTOR ' + sectorReached, 'DEAD');
    } else {
      var lvl = this.levelMgr.currentLevelData;
      this.populateEvalModal(false, lvl.code + ' // ' + lvl.title, 'DEAD');
    }
    this.syncOverlays();
  };

  B.Game.prototype.populateEvalModal = function (victory, title, rank) {
    document.getElementById('eval-kicker').textContent = victory ? 'MISSION EVALUATION // EXTRACTION COMPLETE' : 'CRITICAL SYSTEM FAILURE // YOU ARE DEAD';
    document.getElementById('eval-title').textContent = title;
    document.getElementById('eval-time').textContent = this.formatTime(this.runTime);
    document.getElementById('eval-kills').textContent = this.runKills;
    document.getElementById('eval-style').textContent = Math.round(this.runTotalStyle) + ' PTS';
    document.getElementById('eval-restarts').textContent = this.restartsInLevel;

    var rankEl = document.getElementById('eval-rank-badge');
    rankEl.textContent = rank;
    rankEl.className = 'eval-big-rank rank-' + rank.toLowerCase();

    var nextBtn = document.getElementById('btn-eval-next');
    nextBtn.style.display = (victory && this.mode === 'campaign') ? 'inline-flex' : 'none';
  };

  // ==================== STYLE METER & ANNOUNCEMENTS ====================
  B.Game.prototype.getCurrentStyleRank = function () {
    var cur = B.STYLE_RANKS[0];
    for (var i = 0; i < B.STYLE_RANKS.length; i++) {
      if (this.styleMeter >= B.STYLE_RANKS[i].min) {
        cur = B.STYLE_RANKS[i];
      }
    }
    return cur;
  };

  B.Game.prototype.onStyleBonus = function (points, label, color) {
    // Airborne or Sliding movement multiplier (up to 1.5x style!)
    var moveMult = (!this.player.grounded || this.player.isSliding) ? 1.35 : 1.0;
    var gained = Math.round(points * moveMult);
    this.styleMeter = Math.min(3600, this.styleMeter + gained);
    this.runTotalStyle += gained;

    this.styleFeed.unshift({
      label: label,
      pts: gained,
      color: color || '#fde047',
      age: 0
    });
    if (this.styleFeed.length > 6) this.styleFeed.pop();
  };

  B.Game.prototype.showBannerAnnouncement = function (title, sub) {
    var banner = document.getElementById('hud-room-banner');
    if (!banner) return;
    document.getElementById('banner-title').textContent = title;
    document.getElementById('banner-sub').textContent = sub || '';
    banner.classList.remove('show');
    void banner.offsetWidth;
    banner.classList.add('show');
  };

  B.Game.prototype.triggerScreenFlash = function (rgbaStr) {
    var el = document.getElementById('screen-flash');
    if (!el) return;
    el.style.background = rgbaStr;
    el.style.opacity = '1';
    setTimeout(function () {
      el.style.opacity = '0';
    }, 95);
  };

  // ==================== INPUT LISTENERS ====================
  B.Game.prototype.initInputListeners = function () {
    var self = this;

    window.addEventListener('resize', function () {
      self.camera.aspect = window.innerWidth / window.innerHeight;
      self.camera.updateProjectionMatrix();
      self.renderer.setSize(window.innerWidth, window.innerHeight);
      self.postfx.resize(window.innerWidth, window.innerHeight, self.renderer.getPixelRatio());
    });

    window.addEventListener('keydown', function (e) {
      if (e.code === 'Escape') {
        if (self.state === 'PLAYING') self.pauseGame();
        else if (self.state === 'PAUSED') self.resumeGame();
        return;
      }
      if (self.state !== 'PLAYING') return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          self.input.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          self.input.backward = true;
          break;
        case 'KeyA':
          self.input.left = true;
          break;
        case 'KeyD':
          self.input.right = true;
          break;
        case 'ArrowLeft':
          self.player.yaw += 0.12;
          break;
        case 'ArrowRight':
          self.player.yaw -= 0.12;
          break;
        case 'Space':
          e.preventDefault();
          self.input.jumpPressed = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          e.preventDefault();
          if (!e.repeat) self.player.triggerDash(self.input);
          break;
        case 'ControlLeft':
        case 'ControlRight':
        case 'KeyC':
          if (!self.input.slideHeld) self.input.slidePressed = true;
          self.input.slideHeld = true;
          break;
        case 'KeyF':
          if (!e.repeat) self.combatMgr.triggerPunch();
          break;
        case 'KeyQ':
          if (!e.repeat) self.combatMgr.quickSwap();
          break;
        case 'Digit1':
          self.combatMgr.switchWeapon(0);
          break;
        case 'Digit2':
          self.combatMgr.switchWeapon(1);
          break;
        case 'Digit3':
          self.combatMgr.switchWeapon(2);
          break;
        case 'Digit4':
          self.combatMgr.switchWeapon(3);
          break;
      }
    });

    window.addEventListener('keyup', function (e) {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          self.input.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          self.input.backward = false;
          break;
        case 'KeyA':
          self.input.left = false;
          break;
        case 'KeyD':
          self.input.right = false;
          break;
        case 'Space':
          self.input.jumpPressed = false;
          break;
        case 'ControlLeft':
        case 'ControlRight':
        case 'KeyC':
          self.input.slideHeld = false;
          break;
      }
    });

    window.addEventListener('mousemove', function (e) {
      if (self.state !== 'PLAYING') return;
      if (document.pointerLockElement === self.canvas || e.buttons === 1) {
        self.player.yaw -= e.movementX * self.settings.sensitivity;
        self.player.pitch = Math.max(-1.45, Math.min(1.45, self.player.pitch - e.movementY * self.settings.sensitivity));
      }
    });

    this.canvas.addEventListener('mousedown', function (e) {
      if (self.state !== 'PLAYING') return;
      if (document.pointerLockElement !== self.canvas) {
        self.lockPointer();
      }
      if (e.button === 0) {
        self.input.fireHeld = true;
        self.combatMgr.firePrimary();
      } else if (e.button === 2) {
        self.combatMgr.fireAlt();
      }
    });

    window.addEventListener('mouseup', function (e) {
      if (e.button === 0) {
        self.input.fireHeld = false;
      }
    });

    window.addEventListener('contextmenu', function (e) {
      if (self.state === 'PLAYING') e.preventDefault();
    });

    window.addEventListener('wheel', function (e) {
      if (self.state !== 'PLAYING') return;
      var dir = e.deltaY > 0 ? 1 : -1;
      var next = (self.combatMgr.currentWeaponIdx + dir + B.WEAPONS.length) % B.WEAPONS.length;
      self.combatMgr.switchWeapon(next);
    });
  };

  // ==================== MAIN UPDATE & RENDER LOOP ====================
  B.Game.prototype.animate = function () {
    var self = this;
    requestAnimationFrame(function () { self.animate(); });

    var rawDt = Math.min(0.05, this.clock.getDelta());
    this.elapsedTime += rawDt;

    if (this.state === 'MENU') {
      // Orbit camera gently in the 3D menu showcase
      var t = this.elapsedTime * 0.45;
      this.camera.position.set(Math.sin(t) * 2.2, 2.2 + Math.sin(t * 1.5) * 0.25, 2.2 + Math.cos(t) * 1.2);
      this.camera.lookAt(0, 1.9, -3.5);
      if (this.showcaseMesh) {
        this.showcaseMesh.rotation.y = Math.sin(t * 0.8) * 0.35;
      }
      this.postfx.render(this.scene, this.camera, 0);
      return;
    }

    if (this.state !== 'PLAYING') {
      this.postfx.render(this.scene, this.camera, 0);
      return;
    }

    // Hitstop Frame Freeze (Parry / Core Nuke / Ultra-Ricoshot crunch!)
    if (this.combatMgr.hitstopTimer > 0) {
      this.combatMgr.hitstopTimer -= rawDt;
      this.updateHUD(rawDt);
      this.postfx.render(this.scene, this.camera, 0.4);
      return;
    }

    var dt = rawDt;
    this.runTime += dt;

    // Decay Style Meter & Hard Damage
    if (this.enemyMgr.enemies.length > 0) {
      this.styleMeter = Math.max(0, this.styleMeter - dt * 28.0);
    }
    var curRank = this.getCurrentStyleRank();
    if (this.player.hardDamage > 0) {
      this.player.hardDamage = Math.max(0, this.player.hardDamage - dt * 4.5 * curRank.healMult);
    }

    // 1. Update Player Movement & Physics
    this.player.update(
      dt,
      this.input,
      this.levelMgr,
      function (slamPos, isSlamJump) {
        if (!isSlamJump) {
          self.enemyMgr.spawnShockwave(slamPos.x, slamPos.y, slamPos.z, B.PHYSICS.SLAM_SHOCKWAVE_RADIUS, 0x38bdf8, false, 22.0);
          // Launch nearby lightweight enemies skyward on Ground Slam!
          var launched = 0;
          for (var i = 0; i < self.enemyMgr.enemies.length; i++) {
            var en = self.enemyMgr.enemies[i];
            if (!en.dead && en.pos.distanceTo(slamPos) <= B.PHYSICS.SLAM_SHOCKWAVE_RADIUS) {
              self.combatMgr.damageEnemy(en, 24, en.pos, false, 'slam');
              if (en.def.lightweight) {
                en.vel.y = 18.5;
                en.grounded = false;
                launched++;
              }
            }
          }
          if (launched > 0) {
            self.onStyleBonus(85 * launched, '+CRUSH // LAUNCH x' + launched, '#38bdf8');
          }
        }
      },
      function (dmg, isHazard) {
        self.combatMgr.damagePlayer(dmg, isHazard);
      }
    );

    // 2. Update Level Doors, Crushers & Wave Triggers
    this.levelMgr.update(
      dt,
      this.elapsedTime,
      this.player.pos,
      function (room, waveIdx) {
        self.spawnRoomWave(room, waveIdx);
      },
      function () {
        self.completeCampaignLevel();
      }
    );

    // 3. Update Weapons, Projectiles, Coins & Parries
    this.combatMgr.update(dt, this.elapsedTime, this.input, this.levelMgr);

    // 4. Update Enemy AI & Boss
    this.enemyMgr.update(dt, this.elapsedTime, this.player, this.levelMgr, this.combatMgr);

    // 5. Check Player Death
    if (this.player.hp <= 0) {
      this.triggerGameOver();
      return;
    }

    // 6. Update Floating Cyber-HUD & Render with Post-Processing
    this.updateHUD(dt);
    var spdFactor = Math.min(1.0, Math.max(0, (this.player.getHorizontalSpeed() - 16.5) / 16.0));
    this.postfx.render(this.scene, this.camera, spdFactor);
  };

  // ==================== UPDATE FLOATING CYBER-HUD ====================
  B.Game.prototype.updateHUD = function (dt) {
    // Health & Hard Damage Bar
    var hpPct = Math.max(0, Math.min(100, this.player.hp));
    var hardPct = Math.max(0, Math.min(85, this.player.hardDamage));
    document.getElementById('hud-hp-fill').style.width = hpPct + '%';
    document.getElementById('hud-hard-fill').style.width = hardPct + '%';
    document.getElementById('hud-hp-val').textContent = Math.ceil(this.player.hp);

    // 3-Bar Stamina Meter
    var stam = this.player.stamina;
    for (var s = 1; s <= 3; s++) {
      var barFill = Math.max(0, Math.min(100, (stam - (s - 1) * 100)));
      document.getElementById('stam-bar-' + s).style.width = barFill + '%';
    }

    // Speedometer & Wall-Jump pips
    var spd = this.player.getHorizontalSpeed();
    document.getElementById('hud-speed-val').textContent = spd.toFixed(1) + ' M/S';
    document.getElementById('hud-wj-val').textContent = 'WJ: ' + '▮'.repeat(this.player.wallJumpsLeft) + '▯'.repeat(3 - this.player.wallJumpsLeft);

    // Active Weapon & Alt-Fire Cooldown Readout
    var w = B.WEAPONS[this.combatMgr.currentWeaponIdx];
    document.getElementById('hud-weapon-name').textContent = w.name;
    document.getElementById('hud-weapon-name').style.color = w.color;

    var altPct = 100;
    var altText = 'READY';
    if (w.id === 'revolver') {
      var fullCoins = Math.floor(this.combatMgr.coins);
      altPct = (this.combatMgr.coins / 4.0) * 100;
      altText = 'COINS: ' + '●'.repeat(fullCoins) + '○'.repeat(4 - fullCoins);
    } else if (w.id === 'shotgun') {
      altPct = (1.0 - this.combatMgr.coreCooldown / w.coreCooldown) * 100;
      altText = this.combatMgr.coreCooldown <= 0 ? 'CORE READY [RMB]' : 'RECHARGING';
    } else if (w.id === 'nailgun') {
      altPct = this.combatMgr.nailHeat * 100;
      altText = this.combatMgr.overheatBurstLeft > 0 ? 'OVERHEAT SALVO!' : ('HEAT: ' + Math.round(altPct) + '%');
    } else if (w.id === 'railcannon') {
      altPct = this.combatMgr.railCharge * 100;
      altText = this.combatMgr.railCharge >= 1.0 ? 'RAILCANNON READY [RMB]' : ('BATTERY: ' + Math.round(altPct) + '%');
    }
    document.getElementById('hud-alt-fill').style.width = Math.max(0, Math.min(100, altPct)) + '%';
    document.getElementById('hud-alt-fill').style.background = w.color;
    document.getElementById('hud-alt-text').textContent = altText;

    // Weapon Slot Pills (1-4)
    for (var i = 0; i < 4; i++) {
      var pill = document.getElementById('w-pill-' + (i + 1));
      if (pill) pill.classList.toggle('active', i === this.combatMgr.currentWeaponIdx);
    }

    // Mission Timer, Kills & Sector Status
    document.getElementById('hud-timer').textContent = this.formatTime(this.runTime);
    document.getElementById('hud-kills').textContent = this.runKills;
    if (this.mode === 'endless') {
      document.getElementById('hud-sector-label').textContent = 'ENDLESS // SECTOR ' + Math.max(1, this.levelMgr.activeRoomIndex + 1);
    } else if (this.levelMgr.currentLevelData) {
      document.getElementById('hud-sector-label').textContent =
        this.levelMgr.currentLevelData.code + ' // ROOM ' + Math.max(1, this.levelMgr.activeRoomIndex + 1) + '/' + this.levelMgr.currentLevelData.rooms.length;
    }

    // Boss Health Bar at Top of Screen
    var bossBar = document.getElementById('hud-boss-bar');
    var boss = this.enemyMgr.activeBoss;
    if (boss && !boss.dead) {
      bossBar.classList.remove('hidden');
      var bPct = Math.max(0, (boss.hp / boss.maxHp) * 100);
      document.getElementById('boss-hp-fill').style.width = bPct + '%';
      document.getElementById('boss-name-label').textContent =
        boss.enraged ? 'ARCHON V-0 // SUPREME MACHINE [ENRAGED]' : 'ARCHON V-0 // SUPREME MACHINE';
    } else {
      bossBar.classList.add('hidden');
    }

    // Style Meter Panel (Right Side)
    var rank = this.getCurrentStyleRank();
    var styleBox = document.getElementById('hud-style-box');
    styleBox.classList.toggle('active', this.styleMeter > 10 || this.styleFeed.length > 0);
    var rankLetter = document.getElementById('style-rank-letter');
    var rankTitle = document.getElementById('style-rank-title');
    rankLetter.textContent = rank.id;
    rankLetter.style.color = rank.color;
    rankTitle.textContent = rank.name;
    rankTitle.style.color = rank.color;

    var nextRankIdx = Math.min(B.STYLE_RANKS.length - 1, B.STYLE_RANKS.indexOf(rank) + 1);
    var nextMin = B.STYLE_RANKS[nextRankIdx].min;
    var rankSpan = Math.max(100, nextMin - rank.min);
    var rankProg = nextMin === rank.min ? 100 : Math.min(100, ((this.styleMeter - rank.min) / rankSpan) * 100);
    var sFill = document.getElementById('style-bar-fill');
    sFill.style.width = rankProg + '%';
    sFill.style.background = rank.color;

    // Style Feed Bonus Lines
    var feedEl = document.getElementById('style-feed-list');
    for (var f = this.styleFeed.length - 1; f >= 0; f--) {
      this.styleFeed[f].age += dt;
      if (this.styleFeed[f].age > 3.2) this.styleFeed.splice(f, 1);
    }
    feedEl.innerHTML = this.styleFeed.map(function (item) {
      return '<div class="style-feed-item" style="color:' + item.color + '">' +
        '<span>' + item.label + '</span>' +
        '<strong>+' + item.pts + '</strong>' +
      '</div>';
    }).join('');
  };

  B.Game.prototype.formatTime = function (sec) {
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    var ms = Math.floor((sec % 1) * 100);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(ms).padStart(2, '0');
  };

  // Boot Game on DOM Ready
  window.addEventListener('DOMContentLoaded', function () {
    window.BloodcoreGame = new B.Game();
  });

})(window.Bloodcore);
