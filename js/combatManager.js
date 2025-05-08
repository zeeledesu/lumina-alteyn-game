// js/combatManager.js
import { eventBus } from './eventManager.js';
import { playerManager } from './playerManager.js';
import { aiManager } from './aiManager.js';
import { SKILLS_DATA, STATUS_EFFECTS_DATA } from './data/skills.js';
import { ITEMS_DATA } from './data/items.js';
import { getRandomInt, delay, CONFIG, rollPercentage } from './utils.js'; // Added rollPercentage
import { encounterManager } from './encounterManager.js';
import { ENEMIES_DATA } from './data/enemies.js'; 
import { ALLY_DATA } from './data/allies.js';


class CombatManager {
    constructor() {
        this.resetCombatState();
        eventBus.subscribe('startCombat', (data) => this.startCombat(data.enemies, data.fixedEncounterId));
        eventBus.subscribe('combatAction', (action) => this.processAction(action));
        eventBus.subscribe('playerSelectedCombatTarget', (targetId) => this.playerSelectsTarget(targetId)); 
    }

    resetCombatState() {
        this.isActive = false;
        this.playerParty = []; // { instanceId, name, stats, skills, statusEffects, isPlayer, isAlly, allyId, isPlayerControlled }
        this.enemyParty = [];  // { instanceId, name, stats, skills, statusEffects }
        this.turnOrder = [];
        this.currentTurnIndex = 0;
        this.currentActor = null;
        this.roundCount = 0;
        this.fixedEncounterId = null; // For marking fixed encounters as cleared
        this.pendingPlayerAction = null; // For multi-stage actions like skill target selection
    }

    startCombat(enemyGroup, fixedEncounterId = null) {
        if (this.isActive) {
            console.warn("CombatManager: Attempted to start combat while already active.");
            return;
        }
        this.resetCombatState();
        this.isActive = true;
        playerManager.gameState.inCombat = true;
        this.fixedEncounterId = fixedEncounterId;

        // Populate player party
        const playerData = playerManager.getPublicData();
        this.playerParty.push({
            instanceId: playerData.instanceId, 
            name: playerData.name,
            stats: { ...playerData.derivedStats }, 
            maxStats: { maxHp: playerData.derivedStats.maxHp, maxMp: playerData.derivedStats.maxMp }, 
            skills: playerData.skills.map(s => s.id),
            statusEffects: [], 
            isPlayer: true,
            classId: playerData.classId
        });

        playerData.allies.forEach(allyData => { // allyData here is from playerManager.getPublicData()
            if (allyData.derivedStats.currentHp > 0) { 
                this.playerParty.push({
                    instanceId: allyData.instanceId,
                    name: allyData.name,
                    allyId: allyData.allyId, 
                    id: allyData.allyId, 
                    stats: { ...allyData.derivedStats },
                    maxStats: { maxHp: allyData.derivedStats.maxHp, maxMp: allyData.derivedStats.maxMp },
                    skills: allyData.skills.map(s => SKILLS_DATA[s]?.id || s), // Map skill objects to IDs if needed, or ensure they are IDs
                    statusEffects: [],
                    isAlly: true,
                    isPlayerControlled: allyData.isPlayerControlled, // Crucial for player control
                    classId: allyData.classId,
                    aiProfile: ALLY_DATA[allyData.allyId]?.aiProfile 
                });
            }
        });

        this.enemyParty = enemyGroup.map(enemy => ({
            ...enemy, 
            maxStats: { maxHp: enemy.stats.maxHp, maxMp: enemy.stats.maxMp || 0 },
            statusEffects: enemy.statusEffects || [], 
        }));


        this.determineTurnOrder();
        this.roundCount = 1;
        eventBus.publish('combatStarted', this.getCombatState());
        this.nextTurn();
    }

    determineTurnOrder() {
        this.turnOrder = [...this.playerParty, ...this.enemyParty]
            .filter(c => c.stats.currentHp > 0)
            .sort((a, b) => (b.stats.speed || 0) - (a.stats.speed || 0)); 
        this.currentTurnIndex = 0;
    }

    async nextTurn() {
        if (!this.isActive) return;

        for (const combatant of [...this.playerParty, ...this.enemyParty]) {
            if (combatant.stats.currentHp > 0) {
                await this.tickStatusEffects(combatant);
            }
        }
        this.cleanupDeadCombatants();


        if (this.checkCombatEnd()) return;

        if (this.currentTurnIndex >= this.turnOrder.length) {
            this.currentTurnIndex = 0;
            this.roundCount++;
            this.determineTurnOrder(); 
            eventBus.publish('combatLog', {text: `--- Round ${this.roundCount} ---`, type: "system-message highlight-color"});
            eventBus.publish('combatRoundAdvanced', { round: this.roundCount, combatState: this.getCombatState() });
        }
        
        if (this.turnOrder.length === 0) { 
            this.endCombat(this.playerParty.length > 0 && this.enemyParty.length === 0); 
            return;
        }

        this.currentActor = this.turnOrder[this.currentTurnIndex];

        if (this.currentActor.statusEffects.some(se => STATUS_EFFECTS_DATA[se.statusId]?.blocksTurn)) {
            eventBus.publish('combatLog', { text: `${this.currentActor.name} is stunned and cannot act!`, type: 'system' });
            await delay(CONFIG.DEFAULT_TEXT_SPEED * 10);
            this.currentTurnIndex++;
            this.nextTurn();
            return;
        }
        
        eventBus.publish('combatTurnAdvanced', { currentTurnActor: this.currentActor, combatState: this.getCombatState() });

        if (this.currentActor.isPlayer) {
            eventBus.publish('playerTurnStarted', { combatState: this.getCombatState() });
        } else if (this.currentActor.isAlly) {
            if (this.currentActor.isPlayerControlled) {
                eventBus.publish('playerTurnStarted', { 
                    combatState: this.getCombatState(), 
                    isAllyTurn: true, 
                    allyActor: this.currentActor 
                });
            } else { // AI Controlled Ally
                const action = aiManager.getCombatAction(this.currentActor, this.playerParty, this.enemyParty);
                await delay(CONFIG.AI_THINK_DELAY); 
                this.processAction(action);
            }
        } else { // Enemy turn
            const action = aiManager.getCombatAction(this.currentActor, this.playerParty, this.enemyParty);
            await delay(CONFIG.AI_THINK_DELAY); 
            this.processAction(action);
        }
    }

    async processAction(action) {
        if (!this.isActive || !this.currentActor ) {
            console.warn("CombatManager: processAction called while inactive or no current actor.");
             return;
        }
        
        if (action.casterId !== this.currentActor.instanceId) {
            console.warn("Action caster mismatch:", action, this.currentActor);
            // If it's player's turn (or player-controlled ally) and the action is not for them, let UI handle retry.
            if (this.currentActor.isPlayer || this.currentActor.isPlayerControlled) {
                eventBus.publish('playerTurnStarted', { 
                    combatState: this.getCombatState(), 
                    retry: true,
                    isAllyTurn: this.currentActor.isAlly,
                    allyActor: this.currentActor.isAlly ? this.currentActor : null
                });
                return;
            }
            // If AI turn, this is an AI logic error, advance turn to prevent freeze.
            this.currentTurnIndex++;
            this.nextTurn();
            return;
        }
        
        const caster = this.findCombatant(action.casterId);
        if (!caster || caster.stats.currentHp <= 0) {
             this.currentTurnIndex++; this.nextTurn(); return; 
        }

        let success = false;
        switch (action.type) {
            case 'attack':
                success = await this.executeAttack(caster, this.findCombatant(action.targetId));
                break;
            case 'skill':
                success = await this.executeSkill(caster, action.skillId, action.targetId);
                break;
            case 'item':
                success = await this.executeItem(caster, action.itemInstanceId, action.targetId);
                break;
            case 'flee':
                success = await this.executeFlee(caster);
                break;
            case 'pass': 
                eventBus.publish('combatLog', { text: `${caster.name} takes a moment to observe.`, type: 'system' });
                success = true;
                break;
            default:
                eventBus.publish('combatLog', { text: `Unknown action type: ${action.type}`, type: 'error' });
        }
        
        if (success || action.type === 'pass' || (action.type === 'flee' && this.isActive) ) { 
            if (action.type === 'attack' || (action.type === 'skill' && SKILLS_DATA[action.skillId]?.type.includes('attack'))) {
                this.decrementSingleActionBuffs(caster);
            }

            this.currentTurnIndex++;
            if (!this.checkCombatEnd()) { 
                 await delay(CONFIG.POST_ACTION_DELAY); 
                 this.nextTurn();
            }
        } else {
             if ((caster.isPlayer || caster.isPlayerControlled) && !this.pendingPlayerAction) {
                eventBus.publish('playerTurnStarted', { 
                    combatState: this.getCombatState(), 
                    retry: true,
                    isAllyTurn: caster.isAlly,
                    allyActor: caster.isAlly ? caster : null
                }); 
            } else {
                this.currentTurnIndex++; 
                if (!this.checkCombatEnd()) this.nextTurn();
            }
        }
    }

    async executeAttack(caster, target) {
        if (!target || target.stats.currentHp <= 0) {
            eventBus.publish('combatLog', { text: `${caster.name} attacks, but ${target ? target.name : 'the target'} is already defeated!`, type: 'system' });
            return true; 
        }
        
        let actualTarget = target;
        // Sansan's protection logic
        const playerChar = this.playerParty.find(p => p.isPlayer);
        const sansanAlly = this.playerParty.find(p => p.allyId === ALLY_DATA.sansan_dino.id && p.stats.currentHp > 0);

        if (playerChar && target.instanceId === playerChar.instanceId && 
            caster.instanceId !== sansanAlly?.instanceId && // Sansan doesn't redirect his own beneficial actions to himself
            sansanAlly &&
            playerManager.isPlayerCharacter("Cutiepatotie") && // Sansan only protects Cutiepatotie this way
            !caster.isAlly // Don't redirect friendly fire from other allies (if such skills exist)
            ) { 
            eventBus.publish('combatLog', { text: `Sansan intercepts the attack meant for ${playerChar.name}!`, type: 'ally-special combat-ally' });
            actualTarget = sansanAlly;
        }


        eventBus.publish('combatLog', { text: `${caster.name} attacks ${actualTarget.name}!`, type: caster.isPlayer || caster.isAlly ? 'combat-player' : 'combat-enemy' });
        await delay(CONFIG.ACTION_ANIMATION_DELAY);

        const hitChance = (caster.stats.accuracy || 75) - (actualTarget.stats.evasion || 5);
        if (!rollPercentage(Math.max(5, Math.min(95, hitChance)))) { 
            eventBus.publish('combatLog', { text: `...but misses!`, type: 'combat-miss' });
            return true;
        }

        let damage = Math.max(1, Math.floor(
            (caster.stats.attack || 5) * (1 + getRandomInt(-10, 10)/100) - 
            (actualTarget.stats.defense || 0) / 2 
        ));

        let isCrit = false;
        if (caster.statusEffects.some(se => STATUS_EFFECTS_DATA[se.statusId]?.specialFlags?.includes('guaranteed_crit_next_attack'))) {
            isCrit = true;
        } else {
            isCrit = rollPercentage(caster.stats.critChance || 5);
        }

        if (isCrit) {
            damage = Math.floor(damage * 1.75); 
            eventBus.publish('combatLog', { text: `CRITICAL HIT!`, type: 'combat-crit' });
        }

        this.applyDamage(actualTarget, damage, caster);
        return true;
    }

    async executeSkill(caster, skillId, targetId) {
        const skillData = SKILLS_DATA[skillId];
        if (!skillData) {
            eventBus.publish('combatLog', { text: `${caster.name} tries to use an unknown skill!`, type: 'error' });
            return false; 
        }

        if (caster.stats.currentMp < skillData.mpCost) {
            eventBus.publish('combatLog', { text: `${caster.name} doesn't have enough MP for ${skillData.name}!`, type: 'warning-message' });
            if (caster.isPlayer || caster.isPlayerControlled) return false; // Player/controlled ally action fails
            return true; // AI action "succeeds" as turn used, but skill doesn't fire (AI should check MP first)
        }
        
        // Determine equipment based on caster type (player or ally)
        let casterEquipment = null;
        if (caster.isPlayer) {
            casterEquipment = playerManager.getEquippedItemsData();
        } else if (caster.isAlly) {
            const fullAllyDataFromPlayerManager = playerManager.getPublicData().allies.find(a => a.instanceId === caster.instanceId);
            if (fullAllyDataFromPlayerManager) {
                casterEquipment = fullAllyDataFromPlayerManager.equipment;
            }
        }


        if (skillData.requiresShield && !(casterEquipment?.offHand && ITEMS_DATA[casterEquipment.offHand.itemId]?.slot === "offHand")) { 
             eventBus.publish('combatLog', { text: `${caster.name} needs a shield to use ${skillData.name}!`, type: 'warning-message' });
             if (caster.isPlayer || caster.isPlayerControlled) return false; return true;
        }
        if (skillData.requiresStatus && !this.targetHasStatusEffect(caster.instanceId, skillData.requiresStatus) ){
             eventBus.publish('combatLog', { text: `${caster.name} is not in the right state to use ${skillData.name}!`, type: 'warning-message' });
             if (caster.isPlayer || caster.isPlayerControlled) return false; return true;
        }


        if (caster.isPlayer) playerManager.spendMp(skillData.mpCost); // Player's MP from playerManager
        else if (caster.isAlly) playerManager.spendMp(skillData.mpCost, caster.instanceId); // Ally's MP from playerManager
        else caster.stats.currentMp -= skillData.mpCost; // Enemy MP directly modified

        eventBus.publish('combatLog', { text: `${caster.name} uses ${skillData.name}!`, type: caster.isPlayer || caster.isAlly ? 'combat-player' : 'combat-enemy' });
        await delay(CONFIG.ACTION_ANIMATION_DELAY);

        const targets = this.determineSkillTargets(caster, skillData, targetId);
        if ((!targets || targets.length === 0) && !(skillData.target === "self" || skillData.target === "party" || skillData.target.includes("_all") || skillData.target.includes("_aoe"))) {
             eventBus.publish('combatLog', { text: `...but there's no valid target!`, type: 'system' });
             return true; 
        }


        const effects = Array.isArray(skillData.effect) ? skillData.effect : [skillData.effect];
        for (const effect of effects) {
            let currentTargets = targets; 
            if (effect.targetType) { 
                currentTargets = this.determineSkillTargets(caster, { ...skillData, target: effect.targetType }, targetId);
            }

            for (const target of currentTargets) {
                 if (!target || (target.stats.currentHp <= 0 && effect.type !== "revive")) continue; 

                let actualTarget = target;
                const playerChar = this.playerParty.find(p => p.isPlayer);
                const sansanAlly = this.playerParty.find(p => p.allyId === ALLY_DATA.sansan_dino.id && p.stats.currentHp > 0);

                if (playerChar && (effect.type === "damage" || (effect.type === "status_effect" && STATUS_EFFECTS_DATA[effect.statusId]?.type === "debuff")) && 
                    target.instanceId === playerChar.instanceId && 
                    caster.instanceId !== sansanAlly?.instanceId && // Sansan doesn't redirect his own skills
                    sansanAlly && 
                    playerManager.isPlayerCharacter("Cutiepatotie") &&
                    !caster.isAlly // Don't redirect friendly fire from other allies
                    ) {
                    eventBus.publish('combatLog', { text: `Sansan intercepts the effect of ${skillData.name} meant for ${playerChar.name}!`, type: 'ally-special combat-ally' });
                    actualTarget = sansanAlly;
                }
                
                switch (effect.type) {
                    case 'damage':
                        let damage = 0;
                        // Ensure attributes are present, especially for non-player/non-ally casters (enemies)
                        const attributesSource = caster.attributes || caster.stats; // Fallback to stats if attributes sub-object isn't there for enemies
                        const scaleStatValue = attributesSource[effect.scaleStat] !== undefined ? 
                                               (typeof attributesSource[effect.scaleStat] === 'object' ? attributesSource[effect.scaleStat].current : attributesSource[effect.scaleStat]) : 0;


                        if (effect.basePower) { 
                            damage = effect.basePower + Math.floor(scaleStatValue * effect.scaleFactor);
                        } else if (effect.baseMultiplier) { 
                            damage = Math.floor((caster.stats.attack || 5) * effect.baseMultiplier);
                             if (effect.scaleStat) damage += Math.floor(scaleStatValue * effect.scaleFactor);
                        }
                        damage = Math.max(1, damage - Math.floor((actualTarget.stats.defense || 0) / 2)); 
                        
                        let isCritSkill = false;
                        if (caster.statusEffects.some(se => STATUS_EFFECTS_DATA[se.statusId]?.specialFlags?.includes('guaranteed_crit_next_attack'))) {
                            isCritSkill = true;
                        } else {
                            isCritSkill = rollPercentage(caster.stats.critChance || 5);
                        }
                        if (isCritSkill) {
                            damage = Math.floor(damage * 1.75);
                            eventBus.publish('combatLog', { text: `CRITICAL HIT on ${actualTarget.name}!`, type: 'combat-crit' });
                        }
                        this.applyDamage(actualTarget, damage, caster, skillData.name);
                        if (effect.splashMultiplier && targetId === actualTarget.instanceId) { 
                           this.applySplashDamage(caster, actualTarget, damage * effect.splashMultiplier, skillData.name);
                        }
                        break;
                    case 'heal':
                        const healAttributesSource = caster.attributes || caster.stats;
                        const healScaleStatValue = healAttributesSource[effect.scaleStat] !== undefined ? 
                                                (typeof healAttributesSource[effect.scaleStat] === 'object' ? healAttributesSource[effect.scaleStat].current : healAttributesSource[effect.scaleStat]) : 0;
                        const healAmount = effect.basePower + Math.floor(healScaleStatValue * (effect.scaleFactor || 1));
                        this.applyHeal(actualTarget, healAmount, caster, skillData.name);
                        break;
                    case 'status_effect':
                         if (effect.chance === undefined || rollPercentage(effect.chance)) {
                            this.applyStatusEffect(actualTarget, effect.statusId, effect.duration, caster);
                        } else {
                             eventBus.publish('combatLog', { text: `${skillData.name} failed to apply ${STATUS_EFFECTS_DATA[effect.statusId]?.name} to ${actualTarget.name}.`, type: 'system' });
                        }
                        break;
                }
                await delay(CONFIG.MULTI_TARGET_EFFECT_DELAY); 
            }
        }
        return true;
    }
    
    determineSkillTargets(caster, skillData, primaryTargetId) {
        const primaryTarget = this.findCombatant(primaryTargetId);
        let potentialTargets;
        switch (skillData.target) {
            case 'self': return [caster];
            case 'enemy_single': 
                potentialTargets = this.enemyParty.filter(e => e.stats.currentHp > 0);
                return primaryTarget && !primaryTarget.isPlayer && !primaryTarget.isAlly ? [primaryTarget] : (potentialTargets.length > 0 ? [potentialTargets[0]] : []); 
            case 'ally_single': 
                potentialTargets = this.playerParty.filter(p => p.stats.currentHp > 0);
                return primaryTarget && (primaryTarget.isPlayer || primaryTarget.isAlly) ? [primaryTarget] : (caster.isPlayer || caster.isAlly ? [caster] : (potentialTargets.length > 0 ? [potentialTargets[0]] : [])); 
            case 'ally_leader': 
                const leader = this.playerParty.find(p => p.isPlayer && p.stats.currentHp > 0);
                return leader ? [leader] : [];
            case 'enemy_all': return this.enemyParty.filter(e => e.stats.currentHp > 0);
            case 'ally_all': return this.playerParty.filter(p => p.stats.currentHp > 0);
            case 'party': return this.playerParty.filter(p => p.stats.currentHp > 0); // Player + all allies
            case 'enemy_aoe_2': 
                 const targets = [];
                 const livingEnemies = this.enemyParty.filter(e => e.stats.currentHp > 0);
                 if (primaryTarget && !primaryTarget.isPlayer && !primaryTarget.isAlly && primaryTarget.stats.currentHp > 0) {
                     targets.push(primaryTarget);
                 } else if (livingEnemies.length > 0) {
                     targets.push(livingEnemies[0]); // Default to first living enemy if primary is invalid
                 }
                 // Add one more distinct living enemy if possible
                 const otherEnemies = livingEnemies.filter(e => e.instanceId !== (targets[0]?.instanceId));
                 if (otherEnemies.length > 0 && targets.length < 2) {
                     targets.push(otherEnemies[getRandomInt(0, otherEnemies.length -1)]);
                 }
                 return targets;
            case 'enemy_single_splash': 
                 potentialTargets = this.enemyParty.filter(e => e.stats.currentHp > 0);
                 return primaryTarget && !primaryTarget.isPlayer && !primaryTarget.isAlly ? [primaryTarget] : (potentialTargets.length > 0 ? [potentialTargets[0]] : []);
            case 'enemy_all_self': 
                 return [caster, ...this.enemyParty.filter(e => e.stats.currentHp > 0)];

            default: return primaryTarget && primaryTarget.stats.currentHp > 0 ? [primaryTarget] : [];
        }
    }

    applySplashDamage(caster, primaryTarget, splashDamage, skillName) {
        const targetParty = primaryTarget.isPlayer || primaryTarget.isAlly ? this.playerParty : this.enemyParty;
        const livingTargetParty = targetParty.filter(t => t.stats.currentHp > 0);
        const primaryIndexInLiving = livingTargetParty.findIndex(t => t.instanceId === primaryTarget.instanceId);
    
        if (primaryIndexInLiving === -1) return; // Primary target not found in living party (should not happen if splash is triggered)
    
        const adjacentTargets = [];
        // Check member before primary in the living party array
        if (primaryIndexInLiving > 0) {
            adjacentTargets.push(livingTargetParty[primaryIndexInLiving - 1]);
        }
        // Check member after primary in the living party array
        if (primaryIndexInLiving < livingTargetParty.length - 1) {
            adjacentTargets.push(livingTargetParty[primaryIndexInLiving + 1]);
        }
    
        adjacentTargets.forEach(adjTarget => {
            // Ensure adjTarget is valid and alive (though filter should ensure alive)
            if (adjTarget && adjTarget.stats.currentHp > 0) { 
                eventBus.publish('combatLog', { text: `${skillName} splashes onto ${adjTarget.name}!`, type: 'system' });
                this.applyDamage(adjTarget, Math.floor(splashDamage), caster, skillName, true);
            }
        });
    }


    async executeItem(caster, itemInstanceId, targetId) {
        // For V0.5, only player can use items. Controlled allies cannot.
        if (!caster.isPlayer) { 
            eventBus.publish('combatLog', { text: "Only the main player can use items in combat currently.", type: 'error' });
            return false; // Action fails for non-player if they somehow try
        }
        const itemRef = playerManager.gameState.inventory.find(i => i.instanceId === itemInstanceId);
        if (!itemRef) {
            eventBus.publish('combatLog', { text: "Item not found!", type: 'error' }); return false;
        }
        const itemData = ITEMS_DATA[itemRef.itemId];
        if (!itemData.use_effect) {
            eventBus.publish('combatLog', { text: `${itemData.name} cannot be used.`, type: 'error' }); return false;
        }
        if (itemData.use_effect.target === 'non_combat' || itemData.use_effect.type === 'grant_sp') {
            eventBus.publish('combatLog', { text: `${itemData.name} cannot be used in combat.`, type: 'error' }); return false;
        }


        const target = this.findCombatant(targetId);
        let actualTarget = target || caster; 
        
        const itemTargetType = itemData.use_effect.target;
        if (itemTargetType === 'enemy_single' && (!actualTarget || actualTarget.isPlayer || actualTarget.isAlly)) {
             eventBus.publish('combatLog', { text: `Invalid target for ${itemData.name}. Must be an enemy.`, type: 'error' }); return false;
        }
        if ((itemTargetType === 'ally_single' || itemTargetType === 'self_or_ally') && (actualTarget && !actualTarget.isPlayer && !actualTarget.isAlly)) {
             eventBus.publish('combatLog', { text: `Invalid target for ${itemData.name}. Must be an ally or self.`, type: 'error' }); return false;
        }
         if (!actualTarget && (itemTargetType === 'ally_single' || itemTargetType === 'enemy_single')) {
            eventBus.publish('combatLog', { text: `No valid target for ${itemData.name}.`, type: 'error' }); return false;
        }

        
        eventBus.publish('combatLog', { text: `${caster.name} uses ${itemData.name}${actualTarget && actualTarget.instanceId !== caster.instanceId ? ` on ${actualTarget.name}` : ''}!`, type: 'combat-player' });
        await delay(CONFIG.ACTION_ANIMATION_DELAY);

        const effect = itemData.use_effect;

        switch (effect.type) {
            case 'heal':
                this.applyHeal(actualTarget, effect.amount, caster, itemData.name);
                break;
            case 'restore_mp':
                this.applyMpRestore(actualTarget, effect.amount, caster, itemData.name);
                break;
            case 'cure_status':
                this.removeStatusEffect(actualTarget, effect.statusId, itemData.name);
                break;
            default:
                 eventBus.publish('combatLog', { text: `Effect of ${itemData.name} not implemented.`, type: 'error' });
                 return true; // Turn still used, effect just not there
        }

        if (itemData.stackable) playerManager.removeItem(itemRef.instanceId, 1); 
        else playerManager.removeItem(itemRef.instanceId);

        return true;
    }

    async executeFlee(caster) {
        // Flee is only for the main player character or the entire party acting as one.
        // Controlled allies currently cannot initiate flee.
        if (!caster.isPlayer) return true; // Turn used if non-player tried

        eventBus.publish('combatLog', { text: `${caster.name} attempts to flee...`, type: 'system' });
        await delay(CONFIG.ACTION_ANIMATION_DELAY);
        
        const enemyAvgSpeed = this.enemyParty.reduce((avg, e) => avg + (e.stats.speed || 0), 0) / (this.enemyParty.length || 1);
        const playerEffectiveSpeed = this.playerParty.find(p => p.isPlayer)?.stats.speed || caster.stats.speed || 0; // Use player's speed for flee chance
        const fleeChance = 60 + playerEffectiveSpeed - enemyAvgSpeed;

        if (rollPercentage(Math.max(10, Math.min(90, fleeChance)))) {
            eventBus.publish('combatLog', { text: `Successfully fled!`, type: 'success-message' });
            this.endCombat(false, true); 
            return true; 
        } else {
            eventBus.publish('combatLog', { text: `Could not escape!`, type: 'error-message' });
            return true; 
        }
    }


    applyDamage(target, amount, attacker, sourceName = "Attack", isSplash = false) {
        target.stats.currentHp -= amount;
        let damageType = isSplash ? "splash damage" : "damage";
        eventBus.publish('combatLog', { text: `${target.name} takes ${amount} ${damageType}! (${sourceName})`, type: target.isPlayer || target.isAlly ? 'combat-enemy' : 'combat-player', value: -amount, targetId: target.instanceId });

        if (target.stats.currentHp <= 0) {
            target.stats.currentHp = 0;
            eventBus.publish('combatLog', { text: `${target.name} has been defeated!`, type: 'system highlight-color' });
        }
        eventBus.publish('combatUiUpdate', this.getCombatState());
    }

    applyHeal(target, amount, healer, sourceName = "Heal") {
        const oldHp = target.stats.currentHp;
        target.stats.currentHp = Math.min(target.stats.currentHp + amount, target.maxStats.maxHp);
        const healedAmount = target.stats.currentHp - oldHp;
        eventBus.publish('combatLog', { text: `${target.name} recovers ${healedAmount} HP! (${sourceName})`, type: 'combat-ally', value: healedAmount, targetId: target.instanceId });
        eventBus.publish('combatUiUpdate', this.getCombatState());
    }
    
    applyMpRestore(target, amount, source, sourceName = "MP Restore") {
        const oldMp = target.stats.currentMp;
        target.stats.currentMp = Math.min(target.stats.currentMp + amount, target.maxStats.maxMp);
        const restoredAmount = target.stats.currentMp - oldMp;
        eventBus.publish('combatLog', { text: `${target.name} recovers ${restoredAmount} MP! (${sourceName})`, type: 'combat-ally', valueMp: restoredAmount, targetId: target.instanceId });
        eventBus.publish('combatUiUpdate', this.getCombatState());
    }


    applyStatusEffect(target, statusId, duration, applier) {
        const statusData = STATUS_EFFECTS_DATA[statusId];
        if (!statusData) return;

        const existingEffectIndex = target.statusEffects.findIndex(se => se.statusId === statusId);
        if (existingEffectIndex !== -1) {
            target.statusEffects[existingEffectIndex].duration = Math.max(target.statusEffects[existingEffectIndex].duration, duration); 
        } else {
            target.statusEffects.push({ statusId, duration, appliedBy: applier?.instanceId });
        }
        
        const message = statusData.onApplyMsg ? statusData.onApplyMsg.replace("{targetName}", target.name).replace("{casterName}", applier?.name || "Someone") : `${target.name} is affected by ${statusData.name}!`;
        eventBus.publish('combatLog', { text: message, type: 'combat-status', statusName: statusData.name, targetId: target.instanceId });
        eventBus.publish('combatUiUpdate', this.getCombatState());
    }
    
    removeStatusEffect(target, statusIdToRemove, sourceName="Cure") {
        const effectIndex = target.statusEffects.findIndex(se => se.statusId === statusIdToRemove);
        if (effectIndex !== -1) {
            const statusData = STATUS_EFFECTS_DATA[statusIdToRemove];
            const message = statusData.onRemoveMsg ? statusData.onRemoveMsg.replace("{targetName}", target.name) : `${target.name} is no longer affected by ${statusData.name}. (${sourceName})`;
            eventBus.publish('combatLog', { text: message, type: 'system' });
            target.statusEffects.splice(effectIndex, 1);
            eventBus.publish('combatUiUpdate', this.getCombatState());
        }
    }

    async tickStatusEffects(combatant) {
        const effectsToRemove = [];
        for (let i = combatant.statusEffects.length - 1; i >= 0; i--) {
            const effectInstance = combatant.statusEffects[i];
            const effectData = STATUS_EFFECTS_DATA[effectInstance.statusId];
            if (!effectData) continue;

            if (effectData.dot && combatant.stats.currentHp > 0) {
                let dotAmount = effectData.dot.basePower;
                // Consider scaleStat for DoT/HoT in future
                if (effectData.dot.damageType === "heal") { 
                    this.applyHeal(combatant, dotAmount, null, effectData.name);
                } else { 
                    this.applyDamage(combatant, dotAmount, null, effectData.name);
                }
                 if (effectData.onTickMsg) {
                     eventBus.publish('combatLog', { text: effectData.onTickMsg.replace("{targetName}", combatant.name).replace("{damage}", dotAmount), type: 'combat-status' });
                 }
                 await delay(CONFIG.MULTI_TARGET_EFFECT_DELAY);
            }

            effectInstance.duration--;
            if (effectInstance.duration <= 0) {
                effectsToRemove.push(effectInstance.statusId);
                 const message = effectData.onRemoveMsg ? effectData.onRemoveMsg.replace("{targetName}", combatant.name) : `${effectData.name} wears off from ${combatant.name}.`;
                eventBus.publish('combatLog', { text: message, type: 'system' });
            }
        }
        combatant.statusEffects = combatant.statusEffects.filter(se => !effectsToRemove.includes(se.statusId));
        if (effectsToRemove.length > 0) eventBus.publish('combatUiUpdate', this.getCombatState());
    }
    
    decrementSingleActionBuffs(caster) { 
        caster.statusEffects = caster.statusEffects.filter(effectInstance => {
            const effectData = STATUS_EFFECTS_DATA[effectInstance.statusId];
            if (effectData && effectData.specialFlags?.includes('guaranteed_crit_next_attack')) {
                eventBus.publish('combatLog', { text: `${effectData.name} effect used up by ${caster.name}.`, type: 'system' });
                return false; 
            }
            return true;
        });
    }

    targetHasStatusEffect(targetInstanceId, statusId) {
        const target = this.findCombatant(targetInstanceId);
        return target && target.statusEffects.some(se => se.statusId === statusId);
    }


    cleanupDeadCombatants() {
        this.playerParty = this.playerParty.filter(p => p.stats.currentHp > 0);
        this.enemyParty = this.enemyParty.filter(e => e.stats.currentHp > 0);
        // Adjust currentTurnIndex if current actor died or actors before it in turn order died
        const oldCurrentActorId = this.currentActor?.instanceId;
        this.turnOrder = this.turnOrder.filter(c => c.stats.currentHp > 0);
        
        // Try to find the same actor or the one that would now be at the current index
        const newCurrentActorIndex = this.turnOrder.findIndex(c => c.instanceId === oldCurrentActorId);
        if (newCurrentActorIndex !== -1) {
            this.currentTurnIndex = newCurrentActorIndex;
        } else {
             // If the current actor died, the index might implicitly be correct due to removal,
             // or it might need to be decremented if actors before it were removed.
             // For simplicity, if current actor is not found, determineTurnOrder at round end will fix it.
             // If it's mid-round, and current actor died, currentTurnIndex points to the *next* actor.
        }
    }

    checkCombatEnd() {
        const playerTeamAlive = this.playerParty.some(p => p.stats.currentHp > 0);
        const enemyTeamAlive = this.enemyParty.some(e => e.stats.currentHp > 0);

        if (!playerTeamAlive) {
            this.endCombat(false); 
            return true;
        }
        if (!enemyTeamAlive) {
            this.endCombat(true); 
            return true;
        }
        return false;
    }

    endCombat(playerWon, playerFled = false) {
        if (!this.isActive) return;
        this.isActive = false;
        playerManager.gameState.inCombat = false;

        // Restore player and ally HP/MP from combat instances to main gameState
        this.playerParty.forEach(combatMember => {
            if (combatMember.isPlayer) {
                playerManager.syncCharacterCombatStatsToGameState(combatMember.instanceId, combatMember.stats.currentHp, combatMember.stats.currentMp);
            } else if (combatMember.isAlly) {
                playerManager.syncCharacterCombatStatsToGameState(combatMember.instanceId, combatMember.stats.currentHp, combatMember.stats.currentMp);
            }
        });
        // For any player party members not in the final playerParty list (i.e., they died)
        // their HP/MP in playerManager.gameState should reflect 0 or their state before combat end sync.
        // playerManager.updateAllStats(); // Recalculate derived stats based on new HP/MP for UI
        eventBus.publish('playerDataUpdated', playerManager.getPublicData());


        if (playerWon) {
            let totalXp = 0;
            let totalGoldMin = 0;
            let totalGoldMax = 0;
            const lootDrops = [];

            // Get original enemy data for rewards
            const defeatedEnemyCombatants = this.turnOrder.filter(c => (!c.isPlayer && !c.isAlly) && c.stats.currentHp <= 0);
            // If turnOrder was already cleaned, we might need initial enemy list. For simplicity, assume turnOrder had them.
            // A better way is to store the initial enemy party separately.
            // For now, this should work if endCombat is called before turnOrder is too heavily modified post-defeat.

            // Use this.enemyParty from startCombat for original data:
            // We need a way to map defeated instances back to their original definition if turnOrder doesn't hold full original data.
            // For now, assume this.enemyParty initially populated in startCombat holds necessary base IDs.
            // The initial enemyGroup passed to startCombat is best. Let's store it.
            // This requires change in startCombat to store originalEnemyGroup.
            // Quick fix: this.turnOrder filtering should be okay for now.

            const originalEnemiesInCombat = this.turnOrder
                                          .filter(c => !c.isPlayer && !c.isAlly && c.stats.currentHp <= 0) // Get defeated non-player combatants
                                          .map(defeatedCombatant => ENEMIES_DATA[defeatedCombatant.id]); // Map to original ENEMIES_DATA using base ID

            originalEnemiesInCombat.forEach(originalEnemyData => {
                 if(originalEnemyData) {
                    totalXp += originalEnemyData.xp_reward || 0;
                    totalGoldMin += originalEnemyData.gold_reward?.min || 0;
                    totalGoldMax += originalEnemyData.gold_reward?.max || 0;
                    originalEnemyData.loot_table?.forEach(lootEntry => {
                        if (rollPercentage(lootEntry.chance)) {
                            const quantity = lootEntry.quantity ? (typeof lootEntry.quantity === 'object' ? getRandomInt(lootEntry.quantity.min, lootEntry.quantity.max) : lootEntry.quantity) : 1;
                            if (lootEntry.questIdLink) { // Quest-related drops
                                const quest = playerManager.gameState.quests[lootEntry.questIdLink];
                                if (quest && !quest.completed && (quest.stage === lootEntry.questStageLink || lootEntry.questStageLink === undefined)) {
                                    lootDrops.push({ itemId: lootEntry.itemId, quantity });
                                }
                            } else {
                                lootDrops.push({ itemId: lootEntry.itemId, quantity });
                            }
                        }
                    });
                }
            });

            const finalGold = getRandomInt(totalGoldMin, Math.max(totalGoldMin, totalGoldMax));
            playerManager.addXp(totalXp); 
            playerManager.addGold(finalGold);

            lootDrops.forEach(drop => playerManager.addItem(drop.itemId, drop.quantity));
            
            eventBus.publish('combatEnded', {
                won: true,
                xpGained: totalXp,
                goldGained: finalGold,
                itemsDropped: lootDrops.map(d => ({...ITEMS_DATA[d.itemId], quantityObtained: d.quantity}))
            });

            if (this.fixedEncounterId) {
                encounterManager.markFixedEncounterAsCleared(this.fixedEncounterId);
            }

        } else { 
            eventBus.publish('combatEnded', { won: false, fled: playerFled });
            if (!playerFled) { 
                eventBus.publish('gameOver', { reason: "Your party was defeated in combat." });
            }
        }
        this.resetCombatState();
    }


    findCombatant(instanceId) {
        return this.playerParty.find(p => p.instanceId === instanceId) || this.enemyParty.find(e => e.instanceId === instanceId);
    }

    getCombatState() {
        return {
            isActive: this.isActive,
            playerParty: JSON.parse(JSON.stringify(this.playerParty)), 
            enemyParty: JSON.parse(JSON.stringify(this.enemyParty)),
            turnOrderInstanceIds: this.turnOrder.map(c => c.instanceId),
            currentActorInstanceId: this.currentActor ? this.currentActor.instanceId : null,
            roundCount: this.roundCount
        };
    }

    playerInitiatesTargetedAction(actionType, detailId ) {
        // currentActor can be player or player-controlled ally
        if (!this.currentActor || !(this.currentActor.isPlayer || this.currentActor.isPlayerControlled)) return;

        this.pendingPlayerAction = { type: actionType, detailId: detailId, casterId: this.currentActor.instanceId };
        let targetableEntities = [];
        const activeActor = this.currentActor; 

        let skillOrItemData = null;
        let targetDefinition = null;

        if (actionType === 'skill') {
            skillOrItemData = SKILLS_DATA[detailId];
            if (!skillOrItemData) { this.cancelPlayerTargetSelectionWithMessage("Skill not found."); return; }
            targetDefinition = skillOrItemData.target;
        } else if (actionType === 'item') {
            // Only player can use items. If a controlled ally tries, this path shouldn't be hit.
            // UI should prevent controlled allies from selecting "item" action.
            if (!activeActor.isPlayer) { this.cancelPlayerTargetSelectionWithMessage("Allies cannot use items this way."); return; }
            const itemRef = playerManager.gameState.inventory.find(i => i.instanceId === detailId);
            skillOrItemData = itemRef ? ITEMS_DATA[itemRef.itemId] : null;
            if (!skillOrItemData || !skillOrItemData.use_effect || skillOrItemData.use_effect.target === 'non_combat') { 
                this.cancelPlayerTargetSelectionWithMessage("Item not found or not usable in combat."); return; 
            }
            targetDefinition = skillOrItemData.use_effect.target;
        } else if (actionType === 'attack') {
            targetDefinition = 'enemy_single'; 
        } else {
            this.cancelPlayerTargetSelectionWithMessage("Unknown action type for targeting.");
            return;
        }
        
        // Determine targetable entities based on definition
        if (targetDefinition.includes('enemy')) targetableEntities = this.enemyParty.filter(e => e.stats.currentHp > 0);
        else if (targetDefinition.includes('ally') || targetDefinition.includes('party') || targetDefinition === 'ally_leader' || targetDefinition === 'self_or_ally') {
            targetableEntities = this.playerParty.filter(p => p.stats.currentHp > 0);
        }
        else if (targetDefinition === 'self') {
            this.processAction({ ...this.pendingPlayerAction, targetId: activeActor.instanceId });
            this.pendingPlayerAction = null;
            return;
        }
        
        if (targetDefinition.includes("_all") || targetDefinition === "party" || targetDefinition === "enemy_all_self") {
             this.processAction({ ...this.pendingPlayerAction, targetId: null }); 
             this.pendingPlayerAction = null;
             return;
        }

        if (targetableEntities.length === 1 && (targetDefinition.includes('single') || targetDefinition.includes('leader'))) { 
             this.processAction({ ...this.pendingPlayerAction, targetId: targetableEntities[0].instanceId });
             this.pendingPlayerAction = null;
        } else if (targetableEntities.length > 0) {
            eventBus.publish('combatRequestTarget', {
                targetableEntities: targetableEntities.map(t => ({ instanceId: t.instanceId, name: t.name })),
                actionMessage: `Select target for ${actionType === 'skill' ? skillOrItemData.name : (skillOrItemData?.name || 'Attack')}`
            });
        } else {
            this.cancelPlayerTargetSelectionWithMessage("No valid targets available for that action.");
        }
    }
    
    cancelPlayerTargetSelectionWithMessage(message) {
        eventBus.publish('combatLog', {text: message, type: 'warning-message'});
        this.pendingPlayerAction = null; 
        eventBus.publish('playerTurnStarted', { 
            combatState: this.getCombatState(), 
            retry: true,
            isAllyTurn: this.currentActor?.isAlly && this.currentActor?.isPlayerControlled,
            allyActor: (this.currentActor?.isAlly && this.currentActor?.isPlayerControlled) ? this.currentActor : null
        });
    }

    playerSelectsTarget(targetInstanceId) {
        if (this.pendingPlayerAction) {
            const target = this.findCombatant(targetInstanceId);
            if (!target || target.stats.currentHp <= 0) {
                eventBus.publish('combatLog', {text: "Invalid or defeated target selected.", type: 'error-message'});
                const tempPendingAction = { ...this.pendingPlayerAction }; 
                this.pendingPlayerAction = null; 
                this.playerInitiatesTargetedAction(tempPendingAction.type, tempPendingAction.detailId); // Re-initiate target selection
                return;
            }
            // Further validation: is the target valid for *this specific* action type?
            // E.g., healing skill on enemy, attack skill on ally.
            // For now, assume playerInitiatesTargetedAction filtered targetableEntities correctly.

            const fullAction = { ...this.pendingPlayerAction, targetId: targetInstanceId };
            this.pendingPlayerAction = null;
            this.processAction(fullAction);
        }
    }

     cancelPlayerTargetSelection() {
        this.pendingPlayerAction = null;
        eventBus.publish('playerTurnStarted', { 
            combatState: this.getCombatState(), 
            retry: true,
            isAllyTurn: this.currentActor?.isAlly && this.currentActor?.isPlayerControlled,
            allyActor: (this.currentActor?.isAlly && this.currentActor?.isPlayerControlled) ? this.currentActor : null
        }); 
    }
}
export const combatManager = new CombatManager();
