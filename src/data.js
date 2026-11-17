/**
 * BLOODCORE // ULTRAQUAKE
 * Core Data, Weapons, Style Ranks, Enemy Archetypes & Level Definitions
 */
window.Bloodcore = window.Bloodcore || {};

(function (B) {
  'use strict';

  B.STORAGE_KEY = 'bloodcore_ultraquake_save_v1';

  // ==================== MOVEMENT & PHYSICS CONSTANTS ====================
  B.PHYSICS = {
    GRAVITY: 38.0,
    BASE_RUN_SPEED: 16.5,
    MAX_BHOP_SPEED: 33.0,
    GROUND_ACCEL: 14.0,
    AIR_ACCEL: 4.5,
    AIR_WISH_SPEED: 15.0,
    FRICTION: 8.5,
    JUMP_VELOCITY: 14.2,
    WALL_JUMP_UP: 14.5,
    WALL_JUMP_PUSH: 14.0,
    MAX_WALL_JUMPS: 3,
    DASH_SPEED: 31.0,
    DASH_DURATION: 0.16,
    DASH_IFRAMES: 0.22,
    STAMINA_MAX: 300, // 3 bars of 100
    STAMINA_COST: 100,
    STAMINA_REGEN_RATE: 82, // per second
    SLIDE_SPEED: 23.5,
    SLIDE_MIN_SPEED: 19.0,
    SLAM_FALL_SPEED: -46.0,
    SLAM_JUMP_WINDOW: 0.28,
    SLAM_JUMP_MULT: 1.58,
    SLAM_SHOCKWAVE_RADIUS: 8.5,
    PLAYER_RADIUS: 0.65,
    PLAYER_HEIGHT: 2.1,
    PLAYER_CROUCH_HEIGHT: 1.05,
    EYE_HEIGHT: 1.75,
    CROUCH_EYE_HEIGHT: 0.82,
    BLOOD_HEAL_RADIUS: 8.0
  };

  // ==================== STYLE METER RANKS ====================
  B.STYLE_RANKS = [
    { id: 'D',   name: 'DESTRUCTIVE', min: 0,    color: '#38bdf8', healMult: 1.0 },
    { id: 'C',   name: 'CHAOTIC',     min: 150,  color: '#4ade80', healMult: 1.1 },
    { id: 'B',   name: 'BRUTAL',      min: 350,  color: '#facc15', healMult: 1.2 },
    { id: 'A',   name: 'ANARCHIC',    min: 650,  color: '#fb923c', healMult: 1.35 },
    { id: 'S',   name: 'SUPREME',     min: 1050, color: '#f87171', healMult: 1.5 },
    { id: 'SS',  name: 'SSADISTIC',   min: 1550, color: '#ef4444', healMult: 1.7 },
    { id: 'SSS', name: 'SSSHITSTORM', min: 2200, color: '#e879f9', healMult: 1.9 },
    { id: 'U',   name: 'ULTRAKILL',   min: 3000, color: '#fde047', healMult: 2.2 }
  ];

  // ==================== WEAPON DEFINITIONS ====================
  B.WEAPONS = [
    {
      id: 'revolver',
      slot: 1,
      name: 'MARKSMAN REVOLVER',
      shortName: 'REVOLVER',
      subtitle: 'HITSCAN // COIN RICOCHET',
      color: '#facc15',
      fireRate: 0.34,
      damage: 32,
      headshotMult: 2.0,
      maxCoins: 4,
      coinRegenTime: 3.2,
      desc: 'LMB: Precision hitscan shot (2x weakpoint damage). RMB: Toss a spinning gold coin (up to 4). Shoot airborne coins with Revolver or Railcannon for guaranteed auto-targeted critical ricochets (+RICOSHOT).'
    },
    {
      id: 'shotgun',
      slot: 2,
      name: 'CORE-EJECT SHOTGUN',
      shortName: 'SHOTGUN',
      subtitle: 'BUCKSHOT // CORE NUKE & PROJ BOOST',
      color: '#fb923c',
      fireRate: 0.72,
      pellets: 12,
      pelletDamage: 8.5,
      spread: 0.085,
      coreCooldown: 2.4,
      coreDamage: 72,
      desc: 'LMB: 12-pellet close-range spread. Press F (Punch) immediately on firing LMB to +PROJECTILE BOOST an explosive shell! RMB: Lob an unstable Plasma Core—shoot it in mid-air with Revolver/Railcannon for a massive +CORE NUKE!'
    },
    {
      id: 'nailgun',
      slot: 3,
      name: 'ATTRACTOR NAILGUN',
      shortName: 'NAILGUN',
      subtitle: 'RAPID NAILS // OVERHEAT SALVO',
      color: '#38bdf8',
      fireRate: 0.065,
      nailDamage: 9.5,
      nailSpeed: 64.0,
      heatPerShot: 0.032,
      heatDecay: 0.28,
      overheatCooldown: 3.5,
      desc: 'LMB: Twin-barrel rotary nailgun that shreds crowds and builds thermal charge. RMB: Expend built-up heat to unleash a scorching salvo of incendiary nails that ignite enemies (+BURNING) for continuous blood spray.'
    },
    {
      id: 'railcannon',
      slot: 4,
      name: 'VOLT RAIL / ROCKET',
      shortName: 'RAIL / ROCKET',
      subtitle: 'ROCKET JUMP // ELECTRIC RAILCANNON',
      color: '#c084fc',
      rocketFireRate: 0.78,
      rocketDamage: 78,
      rocketSpeed: 46.0,
      rocketRadius: 6.8,
      railCooldown: 9.5,
      railDamage: 165,
      desc: 'LMB: High-velocity Rocket Launcher with splash damage, airshots (+FIREWORKS), and classic Quake Rocket-Jumping. RMB: Instant hitscan Electric Railcannon beam (9.5s battery) that pierces all enemies or detonates Coins/Cores!'
    }
  ];

  // ==================== ENEMY ARCHETYPE DEFINITIONS ====================
  B.ENEMIES = {
    husk: {
      id: 'husk',
      name: 'FILTH HUSK',
      role: 'MELEE SWARMER',
      hp: 45,
      speed: 13.5,
      radius: 0.75,
      height: 2.0,
      damage: 18,
      score: 60,
      bloodAmount: 18,
      lightweight: true,
      color: 0xdc2626,
      accent: 0xfca5a5,
      desc: 'Relentless sprinting husk that leaps with a parryable bite lunge. Easily launched into the air by Ground Slams and rockets.'
    },
    soldier: {
      id: 'soldier',
      name: 'STRAY SOLDIER',
      role: 'RANGED STRIKER',
      hp: 75,
      speed: 9.2,
      radius: 0.82,
      height: 2.25,
      damage: 22,
      score: 100,
      bloodAmount: 24,
      lightweight: true,
      color: 0xb45309,
      accent: 0xfbbf24,
      desc: 'Cybernetic skeletal trooper that strafes between ledges and fires glowing Hell Orbs that can be parried back with F.'
    },
    drone: {
      id: 'drone',
      name: 'SEEKER DRONE',
      role: 'AERIAL HARASSER',
      hp: 65,
      speed: 11.5,
      radius: 0.85,
      height: 1.5,
      flying: true,
      damage: 16,
      score: 120,
      bloodAmount: 22,
      lightweight: true,
      color: 0x6d28d9,
      accent: 0xe879f9,
      desc: 'Hovering armored oculus that strafes in 3D space. Spirals toward you to kamikaze on death—punch it with F for a +HOMERUN!'
    },
    juggernaut: {
      id: 'juggernaut',
      name: 'CERBERUS JUGGERNAUT',
      role: 'HEAVY COLOSSUS',
      hp: 260,
      speed: 7.4,
      radius: 1.35,
      height: 3.4,
      damage: 32,
      score: 280,
      bloodAmount: 45,
      lightweight: false,
      color: 0x57534e,
      accent: 0xef4444,
      desc: 'Towering stone-and-iron colossus. Hurls explosive spheres, stomps expanding shockwave rings you must jump over, and enrages below 50% HP.'
    },
    sentry: {
      id: 'sentry',
      name: 'MALICIOUS SENTRY',
      role: 'SNIPER SPECIALIST',
      hp: 115,
      speed: 6.5,
      radius: 0.9,
      height: 2.3,
      damage: 42,
      score: 190,
      bloodAmount: 28,
      lightweight: false,
      color: 0x0f766e,
      accent: 0x22d3ee,
      desc: 'Tripod rail-sniper that projects a tracking laser sight before firing. Break sight, dash at the red flash, or Coin Toss to deflect (+CHARGEBACK)!'
    },
    boss: {
      id: 'boss',
      name: 'ARCHON V-0 // SUPREME MACHINE',
      role: 'APEX BOSS',
      hp: 1100,
      speed: 15.0,
      radius: 1.25,
      height: 3.2,
      flying: true,
      damage: 28,
      score: 1500,
      bloodAmount: 90,
      lightweight: false,
      color: 0xd97706,
      accent: 0xfef08a,
      desc: 'Winged cyber-seraph wielding twin energy blades, parryable spear throws, shockwave dives, and Phase 2 enraged teleport combos.'
    }
  };

  // ==================== VISUAL BIOME PALETTES ====================
  B.BIOMES = {
    furnace: {
      id: 'furnace',
      name: 'RUST & BLOOD FOUNDRY',
      wallTex: 'rustMetal',
      floorTex: 'grateFloor',
      trimTex: 'hazardStripe',
      pillarTex: 'rivetIron',
      hazardType: 'lava',
      fogColor: 0x1a0707,
      ambientColor: 0x5a2824,
      mainLightColor: 0xff6b35,
      accentLightColor: 0xff2222,
      skyColor: 0x120404
    },
    meatgrinder: {
      id: 'meatgrinder',
      name: 'BRUTALIST SLAUGHTERHOUSE',
      wallTex: 'bloodConcrete',
      floorTex: 'darkTile',
      trimTex: 'hazardStripe',
      pillarTex: 'rustMetal',
      hazardType: 'lava',
      fogColor: 0x16090c,
      ambientColor: 0x523038,
      mainLightColor: 0xf43f5e,
      accentLightColor: 0xfb923c,
      skyColor: 0x0f0507
    },
    cathedral: {
      id: 'cathedral',
      name: 'VOLTAGE CATHEDRAL',
      wallTex: 'gothicStone',
      floorTex: 'stoneTile',
      trimTex: 'neonTrim',
      pillarTex: 'gothicStone',
      hazardType: 'void',
      fogColor: 0x090b1a,
      ambientColor: 0x353b68,
      mainLightColor: 0x818cf8,
      accentLightColor: 0xc084fc,
      skyColor: 0x060712
    },
    aqueduct: {
      id: 'aqueduct',
      name: 'ABYSSAL AQUEDUCT',
      wallTex: 'rivetIron',
      floorTex: 'grateFloor',
      trimTex: 'acidTrim',
      pillarTex: 'bloodConcrete',
      hazardType: 'acid',
      fogColor: 0x051814,
      ambientColor: 0x26584c,
      mainLightColor: 0x34d399,
      accentLightColor: 0x22d3ee,
      skyColor: 0x03100d
    },
    throne: {
      id: 'throne',
      name: 'THRONE OF IRON',
      wallTex: 'goldObsidian',
      floorTex: 'stoneTile',
      trimTex: 'goldTrim',
      pillarTex: 'goldObsidian',
      hazardType: 'lava',
      fogColor: 0x1c0d06,
      ambientColor: 0x683b24,
      mainLightColor: 0xfbbf24,
      accentLightColor: 0xef4444,
      skyColor: 0x120703
    }
  };

  // ==================== 5 PRE-MADE CAMPAIGN LEVELS ====================
  B.CAMPAIGN_LEVELS = [
    {
      id: 'level_1',
      code: '0-1',
      title: 'INTO THE FURNACE',
      subtitle: 'INDUSTRIAL SMELTERY // SECTOR I',
      biome: 'furnace',
      parTime: 95,
      parStyle: 1800,
      briefing: 'Breach the upper smelting foundry. Master sliding, stamina dashing, and close-range blood harvesting against Husk swarms and Stray Soldiers.',
      rooms: [
        {
          name: 'SMELTING VESTIBULE',
          w: 28, l: 32, h: 12,
          layout: 'vestibule_pillars',
          waves: [
            [{ type: 'husk', count: 5 }, { type: 'soldier', count: 2 }]
          ]
        },
        {
          name: 'MOLTEN VAT CHAMBER',
          w: 36, l: 40, h: 15,
          layout: 'twin_lava_bridges',
          waves: [
            [{ type: 'husk', count: 6 }, { type: 'soldier', count: 3 }],
            [{ type: 'husk', count: 4 }, { type: 'soldier', count: 3 }, { type: 'drone', count: 2 }]
          ]
        },
        {
          name: 'FOUNDRY TURBINE HALL',
          w: 40, l: 44, h: 16,
          layout: 'central_tower_jumppads',
          waves: [
            [{ type: 'husk', count: 6 }, { type: 'drone', count: 3 }],
            [{ type: 'soldier', count: 4 }, { type: 'drone', count: 3 }, { type: 'husk', count: 5 }]
          ]
        }
      ]
    },
    {
      id: 'level_2',
      code: '0-2',
      title: 'MEATGRINDER',
      subtitle: 'PROCESSING MATRIX // SECTOR II',
      biome: 'meatgrinder',
      parTime: 120,
      parStyle: 2600,
      briefing: 'Navigate the elevated slaughterhouse catwalks and pneumatic crushers. Use Seeker Drones as explosive baseballs with your Feedbacker punch (F).',
      rooms: [
        {
          name: 'CRUSHER CORRIDOR',
          w: 30, l: 36, h: 13,
          layout: 'crusher_hall',
          waves: [
            [{ type: 'husk', count: 6 }, { type: 'drone', count: 2 }, { type: 'soldier', count: 2 }]
          ]
        },
        {
          name: 'THE ABATTOIR PIT',
          w: 38, l: 42, h: 16,
          layout: 'pit_overlook',
          waves: [
            [{ type: 'soldier', count: 4 }, { type: 'drone', count: 3 }, { type: 'husk', count: 5 }],
            [{ type: 'husk', count: 7 }, { type: 'drone', count: 4 }, { type: 'soldier', count: 3 }]
          ]
        },
        {
          name: 'GRINDER CORE',
          w: 42, l: 46, h: 17,
          layout: 'multi_tier_arena',
          waves: [
            [{ type: 'drone', count: 4 }, { type: 'soldier', count: 4 }],
            [{ type: 'juggernaut', count: 1 }, { type: 'husk', count: 6 }, { type: 'drone', count: 2 }]
          ]
        }
      ]
    },
    {
      id: 'level_3',
      code: '0-3',
      title: 'VOLTAGE CATHEDRAL',
      subtitle: 'HIGH-TENSION NAVE // SECTOR III',
      biome: 'cathedral',
      parTime: 140,
      parStyle: 3400,
      briefing: 'Ascend the neon-drenched cathedral vaults. Beware the towering Cerberus Juggernauts—jump over their red shockwave rings and unload Core Nukes.',
      rooms: [
        {
          name: 'NAVE OF COLONNADES',
          w: 34, l: 40, h: 16,
          layout: 'cathedral_nave',
          waves: [
            [{ type: 'soldier', count: 4 }, { type: 'drone', count: 3 }, { type: 'husk', count: 5 }]
          ]
        },
        {
          name: 'BELFRY ASCENSION',
          w: 40, l: 44, h: 20,
          layout: 'central_tower_jumppads',
          waves: [
            [{ type: 'juggernaut', count: 1 }, { type: 'soldier', count: 4 }, { type: 'drone', count: 3 }],
            [{ type: 'sentry', count: 2 }, { type: 'husk', count: 6 }, { type: 'drone', count: 3 }]
          ]
        },
        {
          name: 'SANCTUARY OF TWIN COLOSSI',
          w: 44, l: 48, h: 18,
          layout: 'multi_tier_arena',
          waves: [
            [{ type: 'juggernaut', count: 2 }, { type: 'soldier', count: 4 }, { type: 'husk', count: 6 }]
          ]
        }
      ]
    },
    {
      id: 'level_4',
      code: '0-4',
      title: 'ABYSSAL AQUEDUCT',
      subtitle: 'TOXIC CONDUIT // SECTOR IV',
      biome: 'aqueduct',
      parTime: 155,
      parStyle: 4000,
      briefing: 'Cross the corrosive cyber-acid canals under heavy Malicious Sentry sniper lock-on. Flick coins or dash at the red laser flash to survive.',
      rooms: [
        {
          name: 'SLUICEWAY CROSSING',
          w: 36, l: 42, h: 15,
          layout: 'twin_lava_bridges',
          waves: [
            [{ type: 'sentry', count: 2 }, { type: 'soldier', count: 4 }, { type: 'husk', count: 5 }]
          ]
        },
        {
          name: 'HYDRO-REACTOR BASIN',
          w: 42, l: 46, h: 18,
          layout: 'pit_overlook',
          waves: [
            [{ type: 'drone', count: 4 }, { type: 'sentry', count: 2 }, { type: 'husk', count: 6 }],
            [{ type: 'juggernaut', count: 1 }, { type: 'sentry', count: 2 }, { type: 'soldier', count: 4 }]
          ]
        },
        {
          name: 'RESERVOIR OVERLOOK',
          w: 46, l: 50, h: 18,
          layout: 'central_tower_jumppads',
          waves: [
            [{ type: 'juggernaut', count: 2 }, { type: 'sentry', count: 2 }, { type: 'drone', count: 4 }, { type: 'husk', count: 6 }]
          ]
        }
      ]
    },
    {
      id: 'level_5',
      code: '0-5',
      title: 'THRONE OF IRON',
      subtitle: 'APEX SANCTUM // ARCHON V-0',
      biome: 'throne',
      parTime: 165,
      parStyle: 4800,
      briefing: 'Clear the Praetorian gauntlet and enter the Grand Sanctum to duel ARCHON V-0. Parry his spear throws, dodge his dive-bombs, and claim P-Rank.',
      rooms: [
        {
          name: 'PRAETORIAN GAUNTLET',
          w: 36, l: 40, h: 16,
          layout: 'cathedral_nave',
          waves: [
            [{ type: 'juggernaut', count: 1 }, { type: 'sentry', count: 2 }, { type: 'soldier', count: 3 }, { type: 'husk', count: 5 }]
          ]
        },
        {
          name: 'SANCTUM OF THE ARCHON',
          w: 50, l: 52, h: 22,
          layout: 'boss_sanctum',
          isBossRoom: true,
          waves: [
            [{ type: 'boss', count: 1 }, { type: 'husk', count: 4 }]
          ]
        }
      ]
    }
  ];

  // Architectural layout archetypes shared between Pre-Made and Endless Generative rooms
  B.ROOM_LAYOUTS = [
    'vestibule_pillars',
    'twin_lava_bridges',
    'central_tower_jumppads',
    'crusher_hall',
    'pit_overlook',
    'multi_tier_arena',
    'cathedral_nave',
    'boss_sanctum'
  ];

})(window.Bloodcore);
