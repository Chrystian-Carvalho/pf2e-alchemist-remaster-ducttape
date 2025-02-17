import { debugLog, getSetting, hasFeat, isAlchemist  } from './settings.js';
import { LOCALIZED_TEXT } from "./localization.js";

/**
	Update item description based on regex pattern and replacement logic. 
	@param {string} description - The original item description. 
	@param {RegExp} regexPattern - The regex pattern to match.
	@param {Function} replacementFn - A function that takes a match and returns a replacement string.
	@returns {string} - The updated item description.
*/
function updateDescription(description, regexPattern, replacementFn) {
	const updatedDescription = description.replace(regexPattern, replacementFn);
	return updatedDescription;
}

Hooks.on("ready", () => {
  console.log("%cPF2e Alchemist Remaster Duct Tape: PowerfulAlchemy.js loaded","color: aqua; font-weight: bold;");
	
	//check if Powerful Alchemy is enabled
	const paEnabled = getSetting("enablePowerfulAlchemy");
	if (paEnabled) {
		debugLog("PowerfulAlchemy enabled.");
		
		Hooks.on("createItem", async (item) => {
			debugLog(`Item ${item.name} Created!`);
			
			// Get the actor from the item's parent (the actor who owns the item)
			const actor = item.parent;
			if (!actor) {
			  debugLog(3,"Actor for item not found.",);
			  return;
			}
			
			// Make sure selected token is an alchemist or has archetype
			const alchemistCheck = isAlchemist(actor);
			if (alchemistCheck.qualifies) {
				debugLog("Actor's Class DC:", alchemistCheck.dc);
				if (!alchemistCheck.dc) {
					debugLog(2, "Warning: Class DC not found for the actor:", actor);
					return;
				}
			} else {
				debugLog(`Selected Character (${actor.name}) is not an Alchemist - Ignoring`);
				return;
			}
			
			// Check if the actor has Powerful Alchemy - if not return with mesactorge in log	
			if (!hasFeat(actor, "powerful-alchemy")) {
				debugLog(`Actor (${actor.name}) does not have Powerful alchemy, ignoring!`);
				return;	
			}
			
			// ensure the item type is 'weapon' or 'consumable'
			if (!item || (item.type !== "weapon" && item.type !== "consumable")) {
			  debugLog(`Item type (${item.type}) is not weapon or consumable or item is undefined - Ignoring.`);
			  return;
			}
			
			// Ensure the item has the 'alchemical' trait
			if (!item || !item.system.traits.value.includes("alchemical")) {
			  debugLog(`Item (${item.name}) does not have the 'alchemical' trait or item is undefined.`);
			  return;
			}
			
			// Ensure Quick Alchemy was used to create item - it will have the "infused" trait
			if (!item || !item.system.traits.value.includes("infused")) {
			  debugLog(`Item (${item.name}) does not have the 'infused' trait or item is undefined.`);
			  return;
			}

			// Log infused item was created
			debugLog(`Infused item created! Item: `, item);
						
			// Get current description of item
			let description = item.system.description.value;
			
			// Check for strings to replace in item description
			const replacements = [
				{ 
					pattern: /@Check\[(?!flat)\w+\|dc:(\d+)\]/g, 
					replaceFn: (match, p1) => match.replace(`dc:${p1}`, `dc:${alchemistCheck.dc}`)
				}, // Match @Check that is NOT flat (negative lookahead prevents matching "@Check[flat|dc:X]")
				{ 
					pattern: /DC is (\d+)/g, 
					replaceFn: (match, p1) => match.replace(`DC is ${p1}`, `DC is ${alchemistCheck.dc}`)
				} // Example "DC is 17", but ensure this won't affect flat checks if written differently
			];
			
			// Make replacements
			let updatedDescription = description;
			for (const { pattern, replaceFn } of replacements) {
				updatedDescription = updateDescription(updatedDescription, pattern, replaceFn);
			}
			
			// Update the item with the new description
			if (updatedDescription !== description) {
				await item.update({"system.description.value": updatedDescription});
				debugLog("Description was updated to Class DC!");
				
				// Send Mesactorge to Chat
				const itemName = item.name;
				ChatMessage.create({
					author: game.user?.id,    // User ID to send the mesactorge as the system
					content: `<h3>Powerful Alchemy:</h3><p>${itemName} ${LOCALIZED_TEXT.POWERFUL_ALCHEMY_UPDATED_CLASS_DC} ${alchemistCheck.dc}!</p>`,
					speaker: { alias: "Powerful Alchemy" }  // Optional: sets the speaker to "System"
				});
			}
			
			// Find and update the Rule Element for Notes
			let updatedRules = item.system.rules.map(rule => {
				if (rule.key === "Note" && rule.selector.includes("{item|_id}-damage")) {
					debugLog(`Updating Note Rule Element for ${item.name}`);
					return {
						...rule,
						text: updatedDescription // Use the updated description in the rule element
					};
				}
				return rule;
			});

			// Only update if there's a change
			if (JSON.stringify(updatedRules) !== JSON.stringify(item.system.rules)) {
				await item.update({ "system.rules": updatedRules });
				debugLog(`Updated Note Rule Element for ${item.name} to use new description.`);
			}
			
		});
	}
});
