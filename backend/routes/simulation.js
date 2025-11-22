/**
 * SPS Scenario Simulation Engine
 * Deterministic simulation based on real user data
 */

const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Scenario configurations
const SCENARIOS = {
    power_outage_24h: { name: 'Power Outage - 24 Hours', duration: 1, requiresPower: true, requiresRefrigeration: true },
    power_outage_72h: { name: 'Power Outage - 72 Hours', duration: 3, requiresPower: true, requiresRefrigeration: true },
    power_outage_14d: { name: 'Power Outage - 14 Days', duration: 14, requiresPower: true, requiresRefrigeration: true },
    grid_down: { name: 'Grid Down - Total Failure', duration: 30, requiresPower: true, requiresRefrigeration: true, noExternalHelp: true },
    water_contamination: { name: 'Water Contamination', duration: 14, requiresWaterPurification: true },
    shelter_in_place: { name: 'Shelter In Place - 30 Days', duration: 30, noResupply: true },
    evacuation: { name: 'Evacuation / Bug Out', duration: 3, mobile: true, weightLimit: 50 },
    medical_emergency: { name: 'Medical Emergency', duration: 7, requiresMedical: true, noExternalHelp: true },
    winter_storm: { name: 'Winter Storm - 7 Days', duration: 7, requiresHeating: true, requiresPower: true },
    heat_wave: { name: 'Heat Wave', duration: 7, requiresCooling: true, increasedWater: true }
};

// ==========================================
// CONSTANTS - Based on authoritative sources
// ==========================================

// FOOD REQUIREMENTS (CDC, FEMA guidelines)
// - Average adult needs 2000-2500 kcal/day (sedentary to moderate activity)
// - Children (ages 4-13) need 1200-1800 kcal/day
// - Emergency situations may require less due to reduced activity
const CALORIES_PER_ADULT_PER_DAY = 2000;     // FEMA/CDC recommendation
const CALORIES_PER_CHILD_PER_DAY = 1500;     // Average for children 4-13
const MRE_CALORIES = 1250;                   // Standard US MRE calories per meal

// WATER REQUIREMENTS (FEMA, CDC guidelines)
// - 1 gallon per person per day minimum for drinking and sanitation
// - 0.5 gallon for drinking only (2 liters)
// - Hot weather/activity increases need by 50-100%
const WATER_GALLONS_PER_PERSON_PER_DAY = 1;  // FEMA minimum
const WATER_LITERS_PER_GALLON = 3.785;
const WATER_BOTTLE_STANDARD_OZ = 16.9;       // Standard commercial bottle
const WATER_BOTTLE_TO_GALLON = 0.132;        // 16.9oz = ~0.132 gallons

// WATER FILTRATION (manufacturer specs)
// - Sawyer Mini: 100,000 gallons
// - LifeStraw: 1,000 gallons
// - Katadyn Hiker: 750 gallons
// - Average gravity/pump filter: 500-1500 gallons
const WATER_FILTER_CAPACITY_GALLONS = 500;   // Conservative estimate

// FUEL - PROPANE (Energy.gov, propane industry data)
// - 1 lb propane = 21,548 BTU
// - Standard 20lb tank = ~430,000 BTU
// - Camp stove uses ~5,000-20,000 BTU/hr
// - Cooking one meal: ~10,000 BTU (~0.5 lb propane)
const PROPANE_BTU_PER_LB = 21548;
const PROPANE_LBS_PER_MEAL = 0.5;            // ~10,000 BTU per cooked meal
const PROPANE_LBS_PER_DAY_HEATING = 3;       // For small portable heater

// FUEL - GASOLINE (DOE data)
// - 1 gallon gasoline = ~120,000 BTU
// - Generator uses 0.5-1 gallon/hour depending on load
// - Vehicle: ~25 miles per gallon average
const GASOLINE_BTU_PER_GALLON = 120000;
const GASOLINE_GALLONS_PER_GENERATOR_HOUR = 0.75;  // Average 3500W generator

// FUEL - BUTANE
// - Single 8oz butane canister = ~8,000 BTU
// - ~3-4 hours of cooking, ~5-8 meals
const BUTANE_CAN_MEALS = 6;

// ENERGY (Solar/Battery calculations)
// - Critical loads during outage: ~1000-2000Wh/day (fridge, lights, phones)
// - Minimum/survival: 500Wh/day (lights, phone charging only)
// - Average solar: 4-5 peak sun hours/day (varies by location)
const DAILY_CRITICAL_ENERGY_WH = 1500;       // Fridge + basics
const DAILY_MINIMUM_ENERGY_WH = 500;         // Survival minimum
const SOLAR_PEAK_SUN_HOURS = 4;              // Conservative average

/**
 * Run baseline simulation
 */
router.post('/run', async (req, res) => {
    try {
        const { scenario } = req.body;
        const userId = req.user.userId;

        if (!SCENARIOS[scenario]) {
            return res.status(400).json({ error: 'Invalid scenario' });
        }

        const data = await gatherUserData(userId);
        const results = runSimulation(scenario, data, null);

        res.json({ success: true, results });
    } catch (error) {
        console.error('Simulation error:', error);
        res.status(500).json({ error: 'Simulation failed' });
    }
});

/**
 * Run what-if simulation
 */
router.post('/whatif', async (req, res) => {
    try {
        const { scenario, adjustments } = req.body;
        const userId = req.user.userId;

        if (!SCENARIOS[scenario]) {
            return res.status(400).json({ error: 'Invalid scenario' });
        }

        const data = await gatherUserData(userId);
        const baselineResults = runSimulation(scenario, data, null);
        const whatIfResults = runSimulation(scenario, data, adjustments);

        res.json({
            success: true,
            baseline: baselineResults,
            whatif: whatIfResults,
            delta: calculateDelta(baselineResults, whatIfResults)
        });
    } catch (error) {
        console.error('What-if simulation error:', error);
        res.status(500).json({ error: 'What-if simulation failed' });
    }
});

/**
 * Gather all user data from database
 */
async function gatherUserData(userId) {
    // Gather pantry items
    const pantryResult = await db.query(
        `SELECT * FROM pantry_items WHERE user_id = $1 AND status != 'consumed'`,
        [userId]
    );

    // Gather inventory items
    const inventoryResult = await db.query(
        `SELECT i.*, c.name as category_name
         FROM inventory_items i
         LEFT JOIN inventory_categories c ON i.category_id = c.id
         WHERE i.user_id = $1`,
        [userId]
    );

    // Gather family profiles
    const familyResult = await db.query(
        `SELECT * FROM family_profiles WHERE user_id = $1`,
        [userId]
    );

    // Gather documents
    const documentsResult = await db.query(
        `SELECT * FROM family_documents WHERE user_id = $1`,
        [userId]
    );

    return {
        pantry: pantryResult.rows,
        inventory: inventoryResult.rows,
        family: familyResult.rows,
        documents: documentsResult.rows
    };
}

/**
 * Main simulation engine
 */
function runSimulation(scenarioKey, data, adjustments) {
    const scenario = SCENARIOS[scenarioKey];
    const duration = scenario.duration;

    // Apply adjustments if in what-if mode
    const adjustedData = adjustments ? applyAdjustments(data, adjustments) : data;

    // Run evaluations
    const familyEval = evaluateFamily(adjustedData.family, adjustments);
    const foodEval = evaluateFood(adjustedData.pantry, familyEval, scenario);
    const waterEval = evaluateWater(adjustedData.inventory, adjustedData.pantry, familyEval, scenario, adjustments);
    const energyEval = evaluateEnergy(adjustedData.inventory, scenario, adjustments);
    const fuelEval = evaluateFuel(adjustedData.inventory, scenario, adjustments);
    const medicalEval = evaluateMedical(adjustedData.inventory, adjustedData.documents, scenario, adjustments);
    const commsEval = evaluateComms(adjustedData.inventory, adjustedData.documents);
    const documentsEval = evaluateDocuments(adjustedData.documents, scenarioKey);

    // Calculate category scores (0-100)
    const categoryScores = {
        food: Math.min(100, (foodEval.daysSupply / duration) * 100),
        water: Math.min(100, (waterEval.daysSupply / duration) * 100),
        energy: scenario.requiresPower ? Math.min(100, (energyEval.daysSupply / duration) * 100) : 100,
        fuel: Math.min(100, (fuelEval.daysSupply / duration) * 100),
        medical: medicalEval.score,
        communications: commsEval.score,
        documents: documentsEval.score
    };

    // Calculate overall readiness score (weighted average)
    const weights = getScenarioWeights(scenarioKey);
    let totalWeight = 0;
    let weightedSum = 0;

    for (const [category, weight] of Object.entries(weights)) {
        weightedSum += (categoryScores[category] || 0) * weight;
        totalWeight += weight;
    }

    const readinessScore = Math.round(weightedSum / totalWeight);

    // Build timeline
    const timeline = buildTimeline(foodEval, waterEval, energyEval, fuelEval, scenario);

    // Identify failure points
    const failurePoints = identifyFailurePoints(foodEval, waterEval, energyEval, fuelEval, medicalEval, scenario);

    // Identify shortages
    const shortages = identifyShortages(foodEval, waterEval, energyEval, fuelEval, medicalEval, familyEval, scenario);

    // Generate recommendations
    const recommendations = generateRecommendations(shortages, failurePoints, scenario, familyEval);

    // Generate narrative
    const narrative = generateNarrative(scenarioKey, readinessScore, foodEval, waterEval, energyEval, fuelEval, medicalEval, familyEval, timeline);

    // Calculate survival days (minimum of critical resources)
    const survivalDays = Math.min(
        foodEval.daysSupply,
        waterEval.daysSupply,
        scenario.requiresPower ? Math.max(energyEval.daysSupply, 1) : Infinity
    );

    return {
        scenario: scenario.name,
        scenarioKey,
        duration,
        readinessScore,
        survivalDays: Math.round(survivalDays * 10) / 10,
        categoryScores,
        familySize: familyEval.totalPeople,
        timeline,
        failurePoints,
        shortages,
        recommendations,
        narrative,
        details: {
            food: foodEval,
            water: waterEval,
            energy: energyEval,
            fuel: fuelEval,
            medical: medicalEval,
            communications: commsEval,
            documents: documentsEval,
            family: familyEval
        }
    };
}

/**
 * Apply what-if adjustments to data
 * This function adds virtual items to represent the what-if scenario additions
 */
function applyAdjustments(data, adjustments) {
    const adjusted = JSON.parse(JSON.stringify(data)); // Deep clone

    // ===== FOOD ADJUSTMENTS =====
    // Add additional calories as virtual food supply
    if (adjustments.calories > 0) {
        adjusted.pantry.push({
            name: 'What-If: Additional Food Supply',
            calories_per_unit: adjustments.calories,
            quantity: 1,
            unit: 'lot',
            virtual: true
        });
    }

    // Add MRE days - each MRE provides ~1250 calories (3 MREs = 1 person-day)
    if (adjustments.mreDays > 0) {
        const familySize = adjusted.family.length || 1;
        const totalMREs = adjustments.mreDays * familySize * 3; // 3 MREs per person per day
        adjusted.pantry.push({
            name: 'What-If: MRE Supply',
            calories_per_unit: MRE_CALORIES,
            quantity: totalMREs,
            unit: 'meals',
            virtual: true
        });
    }

    // ===== WATER ADJUSTMENTS =====
    // Add water gallons as virtual inventory item
    if (adjustments.water > 0) {
        adjusted.inventory.push({
            name: 'What-If: Water Storage',
            quantity: adjustments.water,
            unit: 'gallons',
            category_name: 'water',
            virtual: true
        });
    }

    // Add water filters
    if (adjustments.filters > 0) {
        adjusted.inventory.push({
            name: 'What-If: Water Filter',
            quantity: adjustments.filters,
            unit: 'filters',
            category_name: 'water',
            notes: `${WATER_FILTER_CAPACITY_GALLONS} gallon capacity each`,
            virtual: true
        });
    }

    // ===== FUEL ADJUSTMENTS =====
    // Add propane (in lbs)
    if (adjustments.propane > 0) {
        adjusted.inventory.push({
            name: 'What-If: Propane',
            quantity: adjustments.propane,
            unit: 'lbs',
            category_name: 'fuel',
            virtual: true
        });
    }

    // Add gasoline (in gallons)
    if (adjustments.gasoline > 0) {
        adjusted.inventory.push({
            name: 'What-If: Gasoline',
            quantity: adjustments.gasoline,
            unit: 'gallons',
            category_name: 'fuel',
            virtual: true
        });
    }

    // ===== ENERGY ADJUSTMENTS =====
    // Add solar panels (in watts)
    if (adjustments.solar > 0) {
        adjusted.inventory.push({
            name: `What-If: Solar Panel ${adjustments.solar}W`,
            quantity: 1,
            unit: 'panels',
            category_name: 'energy',
            notes: `${adjustments.solar}Wh capacity`,
            virtual: true
        });
    }

    // Add battery storage (in Wh)
    if (adjustments.battery > 0) {
        adjusted.inventory.push({
            name: `What-If: Battery Storage ${adjustments.battery}Wh`,
            quantity: 1,
            unit: 'units',
            category_name: 'energy',
            notes: `${adjustments.battery}Wh capacity`,
            virtual: true
        });
    }

    // ===== MEDICAL ADJUSTMENTS =====
    // Add first aid kits
    if (adjustments.firstaid > 0) {
        adjusted.inventory.push({
            name: 'What-If: First Aid Kit',
            quantity: adjustments.firstaid,
            unit: 'kits',
            category_name: 'medical',
            virtual: true
        });
    }

    // Add prescription medication days
    if (adjustments.prescriptions > 0) {
        adjusted.inventory.push({
            name: 'What-If: Prescription Medications',
            quantity: adjustments.prescriptions,
            unit: 'days',
            category_name: 'medical',
            virtual: true
        });
    }

    // ===== FAMILY ADJUSTMENTS =====
    // Note: Family adjustments are handled separately in evaluateFamily()
    // This is intentional - we want to track them separately for proper calculations

    return adjusted;
}

/**
 * Evaluate family composition
 */
function evaluateFamily(familyProfiles, adjustments) {
    let adults = 0;
    let children = 0;
    let totalCaloriesNeeded = 0;
    const specialNeeds = [];

    for (const member of familyProfiles) {
        const age = member.age || calculateAge(member.birth_date);
        if (age >= 18) {
            adults++;
            totalCaloriesNeeded += member.calculated_tdee || CALORIES_PER_ADULT_PER_DAY;
        } else {
            children++;
            totalCaloriesNeeded += member.calculated_tdee || CALORIES_PER_CHILD_PER_DAY;
        }

        if (member.dietary_restrictions) {
            specialNeeds.push(`${member.name}: ${member.dietary_restrictions}`);
        }
        if (member.is_pregnant) {
            specialNeeds.push(`${member.name}: Pregnant - increased nutrition needs`);
            totalCaloriesNeeded += 300;
        }
        if (member.is_lactating) {
            specialNeeds.push(`${member.name}: Lactating - increased nutrition needs`);
            totalCaloriesNeeded += 500;
        }
    }

    // Apply what-if adjustments
    if (adjustments) {
        adults += adjustments.adults || 0;
        children += adjustments.children || 0;
        totalCaloriesNeeded += (adjustments.adults || 0) * CALORIES_PER_ADULT_PER_DAY;
        totalCaloriesNeeded += (adjustments.children || 0) * CALORIES_PER_CHILD_PER_DAY;
    }

    // Default to 1 adult if no family profiles
    if (adults === 0 && children === 0) {
        adults = 1;
        totalCaloriesNeeded = CALORIES_PER_ADULT_PER_DAY;
    }

    return {
        adults,
        children,
        totalPeople: adults + children,
        dailyCaloriesNeeded: totalCaloriesNeeded,
        dailyWaterNeeded: (adults + children) * WATER_GALLONS_PER_PERSON_PER_DAY,
        specialNeeds
    };
}

/**
 * Evaluate food supply
 */
function evaluateFood(pantryItems, familyEval, scenario) {
    let totalCalories = 0;
    let requiresCooking = 0;
    let requiresRefrigeration = 0;
    let spoiledItems = [];
    const expiringDuringScenario = [];
    const now = new Date();
    const scenarioEnd = new Date(now.getTime() + scenario.duration * 24 * 60 * 60 * 1000);

    for (const item of pantryItems) {
        const calories = (item.calories_per_unit || 0) * (item.quantity || 0);
        totalCalories += calories;

        // Check if requires cooking
        if (item.requires_cooking || item.category?.toLowerCase().includes('grain') || item.category?.toLowerCase().includes('rice')) {
            requiresCooking += calories;
        }

        // Check if requires refrigeration
        if (item.requires_refrigeration || item.category?.toLowerCase().includes('dairy') || item.category?.toLowerCase().includes('meat')) {
            requiresRefrigeration += calories;
        }

        // Check expiration
        if (item.expiration_date) {
            const expDate = new Date(item.expiration_date);
            if (expDate < now) {
                spoiledItems.push(item.name);
            } else if (expDate < scenarioEnd) {
                expiringDuringScenario.push({
                    name: item.name,
                    date: item.expiration_date,
                    calories
                });
            }
        }
    }

    // If no power, refrigerated items may spoil (after 4 hours typically)
    let effectiveCalories = totalCalories;
    if (scenario.requiresRefrigeration) {
        effectiveCalories = totalCalories - requiresRefrigeration;
    }

    const daysSupply = effectiveCalories / familyEval.dailyCaloriesNeeded;

    return {
        totalCalories,
        effectiveCalories,
        requiresCooking,
        requiresRefrigeration,
        daysSupply: Math.max(0, daysSupply),
        spoiledItems,
        expiringDuringScenario,
        dailyNeed: familyEval.dailyCaloriesNeeded
    };
}

/**
 * Evaluate water supply
 * Uses accurate measurements based on common container sizes
 */
function evaluateWater(inventory, pantry, familyEval, scenario, adjustments) {
    let totalGallons = 0;
    let purificationCapacity = 0;
    let hasFilters = false;
    let filterGallons = 0;

    // Check inventory for water and filters
    for (const item of inventory) {
        const nameLower = (item.name || '').toLowerCase();
        const catLower = (item.category_name || '').toLowerCase();
        const notesLower = (item.notes || '').toLowerCase();

        // Water detection - improved logic
        if (nameLower.includes('water') || catLower.includes('water')) {
            if (nameLower.includes('filter') || nameLower.includes('purif')) {
                // This is a filter, not stored water
                continue;
            }

            // Parse water quantity based on unit
            if (item.unit === 'gallons' || item.unit === 'gallon') {
                totalGallons += item.quantity || 0;
            } else if (item.unit === 'liters' || item.unit === 'liter') {
                totalGallons += (item.quantity || 0) / WATER_LITERS_PER_GALLON;
            } else if (item.unit === 'oz' || item.unit === 'ounces') {
                totalGallons += (item.quantity || 0) / 128; // 128 oz per gallon
            } else {
                // Try to parse from name/notes for common containers
                if (nameLower.includes('gallon') || notesLower.includes('gallon')) {
                    // Check for specific gallon sizes
                    const gallonMatch = (nameLower + ' ' + notesLower).match(/(\d+(?:\.\d+)?)\s*gallon/i);
                    if (gallonMatch) {
                        totalGallons += parseFloat(gallonMatch[1]) * (item.quantity || 1);
                    } else {
                        totalGallons += (item.quantity || 1); // Assume 1 gallon containers
                    }
                } else if (nameLower.includes('case') || nameLower.includes('pack')) {
                    // Case of water bottles - typically 24 x 16.9oz = ~3.17 gallons
                    totalGallons += (item.quantity || 1) * 3.17;
                } else if (nameLower.includes('bottle')) {
                    // Standard water bottles are 16.9oz (~0.132 gallons)
                    totalGallons += (item.quantity || 0) * WATER_BOTTLE_TO_GALLON;
                } else {
                    // Default: assume small container (0.25 gallon / 1 liter)
                    totalGallons += (item.quantity || 0) * 0.25;
                }
            }
        }

        // Filter/purification detection
        if (nameLower.includes('filter') || nameLower.includes('purif') ||
            nameLower.includes('lifestraw') || nameLower.includes('sawyer')) {
            hasFilters = true;

            // Try to parse filter capacity from notes
            const capacityMatch = (notesLower + ' ' + nameLower).match(/(\d+(?:,\d{3})*)\s*gallon/i);
            if (capacityMatch) {
                filterGallons += parseInt(capacityMatch[1].replace(',', '')) * (item.quantity || 1);
            } else if (nameLower.includes('lifestraw')) {
                filterGallons += 1000 * (item.quantity || 1); // LifeStraw: ~1000 gallons
            } else if (nameLower.includes('sawyer')) {
                filterGallons += 100000 * (item.quantity || 1); // Sawyer: ~100,000 gallons
            } else {
                filterGallons += WATER_FILTER_CAPACITY_GALLONS * (item.quantity || 1);
            }
        }
    }

    // Note: What-if adjustments are already applied via applyAdjustments()
    // The virtual items will be picked up in the loop above

    // Increase water needs for heat wave (50% more per FEMA guidelines)
    let dailyNeed = familyEval.dailyWaterNeeded;
    if (scenario.increasedWater) {
        dailyNeed *= 1.5;
    }

    // For water contamination scenarios, filters extend supply significantly
    let effectiveDaysSupply = totalGallons / dailyNeed;
    if (scenario.requiresWaterPurification && hasFilters && filterGallons > 0) {
        // With filters, can purify from other sources
        purificationCapacity = filterGallons;
        // Assume access to contaminated water source
        effectiveDaysSupply = Math.min(filterGallons / dailyNeed, 365);
    }

    return {
        totalGallons: Math.round(totalGallons * 100) / 100,
        dailyNeed: Math.round(dailyNeed * 100) / 100,
        daysSupply: Math.max(0, Math.round(effectiveDaysSupply * 10) / 10),
        hasFilters,
        filterGallons,
        purificationCapacity,
        requiresPurification: scenario.requiresWaterPurification
    };
}

/**
 * Evaluate energy supply
 * Based on realistic emergency power needs and solar/battery calculations
 */
function evaluateEnergy(inventory, scenario, adjustments) {
    let generatorWatts = 0;
    let solarWatts = 0;
    let batteryWh = 0;
    let hasGenerator = false;
    let hasSolar = false;

    for (const item of inventory) {
        const nameLower = (item.name || '').toLowerCase();
        const notesLower = (item.notes || '').toLowerCase();
        const combined = nameLower + ' ' + notesLower;

        // Generator detection
        if (nameLower.includes('generator')) {
            hasGenerator = true;
            // Try to parse watts from name or notes
            const wattsMatch = combined.match(/(\d+)\s*w(?:att)?/i);
            if (wattsMatch) {
                generatorWatts += parseInt(wattsMatch[1]) * (item.quantity || 1);
            } else {
                generatorWatts += 3500 * (item.quantity || 1); // Default assumption (common size)
            }
        }

        // Solar panel detection
        if (nameLower.includes('solar')) {
            hasSolar = true;
            const wattsMatch = combined.match(/(\d+)\s*w(?:att)?/i);
            if (wattsMatch) {
                solarWatts += parseInt(wattsMatch[1]) * (item.quantity || 1);
            } else {
                solarWatts += 100 * (item.quantity || 1); // Default 100W panel
            }
        }

        // Battery/power station detection
        if (nameLower.includes('battery') || nameLower.includes('power station') ||
            nameLower.includes('powerbank') || nameLower.includes('jackery') ||
            nameLower.includes('bluetti') || nameLower.includes('ecoflow') ||
            nameLower.includes('goal zero')) {
            // Try Wh first
            const whMatch = combined.match(/(\d+)\s*wh/i);
            if (whMatch) {
                batteryWh += parseInt(whMatch[1]) * (item.quantity || 1);
            } else {
                // Try Ah with voltage (common for lead-acid/lithium batteries)
                const ahMatch = combined.match(/(\d+)\s*ah/i);
                const voltMatch = combined.match(/(\d+)\s*v(?:olt)?/i);
                if (ahMatch && voltMatch) {
                    batteryWh += parseInt(ahMatch[1]) * parseInt(voltMatch[1]) * (item.quantity || 1);
                } else if (ahMatch) {
                    // Assume 12V if no voltage specified
                    batteryWh += parseInt(ahMatch[1]) * 12 * (item.quantity || 1);
                } else {
                    batteryWh += 500 * (item.quantity || 1); // Default small power bank
                }
            }
        }
    }

    // Note: What-if adjustments are applied via applyAdjustments() and picked up in loop

    // Calculate daily energy needs based on scenario
    // Critical needs: refrigerator (~1200Wh), lights (~100Wh), phone charging (~50Wh), misc (~150Wh)
    let dailyUsageWh = DAILY_CRITICAL_ENERGY_WH; // 1500Wh default
    if (!scenario.requiresRefrigeration) {
        dailyUsageWh = DAILY_MINIMUM_ENERGY_WH; // 500Wh without fridge
    }

    // Solar daily production (conservative: 4 peak sun hours average)
    const solarDailyWh = solarWatts * SOLAR_PEAK_SUN_HOURS;

    // Can solar alone sustain daily needs?
    const solarCanSustain = solarDailyWh >= dailyUsageWh;

    // Calculate days of supply
    let daysSupply = 0;

    if (solarCanSustain) {
        // Solar can fully sustain - effectively indefinite (capped at 365)
        daysSupply = 365;
    } else if (hasSolar && batteryWh > 0) {
        // Solar + battery: solar extends battery life
        // Net daily drain = daily usage - solar production
        const netDailyDrain = Math.max(0, dailyUsageWh - solarDailyWh);
        if (netDailyDrain > 0) {
            daysSupply = batteryWh / netDailyDrain;
        } else {
            daysSupply = 365;
        }
    } else if (batteryWh > 0) {
        // Battery only
        daysSupply = batteryWh / dailyUsageWh;
    } else if (hasGenerator) {
        // Generator only - depends on fuel (handled in fuel evaluation)
        // Assume generator can provide indefinite power if fuel available
        daysSupply = 30; // Placeholder - actual runtime depends on fuel
    }

    return {
        hasGenerator,
        hasSolar,
        generatorWatts,
        solarWatts,
        batteryWh,
        daysSupply: Math.max(0, Math.round(daysSupply * 10) / 10),
        dailyUsageWh,
        solarDailyWh,
        solarCanSustain
    };
}

/**
 * Evaluate fuel supply
 * Based on realistic fuel consumption rates
 */
function evaluateFuel(inventory, scenario, adjustments) {
    let propaneLbs = 0;
    let gasolineGallons = 0;
    let butaneCans = 0;
    let woodCords = 0;

    for (const item of inventory) {
        const nameLower = (item.name || '').toLowerCase();
        const notesLower = (item.notes || '').toLowerCase();

        // Propane detection
        if (nameLower.includes('propane')) {
            if (item.unit === 'lbs' || item.unit === 'lb' || item.unit === 'pounds') {
                propaneLbs += item.quantity || 0;
            } else if (item.unit === 'gallons' || item.unit === 'gallon') {
                // Propane: 4.2 lbs per gallon
                propaneLbs += (item.quantity || 0) * 4.2;
            } else {
                // Try to detect tank size from name
                if (nameLower.includes('1lb') || nameLower.includes('1 lb') || nameLower.includes('coleman')) {
                    propaneLbs += (item.quantity || 1) * 1; // 1lb camping canisters
                } else if (nameLower.includes('5 gallon') || nameLower.includes('5gal')) {
                    propaneLbs += (item.quantity || 1) * 21; // ~21 lbs in 5 gallon tank
                } else {
                    // Assume standard 20lb tank
                    propaneLbs += (item.quantity || 1) * 20;
                }
            }
        }

        // Gasoline detection
        if (nameLower.includes('gasoline') || nameLower.includes('gas can') ||
            nameLower.includes('fuel can') || nameLower.includes('jerry can')) {
            if (item.unit === 'gallons' || item.unit === 'gallon') {
                gasolineGallons += item.quantity || 0;
            } else if (item.unit === 'liters' || item.unit === 'liter') {
                gasolineGallons += (item.quantity || 0) / WATER_LITERS_PER_GALLON;
            } else {
                // Try to detect can size from name
                if (nameLower.includes('1 gallon') || nameLower.includes('1gal')) {
                    gasolineGallons += (item.quantity || 1) * 1;
                } else if (nameLower.includes('2 gallon') || nameLower.includes('2gal')) {
                    gasolineGallons += (item.quantity || 1) * 2;
                } else {
                    // Assume 5 gallon cans (most common)
                    gasolineGallons += (item.quantity || 1) * 5;
                }
            }
        }

        // Butane detection
        if (nameLower.includes('butane')) {
            butaneCans += item.quantity || 1;
        }

        // Firewood detection
        if (nameLower.includes('firewood') || nameLower.includes('wood') ||
            nameLower.includes('logs') || nameLower.includes('cord')) {
            if (item.unit === 'cords' || item.unit === 'cord') {
                woodCords += item.quantity || 0;
            } else if (item.unit === 'bundles' || item.unit === 'bundle') {
                // A bundle is roughly 0.01 cord
                woodCords += (item.quantity || 0) * 0.01;
            } else {
                // Default to partial cord
                woodCords += item.quantity || 0.125; // 1/8 cord
            }
        }
    }

    // Note: What-if adjustments are applied via applyAdjustments() and picked up in loop

    // Calculate cooking capacity
    // Propane: ~2 meals per pound (based on ~10,000 BTU per meal, 21,548 BTU per lb)
    const mealsFromPropane = propaneLbs / PROPANE_LBS_PER_MEAL;
    // Butane: ~6 meals per 8oz can
    const mealsFromButane = butaneCans * BUTANE_CAN_MEALS;
    const totalMeals = Math.round(mealsFromPropane + mealsFromButane);

    // Generator runtime from gasoline
    // Average 3500W generator uses ~0.75 gallon/hour at 50% load
    const generatorHours = Math.round(gasolineGallons / GASOLINE_GALLONS_PER_GENERATOR_HOUR);

    // Heating calculation
    // Propane heater: ~3 lbs/day for small space heater
    // Wood stove: ~1/7 cord per day in cold weather
    let heatingDays = Infinity;
    if (scenario.requiresHeating) {
        const propaneHeatingDays = propaneLbs / PROPANE_LBS_PER_DAY_HEATING;
        const woodHeatingDays = woodCords * 7; // 1 cord lasts ~7 days continuous use
        heatingDays = propaneHeatingDays + woodHeatingDays;
    }

    // Calculate overall fuel days supply
    // Based on cooking needs (3 meals per day) unless heating is more critical
    const cookingDays = totalMeals / 3;
    const daysSupply = scenario.requiresHeating
        ? Math.min(cookingDays, heatingDays)
        : cookingDays;

    return {
        propaneLbs: Math.round(propaneLbs * 10) / 10,
        gasolineGallons: Math.round(gasolineGallons * 10) / 10,
        butaneCans,
        woodCords: Math.round(woodCords * 100) / 100,
        totalMeals,
        mealsFromPropane: Math.round(mealsFromPropane),
        mealsFromButane: Math.round(mealsFromButane),
        generatorHours,
        heatingDays: heatingDays === Infinity ? Infinity : Math.round(heatingDays * 10) / 10,
        daysSupply: Math.max(0, Math.round(daysSupply * 10) / 10)
    };
}

/**
 * Evaluate medical preparedness
 */
function evaluateMedical(inventory, documents, scenario, adjustments) {
    let hasFirstAid = false;
    let firstAidKits = 0;
    let hasPrescriptions = false;
    let prescriptionDays = 0;
    let hasTraumaKit = false;
    let hasMedicalDocs = false;

    for (const item of inventory) {
        const nameLower = (item.name || '').toLowerCase();
        const catLower = (item.category_name || '').toLowerCase();

        if (nameLower.includes('first aid') || catLower.includes('medical')) {
            hasFirstAid = true;
            firstAidKits += item.quantity || 1;
        }

        if (nameLower.includes('trauma') || nameLower.includes('tourniquet') || nameLower.includes('quickclot')) {
            hasTraumaKit = true;
        }

        if (nameLower.includes('prescription') || nameLower.includes('medication')) {
            hasPrescriptions = true;
            prescriptionDays += (item.quantity || 30);
        }
    }

    // Check documents for medical guides
    for (const doc of documents) {
        const nameLower = (doc.name || '').toLowerCase();
        const catLower = (doc.category || '').toLowerCase();

        if (nameLower.includes('medical') || nameLower.includes('first aid') || catLower === 'medical') {
            hasMedicalDocs = true;
        }
    }

    // Apply adjustments
    if (adjustments) {
        firstAidKits += adjustments.firstaid || 0;
        if (firstAidKits > 0) hasFirstAid = true;
        prescriptionDays += adjustments.prescriptions || 0;
    }

    // Calculate score
    let score = 0;
    if (hasFirstAid) score += 30;
    if (firstAidKits >= 2) score += 10;
    if (hasTraumaKit) score += 20;
    if (hasPrescriptions || prescriptionDays > 0) score += 20;
    if (hasMedicalDocs) score += 10;
    if (scenario.requiresMedical && !hasFirstAid) score = Math.min(score, 20);

    return {
        hasFirstAid,
        firstAidKits,
        hasTraumaKit,
        hasPrescriptions,
        prescriptionDays,
        hasMedicalDocs,
        score: Math.min(100, score)
    };
}

/**
 * Evaluate communications
 */
function evaluateComms(inventory, documents) {
    let hasRadio = false;
    let hasHAM = false;
    let hasSolarCharger = false;
    let hasCommsPlan = false;

    for (const item of inventory) {
        const nameLower = (item.name || '').toLowerCase();

        if (nameLower.includes('radio')) {
            hasRadio = true;
            if (nameLower.includes('ham') || nameLower.includes('amateur') || nameLower.includes('baofeng')) {
                hasHAM = true;
            }
        }

        if (nameLower.includes('solar') && (nameLower.includes('charger') || nameLower.includes('panel'))) {
            hasSolarCharger = true;
        }
    }

    // Check documents
    for (const doc of documents) {
        const nameLower = (doc.name || '').toLowerCase();

        if (nameLower.includes('comm') || nameLower.includes('frequency') || nameLower.includes('ham license')) {
            hasCommsPlan = true;
        }
    }

    let score = 0;
    if (hasRadio) score += 40;
    if (hasHAM) score += 20;
    if (hasSolarCharger) score += 20;
    if (hasCommsPlan) score += 20;

    return {
        hasRadio,
        hasHAM,
        hasSolarCharger,
        hasCommsPlan,
        score: Math.min(100, score)
    };
}

/**
 * Evaluate documents preparedness
 */
function evaluateDocuments(documents, scenario) {
    const categories = {
        identification: false,
        insurance: false,
        medical: false,
        financial: false,
        property: false,
        emergency: false
    };

    for (const doc of documents) {
        const nameLower = (doc.name || '').toLowerCase();
        const catLower = (doc.category || '').toLowerCase();

        if (catLower === 'identification' || nameLower.includes('id') || nameLower.includes('passport') || nameLower.includes('license')) {
            categories.identification = true;
        }
        if (catLower === 'insurance' || nameLower.includes('insurance')) {
            categories.insurance = true;
        }
        if (catLower === 'medical' || nameLower.includes('medical') || nameLower.includes('prescription')) {
            categories.medical = true;
        }
        if (catLower === 'financial' || nameLower.includes('bank') || nameLower.includes('financial')) {
            categories.financial = true;
        }
        if (catLower === 'property' || nameLower.includes('deed') || nameLower.includes('title')) {
            categories.property = true;
        }
        if (nameLower.includes('emergency') || nameLower.includes('contact') || nameLower.includes('evacuation')) {
            categories.emergency = true;
        }
    }

    const completedCategories = Object.values(categories).filter(v => v).length;
    const score = Math.round((completedCategories / Object.keys(categories).length) * 100);

    return {
        categories,
        totalDocuments: documents.length,
        completedCategories,
        score
    };
}

/**
 * Get scenario-specific weights
 */
function getScenarioWeights(scenario) {
    const baseWeights = {
        food: 25,
        water: 25,
        energy: 15,
        fuel: 15,
        medical: 10,
        communications: 5,
        documents: 5
    };

    // Adjust weights based on scenario
    switch (scenario) {
        case 'water_contamination':
            return { ...baseWeights, water: 40, food: 20, energy: 10 };
        case 'medical_emergency':
            return { ...baseWeights, medical: 35, food: 20, water: 20, energy: 10, fuel: 5 };
        case 'winter_storm':
            return { ...baseWeights, fuel: 25, energy: 20, food: 20, water: 15 };
        case 'heat_wave':
            return { ...baseWeights, water: 35, energy: 20, food: 20 };
        case 'evacuation':
            return { ...baseWeights, documents: 15, food: 20, water: 20, fuel: 20, energy: 5 };
        case 'grid_down':
            return { ...baseWeights, energy: 25, fuel: 20, food: 20, water: 20 };
        default:
            return baseWeights;
    }
}

/**
 * Build event timeline
 */
function buildTimeline(food, water, energy, fuel, scenario) {
    const events = [];
    const duration = scenario.duration;

    // Food depletion
    if (food.daysSupply < duration) {
        events.push({
            day: Math.ceil(food.daysSupply),
            event: 'Food supply depleted',
            severity: 'critical',
            category: 'food'
        });
    }

    // Water depletion
    if (water.daysSupply < duration) {
        events.push({
            day: Math.ceil(water.daysSupply),
            event: 'Water supply depleted',
            severity: 'critical',
            category: 'water'
        });
    }

    // Refrigeration failure (if power outage)
    if (scenario.requiresRefrigeration) {
        events.push({
            day: 0,
            event: 'Refrigeration fails - perishables begin spoiling',
            severity: 'warning',
            category: 'food'
        });
    }

    // Energy depletion
    if (scenario.requiresPower && energy.daysSupply < duration && !energy.solarCanSustain) {
        events.push({
            day: Math.ceil(energy.daysSupply),
            event: 'Battery/backup power depleted',
            severity: 'warning',
            category: 'energy'
        });
    }

    // Fuel depletion
    if (fuel.daysSupply < duration) {
        events.push({
            day: Math.ceil(fuel.daysSupply),
            event: 'Cooking fuel exhausted',
            severity: 'warning',
            category: 'fuel'
        });
    }

    // Sort by day
    events.sort((a, b) => a.day - b.day);

    return events;
}

/**
 * Identify failure points
 */
function identifyFailurePoints(food, water, energy, fuel, medical, scenario) {
    const failures = [];

    if (food.daysSupply < 1) {
        failures.push({
            category: 'Food',
            message: 'Insufficient food supply - less than 1 day available',
            severity: 'critical'
        });
    }

    if (water.daysSupply < 1) {
        failures.push({
            category: 'Water',
            message: 'Insufficient water supply - less than 1 day available',
            severity: 'critical'
        });
    }

    if (scenario.requiresPower && energy.daysSupply < 1 && !energy.hasSolar) {
        failures.push({
            category: 'Energy',
            message: 'No backup power available',
            severity: 'critical'
        });
    }

    if (!medical.hasFirstAid) {
        failures.push({
            category: 'Medical',
            message: 'No first aid kit detected',
            severity: 'warning'
        });
    }

    if (scenario.requiresHeating && fuel.heatingDays < scenario.duration) {
        failures.push({
            category: 'Heating',
            message: `Heating fuel will run out on day ${Math.ceil(fuel.heatingDays)}`,
            severity: 'critical'
        });
    }

    return failures;
}

/**
 * Identify shortages
 */
function identifyShortages(food, water, energy, fuel, medical, family, scenario) {
    const shortages = [];
    const duration = scenario.duration;

    // Food shortage
    const foodDeficit = (duration - food.daysSupply) * family.dailyCaloriesNeeded;
    if (foodDeficit > 0) {
        shortages.push({
            item: 'Food (calories)',
            have: Math.round(food.totalCalories),
            need: Math.round(duration * family.dailyCaloriesNeeded),
            deficit: Math.round(foodDeficit),
            unit: 'calories'
        });
    }

    // Water shortage
    const waterDeficit = (duration - water.daysSupply) * family.dailyWaterNeeded;
    if (waterDeficit > 0) {
        shortages.push({
            item: 'Water',
            have: Math.round(water.totalGallons * 10) / 10,
            need: Math.round(duration * family.dailyWaterNeeded * 10) / 10,
            deficit: Math.round(waterDeficit * 10) / 10,
            unit: 'gallons'
        });
    }

    // Fuel shortage for cooking
    const mealsNeeded = duration * 3 * family.totalPeople;
    if (fuel.totalMeals < mealsNeeded) {
        shortages.push({
            item: 'Cooking fuel',
            have: fuel.totalMeals,
            need: mealsNeeded,
            deficit: mealsNeeded - fuel.totalMeals,
            unit: 'meals worth'
        });
    }

    // Medical supplies
    if (!medical.hasFirstAid) {
        shortages.push({
            item: 'First Aid Kit',
            have: 0,
            need: 1,
            deficit: 1,
            unit: 'kits'
        });
    }

    return shortages;
}

/**
 * Generate recommendations
 * Provides specific, actionable recommendations based on shortages and scenario
 */
function generateRecommendations(shortages, failures, scenario, family) {
    const recommendations = [];

    // Process each shortage with specific, quantified recommendations
    for (const shortage of shortages) {
        if (shortage.item === 'Food (calories)') {
            const daysShort = Math.ceil(shortage.deficit / family.dailyCaloriesNeeded);
            const caloriesPerPerson = Math.round(shortage.deficit / family.totalPeople);

            // Suggest specific food items with quantities
            const riceNeeded = Math.ceil(shortage.deficit / 1650 / 2); // ~1650 cal per lb dry rice, 2lb bags common
            const cannedGoodsNeeded = Math.ceil(shortage.deficit / 400); // ~400 cal per can average
            const mreNeeded = Math.ceil(shortage.deficit / MRE_CALORIES);

            recommendations.push({
                priority: 'high',
                category: 'Food',
                action: `Add ${daysShort} more days of food supply (${Math.round(shortage.deficit / 1000)}k calories)`,
                details: `Options: ${riceNeeded} x 2lb bags of rice ($${riceNeeded * 3}), OR ${cannedGoodsNeeded} canned goods ($${cannedGoodsNeeded * 2}), OR ${mreNeeded} MREs ($${mreNeeded * 8-12}). Focus on shelf-stable, high-calorie foods.`
            });
        }

        if (shortage.item === 'Water') {
            const gallonsShort = Math.round(shortage.deficit * 10) / 10;

            // Calculate water storage options
            const casesOf24 = Math.ceil(gallonsShort / 3.17); // 24-pack of 16.9oz = 3.17 gal
            const oneGallonJugs = Math.ceil(gallonsShort);
            const fiveGallonContainers = Math.ceil(gallonsShort / 5);

            recommendations.push({
                priority: 'high',
                category: 'Water',
                action: `Store ${gallonsShort} more gallons of water`,
                details: `FEMA recommends 1 gallon/person/day. Options: ${casesOf24} cases of bottled water ($${casesOf24 * 5}), ${oneGallonJugs} 1-gallon jugs ($${oneGallonJugs * 1.50}), or ${fiveGallonContainers} 5-gallon containers ($${fiveGallonContainers * 12}). Also consider a water filter ($20-50) for backup.`
            });
        }

        if (shortage.item === 'Cooking fuel') {
            const mealsShort = shortage.deficit;
            const propaneNeeded = Math.ceil(mealsShort * PROPANE_LBS_PER_MEAL);
            const butaneNeeded = Math.ceil(mealsShort / BUTANE_CAN_MEALS);
            const propaneTanks = Math.ceil(propaneNeeded / 20);

            recommendations.push({
                priority: 'medium',
                category: 'Fuel',
                action: `Add fuel for ${mealsShort} more cooked meals`,
                details: `Options: ${propaneTanks} standard 20lb propane tank(s) ($${propaneTanks * 50}) with camp stove, OR ${butaneNeeded} butane canisters ($${butaneNeeded * 3}) with portable burner. Note: Some foods can be eaten without cooking.`
            });
        }

        if (shortage.item === 'First Aid Kit') {
            recommendations.push({
                priority: 'high',
                category: 'Medical',
                action: 'Acquire a comprehensive first aid kit',
                details: 'Get a 200+ piece kit ($25-50) with bandages, antiseptic, pain relievers, and basic trauma supplies. Consider adding: tourniquet, Israeli bandage, and emergency blankets for serious situations.'
            });
        }
    }

    // Add scenario-specific recommendations based on failures
    for (const failure of failures) {
        if (failure.category === 'Energy' && scenario.requiresPower) {
            recommendations.push({
                priority: 'medium',
                category: 'Energy',
                action: 'Add backup power solution',
                details: `For ${scenario.duration} days: Consider a ${Math.ceil(DAILY_CRITICAL_ENERGY_WH * scenario.duration / 1000)}kWh power station ($${Math.ceil(DAILY_CRITICAL_ENERGY_WH * scenario.duration / 100)}), OR ${Math.ceil(DAILY_CRITICAL_ENERGY_WH / SOLAR_PEAK_SUN_HOURS)}W solar panel ($${Math.ceil(DAILY_CRITICAL_ENERGY_WH / 2)}) with battery. Generator option: 3500W with ${Math.ceil(scenario.duration * 8 * GASOLINE_GALLONS_PER_GENERATOR_HOUR)} gallons fuel.`
            });
        }

        if (failure.category === 'Heating' && scenario.requiresHeating) {
            const propaneNeeded = Math.ceil(scenario.duration * PROPANE_LBS_PER_DAY_HEATING);
            recommendations.push({
                priority: 'high',
                category: 'Heating',
                action: `Add heating fuel for ${scenario.duration} days`,
                details: `Need ~${propaneNeeded} lbs propane (${Math.ceil(propaneNeeded / 20)} 20lb tanks, $${Math.ceil(propaneNeeded / 20) * 50}) with portable heater, OR ~${Math.round(scenario.duration / 7 * 10) / 10} cords of firewood if you have a wood stove. Also: thermal blankets, sleeping bags rated to 0°F.`
            });
        }
    }

    // Additional scenario-specific recommendations
    if (scenario.requiresWaterPurification && !shortages.some(s => s.item === 'Water')) {
        // Even if water is sufficient, recommend filters for contamination scenario
        recommendations.push({
            priority: 'medium',
            category: 'Water',
            action: 'Ensure water purification capability',
            details: 'For water contamination scenarios, have multiple purification methods: Water filter (LifeStraw $20, Sawyer Mini $25), purification tablets ($10), and/or ability to boil water. Store 1 gallon bleach for emergency purification (8 drops per gallon).'
        });
    }

    if (scenario.mobile && scenario.name.includes('Evacuation')) {
        recommendations.push({
            priority: 'high',
            category: 'Planning',
            action: 'Prepare grab-and-go bag (Bug Out Bag)',
            details: `Pack max ${scenario.weightLimit || 50} lbs: 3 days food/water, first aid, important documents, flashlight, radio, phone charger, cash, change of clothes, medications. Keep bag ready and vehicle fuel tank above half.`
        });
    }

    if (scenario.noExternalHelp) {
        recommendations.push({
            priority: 'medium',
            category: 'Communications',
            action: 'Establish backup communication plan',
            details: 'Battery/crank-powered AM/FM/NOAA radio ($30-50) for emergency broadcasts. Consider HAM radio license and handheld transceiver ($35) for long-range communication when cell towers are down.'
        });
    }

    // Sort by priority
    recommendations.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return recommendations;
}

/**
 * Generate narrative summary
 */
function generateNarrative(scenarioKey, score, food, water, energy, fuel, medical, family, timeline) {
    const scenario = SCENARIOS[scenarioKey];
    let narrative = '';

    // Opening
    if (score >= 80) {
        narrative = `Your household is well-prepared for a ${scenario.name} scenario. `;
    } else if (score >= 60) {
        narrative = `Your household is moderately prepared for a ${scenario.name} scenario, but has some gaps. `;
    } else if (score >= 40) {
        narrative = `Your household has significant preparedness gaps for a ${scenario.name} scenario. `;
    } else {
        narrative = `Your household is critically underprepared for a ${scenario.name} scenario. Immediate action needed. `;
    }

    // Family context
    narrative += `\n\nWith ${family.totalPeople} people (${family.adults} adults, ${family.children} children), `;
    narrative += `your household requires ${Math.round(family.dailyCaloriesNeeded)} calories and ${family.dailyWaterNeeded} gallons of water per day.\n\n`;

    // Food assessment
    narrative += `**Food:** `;
    if (food.daysSupply >= scenario.duration) {
        narrative += `You have sufficient food for ${Math.round(food.daysSupply)} days, exceeding the scenario duration. `;
    } else {
        narrative += `Food supplies will last only ${Math.round(food.daysSupply * 10) / 10} days - ${Math.round(scenario.duration - food.daysSupply)} days short. `;
    }
    if (food.requiresRefrigeration > 0 && scenario.requiresRefrigeration) {
        narrative += `Warning: ${Math.round(food.requiresRefrigeration / food.totalCalories * 100)}% of your food requires refrigeration and may spoil. `;
    }

    // Water assessment
    narrative += `\n\n**Water:** `;
    if (water.daysSupply >= scenario.duration) {
        narrative += `Water supply of ${Math.round(water.totalGallons)} gallons is adequate. `;
    } else {
        narrative += `Water supply will last ${Math.round(water.daysSupply * 10) / 10} days - critical shortage expected. `;
    }
    if (water.hasFilters) {
        narrative += `Water filtration available. `;
    }

    // Energy assessment
    if (scenario.requiresPower) {
        narrative += `\n\n**Energy:** `;
        if (energy.solarCanSustain) {
            narrative += `Solar power system can sustain basic needs. `;
        } else if (energy.daysSupply > 0) {
            narrative += `Backup power available for approximately ${Math.round(energy.daysSupply)} days. `;
        } else {
            narrative += `No backup power available - critical vulnerability. `;
        }
    }

    // Timeline events
    if (timeline.length > 0) {
        narrative += `\n\n**Critical Events:**\n`;
        for (const event of timeline.slice(0, 5)) {
            narrative += `- Day ${event.day}: ${event.event}\n`;
        }
    }

    return narrative;
}

/**
 * Calculate delta between baseline and what-if
 */
function calculateDelta(baseline, whatif) {
    return {
        readinessChange: whatif.readinessScore - baseline.readinessScore,
        survivalDaysChange: whatif.survivalDays - baseline.survivalDays,
        categoryChanges: {
            food: whatif.categoryScores.food - baseline.categoryScores.food,
            water: whatif.categoryScores.water - baseline.categoryScores.water,
            energy: whatif.categoryScores.energy - baseline.categoryScores.energy,
            fuel: whatif.categoryScores.fuel - baseline.categoryScores.fuel,
            medical: whatif.categoryScores.medical - baseline.categoryScores.medical,
            communications: whatif.categoryScores.communications - baseline.categoryScores.communications,
            documents: whatif.categoryScores.documents - baseline.categoryScores.documents
        }
    };
}

/**
 * Calculate age from birth date
 */
function calculateAge(birthDate) {
    if (!birthDate) return 30; // Default adult age
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

module.exports = router;
