// js/data/items.js

// Item Types: weapon, armor, accessory, consumable, quest, key_item, currency_junk
// Armor Slots: head, body, hands, feet, offHand (for shields)
// Weapon Slots: weapon (mainHand), twoHand (occupies weapon & offHand)

export const ITEMS_DATA = {
    // --- CURRENCY / JUNK ---
    i001: { id: "i001", name: "Old Coin", type: "currency_junk", description: "A tarnished copper coin.", rarity: "common", value: 1, stackable: true, icon: "🪙" },
    // --- QUEST ITEMS ---
    i002: { id: "i002", name: "Lumina Petal", type: "quest_item", description: "A glowing petal from a Lumina Flower.", rarity: "uncommon", value: 0, stackable: true, maxStack: 5, icon: "🌸" },
    i003: { id: "i003", name: "Dragon Scale Fragment", type: "quest_item", description: "A chipped scale, radiating ancient power.", rarity: "epic", value: 0, stackable: false, icon: "🐉" },
    i004: { id: "i004", name: "Aristocrat's Signet Ring", type: "key_item", description: "A signet ring bearing the Elmsworth family crest. Proof of your aid.", rarity: "rare", value: 0, stackable: false, icon: "💍" },

    // --- CONSUMABLES ---
    c001: { id: "c001", name: "Minor Healing Draught", type: "consumable", description: "Restores 30 HP.", rarity: "common", value: 15, stackable: true, maxStack: 10, icon: "🧪", use_effect: { type: "heal", target: "self_or_ally", amount: 30 } },
    c002: { id: "c002", name: "Minor Mana Potion", type: "consumable", description: "Restores 20 MP.", rarity: "common", value: 20, stackable: true, maxStack: 10, icon: "💧", use_effect: { type: "restore_mp", target: "self_or_ally", amount: 20 } },
    c003: { id: "c003", name: "Antidote", type: "consumable", description: "Cures Poison.", rarity: "uncommon", value: 25, stackable: true, maxStack: 5, icon: "🌿", use_effect: { type: "cure_status", statusId: "se_poison", target: "self_or_ally" } },
    sp_orb_small: { id: "sp_orb_small", name: "Small SP Orb", type: "consumable", description: "Grants 10 Study Points.", rarity: "uncommon", value: 0, stackable: true, icon: "🔮", use_effect: { type: "grant_sp", amount: 10 } },
    sp_orb_medium: { id: "sp_orb_medium", name: "Medium SP Orb", type: "consumable", description: "Grants 50 Study Points.", rarity: "rare", value: 0, stackable: true, icon: "🔮", use_effect: { type: "grant_sp", amount: 50 } },

    // --- WEAPONS ---
    w001: { id: "w001", name: "Rusty Shortsword", type: "weapon", slot: "weapon", description: "A simple, somewhat pitted shortsword.", rarity: "common", value: 10, icon: "🗡️",
            stats: { attack: 5 } },
    w002: { id: "w002", name: "Novice Staff", type: "weapon", slot: "weapon", description: "A basic wooden staff, humming faintly with magic.", rarity: "common", value: 12, icon: "🪄",
            stats: { attack: 3, int: 2, mpRegen: 0.1 } },
    w003: { id: "w003", name: "Hunter's Bow", type: "weapon", slot: "twoHand", description: "A sturdy bow crafted for hunting.", rarity: "uncommon", value: 50, icon: "🏹",
            stats: { attack: 10, dex: 3 } },
    w010_primal_club: { id: "w010_primal_club", name: "Primal Club", type: "weapon", slot: "weapon", description: "A heavy club fashioned from ancient wood and stone, wielded by Sansan.", rarity: "legendary", value: 0, icon: "몽둥이", // Not player obtainable
            stats: { attack: 25, str: 5, con: 3 }, forAllyOnly: "sansan_dino" },

    // --- ARMOR ---
    // Head
    a001: { id: "a001", name: "Leather Cap", type: "armor", slot: "head", description: "A simple cap made of hardened leather.", rarity: "common", value: 8, icon: "🧢",
            stats: { defense: 2 } },
    // Body
    a002: { id: "a002", name: "Padded Tunic", type: "armor", slot: "body", description: "A thick tunic offering basic protection.", rarity: "common", value: 15, icon: "👕",
            stats: { defense: 5, maxHp: 5 } },
    a010_thick_hide_armor: { id: "a010_thick_hide_armor", name: "Thick Hide Armor", type: "armor", slot: "body", description: "Armor made from tough beast hides, worn by Sansan.", rarity: "legendary", value: 0, icon: "🛡️",
            stats: { defense: 20, maxHp: 50, con: 5 }, forAllyOnly: "sansan_dino" },
    // OffHand (Shields)
    a003: { id: "a003", name: "Wooden Buckler", type: "armor", slot: "offHand", description: "A small, round wooden shield.", rarity: "common", value: 10, icon: "🛡️",
            stats: { defense: 3 } },

    // --- ACCESSORIES ---
    r001: { id: "r001", name: "Ring of Minor Vigor", type: "accessory", slot: "accessory", description: "A simple ring that slightly boosts vitality.", rarity: "uncommon", value: 75, icon: "💍",
            stats: { maxHp: 15, con: 1 } },
    r002_engagement_ring_sansan: {
        id: "r002_engagement_ring_sansan", name: "Sansan's Promise Ring", type: "accessory", slot: "accessory",
        description: "A beautiful, ever-glowing ring from Sansan. It feels warm and full of love. It cannot be removed.",
        rarity: "artifact", value: 99999, icon: "💖",
        isUnique: true, isUnremovable: true, forPlayerOnly: "Cutiepatotie", // Specific player
        stats: { str: 5, dex: 5, con: 5, int: 5, wis: 5, cha: 10 }, // Base stats
        scalingStats: { // Stats that increase per player level
            levelFactor: 1, // How many player levels per +1
            statsPerInterval: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }
        },
        onEquipMessage: "A wave of warmth and love washes over you as you wear Sansan's ring.",
        onAttemptRemoveMessage: "The ring is bound by an unbreakable promise... and perhaps a bit of dino magic. It won't come off."
    },
};

export const STARTING_ITEMS = {
    warrior: [{itemId: "w001", quantity: 1}, {itemId: "a001", quantity: 1}, {itemId: "a002", quantity: 1}, {itemId: "c001", quantity: 3}],
    mage: [{itemId: "w002", quantity: 1}, {itemId: "a001", quantity: 1}, {itemId: "c001", quantity: 2}, {itemId: "c002", quantity: 2}],
    rogue: [{itemId: "w001", quantity: 1}, {itemId: "a001", quantity: 1}, {itemId: "c001", quantity: 2}] // Rogue might start with daggers
};

export const EQUIPMENT_SLOTS = {
    player: ["weapon", "offHand", "head", "body", "hands", "feet", "accessory1", "accessory2"],
    sansan_dino: ["weapon", "body", "accessory1"] // Example: Sansan might have fewer slots or different ones
};
