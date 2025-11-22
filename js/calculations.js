/**
 * SPS Calculations & Formulas Module
 * All calculations run client-side for offline capability
 */

// Calculation history storage
let calculationHistory = JSON.parse(localStorage.getItem('sps_calc_history') || '[]');

// ================================
// HELP SYSTEM
// ================================

// Help content loaded from JSON file (with inline fallback)
let calculatorHelp = {};

// Load help content from JSON file
async function loadCalculatorHelp() {
    try {
        const response = await fetch('/data/calculator-help.json');
        if (response.ok) {
            calculatorHelp = await response.json();
            console.log('[Calculations] Loaded help content from JSON file');
        }
    } catch (err) {
        console.warn('[Calculations] Could not load help JSON, using built-in content:', err);
    }
    // Merge with any inline fallback content
    calculatorHelp = { ...calculatorHelpFallback, ...calculatorHelp };
}

// Fallback help content (in case JSON fails to load)
const calculatorHelpFallback = {
    'daily-calories': {
        title: 'How to Calculate Daily Calories',
        sections: [
            {
                heading: 'What This Calculates',
                content: 'This tells you how many calories (energy from food) your body needs each day to stay healthy and active.'
            },
            {
                heading: 'The Formula (Mifflin-St Jeor Equation)',
                formula: 'For Boys/Men: BMR = (10 × weight in kg) + (6.25 × height in cm) - (5 × age) + 5\nFor Girls/Women: BMR = (10 × weight in kg) + (6.25 × height in cm) - (5 × age) - 161'
            },
            {
                heading: 'Step-by-Step on Paper',
                steps: [
                    'Write down your weight in kilograms (kg). If you know pounds, divide by 2.2',
                    'Write down your height in centimeters (cm). If you know inches, multiply by 2.54',
                    'Multiply your weight by 10',
                    'Multiply your height by 6.25',
                    'Multiply your age by 5',
                    'Add step 3 + step 4',
                    'Subtract step 5 from that total',
                    'Add 5 if male, subtract 161 if female. This is your BMR!',
                    'Multiply BMR by activity level (1.2 for sitting, 1.55 for moderate activity, 1.9 for hard work)'
                ]
            },
            {
                heading: 'Example',
                example: {
                    title: 'A 12-year-old boy, 40kg, 150cm tall, moderate activity:',
                    steps: '(10 × 40) + (6.25 × 150) - (5 × 12) + 5 = 400 + 937.5 - 60 + 5 = 1282.5 BMR\n1282.5 × 1.55 = 1,988 calories per day'
                }
            }
        ]
    },
    'ration-planning': {
        title: 'How to Calculate Food Rations',
        sections: [
            {
                heading: 'What This Calculates',
                content: 'This helps you figure out how much food you need to store for your family for a certain number of days.'
            },
            {
                heading: 'The Formula',
                formula: 'Total Calories Needed = People × Days × Calories per Person per Day'
            },
            {
                heading: 'Step-by-Step on Paper',
                steps: [
                    'Count how many people need food',
                    'Decide how many days you want to plan for',
                    'Pick calories per person (usually 2000 for normal, 1500 for survival)',
                    'Multiply: People × Days × Calories',
                    'To find pounds of food: divide total calories by 1500 (average calories per pound of dried food)'
                ]
            },
            {
                heading: 'Example',
                example: {
                    title: '4 people for 30 days at 2000 calories each:',
                    steps: '4 × 30 × 2000 = 240,000 total calories\n240,000 ÷ 1500 = 160 pounds of food needed'
                }
            }
        ]
    },
    'supply-duration': {
        title: 'How Long Will Food Last?',
        sections: [
            {
                heading: 'What This Calculates',
                content: 'If you know how many calories of food you have stored, this tells you how many days it will last your family.'
            },
            {
                heading: 'The Formula',
                formula: 'Days of Food = Total Calories ÷ (People × Daily Calories per Person)'
            },
            {
                heading: 'Step-by-Step on Paper',
                steps: [
                    'Add up all the calories in your food storage',
                    'Count how many people will eat the food',
                    'Decide daily calories per person (usually 2000)',
                    'Multiply people × daily calories to get "daily need"',
                    'Divide total calories by daily need = days of food'
                ]
            },
            {
                heading: 'Example',
                example: {
                    title: '500,000 calories stored, 4 people eating 2000 cal/day:',
                    steps: 'Daily need = 4 × 2000 = 8000 calories per day\n500,000 ÷ 8000 = 62.5 days of food'
                }
            }
        ]
    },
    'water-needs': {
        title: 'How Much Water Do You Need?',
        sections: [
            {
                heading: 'What This Calculates',
                content: 'This tells you how many gallons of water your group needs to survive, based on climate and activity.'
            },
            {
                heading: 'The Formula',
                formula: 'Daily Water = People × Gallons per Person × Climate Multiplier'
            },
            {
                heading: 'Step-by-Step on Paper',
                steps: [
                    'Count number of people',
                    'Start with 1 gallon per person per day (minimum)',
                    'If hot weather, multiply by 1.5',
                    'If doing hard work, multiply by 2',
                    'Add 0.5 gallons per person for cooking',
                    'Multiply by number of days to store'
                ]
            },
            {
                heading: 'Tip',
                tip: 'A gallon is about 4 liters. You can measure with any container - 4 large water bottles = 1 gallon!'
            }
        ]
    },
    'solar-panel': {
        title: 'How to Size Solar Panels',
        sections: [
            {
                heading: 'What This Calculates',
                content: 'This helps you figure out how many watts of solar panels you need to power your devices.'
            },
            {
                heading: 'The Formula',
                formula: 'Panel Watts = (Daily Watt-hours needed) ÷ (Sun Hours × 0.8 efficiency)'
            },
            {
                heading: 'Step-by-Step on Paper',
                steps: [
                    'List each device and its watts (look on the label)',
                    'Write how many hours per day you use each device',
                    'Multiply watts × hours for each device = watt-hours',
                    'Add all watt-hours together = daily watt-hours',
                    'Find your sun hours (usually 4-6 hours)',
                    'Divide daily watt-hours by (sun hours × 0.8)',
                    'This is the watts of solar panels you need'
                ]
            },
            {
                heading: 'Example',
                example: {
                    title: 'LED light (10W for 6 hours) + Radio (5W for 4 hours), 5 sun hours:',
                    steps: 'LED: 10 × 6 = 60 Wh\nRadio: 5 × 4 = 20 Wh\nTotal: 80 Wh per day\nPanels needed: 80 ÷ (5 × 0.8) = 80 ÷ 4 = 20 watts of solar panels'
                }
            }
        ]
    },
    'battery-bank': {
        title: 'How to Size a Battery Bank',
        sections: [
            {
                heading: 'What This Calculates',
                content: 'This tells you how big your batteries need to be to store enough power for your needs.'
            },
            {
                heading: 'The Formula',
                formula: 'Battery Amp-hours = (Daily Wh) ÷ Battery Voltage ÷ Depth of Discharge × Days of Backup'
            },
            {
                heading: 'Step-by-Step on Paper',
                steps: [
                    'Calculate your daily watt-hours needed',
                    'Choose how many days of backup you want (usually 1-3)',
                    'Multiply daily Wh × backup days',
                    'Divide by battery voltage (usually 12V)',
                    'Divide by 0.5 (to not damage batteries, only use half)',
                    'This is your Amp-hour rating needed'
                ]
            },
            {
                heading: 'Example',
                example: {
                    title: '500 Wh per day, 2 days backup, 12V battery:',
                    steps: 'Total Wh: 500 × 2 = 1000 Wh\nBasic Ah: 1000 ÷ 12 = 83 Ah\nWith 50% depth: 83 ÷ 0.5 = 166 Ah battery needed'
                }
            }
        ]
    },
    'power-load': {
        title: 'How to Calculate Power Load',
        sections: [
            {
                heading: 'What This Calculates',
                content: 'This adds up all your electrical devices to find how much power you use per day in watt-hours.'
            },
            {
                heading: 'The Formula',
                formula: 'Daily Watt-hours = (Watts × Hours × Quantity) for each device, then add them all'
            },
            {
                heading: 'Step-by-Step on Paper',
                steps: [
                    'Make a list of every electrical device you use',
                    'Find the watts for each (look on the label or charger)',
                    'Estimate hours used per day for each',
                    'For each device: Watts × Hours × Quantity = Watt-hours',
                    'Add all the watt-hours together',
                    'This is your daily energy use!'
                ]
            },
            {
                heading: 'Example',
                example: {
                    title: '5 LED lights (10W, 6hr) + 1 Fridge (150W, 8hr) + 1 Radio (20W, 4hr):',
                    steps: 'LEDs: 10 × 6 × 5 = 300 Wh\nFridge: 150 × 8 × 1 = 1200 Wh\nRadio: 20 × 4 × 1 = 80 Wh\nTotal: 300 + 1200 + 80 = 1,580 Wh per day'
                }
            },
            {
                heading: 'Tip',
                tip: 'Watts = how powerful something is. Watt-hours = how much energy it uses over time. Like a faucet (watts) vs total water used (watt-hours)!'
            }
        ]
    },
    'percentage': {
        title: 'How to Calculate Percentages',
        sections: [
            {
                heading: 'What This Calculates',
                content: 'Percentages help you find parts of a whole, like "what is 20% of 150?" or "15 is what percent of 60?"'
            },
            {
                heading: 'The Formulas',
                formula: 'X% of Y = (X ÷ 100) × Y\nX is what % of Y = (X ÷ Y) × 100\n% Change = ((New - Old) ÷ Old) × 100'
            },
            {
                heading: 'Step-by-Step on Paper',
                steps: [
                    'For "X% of Y": Divide X by 100, then multiply by Y',
                    'For "X is what % of Y": Divide X by Y, then multiply by 100',
                    'For "% change": Subtract old from new, divide by old, multiply by 100'
                ]
            },
            {
                heading: 'Example',
                example: {
                    title: 'What is 25% of 80?',
                    steps: '25 ÷ 100 = 0.25\n0.25 × 80 = 20\nSo 25% of 80 is 20!'
                }
            }
        ]
    },
    'compound-interest': {
        title: 'How Compound Interest Works',
        sections: [
            {
                heading: 'What This Calculates',
                content: 'This shows how money grows over time when you earn interest on your interest. It\'s like a snowball getting bigger!'
            },
            {
                heading: 'The Formula',
                formula: 'Final Amount = Principal × (1 + Rate/n)^(n×Years)\nWhere n = times compounded per year'
            },
            {
                heading: 'Step-by-Step on Paper',
                steps: [
                    'Write your starting amount (Principal)',
                    'Convert interest rate to decimal (5% = 0.05)',
                    'Divide rate by times compounded (yearly=1, monthly=12)',
                    'Add 1 to that number',
                    'Multiply years × times compounded',
                    'Raise step 4 to the power of step 5 (use calculator)',
                    'Multiply Principal by that result'
                ]
            },
            {
                heading: 'Example',
                example: {
                    title: '$1000 at 5% for 3 years, compounded yearly:',
                    steps: 'Rate: 0.05/1 = 0.05\n1 + 0.05 = 1.05\nPower: 1 × 3 = 3\n1.05³ = 1.157625\n$1000 × 1.157625 = $1,157.63'
                }
            }
        ]
    },
    'gear-ratio': {
        title: 'How Gear Ratios Work',
        sections: [
            {
                heading: 'What This Calculates',
                content: 'Gears trade speed for power. This tells you how much faster or stronger a machine gets with different gear sizes.'
            },
            {
                heading: 'The Formula',
                formula: 'Gear Ratio = Driven Gear Teeth ÷ Drive Gear Teeth\nOutput RPM = Input RPM ÷ Gear Ratio'
            },
            {
                heading: 'Step-by-Step on Paper',
                steps: [
                    'Count teeth on the driving gear (the one connected to the motor)',
                    'Count teeth on the driven gear (the one doing the work)',
                    'Divide driven teeth by drive teeth = gear ratio',
                    'If ratio > 1: more power, less speed',
                    'If ratio < 1: more speed, less power',
                    'To find output speed: divide input RPM by gear ratio'
                ]
            },
            {
                heading: 'Example',
                example: {
                    title: 'Drive gear has 20 teeth, driven gear has 60 teeth:',
                    steps: 'Ratio: 60 ÷ 20 = 3:1\nThis means 3× more torque (power), 3× slower speed\nIf motor spins 900 RPM: 900 ÷ 3 = 300 RPM output'
                }
            }
        ]
    },
    'wind-chill': {
        title: 'How to Calculate Wind Chill',
        sections: [
            {
                heading: 'What This Calculates',
                content: 'Wind makes cold air feel even colder. This tells you what temperature it "feels like" when the wind is blowing.'
            },
            {
                heading: 'The Formula (NWS)',
                formula: 'Wind Chill = 35.74 + 0.6215T - 35.75V^0.16 + 0.4275T × V^0.16\nT = temperature (°F), V = wind speed (mph)'
            },
            {
                heading: 'Simple Estimation',
                steps: [
                    'For every 5 mph of wind, it feels about 3°F colder',
                    'At 10°F with 20mph wind: feels like about -10°F',
                    'Below 0°F wind chill: risk of frostbite in 30 minutes',
                    'Below -20°F wind chill: frostbite in 10 minutes!'
                ]
            },
            {
                heading: 'Tip',
                tip: 'Always check wind chill before going outside in winter. Cover all exposed skin when wind chill is below 0°F!'
            }
        ]
    },
    'bread-dough': {
        title: 'How to Calculate Bread Dough (Baker\'s Percentage)',
        sections: [
            {
                heading: 'What This Calculates',
                content: 'Bakers measure ingredients as a percentage of flour weight. This helps you scale recipes up or down perfectly!'
            },
            {
                heading: 'The Formula',
                formula: 'Ingredient Amount = Flour Weight × (Ingredient % ÷ 100)\nCommon: Flour=100%, Water=60-75%, Salt=2%, Yeast=1%'
            },
            {
                heading: 'Step-by-Step on Paper',
                steps: [
                    'Start with your flour weight (this is always 100%)',
                    'For water at 65%: multiply flour × 0.65',
                    'For salt at 2%: multiply flour × 0.02',
                    'For yeast at 1%: multiply flour × 0.01',
                    'Add all weights together for total dough weight'
                ]
            },
            {
                heading: 'Example',
                example: {
                    title: '500g flour, 65% hydration, 2% salt:',
                    steps: 'Flour: 500g (100%)\nWater: 500 × 0.65 = 325g\nSalt: 500 × 0.02 = 10g\nYeast: 500 × 0.01 = 5g\nTotal dough: 500 + 325 + 10 + 5 = 840g'
                }
            }
        ]
    },
    'rope-strength': {
        title: 'How to Calculate Rope Safe Working Load',
        sections: [
            {
                heading: 'What This Calculates',
                content: 'Rope can hold a lot, but you should only use a fraction of its strength to be safe. This calculates how much you can safely lift.'
            },
            {
                heading: 'The Formula',
                formula: 'Safe Working Load = Breaking Strength ÷ Safety Factor\nBreaking Strength = Rope Area × Material Strength'
            },
            {
                heading: 'Step-by-Step on Paper',
                steps: [
                    'Find the rope diameter in inches',
                    'Calculate area: π × (diameter/2)² = area in square inches',
                    'Multiply area by material strength (manila=8000, nylon=12000 psi)',
                    'This gives breaking strength',
                    'Divide by safety factor (usually 5 for lifting people, 4 for loads)',
                    'Result is safe working load in pounds'
                ]
            },
            {
                heading: 'Tip',
                tip: 'Knots reduce rope strength by 50%! Always use twice as strong a rope when knots are involved.'
            }
        ]
    },
    'sandbags': {
        title: 'How to Calculate Sandbag Needs',
        sections: [
            {
                heading: 'What This Calculates',
                content: 'This tells you how many sandbags you need to build a protective wall of a certain size.'
            },
            {
                heading: 'The Formula',
                formula: 'Bags = (Length ÷ 0.65m) × (Height ÷ 0.15m) × Thickness × 1.1'
            },
            {
                heading: 'Step-by-Step on Paper',
                steps: [
                    'Measure wall length in meters',
                    'Decide wall height in meters',
                    'Choose thickness (how many bags deep: 1, 2, or 3)',
                    'Bags per row: length ÷ 0.65 (a filled bag is ~26 inches long)',
                    'Number of layers: height ÷ 0.15 (filled bags are ~6 inches high)',
                    'Multiply: rows × layers × thickness',
                    'Add 10% extra for overlap and waste'
                ]
            },
            {
                heading: 'Example',
                example: {
                    title: '10m wall, 1m high, 2 bags thick:',
                    steps: 'Bags per row: 10 ÷ 0.65 = 16 bags\nLayers: 1 ÷ 0.15 = 7 layers\nTotal: 16 × 7 × 2 = 224 bags\nWith 10% extra: 224 × 1.1 = 247 bags'
                }
            }
        ]
    }
};

// Show help modal
function showCalcHelp(calcId) {
    const help = calculatorHelp[calcId];
    if (!help) {
        alert('Help content coming soon for this calculator!');
        return;
    }

    let html = `
        <div class="calc-help-content">
            <button class="calc-help-close" onclick="closeCalcHelp()">&times;</button>
            <h3>${help.title}</h3>
    `;

    help.sections.forEach(section => {
        html += '<div class="calc-help-section">';
        html += `<h4>${section.heading}</h4>`;

        if (section.content) {
            html += `<p>${section.content}</p>`;
        }

        if (section.formula) {
            html += `<div class="calc-help-formula">${section.formula.replace(/\n/g, '<br>')}</div>`;
        }

        if (section.steps) {
            html += '<ol>';
            section.steps.forEach(step => {
                html += `<li>${step}</li>`;
            });
            html += '</ol>';
        }

        if (section.example) {
            html += `<div class="calc-help-example">
                <h5>${section.example.title}</h5>
                <p>${section.example.steps.replace(/\n/g, '<br>')}</p>
            </div>`;
        }

        if (section.tip) {
            html += `<div class="calc-help-tip"><p><strong>Tip:</strong> ${section.tip}</p></div>`;
        }

        html += '</div>';
    });

    html += '</div>';

    // Show modal
    let modal = document.getElementById('calc-help-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'calc-help-modal';
        modal.className = 'calc-help-modal';
        document.body.appendChild(modal);
    }
    modal.innerHTML = html;
    modal.classList.add('active');

    // Close on background click
    modal.onclick = (e) => {
        if (e.target === modal) closeCalcHelp();
    };

    // Close on escape
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            closeCalcHelp();
            document.removeEventListener('keydown', escHandler);
        }
    });
}

function closeCalcHelp() {
    const modal = document.getElementById('calc-help-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// ================================
// MODULE FILTERING & TOGGLE
// ================================

// Current filter state
let currentFilter = 'all';

// Toggle module collapse/expand (only works when filter is "all")
function toggleModule(header) {
    if (currentFilter !== 'all') return; // Only toggle when "All" filter is active

    const module = header.closest('.calc-module');
    if (module) {
        module.classList.toggle('collapsed');
    }
}

function filterCalculators(searchTerm) {
    const term = searchTerm.toLowerCase();
    document.querySelectorAll('.calc-module').forEach(module => {
        const keywords = module.dataset.keywords || '';
        const title = module.querySelector('h2')?.textContent || '';
        const matches = keywords.toLowerCase().includes(term) ||
                       title.toLowerCase().includes(term);
        module.classList.toggle('hidden', term && !matches);
    });
}

function filterByCategory(category) {
    currentFilter = category;
    const modulesGrid = document.getElementById('calc-modules');

    // Update filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === category);
    });

    // Show/hide modules based on category
    document.querySelectorAll('.calc-module').forEach(module => {
        if (category === 'all') {
            module.classList.remove('hidden');
            // Collapse all when "All" is selected
            module.classList.add('collapsed');
        } else {
            const moduleCategory = module.dataset.category || '';
            module.classList.toggle('hidden', moduleCategory !== category);
            // Expand all visible modules when filtering by specific category
            module.classList.remove('collapsed');
        }
    });

    // Toggle filter-active class on grid (disables toggle when not "all")
    if (modulesGrid) {
        modulesGrid.classList.toggle('filter-active', category !== 'all');
    }
}

// Expand/Collapse all modules (only when "All" filter is active)
function expandAllModules() {
    if (currentFilter !== 'all') return;
    document.querySelectorAll('.calc-module').forEach(module => {
        module.classList.remove('collapsed');
    });
}

function collapseAllModules() {
    if (currentFilter !== 'all') return;
    document.querySelectorAll('.calc-module').forEach(module => {
        module.classList.add('collapsed');
    });
}

// ================================
// FOOD & NUTRITION CALCULATORS
// ================================

function calculateDailyCalories() {
    const age = parseFloat(document.getElementById('cal-age').value);
    const sex = document.getElementById('cal-sex').value;
    const weight = parseFloat(document.getElementById('cal-weight').value);
    const height = parseFloat(document.getElementById('cal-height').value);
    const activity = parseFloat(document.getElementById('cal-activity').value);

    // Mifflin-St Jeor Equation
    let bmr;
    if (sex === 'male') {
        bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
        bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    const tdee = bmr * activity;

    // Macros (balanced diet)
    const protein = (tdee * 0.25) / 4; // 25% protein, 4 cal/g
    const carbs = (tdee * 0.50) / 4;   // 50% carbs, 4 cal/g
    const fat = (tdee * 0.25) / 9;     // 25% fat, 9 cal/g

    showResult('cal-results', `
        <h4>Daily Energy Requirements</h4>
        <div class="result-value">${Math.round(tdee)} calories/day</div>
        <div class="result-detail">BMR (Basal Metabolic Rate): ${Math.round(bmr)} cal</div>
        <div class="result-detail">TDEE (Total Daily Energy): ${Math.round(tdee)} cal</div>
        <div class="result-detail" style="margin-top: 0.5rem;">
            <strong>Recommended Macros:</strong><br>
            Protein: ${Math.round(protein)}g | Carbs: ${Math.round(carbs)}g | Fat: ${Math.round(fat)}g
        </div>
    `);

    saveToHistory('Daily Calories', `${Math.round(tdee)} cal/day`, { age, sex, weight, height, activity });
}

function calculateRations() {
    const people = parseInt(document.getElementById('ration-people').value);
    const days = parseInt(document.getElementById('ration-days').value);
    const calories = parseInt(document.getElementById('ration-calories').value);
    const mode = document.getElementById('ration-mode').value;

    const modifiers = { normal: 1, survival: 0.75, minimal: 0.5 };
    const adjustedCal = calories * modifiers[mode];

    const totalCalories = people * days * adjustedCal;
    const totalKg = totalCalories / 1500; // ~1500 cal per kg of mixed food

    showResult('ration-results', `
        <h4>Ration Planning Results</h4>
        <div class="result-value">${totalCalories.toLocaleString()} total calories</div>
        <div class="result-detail">People: ${people} | Days: ${days}</div>
        <div class="result-detail">Calories per person/day: ${Math.round(adjustedCal)}</div>
        <div class="result-detail">Approximate food weight: ${Math.round(totalKg)} kg</div>
        ${mode !== 'normal' ? `<div class="result-warning">⚠️ ${mode === 'survival' ? 'Survival' : 'Minimal'} rations - not sustainable long-term</div>` : ''}
    `);

    saveToHistory('Ration Planning', `${totalCalories.toLocaleString()} cal for ${people} people, ${days} days`, { people, days, calories, mode });
}

function calculateSupplyDuration() {
    const totalCal = parseFloat(document.getElementById('supply-calories').value);
    const people = parseInt(document.getElementById('supply-people').value);
    const daily = parseInt(document.getElementById('supply-daily').value);

    const daysSupply = totalCal / (people * daily);
    const weeks = daysSupply / 7;
    const months = daysSupply / 30;

    let status = 'result-detail';
    let statusText = '';
    if (daysSupply < 3) {
        status = 'result-danger';
        statusText = 'CRITICAL: Less than 3 days of food!';
    } else if (daysSupply < 14) {
        status = 'result-warning';
        statusText = 'Warning: Less than 2 weeks supply';
    } else if (daysSupply >= 90) {
        statusText = '✓ Excellent: 3+ months of supply';
    }

    showResult('supply-results', `
        <h4>Food Supply Duration</h4>
        <div class="result-value">${Math.round(daysSupply)} days</div>
        <div class="result-detail">${weeks.toFixed(1)} weeks | ${months.toFixed(1)} months</div>
        ${statusText ? `<div class="${status}">${statusText}</div>` : ''}
    `);

    saveToHistory('Supply Duration', `${Math.round(daysSupply)} days for ${people} people`, { totalCal, people, daily });
}

// ================================
// WATER CALCULATORS
// ================================

function calculateWaterNeeds() {
    const people = parseInt(document.getElementById('water-people').value);
    const climate = parseFloat(document.getElementById('water-climate').value);
    const activity = parseFloat(document.getElementById('water-activity').value);

    // Base: 2L drinking, 1.5L cooking, 3L sanitation per person
    const baseNeeds = {
        drinking: 2.5 * climate * activity,
        cooking: 1.5,
        sanitation: 3
    };

    const totalPerPerson = baseNeeds.drinking + baseNeeds.cooking + baseNeeds.sanitation;
    const dailyTotal = totalPerPerson * people;
    const weeklyTotal = dailyTotal * 7;
    const monthlyTotal = dailyTotal * 30;

    showResult('water-results', `
        <h4>Daily Water Requirements</h4>
        <div class="result-value">${dailyTotal.toFixed(1)} liters/day</div>
        <div class="result-detail">Per person: ${totalPerPerson.toFixed(1)}L/day</div>
        <div class="result-detail">
            Drinking: ${(baseNeeds.drinking * people).toFixed(1)}L |
            Cooking: ${(baseNeeds.cooking * people).toFixed(1)}L |
            Sanitation: ${(baseNeeds.sanitation * people).toFixed(1)}L
        </div>
        <div class="result-detail" style="margin-top: 0.5rem;">
            Weekly: ${weeklyTotal.toFixed(0)}L | Monthly: ${monthlyTotal.toFixed(0)}L
        </div>
    `);

    saveToHistory('Water Needs', `${dailyTotal.toFixed(1)}L/day for ${people} people`, { people, climate, activity });
}

function calculateChlorine() {
    const liters = parseFloat(document.getElementById('chlorine-liters').value);
    const concentration = parseFloat(document.getElementById('chlorine-concentration').value);
    const clarity = parseInt(document.getElementById('chlorine-clarity').value);

    // Standard: 2 drops per liter for 5.25% bleach
    const baseDose = 2 / 5.25; // drops per liter per % concentration
    const dropsPerLiter = (baseDose * 5.25 / concentration) * clarity;
    const totalDrops = dropsPerLiter * liters;
    const ml = totalDrops * 0.05; // ~20 drops per mL
    const teaspoons = ml / 5;

    showResult('chlorine-results', `
        <h4>Chlorine Treatment</h4>
        <div class="result-value">${Math.ceil(totalDrops)} drops</div>
        <div class="result-detail">${ml.toFixed(1)} mL | ${teaspoons.toFixed(2)} teaspoons</div>
        <div class="result-detail">For ${liters} liters of ${clarity === 2 ? 'cloudy' : 'clear'} water</div>
        <div class="result-warning">Wait 30 minutes before drinking. Water should have slight chlorine smell.</div>
    `);

    saveToHistory('Chlorine Purification', `${Math.ceil(totalDrops)} drops for ${liters}L`, { liters, concentration, clarity });
}

function calculateRainwater() {
    const area = parseFloat(document.getElementById('rain-area').value);
    const rainfall = parseFloat(document.getElementById('rain-amount').value);
    const efficiency = parseFloat(document.getElementById('rain-efficiency').value) / 100;

    // 1mm of rain on 1m² = 1 liter
    const monthlyCollection = area * rainfall * efficiency;
    const yearlyEstimate = monthlyCollection * 12;
    const dailyAvg = monthlyCollection / 30;

    showResult('rain-results', `
        <h4>Rainwater Collection Estimate</h4>
        <div class="result-value">${Math.round(monthlyCollection)} liters/month</div>
        <div class="result-detail">Daily average: ${dailyAvg.toFixed(1)}L</div>
        <div class="result-detail">Yearly estimate: ${Math.round(yearlyEstimate).toLocaleString()}L</div>
        <div class="result-detail">Collection area: ${area}m² | Efficiency: ${(efficiency * 100).toFixed(0)}%</div>
    `);

    saveToHistory('Rainwater Collection', `${Math.round(monthlyCollection)}L/month`, { area, rainfall, efficiency });
}

// ================================
// ENERGY CALCULATORS
// ================================

function calculateSolar() {
    const watts = parseFloat(document.getElementById('solar-watts').value);
    const panels = parseInt(document.getElementById('solar-panels').value);
    const hours = parseFloat(document.getElementById('solar-hours').value);
    const efficiency = parseFloat(document.getElementById('solar-efficiency').value) / 100;

    const totalWatts = watts * panels;
    const dailyKwh = (totalWatts * hours * efficiency) / 1000;
    const monthlyKwh = dailyKwh * 30;

    showResult('solar-results', `
        <h4>Solar Energy Production</h4>
        <div class="result-value">${dailyKwh.toFixed(2)} kWh/day</div>
        <div class="result-detail">System size: ${totalWatts}W (${panels} × ${watts}W panels)</div>
        <div class="result-detail">Monthly production: ${monthlyKwh.toFixed(1)} kWh</div>
        <div class="result-detail">Peak sun hours: ${hours}h | System efficiency: ${(efficiency * 100).toFixed(0)}%</div>
    `);

    saveToHistory('Solar Output', `${dailyKwh.toFixed(2)} kWh/day`, { watts, panels, hours, efficiency });
}

function calculateBattery() {
    const dailyKwh = parseFloat(document.getElementById('battery-kwh').value);
    const days = parseInt(document.getElementById('battery-days').value);
    const dod = parseFloat(document.getElementById('battery-dod').value) / 100;
    const voltage = parseInt(document.getElementById('battery-voltage').value);

    const totalKwh = dailyKwh * days;
    const usableKwh = totalKwh / dod;
    const totalAh = (usableKwh * 1000) / voltage;

    showResult('battery-results', `
        <h4>Battery Bank Requirements</h4>
        <div class="result-value">${usableKwh.toFixed(2)} kWh capacity</div>
        <div class="result-detail">At ${voltage}V: ${Math.round(totalAh)} Ah</div>
        <div class="result-detail">Days of autonomy: ${days} | DoD: ${(dod * 100).toFixed(0)}%</div>
        <div class="result-detail">Daily usage: ${dailyKwh} kWh</div>
    `);

    saveToHistory('Battery Sizing', `${usableKwh.toFixed(2)} kWh (${Math.round(totalAh)}Ah @ ${voltage}V)`, { dailyKwh, days, dod, voltage });
}

function addLoadRow() {
    const tbody = document.querySelector('#load-table tbody');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="text" value="New Device" class="load-device"></td>
        <td><input type="number" value="50" class="load-watts" min="1"></td>
        <td><input type="number" value="2" class="load-hours" min="0.5" step="0.5"></td>
        <td><input type="number" value="1" class="load-qty" min="1"></td>
        <td><button class="btn btn-sm btn-danger" onclick="removeLoadRow(this)">×</button></td>
    `;
    tbody.appendChild(row);
}

function removeLoadRow(btn) {
    const tbody = document.querySelector('#load-table tbody');
    if (tbody.children.length > 1) {
        btn.closest('tr').remove();
    }
}

function calculateLoad() {
    const rows = document.querySelectorAll('#load-table tbody tr');
    let totalWh = 0;
    let peakWatts = 0;
    let details = [];

    rows.forEach(row => {
        const device = row.querySelector('.load-device').value;
        const watts = parseFloat(row.querySelector('.load-watts').value);
        const hours = parseFloat(row.querySelector('.load-hours').value);
        const qty = parseInt(row.querySelector('.load-qty').value);

        const wh = watts * hours * qty;
        totalWh += wh;
        peakWatts += watts * qty;
        details.push(`${device}: ${wh.toFixed(0)}Wh`);
    });

    const kWh = totalWh / 1000;

    showResult('load-results', `
        <h4>Total Daily Load</h4>
        <div class="result-value">${kWh.toFixed(2)} kWh/day</div>
        <div class="result-detail">Total: ${totalWh.toFixed(0)} Wh | Peak load: ${peakWatts}W</div>
        <div class="result-detail" style="margin-top: 0.5rem;">${details.join(' | ')}</div>
    `);

    saveToHistory('Power Load', `${kWh.toFixed(2)} kWh/day`, { totalWh, peakWatts });
}

// ================================
// POPULATION CALCULATORS
// ================================

let popChart = null;

function calculatePopGrowth() {
    const initial = parseInt(document.getElementById('pop-initial').value);
    const rate = parseFloat(document.getElementById('pop-rate').value) / 100;
    const years = parseInt(document.getElementById('pop-years').value);
    const capacity = parseInt(document.getElementById('pop-capacity').value);

    const data = [];
    const labels = [];

    for (let year = 0; year <= years; year++) {
        labels.push(`Year ${year}`);
        let pop;
        if (capacity > 0) {
            // Logistic growth
            pop = capacity / (1 + ((capacity - initial) / initial) * Math.exp(-rate * year));
        } else {
            // Exponential growth
            pop = initial * Math.pow(1 + rate, year);
        }
        data.push(Math.round(pop));
    }

    const finalPop = data[data.length - 1];
    const growthFactor = finalPop / initial;

    showResult('pop-results', `
        <h4>Population Projection</h4>
        <div class="result-value">${finalPop.toLocaleString()} people</div>
        <div class="result-detail">Initial: ${initial} | After ${years} years: ${finalPop.toLocaleString()}</div>
        <div class="result-detail">Growth rate: ${(rate * 100).toFixed(1)}%/year | Growth factor: ${growthFactor.toFixed(2)}x</div>
        ${capacity > 0 ? `<div class="result-detail">Carrying capacity: ${capacity.toLocaleString()}</div>` : ''}
    `);

    // Update chart
    const ctx = document.getElementById('pop-chart');
    if (popChart) popChart.destroy();

    popChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Population',
                data: data,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: {
                    grid: { color: 'rgba(255,255,255,0.1)' }
                }
            }
        }
    });

    saveToHistory('Population Growth', `${initial} → ${finalPop.toLocaleString()} over ${years} years`, { initial, rate, years, capacity });
}

function calculateWorkforce() {
    const total = parseInt(document.getElementById('workforce-total').value);
    const workingPercent = parseFloat(document.getElementById('workforce-percent').value) / 100;

    const workforce = Math.round(total * workingPercent);
    const dependents = total - workforce;

    // Recommended allocation for survival community
    const allocations = {
        'Food Production': Math.round(workforce * 0.35),
        'Security/Defense': Math.round(workforce * 0.15),
        'Construction': Math.round(workforce * 0.15),
        'Medical/Care': Math.round(workforce * 0.10),
        'Leadership/Admin': Math.round(workforce * 0.05),
        'Crafts/Maintenance': Math.round(workforce * 0.10),
        'Reserve/Flexible': Math.round(workforce * 0.10)
    };

    let allocHtml = Object.entries(allocations)
        .map(([role, count]) => `${role}: ${count}`)
        .join(' | ');

    showResult('workforce-results', `
        <h4>Workforce Allocation</h4>
        <div class="result-value">${workforce} workers</div>
        <div class="result-detail">Total population: ${total} | Dependents: ${dependents}</div>
        <div class="result-detail">Dependency ratio: ${(dependents / workforce).toFixed(2)}</div>
        <div class="result-detail" style="margin-top: 0.5rem;"><strong>Suggested Allocation:</strong><br>${allocHtml}</div>
    `);

    saveToHistory('Workforce', `${workforce} workers from ${total} population`, { total, workingPercent });
}

function calculateHousing() {
    const pop = parseInt(document.getElementById('housing-pop').value);
    const householdSize = parseFloat(document.getElementById('housing-size').value);
    const spacePerPerson = parseFloat(document.getElementById('housing-space').value);

    const households = Math.ceil(pop / householdSize);
    const avgHouseSize = spacePerPerson * householdSize;
    const totalArea = pop * spacePerPerson;

    showResult('housing-results', `
        <h4>Housing Requirements</h4>
        <div class="result-value">${households} housing units</div>
        <div class="result-detail">Population: ${pop} | Avg household: ${householdSize} people</div>
        <div class="result-detail">Avg unit size: ${avgHouseSize}m² | Total area needed: ${totalArea.toLocaleString()}m²</div>
    `);

    saveToHistory('Housing', `${households} units for ${pop} people`, { pop, householdSize, spacePerPerson });
}

// ================================
// AGRICULTURE CALCULATORS
// ================================

function calculateLand() {
    const people = parseInt(document.getElementById('land-people').value);
    const calories = parseInt(document.getElementById('land-calories').value);
    const cropCalPerSqM = parseInt(document.getElementById('land-crop').value);
    const method = parseFloat(document.getElementById('land-method').value);

    const yearlyCalories = people * calories * 365;
    const adjustedYield = cropCalPerSqM * method;
    const landNeeded = yearlyCalories / adjustedYield;
    const hectares = landNeeded / 10000;
    const acres = hectares * 2.471;

    showResult('land-results', `
        <h4>Land Requirements</h4>
        <div class="result-value">${Math.round(landNeeded).toLocaleString()} m²</div>
        <div class="result-detail">${hectares.toFixed(2)} hectares | ${acres.toFixed(2)} acres</div>
        <div class="result-detail">For ${people} people @ ${calories} cal/day</div>
        <div class="result-detail">Yearly need: ${(yearlyCalories / 1000000).toFixed(1)}M calories</div>
    `);

    saveToHistory('Land Requirements', `${Math.round(landNeeded).toLocaleString()}m² for ${people} people`, { people, calories, cropCalPerSqM, method });
}

function calculateYield() {
    const area = parseFloat(document.getElementById('yield-area').value);
    const cropSelect = document.getElementById('yield-crop');
    const seasons = parseInt(document.getElementById('yield-seasons').value);

    const yieldPerSqM = parseFloat(cropSelect.selectedOptions[0].dataset.yield);
    const calPer100g = parseFloat(cropSelect.selectedOptions[0].dataset.cal);
    const cropName = cropSelect.selectedOptions[0].text.split(' ')[0];

    const totalKg = area * yieldPerSqM * seasons;
    const totalCalories = totalKg * 10 * calPer100g; // 10 × 100g per kg
    const peopleFed = totalCalories / (2000 * 365); // people for a year

    showResult('yield-results', `
        <h4>Crop Yield Estimate</h4>
        <div class="result-value">${totalKg.toLocaleString()} kg/year</div>
        <div class="result-detail">Crop: ${cropName} | Area: ${area.toLocaleString()}m²</div>
        <div class="result-detail">Seasons: ${seasons} | Yield: ${yieldPerSqM} kg/m²</div>
        <div class="result-detail">Total calories: ${(totalCalories / 1000000).toFixed(2)}M</div>
        <div class="result-detail">Can feed ~${peopleFed.toFixed(1)} people for a year</div>
    `);

    saveToHistory('Crop Yield', `${totalKg.toLocaleString()}kg ${cropName}`, { area, cropName, seasons });
}

function calculateLivestock() {
    const typeSelect = document.getElementById('livestock-type');
    const count = parseInt(document.getElementById('livestock-count').value);
    const days = parseInt(document.getElementById('livestock-days').value);

    const feedPerDay = parseFloat(typeSelect.selectedOptions[0].dataset.feed);
    const waterPerDay = parseFloat(typeSelect.selectedOptions[0].dataset.water);
    const animalType = typeSelect.selectedOptions[0].text;

    const totalFeed = feedPerDay * count * days;
    const totalWater = waterPerDay * count * days;

    showResult('livestock-results', `
        <h4>Livestock Requirements</h4>
        <div class="result-value">${totalFeed.toFixed(0)} kg feed</div>
        <div class="result-detail">${count} ${animalType} for ${days} days</div>
        <div class="result-detail">Feed: ${feedPerDay}kg/animal/day | Water: ${waterPerDay}L/animal/day</div>
        <div class="result-detail">Total water needed: ${totalWater.toLocaleString()}L</div>
    `);

    saveToHistory('Livestock Feed', `${totalFeed.toFixed(0)}kg for ${count} ${animalType}`, { animalType, count, days });
}

// ================================
// CONSTRUCTION CALCULATORS
// ================================

function calculateConcrete() {
    const volume = parseFloat(document.getElementById('concrete-volume').value);
    const ratio = document.getElementById('concrete-ratio').value;

    const ratios = {
        '1:2:3': { cement: 1, sand: 2, gravel: 3 },
        '1:2:4': { cement: 1, sand: 2, gravel: 4 },
        '1:3:6': { cement: 1, sand: 3, gravel: 6 },
        '1:1.5:3': { cement: 1, sand: 1.5, gravel: 3 }
    };

    const r = ratios[ratio];
    const totalParts = r.cement + r.sand + r.gravel;

    // Density adjustments: cement ~1500kg/m³, sand ~1600kg/m³, gravel ~1800kg/m³
    const cementVol = (r.cement / totalParts) * volume * 1.54; // 54% more for compaction
    const sandVol = (r.sand / totalParts) * volume * 1.54;
    const gravelVol = (r.gravel / totalParts) * volume * 1.54;

    const cementKg = cementVol * 1500;
    const sandKg = sandVol * 1600;
    const gravelKg = gravelVol * 1800;
    const waterKg = cementKg * 0.5;

    const cementBags = cementKg / 50; // 50kg bags

    showResult('concrete-results', `
        <h4>Concrete Materials (${ratio} mix)</h4>
        <div class="result-value">${Math.ceil(cementBags)} bags cement</div>
        <div class="result-detail">For ${volume}m³ concrete:</div>
        <div class="result-detail">Cement: ${Math.round(cementKg)}kg (${Math.ceil(cementBags)} × 50kg bags)</div>
        <div class="result-detail">Sand: ${Math.round(sandKg)}kg</div>
        <div class="result-detail">Gravel: ${Math.round(gravelKg)}kg</div>
        <div class="result-detail">Water: ~${Math.round(waterKg)}L</div>
    `);

    saveToHistory('Concrete Mix', `${Math.ceil(cementBags)} bags for ${volume}m³`, { volume, ratio });
}

function calculateLumber() {
    const type = document.getElementById('lumber-type').value;
    const customArea = parseFloat(document.getElementById('lumber-area').value);

    const presets = {
        shed: { area: 9, boards: 50, studs: 20, sheets: 8 },
        cabin: { area: 25, boards: 200, studs: 60, sheets: 25 },
        house: { area: 80, boards: 500, studs: 150, sheets: 60 },
        barn: { area: 48, boards: 400, studs: 80, sheets: 45 }
    };

    let data = presets[type];
    if (customArea > 0) {
        const factor = customArea / data.area;
        data = {
            area: customArea,
            boards: Math.round(data.boards * factor),
            studs: Math.round(data.studs * factor),
            sheets: Math.round(data.sheets * factor)
        };
    }

    showResult('lumber-results', `
        <h4>Lumber Requirements</h4>
        <div class="result-value">${data.boards} board feet</div>
        <div class="result-detail">Floor area: ${data.area}m²</div>
        <div class="result-detail">Wall studs (2×4): ~${data.studs}</div>
        <div class="result-detail">Plywood sheets (4×8): ~${data.sheets}</div>
        <div class="result-detail">Roof trusses: ~${Math.round(data.area / 1.2)}</div>
    `);

    saveToHistory('Lumber', `${data.boards} board feet for ${data.area}m²`, data);
}

function calculateFoundation() {
    const perimeter = parseFloat(document.getElementById('foundation-perimeter').value);
    const width = parseFloat(document.getElementById('foundation-width').value) / 100;
    const depth = parseFloat(document.getElementById('foundation-depth').value) / 100;

    const volume = perimeter * width * depth;

    showResult('foundation-results', `
        <h4>Foundation Volume</h4>
        <div class="result-value">${volume.toFixed(2)} m³</div>
        <div class="result-detail">Perimeter: ${perimeter}m | Width: ${width * 100}cm | Depth: ${depth * 100}cm</div>
        <div class="result-detail">Concrete needed: ${volume.toFixed(2)}m³ + 10% waste = ${(volume * 1.1).toFixed(2)}m³</div>
    `);

    saveToHistory('Foundation', `${volume.toFixed(2)}m³ concrete`, { perimeter, width, depth });
}

// ================================
// LOGISTICS CALCULATORS
// ================================

function calculateFuel() {
    const consumption = parseFloat(document.getElementById('fuel-vehicle').value);
    const distance = parseFloat(document.getElementById('fuel-distance').value);
    const loadFactor = parseFloat(document.getElementById('fuel-load').value);

    let fuel, label;
    if (consumption === 35) {
        // Generator mode (per day)
        fuel = consumption * distance * loadFactor;
        label = `for ${distance} days`;
    } else {
        fuel = (consumption / 100) * distance * loadFactor;
        label = `for ${distance}km`;
    }

    showResult('fuel-results', `
        <h4>Fuel Consumption</h4>
        <div class="result-value">${fuel.toFixed(1)} liters</div>
        <div class="result-detail">${label}</div>
        <div class="result-detail">Base consumption: ${consumption}L/100km | Load factor: ${loadFactor}x</div>
    `);

    saveToHistory('Fuel', `${fuel.toFixed(1)}L ${label}`, { consumption, distance, loadFactor });
}

function calculateCarry() {
    const capacity = parseFloat(document.getElementById('carry-method').value);
    const totalLoad = parseFloat(document.getElementById('carry-load').value);
    const units = parseInt(document.getElementById('carry-units').value);

    const totalCapacity = capacity * units;
    const trips = Math.ceil(totalLoad / totalCapacity);
    const utilizaton = (totalLoad / (trips * totalCapacity)) * 100;

    showResult('carry-results', `
        <h4>Carrying Capacity</h4>
        <div class="result-value">${trips} trip${trips > 1 ? 's' : ''} required</div>
        <div class="result-detail">Total load: ${totalLoad.toLocaleString()}kg</div>
        <div class="result-detail">Capacity per unit: ${capacity}kg × ${units} = ${totalCapacity}kg total</div>
        <div class="result-detail">Utilization: ${utilizaton.toFixed(0)}%</div>
    `);

    saveToHistory('Carrying', `${trips} trips for ${totalLoad}kg`, { capacity, totalLoad, units });
}

function calculateTravel() {
    const distance = parseFloat(document.getElementById('travel-distance').value);
    const speed = parseFloat(document.getElementById('travel-mode').value);
    const terrain = parseFloat(document.getElementById('travel-terrain').value);

    const effectiveSpeed = speed * terrain;
    const hours = distance / effectiveSpeed;
    const displayTime = hours < 1
        ? `${Math.round(hours * 60)} minutes`
        : `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;

    showResult('travel-results', `
        <h4>Travel Time Estimate</h4>
        <div class="result-value">${displayTime}</div>
        <div class="result-detail">Distance: ${distance}km | Effective speed: ${effectiveSpeed.toFixed(1)} km/h</div>
        <div class="result-detail">Add rest stops for journeys over 4 hours</div>
    `);

    saveToHistory('Travel Time', `${displayTime} for ${distance}km`, { distance, speed, terrain });
}

// ================================
// MEDICAL CALCULATORS
// ================================

function calculateDosage() {
    const weight = parseFloat(document.getElementById('dose-weight').value);
    const medSelect = document.getElementById('dose-med');

    const dosePerKg = parseFloat(medSelect.selectedOptions[0].dataset.dose);
    const maxDose = parseFloat(medSelect.selectedOptions[0].dataset.max);
    const unit = medSelect.selectedOptions[0].dataset.unit;
    const medName = medSelect.selectedOptions[0].text.split(' ')[0];

    const calculatedDose = weight * dosePerKg;
    const safeDose = Math.min(calculatedDose, maxDose);

    showResult('dose-results', `
        <h4>Dosage Calculation</h4>
        <div class="result-value">${safeDose.toFixed(0)} ${unit}</div>
        <div class="result-detail">${medName} for ${weight}kg patient</div>
        <div class="result-detail">Calculated: ${calculatedDose.toFixed(0)}${unit} | Max single dose: ${maxDose}${unit}</div>
        ${calculatedDose > maxDose ? '<div class="result-warning">⚠️ Dose capped at maximum. Do not exceed.</div>' : ''}
        <div class="result-warning">⚠️ Always verify with medical professional when possible.</div>
    `);

    saveToHistory('Dosage', `${safeDose.toFixed(0)}${unit} ${medName}`, { weight, medName, safeDose });
}

function calculateHydration() {
    const weight = parseFloat(document.getElementById('hydrate-weight').value);
    const level = document.getElementById('hydrate-level').value;

    const protocols = {
        mild: { initial: 50, maintenance: 100, text: 'Mild' },
        moderate: { initial: 100, maintenance: 100, text: 'Moderate' },
        severe: { initial: 150, maintenance: 100, text: 'Severe - Seek medical help!' }
    };

    const p = protocols[level];
    const initialMl = weight * p.initial;
    const first4Hours = weight * p.maintenance * 4;

    showResult('hydrate-results', `
        <h4>Oral Rehydration Protocol</h4>
        <div class="result-value">${Math.round(initialMl)} mL initial</div>
        <div class="result-detail">Dehydration level: ${p.text}</div>
        <div class="result-detail">First 4 hours: ${Math.round(first4Hours)} mL ORS</div>
        <div class="result-detail">Then: ${weight * 10}-${weight * 20} mL after each loose stool</div>
        ${level === 'severe' ? '<div class="result-danger">⚠️ SEVERE: Requires IV fluids. Seek immediate medical help!</div>' : ''}
    `);

    saveToHistory('Hydration', `${Math.round(initialMl)}mL initial (${p.text})`, { weight, level });
}

function calculateMedSupplies() {
    const group = parseInt(document.getElementById('supply-group').value);
    const duration = parseInt(document.getElementById('supply-duration').value);
    const risk = parseInt(document.getElementById('supply-risk').value);

    // Base quantities per 10 people for 30 days
    const base = {
        bandages: 20,
        gauze: 10,
        tape: 2,
        painkillers: 30,
        antibiotics: 10,
        antiseptic: 2,
        gloves: 20
    };

    const factor = (group / 10) * (duration / 30) * risk;

    const supplies = Object.entries(base).map(([item, qty]) => {
        const needed = Math.ceil(qty * factor);
        return `${item}: ${needed}`;
    }).join(' | ');

    showResult('supply-med-results', `
        <h4>First Aid Supply Estimate</h4>
        <div class="result-detail">${group} people, ${duration} days, ${['Low', 'Medium', 'High'][risk - 1]} risk</div>
        <div class="result-detail" style="margin-top: 0.5rem;">${supplies}</div>
        <div class="result-warning">Estimates only. Adjust based on specific needs and conditions.</div>
    `);

    saveToHistory('Med Supplies', `${group} people, ${duration} days`, { group, duration, risk });
}

// ================================
// COMMUNICATIONS CALCULATORS
// ================================

function calculateRadioRange() {
    const type = document.getElementById('radio-type').value;
    const power = parseFloat(document.getElementById('radio-power').value);
    const freq = document.getElementById('radio-freq').value;
    const terrain = document.getElementById('radio-terrain').value;

    // Base range factors
    const freqFactors = { hf: 100, vhf: 1, uhf: 0.8, cb: 0.5 };
    const terrainFactors = { flat: 1, rolling: 0.7, urban: 0.4, mountain: 0.5, forest: 0.3 };

    let baseRange;
    if (freq === 'hf') {
        baseRange = Math.sqrt(power) * 50; // HF can go hundreds of km
    } else {
        baseRange = Math.sqrt(power) * 5; // VHF/UHF line-of-sight
    }

    const range = baseRange * freqFactors[freq] * terrainFactors[terrain];

    showResult('radio-results', `
        <h4>Estimated Radio Range</h4>
        <div class="result-value">${range.toFixed(1)} km</div>
        <div class="result-detail">Power: ${power}W | Frequency: ${freq.toUpperCase()}</div>
        <div class="result-detail">Terrain: ${terrain}</div>
        <div class="result-warning">Actual range varies with antenna height, weather, and obstructions.</div>
    `);

    saveToHistory('Radio Range', `${range.toFixed(1)}km at ${power}W`, { power, freq, terrain });
}

function calculateAntenna() {
    const freq = parseFloat(document.getElementById('antenna-freq').value);
    const waveFraction = parseFloat(document.getElementById('antenna-type').value);

    // Speed of light / frequency = wavelength
    const wavelength = 300 / freq; // in meters
    const length = wavelength * waveFraction;

    const lengthCm = length * 100;
    const lengthInches = length * 39.37;
    const lengthFeet = lengthInches / 12;

    showResult('antenna-results', `
        <h4>Antenna Length</h4>
        <div class="result-value">${length.toFixed(3)} meters</div>
        <div class="result-detail">${lengthCm.toFixed(1)} cm | ${lengthFeet.toFixed(2)} feet</div>
        <div class="result-detail">Frequency: ${freq} MHz | Wavelength: ${wavelength.toFixed(3)}m</div>
    `);

    saveToHistory('Antenna Length', `${length.toFixed(3)}m for ${freq}MHz`, { freq, waveFraction });
}

function calculateLOS() {
    const h1 = parseFloat(document.getElementById('los-height1').value);
    const h2 = parseFloat(document.getElementById('los-height2').value);

    // Radio horizon formula: d = 3.57 × √h (km, height in meters)
    const d1 = 3.57 * Math.sqrt(h1);
    const d2 = 3.57 * Math.sqrt(h2);
    const totalLOS = d1 + d2;

    showResult('los-results', `
        <h4>Line of Sight Distance</h4>
        <div class="result-value">${totalLOS.toFixed(1)} km</div>
        <div class="result-detail">Antenna 1 (${h1}m): ${d1.toFixed(1)}km horizon</div>
        <div class="result-detail">Antenna 2 (${h2}m): ${d2.toFixed(1)}km horizon</div>
        <div class="result-detail">Combined: ${totalLOS.toFixed(1)}km maximum</div>
    `);

    saveToHistory('Line of Sight', `${totalLOS.toFixed(1)}km`, { h1, h2 });
}

// ================================
// PHYSICS CALCULATORS
// ================================

function calculateForce() {
    const mass = parseFloat(document.getElementById('force-mass').value);
    const accel = parseFloat(document.getElementById('force-accel').value);

    const force = mass * accel;

    showResult('force-results', `
        <h4>Force (F = ma)</h4>
        <div class="result-value">${force.toFixed(2)} N</div>
        <div class="result-detail">Mass: ${mass}kg × Acceleration: ${accel}m/s² = ${force.toFixed(2)} Newtons</div>
    `);

    saveToHistory('Force', `${force.toFixed(2)}N`, { mass, accel });
}

function updateOhmInputs() {
    const solve = document.getElementById('ohm-solve').value;
    document.getElementById('ohm-v-group').style.display = solve === 'voltage' ? 'none' : 'block';
    document.getElementById('ohm-r-group').style.display = solve === 'resistance' ? 'none' : 'block';
    document.getElementById('ohm-i-group').style.display = solve === 'current' ? 'none' : 'block';
}

function calculateOhm() {
    const solve = document.getElementById('ohm-solve').value;
    const v = parseFloat(document.getElementById('ohm-voltage').value);
    const r = parseFloat(document.getElementById('ohm-resistance').value);
    const i = parseFloat(document.getElementById('ohm-current').value);

    let result, formula;

    switch(solve) {
        case 'current':
            result = v / r;
            formula = `I = V/R = ${v}/${r} = ${result.toFixed(4)} A`;
            break;
        case 'voltage':
            result = i * r;
            formula = `V = I×R = ${i}×${r} = ${result.toFixed(2)} V`;
            break;
        case 'resistance':
            result = v / i;
            formula = `R = V/I = ${v}/${i} = ${result.toFixed(2)} Ω`;
            break;
        case 'power':
            result = v * (v / r);
            formula = `P = V²/R = ${v}²/${r} = ${result.toFixed(2)} W`;
            break;
    }

    showResult('ohm-results', `
        <h4>Ohm's Law Result</h4>
        <div class="result-value">${result.toFixed(4)} ${solve === 'current' ? 'A' : solve === 'voltage' ? 'V' : solve === 'resistance' ? 'Ω' : 'W'}</div>
        <div class="result-detail">${formula}</div>
    `);

    saveToHistory("Ohm's Law", `${result.toFixed(4)}`, { solve, v, r, i });
}

function updateEnergyInputs() {
    const type = document.getElementById('energy-type').value;
    document.getElementById('kinetic-inputs').style.display = type === 'kinetic' ? 'block' : 'none';
    document.getElementById('potential-inputs').style.display = type === 'potential' ? 'block' : 'none';
    document.getElementById('heat-inputs').style.display = type === 'heat' ? 'block' : 'none';
}

function calculateEnergy() {
    const type = document.getElementById('energy-type').value;
    let result, formula;

    switch(type) {
        case 'kinetic':
            const keM = parseFloat(document.getElementById('ke-mass').value);
            const keV = parseFloat(document.getElementById('ke-velocity').value);
            result = 0.5 * keM * keV * keV;
            formula = `KE = ½mv² = ½×${keM}×${keV}² = ${result.toFixed(2)} J`;
            break;
        case 'potential':
            const peM = parseFloat(document.getElementById('pe-mass').value);
            const peH = parseFloat(document.getElementById('pe-height').value);
            result = peM * 9.81 * peH;
            formula = `PE = mgh = ${peM}×9.81×${peH} = ${result.toFixed(2)} J`;
            break;
        case 'heat':
            const hM = parseFloat(document.getElementById('heat-mass').value);
            const hC = parseFloat(document.getElementById('heat-specific').value);
            const hT = parseFloat(document.getElementById('heat-delta').value);
            result = hM * hC * hT;
            formula = `Q = mcΔT = ${hM}×${hC}×${hT} = ${result.toFixed(0)} J`;
            break;
    }

    showResult('energy-results', `
        <h4>${type.charAt(0).toUpperCase() + type.slice(1)} Energy</h4>
        <div class="result-value">${result.toFixed(2)} Joules</div>
        <div class="result-detail">${formula}</div>
        <div class="result-detail">${(result / 1000).toFixed(4)} kJ | ${(result / 4.184).toFixed(2)} calories</div>
    `);

    saveToHistory(`${type} Energy`, `${result.toFixed(2)}J`, { type, result });
}

function calculatePressure() {
    const force = parseFloat(document.getElementById('pressure-force').value);
    const area = parseFloat(document.getElementById('pressure-area').value);

    const pressure = force / area;
    const kPa = pressure / 1000;
    const psi = pressure / 6894.76;
    const atm = pressure / 101325;

    showResult('pressure-results', `
        <h4>Pressure (P = F/A)</h4>
        <div class="result-value">${pressure.toFixed(2)} Pa</div>
        <div class="result-detail">${kPa.toFixed(4)} kPa | ${psi.toFixed(4)} psi | ${atm.toFixed(6)} atm</div>
        <div class="result-detail">Force: ${force}N | Area: ${area}m²</div>
    `);

    saveToHistory('Pressure', `${pressure.toFixed(2)}Pa`, { force, area });
}

// ================================
// UNIT CONVERTER
// ================================

const unitConversions = {
    length: {
        units: ['m', 'km', 'cm', 'mm', 'mi', 'ft', 'in', 'yd'],
        toBase: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, ft: 0.3048, in: 0.0254, yd: 0.9144 }
    },
    weight: {
        units: ['kg', 'g', 'mg', 'lb', 'oz', 'ton', 'stone'],
        toBase: { kg: 1, g: 0.001, mg: 0.000001, lb: 0.453592, oz: 0.0283495, ton: 907.185, stone: 6.35029 }
    },
    volume: {
        units: ['L', 'mL', 'gal', 'qt', 'pt', 'cup', 'floz', 'm³'],
        toBase: { L: 1, mL: 0.001, gal: 3.78541, qt: 0.946353, pt: 0.473176, cup: 0.236588, floz: 0.0295735, 'm³': 1000 }
    },
    temperature: {
        units: ['°C', '°F', 'K'],
        special: true
    },
    area: {
        units: ['m²', 'km²', 'ha', 'acre', 'ft²', 'in²'],
        toBase: { 'm²': 1, 'km²': 1000000, ha: 10000, acre: 4046.86, 'ft²': 0.092903, 'in²': 0.00064516 }
    },
    energy: {
        units: ['J', 'kJ', 'cal', 'kcal', 'Wh', 'kWh', 'BTU'],
        toBase: { J: 1, kJ: 1000, cal: 4.184, kcal: 4184, Wh: 3600, kWh: 3600000, BTU: 1055.06 }
    },
    pressure: {
        units: ['Pa', 'kPa', 'bar', 'psi', 'atm', 'mmHg'],
        toBase: { Pa: 1, kPa: 1000, bar: 100000, psi: 6894.76, atm: 101325, mmHg: 133.322 }
    },
    speed: {
        units: ['m/s', 'km/h', 'mph', 'kn', 'ft/s'],
        toBase: { 'm/s': 1, 'km/h': 0.277778, mph: 0.44704, kn: 0.514444, 'ft/s': 0.3048 }
    }
};

function updateConvertUnits() {
    const category = document.getElementById('convert-category').value;
    const fromSelect = document.getElementById('convert-from');
    const toSelect = document.getElementById('convert-to');

    const units = unitConversions[category].units;

    fromSelect.innerHTML = units.map(u => `<option value="${u}">${u}</option>`).join('');
    toSelect.innerHTML = units.map(u => `<option value="${u}">${u}</option>`).join('');

    if (units.length > 1) toSelect.selectedIndex = 1;
}

function convertUnits() {
    const category = document.getElementById('convert-category').value;
    const value = parseFloat(document.getElementById('convert-value').value);
    const from = document.getElementById('convert-from').value;
    const to = document.getElementById('convert-to').value;

    let result;

    if (category === 'temperature') {
        // Special handling for temperature
        let celsius;
        if (from === '°C') celsius = value;
        else if (from === '°F') celsius = (value - 32) * 5/9;
        else celsius = value - 273.15; // Kelvin

        if (to === '°C') result = celsius;
        else if (to === '°F') result = (celsius * 9/5) + 32;
        else result = celsius + 273.15; // Kelvin
    } else {
        const conv = unitConversions[category].toBase;
        const baseValue = value * conv[from];
        result = baseValue / conv[to];
    }

    showResult('convert-results', `
        <h4>Conversion Result</h4>
        <div class="result-value">${result.toPrecision(6)} ${to}</div>
        <div class="result-detail">${value} ${from} = ${result.toPrecision(6)} ${to}</div>
    `);

    saveToHistory('Unit Convert', `${value} ${from} → ${result.toPrecision(6)} ${to}`, { category, value, from, to });
}

// Initialize converter on load
document.addEventListener('DOMContentLoaded', updateConvertUnits);

// ================================
// HISTORY & UTILITIES
// ================================

function showResult(elementId, html) {
    const el = document.getElementById(elementId);
    if (el) {
        el.innerHTML = html;
        el.classList.add('show');
    }
}

function saveToHistory(type, result, inputs) {
    const entry = {
        type,
        result,
        inputs,
        timestamp: new Date().toISOString()
    };

    calculationHistory.unshift(entry);
    if (calculationHistory.length > 50) calculationHistory.pop();

    localStorage.setItem('sps_calc_history', JSON.stringify(calculationHistory));
    updateHistoryDisplay();
}

function updateHistoryDisplay() {
    const container = document.getElementById('calc-history-list');
    if (!container) return;

    if (calculationHistory.length === 0) {
        container.innerHTML = '<p class="empty-text">No calculations saved yet. Use any calculator above and your results will be saved here.</p>';
        return;
    }

    container.innerHTML = calculationHistory.slice(0, 30).map((entry, idx) => {
        const dt = new Date(entry.timestamp);
        const dateStr = dt.toLocaleDateString();
        const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Format inputs for display with better labels
        let inputDetails = '';
        if (entry.inputs && typeof entry.inputs === 'object') {
            inputDetails = Object.entries(entry.inputs)
                .map(([key, val]) => {
                    const label = formatInputKey(key);
                    return `<span class="input-tag">${label}: ${val}</span>`;
                })
                .join('');
        }

        return `
            <div class="history-item" data-index="${idx}">
                <div class="history-item-info">
                    <div class="history-item-header">
                        <span class="history-item-type">${entry.type}</span>
                        <button class="history-delete-btn" onclick="deleteHistoryItem(${idx})" title="Delete this calculation">×</button>
                    </div>
                    <div class="history-item-result">${entry.result}</div>
                    ${inputDetails ? `<div class="history-item-inputs">${inputDetails}</div>` : ''}
                    <div class="history-item-time">${dateStr} at ${timeStr}</div>
                </div>
            </div>
        `;
    }).join('');

    // Show count if more items exist
    if (calculationHistory.length > 30) {
        container.innerHTML += `<p class="history-more">...and ${calculationHistory.length - 30} more calculations. Export to see all.</p>`;
    }
}

function deleteHistoryItem(index) {
    if (index >= 0 && index < calculationHistory.length) {
        calculationHistory.splice(index, 1);
        localStorage.setItem('sps_calc_history', JSON.stringify(calculationHistory));
        updateHistoryDisplay();
    }
}

function clearHistory() {
    if (confirm('Clear all calculation history?')) {
        calculationHistory = [];
        localStorage.removeItem('sps_calc_history');
        updateHistoryDisplay();
    }
}

function exportHistory(format) {
    if (calculationHistory.length === 0) {
        alert('No calculations to export');
        return;
    }

    if (format === 'csv') {
        // Build comprehensive CSV with all input details
        const csv = 'Calculator Type,Result,Input Details,Date,Time\n' +
            calculationHistory.map(e => {
                // Format inputs as readable string
                let inputStr = '';
                if (e.inputs && typeof e.inputs === 'object') {
                    inputStr = Object.entries(e.inputs)
                        .map(([key, val]) => `${key}=${val}`)
                        .join('; ');
                }
                // Format timestamp
                const dt = new Date(e.timestamp);
                const dateStr = dt.toLocaleDateString();
                const timeStr = dt.toLocaleTimeString();
                // Escape any quotes in strings
                const safeResult = String(e.result).replace(/"/g, '""');
                const safeInputs = inputStr.replace(/"/g, '""');
                return `"${e.type}","${safeResult}","${safeInputs}","${dateStr}","${timeStr}"`;
            }).join('\n');
        downloadFile(csv, 'calculations_history.csv', 'text/csv');
    } else if (format === 'pdf') {
        // Generate a proper printable PDF document
        generatePrintablePDF();
    }
}

// Detailed calculation reference data with descriptions, formulas, and units
const calculationReference = {
    'Daily Calories': {
        description: 'Estimates daily caloric needs based on Mifflin-St Jeor equation, accounting for age, sex, weight, height, and activity level.',
        formula: 'BMR = (10 × weight_kg) + (6.25 × height_cm) - (5 × age) ± gender_factor\nTDEE = BMR × activity_multiplier',
        units: { result: 'calories/day', weight: 'kg (÷2.2 from lbs)', height: 'cm (×2.54 from in)' },
        activityMultipliers: 'Sedentary: 1.2 | Light: 1.375 | Moderate: 1.55 | Active: 1.725 | Very Active: 1.9'
    },
    'Ration Planning': {
        description: 'Calculates total food calories needed for a group over a specified time period.',
        formula: 'Total Calories = People × Days × Calories_per_person',
        units: { result: 'total calories', conversion: '~1500 cal/lb dried food' },
        tips: 'Normal: 2000 cal/day | Survival minimum: 1200-1500 cal/day | Hard labor: 3000+ cal/day'
    },
    'Supply Duration': {
        description: 'Determines how long your food storage will last based on caloric content.',
        formula: 'Days = Total_Stored_Calories ÷ (People × Daily_Calories)',
        units: { result: 'days', input: 'total calories stored' }
    },
    'Water Needs': {
        description: 'Calculates daily water requirements based on climate and activity level.',
        formula: 'Daily Water = Base_Amount × Climate_Factor × Activity_Factor',
        units: { result: 'liters/day', conversion: '1 gallon = 3.785 liters' },
        baseAmounts: 'Minimum: 2L/person/day | Recommended: 3-4L | Hot climate: 4-6L | Heavy work: 6-8L'
    },
    'Chlorine Purification': {
        description: 'Calculates bleach drops needed to purify water (5.25-8.25% sodium hypochlorite).',
        formula: 'Drops = Liters × Concentration_Factor × Clarity_Factor',
        units: { result: 'drops of bleach', waitTime: '30 min before drinking' },
        tips: 'Clear water: 2 drops/L | Cloudy water: 4 drops/L | Double if no chlorine smell after 30 min'
    },
    'Rainwater Collection': {
        description: 'Estimates monthly rainwater collection potential from a catchment surface.',
        formula: 'Collection = Area_m² × Rainfall_mm × Efficiency',
        units: { result: 'liters/month', area: 'm² (roof area)', rainfall: 'mm/month' },
        efficiency: 'Metal roof: 90% | Tile: 80% | Asphalt shingle: 70%'
    },
    'Solar Output': {
        description: 'Estimates daily energy production from solar panels.',
        formula: 'Daily_kWh = (Panel_Watts × Number_of_Panels × Sun_Hours × Efficiency) ÷ 1000',
        units: { result: 'kWh/day', panels: 'watts per panel', sunHours: 'peak sun hours/day' },
        efficiency: 'System efficiency typically 75-85% (accounts for inverter, wiring, temperature losses)'
    },
    'Battery Sizing': {
        description: 'Calculates battery bank capacity needed for off-grid power storage.',
        formula: 'Capacity_Ah = (Daily_kWh × Days_of_Autonomy × 1000) ÷ (Voltage × DoD)',
        units: { result: 'amp-hours (Ah)', voltage: '12V, 24V, or 48V system' },
        depthOfDischarge: 'Lead-acid: 50% DoD | Lithium: 80-90% DoD'
    },
    'Power Load': {
        description: 'Calculates total daily energy consumption from all electrical devices.',
        formula: 'Daily_Wh = Σ(Device_Watts × Hours_Used)',
        units: { result: 'watt-hours/day (Wh)', conversion: '1000 Wh = 1 kWh' }
    },
    'Population Growth': {
        description: 'Projects population growth using exponential or logistic models.',
        formula: 'Exponential: P(t) = P₀ × e^(rt)\nLogistic: P(t) = K ÷ (1 + ((K-P₀)/P₀) × e^(-rt))',
        units: { result: 'projected population', rate: 'annual growth rate (decimal)' }
    },
    'Workforce': {
        description: 'Estimates available workforce from total population.',
        formula: 'Workers = Population × Working_Age_Percentage × Labor_Participation_Rate',
        units: { result: 'available workers' },
        typical: 'Working age (15-64): ~65% of population | Labor participation: 60-70%'
    },
    'Housing': {
        description: 'Calculates housing units needed for a population.',
        formula: 'Units = Population ÷ Average_Household_Size',
        units: { result: 'housing units', spacePerPerson: 'm² or sq ft' }
    },
    'Land Requirements': {
        description: 'Estimates agricultural land needed to feed a population.',
        formula: 'Land_m² = (People × Daily_Calories × 365) ÷ Crop_Yield_per_m²',
        units: { result: 'm² (or acres: ÷4047)' },
        yields: 'Traditional: 1000-2000 cal/m²/year | Intensive: 4000-8000 cal/m²/year'
    },
    'Crop Yield': {
        description: 'Estimates harvest quantity based on planted area and crop type.',
        formula: 'Yield = Area × Yield_per_Unit_Area × Number_of_Seasons',
        units: { result: 'kg of produce' }
    },
    'Livestock Feed': {
        description: 'Calculates feed requirements for animals over time.',
        formula: 'Feed = Number_of_Animals × Daily_Feed_per_Animal × Days',
        units: { result: 'kg of feed' },
        feedRates: 'Chickens: 0.1-0.15 kg/day | Goats: 1-2 kg/day | Cattle: 10-15 kg/day'
    },
    'Concrete Mix': {
        description: 'Calculates materials needed for concrete by volume.',
        formula: 'Based on mix ratio (e.g., 1:2:3 = cement:sand:gravel)',
        units: { result: 'bags of cement (94 lb/43 kg each)', volume: 'm³ or cu ft' },
        ratios: 'Standard: 1:2:3 | High strength: 1:1.5:3 | Foundation: 1:2.5:3.5'
    },
    'Lumber': {
        description: 'Calculates board feet of lumber needed for construction.',
        formula: 'Board Feet = (Thickness × Width × Length) ÷ 144 (all in inches)',
        units: { result: 'board feet', conversion: '1 board foot = 144 cubic inches' }
    },
    'Foundation': {
        description: 'Calculates concrete volume for a foundation.',
        formula: 'Volume = Perimeter × Width × Depth',
        units: { result: 'm³ of concrete' }
    },
    'Fuel': {
        description: 'Calculates fuel consumption for vehicles or equipment.',
        formula: 'Fuel = (Distance ÷ Fuel_Efficiency) × Load_Factor',
        units: { result: 'liters or gallons', conversion: '1 gallon = 3.785 L' }
    },
    'Carrying': {
        description: 'Calculates trips needed to transport a load.',
        formula: 'Trips = Total_Weight ÷ Carrying_Capacity (round up)',
        units: { result: 'number of trips', weight: 'kg or lbs' }
    },
    'Travel Time': {
        description: 'Estimates travel time accounting for terrain.',
        formula: 'Time = Distance ÷ (Speed × Terrain_Factor)',
        units: { result: 'hours', distance: 'km', speed: 'km/h' },
        terrainFactors: 'Road: 1.0 | Trail: 0.6 | Cross-country: 0.3 | Mountain: 0.2'
    },
    'Dosage': {
        description: 'Calculates medication dosage based on body weight.',
        formula: 'Dose = Weight × Dose_per_kg',
        units: { result: 'mg or mL', weight: 'kg' },
        warning: 'Always verify with medical professional or package instructions'
    },
    'Hydration': {
        description: 'Calculates oral rehydration solution needs for dehydration.',
        formula: 'Initial ORS = Weight_kg × Dehydration_Factor × 10-20 mL',
        units: { result: 'mL of ORS solution' },
        orsRecipe: '1L water + 6 tsp sugar + ½ tsp salt'
    },
    'Med Supplies': {
        description: 'Estimates medical supplies needed for a group over time.',
        formula: 'Based on group size, duration, and risk level',
        units: { result: 'supply quantities' }
    },
    'Radio Range': {
        description: 'Estimates two-way radio communication range.',
        formula: 'Range = √(Power_Watts × Frequency_Factor × Terrain_Factor)',
        units: { result: 'km', power: 'watts' },
        typical: 'Handheld (5W): 2-8 km | Mobile (25W): 8-25 km | Base (50W+): 25-80+ km'
    },
    'Antenna Length': {
        description: 'Calculates optimal antenna length for a frequency.',
        formula: 'Length = (300 ÷ Frequency_MHz) × Wave_Fraction',
        units: { result: 'meters', frequency: 'MHz' },
        waveFractions: 'Full wave: 1.0 | Half wave: 0.5 | Quarter wave: 0.25'
    },
    'Line of Sight': {
        description: 'Calculates radio line-of-sight distance between two points.',
        formula: 'Distance_km = 4.12 × (√h1 + √h2) where h in meters',
        units: { result: 'km', height: 'meters above ground' }
    },
    'Force': {
        description: 'Calculates force using Newton\'s second law.',
        formula: 'F = m × a (Force = mass × acceleration)',
        units: { result: 'Newtons (N)', mass: 'kg', acceleration: 'm/s²' }
    },
    "Ohm's Law": {
        description: 'Calculates voltage, current, or resistance in electrical circuits.',
        formula: 'V = I × R | I = V ÷ R | R = V ÷ I',
        units: { voltage: 'Volts (V)', current: 'Amps (A)', resistance: 'Ohms (Ω)' }
    },
    'Percentage': {
        description: 'Various percentage calculations.',
        formula: 'Percent = (Part ÷ Whole) × 100',
        units: { result: '%' }
    },
    'Ratio': {
        description: 'Calculates ratios and proportions.',
        formula: 'a:b = c:d → b×c = a×d',
        units: { result: 'ratio value' }
    },
    'Compound Interest': {
        description: 'Calculates future value with compound interest.',
        formula: 'FV = PV × (1 + r/n)^(n×t)',
        units: { result: 'future value', rate: 'annual rate (decimal)', n: 'compounds/year' }
    }
};

function generatePrintablePDF() {
    // Group calculations by type for organized output
    const grouped = {};
    calculationHistory.forEach(entry => {
        if (!grouped[entry.type]) {
            grouped[entry.type] = [];
        }
        grouped[entry.type].push(entry);
    });

    // Build HTML content for printing
    const printDate = new Date().toLocaleString();
    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>SPS Calculations Reference - ${new Date().toLocaleDateString()}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 10pt;
            line-height: 1.4;
            color: #333;
            padding: 0.4in;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #2c5f2d;
            padding-bottom: 12px;
            margin-bottom: 15px;
        }
        .header h1 {
            color: #2c5f2d;
            font-size: 22pt;
            margin-bottom: 3px;
        }
        .header .subtitle {
            color: #666;
            font-size: 9pt;
        }
        .section {
            margin-bottom: 18px;
            page-break-inside: avoid;
        }
        .section-title {
            background: #2c5f2d;
            color: white;
            padding: 6px 10px;
            font-size: 11pt;
            font-weight: bold;
            margin-bottom: 8px;
            border-radius: 3px;
        }
        .calc-description {
            background: #f0f7f0;
            padding: 10px;
            margin-bottom: 10px;
            border-left: 3px solid #2c5f2d;
            font-size: 9pt;
        }
        .calc-description p {
            margin-bottom: 5px;
        }
        .calc-description .formula {
            font-family: 'Consolas', 'Courier New', monospace;
            background: #e8f5e9;
            padding: 4px 8px;
            margin: 5px 0;
            border-radius: 3px;
            white-space: pre-wrap;
            font-size: 8.5pt;
        }
        .calc-description .units {
            color: #555;
            font-size: 8.5pt;
        }
        .calc-description .units strong {
            color: #2c5f2d;
        }
        .calc-description .tip {
            color: #e65100;
            font-size: 8.5pt;
            font-style: italic;
            margin-top: 5px;
        }
        .calc-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
            margin-bottom: 8px;
        }
        .calc-table th {
            background: #f5f5f5;
            border: 1px solid #ddd;
            padding: 6px;
            text-align: left;
            font-weight: 600;
            font-size: 8.5pt;
        }
        .calc-table td {
            border: 1px solid #ddd;
            padding: 6px;
            vertical-align: top;
        }
        .calc-table tr:nth-child(even) {
            background: #fafafa;
        }
        .result {
            font-weight: bold;
            color: #2c5f2d;
        }
        .inputs {
            font-size: 8pt;
            color: #555;
        }
        .inputs span {
            display: inline-block;
            background: #e8f5e9;
            padding: 1px 5px;
            margin: 1px;
            border-radius: 2px;
            font-family: monospace;
            font-size: 7.5pt;
        }
        .timestamp {
            font-size: 8pt;
            color: #888;
        }
        .footer {
            margin-top: 25px;
            padding-top: 12px;
            border-top: 2px solid #2c5f2d;
            text-align: center;
            font-size: 8pt;
            color: #666;
        }
        .quick-ref {
            background: #fff3e0;
            border: 1px solid #ffb74d;
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 18px;
        }
        .quick-ref h3 {
            color: #e65100;
            margin-bottom: 8px;
            font-size: 11pt;
        }
        .quick-ref-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
        }
        .quick-ref-item {
            font-size: 9pt;
            padding: 4px 8px;
            background: rgba(255,255,255,0.7);
            border-radius: 3px;
        }
        .quick-ref-item strong {
            color: #333;
        }
        .measurement-ref {
            background: #e3f2fd;
            border: 1px solid #90caf9;
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 18px;
            page-break-inside: avoid;
        }
        .measurement-ref h3 {
            color: #1565c0;
            margin-bottom: 8px;
            font-size: 11pt;
        }
        .measurement-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 6px;
            font-size: 8pt;
        }
        .measurement-item {
            background: rgba(255,255,255,0.8);
            padding: 4px 6px;
            border-radius: 2px;
        }
        @media print {
            body { padding: 0.25in; font-size: 9pt; }
            .section { page-break-inside: avoid; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>SPS Calculations Reference</h1>
        <div class="subtitle">Survival Preparedness System - Calculation History & Formulas</div>
        <div class="subtitle">Generated: ${printDate}</div>
    </div>
`;

    // Add quick reference summary if we have enough data
    const summaryTypes = ['Daily Calories', 'Water Needs', 'Solar Output', 'Battery Sizing', 'Ration Planning', 'Fuel', 'Supply Duration'];
    const summaryItems = summaryTypes.map(type => grouped[type]?.[0]).filter(Boolean);

    if (summaryItems.length > 0) {
        html += `
    <div class="quick-ref">
        <h3>Your Key Numbers - Quick Reference</h3>
        <div class="quick-ref-grid">
`;
        summaryItems.forEach(item => {
            html += `            <div class="quick-ref-item"><strong>${item.type}:</strong> ${item.result}</div>\n`;
        });
        html += `        </div>
    </div>
`;
    }

    // Add common measurement conversions reference
    html += `
    <div class="measurement-ref">
        <h3>Common Measurements & Conversions</h3>
        <div class="measurement-grid">
            <div class="measurement-item"><strong>Weight:</strong> 1 lb = 0.454 kg</div>
            <div class="measurement-item"><strong>Length:</strong> 1 in = 2.54 cm</div>
            <div class="measurement-item"><strong>Volume:</strong> 1 gal = 3.785 L</div>
            <div class="measurement-item"><strong>Area:</strong> 1 acre = 4,047 m²</div>
            <div class="measurement-item"><strong>Temp:</strong> °C = (°F-32) × 5/9</div>
            <div class="measurement-item"><strong>Energy:</strong> 1 kWh = 1000 Wh</div>
            <div class="measurement-item"><strong>Pressure:</strong> 1 atm = 14.7 psi</div>
            <div class="measurement-item"><strong>Speed:</strong> 1 mph = 1.609 km/h</div>
            <div class="measurement-item"><strong>Water:</strong> 1 L water = 1 kg</div>
        </div>
    </div>
`;

    // Add each calculation type as a section with detailed info
    Object.keys(grouped).sort().forEach(type => {
        const entries = grouped[type];
        const ref = calculationReference[type] || {};

        html += `
    <div class="section">
        <div class="section-title">${type} (${entries.length} calculation${entries.length > 1 ? 's' : ''})</div>
`;

        // Add detailed description and formula if available
        if (ref.description || ref.formula) {
            html += `        <div class="calc-description">
`;
            if (ref.description) {
                html += `            <p><strong>What it does:</strong> ${ref.description}</p>\n`;
            }
            if (ref.formula) {
                html += `            <div class="formula">${ref.formula}</div>\n`;
            }
            if (ref.units) {
                const unitsStr = Object.entries(ref.units).map(([k, v]) => `<strong>${formatInputKey(k)}:</strong> ${v}`).join(' | ');
                html += `            <p class="units">${unitsStr}</p>\n`;
            }
            if (ref.tips) {
                html += `            <p class="tip">${ref.tips}</p>\n`;
            } else if (ref.typical) {
                html += `            <p class="tip">${ref.typical}</p>\n`;
            } else if (ref.activityMultipliers) {
                html += `            <p class="tip">${ref.activityMultipliers}</p>\n`;
            } else if (ref.baseAmounts) {
                html += `            <p class="tip">${ref.baseAmounts}</p>\n`;
            } else if (ref.efficiency) {
                html += `            <p class="tip">${ref.efficiency}</p>\n`;
            } else if (ref.depthOfDischarge) {
                html += `            <p class="tip">${ref.depthOfDischarge}</p>\n`;
            }
            html += `        </div>\n`;
        }

        html += `        <table class="calc-table">
            <thead>
                <tr>
                    <th style="width: 30%">Result</th>
                    <th style="width: 50%">Input Values Used</th>
                    <th style="width: 20%">Calculated</th>
                </tr>
            </thead>
            <tbody>
`;
        entries.forEach(entry => {
            const dt = new Date(entry.timestamp);
            const dateStr = dt.toLocaleDateString();
            const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            let inputsHtml = '';
            if (entry.inputs && typeof entry.inputs === 'object') {
                inputsHtml = Object.entries(entry.inputs)
                    .map(([key, val]) => `<span>${formatInputKey(key)}: ${val}</span>`)
                    .join(' ');
            }

            html += `                <tr>
                    <td class="result">${entry.result}</td>
                    <td class="inputs">${inputsHtml || '-'}</td>
                    <td class="timestamp">${dateStr}<br>${timeStr}</td>
                </tr>
`;
        });
        html += `            </tbody>
        </table>
    </div>
`;
    });

    // Add footer with helpful notes
    html += `
    <div class="footer">
        <p><strong>SPS - Survival Preparedness System</strong></p>
        <p>Total Calculations: ${calculationHistory.length} | Categories: ${Object.keys(grouped).length}</p>
        <p style="margin-top: 8px; font-style: italic;">Keep this reference in your emergency supplies. Formulas can be worked by hand with basic arithmetic.</p>
        <p style="margin-top: 5px;">For manual calculations: carry a pencil, paper, and simple calculator in your emergency kit.</p>
    </div>
</body>
</html>`;

    // Open in new window and trigger print
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
        alert('Please allow popups to generate the PDF.');
        return;
    }
    printWindow.document.write(html);
    printWindow.document.close();

    // Wait for content to load then print
    printWindow.onload = function() {
        printWindow.focus();
        printWindow.print();
    };
}

// Helper to format input keys for display
function formatInputKey(key) {
    // Convert camelCase to readable format
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .replace(/_/g, ' ')
        .trim();
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ================================
// ARITHMETIC & FINANCIAL CALCULATORS
// ================================

function updatePctInputs() {
    // Helper for percentage calculator type switching - no action needed
}

function calculatePercentage() {
    const type = document.getElementById('pct-type').value;
    const x = parseFloat(document.getElementById('pct-x').value);
    const y = parseFloat(document.getElementById('pct-y').value);

    let result, description;

    switch(type) {
        case 'percent-of':
            result = (x / 100) * y;
            description = `${x}% of ${y} = ${result.toFixed(2)}`;
            break;
        case 'what-percent':
            result = (x / y) * 100;
            description = `${x} is ${result.toFixed(2)}% of ${y}`;
            break;
        case 'percent-change':
            result = ((y - x) / x) * 100;
            description = `Change from ${x} to ${y} = ${result.toFixed(2)}%`;
            break;
    }

    showResult('pct-results', `
        <h4>Percentage Result</h4>
        <div class="result-value">${description}</div>
    `);

    saveToHistory('Percentage', description, { type, x, y });
}

function calculateRatio() {
    const a = parseFloat(document.getElementById('ratio-a').value);
    const b = parseFloat(document.getElementById('ratio-b').value);
    const total = parseFloat(document.getElementById('ratio-total').value);

    const sum = a + b;
    const partA = (a / sum) * total;
    const partB = (b / sum) * total;
    const gcd = (x, y) => y === 0 ? x : gcd(y, x % y);
    const divisor = gcd(a, b);
    const simplifiedA = a / divisor;
    const simplifiedB = b / divisor;

    showResult('ratio-results', `
        <h4>Ratio Division</h4>
        <div class="result-value">${partA.toFixed(2)} : ${partB.toFixed(2)}</div>
        <div class="result-detail">Total ${total} divided in ratio ${a}:${b}</div>
        <div class="result-detail">Simplified ratio: ${simplifiedA}:${simplifiedB}</div>
        <div class="result-detail">Part A: ${partA.toFixed(2)} (${((a/sum)*100).toFixed(1)}%)</div>
        <div class="result-detail">Part B: ${partB.toFixed(2)} (${((b/sum)*100).toFixed(1)}%)</div>
    `);

    saveToHistory('Ratio', `${total} in ${a}:${b} = ${partA.toFixed(2)}:${partB.toFixed(2)}`, { a, b, total });
}

function calculateCompoundInterest() {
    const principal = parseFloat(document.getElementById('ci-principal').value);
    const rate = parseFloat(document.getElementById('ci-rate').value) / 100;
    const years = parseFloat(document.getElementById('ci-years').value);
    const compounds = parseInt(document.getElementById('ci-compound').value);

    const amount = principal * Math.pow(1 + (rate / compounds), compounds * years);
    const interest = amount - principal;
    const effectiveRate = (Math.pow(1 + rate/compounds, compounds) - 1) * 100;

    showResult('ci-results', `
        <h4>Compound Interest</h4>
        <div class="result-value">$${amount.toFixed(2)}</div>
        <div class="result-detail">Principal: $${principal.toFixed(2)}</div>
        <div class="result-detail">Interest earned: $${interest.toFixed(2)}</div>
        <div class="result-detail">Effective annual rate: ${effectiveRate.toFixed(2)}%</div>
        <div class="result-detail">Compounded ${compounds}x/year for ${years} years</div>
    `);

    saveToHistory('Compound Interest', `$${principal} → $${amount.toFixed(2)} over ${years}yrs`, { principal, rate: rate*100, years, compounds });
}

function calculateInflation() {
    const amount = parseFloat(document.getElementById('infl-amount').value);
    const rate = parseFloat(document.getElementById('infl-rate').value) / 100;
    const years = parseFloat(document.getElementById('infl-years').value);

    const futureValue = amount * Math.pow(1 + rate, years);
    const realValue = amount / Math.pow(1 + rate, years);
    const totalInflation = ((futureValue / amount) - 1) * 100;

    showResult('infl-results', `
        <h4>Inflation Impact</h4>
        <div class="result-value">$${futureValue.toFixed(2)} future cost</div>
        <div class="result-detail">Today's $${amount} will need $${futureValue.toFixed(2)} in ${years} years</div>
        <div class="result-detail">Today's $${amount} is worth $${realValue.toFixed(2)} in ${years} years</div>
        <div class="result-detail">Total inflation over period: ${totalInflation.toFixed(1)}%</div>
        <div class="result-detail">Annual inflation rate: ${(rate*100).toFixed(1)}%</div>
    `);

    saveToHistory('Inflation', `$${amount} @ ${(rate*100)}%/yr = $${futureValue.toFixed(2)} in ${years}yrs`, { amount, rate: rate*100, years });
}

// ================================
// BARTER & TRADE CALCULATORS
// ================================

function calculateBarter() {
    const haveSelect = document.getElementById('barter-have');
    const wantSelect = document.getElementById('barter-want');
    const haveValue = parseFloat(haveSelect.value);
    const haveName = haveSelect.selectedOptions[0].dataset.name;
    const haveQty = parseFloat(document.getElementById('barter-qty-have').value);
    const wantValue = parseFloat(wantSelect.value);
    const wantName = wantSelect.selectedOptions[0].dataset.name;

    const totalHaveValue = haveValue * haveQty;
    const equivalentWantQty = totalHaveValue / wantValue;
    const exchangeRate = haveValue / wantValue;

    showResult('barter-results', `
        <h4>Fair Trade Value</h4>
        <div class="result-value">${haveQty} ${haveName} = ${equivalentWantQty.toFixed(2)} ${wantName}</div>
        <div class="result-detail">Your total value: ${totalHaveValue} units</div>
        <div class="result-detail">Exchange rate: 1 ${haveName} = ${exchangeRate.toFixed(3)} ${wantName}</div>
        <div class="result-detail">Reverse: 1 ${wantName} = ${(1/exchangeRate).toFixed(3)} ${haveName}</div>
    `);

    saveToHistory('Barter', `${haveQty} ${haveName} ↔ ${equivalentWantQty.toFixed(2)} ${wantName}`, { haveName, haveValue, haveQty, wantName, wantValue });
}

function calculateLaborValue() {
    const skillMultiplier = parseFloat(document.getElementById('labor-type').value);
    const hoursWorked = parseFloat(document.getElementById('labor-hours').value);
    const baseRate = parseFloat(document.getElementById('labor-base').value);

    const baseValue = baseRate * hoursWorked;
    const adjustedValue = baseValue * skillMultiplier;

    showResult('labor-results', `
        <h4>Labor Trade Value</h4>
        <div class="result-value">${adjustedValue.toFixed(1)} kg rice equivalent</div>
        <div class="result-detail">Hours worked: ${hoursWorked}</div>
        <div class="result-detail">Base rate: ${baseRate} kg/hr × Skill: ${skillMultiplier}x</div>
        <div class="result-detail">Can trade for: ~${(adjustedValue * 1000).toFixed(0)} calories of food</div>
    `);

    saveToHistory('Labor Value', `${hoursWorked}hrs = ${adjustedValue.toFixed(1)}kg rice equiv`, { skillMultiplier, hoursWorked, baseRate });
}

// ================================
// VEHICLE & MECHANICAL CALCULATORS
// ================================

function calculate2StrokeMix() {
    const fuelLiters = parseFloat(document.getElementById('mix-fuel').value);
    const ratio = parseInt(document.getElementById('mix-ratio').value);

    const oilMl = (fuelLiters * 1000) / ratio;
    const oilOz = oilMl / 29.5735;

    showResult('mix-results', `
        <h4>2-Stroke Fuel Mix</h4>
        <div class="result-value">${oilMl.toFixed(0)} mL oil</div>
        <div class="result-detail">For ${fuelLiters}L fuel at ${ratio}:1 ratio</div>
        <div class="result-detail">${oilMl.toFixed(0)} mL = ${oilOz.toFixed(1)} fl oz</div>
        <div class="result-detail">Always add oil to fuel, then mix thoroughly</div>
    `);

    saveToHistory('2-Stroke Mix', `${fuelLiters}L @ ${ratio}:1 = ${oilMl.toFixed(0)}mL oil`, { fuelLiters, ratio });
}

function calculateGearRatio() {
    const driverTeeth = parseInt(document.getElementById('gear-drive').value);
    const drivenTeeth = parseInt(document.getElementById('gear-driven').value);
    const inputRPM = parseFloat(document.getElementById('gear-rpm').value);

    const ratio = drivenTeeth / driverTeeth;
    const outputRPM = inputRPM / ratio;
    const torqueMultiplier = ratio;

    showResult('gear-results', `
        <h4>Gear Ratio</h4>
        <div class="result-value">${ratio.toFixed(3)}:1</div>
        <div class="result-detail">Driver: ${driverTeeth}T → Driven: ${drivenTeeth}T</div>
        <div class="result-detail">Input: ${inputRPM} RPM → Output: ${outputRPM.toFixed(1)} RPM</div>
        <div class="result-detail">Torque multiplier: ${torqueMultiplier.toFixed(2)}x</div>
        <div class="result-detail">${ratio > 1 ? 'Speed reduction / Torque increase' : 'Speed increase / Torque reduction'}</div>
    `);

    saveToHistory('Gear Ratio', `${driverTeeth}:${drivenTeeth} = ${ratio.toFixed(3)}:1`, { driverTeeth, drivenTeeth, inputRPM });
}

function calculateTireSpeed() {
    const tireWidth = parseFloat(document.getElementById('tire-width').value);
    const aspectRatio = parseFloat(document.getElementById('tire-aspect').value);
    const wheelDiam = parseFloat(document.getElementById('tire-wheel').value);
    const rpm = parseFloat(document.getElementById('tire-rpm').value);

    // Calculate tire diameter: wheel + 2*(sidewall height)
    const sidewallHeight = (tireWidth * aspectRatio / 100) / 25.4; // mm to inches
    const tireDiameter = wheelDiam + (2 * sidewallHeight);
    const circumference = Math.PI * (tireDiameter * 25.4 / 1000); // to meters

    const speedMPS = (circumference * rpm) / 60;
    const speedKPH = speedMPS * 3.6;
    const speedMPH = speedKPH * 0.621371;

    showResult('tire-results', `
        <h4>Tire Size & Speed</h4>
        <div class="result-value">${speedMPH.toFixed(1)} mph (${speedKPH.toFixed(1)} km/h)</div>
        <div class="result-detail">Tire: ${tireWidth}/${aspectRatio}R${wheelDiam}</div>
        <div class="result-detail">Overall diameter: ${tireDiameter.toFixed(1)}"</div>
        <div class="result-detail">Circumference: ${(circumference * 39.37).toFixed(1)}" (${(circumference * 100).toFixed(1)} cm)</div>
        <div class="result-detail">At ${rpm} RPM wheel speed</div>
    `);

    saveToHistory('Tire Speed', `${tireWidth}/${aspectRatio}R${wheelDiam} @ ${rpm}RPM = ${speedMPH.toFixed(1)}mph`, { tireWidth, aspectRatio, wheelDiam, rpm });
}

// ================================
// FOOD PRESERVATION CALCULATORS
// ================================

function calculateSaltCure() {
    const meatWeight = parseFloat(document.getElementById('cure-meat').value);
    const saltPercent = parseFloat(document.getElementById('cure-method').value);

    const salt = meatWeight * saltPercent * 1000; // grams
    const sugar = salt * 0.4; // 40% of salt is common
    const cureTime = Math.ceil(meatWeight * 7); // ~7 days per kg

    showResult('cure-results', `
        <h4>Salt Curing Recipe</h4>
        <div class="result-value">${salt.toFixed(0)}g salt</div>
        <div class="result-detail">For ${meatWeight}kg meat at ${(saltPercent * 100).toFixed(1)}% cure</div>
        <div class="result-detail">Salt: ${salt.toFixed(0)}g</div>
        <div class="result-detail">Sugar (optional): ${sugar.toFixed(0)}g</div>
        <div class="result-detail">Cure time: ~${cureTime} days</div>
        <div class="result-warning">Keep refrigerated at 36-40°F (2-4°C) during cure</div>
    `);

    saveToHistory('Salt Cure', `${meatWeight}kg meat: ${salt.toFixed(0)}g salt`, { meatWeight, saltPercent });
}

function calculateCanning() {
    const foodSelect = document.getElementById('can-food');
    const foodData = foodSelect.value.split(',');
    const basePressure = parseInt(foodData[0]);
    const pintTime = parseInt(foodData[1]);
    const quartTime = parseInt(foodData[2]);
    const altitude = parseFloat(document.getElementById('can-altitude').value);
    const jarSize = document.getElementById('can-size').value;

    const baseTime = jarSize === 'pint' ? pintTime : quartTime;

    // Altitude adjustments
    let pressureAdjust = 0;
    if (altitude > 1000 && altitude <= 2000) pressureAdjust = 1;
    else if (altitude > 2000 && altitude <= 4000) pressureAdjust = 2;
    else if (altitude > 4000 && altitude <= 6000) pressureAdjust = 3;
    else if (altitude > 6000) pressureAdjust = 4;

    const adjustedPressure = basePressure + pressureAdjust;

    showResult('can-results', `
        <h4>Canning Guidelines</h4>
        <div class="result-value">${baseTime} minutes @ ${adjustedPressure} PSI</div>
        <div class="result-detail">Jar size: ${jarSize}</div>
        <div class="result-detail">Altitude: ${altitude} ft</div>
        <div class="result-detail">Base pressure: ${basePressure} PSI + ${pressureAdjust} altitude adjustment</div>
        <div class="result-warning">Always use tested recipes from USDA or NCHFP guidelines</div>
    `);

    saveToHistory('Canning', `${jarSize} @ ${altitude}ft: ${baseTime}min @ ${adjustedPressure}PSI`, { altitude, baseTime, adjustedPressure });
}

function calculateBread() {
    const flourWeight = parseFloat(document.getElementById('bread-flour').value);
    const hydration = parseFloat(document.getElementById('bread-hydration').value);
    const saltPercent = parseFloat(document.getElementById('bread-salt').value);

    const water = flourWeight * (hydration / 100);
    const salt = flourWeight * (saltPercent / 100);
    const yeast = flourWeight * 0.01; // ~1% yeast is typical
    const totalWeight = flourWeight + water + salt + yeast;

    showResult('bread-results', `
        <h4>Bread Dough Formula</h4>
        <div class="result-value">${totalWeight.toFixed(0)}g total dough</div>
        <div class="result-detail">Flour: ${flourWeight}g (100%)</div>
        <div class="result-detail">Water: ${water.toFixed(0)}g (${hydration}%)</div>
        <div class="result-detail">Salt: ${salt.toFixed(1)}g (${saltPercent}%)</div>
        <div class="result-detail">Yeast: ~${yeast.toFixed(1)}g (1%)</div>
        <div class="result-detail">Baker's percentages shown relative to flour weight</div>
    `);

    saveToHistory('Bread Dough', `${flourWeight}g flour @ ${hydration}% = ${totalWeight.toFixed(0)}g dough`, { flourWeight, hydration, saltPercent });
}

// ================================
// WATER SYSTEMS ADVANCED CALCULATORS
// ================================

function calculateWellOutput() {
    const staticLevel = parseFloat(document.getElementById('well-static').value);
    const drawdownLevel = parseFloat(document.getElementById('well-drawdown').value);
    const pumpRate = parseFloat(document.getElementById('well-rate').value);
    const recoveryTime = parseFloat(document.getElementById('well-recovery').value);

    const drawdown = drawdownLevel - staticLevel;
    const specificCapacity = pumpRate / drawdown;
    const recoveryGallons = pumpRate * 60 * recoveryTime; // gallons pumped before recovery
    const dailySafeOutput = recoveryGallons * (24 / (recoveryTime + 1)); // sustainable cycling

    showResult('well-results', `
        <h4>Well Output Analysis</h4>
        <div class="result-value">${pumpRate} GPM pump rate</div>
        <div class="result-detail">Static: ${staticLevel}ft | Drawdown to: ${drawdownLevel}ft</div>
        <div class="result-detail">Drawdown: ${drawdown}ft | Recovery: ${recoveryTime}hrs</div>
        <div class="result-detail">Specific capacity: ${specificCapacity.toFixed(2)} GPM/ft</div>
        <div class="result-detail">Est. daily sustainable: ${dailySafeOutput.toFixed(0)} gallons</div>
        <div class="result-detail">${(dailySafeOutput * 3.785).toFixed(0)} liters/day</div>
    `);

    saveToHistory('Well Output', `${pumpRate}GPM, ${dailySafeOutput.toFixed(0)} gal/day sustainable`, { staticLevel, drawdownLevel, pumpRate, recoveryTime });
}

function calculatePipeFlow() {
    const diameter = parseFloat(document.getElementById('pipe-diameter').value);
    const length = parseFloat(document.getElementById('pipe-length').value);
    const pressure = parseFloat(document.getElementById('pipe-pressure').value);

    // Convert to metric for calculation
    const diameterM = diameter * 0.0254; // inches to meters
    const lengthM = length * 0.3048; // feet to meters
    const headM = pressure * 0.703; // psi to meters of head

    const area = Math.PI * Math.pow(diameterM / 2, 2);

    // Simplified Hazen-Williams (C=140 for PVC)
    const velocity = 0.849 * 140 * Math.pow(diameterM / 2, 0.63) * Math.pow(headM / lengthM, 0.54);
    const flowLPS = area * velocity * 1000; // liters per second
    const flowGPM = flowLPS * 15.85;

    showResult('pipe-results', `
        <h4>Pipe Flow Rate</h4>
        <div class="result-value">${flowGPM.toFixed(1)} GPM</div>
        <div class="result-detail">${flowLPS.toFixed(2)} L/s</div>
        <div class="result-detail">Pipe: ${diameter}" × ${length}ft | Pressure: ${pressure} PSI</div>
        <div class="result-detail">Velocity: ${(velocity * 3.28).toFixed(2)} ft/s</div>
        <div class="result-warning">Based on PVC pipe (C=140). Actual flow varies with material.</div>
    `);

    saveToHistory('Pipe Flow', `${diameter}" pipe @ ${pressure}PSI: ${flowGPM.toFixed(1)} GPM`, { diameter, length, pressure });
}

function calculateSeptic() {
    const bedrooms = parseInt(document.getElementById('septic-beds').value);
    const dailyUsage = parseInt(document.getElementById('septic-usage').value);
    const peoplePerBed = parseFloat(document.getElementById('septic-people').value);

    const totalPeople = bedrooms * peoplePerBed;
    const dailyFlow = totalPeople * dailyUsage;

    // Standard septic tank sizing
    let tankGallons;
    if (bedrooms <= 2) tankGallons = 1000;
    else if (bedrooms === 3) tankGallons = 1000;
    else if (bedrooms === 4) tankGallons = 1250;
    else tankGallons = 1500;

    // Add 250 gal for each bedroom over 4
    if (bedrooms > 4) tankGallons += (bedrooms - 4) * 250;

    showResult('septic-results', `
        <h4>Septic System Sizing</h4>
        <div class="result-value">${tankGallons} gallon tank minimum</div>
        <div class="result-detail">${bedrooms} bedrooms × ${peoplePerBed} = ${totalPeople} people</div>
        <div class="result-detail">Daily flow: ${dailyFlow} gallons/day</div>
        <div class="result-detail">Tank capacity: ${(tankGallons / dailyFlow).toFixed(1)} days retention</div>
        <div class="result-warning">Verify with local codes. May need larger for garbage disposal.</div>
    `);

    saveToHistory('Septic Sizing', `${bedrooms}BR: ${tankGallons}gal tank`, { bedrooms, dailyUsage, totalPeople });
}

// ================================
// STRUCTURAL ENGINEERING CALCULATORS
// ================================

function calculateRoofLoad() {
    const roofArea = parseFloat(document.getElementById('roof-area').value);
    const snowDepth = parseFloat(document.getElementById('roof-snow').value);
    const snowType = parseFloat(document.getElementById('roof-type').value);

    const snowLoad = snowDepth * snowType; // lb/sqft
    const deadLoad = 10; // Typical roofing materials ~10 PSF
    const totalLoad = snowLoad + deadLoad;
    const totalWeight = roofArea * totalLoad;
    const totalWeightKg = totalWeight * 0.453592;

    showResult('roof-results', `
        <h4>Roof Load Analysis</h4>
        <div class="result-value">${totalWeight.toFixed(0)} lbs total</div>
        <div class="result-detail">Roof area: ${roofArea} sq ft</div>
        <div class="result-detail">Snow: ${snowDepth}" × ${snowType} lb/in/sqft = ${snowLoad.toFixed(1)} PSF</div>
        <div class="result-detail">Dead load: ${deadLoad} PSF | Total: ${totalLoad.toFixed(1)} PSF</div>
        <div class="result-detail">Total weight: ${totalWeightKg.toFixed(0)} kg</div>
        <div class="result-warning">Remove snow if load exceeds design capacity (typically 20-40 PSF)</div>
    `);

    saveToHistory('Roof Load', `${roofArea}sqft @ ${totalLoad.toFixed(1)}PSF = ${totalWeight.toFixed(0)}lbs`, { roofArea, snowDepth, snowType });
}

function calculateBeam() {
    const fb = parseInt(document.getElementById('beam-wood').value);
    const width = parseFloat(document.getElementById('beam-width').value);
    const height = parseFloat(document.getElementById('beam-height').value);
    const span = parseFloat(document.getElementById('beam-span').value);

    // Section modulus S = bh²/6
    const sectionModulus = (width * height * height) / 6;

    // Maximum moment M = fb × S
    const maxMoment = fb * sectionModulus; // lb-in
    const maxMomentFtLb = maxMoment / 12;

    // Max uniform load w = 8M / L²
    const maxUniformLoad = (8 * maxMomentFtLb) / (span * span);

    // Point load at center = 4M / L
    const maxPointLoad = (4 * maxMomentFtLb) / span;

    showResult('beam-results', `
        <h4>Beam Capacity</h4>
        <div class="result-value">${maxUniformLoad.toFixed(0)} lb/ft max uniform load</div>
        <div class="result-detail">Beam: ${width}" × ${height}" × ${span}ft span</div>
        <div class="result-detail">Section modulus: ${sectionModulus.toFixed(1)} in³</div>
        <div class="result-detail">Max center point load: ${maxPointLoad.toFixed(0)} lbs</div>
        <div class="result-detail">Allowable stress: ${fb} psi</div>
        <div class="result-warning">Simplified calculation. Consult engineer for actual design.</div>
    `);

    saveToHistory('Beam Capacity', `${width}"×${height}"×${span}ft: ${maxUniformLoad.toFixed(0)}lb/ft`, { width, height, span, fb });
}

function calculateRope() {
    const strengthPerSqIn = parseInt(document.getElementById('rope-type').value);
    const diameter = parseFloat(document.getElementById('rope-diameter').value);
    const safetyFactor = parseInt(document.getElementById('rope-safety').value);

    const area = Math.PI * Math.pow(diameter / 2, 2);
    const breakingStrength = area * strengthPerSqIn;
    const safeWorkingLoad = breakingStrength / safetyFactor;
    const swlKg = safeWorkingLoad * 0.453592;

    showResult('rope-results', `
        <h4>Rope Safe Working Load</h4>
        <div class="result-value">${safeWorkingLoad.toFixed(0)} lbs SWL</div>
        <div class="result-detail">${swlKg.toFixed(0)} kg safe working load</div>
        <div class="result-detail">Breaking strength: ${breakingStrength.toFixed(0)} lbs</div>
        <div class="result-detail">Diameter: ${diameter}" | Safety factor: ${safetyFactor}:1</div>
        <div class="result-warning">Reduce SWL by 50% for knots. Inspect rope regularly.</div>
    `);

    saveToHistory('Rope SWL', `${diameter}" rope: ${safeWorkingLoad.toFixed(0)}lbs SWL`, { diameter, strengthPerSqIn, safetyFactor });
}

function calculateInsulation() {
    const area = parseFloat(document.getElementById('insul-area').value);
    const rPerInch = parseFloat(document.getElementById('insul-type').value);
    const thickness = parseFloat(document.getElementById('insul-thick').value);

    const totalRValue = rPerInch * thickness;

    // Heat loss estimate for 40°F temp difference
    const tempDiff = 40;
    const heatLoss = (area * tempDiff) / totalRValue; // BTU/hr
    const heatLossKW = heatLoss * 0.000293071;

    // Recommended R-values by climate
    let recommendation = '';
    if (totalRValue < 13) recommendation = 'Below minimum for most climates';
    else if (totalRValue < 30) recommendation = 'Adequate for mild climates';
    else if (totalRValue < 49) recommendation = 'Good for cold climates';
    else recommendation = 'Excellent insulation';

    showResult('insul-results', `
        <h4>Insulation Analysis</h4>
        <div class="result-value">R-${totalRValue.toFixed(1)} total</div>
        <div class="result-detail">${thickness}" thick @ R-${rPerInch}/inch</div>
        <div class="result-detail">Wall area: ${area} sq ft</div>
        <div class="result-detail">Heat loss @ 40°F diff: ${heatLoss.toFixed(0)} BTU/hr</div>
        <div class="result-detail">${recommendation}</div>
    `);

    saveToHistory('Insulation', `${thickness}" = R-${totalRValue.toFixed(1)}`, { area, rPerInch, thickness });
}

// ================================
// WEATHER & ASTRONOMY CALCULATORS
// ================================

function calculateWindChill() {
    const temp = parseFloat(document.getElementById('wc-temp').value);
    const wind = parseFloat(document.getElementById('wc-wind').value);

    // NWS Wind Chill Formula (valid for temps <= 50°F and wind >= 3 mph)
    let windChill;
    if (temp <= 50 && wind >= 3) {
        windChill = 35.74 + (0.6215 * temp) - (35.75 * Math.pow(wind, 0.16)) + (0.4275 * temp * Math.pow(wind, 0.16));
    } else {
        windChill = temp;
    }

    const windChillC = (windChill - 32) * 5/9;
    const frostbiteRisk = windChill < -20 ? 'High (< 30 min)' : windChill < 0 ? 'Moderate' : 'Low';

    showResult('wc-results', `
        <h4>Wind Chill</h4>
        <div class="result-value">${windChill.toFixed(1)}°F (${windChillC.toFixed(1)}°C)</div>
        <div class="result-detail">Air temp: ${temp}°F | Wind: ${wind} mph</div>
        <div class="result-detail">Frostbite risk: ${frostbiteRisk}</div>
        ${windChill < 0 ? '<div class="result-warning">Danger! Exposed skin can freeze quickly.</div>' : ''}
    `);

    saveToHistory('Wind Chill', `${temp}°F @ ${wind}mph = ${windChill.toFixed(1)}°F`, { temp, wind });
}

function calculateHeatIndex() {
    const temp = parseFloat(document.getElementById('hi-temp').value);
    const humidity = parseFloat(document.getElementById('hi-humidity').value);

    // NWS Heat Index Formula
    let heatIndex;
    if (temp >= 80) {
        heatIndex = -42.379 + 2.04901523*temp + 10.14333127*humidity
            - 0.22475541*temp*humidity - 0.00683783*temp*temp
            - 0.05481717*humidity*humidity + 0.00122874*temp*temp*humidity
            + 0.00085282*temp*humidity*humidity - 0.00000199*temp*temp*humidity*humidity;
    } else {
        heatIndex = temp;
    }

    const heatIndexC = (heatIndex - 32) * 5/9;
    let danger = 'Caution';
    if (heatIndex >= 130) danger = 'Extreme Danger - Heat stroke imminent';
    else if (heatIndex >= 105) danger = 'Danger - Heat exhaustion likely';
    else if (heatIndex >= 90) danger = 'Extreme Caution - Heat exhaustion possible';

    showResult('hi-results', `
        <h4>Heat Index</h4>
        <div class="result-value">${heatIndex.toFixed(1)}°F (${heatIndexC.toFixed(1)}°C)</div>
        <div class="result-detail">Air temp: ${temp}°F | Humidity: ${humidity}%</div>
        <div class="result-detail">Risk level: ${danger}</div>
        ${heatIndex >= 105 ? '<div class="result-warning">Limit outdoor activity. Stay hydrated!</div>' : ''}
    `);

    saveToHistory('Heat Index', `${temp}°F @ ${humidity}% = ${heatIndex.toFixed(1)}°F`, { temp, humidity });
}

function calculateDewPoint() {
    const temp = parseFloat(document.getElementById('dp-temp').value);
    const humidity = parseFloat(document.getElementById('dp-humidity').value);

    // Magnus formula for dew point
    const a = 17.27;
    const b = 237.7;
    const alpha = ((a * temp) / (b + temp)) + Math.log(humidity / 100);
    const dewPoint = (b * alpha) / (a - alpha);
    const dewPointF = (dewPoint * 9/5) + 32;

    let comfort = 'Comfortable';
    if (dewPoint > 24) comfort = 'Extremely uncomfortable, oppressive';
    else if (dewPoint > 21) comfort = 'Very humid, uncomfortable';
    else if (dewPoint > 18) comfort = 'Somewhat uncomfortable';
    else if (dewPoint < 10) comfort = 'Dry';

    showResult('dp-results', `
        <h4>Dew Point</h4>
        <div class="result-value">${dewPoint.toFixed(1)}°C (${dewPointF.toFixed(1)}°F)</div>
        <div class="result-detail">Temperature: ${temp}°C | Humidity: ${humidity}%</div>
        <div class="result-detail">Comfort level: ${comfort}</div>
        <div class="result-detail">Fog likely when air temp approaches dew point</div>
    `);

    saveToHistory('Dew Point', `${temp}°C @ ${humidity}% → ${dewPoint.toFixed(1)}°C dew point`, { temp, humidity });
}

function calculateSunPosition() {
    const latitude = parseFloat(document.getElementById('sun-lat').value);
    const dayOfYear = parseInt(document.getElementById('sun-day').value);
    const hour = parseFloat(document.getElementById('sun-hour').value);

    // Simplified solar position calculation
    const declination = 23.45 * Math.sin((360/365) * (dayOfYear - 81) * Math.PI/180);
    const hourAngle = 15 * (hour - 12); // 15° per hour from solar noon

    const latRad = latitude * Math.PI/180;
    const decRad = declination * Math.PI/180;
    const haRad = hourAngle * Math.PI/180;

    const altitude = Math.asin(Math.sin(latRad) * Math.sin(decRad) +
                               Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad));
    const altitudeDeg = altitude * 180/Math.PI;

    const azimuth = Math.atan2(Math.sin(haRad),
                               Math.cos(haRad) * Math.sin(latRad) - Math.tan(decRad) * Math.cos(latRad));
    let azimuthDeg = (azimuth * 180/Math.PI) + 180;

    const direction = azimuthDeg < 90 ? 'NE' : azimuthDeg < 180 ? 'SE' : azimuthDeg < 270 ? 'SW' : 'NW';

    showResult('sun-results', `
        <h4>Sun Position</h4>
        <div class="result-value">Altitude: ${altitudeDeg.toFixed(1)}°</div>
        <div class="result-detail">Azimuth: ${azimuthDeg.toFixed(1)}° (${direction})</div>
        <div class="result-detail">Day ${dayOfYear} | Hour: ${hour}:00 | Lat: ${latitude}°</div>
        <div class="result-detail">Solar declination: ${declination.toFixed(1)}°</div>
        ${altitudeDeg < 0 ? '<div class="result-detail">Sun is below horizon</div>' : ''}
    `);

    saveToHistory('Sun Position', `Day ${dayOfYear}, ${hour}:00 @ ${latitude}°: Alt ${altitudeDeg.toFixed(1)}°`, { latitude, dayOfYear, hour });
}

// ================================
// CHEMISTRY CALCULATORS
// ================================

function calculateDilution() {
    const c1 = parseFloat(document.getElementById('dil-c1').value);
    const v1 = parseFloat(document.getElementById('dil-v1').value);
    const c2 = parseFloat(document.getElementById('dil-c2').value);

    // C1V1 = C2V2, solve for V2
    const v2 = (c1 * v1) / c2;
    const waterToAdd = v2 - v1;

    showResult('dil-results', `
        <h4>Dilution Result</h4>
        <div class="result-value">${v2.toFixed(2)} mL final volume</div>
        <div class="result-detail">Starting: ${c1}% × ${v1} mL</div>
        <div class="result-detail">Target: ${c2}% concentration</div>
        <div class="result-detail">Add ${waterToAdd.toFixed(2)} mL water/solvent</div>
        <div class="result-detail">Formula: C₁V₁ = C₂V₂</div>
    `);

    saveToHistory('Dilution', `${c1}%×${v1}mL → ${c2}% = ${v2.toFixed(2)}mL`, { c1, v1, c2 });
}

function calculatePH() {
    const value = parseFloat(document.getElementById('ph-value').value);
    const type = document.getElementById('ph-type').value;

    let ph, hConc, ohConc, pOH;

    switch(type) {
        case 'ph':
            ph = value;
            hConc = Math.pow(10, -ph);
            break;
        case 'h':
            hConc = value;
            ph = -Math.log10(hConc);
            break;
        case 'oh':
            ohConc = value;
            pOH = -Math.log10(ohConc);
            ph = 14 - pOH;
            hConc = Math.pow(10, -ph);
            break;
    }

    pOH = 14 - ph;
    ohConc = Math.pow(10, -pOH);

    let nature = 'Neutral';
    if (ph < 7) nature = 'Acidic';
    else if (ph > 7) nature = 'Basic/Alkaline';

    showResult('ph-results', `
        <h4>pH Analysis</h4>
        <div class="result-value">pH = ${ph.toFixed(2)}</div>
        <div class="result-detail">[H⁺] = ${hConc.toExponential(2)} M</div>
        <div class="result-detail">[OH⁻] = ${ohConc.toExponential(2)} M</div>
        <div class="result-detail">pOH = ${pOH.toFixed(2)}</div>
        <div class="result-detail">Nature: ${nature}</div>
    `);

    saveToHistory('pH Calc', `pH ${ph.toFixed(2)} (${nature})`, { value, type });
}

// ================================
// SECURITY & DEFENSE CALCULATORS
// ================================

function calculateBallistics() {
    const velocity = parseFloat(document.getElementById('ball-velocity').value); // fps muzzle velocity
    const distance = parseFloat(document.getElementById('ball-distance').value); // yards
    const sightHeight = parseFloat(document.getElementById('ball-sight').value); // inches above bore

    // Convert to metric for calculation
    const velocityMPS = velocity * 0.3048; // fps to m/s
    const distanceM = distance * 0.9144; // yards to meters
    const sightHeightM = sightHeight * 0.0254; // inches to meters

    const g = 9.81;

    // Time of flight to target (simplified, no air resistance)
    const timeOfFlight = distanceM / velocityMPS;

    // Bullet drop at distance
    const drop = 0.5 * g * Math.pow(timeOfFlight, 2);
    const dropInches = drop / 0.0254;

    // Energy at muzzle (assuming typical bullet weight ~150gr = 9.7g)
    const bulletMassKg = 0.0097;
    const muzzleEnergy = 0.5 * bulletMassKg * Math.pow(velocityMPS, 2);
    const muzzleEnergyFtLbs = muzzleEnergy * 0.737562;

    showResult('ball-results', `
        <h4>Basic Ballistics</h4>
        <div class="result-value">${dropInches.toFixed(1)}" drop at ${distance} yards</div>
        <div class="result-detail">Muzzle velocity: ${velocity} fps (${velocityMPS.toFixed(0)} m/s)</div>
        <div class="result-detail">Time to target: ${(timeOfFlight * 1000).toFixed(0)} ms</div>
        <div class="result-detail">Sight height: ${sightHeight}" above bore</div>
        <div class="result-detail">Est. muzzle energy: ${muzzleEnergyFtLbs.toFixed(0)} ft-lbs</div>
        <div class="result-warning">Simplified. Does not account for air resistance, BC, or wind.</div>
    `);

    saveToHistory('Ballistics', `${velocity}fps @ ${distance}yds = ${dropInches.toFixed(1)}" drop`, { velocity, distance, sightHeight });
}

function calculateSandbags() {
    const length = parseFloat(document.getElementById('sand-length').value);
    const height = parseFloat(document.getElementById('sand-height').value);
    const thickness = parseInt(document.getElementById('sand-thick').value);

    // Standard sandbag: 14"×26" when filled = ~0.035 m² face
    const bagFace = 0.035; // m² per bag face
    const bagsPerLayer = Math.ceil(length / 0.65); // bags are ~26" (0.65m) long
    const layers = Math.ceil(height / 0.15); // filled bags are ~6" (0.15m) high
    const totalBags = bagsPerLayer * layers * thickness * 1.1; // 10% extra

    const sandKg = totalBags * 20; // ~20kg per filled bag
    const sandTons = sandKg / 1000;

    showResult('sand-results', `
        <h4>Sandbag Requirements</h4>
        <div class="result-value">${Math.ceil(totalBags)} sandbags</div>
        <div class="result-detail">Wall: ${length}m × ${height}m × ${thickness} bags thick</div>
        <div class="result-detail">Bags per row: ${bagsPerLayer} | Layers: ${layers}</div>
        <div class="result-detail">Sand needed: ~${sandKg.toFixed(0)} kg (${sandTons.toFixed(1)} tons)</div>
        <div class="result-detail">Includes 10% extra for overlap/waste</div>
    `);

    saveToHistory('Sandbags', `${length}m×${height}m×${thickness}: ${Math.ceil(totalBags)} bags`, { length, height, thickness });
}

function calculatePatrol() {
    const perimeter = parseFloat(document.getElementById('patrol-perimeter').value); // meters
    const guards = parseInt(document.getElementById('patrol-guards').value);
    const walkSpeed = parseFloat(document.getElementById('patrol-speed').value); // meters per minute

    // Calculate coverage
    const perimeterPerGuard = perimeter / guards;
    const patrolTimeMin = perimeterPerGuard / walkSpeed; // minutes to cover assigned section
    const circuitsPerHour = 60 / patrolTimeMin;

    // Gap analysis - if guards walk opposite directions
    const gapTime = patrolTimeMin / 2; // max time between patrols at any point

    // For 24hr coverage with 8hr shifts
    const shiftsNeeded = 3;
    const totalGuards = guards * shiftsNeeded;

    showResult('patrol-results', `
        <h4>Patrol Coverage</h4>
        <div class="result-value">${perimeterPerGuard.toFixed(0)}m per guard</div>
        <div class="result-detail">Total perimeter: ${perimeter}m | Guards per shift: ${guards}</div>
        <div class="result-detail">Patrol cycle time: ${patrolTimeMin.toFixed(1)} minutes</div>
        <div class="result-detail">Circuits per hour: ${circuitsPerHour.toFixed(1)}</div>
        <div class="result-detail">Max gap between patrols: ${gapTime.toFixed(1)} min</div>
        <div class="result-detail">24hr coverage (3 shifts): ${totalGuards} total guards</div>
    `);

    saveToHistory('Patrol', `${perimeter}m with ${guards} guards = ${perimeterPerGuard.toFixed(0)}m each`, { perimeter, guards, walkSpeed });
}

// ================================
// POWER SYSTEMS ADVANCED CALCULATORS
// ================================

function calculateWindPower() {
    const diameter = parseFloat(document.getElementById('wind-diameter').value);
    const speed = parseFloat(document.getElementById('wind-speed').value);
    const efficiency = parseFloat(document.getElementById('wind-eff').value) / 100;

    const area = Math.PI * Math.pow(diameter / 2, 2);
    const airDensity = 1.225; // kg/m³ at sea level

    // Power = 0.5 × ρ × A × v³ × Cp
    const powerWatts = 0.5 * airDensity * area * Math.pow(speed, 3) * efficiency;
    const powerKW = powerWatts / 1000;

    // Capacity factor (~25% for typical wind)
    const avgDaily = powerKW * 24 * 0.25;
    const monthlyKWh = avgDaily * 30;

    showResult('wind-results', `
        <h4>Wind Turbine Output</h4>
        <div class="result-value">${powerKW.toFixed(2)} kW peak</div>
        <div class="result-detail">Rotor diameter: ${diameter}m | Wind: ${speed} m/s</div>
        <div class="result-detail">Swept area: ${area.toFixed(1)} m² | Efficiency: ${(efficiency*100)}%</div>
        <div class="result-detail">Avg daily output (25% capacity): ${avgDaily.toFixed(1)} kWh</div>
        <div class="result-detail">Monthly estimate: ${monthlyKWh.toFixed(0)} kWh</div>
    `);

    saveToHistory('Wind Power', `${diameter}m @ ${speed}m/s = ${powerKW.toFixed(2)}kW`, { diameter, speed, efficiency: efficiency*100 });
}

function calculateHydroPower() {
    const flow = parseFloat(document.getElementById('hydro-flow').value);
    const head = parseFloat(document.getElementById('hydro-head').value);
    const efficiency = parseFloat(document.getElementById('hydro-eff').value) / 100;

    const waterDensity = 1000; // kg/m³
    const g = 9.81;

    // Power = ρ × g × Q × H × η
    const powerWatts = waterDensity * g * (flow / 1000) * head * efficiency;
    const powerKW = powerWatts / 1000;

    // Hydro runs more consistently than wind (~80% capacity)
    const dailyKWh = powerKW * 24 * 0.8;
    const monthlyKWh = dailyKWh * 30;

    showResult('hydro-results', `
        <h4>Hydro Power Output</h4>
        <div class="result-value">${powerKW.toFixed(2)} kW</div>
        <div class="result-detail">Flow: ${flow} L/s | Head: ${head}m</div>
        <div class="result-detail">Efficiency: ${(efficiency*100)}%</div>
        <div class="result-detail">Daily output (80% capacity): ${dailyKWh.toFixed(1)} kWh</div>
        <div class="result-detail">Monthly estimate: ${monthlyKWh.toFixed(0)} kWh</div>
    `);

    saveToHistory('Hydro Power', `${flow}L/s @ ${head}m = ${powerKW.toFixed(2)}kW`, { flow, head, efficiency: efficiency*100 });
}

function calculateWireGauge() {
    const current = parseFloat(document.getElementById('wire-amps').value);
    const length = parseFloat(document.getElementById('wire-distance').value);
    const voltage = parseInt(document.getElementById('wire-voltage').value);
    const dropPercent = parseFloat(document.getElementById('wire-drop').value);

    // Copper resistivity
    const resistivity = 1.724e-8; // ohm·m for copper

    // Maximum allowed resistance for given voltage drop
    const maxDrop = voltage * (dropPercent / 100);
    const maxResistance = maxDrop / current;
    const totalLength = length * 2; // round trip

    // Required cross-sectional area
    const areaM2 = (resistivity * totalLength) / maxResistance;
    const areaMM2 = areaM2 * 1e6;

    // AWG approximation (simplified)
    const awg = Math.round(36 - 20 * Math.log10(areaMM2 / 0.0127));

    // Standard gauges
    const gauges = {
        14: { mm2: 2.08, amps: 15 },
        12: { mm2: 3.31, amps: 20 },
        10: { mm2: 5.26, amps: 30 },
        8: { mm2: 8.37, amps: 40 },
        6: { mm2: 13.3, amps: 55 },
        4: { mm2: 21.2, amps: 70 },
        2: { mm2: 33.6, amps: 95 }
    };

    let recommended = 'Custom';
    for (const [gauge, specs] of Object.entries(gauges)) {
        if (specs.mm2 >= areaMM2 && specs.amps >= current) {
            recommended = `${gauge} AWG`;
            break;
        }
    }

    showResult('wire-results', `
        <h4>Wire Gauge Selection</h4>
        <div class="result-value">${recommended}</div>
        <div class="result-detail">Required area: ${areaMM2.toFixed(2)} mm²</div>
        <div class="result-detail">Current: ${current}A | Distance: ${length}m</div>
        <div class="result-detail">Voltage: ${voltage}V | Max drop: ${dropPercent}% (${maxDrop.toFixed(2)}V)</div>
        <div class="result-detail">Calculated AWG: ~${awg}</div>
        <div class="result-warning">Always verify with local electrical codes</div>
    `);

    saveToHistory('Wire Gauge', `${current}A @ ${length}m = ${recommended}`, { current, length, voltage, dropPercent });
}

// Auto-add help buttons only to calc-cards that have help content
function initHelpButtons() {
    document.querySelectorAll('.calc-card').forEach(card => {
        const h3 = card.querySelector('h3');
        if (!h3) return;

        // Get calculator name from h3 text
        const calcName = h3.textContent.trim();
        const calcId = calcName.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        // Check if help content exists for this calculator
        const hasHelp = calculatorHelp[calcId] !== undefined;

        // Remove existing help button if no help content
        const existingBtn = card.querySelector('.calc-help-btn');
        if (existingBtn && !hasHelp) {
            existingBtn.remove();
        }

        // Skip if already has help button or no help content available
        if (card.querySelector('.calc-help-btn') || !hasHelp) return;

        // Create header wrapper if not exists
        let header = card.querySelector('.calc-card-header');
        if (!header) {
            header = document.createElement('div');
            header.className = 'calc-card-header';
            h3.parentNode.insertBefore(header, h3);
            header.appendChild(h3);
        }

        // Add help button only if help content exists
        const helpBtn = document.createElement('button');
        helpBtn.className = 'calc-help-btn';
        helpBtn.title = 'How to calculate this manually';
        helpBtn.textContent = '?';
        helpBtn.onclick = () => showCalcHelp(calcId);
        header.appendChild(helpBtn);
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Load help content from JSON file
    await loadCalculatorHelp();

    updateHistoryDisplay();

    // Start with all modules COLLAPSED when "All" filter is active
    document.querySelectorAll('.calc-module').forEach(module => {
        module.classList.add('collapsed');
    });

    // Initialize filter state
    currentFilter = 'all';

    // Auto-add help buttons to all calculators
    initHelpButtons();
});
