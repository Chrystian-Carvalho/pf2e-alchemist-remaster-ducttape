import { debugLog, getSetting, hasFeat, isAlchemist  } from './settings.js';
console.log("%cPF2e Alchemist Remaster Duct Tape | LevelUp.js loaded","color: aqua; font-weight: bold;");

// Settings placeholders
let addFormulasSetting = "disabled";
let addNewFormulasToChat = false;
let addFormulasPermission = "gm_only"; 
let handleLowerFormulasOnLevelUp = "disabled";
let promptLowerFormulasOnLevelUp = "ask_each_lower";

Hooks.once('ready', async () => {
	
	// Always index `pf2e.equipment-srd`
    const compendiumName = "pf2e.equipment-srd";
    const compendium = game.packs.get(compendiumName);
    if (compendium) {
        await compendium.getIndex(); // Index with the updated fields
        debugLog(`Rebuilt index for compendium: ${compendium.metadata.label} (${compendiumName})`);
    } else {
        debugLog(3, `Compendium '${compendiumName}' not found.`);
    }

    // Index user-added compendiums
    const userDefinedCompendiums = game.settings.get('pf2e-alchemist-remaster-ducttape', 'compendiums') || [];
    for (const userCompendium of userDefinedCompendiums) {
        const userPack = game.packs.get(userCompendium);
        if (userPack) {
            await userPack.getIndex(); // Index the user-defined compendium
            debugLog(`Rebuilt index for user compendium: ${userPack.metadata.label} (${userCompendium})`);
        } else {
            debugLog(2, `User-defined compendium '${userCompendium}' not found.`);
        }
    }
	
	getAlchemistLevels();
	
});	

Hooks.once('init', () => {
	
	// Configure compendiums to have slug indexable
	CONFIG.Item.compendiumIndexFields = ["system.slug"];
	
    // Get Settings
    addFormulasSetting = getSetting("addFormulasOnLevelUp","disabled");
	handleLowerFormulasOnLevelUp = getSetting("handleLowerFormulasOnLevelUp","disabled");
	addNewFormulasToChat = getSetting("addNewFormulasToChat");
	addFormulasPermission = getSetting("addFormulasPermission","actor_owner");
	promptLowerFormulasOnLevelUp = getSetting('promptLowerFormulasOnLevelUp');
	
    

    if (addFormulasSetting !== "disabled") {
        // Hook into updateActor to detect level-ups and grant Alchemist formulas
        Hooks.on('updateActor', async (actor, updateData, options, userId) => {
			
			debugLog(`Settings | 
				addFormulasSetting: ${addFormulasSetting} | 
				handleLowerFormulasOnLevelUp: ${handleLowerFormulasOnLevelUp} | 
				addNewFormulasToChat: ${addNewFormulasToChat} | 
				addFormulasPermission: ${addFormulasPermission}`); 
					
			// Make sure selected token is an alchemist or has archetype
			const alchemistCheck = isAlchemist(actor);
			if (!alchemistCheck.qualifies) {
				debugLog(`Selected Character (${actor.name}) is not an Alchemist - Ignoring`);
				return;
			}
			
			// Check permissions
            if (!canManageFormulas(actor)) return;
			
            // Check if the level was updated
            const newLevel = updateData?.system?.details?.level?.value;
            if (newLevel === undefined) {
                debugLog(`No level change detected for ${actor.name}.`);
                return;
            }
            debugLog(`Level change detected for ${actor.name}. New Level = ${newLevel}`);
            
            // Update formulas
            await grantAlchemistFormulas(actor, newLevel);
			if (handleLowerFormulasOnLevelUp === "remove_lower" ) {
				await removeLowerLevelFormulas(actor);
			}
			await actor.setFlag('pf2e-alchemist-remaster-ducttape', 'previousLevel', actor.system.details.level.value);	
			debugLog(`Previous level flag set for ${actor.name} = ${actor.system.details.level.value}`);
			
        });
    }
});

/* 
	Grant new formulas to Alchemists as they level up.
*/
async function grantAlchemistFormulas(actor, newLevel) {
    debugLog(`Checking for new formulas for ${actor.name} for level ${newLevel}.`);

    const systemCompendium = 'pf2e.equipment-srd';
    const userDefinedCompendiums = game.settings.get('pf2e-alchemist-remaster-ducttape', 'compendiums') || [];

    // Extract the UUIDs from the actor's known formulas
    const knownFormulaUUIDs = actor.system.crafting.formulas.map(f => (typeof f.uuid === 'string' ? f.uuid : null)).filter(Boolean);
    debugLog(`Known formula UUIDs for ${actor.name}:${knownFormulaUUIDs.join('\n')}`);

    // Extract base slugs from the known UUIDs
    const knownBaseSlugs = await Promise.all(
        knownFormulaUUIDs.map(async (uuid) => {
            try {
                const item = await fromUuid(uuid);
                return item ? extractBaseSlug(item.system.slug) : null;
            } catch (error) {
                debugLog(3, `Error extracting item for UUID: ${uuid} | Error: ${error.message}`, error);
                return null;
            }
        })
    );

    // Filter out duplicates and null values
    const deduplicatedBaseSlugs = [...new Set(knownBaseSlugs.filter(Boolean))];
    debugLog("Deduplicated base slugs:", deduplicatedBaseSlugs);

    if (deduplicatedBaseSlugs.length === 0) {
        debugLog(2, `No base formulas found for ${actor.name}.`);
        return;
    }

    const itemsToCheck = []; // Collect items from all compendiums

    // 1. Process system compendium
    const processCompendium = async (compendiumKey) => {
        const pack = game.packs.get(compendiumKey);
        if (!pack) {
            debugLog(2, `Compendium '${compendiumKey}' not found.`);
            return;
        }

        const index = pack.index; // Use the prebuilt index
        debugLog(`Compendium index for ${compendiumKey}:`, index);

        const filteredIndex = index.filter(entry => {
            const baseSlug = extractBaseSlug(entry.system.slug);
            return deduplicatedBaseSlugs.includes(baseSlug);
        });
        debugLog(`Filtered index for ${compendiumKey}:`, filteredIndex);

        // Fetch the full documents for relevant entries
        let fetchedItems = ""; // Placeholder for list of fetched items
        const relevantItems = await Promise.all(
            filteredIndex.map(async (entry) => {
                try {
                    const item = await pack.getDocument(entry._id);
                    fetchedItems += `${item.name}\n`;
                    return item;
                } catch (error) {
                    debugLog(3, `Error fetching item for entry ${entry.name}: ${error.message}`);
                    return null;
                }
            })
        );
        debugLog(`Fetched items from ${compendiumKey}:${fetchedItems}`);
        itemsToCheck.push(...relevantItems.filter(Boolean));
    };

    await processCompendium(systemCompendium);

    // 2. Process user-defined compendiums
    for (const compendiumKey of userDefinedCompendiums) {
        await processCompendium(compendiumKey);
    }

    // 3. Filter items by level, traits, and rarity
    const previousLevel = actor.getFlag('pf2e-alchemist-remaster-ducttape', 'previousLevel') || 1;
    debugLog(`Previous level for ${actor.name}: ${previousLevel}`);

    const filteredItems = itemsToCheck.filter(item => {
        const isAlchemical = item.system.traits?.value?.includes('alchemical');
        const isCommon = item.system.traits?.rarity === 'common';
        const levelCheck = item.system.level.value <= newLevel && item.system.level.value > previousLevel;
        return isAlchemical && isCommon && levelCheck;
    });

    debugLog(`Filtered items for ${actor.name}:`, filteredItems);

    const newFormulaUUIDs = filteredItems.map(item => item.uuid);
    debugLog(`New formula UUIDs:
${newFormulaUUIDs.join('\n')}`);

    if (newFormulaUUIDs.length === 0) {
        debugLog(`No new formulas to add for ${actor.name}.`);
        return;
    }

    debugLog(`Adding the following new formulas to ${actor.name}:
${newFormulaUUIDs.join('\n')}`);

    // Collect added formulas for the chat message
    let addedFormulas = [];

    // Check setting to see if we are asking for each formula
    if (addFormulasSetting === "ask_each") {
        for (const uuid of newFormulaUUIDs) {
            const item = await fromUuid(uuid);
            if (!item) continue;

            const confirmed = await showFormulaDialog(actor, item, item.system.level.value);
            if (confirmed) {
                const newFormulaObject = { uuid };
                const updatedFormulaObjects = [...actor.system.crafting.formulas, newFormulaObject];
                try {
                    await actor.update({ 'system.crafting.formulas': updatedFormulaObjects });
                } catch (error) {
                    debugLog(`Error updating formulas for ${actor.name}: ${error.message}`);
                }
                debugLog(`${actor.name} has learned the formula for ${item.name}.`);
                addedFormulas.push(item.name);
            } else {
                debugLog(`User declined to add formula ${item.name} to ${actor.name}.`);
            }
        }
        // Send new formula list to chat
        newFormulasChatMsg(actor.name, addedFormulas.join('<br>'), addedFormulas.length);
    } else if (addFormulasSetting === "ask_all") { // If we are asking for all at once
        const formulasToPrompt = [];
        for (const uuid of newFormulaUUIDs) {
            const item = await fromUuid(uuid);
            if (!item) continue;
            formulasToPrompt.push({ uuid, name: item.name, level: item.system.level.value });
        }
        if (formulasToPrompt.length > 0) { // Make sure list is not empty
            const formulaNames = formulasToPrompt.map(f => f.name);
            // Add the formula names to the list
            addedFormulas.push(...formulaNames);

            // Show dialog with all formulas to add
            const confirmed = await showFormulaListDialog(actor, formulasToPrompt);
            if (confirmed) { // If player clicked "yes"
                const newFormulaObjects = formulasToPrompt.map(f => ({ uuid: f.uuid }));
                const updatedFormulaObjects = [...actor.system.crafting.formulas, ...newFormulaObjects];
                await actor.update({ 'system.crafting.formulas': updatedFormulaObjects });
                debugLog(`${actor.name} has learned ${formulasToPrompt.length} new formulas.`);
                // Send new formula list to chat
                newFormulasChatMsg(actor.name, addedFormulas.join('<br>'), addedFormulas.length);
            } else {
                debugLog(`User declined to add formulas to ${actor.name}.`);
            }
        }
    } else if (addFormulasSetting === "auto") {
        const newFormulaObjects = newFormulaUUIDs.map(uuid => ({ uuid }));
        const updatedFormulaObjects = [...actor.system.crafting.formulas, ...newFormulaObjects];
        const validUUIDs = updatedFormulaObjects.filter(obj => obj && obj.uuid && typeof obj.uuid === 'string' && obj.uuid.startsWith('Compendium.'));
        try {
            await actor.update({ 'system.crafting.formulas': validUUIDs });
            debugLog(`${actor.name} has learned ${newFormulaUUIDs.length} new formulas.`);
            // Get the names of the added formulas
            const formulaNames = await Promise.all(newFormulaUUIDs.map(async (uuid) => {
                const item = await fromUuid(uuid);
                return item?.name ?? 'Unknown Formula';
            }));
            // Add the formula names to the list
            addedFormulas.push(...formulaNames);
            // Send new formula list to chat
            newFormulasChatMsg(actor.name, addedFormulas.join('<br>'), addedFormulas.length);
        } catch (error) {
            debugLog(3, `Error updating formulas for ${actor.name}: ${error.message}`);
        }
    }
}

/*
	Function to extract base name ignoring parenthisis and contents within, 
	as well as commas and text after
*/
function extractBaseName(name) {
    return name
		.toLowerCase()
		.replace(/\s*\(.*?\)|\s*,.*$/g, '') // Remove parentheses or comma-separated variants
		.trim();
}

// Helper function to extract base slug
function extractBaseSlug(slug) {
	return slug ? slug.split('-').slice(0, -1).join('-') : null;
}

/*
	Removes lower-level versions of formulas from the actor's known formulas if higher-level versions are present.
*/
async function removeLowerLevelFormulas(actor) {
    const knownFormulas = actor.system.crafting.formulas;
    const formulaMap = new Map(); // Map to store the highest-level version of each base formula
    let removedFormulas = []; // Track removed formulas

    // Iterate through known formulas
    for (const formula of knownFormulas) {
        const item = await fromUuid(formula.uuid);
        if (!item) {
            debugLog(`Unable to retrieve item for formula UUID: ${formula.uuid}`);
            continue;
        }

        // Extract the base formula slug
        const baseSlug = extractBaseSlug(item.system.slug);
        if (!baseSlug) {
            debugLog(`Skipping formula with invalid slug: ${item.name}`);
            continue;
        }

        const level = Number(item.system.level.value);
        const currentLevel = formulaMap.has(baseSlug) ? formulaMap.get(baseSlug).level : null;

        // Compare levels and store the highest-level version
        if (!formulaMap.has(baseSlug) || currentLevel < level) {
            // If a lower-level version exists, move it to removedFormulas
            if (formulaMap.has(baseSlug)) {
                const lowerLevelFormula = formulaMap.get(baseSlug);
                removedFormulas.push(lowerLevelFormula);
                debugLog(`Replacing ${lowerLevelFormula.name} (Level ${lowerLevelFormula.level}) with ${item.name} (Level ${level}) as the highest-level version of ${baseSlug}.`);
            }
            // Set the current formula as the highest-level version
            formulaMap.set(baseSlug, { uuid: formula.uuid, level, name: item.name });
            debugLog(`Setting ${item.name} (Level ${level}) as the highest-level version of ${baseSlug}.`);
        } else {
            // If the current formula is lower level, mark it for removal
            removedFormulas.push({ uuid: formula.uuid, name: item.name, level, baseSlug });
            debugLog(`Marking ${item.name} (Level ${level}) for removal.`);
        }
    }

    // If no formulas to remove, exit early
    if (removedFormulas.length === 0) {
        debugLog(`No lower-level formulas to remove for ${actor.name}.`);
        return;
    }

    // Handle ask_all_lower: Compile and prompt for all at once
    if (promptLowerFormulasOnLevelUp === "ask_all_lower") {
        const confirmed = await showFormulaListDialog(actor, removedFormulas.map(f => ({
            uuid: f.uuid,
            name: f.name,
            level: f.level
        })), true);

        if (!confirmed) {
            debugLog(`User declined to remove lower-level formulas for ${actor.name}.`);
            return; // Exit if user cancels
        }
    } else if (promptLowerFormulasOnLevelUp === "ask_each_lower") {
		// Handle ask_each_lower: Prompt for each formula individually
		const keptFormulas = [];
		for (const formula of removedFormulas) {
			const confirmed = await showFormulaDialog(actor, { name: formula.name, level: formula.level }, formula.level, true);
			if (!confirmed) {
				keptFormulas.push(formula); // Keep formulas user declined to remove
			}
		}

		debugLog(`Kept formulas: ${keptFormulas.map(f => f.name).join(', ')}`);

		// Filter out formulas to remove
		removedFormulas = removedFormulas.filter(f => {
			if (keptFormulas.some(kf => kf.uuid === f.uuid)) {
				debugLog(`Keeping formula: ${f.name} (Level ${f.level})`);
				// Ensure the kept formula is added to formulaMap
				formulaMap.set(f.uuid, { uuid: f.uuid, level: f.level, name: f.name });
				return false; // Exclude from removal
			} else {
				debugLog(`Removing formula: ${f.name} (Level ${f.level})`);
				return true; // Include in removal
			}
		});

		debugLog(
			`Final formulaMap after ask_each_lower: ${Array.from(formulaMap.entries())
				.map(([uuid, data]) => `${data.name} (Level ${data.level})`)
				.join(', ')}`
		);
	}

    // Filter out formulas to keep
    const uuidsToKeep = Array.from(formulaMap.values()).map(entry => entry.uuid);
    const updatedFormulas = knownFormulas.filter(f => uuidsToKeep.includes(f.uuid));

    // Update the actor's formulas if changes were made
    if (updatedFormulas.length !== knownFormulas.length) {
        await actor.update({ 'system.crafting.formulas': updatedFormulas });
        debugLog(`Updated formulas for ${actor.name}: Removed lower-level versions.`);
    }

    // Output to chat if enabled
    if (addNewFormulasToChat && removedFormulas.length > 0) {
        const removedFormulaNames = removedFormulas.map(f => f.name).join('<br>');
        ChatMessage.create({
            content: `<strong>${actor.name}</strong> has removed the following lower-level formulas:<br><br>${removedFormulaNames}`
        });
    }
}

/*
	Send message to chat with list of learned formulas.
*/
function newFormulasChatMsg(actorName, newFormulas, newFormulaCount) {
	if (addNewFormulasToChat && newFormulaCount > 0) { // if option enabled and there was formulas added, display in chat
      try {
          ChatMessage.create({ 
              content: `<strong>${actorName}</strong> has learned the following new formulas:<br><br> ${newFormulas}`
          });
      } catch (error) {
          debugLog(`Failed to send chat message for ${actorName}: ${error.message}`);
      }
    } else {
		debugLog(`actorName: ${actorName} | newFormulas: ${newFormulas} | newFormulaCount: ${newFormulaCount}`);
	}
}

/*
	Show a dialog to ask if the user wants to add all the gathered formulas.
*/
async function showFormulaListDialog(actor, formulas, isRemoving = false) {
    return new Promise((resolve) => {
        if (formulas.length === 0) {
            debugLog("No formulas to show in the dialog.");
            return resolve(false);
        }

        const sortedFormulas = formulas.sort((a, b) => a.level - b.level);
        const formulaListHTML = sortedFormulas.map(f => 
            `<li>Level ${f.level}: <strong>${f.name}</strong></li>`
        ).join('');

        const title = isRemoving ? "Remove Lower-Level Formulas" : "New Formulas Discovered";
        const content = isRemoving
            ? `<p>${actor.name} has the following lower-level formulas that are being replaced:</p>
                <ul>${formulaListHTML}</ul><p>Do you want to remove these formulas?</p>`
            : `<p>${actor.name} has unlocked new formulas:</p>
                <ul>${formulaListHTML}</ul><p>Do you want to add these formulas?</p>`;

        new Dialog({
            title,
            content,
            buttons: {
                yes: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "Yes",
                    callback: () => resolve(true)
                },
                no: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "No",
                    callback: () => resolve(false)
                }
            },
            default: "yes",
        }).render(true);
    });
}

/*
	Show a dialog to ask if the user wants to add a formula.
*/
async function showFormulaDialog(actor, formula, level, isRemoving = false) {
    return new Promise((resolve) => {
        const title = isRemoving ? "Remove Formula" : "New Formula Discovered";
        const content = isRemoving
            ? `<p>${actor.name} has a higher version of formula <strong>${formula.name}</strong> (Level ${level}). Do you want to remove it?</p>`
            : `<p>${actor.name} has unlocked the formula for <strong>${formula.name}</strong> (Level ${level}). Do you want to add it?</p>`;

        new Dialog({
            title,
            content,
            buttons: {
                yes: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "Yes",
                    callback: () => resolve(true)
                },
                no: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "No",
                    callback: () => resolve(false)
                }
            },
            default: "yes",
        }).render(true);
    });
}

/*
  Function to check if actor has any active logged in owners
*/
function hasActiveOwners(actor) {
    // Get owners with ownership level 3 ('Owner')
    const owners = Object.keys(actor.ownership).filter(userId => actor.ownership[userId] === 3);

    // Filter for logged-in owners who are not GMs
    const loggedInOwners = game.users.contents.filter(user => owners.includes(user.id) && user.active && !user.isGM);

    // Debug output
    debugLog(`Owners: ${owners.join(', ')}, Logged-in owners (non-GM): ${loggedInOwners.map(u => u.name).join(', ')}`);

    // Return whether any non-GM logged-in owners exist
    return loggedInOwners.length > 0;
}

/*
  Function to handle permissions
*/
function canManageFormulas(actor) {
    const activeOwnersExist = hasActiveOwners(actor);

    if (addFormulasPermission === "gm_only") {
        // GM-only permission: Allow only the GM
        if (!game.user.isGM) {
            debugLog(`User ${game.user.name} is not a GM and cannot manage formulas for ${actor.name}.`);
            return false;
        } else {
			return true;
		}
    }

    if (addFormulasPermission === "actor_owner") {
        // If there are active owners, allow only owners to proceed
        if (activeOwnersExist) { // An owner is logged in 
            if (actor.isOwner && !game.user.isGM) { // Allow only active non-GM owner
				return true; 
            } else {
				debugLog(`User ${game.user.name} is not an owner of ${actor.name}.`);
                return false;
			}
			
		// If no active owners, allow GM to manage formulas
        } else if (game.user.isGM) {
        
            debugLog(`No active non-GM owners for ${actor.name}. Allowing GM to manage formulas.`);
            return true;
        }
    }

    return false;
}

/*
	Function to get all Alchemists current level at start
*/
async function getAlchemistLevels(){
	// Avoid sending multiple messages for the same actor
	const processedActorIds = new Set();

	// Loop through all actors and find Alchemists
	for (const actor of game.actors.party.members) {
		// Make sure selected token is an alchemist or has archetype
		const alchemistCheck = isAlchemist(actor);
		if (!alchemistCheck.qualifies) {
			debugLog(`Selected Character (${actor.name}) is not an Alchemist - Ignoring`);
		} else {

			// Avoid processing the same actor multiple times
			if (processedActorIds.has(actor.id)) continue;
			processedActorIds.add(actor.id);
			
			// Set previous level flag as current level
			await actor.setFlag('pf2e-alchemist-remaster-ducttape', 'previousLevel', actor.system.details.level.value);	
			debugLog(`Previous level flag set for ${actor.name} = ${actor.system.details.level.value}`);
		}
	}
}