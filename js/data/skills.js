// js/data/skills.js

// Skill Target Types: self, enemy_single, enemy_all, ally_single, ally_all, party, enemy_aoe_2, enemy_single_splash, enemy_all_self, ally_leader
// Skill Effect Types: damage, heal, stat_change, status_effect, summon, revive

export const SKILLS_DATA = {
    // === WARRIOR SKILLS ===
    skill_power_strike: {
        id: "skill_power_strike", name: "Power Strike", tree: "warrior_basic_strikes", tier: 1,
        description: "A focused blow dealing 120% weapon damage.", mpCost: 3, type: "attack", target: "enemy_single", school: "physical",
        effect: { type: "damage", baseMultiplier: 1.2, scaleStat: "str", scaleFactor: 0.1, element: "physical" },
        levelRequirement: 1, animation: "slash_heavy", cost: 1
    },
    skill_cleave: {
        id: "skill_cleave", name: "Cleave", tree: "warrior_basic_strikes", tier: 2, prerequisites: ["skill_power_strike"],
        description: "Sweeping attack hitting up to 2 enemies for 80% weapon damage.", mpCost: 6, type: "attack", target: "enemy_aoe_2", school: "physical",
        effect: { type: "damage", baseMultiplier: 0.8, scaleStat: "str", scaleFactor: 0.05, element: "physical" },
        levelRequirement: 4, animation: "slash_wide", cost: 1
    },
    skill_defend_stance: {
        id: "skill_defend_stance", name: "Defensive Stance", tree: "warrior_defensive_maneuvers", tier: 1,
        description: "Increases your Defense by 30% for 3 turns.", mpCost: 5, type: "buff", target: "self",
        effect: { type: "status_effect", statusId: "se_def_up_30", duration: 3 },
        levelRequirement: 2, animation: "shield_glow_self", cost: 1
    },
    skill_shield_bash: {
        id: "skill_shield_bash", name: "Shield Bash", tree: "warrior_defensive_maneuvers", tier: 2, prerequisites: ["skill_defend_stance"],
        description: "Slams an enemy with your shield, dealing minor damage and chance to Stun.", mpCost: 7, type: "attack_debuff", target: "enemy_single", school: "physical",
        effect: [ { type: "damage", baseMultiplier: 0.5, scaleStat: "con", scaleFactor: 0.1, element: "physical" }, { type: "status_effect", statusId: "se_stun", duration: 1, chance: 30 } ],
        levelRequirement: 5, requiresShield: true, animation: "shield_slam", cost: 1
    },

    // === MAGE SKILLS ===
    skill_mana_bolt: {
        id: "skill_mana_bolt", name: "Mana Bolt", tree: "mage_elemental_bolts", tier: 1,
        description: "Hurls a bolt of raw energy, dealing (10 + 1.5*INT) arcane damage.", mpCost: 4, type: "attack", target: "enemy_single", school: "arcane",
        effect: { type: "damage", basePower: 10, scaleStat: "int", scaleFactor: 1.5, element: "arcane" },
        levelRequirement: 1, animation: "bolt_arcane", cost: 1
    },
    skill_fireball: {
        id: "skill_fireball", name: "Fireball", tree: "mage_elemental_bolts", tier: 2, prerequisites: ["skill_mana_bolt"],
        description: "Launches a fiery orb, dealing (15 + 1.2*INT) fire damage to an enemy and splash damage to adjacent.", mpCost: 8, type: "attack", target: "enemy_single_splash", school: "fire",
        effect: { type: "damage", basePower: 15, scaleStat: "int", scaleFactor: 1.2, element: "fire", splashMultiplier: 0.5 },
        levelRequirement: 4, animation: "explosion_fire", cost: 1
    },

    // === ROGUE SKILLS ===
    skill_stealth: {
        id: "skill_stealth", name: "Stealth", tree: "rogue_stealth_tactics", tier: 1,
        description: "Become hidden for 2 turns, next attack is a guaranteed critical hit.", mpCost: 7, type: "buff", target: "self",
        effect: { type: "status_effect", statusId: "se_stealthed_crit", duration: 2 },
        levelRequirement: 2, animation: "vanish_self", cost: 1
    },
    skill_shadow_strike: {
        id: "skill_shadow_strike", name: "Shadow Strike", tree: "rogue_stealth_tactics", tier: 2, prerequisites: ["skill_stealth"],
        description: "Strike from the shadows. Deals 150% weapon damage. Requires Stealth.", mpCost: 5, type: "attack", target: "enemy_single", school: "physical",
        effect: { type: "damage", baseMultiplier: 1.5, scaleStat: "dex", scaleFactor: 0.15, element: "shadow" },
        levelRequirement: 5, requiresStatus: "se_stealthed_crit", animation: "stab_shadow", cost: 1
    },

    // === ALLY SKILLS (Sansan Dino) ===
    skill_dino_bash: {
        id: "skill_dino_bash", name: "Dino Bash", description: "A powerful headbutt, dealing (20 + 1.0*STR) physical damage.", mpCost: 8, type: "attack", target: "enemy_single", school: "physical",
        effect: { type: "damage", basePower: 20, scaleStat: "str", scaleFactor: 1.0, element: "physical" },
        levelRequirement: 1, forClass: "dino_guardian", animation: "bash_heavy",
    },
    skill_dino_roar_taunt: {
        id: "skill_dino_roar_taunt", name: "Primal Roar", description: "Taunts all enemies, forcing them to attack Sansan for 2 turns. Increases Sansan's Defense.", mpCost: 12, type: "debuff_buff", target: "enemy_all_self",
        effect: [ { type: "status_effect", statusId: "se_taunted_by_sansan", duration: 2, targetType: "enemy_all", chance: 80 }, { type: "status_effect", statusId: "se_def_up_20_sansan", duration: 2, targetType: "self" } ],
        levelRequirement: 5, forClass: "dino_guardian", animation: "roar_area",
    },
    skill_protective_aura: {
        id: "skill_protective_aura", name: "Protective Aura", description: "Creates an aura around Cutiepatotie, granting her +20% Defense for 3 turns.", mpCost: 10, type: "buff", target: "ally_leader",
        effect: { type: "status_effect", statusId: "se_def_up_20_ally", duration: 3 },
        levelRequirement: 10, forClass: "dino_guardian", animation: "aura_protect_ally",
    },
    skill_earthshaker_stomp: {
        id: "skill_earthshaker_stomp", name: "Earthshaker Stomp", description: "Slams the ground, dealing (15 + 0.8*STR) physical damage to all enemies and chance to Slow.", mpCost: 18, type: "attack_debuff", target: "enemy_all", school: "physical",
        effect: [ { type: "damage", basePower: 15, scaleStat: "str", scaleFactor: 0.8, element: "earth" }, { type: "status_effect", statusId: "se_slow", duration: 2, chance: 40 } ],
        levelRequirement: 15, forClass: "dino_guardian", animation: "stomp_earth",
    },

    // === ENEMY SKILLS ===
    skill_goblin_club_bash: {
        id: "skill_goblin_club_bash", name: "Crude Bash", description: "A clumsy but forceful swing.", mpCost: 3, type: "attack", target: "enemy_single",
        effect: { type: "damage", baseMultiplier: 1.1, scaleStat: "str", scaleFactor: 0.05 },
        levelRequirement: 1, animation: "bash_basic",
    },
    skill_goblin_frenzy_roar: {
        id: "skill_goblin_frenzy_roar", name: "Frenzied Roar", description: "The goblin works itself into a rage, increasing Attack.", mpCost: 5, type: "buff", target: "self",
        effect: { type: "status_effect", statusId: "se_atk_up_20", duration: 3 },
        levelRequirement: 1, animation: "roar_self",
    },
    skill_spider_poison_bite: {
        id: "skill_spider_poison_bite", name: "Poison Bite", description: "A venomous bite that deals damage and may poison.", mpCost: 4, type: "attack_debuff", target: "enemy_single",
        effect: [ { type: "damage", baseMultiplier: 0.9, scaleStat: "dex", scaleFactor: 0.05 }, { type: "status_effect", statusId: "se_poison", duration: 3, chance: 50 } ],
        levelRequirement: 1, animation: "bite_poison",
    }
};

export const SKILL_TREES_META = {
    warrior_basic_strikes: { name: "Basic Strikes", skills: ["skill_power_strike", "skill_cleave" ] },
    warrior_defensive_maneuvers: { name: "Defensive Maneuvers", skills: ["skill_defend_stance", "skill_shield_bash" ] },
    warrior_advanced_combat: { name: "Advanced Combat", skills: [ /* Define later */ ] },
    mage_elemental_bolts: { name: "Elemental Bolts", skills: ["skill_mana_bolt", "skill_fireball" ] },
    mage_arcane_wards: { name: "Arcane Wards", skills: [ /* Define later */ ] },
    mage_conjuration_mastery: { name: "Conjuration Mastery", skills: [ /* Define later */ ] },
    rogue_stealth_tactics: { name: "Stealth Tactics", skills: ["skill_stealth", "skill_shadow_strike" ] },
    rogue_debilitating_strikes: { name: "Debilitating Strikes", skills: [ /* Define later */ ] },
    rogue_evasion_arts: { name: "Evasion Arts", skills: [ /* Define later */ ] },
};


export const STATUS_EFFECTS_DATA = {
    se_def_up_30: { id: "se_def_up_30", name: "Defense Up", type: "buff", icon:"🛡️⬆️", statChanges: { defense: { multiplier: 1.3 } }, onApplyMsg: "{targetName} feels sturdier!", onRemoveMsg: "{targetName}'s enhanced defense fades." },
    se_def_up_20_sansan: { id: "se_def_up_20_sansan", name: "Dino Defense", type: "buff", icon:"🦖🛡️", statChanges: { defense: { multiplier: 1.2 } }, onApplyMsg: "Sansan's hide hardens!", onRemoveMsg: "Sansan's hide returns to normal." },
    se_def_up_20_ally: { id: "se_def_up_20_ally", name: "Protected", type: "buff", icon:"✨🛡️", statChanges: { defense: { multiplier: 1.2 } }, onApplyMsg: "{targetName} is protected by an aura!", onRemoveMsg: "The protective aura around {targetName} fades." },
    se_atk_up_20: { id: "se_atk_up_20", name: "Attack Up", type: "buff", icon:"⚔️⬆️", statChanges: { attack: { multiplier: 1.2 } }, onApplyMsg: "{targetName} feels stronger!", onRemoveMsg: "{targetName}'s enhanced attack fades." },
    se_stealthed_crit: { id: "se_stealthed_crit", name: "Stealthed", type: "buff", icon:"👻", specialFlags: ["guaranteed_crit_next_attack", "untargetable"], onApplyMsg: "{targetName} vanishes into the shadows!", onRemoveMsg: "{targetName} is revealed!" },
    se_stun: { id: "se_stun", name: "Stunned", type: "debuff", icon:"💫", blocksTurn: true, onApplyMsg: "{targetName} is stunned!", onRemoveMsg: "{targetName} recovers from stun." },
    se_slow: { id: "se_slow", name: "Slowed", type: "debuff", icon:"🐌", statChanges: { speed: { multiplier: 0.7 } }, onApplyMsg: "{targetName} is slowed!", onRemoveMsg: "{targetName} is no longer slowed." },
    se_taunted_by_sansan: { id: "se_taunted_by_sansan", name: "Taunted", type: "debuff", icon:"😠", forcesTarget: "sansan_dino", onApplyMsg: "{targetName} is enraged by Sansan!", onRemoveMsg: "{targetName} is no longer taunted by Sansan." },
    se_poison: { id: "se_poison", name: "Poisoned", type: "debuff", icon:"☠️", dot: { damageType: "poison", basePower: 5, scaleStat: null, scaleFactor: 0, interval: 1 }, onApplyMsg: "{targetName} is poisoned!", onRemoveMsg: "{targetName} is no longer poisoned.", onTickMsg: "{targetName} takes {damage} poison damage." }
};
