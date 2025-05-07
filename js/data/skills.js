// js/data/skills.js

// Skill Target Types: self, enemy_single, enemy_all, ally_single, ally_all, party (player + allies)
// Skill Effect Types: damage, heal, stat_change, status_effect, summon (future), revive (future)

export const SKILLS_DATA = {
    // === WARRIOR SKILLS ===
    // --- Warrior Basic Strikes Tree ---
    skill_power_strike: {
        id: "skill_power_strike",
        name: "Power Strike",
        tree: "warrior_basic_strikes", tier: 1,
        description: "A focused blow dealing 120% weapon damage.",
        mpCost: 3, type: "attack", target: "enemy_single", school: "physical",
        effect: { type: "damage", baseMultiplier: 1.2, scaleStat: "str", scaleFactor: 0.1, element: "physical" },
        levelRequirement: 1, animation: "slash_heavy",
    },
    skill_cleave: {
        id: "skill_cleave",
        name: "Cleave",
        tree: "warrior_basic_strikes", tier: 2,
        prerequisites: ["skill_power_strike"],
        description: "Sweeping attack hitting up to 2 enemies for 80% weapon damage.",
        mpCost: 6, type: "attack", target: "enemy_aoe_2", school: "physical", // enemy_aoe_X targets X random enemies, or main + adjacent
        effect: { type: "damage", baseMultiplier: 0.8, scaleStat: "str", scaleFactor: 0.05, element: "physical" },
        levelRequirement: 4, animation: "slash_wide",
    },
    // --- Warrior Defensive Maneuvers Tree ---
    skill_defend_stance: {
        id: "skill_defend_stance",
        name: "Defensive Stance",
        tree: "warrior_defensive_maneuvers", tier: 1,
        description: "Increases your Defense by 30% for 3 turns.",
        mpCost: 5, type: "buff", target: "self",
        effect: { type: "status_effect", statusId: "se_def_up_30", duration: 3 },
        levelRequirement: 2, animation: "shield_glow_self",
    },
    skill_shield_bash: {
        id: "skill_shield_bash",
        name: "Shield Bash",
        tree: "warrior_defensive_maneuvers", tier: 2,
        prerequisites: ["skill_defend_stance"],
        description: "Slams an enemy with your shield, dealing minor damage and chance to Stun.",
        mpCost: 7, type: "attack_debuff", target: "enemy_single", school: "physical",
        effect: [
            { type: "damage", baseMultiplier: 0.5, scaleStat: "str", scaleFactor: 0.05, element: "physical" },
            { type: "status_effect", statusId: "se_stun", duration: 1, chance: 30 }
        ],
        levelRequirement: 5, requiresShield: true, animation: "shield_slam",
    },

    // === MAGE SKILLS ===
    // --- Mage Elemental Bolts Tree ---
    skill_mana_bolt: {
        id: "skill_mana_bolt",
        name: "Mana Bolt",
        tree: "mage_elemental_bolts", tier: 1,
        description: "Hurls a bolt of raw energy, dealing (10 + 1.5*INT) arcane damage.",
        mpCost: 4, type: "attack", target: "enemy_single", school: "arcane",
        effect: { type: "damage", basePower: 10, scaleStat: "int", scaleFactor: 1.5, element: "arcane" },
        levelRequirement: 1, animation: "bolt_arcane",
    },
    skill_fireball: {
        id: "skill_fireball",
        name: "Fireball",
        tree: "mage_elemental_bolts", tier: 2,
        prerequisites: ["skill_mana_bolt"],
        description: "Launches a fiery orb, dealing (15 + 1.2*INT) fire damage to an enemy and splash damage to adjacent.",
        mpCost: 8, type: "attack", target: "enemy_single_splash", school: "fire",
        effect: { type: "damage", basePower: 15, scaleStat: "int", scaleFactor: 1.2, element: "fire", splashMultiplier: 0.5 },
        levelRequirement: 4, animation: "explosion_fire",
    },

    // === ROGUE SKILLS ===
    // --- Rogue Stealth Tactics Tree ---
    skill_stealth: {
        id: "skill_stealth",
        name: "Stealth",
        tree: "rogue_stealth_tactics", tier: 1,
        description: "Become hidden for 2 turns, next attack is a guaranteed critical hit.",
        mpCost: 7, type: "buff", target: "self",
        effect: { type: "status_effect", statusId: "se_stealthed_crit", duration: 2 },
        levelRequirement: 2, animation: "vanish_self",
    },
    skill_shadow_strike: {
        id: "skill_shadow_strike",
        name: "Shadow Strike",
        tree: "rogue_stealth_tactics", tier: 2,
        prerequisites: ["skill_stealth"],
        description: "Strike from the shadows. Deals 150% weapon damage. Requires Stealth.",
        mpCost: 5, type: "attack", target: "enemy_single", school: "physical",
        effect: { type: "damage", baseMultiplier: 1.5, scaleStat: "dex", scaleFactor: 0.15, element: "shadow" },
        levelRequirement: 5, requiresStatus: "se_stealthed_crit", animation: "stab_shadow",
    },

    // === ALLY SKILLS (Sansan Dino) ===
    skill_dino_bash: {
        id: "skill_dino_bash",
        name: "Dino Bash",
        description: "A powerful headbutt, dealing (20 + 1.0*STR) physical damage.",
        mpCost: 8, type: "attack", target: "enemy_single", school: "physical",
        effect: { type: "damage", basePower: 20, scaleStat: "str", scaleFactor: 1.0, element: "physical" },
        levelRequirement: 1, forClass: "dino_guardian", animation: "bash_heavy",
    },
    skill_dino_roar_taunt: {
        id: "skill_dino_roar_taunt",
        name: "Primal Roar",
        description: "Taunts all enemies, forcing them to attack Sansan for 2 turns. Increases Sansan's Defense.",
        mpCost: 12, type: "debuff_buff", target: "enemy_all_self", // Affects all enemies and self
        effect: [
            { type: "status_effect", statusId: "se_taunted_by_sansan", duration: 2, targetType: "enemy_all" },
            { type: "status_effect", statusId: "se_def_up_20_sansan", duration: 2, targetType: "self" }
        ],
        levelRequirement: 5, forClass: "dino_guardian", animation: "roar_area",
    },
    skill_protective_aura: {
        id: "skill_protective_aura",
        name: "Protective Aura",
        description: "Creates an aura around Cutiepatotie, granting her +20% Defense for 3 turns.",
        mpCost: 10, type: "buff", target: "ally_leader", // Special target for party leader
        effect: { type: "status_effect", statusId: "se_def_up_20_ally", duration: 3 },
        levelRequirement: 10, forClass: "dino_guardian", animation: "aura_protect_ally",
    },
    skill_earthshaker_stomp: {
        id: "skill_earthshaker_stomp",
        name: "Earthshaker Stomp",
        description: "Slams the ground, dealing (15 + 0.8*STR) physical damage to all enemies and chance to Slow.",
        mpCost: 18, type: "attack_debuff", target: "enemy_all", school: "physical",
        effect: [
            { type: "damage", basePower: 15, scaleStat: "str", scaleFactor: 0.8, element: "earth" },
            { type: "status_effect", statusId: "se_slow", duration: 2, chance: 40 }
        ],
        levelRequirement: 15, forClass: "dino_guardian", animation: "stomp_earth",
    }
};

// Define Skill Trees structure
// This maps a tree ID to an array of skill IDs in that tree, ordered by tier or preference.
// For V0.5, skill learning will be mostly linear within these based on prerequisites.
export const SKILL_TREES_META = {
    warrior_basic_strikes: { name: "Basic Strikes", skills: ["skill_power_strike", "skill_cleave", /* more */ ] },
    warrior_defensive_maneuvers: { name: "Defensive Maneuvers", skills: ["skill_defend_stance", "skill_shield_bash", /* more */ ] },
    // ... other trees for warrior
    mage_elemental_bolts: { name: "Elemental Bolts", skills: ["skill_mana_bolt", "skill_fireball", /* more */ ] },
    // ... other trees for mage
    rogue_stealth_tactics: { name: "Stealth Tactics", skills: ["skill_stealth", "skill_shadow_strike", /* more */ ] },
    // ... other trees for rogue
    // Ally skill trees aren't player-choosable in this version, skills are learned by level progression or are innate.
};


// Status Effect Definitions
export const STATUS_EFFECTS_DATA = {
    se_def_up_30: { id: "se_def_up_30", name: "Defense Up", type: "buff", statChanges: { defense: { multiplier: 1.3 } }, onApplyMsg: "{targetName} feels sturdier!", onRemoveMsg: "{targetName}'s enhanced defense fades." },
    se_def_up_20_sansan: { id: "se_def_up_20_sansan", name: "Dino Defense", type: "buff", statChanges: { defense: { multiplier: 1.2 } }, onApplyMsg: "Sansan's hide hardens!", onRemoveMsg: "Sansan's hide returns to normal." },
    se_def_up_20_ally: { id: "se_def_up_20_ally", name: "Protected", type: "buff", statChanges: { defense: { multiplier: 1.2 } }, onApplyMsg: "{targetName} is protected by an aura!", onRemoveMsg: "The protective aura around {targetName} fades." },
    se_stealthed_crit: { id: "se_stealthed_crit", name: "Stealthed", type: "buff", specialFlags: ["guaranteed_crit_next_attack", "untargetable"], onApplyMsg: "{targetName} vanishes into the shadows!", onRemoveMsg: "{targetName} is revealed!" },
    se_stun: { id: "se_stun", name: "Stunned", type: "debuff", blocksTurn: true, onApplyMsg: "{targetName} is stunned!", onRemoveMsg: "{targetName} recovers from stun." },
    se_slow: { id: "se_slow", name: "Slowed", type: "debuff", statChanges: { speed: { multiplier: 0.7 } }, onApplyMsg: "{targetName} is slowed!", onRemoveMsg: "{targetName} is no longer slowed." },
    se_taunted_by_sansan: { id: "se_taunted_by_sansan", name: "Taunted", type: "debuff", forcesTarget: "sansan_dino", onApplyMsg: "{targetName} is enraged by Sansan!", onRemoveMsg: "{targetName} is no longer taunted by Sansan." },
    se_poison: { id: "se_poison", name: "Poisoned", type: "debuff", dot: { damageType: "poison", basePower: 5, scaleStat: "caster_int", scaleFactor: 0.1, interval: 1 }, onApplyMsg: "{targetName} is poisoned!", onRemoveMsg: "{targetName} is no longer poisoned.", onTickMsg: "{targetName} takes {damage} poison damage." }
};
