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

let rhodot = BigNumber.ZERO;
let qdot = BigNumber.ZERO;

let c1, c2, N, q1;

let q = BigNumber.ZERO;

let smallWorldness = BigNumber.ZERO;

let beta_min_lim = -3;
let beta_max_lim = 0;
let beta_min_val = beta_min_lim;
let beta_max_val = beta_max_lim;
let local_beta_min = beta_min_val;
let local_beta_max = beta_max_val;
const BETA_STEP = 0.01;

const pubPower = 0.2;
const tauRate = 1;
const pubExponent = 0.2;

var createTopRightMenu = () => {
    let SWLabel = ui.createLatexLabel({
        horizontalOptions: LayoutOptions.CENTER,
        text: Utils.getMath(
            "\\frac{1}{\\Delta\\beta} \\int_{\\beta_{\\min}}^{\\beta_{\\max}} U(x) dx = " + smallWorldness.toString(2)
        )
    });

    function updateSWLabel() {
        const SW_val = computeF(local_beta_min, local_beta_max);
        SWLabel.text = Utils.getMath(
            "\\frac{1}{\\Delta\\beta} \\int_{\\beta_{\\min}}^{\\beta_{\\max}} U(x) dx = " + SW_val.toString(2)
        )
    }

    let betaLabelMax = ui.createLatexLabel({
        horizontalOptions: LayoutOptions.CENTER,
        text: Utils.getMath(
            "\\beta_{max}=" + beta_max_val.toFixed(2)
        )
    });

    let betaLabelMin = ui.createLatexLabel({
        horizontalOptions: LayoutOptions.CENTER,
        text: Utils.getMath(
            "\\beta_{min}=" + beta_min_val.toFixed(2)
        )
    });

    function updateBetaMaxVals() {
        betaLabelMax.text = Utils.getMath(
            "\\beta_{max}=" + local_beta_max.toFixed(2)
        );
        betaMaxSlider.value = local_beta_max;
    }

    function updateBetaMinVals() {
        betaLabelMin.text = Utils.getMath(
            "\\beta_{min}=" + local_beta_min.toFixed(2)
        );
        betaMinSlider.value = local_beta_min;
    }

    let betaMaxSlider = ui.createSlider({
        minimum: beta_min_lim + BETA_STEP,
        maximum: beta_max_lim,
        value: local_beta_max,
        onValueChanged: () => {
            local_beta_max = Math.max(betaMaxSlider.value, local_beta_min + BETA_STEP);
            updateBetaMaxVals();
            updateSWLabel();
            theory.invalidatePrimaryEquation();
        }
    });

    let betaMinSlider = ui.createSlider({
        minimum: beta_min_lim,
        maximum: beta_max_lim - BETA_STEP,
        value: local_beta_min,
        onValueChanged: () => {
            local_beta_min = Math.min(betaMinSlider.value, local_beta_max - BETA_STEP);
            updateBetaMinVals();
            updateSWLabel();
            theory.invalidatePrimaryEquation();
        }
    });

    let betaMaxButtons = ui.createStackLayout({
        orientation: StackOrientation.HORIZONTAL,
        horizontalOptions: LayoutOptions.CENTER,
        children: [
            ui.createButton({
                text: "-0.01",
                onReleased: () => {
                    local_beta_max = Math.max(local_beta_min + BETA_STEP, local_beta_max - BETA_STEP);
                    updateBetaMaxVals();
                    updateSWLabel();
                }
            }),
            ui.createButton({
                text: "+0.01",
                onReleased: () => {
                    local_beta_max = Math.min(beta_max_lim, local_beta_max + BETA_STEP);
                    updateBetaMaxVals();
                    updateSWLabel();
                }
            })
        ]
    });

    let betaMinButtons = ui.createStackLayout({
        orientation: StackOrientation.HORIZONTAL,
        horizontalOptions: LayoutOptions.CENTER,
        children: [
            ui.createButton({
                text: "-0.01",
                onReleased: () => {
                    local_beta_min = Math.max(beta_min_lim, local_beta_min - BETA_STEP);
                    updateBetaMinVals();
                    updateSWLabel();
                }
            }),
            ui.createButton({
                text: "+0.01",
                onReleased: () => {
                    local_beta_min = Math.min(local_beta_max - BETA_STEP, local_beta_min + BETA_STEP);
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

                        // Set new variables
                        beta_min_val = local_beta_min;
                        beta_max_val = local_beta_max;
                        smallWorldness = computeF();

                        // Reset local variables
                        local_beta_min = beta_min_lim;
                        local_beta_max = beta_max_lim;

                        q = BigNumber.ZERO;
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
        q1 = theory.createUpgrade(3, currency, new ExponentialCost(10, Math.log2(8)));
        let getDesc = (level) => "q_1 = " + getQ1(level).toString(2);
        q1.getDescription = (_) => Utils.getMath(getDesc(q1.level));
        q1.getInfo = (amount) => Utils.getMathTo(getDesc(q1.level), getDesc(q1.level + amount));
    }


    /////////////////////////
    // PERMANENT UPGRADES
    theory.createPublicationUpgrade(0, currency, 1e7);
    theory.createBuyAllUpgrade(1, currency, 1e10);
    {
        rangeMenu = theory.createPermanentUpgrade(2, currency, new LinearCost(1e12, 0));
        rangeMenu.maxLevel = 1;
        rangeMenu.getDescription = (_) => `Add variable ranges`;
        rangeMenu.getInfo = (_) => Localization.getUpgradeUnlockInfo("\\text{Range Menu}");
        rangeMenu.boughtOrRefunded = (_) => {
            theory.invalidatePrimaryEquation();
            updateAvailability();
        }
    }
    theory.createAutoBuyerUpgrade(3, currency, 1e25);

    /////////////////////
    // MILESTONES
    const milestoneArray = [25, 50, 75, 100, 125, 175, 225, 275, 325, 375, 425, 475, 525, 625, -1];
    theory.setMilestoneCost(new CustomCost((lvl) => BigNumber.from(milestoneArray[Math.min(lvl, 1)])));
    {
    {
        FExponent = theory.createMilestoneUpgrade(0, 3);
        FExponent.description = `Increase Peak Steepness`;
        FExponent.boughtOrRefunded = (_) => {
            theory.invalidatePrimaryEquation();
            updateAvailability();
        }
    }
    {
        // BUG: This is not quite working as intended yet
        //      Somehow you get 3 points in one go?
        kIncrease = theory.createMilestoneUpgrade(1, 8);
        kIncrease.description = `Multiply k0 by 2`;
        kIncrease.boughtOrRefunded = (_) => {
            theory.invalidatePrimaryEquation();
            theory.invalidateQuaternaryValues();
            updateAvailability();
        }
    }
    {
        rangeIncrease = theory.createMilestoneUpgrade(2, 3);
        rangeIncrease.description = `Increase range by 2`;
        rangeIncrease.boughtOrRefunded = (_) => {
            theory.invalidatePrimaryEquation();
            theory.invalidateQuaternaryValues();
            updateAvailability();
            updateRange()
        }
    }
    }

    updateAvailability();
    updateRange();
}

var updateAvailability = () => {
    kIncrease.isAvailable = FExponent.level > 0
    rangeIncrease.isAvailable = FExponent.level > 0
}

function updateRange() {
    beta_min_lim = -3 - 2 * rangeIncrease.level;
}

var postPublish = () => {
    q = BigNumber.ZERO;
}

// Average shortest path length in small‑world networks derived in mean‑field analyses
// (what is used in Newman-Moore-Watts models)
// https://arxiv.org/pdf/cond-mat/9909165 (Eq 21)
function getLNorm(N, k, p) {
    const z = N * k * p;

    // L_norm = 2 * ln( (z + 2 + sqrt(z^2 + 4z)) / 2 ) / sqrt(z^2 + 4z)
    const z2_4z = z.pow(BigNumber.TWO) + (BigNumber.FOUR * z);
    const sqrt_term = z2_4z.sqrt();
    const log_term = ((z + BigNumber.TWO + sqrt_term) / BigNumber.TWO).log();
    const BNres = (BigNumber.TWO * log_term) / sqrt_term;

    return BNres.toNumber();
}

// Normalized clustering coefficient in Watts-Strogatz small-world models
// C(p) roughly equals C(0)(1 - p)^3
// So normalized C_n(p) = (1 - p)^3/C(0) = (1 - p)^3
function getCNorm(p) {
    // C_norm = (1 - p)^3
    return (1 - p)**3;
}

// 32-point Gauss–Legendre nodes on [-1, 1]
const GL32_X = [
  -0.9972638618494816,
  -0.9856115115452684,
  -0.9647622555875064,
  -0.9349060759377397,
  -0.8963211557660521,
  -0.8493676137325699,
  -0.7944837959679424,
  -0.7321821187402897,
  -0.6630442669302152,
  -0.5877157572407623,
  -0.5068999089322294,
  -0.4213512761306353,
  -0.3318686022821277,
  -0.2392873622521371,
  -0.1444719615827965,
  -0.04830766568773832,
   0.04830766568773832,
   0.1444719615827965,
   0.2392873622521371,
   0.3318686022821277,
   0.4213512761306353,
   0.5068999089322294,
   0.5877157572407623,
   0.6630442669302152,
   0.7321821187402897,
   0.7944837959679424,
   0.8493676137325699,
   0.8963211557660521,
   0.9349060759377397,
   0.9647622555875064,
   0.9856115115452684,
   0.9972638618494816
];

// 32-point Gauss–Legendre weights on [-1, 1]
const GL32_W = [
  0.0070186100094700966,
  0.01627439473090567,
  0.02539206530926206,
  0.03427386291302143,
  0.04283589802222668,
  0.05099805926237622,
  0.05868409347853555,
  0.06582222277636185,
  0.07234579410884851,
  0.07819389578707031,
  0.08331192422694673,
  0.08765209300440381,
  0.09117387869576388,
  0.09384439908080457,
  0.09563872007927486,
  0.09654008851472780,
  0.09654008851472780,
  0.09563872007927486,
  0.09384439908080457,
  0.09117387869576388,
  0.08765209300440381,
  0.08331192422694673,
  0.07819389578707031,
  0.07234579410884851,
  0.06582222277636185,
  0.05868409347853555,
  0.05099805926237622,
  0.04283589802222668,
  0.03427386291302143,
  0.02539206530926206,
  0.01627439473090567,
  0.0070186100094700966
];

function computeF(start = beta_min_val, end = beta_max_val) {
    const N_val = getN(N.level);
    const k_val = getK(kIncrease.level);

    let range = end - start;
    if (range <= 0) {
        return 0;
    }

    const mid  = (start + end) / 2;
    const half = range / 2;

    let sum = 0

    for (let i = 0; i < GL32_X.length; i++) {
        const xi = GL32_X[i];
        const wi = GL32_W[i];

        const beta = mid + half * xi;
        const p = 10**beta;

        const C_val = getCNorm(p);
        const L_val = getLNorm(N_val, k_val, p);

        const f = C_val - L_val;
        sum += wi * f;
    }

    let avg = sum / 2;

    if (avg < 0 || avg >= 1) {
        avg = 0;
    }

    return BigNumber.ONE/(BigNumber.ONE - BigNumber.from(avg));
}

let prev_N, prev_k;
var tick = (elapsedTime, multiplier) => {
    const dt = BigNumber.from(elapsedTime * multiplier);
    const bonus = theory.publicationMultiplier;

    const Exp_val = getFExp(FExponent.level);
    const N_now = getN(N.level);
    const k_now = getK(kIncrease.level)

    // Update F if value doesn't exist yet
    if (smallWorldness <= BigNumber.ZERO || prev_N !== N_now || prev_k !== k_now) {
        smallWorldness = computeF();
        prev_N = N_now;
        prev_k = k_now;
    }

    // Update q
    const SW = smallWorldness.pow(Exp_val);
    const q1_val = getQ1(q1.level);

    q += dt * SW * q1_val;

    // Update rho
    const c1_val = getC1(c1.level);
    const c2_val = getC2(c2.level);

    currency.value += dt * bonus * c1_val * c2_val * q;

    rhodot = c1_val * c2_val * q * bonus;
    qdot = SW * q1_val;

    theory.invalidateSecondaryEquation();
    theory.invalidateTertiaryEquation();
    theory.invalidateQuaternaryValues();
}

var getPrimaryEquation = () => {
    theory.primaryEquationHeight = 75;
    let res = `\\dot{\\rho} = c_1 c_2 `;

    // The average part
    const avg_utility = `\\frac{1}{\\Delta\\beta} \\int_{\\beta_{\\min}}^{\\beta_{\\max}} U(x) dx`;

    if (FExponent.level > 0) {
        // If A is unlocked, wrap the average in parenthesis
        res += `\\left(1 - ${avg_utility} \\right)^{${getFExp(FExponent.level).toString(1)}}`;
    } else if (rangeMenu.level > 0) {
        res += avg_utility;
    } else {
        // Default starting state
        res += `\\int_{-3}^{0} U(x) dx`;
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
    const F = smallWorldness.pow(getFExp(FExponent.level));
    return `q = ${q.toString(2)}, F = ${F.toString(6)}`;
}

var getQuaternaryEntries = () => {
    quaternaryEntries = [];

    quaternaryEntries.push(new QuaternaryEntry("{\\dot{\\rho}}_{{}\\,}", null));
    quaternaryEntries.push(new QuaternaryEntry("{\\dot{q}}_{{}\\,}", null));
    quaternaryEntries.push(new QuaternaryEntry("{N}_{{}\\,}", null));
    quaternaryEntries.push(new QuaternaryEntry("{k_0}_{{}\\,}", null));
    if (rangeMenu.level > 0) {
        quaternaryEntries.push(new QuaternaryEntry("{\\beta_\\min}_{{}\\,}", null));
        quaternaryEntries.push(new QuaternaryEntry("{\\beta_\\max}_{{}\\,}", null));
    }

    quaternaryEntries[0].value = `${rhodot.toString(2)}`;
    quaternaryEntries[1].value = `${qdot.toString(2)}`;
    quaternaryEntries[2].value = `${getN(N.level).toString(0)}`;
    quaternaryEntries[3].value = `${(getK(kIncrease.level)).toString(0)}`;
    if (rangeMenu.level > 0) {
        quaternaryEntries[4].value = `${beta_min_val.toFixed(2)}`;
        quaternaryEntries[5].value = `${beta_max_val.toFixed(2)}`;
    }

    return quaternaryEntries;
}

var get2DGraphValue = () => currency.value.sign *
(BigNumber.ONE + currency.value.abs()).log10().toNumber();

var getPublicationMultiplier = (tau) => tau.pow(pubPower);

var getPublicationMultiplierFormula = (symbol) => `{${symbol}}^{${pubPower}}`;

var getTau = () => currency.value.pow(BigNumber.from(tauRate));

var getCurrencyFromTau = (tau) =>
[
    tau.max(BigNumber.ONE),
    currency.symbol
];

let getC1 = (level) => BigNumber.from(1.1).pow(level);
let getC2 = (level) => BigNumber.TWO.pow(level);
let getN = (level) => BigNumber.TEN * BigNumber.from(1.1).pow(level);
let getQ1 = (level) => BigNumber.from(1.35).pow(level);
let getFExp = (level) => BigNumber.ONE + BigNumber.from(0.5*level);
let getK = (level) => BigNumber.TWO.pow(1 + level);

init();