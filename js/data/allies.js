// js/data/allies.js
import { SKILLS_DATA } from './skills.js'; // Assuming skills are defined here

export const ALLY_DATA = {
    sansan_dino: {
        id: "sansan_dino",
        name: "Sansan (Dino)",
        classId: "dino_guardian", // Link to a class definition
        level: 10,
        baseStats: { // Override or provide specific base stats if not fully class-driven
            str: 25, dex: 15, con: 30, int: 10, wis: 12, cha: 18,
            hp: 200, mp: 50, mpRegen: 1,
            attack: 0, // Will be derived
            defense: 0, // Will be derived
        },
        skills: ["skill_dino_roar_taunt", "skill_protective_aura", "skill_dino_bash"], // Starting skills
        equipment: { // Example starting equipment for Sansan
            weapon: "w010_primal_club", // Define these items in items.js
            body: "a010_thick_hide_armor"
        },
        aiProfile: "guardian_dps", // For aiManager to pick behavior
        // Special properties for Sansan
        isUnobtainablePlayerAlly: true,
        dialogueTriggers: { // For his unique chat system
            missYouPrompt: "I miss you baby ko",
            loveYouPrompt1: "baby ko i love you", // First time
            loveYouPrompt2: "i love you baby ko", // Subsequent
            proposalPrompt: "I love you gid so much... will you be my forever?",
            hugReply: "*hugs Cutiepatotie tight with kisses*",
            loveReply1: "I love you so much please kita lang okay? kita lang gid asta sa ulihit.. i love you.. baby? sabta ko or bite bite roror",
            loveReply2: "*kisses Cutiepatotie on her cheeks*",
            proposalAcceptReply: "I love you gid so much... *Gets on one knee, a small, glowing box in his hand.* Will you be my forever?",
            negativeResponse1: "...",
            negativeResponse2: "ok...",
            leavePartyMessage: "*Sansan looks heartbroken, his form flickering. He slowly fades away...*",
        }
    }
};

// Define Dino Guardian Class here or in classes.js
// If in classes.js, ensure it's imported/accessible
export const ALLY_CLASSES = {
     dino_guardian: {
        name: "Dino Guardian",
        description: "A primeval protector, channeling the might of ancient beasts to shield their charge.",
        baseStats: { // Base stats for the class itself if an ally is created using it directly
            str: 20, dex: 12, con: 25, int: 8, wis: 10, cha: 15,
            hp: 150, mp: 30, mpRegen: 0.5
        },
        // Skill progression for this class (if allies can learn new skills via level up)
        skillProgression: {
            1: ["skill_dino_bash"],
            5: ["skill_dino_roar_taunt"],
            10: ["skill_protective_aura"], // Sansan starts with this as he's Lvl 10
            15: ["skill_earthshaker_stomp"]
        },
        // Unique passive for this class
        passives: [
            {
                id: "passive_redirect_all_damage",
                name: "Primal Ward",
                description: "All damage directed at the party leader (Cutiepatotie) is redirected to Sansan.",
                condition: (caster, target, partyLeader) => caster.id === ALLY_DATA.sansan_dino.id && target?.id === partyLeader?.id,
                effect: (damageData, combatManager) => {
                    // This logic will be handled more directly in combatManager.applyDamage
                    // This passive is more of a flag for that logic.
                    damageData.redirectTargetId = ALLY_DATA.sansan_dino.id; // Mark for redirection
                    return damageData;
                }
            }
        ]
    }
};

// Make sure to define Sansan's skills in skills.js
// e.g., skill_dino_roar_taunt, skill_protective_aura, skill_dino_bash
