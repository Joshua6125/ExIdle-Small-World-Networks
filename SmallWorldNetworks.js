import { BigNumber } from '../../exp/TheorySDK.Linux.1.4.40/api/BigNumber';
import { ExponentialCost} from '../../exp/TheorySDK.Linux.1.4.40/api/Costs';
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
    "As the network size grows and new upgrades unlock, you'll sharpen your control over this trade-off and grow rho.\n\n" +
    "Can you find the sweet spot where order and randomness cooperate to produce the most efficient small-world network?";
var authors = 'panda_125';

var currency;
var quaternaryEntries;

var rhodot = BigNumber.ZERO;

var c1, c2, N, q1, q2;

var q = BigNumber.ZERO;
var smallWorldness = BigNumber.ZERO;
var prevN = BigNumber.ZERO;
var prevK = BigNumber.ZERO;
var F = 0;

var stage = 1;

let beta_min_lim = -3;
let beta_max_lim = 0;
let beta_min_val = beta_min_lim;
let beta_max_val = beta_max_lim;

let local_F = 0;
let local_beta_min = beta_min_val;
let local_beta_max = beta_max_val;
const BETA_STEP = 0.01;

const pubExponent = 0.2;
const tauRate = 0.4;

var createTopRightMenu = () => {
    let SWLabel = ui.createLatexLabel({
        horizontalOptions: LayoutOptions.CENTER,
        text: Utils.getMath(
            "F = " + local_F.toFixed(8)
        )
    });

    function updateSWLabel() {
        computeF(local_beta_min, local_beta_max, local=true);
        SWLabel.text = Utils.getMath(
            "F = " + local_F.toFixed(8)
        )
    }

    let betaLabelMax = ui.createLatexLabel({
        horizontalOptions: LayoutOptions.CENTER,
        text: Utils.getMath(
            "\\beta^+=" + beta_max_val.toFixed(2)
        )
    });

    let betaLabelMin = ui.createLatexLabel({
        horizontalOptions: LayoutOptions.CENTER,
        text: Utils.getMath(
            "\\beta^-=" + beta_min_val.toFixed(2)
        )
    });

    function updateBetaMaxVals() {
        betaLabelMax.text = Utils.getMath(
            "\\beta^+=" + local_beta_max.toFixed(2)
        );
        betaMaxSlider.value = local_beta_max;
    }

    function updateBetaMinVals() {
        betaLabelMin.text = Utils.getMath(
            "\\beta^-=" + local_beta_min.toFixed(2)
        );
        betaMinSlider.value = local_beta_min;
    }

    let betaMaxSlider = ui.createSlider({
        minimum: () => beta_min_lim + BETA_STEP,
        maximum: () => beta_max_lim,
        value: local_beta_max,
        onValueChanged: () => {
            local_beta_max = Math.max(betaMaxSlider.value, local_beta_min + BETA_STEP);
            updateBetaMaxVals();
            updateSWLabel();
            theory.invalidatePrimaryEquation();
        }
    });

    let betaMinSlider = ui.createSlider({
        minimum: () => beta_min_lim,
        maximum: () => beta_max_lim - BETA_STEP,
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
                ui.createLabel({
                    text: "Warning! Setting new range resets q",
                    horizontalTextAlignment: TextAlignment.CENTER,
                }),
                ui.createButton({
                    margin: new Thickness(10),
                    text: "Set new range",
                    onReleased: () => {
                        menu.hide();

                        // Set new variables
                        beta_min_val = local_beta_min;
                        beta_max_val = local_beta_max;
                        smallWorldness = computeF();

                        q = BigNumber.ZERO;
                    }
                })
            ]
        })
    });

    return menu;
}

var topRightMenu = createTopRightMenu();

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


let init = () => {
    currency = theory.createCurrency();

    {
        c1 = theory.createUpgrade(0, currency, new ExponentialCost(10, Math.log2(1.6)));
        let getDesc = (level) => "c_1 = " + getC1(level).toString(2);
        c1.getDescription = (_) => Utils.getMath(getDesc(c1.level));
        c1.getInfo = (amount) => Utils.getMathTo(getDesc(c1.level), getDesc(c1.level + amount));
    }

    {
        c2 = theory.createUpgrade(1, currency, new ExponentialCost(10, Math.log2(7.5)));
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
        q1 = theory.createUpgrade(3, currency, new ExponentialCost(10, Math.log2(7)));
        let getDesc = (level) => "q_1 = " + getQ1(level).toString(2);
        q1.getDescription = (_) => Utils.getMath(getDesc(q1.level));
        q1.getInfo = (amount) => Utils.getMathTo(getDesc(q1.level), getDesc(q1.level + amount));
    }

    {
        q2 = theory.createUpgrade(4, currency, new ExponentialCost(1e25, Math.log2(1.8)));
        let getDesc = (level) => "q_2 = " + getQ2(level).toString(2);
        q2.getDescription = (_) => Utils.getMath(getDesc(q2.level));
        q2.getInfo = (amount) => Utils.getMathTo(getDesc(q2.level), getDesc(q2.level + amount));
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
    theory.setMilestoneCost(new CustomCost(total => BigNumber.from(tauRate * getMilestoneCost(total))));
    {
    {
        q2Unlock = theory.createMilestoneUpgrade(0, 1);
        q2Unlock.description = `Unlock variable $q_2$`;
        q2Unlock.boughtOrRefunded = (_) => {
            theory.invalidateSecondaryEquation();
            updateAvailability();
        }
        q2Unlock.canBeRefunded = (_) => (kIncrease.level === 0 && rangeIncrease.level === 0 && FExponent.level === 0);
    }
    {
        kIncrease = theory.createMilestoneUpgrade(1, 8);
        kIncrease.description = `${Localization.getUpgradeMultCustomInfo("k_0", "10")}`;
        kIncrease.boughtOrRefunded = (_) => {
            theory.invalidatePrimaryEquation();
            theory.invalidateQuaternaryValues();
            updateAvailability();
        }
    }
    {
        FExponent = theory.createMilestoneUpgrade(2, 3);
        FExponent.description = `${Localization.getUpgradeIncCustomExpInfo("{\\hat{F}}", "0.5")}`;
        FExponent.boughtOrRefunded = (_) => {
            theory.invalidatePrimaryEquation();
            updateAvailability();
        }
        FExponent.canBeRefunded = (_) => q2Unlock.level > 0
    }
    {
        rangeIncrease = theory.createMilestoneUpgrade(3, 3);
        rangeIncrease.description = `Increase range size by 2`;
        rangeIncrease.boughtOrRefunded = (_) => {
            theory.invalidatePrimaryEquation();
            theory.invalidateQuaternaryValues();
            updateAvailability();
            updateRange()
        }
        rangeIncrease.canBeRefunded = (_) => q2Unlock.level > 0
    }
    }

    updateAvailability();
    updateRange();
}

// milestone costs in rho
var getMilestoneCost = (level) => {
    switch(level) {
        case 0:
            return 25;
        case 1:
            return 45;
        case 2:
            return 70;
        case 3:
            return 100;
        case 4:
            return 150;
        case 5:
            return 200;
        case 6:
            return 250;
        case 7:
            return 300;
        case 8:
            return 350;
        case 9:
            return 400;
        case 10:
            return 450;
        case 11:
            return 500;
        case 12:
            return 550;
        case 13:
            return 600;
        case 14:
            return 650;
        case 15:
            return 700;
        // case 16:
        //     return 750;
        // case 17:
        //     return 800;
        // case 18:
        //     return 900;
        // case 18:
        //     return 1000;
    }
    return 5000;
};

var updateAvailability = () => {
    FExponent.isAvailable = q2Unlock.level > 0;
    rangeIncrease.isAvailable = q2Unlock.level > 0;
    kIncrease.isAvailable = q2Unlock.level > 0;

    q2.isAvailable = q2Unlock.level > 0;
}

function updateRange() {
    beta_min_lim = -3 - 2 * rangeIncrease.level;
    beta_max_val = beta_max_lim;
    beta_min_val = beta_min_lim;

    topRightMenu = createTopRightMenu();
}

var postPublish = () => {
    q = BigNumber.ZERO;
}


// Closed form of the antiderivative of the utility function U(x)
function getUInt(N, k, beta) {
    const ln10 = BigNumber.TEN.log();
    const ONE = BigNumber.ONE
    const TWO = BigNumber.TWO;
    const THREE = BigNumber.THREE;
    const FOUR = BigNumber.FOUR;

    const p = BigNumber.TEN.pow(beta);
    const c = N * k;
    const z = c * p;

    const betaBN = BigNumber.from(beta);
    const p2 = p.pow(TWO);
    const p3 = p.pow(THREE);

    const F_C = betaBN - (p*THREE)/ln10 + (p2*THREE)/(ln10*TWO) - p3/(ln10*THREE);

    const z2_4z = z.pow(TWO) + (z*FOUR);
    const sqrt_term = z2_4z.sqrt();

    const t = ((z + TWO + sqrt_term)/TWO).log();

    const e_half_t = (t/TWO).exp();
    const e_half_t_sq = e_half_t.pow(TWO);

    const coth_half_t = (e_half_t_sq + ONE)/(e_half_t_sq - ONE);

    const e_half_t_inv = ONE/e_half_t;
    const sinh_half_t = (e_half_t - e_half_t_inv)/TWO;

    const log_sinh_half_t = sinh_half_t.log();

    const F_L = (-t*coth_half_t + log_sinh_half_t * TWO)/ln10;

    return F_C - F_L;
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

function computeF(start = beta_min_val, end = beta_max_val, local = false) {
    const N_val = getN(N.level);
    const k_val = getK(kIncrease.level);

    let range = end - start;
    if (range <= 0) {
        return 0;
    }

    // ------- Code for closed formulation ---------
    // const F_start  = getUInt(N_val, k_val, BigNumber.from(start)).toNumber();
    // const F_end = getUInt(N_val, k_val, BigNumber.from(end)).toNumber();

    // let avg = (F_end - F_start)/range;
    // -------------------------------

    // -------------- Gauss-Legendre quadrature ---------
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
    // -----------------------------

    if (avg < 0 || avg >= 1) {
        avg = 0;
    }

    if (local) {
        local_F = avg;
    } else {
        F = avg;
    }

    return BigNumber.ONE/(BigNumber.ONE - BigNumber.from(avg));
}

var tick = (elapsedTime, multiplier) => {
    const dt = BigNumber.from(elapsedTime * multiplier);
    const bonus = theory.publicationMultiplier;

    const Exp_val = getFExp(FExponent.level);
    const N_now = getN(N.level);
    const k_now = getK(kIncrease.level)

    // Update F if value doesn't exist yet
    if (smallWorldness <= BigNumber.ZERO || prevN !== N_now || prevK !== k_now) {
        smallWorldness = computeF();
        prevN = N_now;
        prevK = k_now;
    }

    // Update q
    const SW = smallWorldness.pow(Exp_val);
    const q1_val = getQ1(q1.level);
    const q2_val = getQ2(q2.level);

    q += dt * SW * q1_val + dt * SW * q2_val;

    // Update rho
    const c1_val = getC1(c1.level);
    const c2_val = getC2(c2.level);

    currency.value += dt * bonus * c1_val * c2_val * q;

    // Save visual variables
    rhodot = c1_val * c2_val * q * bonus;

    theory.invalidateSecondaryEquation();
    theory.invalidateTertiaryEquation();
    theory.invalidateQuaternaryValues();
}

var getPrimaryEquation = () => {
    let res = ``;
    if (stage === 1) {
        theory.primaryEquationHeight = 75;
        res += `\\dot{\\rho} = c_1 c_2 q`;
    } else {
        res += `F = `

        const avg_utility = `\\frac{1}{\\beta^+ - \\beta^-} \\int_{\\beta^-}^{\\beta^+} U(x) dx`;

        if (rangeMenu.level > 0) {
            res += `${avg_utility}`;
        } else {
            res += `\\int_{-3}^{0} U(x) dx`;
        }
    }

    return res;
}

var getSecondaryEquation = () => {
    let res = ``
    if (stage !== 1) {
        theory.secondaryEquationHeight = 85;
        res += `U(x) = C(10^x) - L(N k_0 10^x)`;

        res += `\\\\`;

        res += `L(z) = \\frac{\\theta}{\\sinh\\theta}, \\; \\theta = \\text{cosh}^{-1}\\left(\\frac{z+2}{2}\\right)`;

        res += `\\\\`;

        res += `C(p) = (1-p)^3`;
    } else {
        theory.secondaryEquationHeight = 60;
        res += `\\dot{q} = q_1 \\hat{F}`;

        if (q2Unlock.level > 0) {
            res += ` + q_2 \\hat{F}`
        }

        res += `\\\\`;

        res += `\\hat{F} = `;

        const FExp = getFExp(FExponent.level);

        if (FExponent.level > 0) {
            res += `\\left( \\frac{1}{1 - F} \\right)^{${FExponent.level % 2 == 0 ? FExp.toString(0) : FExp.toString(1)}}`;
        } else {
            res += `\\frac{1}{1 - F}`;
        }
    }

    return res;
}

var getTertiaryEquation = () => {
    return `F = ${F.toFixed(8)}`;
}

var getQuaternaryEntries = () => {
    quaternaryEntries = [];

    if (stage === 1) {
        quaternaryEntries.push(new QuaternaryEntry("{\\dot{\\rho}}_{{}\\,}", null));
        quaternaryEntries.push(new QuaternaryEntry("{q}_{{}\\,}", null));
        quaternaryEntries.push(new QuaternaryEntry("{\\hat{F}}_{{}\\,}", null));

        const FHat = smallWorldness.pow(getFExp(FExponent.level));

        quaternaryEntries[0].value = `${rhodot.toString(2)}`;
        quaternaryEntries[1].value = `${q.toString(2)}`;
        quaternaryEntries[2].value = `${FHat.toString(2)}`;

    } else {
        quaternaryEntries.push(new QuaternaryEntry("{N}_{{}\\,}", null));
        quaternaryEntries.push(new QuaternaryEntry("{k_0}_{{}\\,}", null));
        if (rangeMenu.level > 0) {
            quaternaryEntries.push(new QuaternaryEntry("\\;\\beta^-", null));
            quaternaryEntries.push(new QuaternaryEntry("\\;\\beta^+", null));
        }

        quaternaryEntries[0].value = `${getN(N.level).toString(0)}`;
        quaternaryEntries[1].value = `${(getK(kIncrease.level)).toString(0)}`;
        if (rangeMenu.level > 0) {
            quaternaryEntries[2].value = `${beta_min_val.toFixed(2)}`;
            quaternaryEntries[3].value = `${beta_max_val.toFixed(2)}`;
        }
    }

    return quaternaryEntries;
}

var canGoToPreviousStage = () => stage === 1;
var goToPreviousStage = () => {
    stage--;
    theory.invalidatePrimaryEquation();
    theory.invalidateSecondaryEquation();
    theory.invalidateTertiaryEquation();
    quaternaryEntries = [];
    theory.invalidateQuaternaryValues();
};
var canGoToNextStage = () => stage === 0;
var goToNextStage = () => {
    stage++;
    theory.invalidatePrimaryEquation();
    theory.invalidateSecondaryEquation();
    theory.invalidateTertiaryEquation();
    quaternaryEntries = [];
    theory.invalidateQuaternaryValues();
};

var get2DGraphValue = () => currency.value.sign *
    (BigNumber.ONE + currency.value.abs()).log10().toNumber();

var getInternalState = () => `${q.toNumber()} ${beta_min_val} ${beta_max_val}`;

var setInternalState = (state) => {
    let values = state.split(" ");
    if (values.length > 0) q = BigNumber.from(values[0]);
    if (values.length > 1) beta_min_val = Number(values[1]);
    if (values.length > 2) beta_max_val = Number(values[2]);
};

var getPublicationMultiplier = (tau) => tau.pow(pubExponent);
var getPublicationMultiplierFormula = (symbol) => `${symbol}^{${pubExponent}}`;
var getTau = () => currency.value.pow(tauRate);
var getCurrencyFromTau = (tau) => [tau.max(BigNumber.ONE).pow(BigNumber.ONE / tauRate), currency.symbol]

let getC1 = (level) => BigNumber.from(1.14).pow(level);
let getC2 = (level) => BigNumber.TWO.pow(level);
let getN = (level) => BigNumber.TEN * BigNumber.from(1.1).pow(level);
let getQ1 = (level) => BigNumber.from(1.36).pow(level);
let getQ2 = (level) => BigNumber.from(2000) * Utils.getStepwisePowerSum(level, 10, 25, 0);
let getFExp = (level) => BigNumber.ONE + BigNumber.from(0.5*level);
let getK = (level) => BigNumber.TWO * BigNumber.TEN.pow(level);

init();