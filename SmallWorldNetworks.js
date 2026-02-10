import { BigNumber } from '../../exp/TheorySDK.Linux.1.4.40/api/BigNumber';
import { ExponentialCost, FreeCost } from '../../exp/TheorySDK.Linux.1.4.40/api/Costs';
import { QuaternaryEntry, theory } from '../../exp/TheorySDK.Linux.1.4.40/api/Theory';
import { LayoutOptions } from '../../exp/TheorySDK.Linux.1.4.40/api/ui/properties/LayoutOptions';
import { Utils } from '../../exp/TheorySDK.Linux.1.4.40/api/Utils';

var id = 'small_world_networks';
var name = 'Small World Networks';
var description =
    "Small world networks sit on the edge between order and chaos. " +
    "Social circles, the internet, and even neural networks all show a mix of everything being both close while seemingly being far away.\n\n" +
    "In this theory, you tune the rewiring probability of a Watts-Strogatz-style network to make it as small-world as possible. " +
    "By choosing an optimal range of rewiring parameters you shape the balance between local structure and global reach. " +
    "As the network size grows and new upgrades unlock, you'll sharpen your control over this trade-off and amplify your gains.\n\n" +
    "Can you find the sweet spot where order and randomness cooperate to produce the most efficient small-world network?";
var authors = 'panda_125';

let currency;
let quaternaryEntries;

let rhodot = 0.0;

var c1, c2, N, A;

var smallWorldness = BigNumber.ZERO;

let beta_min_lim = -4;
let beta_max_lim = 0;
let beta_min_val = beta_min_lim;
let beta_max_val = beta_max_lim;
const BETA_STEP = 0.01;

const pubPower = 0.2;
const tauRate = 1;

// TODO: Potential extra features for UI
//     - Make buttons horizontal
var createTopRightMenu = () => {
    let SWLabel = ui.createLatexLabel({
        text: Utils.getMath(
            "\\frac{1}{\\Delta\\beta} \\int_{\\beta_{\\min}}^{\\beta_{\\max}} U(x) dx = " + smallWorldness.toString(2)
        )
    });

    function updateSWLabel() {
        const SW_val = computeF();
        SWLabel.text = Utils.getMath(
            "\\frac{1}{\\Delta\\beta} \\int_{\\beta_{\\min}}^{\\beta_{\\max}} U(x) dx = " + SW_val.toString(2)
        )
    }

    let betaLabelMax = ui.createLatexLabel({
        text: Utils.getMath(
            "\\beta_{max}=" + beta_max_val.toFixed(2)
        )
    });

    let betaLabelMin = ui.createLatexLabel({
        text: Utils.getMath(
            "\\beta_{min}=" + beta_min_val.toFixed(2)
        )
    });

    function updateBetaMaxVals() {
        betaLabelMax.text = Utils.getMath(
            "\\beta_{max}=" + beta_max_val.toFixed(2)
        );
        betaMaxSlider.value = beta_max_val;
    }

    function updateBetaMinVals() {
        betaLabelMin.text = Utils.getMath(
            "\\beta_{min}=" + beta_min_val.toFixed(2)
        );
        betaMinSlider.value = beta_min_val;
    }

    let betaMaxSlider = ui.createSlider({
        minimum: beta_min_lim + BETA_STEP,
        maximum: beta_max_lim,
        value: beta_max_val,
        onValueChanged: () => {
            beta_max_val = Math.max(betaMaxSlider.value, beta_min_val + BETA_STEP);
            updateBetaMaxVals();
            updateSWLabel();
            theory.invalidatePrimaryEquation();
        }
    });

    let betaMinSlider = ui.createSlider({
        minimum: beta_min_lim,
        maximum: beta_max_lim - BETA_STEP,
        value: beta_min_val,
        onValueChanged: () => {
            beta_min_val = Math.min(betaMinSlider.value, beta_max_val - BETA_STEP);
            updateBetaMinVals();
            updateSWLabel();
            theory.invalidatePrimaryEquation();
        }
    });

    let betaMaxButtons = ui.createStackLayout({
        children: [
            ui.createButton({
                text: "-0.01",
                onReleased: () => {
                    beta_max_val = Math.max(beta_min_val + BETA_STEP, beta_max_val - 0.01);
                    updateBetaMaxVals();
                    updateSWLabel();
                }
            }),
            ui.createButton({
                text: "+0.01",
                onReleased: () => {
                    beta_max_val = Math.min(beta_max_lim, beta_max_val + 0.01);
                    updateBetaMaxVals();
                    updateSWLabel();
                }
            })
        ]
    });

    let betaMinButtons = ui.createStackLayout({
        children: [
            ui.createButton({
                text: "-0.01",
                onReleased: () => {
                    beta_min_val = Math.max(beta_min_lim, beta_min_val - 0.01);
                    updateBetaMinVals();
                    updateSWLabel();
                }
            }),
            ui.createButton({
                text: "+0.01",
                onReleased: () => {
                    beta_min_val = Math.min(beta_max_val - BETA_STEP, beta_min_val + 0.01);
                    updateBetaMinVals()
                    updateSWLabel();
                }
            })
        ]
    });

    let menu = ui.createPopup({
        isPeekable: true,
        title: "Beta Slider",
        content: ui.createStackLayout({
            children: [
                SWLabel,
                betaLabelMax,
                betaMaxSlider,
                betaMaxButtons,
                betaLabelMin,
                betaMinSlider,
                betaMinButtons,
                ui.createButton({
                    margin: new Thickness(10),
                    text: "Done",
                    onReleased: () => {
                        menu.hide();
                        smallWorldness = computeOneOverOneMinusFAccurate();
                    }
                })
            ]
        })
    });

    return menu;
}

const topRightMenu = createTopRightMenu();

var getEquationOverlay = () =>
{
    let result = ui.createGrid
    ({
        inputTransparent: true,
        cascadeInputTransparent: false,
        children:
        [
            ui.createGrid
            ({
                row: 0, column: 0,
                margin: new Thickness(4),
                horizontalOptions: LayoutOptions.START,
                verticalOptions: LayoutOptions.START,
                inputTransparent: true,
                cascadeInputTransparent: false,
                children:
                [
                    ui.createLabel({
                        margin: new Thickness(0, 0, 10, 10),
                        padding: new Thickness(2, 0, 10, 10),
                        text: "☰",
                        textColor: Color.TEXT_MEDIUM,
                        fontAttributes: FontAttributes.BOLD,
                        horizontalTextAlignment: TextAlignment.CENTER,
                        verticalTextAlignment: TextAlignment.END,
                        fontSize: Math.min(ui.screenWidth / 13, ui.screenHeight / 18),
                        opacity: 1,
                        isVisible: () => rangeMenu.level > 0,
                        onTouched: (e) => {
                            if(e.type.isReleased()) {
                                Sound.playClick();
                                topRightMenu.show();
                            }
                        }
                    })
                ]
            }),
        ]
    });
    return result;
}


let init = () =>
{
    currency = theory.createCurrency();

    {
        c1 = theory.createUpgrade(0, currency, new ExponentialCost(10, Math.log2(2)));
        let getDesc = (level) => "c_1 = " + getC1(level).toString(2);
        c1.getDescription = (_) => Utils.getMath(getDesc(c1.level));
        c1.getInfo = (amount) => Utils.getMathTo(getDesc(c1.level), getDesc(c1.level + amount));
    }

    {
        c2 = theory.createUpgrade(1, currency, new ExponentialCost(10, Math.log2(8)));
        let getDesc = (level) => "c_2 = " + getC2(level).toString(0);
        c2.getDescription = (_) => Utils.getMath(getDesc(c2.level));
        c2.getInfo = (amount) => Utils.getMathTo(getDesc(c2.level), getDesc(c2.level + amount));
    }

    {
        N = theory.createUpgrade(2, currency, new ExponentialCost(10, Math.log2(8)));
        let getDesc = (level) => "N = " + getN(level).toString(0);
        N.getDescription = (_) => Utils.getMath(getDesc(N.level));
        N.getInfo = (amount) => Utils.getMathTo(getDesc(N.level), getDesc(N.level + amount));
    }

    {
        A = theory.createUpgrade(3, currency, new ExponentialCost(1e25, Math.log2(10)));
        let getDesc = (level) => "A = " + getA(level).toString(2);
        A.getDescription = (_) => Utils.getMath(getDesc(A.level));
        A.getInfo = (amount) => Utils.getMathTo(getDesc(A.level), getDesc(A.level + amount));
    }


    /////////////////////////
    // PERMANENT UPGRADES
    theory.createPublicationUpgrade(0, currency, 1e7);
    theory.createBuyAllUpgrade(1, currency, 1e10);
    theory.createAutoBuyerUpgrade(2, currency, 1e25);

    {
        rangeMenu = theory.createPermanentUpgrade(3, currency, new LinearCost(1e12, 0));
        rangeMenu.maxLevel = 1;
        rangeMenu.getDescription = (_) => `Add variable ranges`;
        rangeMenu.getInfo = (_) => Localization.getUpgradeUnlockInfo("\\text{Range Menu}");
        rangeMenu.boughtOrRefunded = (_) => {
            theory.invalidatePrimaryEquation();
            updateAvailability();
        }
    }

    /////////////////////
    // MILESTONES
    const milestoneArray = [25, 75, 125, 175, -1];
    theory.setMilestoneCost(new CustomCost((lvl) => tauRate * BigNumber.from(milestoneArray[Math.min(lvl, 1)])));
    {
    {
        AVariable = theory.createMilestoneUpgrade(0, 1);
        AVariable.description = `Increase Peak Steepness`;
        AVariable.boughtOrRefunded = (_) => {
            theory.invalidatePrimaryEquation();
            updateAvailability();
        }
    }
    {
        // TODO: This is not quite working as intended yet
        //       Somehow you get 3 points in one go?
        kIncrease = theory.createMilestoneUpgrade(1, 3);
        kIncrease.description = `Multiply k0 by 2`;
        kIncrease.boughtOrRefunded = (_) => {
            theory.invalidatePrimaryEquation();
            theory.invalidateQuaternaryValues();
            updateAvailability();
        }
    }
    {
        // TODO: Here we want to extend the limit by -m
    }
    }
}

var updateAvailability = () => {
    kIncrease.isAvailable = AVariable.level > 0

    A.isAvailable = AVariable.level > 0
}

var postPublish = () => {
}

// Average shortest path length in small‑world networks derived in mean‑field analyses
// (what is used in Newman-Moore-Watts models)
// https://arxiv.org/pdf/cond-mat/9909165 (Eq 21)
function getLNorm(N, k, p) {
    const z = N * k * p;

    // L_norm = 2 * ln( (z + 2 + sqrt(z^2 + 4z)) / 2 ) / sqrt(z^2 + 4z)
    const z2_4z = z**2 + (4 * z);
    const sqrt_term = z2_4z.sqrt();
    const log_term = Math.log((z + 2 + sqrt_term) / 2);

    return (2 * log_term) / sqrt_term;
}

// Normalized clustering coefficient in Watts-Strogatz small-world models
// C(p) roughly equals C(0)(1 - p)^3
// So normalized C_n(p) = (1 - p)^3/C(0) = (1 - p)^3
function getCNorm(p) {
    // C_norm = (1 - p)^3
    return (1 - p)**3;
}


function computeF(sample_rate=100) {
    const N_val = getN(N.level);
    const k_val = getK(kIncrease.level);

    const start = beta_min_val;
    const end = beta_max_val;

    let range = end - start;
    if (range <= 0) {
        range = 0.01;
    }

    const n = sample_rate - 1;
    const h = range / n;

    let integral = 0;
    for (let i = 0; i <= n; i++) {
        const b = start + i * h;
        const p = Math.pow(10, b);

        const C_val = getCNorm(p);
        const L_val = getLNorm(N_val, k_val, p);

        const f = C_val - L_val;

        const w = (i === 0 || i === n) ? 0.5 : 1.0;
        integral += w * f;
    }

    let F = integral * (h / range);

    if (F >= 1 || F < 0) {
        F = 0;
    }

    const res = BigNumber.ONE / (BigNumber.ONE - BigNumber.from(F));

    return res;
}


let FFinal = 0;

let prev_N;
var tick = (elapsedTime, multiplier) =>
{
    const dt = BigNumber.from(elapsedTime * multiplier);
    const bonus = theory.publicationMultiplier;

    const A_val = getA(A.level);
    const N_now = getN(N.level);

    if (smallWorldness < BigNumber.ZERO || prev_N !== N_now) {
        smallWorldness = computeF();
        prev_N = N_now;
    }

    const SW = smallWorldness.pow(A_val);

    FFinal = SW; // NOTE: Temperary variable for debugging

    const c1_val = getC1(c1.level);
    const c2_val = getC2(c2.level);

    currency.value += dt * bonus * c1_val * c2_val * SW;
    rhodot = c1_val * c2_val * SW * bonus;

    theory.invalidateSecondaryEquation();
    theory.invalidateTertiaryEquation();
    theory.invalidateQuaternaryValues();
}

var getPrimaryEquation = () => {
    theory.primaryEquationHeight = 75;
    let res = `\\dot{\\rho} = c_1 c_2 `;

    // The 'Average' part
    const avgUtility = `\\frac{1}{\\Delta\\beta} \\int_{\\beta_{\\min}}^{\\beta_{\\max}} U(x) dx`;

    if (AVariable.level > 0) {
        // If A is unlocked, wrap the average in parenthesis
        res += `\\left(1 - ${avgUtility} \\right)^{-A}`;
    } else if (rangeMenu.level > 0) {
        res += avgUtility;
    } else {
        // Default starting state
        res += `\\int_{-4}^{0} U(x) dx`;
    }

    return res;
}

var getSecondaryEquation = () => {
    theory.secondaryEquationHeight = 85;

    // Define the Utility Function U(x)
    let res = `U(x) = C(10^x) - L(N k 10^x)`;

    res += `\\\\`;

    res += `L(z) = \\frac{\\theta}{\\sinh\\theta}, \\; \\theta = \\text{cosh}^{-1}\\left(\\frac{z+2}{2}\\right)`;

    res += `\\\\`;

    res += `C(p) = (1-p)^3`;

    return res;
}

var getTertiaryEquation = () => {
    return `F = ${FFinal.toString(6)}`;
}

var getQuaternaryEntries = () => {
    quaternaryEntries = [];

    quaternaryEntries.push(new QuaternaryEntry("{\\rho}_{{}\\,}", null));
    quaternaryEntries.push(new QuaternaryEntry("{N}_{{}\\,}", null));
    quaternaryEntries.push(new QuaternaryEntry("{k_0}_{{}\\,}", null));
    if (rangeMenu.level > 0) {
        quaternaryEntries.push(new QuaternaryEntry("{\\beta_\\min}_{{}\\,}", null));
        quaternaryEntries.push(new QuaternaryEntry("{\\beta_\\max}_{{}\\,}", null));
    }

    quaternaryEntries[0].value = `${rhodot.toString(2)}`;
    quaternaryEntries[1].value = `${getN(N.level).toString(0)}`;
    quaternaryEntries[2].value = `${(getK(kIncrease.level)).toString(0)}`;
    if (rangeMenu.level > 0) {
        quaternaryEntries[3].value = `${beta_min_val.toFixed(2)}`;
        quaternaryEntries[4].value = `${beta_max_val.toFixed(2)}`;
    }

    return quaternaryEntries;
}

var get2DGraphValue = () => currency.value.sign *
(BigNumber.ONE + currency.value.abs()).log10().toNumber();

var getPublicationMultiplier = (tau) => tau.pow(pubPower);

var getPublicationMultiplierFormula = (symbol) => `{${symbol}}^{${pubPower}}`;

var getTau = () => currency.value;

var getCurrencyFromTau = (tau) =>
[
    tau.max(BigNumber.ONE),
    currency.symbol
];

let getC1 = (level) => BigNumber.from(1.35).pow(level);
let getC2 = (level) => BigNumber.TWO.pow(level);
let getN = (level) => BigNumber.TEN * BigNumber.from(1.1).pow(level);
let getA = (level) => BigNumber.ONE + BigNumber.from(0.05*level);
let getK = (level) => BigNumber.TWO.pow(1 + level);

init();