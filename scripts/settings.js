console.log("%cPF2e Alchemist Remaster Duct Tape | settings.js loaded","color: aqua; font-weight: bold;");
/*
	Function for debugging
*/
export function debugLog(intLogType, stringLogMsg, objObject = null) {
	// Handle the case where the first argument is a string
	if (typeof intLogType === "string") {
		objObject = stringLogMsg; // Shift arguments
		stringLogMsg = intLogType;
		intLogType = 1; // Default log type to 'all'
	}

	const debugLevel = game.settings.get("pf2e-alchemist-remaster-ducttape", "debugLevel");

	// Map debugLevel setting to numeric value for comparison
	const levelMap = {
		"none": 4,
		"error": 3,
		"warn": 2,
		"all": 1
	};

	const currentLevel = levelMap[debugLevel] || 4; // Default to 'none' if debugLevel is undefined

	// Check if the log type should be logged based on the current debug level
	if (intLogType < currentLevel) return;

	// Capture stack trace to get file and line number
	const stack = new Error().stack.split("\n");
	let fileInfo = "Unknown Source";
	for (let i = 2; i < stack.length; i++) {
		const line = stack[i].trim();
		const fileInfoMatch = line.match(/(\/[^)]+):(\d+):(\d+)/); // Match file path and line number
		if (fileInfoMatch) {
			const [, filePath, lineNumber] = fileInfoMatch;
			const fileName = filePath.split("/").pop(); // Extract just the file name
			// Ensure the file is one of the allowed files
			const allowedFiles = ["FormulaSearch.js", "LevelUp.js", "PowerfulAlchemy.js", "QuickAlchemy.js", "settings.js", "VialSearch.js"];
			if (allowedFiles.includes(fileName)) {
				fileInfo = `${fileName}:${lineNumber}`;
				break;
			}
		}
	}

	// Prepend the file and line info to the log message
	const formattedLogMsg = `[${fileInfo}] ${stringLogMsg}`;
	
	if (objObject) {
		switch (intLogType) {
			case 1: // Info/Log (all)
				console.log(`%cP2Fe Alchemist Duct Tape | ${formattedLogMsg}`, "color: aqua; font-weight: bold;", objObject);
				break;
			case 2: // Warning
				console.log(`%cP2Fe Alchemist Duct Tape | WARNING: ${formattedLogMsg}`, "color: orange; font-weight: bold;", objObject);
				break;
			case 3: // Critical/Error
				console.log(`%cP2Fe Alchemist Duct Tape | ERROR: ${formattedLogMsg}`, "color: red; font-weight: bold;", objObject);
				break;
			default:
				console.log(`%cP2Fe Alchemist Duct Tape | ${formattedLogMsg}`, "color: aqua; font-weight: bold;", objObject);
		}
	} else {
		switch (intLogType) {
			case 1: // Info/Log (all)
				console.log(`%cP2Fe Alchemist Duct Tape | ${formattedLogMsg}`, "color: aqua; font-weight: bold;");
				break;
			case 2: // Warning
				console.log(`%cP2Fe Alchemist Duct Tape | WARNING: ${formattedLogMsg}`, "color: orange; font-weight: bold;");
				break;
			case 3: // Critical/Error
				console.log(`%cP2Fe Alchemist Duct Tape | ERROR: ${formattedLogMsg}`, "color: red; font-weight: bold;");
				break;
			default:
				console.log(`%cP2Fe Alchemist Duct Tape | ${formattedLogMsg}`, "color: aqua; font-weight: bold;");
		}
	}
}

/*
	Function to check setting and return it
	will ONLY work for settings for this module!
*/
export function getSetting(settingName, returnIfError = false) {
    // Validate the setting name
    if (typeof settingName !== "string" || settingName.trim() === "") {
        debugLog(3, `Invalid setting name provided: ${settingName}`);
        return returnIfError; // Return undefined or a default value
    }

    // Check if the setting is registered
    if (!game.settings.settings.has(`pf2e-alchemist-remaster-ducttape.${settingName}`)) {
        debugLog(3, `Setting "${settingName}" is not registered.`);
        return returnIfError; // Return undefined or a default value
    }

    try {
        // Attempt to retrieve the setting value
        const value = game.settings.get("pf2e-alchemist-remaster-ducttape", settingName);
        //debugLog(1, `Successfully retrieved setting "${settingName}":`, value);
        return value;
    } catch (error) {
        // Log the error and return undefined or a default value
        debugLog(3, `Failed to get setting "${settingName}":`, error);
        return returnIfError;
    }
}

/*
	Check if actor has a feat by searching for the slug, example "powerful-alchemy"
*/
export function hasFeat(actor, slug) {
	return actor.itemTypes.feat.some((feat) => feat.slug === slug);
}

/*
	Checks if a character qualifies for Alchemist benefits.
*/
export function isAlchemist(actor) {
    if (!actor) return { qualifies: false, dc: 0, isArchetype: false };


    // Check if the actor's class matches the localized Alchemist class name
    const isAlchemistClass = actor?.class?.system?.slug === 'alchemist';
	
	debugLog(`isAlchemistClass: ${isAlchemistClass} | ${actor?.class?.system?.slug}`);

    // Check if the actor has the localized Alchemist Dedication feat
    const hasAlchemistDedication = hasFeat(actor, "alchemist-dedication");

    // If the actor qualifies, get the Alchemist Class DC
    if (isAlchemistClass || hasAlchemistDedication) {
        const alchemistClassDC = actor.system.proficiencies.classDCs.alchemist?.dc || 0;
        return {
            qualifies: true,
            dc: alchemistClassDC,
            isArchetype: hasAlchemistDedication && !isAlchemistClass
        };
    }

    // If the actor doesn't qualify
    return { qualifies: false, dc: 0, isArchetype: false };
}

/* 
	Function to dynamically manage collapseChatDesc setting based on Workbench's setting
*/
function adjustCollapseSettingBasedOnWorkbench() {
    const settingKey = "pf2e-alchemist-remaster-ducttape.collapseChatDesc";
    const workbenchSettingKey = "xdy-pf2e-workbench.autoCollapseItemChatCardContent";
    const isWorkbenchInstalled = game.modules.get("xdy-pf2e-workbench")?.active;

    if (!isWorkbenchInstalled) return; // Not installed - exit early
	
	if (!game.settings.settings.has(workbenchSettingKey)) {// settings key not found
        console.log(`Workbench setting '${workbenchSettingKey}' not found.`);
        return;
    }
    const currentWorkbenchSetting = game.settings.get("xdy-pf2e-workbench", "autoCollapseItemChatCardContent");

    // Check if the collapseChatDesc setting exists
    if (!game.settings.settings.has(settingKey)) return;

    // If Workbench is managing collapsibility, set collapseChatDesc to false
    if (currentWorkbenchSetting === "collapsedDefault" || currentWorkbenchSetting === "nonCollapsedDefault") {
        if (game.settings.get("pf2e-alchemist-remaster-ducttape", "collapseChatDesc") === true) {
            game.settings.set("pf2e-alchemist-remaster-ducttape", "collapseChatDesc", false);
            console.log(
                "PF2e Alchemist Remaster Duct Tape | xdy-pf2e-workbench is managing collapsibility."
            );
        }
    }
}

/*
	AddCompendiumsApp class object
*/
window.AddCompendiumsApp = class AddCompendiumsApp extends FormApplication {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            title: 'Manage Homebrew Compendiums',
            template: 'modules/pf2e-alchemist-remaster-ducttape/templates/add-compendiums.html',
            width: 600,
            height: 'auto',
            closeOnSubmit: false
        });
    }

    getData() {
        const savedCompendiums = game.settings.get('pf2e-alchemist-remaster-ducttape', 'compendiums') || [];
        return {
            savedCompendiums,
            tempCompendiums: this.tempCompendiums || []
        };
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Add a compendium to the temporary list
        html.find('#add-compendium-btn').click(() => {
            const input = html.find('#compendium-input').val().trim();
            if (!input) return;

            const pack = game.packs.get(input);
            if (this.tempCompendiums?.some(comp => comp.name === input)) {
                ui.notifications.warn(`Compendium "${input}" is already in the list.`);
                return;
            }

            if (!pack || pack.documentName !== 'Item') {
                ui.notifications.error(`Compendium "${input}" is not valid or does not contain items.`);
                return;
            }
            this.tempCompendiums = [...(this.tempCompendiums || []), { name: input, valid: !!pack }];
            this.render();
        });

        // Remove a compendium from the temporary list
        html.find('.delete-compendium').click((event) => {
            const index = parseInt(event.currentTarget.dataset.index);
            this.tempCompendiums.splice(index, 1);
            this.render();
        });

        // Remove a saved compendium
        html.find('.delete-saved-compendium').click(async (event) => {
            const compendiumToDelete = event.currentTarget.dataset.name;
            const savedCompendiums = game.settings.get('pf2e-alchemist-remaster-ducttape', 'compendiums') || [];
            const updatedCompendiums = savedCompendiums.filter(c => c !== compendiumToDelete);

            await game.settings.set('pf2e-alchemist-remaster-ducttape', 'compendiums', updatedCompendiums);
            ui.notifications.info(`Compendium "${compendiumToDelete}" removed.`);
            this.render();
        });

        // Save compendiums when the Save button is clicked
        html.find('#save-compendiums-btn').click(async () => {
            const savedCompendiums = game.settings.get('pf2e-alchemist-remaster-ducttape', 'compendiums') || [];
            const uniqueCompendiums = new Map(); // Use Map to avoid duplicates

            let invalidEntries = [];
            for (const { name, valid } of this.tempCompendiums || []) {
                if (valid) uniqueCompendiums.set(name, true);
                else invalidEntries.push(name);
            }

            if (invalidEntries.length > 0) {
                new Dialog({
                    title: 'Invalid or Duplicate Entries',
                    content: `The following compendiums were not valid or were duplicates and were not saved:<br>${invalidEntries.join('<br>')}`,
                    buttons: {
                        ok: {
                            icon: '<i class="fas fa-check"></i>',
                            label: 'OK'
                        }
                    }
                }).render(true);
            }

            // Save valid entries
            await game.settings.set(
                'pf2e-alchemist-remaster-ducttape',
                'compendiums',
                [...new Set([...savedCompendiums, ...uniqueCompendiums.keys()])]
            );
            ui.notifications.info('Compendiums saved successfully.');
            this.tempCompendiums = [];
            this.close();
        });
    }

    async _updateObject(event, formData) {
        // No action needed since save is handled manually
    }
};

Hooks.once("init", () => {
	
/*	
	Saved Data Settings
*/
	game.settings.register('pf2e-alchemist-remaster-ducttape', 'explorationTime', {
        name: 'Last Processed Time',
        hint: 'Tracks the last processed time for exploration mode.',
        scope: 'world',
        config: false,
        type: Number,
        default: 0
    });
	game.settings.register('pf2e-alchemist-remaster-ducttape', 'previousTime', {
		name: 'Previous World Time',
		hint: 'Tracks the last recorded world time to calculate elapsed time.',
		scope: 'world',
		config: false,
		type: Number,
		default: 0
	});
	
/*
	QUICK ALCHEMY SETTINGS
*/
	
	// Quick Alchemy: remove temporary items at end of turn
	game.settings.register("pf2e-alchemist-remaster-ducttape", "removeTempItemsAtTurnChange", {
		name: "Quick Alchemy: remove temporary items at start of turn?",
		hint: "If enabled, will automatically remove items crafted with quick alchemy at the start of character turn (per RAW).",
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
		requiresReload: false,
	});
	
	// Quick Alchemy: remove temporary items at end of combat
	game.settings.register("pf2e-alchemist-remaster-ducttape", "removeTempItemsAtEndCombat", {
		name: "Quick Alchemy: remove temporary items at end of combat?",
		hint: "If enabled, will automatically remove items crafted with quick alchemy at the end of combat.",
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
		requiresReload: false,
	});
	
	// Send attack messages to chat
	game.settings.register("pf2e-alchemist-remaster-ducttape", "sendAtkToChat", {
		name: "Quick Alchemy: Send all crafted items to chat?",
		hint: 'If enabled, will send an item card to chat for all items made with Quick Alchemy, even the items made choosing "Craft and attack".',
		scope: "world",
		config: true,    
		default: false,  
		type: Boolean,   
		requiresReload: false,
	});
	
	// Sized Based Alchemy Settings
	game.settings.register("pf2e-alchemist-remaster-ducttape", "enableSizeBasedAlchemy", {
		name: "Quick Alchemy: Enable size-based alchemy?",
		hint: "Adjust the size of items created by Quick Alchemy to match the creature's size.",
		scope: "world",
		config: true,
		type: String,
		choices: {
			disabled: "Disabled",
			tinyOnly: "Tiny Only",
			allSizes: "All Sizes"
		},
		default: "tinyOnly",
		onChange: (value) => {
			console.log(`PF2E Alchemist Remaster Duct Tape | Size-based alchemy mode set to: ${value}`);
		},
		requiresReload: false
	});
	
/* 
	Powerful Alchemy Settings
*/
	console.log("%cPF2E Alchemist Remaster Duct Tape | Initializing Powerful Alchemy settings...","color: aqua; font-weight: bold;");
	game.settings.register("pf2e-alchemist-remaster-ducttape", "enablePowerfulAlchemy", {
		name: "Enable Powerful Alchemy",
		hint: "Enables the auto-update of created items using Class DC.",
		scope: "world",
		config: true,
		type: Boolean,
        default: true,
        onChange: (value) => {
            console.log(`PF2E Alchemist Remaster Duct Tape | Powerful Alchemy enabled: ${value}`);
        },
		requiresReload: true
	});
	
/*
	LevelUp - auto add formulas
*/
	// Add higher level versions of known formulas on level up?
	game.settings.register("pf2e-alchemist-remaster-ducttape", "addFormulasOnLevelUp", {
		name: "Level Up: Add higher level version of known formulas upon level up.",
		hint: `If enabled, when leveled up will add higher level version of known formulas. 
		Ask for each = will prompt for each formula; 
		Ask for all = will prompt for all formulas at once; 
		Auto = will automatically add formulas.`,
		scope: "world",
		config: true,
		type: String,
		choices: {
			disabled: "Disabled",
			ask_all: "Ask for all",
			ask_each: "Ask for each",
			auto: "Auto"
		},
		default: "ask_all",
		requiresReload: false,
	});
	
	// How to handle lower level formulas
	game.settings.register("pf2e-alchemist-remaster-ducttape", "handleLowerFormulasOnLevelUp", {
		name: "Level Up: Lower level formula handling:",
		hint: `Upon level up, will check for available lower level formulas, or remove them to keep your formula list small. 
		Add lower level versions = Will add lower level versions of known formulas; 
		Remove lower level versions (default) = Will Remove lower level formulas if a higher level is known.`,
		scope: "world",
		config: true,
		type: String,
		choices: {
			disabled: "Disabled.",
			add_lower: "Add lower level versions.",
			remove_lower: "Remove lower level versions."
		},
		default: "remove_lower",
		requiresReload: false,
	});
	
	// Prompt setting for handleLowerFormulasOnLevelUp
	game.settings.register("pf2e-alchemist-remaster-ducttape", "promptLowerFormulasOnLevelUp", {
		name: "Level Up: Prompt setting for lower level forumulas",
		hint: "'Auto': Automatically removes lower level formulas, 'Ask for All': ask once for all, 'Ask for Each': Ask for each formula",
		scope: "world",
		config: true,
		type: String,
		choices: {
			auto_lower: "Auto",
			ask_all_lower: "Ask for All",
			ask_each_lower: "Ask for Each"
		},
		default: "ask_all_lower",
		requiresReload: false,
	});
	
	// Who is asked by default to add/remove formulas
	game.settings.register("pf2e-alchemist-remaster-ducttape", "addFormulasPermission", {
		name: "Level Up: Permission level to add/remove formulas to actor:",
		hint: "(If actor owner is not logged in, GM will be prompted)",
		scope: "world",
		config: true,
		type: String,
		choices: {
			gm_only: "GM",
			actor_owner: "Owner"
		},
		default: "actor_owner",
		requiresReload: false,
	});
	
	// add list of new formulas learned to chat
	game.settings.register("pf2e-alchemist-remaster-ducttape", "addNewFormulasToChat", {
		name: "Level Up: Add the list of new/removed formulas upon level up to chat.",
		hint: "",
		scope: "world",
		config: true,
		type: Boolean,
		default: true,
		requiresReload: false,
	});
	
	game.settings.register('pf2e-alchemist-remaster-ducttape', 'compendiums', {
		name: 'Compendiums to Check',
		hint: 'List of compendiums to search for higher-level items when characters level up.',
		scope: 'world',
		config: false,
		type: Array,
		default: []
	});

	game.settings.registerMenu('pf2e-alchemist-remaster-ducttape', 'addCompendiumsMenu', {
		name: 'Add Compendiums',
		label: 'Add Hombebrew Item Compendiums', // This will be the button text
		hint: 'Manage the list of compendiums checked during level up.',
		icon: 'fas fa-plus-circle', // Icon for the button
		type: AddCompendiumsApp, // The FormApplication class to open
		restricted: true // Only accessible by GMs
	});
	
	// Disable addNewFormulasToChat if addFormulasOnLevelUp is set to 'disabled'
	Hooks.on("renderSettingsConfig", (app, html, data) => {
		const controllerSetting = "pf2e-alchemist-remaster-ducttape.addFormulasOnLevelUp";
		const dependentSettings = [
			"pf2e-alchemist-remaster-ducttape.addNewFormulasToChat",
			"pf2e-alchemist-remaster-ducttape.addFormulasPermission",
            "pf2e-alchemist-remaster-ducttape.handleLowerFormulasOnLevelUp"
		];
		
		// Get the current value of the controller setting
		const enableAdvancedOptions = game.settings.get("pf2e-alchemist-remaster-ducttape", "addFormulasOnLevelUp");
		
		// Disable both dependent settings on initial render
		dependentSettings.forEach(setting => {
			const dependentInput = html.find(`input[name="${setting}"], select[name="${setting}"]`);
			if (dependentInput.length) {
				dependentInput.prop('disabled', enableAdvancedOptions === 'disabled');
			}
		});
		
		// Watch for changes to the controller setting
		html.find(`select[name="${controllerSetting}"]`).change((event) => {
			const selectedValue = event.target.value;
			
			// Update both dependent settings
			dependentSettings.forEach(setting => {
				const dependentInput = html.find(`input[name="${setting}"], select[name="${setting}"]`);
				if (dependentInput.length) {
					dependentInput.prop('disabled', selectedValue === 'disabled');
				}
			});
		});
	});

/*
	Vial Search 
*/
	// Enable Vial Search
	game.settings.register("pf2e-alchemist-remaster-ducttape", "vialSearchReminder", {
		name: "Vial search reminder",
		hint: "When at least 10 minutes in game time pass out of combat, prompt alchemist to add vials.",
		scope: "world", 
		config: true,    
		type: Boolean,   
		default: true,  
		requiresReload: true,
	});
	
	// Suppress "Max Vials" Message
	game.settings.register("pf2e-alchemist-remaster-ducttape", "maxVialsMessage", {
		name: "Display when alchemist has max vials already",
		hint: "Enable/Disable max vials messages in chat.",
		scope: "world", 
		config: true,    
		type: Boolean,   
		default: false,  
		requiresReload: false,
	});
	
/* 
	Searchable Formulas
*/
	game.settings.register("pf2e-alchemist-remaster-ducttape", "searchableFormulas", {
		name: "Enable Formula Search",
		hint: "Enables the search/filter for formulas on character sheet.",
		scope: "client", 
		config: true, 
		type: Boolean, 
        default: true, 
        onChange: (value) => {
            console.log(`PF2E Alchemist Remaster Duct Tape | FormulaSearch enabled: ${value}`);
        },
		requiresReload: true
	});
	
/* 
	Collapse Item Description in chat
*/
	game.settings.register("pf2e-alchemist-remaster-ducttape", "collapseChatDesc", {
		name: "Collapse item description in chat",
		hint: "Shortens chat messages with long item descriptions, click the Eye icon to expand.",
		scope: "world", 
		config: true, 
		type: Boolean,
        default: false,
        onChange: (value) => {
            console.log(`PF2E Alchemist Remaster Duct Tape | collapseChatDesc enabled: ${value}`);
        },
		requiresReload: false
	});
	
	Hooks.on("renderSettingsConfig", (app, html, data) => {
		const workbenchSettingKey = "xdy-pf2e-workbench.autoCollapseItemChatCardContent";
		const thisSettingKey = "pf2e-alchemist-remaster-ducttape.collapseChatDesc";

		// Check if Workbench is installed and active
		const isWorkbenchInstalled = game.modules.get("xdy-pf2e-workbench")?.active;

		//monitor for settings change of workbench collapse setting
		if (isWorkbenchInstalled) {
			// Get the current value of the Workbench setting
			const workbenchSettingValue = game.settings.get("xdy-pf2e-workbench", "autoCollapseItemChatCardContent");

			// Get this setting input field in the UI
			const thisSettingInput = html.find(`input[name="${thisSettingKey}"]`);

			// Disable or enable this setting based on the Workbench setting
			if (thisSettingInput.length) {
				if (workbenchSettingValue === "collapsedDefault" || workbenchSettingValue === "nonCollapsedDefault") {
					thisSettingInput.prop("disabled", true);
					thisSettingInput.parent().append(
						`<p class="notes" style="color: red;">This setting is disabled because xdy-pf2e-workbench is managing collapsible content.</p>`
					);
				} else if (workbenchSettingValue === "noCollapse") {
					thisSettingInput.prop("disabled", false);
				}
			}

			// Watch for changes to the Workbench setting in the UI
			html.find(`select[name="${workbenchSettingKey}"]`).change((event) => {
				const selectedValue = event.target.value;

				// Update this setting's state dynamically
				if (thisSettingInput.length) {
					if (selectedValue === "collapsedDefault" || selectedValue === "nonCollapsedDefault") {
						thisSettingInput.prop("disabled", true);
						thisSettingInput.parent().find(".notes").remove(); // Remove old notes
						thisSettingInput.parent().append(
							`<p class="notes" style="color: red;">This setting is disabled because xdy-pf2e-workbench is managing collapsible content.</p>`
						);
						game.settings.set("pf2e-alchemist-remaster-ducttape", "collapseChatDesc", false);
					} else if (selectedValue === "noCollapse") {
						thisSettingInput.prop("disabled", false);
						thisSettingInput.parent().find(".notes").remove(); // Remove old notes
					}
				}
			});
		}
	});

/*
	Debugging
*/
	// Register debugLevel setting
	game.settings.register("pf2e-alchemist-remaster-ducttape", "debugLevel", {
		name: "Debug Level",
		hint: "Set the debug level for logging. None disables all logging, All includes info, warnings, and errors.",
		scope: "world",
		config: true,
		type: String,
		choices: {
			"none": "None",
			"error": "Errors",
			"warn": "Warnings",
			"all": "All"
		},
		default: "none", // Default to no logging
		requiresReload: false
	});

	// Log debug status
	const debugLevel = game.settings.get("pf2e-alchemist-remaster-ducttape", "debugLevel");
	console.log(`%cPF2E Alchemist Remaster Duct Tape | Debugging Level: ${debugLevel}`,"color: aqua; font-weight: bold;");
});

Hooks.once("ready", () => {
    console.log("PF2e Alchemist Remaster Duct Tape | Ready hook triggered.");
    
    // Adjust collapseChatDesc based on the Workbench setting
    adjustCollapseSettingBasedOnWorkbench();
	
});