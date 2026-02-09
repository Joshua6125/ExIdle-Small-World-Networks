import { BigNumber } from '../../exp/TheorySDK.Linux.1.4.40/api/BigNumber';
import { ExponentialCost, FreeCost } from '../../exp/TheorySDK.Linux.1.4.40/api/Costs';
import { QuaternaryEntry, theory } from '../../exp/TheorySDK.Linux.1.4.40/api/Theory';
import { Utils } from '../../exp/TheorySDK.Linux.1.4.40/api/Utils';

var id = 'small_world_networks';
var name = 'Small World Networks';
var description =
    "Small world networks set on the edge between order and randomness. " +
    "Social circles, the internet, and even neural networks all show a curious mix of \"everyone in clusters, yet strangely close to everyone else.\"\n\n" +
    "In this theory, you tune the rewiring probability of a Watts-Strogatz-style network to make it as small-world as possible. " +
    "By choosing an optimal range of rewiring parameters, you shape the balance between local structure and global reach. " +
    "As the network size grows and new upgrades unlock, you'll sharpen your control over this trade-off and amplify your gains.\n\n" +
    "Can you find the sweet spot where order and randomness cooperate to produce the most efficient small-world network?";
var authors = 'panda_125';

let currency;
let quaternaryEntries;

let rhodot = 0.0;

let c1, c2, N, A;

let smallWorldness = -1;

let beta_min_lim = -4;
let beta_max_lim = 0;
let beta_min_val = beta_min_lim;
let beta_max_val = beta_max_lim;
const BETA_STEP = 0.01;

const pubPower = 0.2;
const tauRate = 1;

// Potential extra features for UI
// - Buttons for more precision
// - Show calculated p values
var createTopRightMenu = () => {
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

    let betaMaxSlider = ui.createSlider({
        minimum: beta_min_lim + BETA_STEP,
        maximum: beta_max_lim,
        value: beta_max_val,
        onValueChanged: () => {
            beta_max_val = Math.max(betaMaxSlider.value, beta_min_val + BETA_STEP);
            betaMaxSlider.value = beta_max_val;

            betaLabelMax.text = Utils.getMath(
                "\\beta_{max}=" + beta_max_val.toFixed(2)
            );

            theory.invalidatePrimaryEquation();
        }
    });

    let betaMinSlider = ui.createSlider({
        minimum: beta_min_lim,
        maximum: beta_max_lim - BETA_STEP,
        value: beta_min_val,
        onValueChanged: () => {
            beta_min_val = Math.min(betaMinSlider.value, beta_max_val - BETA_STEP);
            betaMinSlider.value = beta_min_val;

            betaLabelMin.text = Utils.getMath(
                "\\beta_{min}=" + beta_min_val.toFixed(2)
            );

            theory.invalidatePrimaryEquation();
        }
    });

    let menu = ui.createPopup({
        isPeekable: true,
        title: "Beta Slider",
        content: ui.createStackLayout({
            children: [
                betaLabelMax,
                betaMaxSlider,
                betaLabelMin,
                betaMinSlider,
                ui.createButton({
                    margin: new Thickness(10),
                    text: "Done",
                    onReleased: () => {
                        menu.hide();
                        smallWorldness = computeOneOverOneMinusF();
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
        let getDesc = (level) => "\\dot{N} = " + getNDot(level).toString(0);
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
        rangeMenu.getDescription = (_) => `${Localization.getUpgradeAddTermInfo("v")}`;
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
        kIncrease = theory.createMilestoneUpgrade(1, 3);
        kIncrease.description = `Multiply k0 by 2`;
        kIncrease.boughtOrRefunded = (_) => {
            theory.invalidatePrimaryEquation();
            theory.invalidateQuaternaryValues();
            updateAvailability();
        }
    }
    }
}

var updateAvailability = () => {
    A.isAvailable = AVariable.level > 0
}

var postPublish = () => {
    N = 1000;
}

{
// let getCNormClosed = (beta) => {
//     let p = BigNumber.TEN.pow(beta);
//     let log_10 = BigNumber.TEN.log();
//     if (p <= BigNumber.from(10**(-16))) { return BigNumber.ONE } // p -> 0 implies C(p) -> 1
//     let term1 = (BigNumber.THREE*p)/log_10;
//     let term2 = BigNumber.THREE*(p.pow(BigNumber.TWO))/(BigNumber.TWO*log_10);
//     let term3 = p.pow(BigNumber.THREE)/(BigNumber.THREE*log_10);
//     // A(beta) = term1 - term2 + term3
//     return term1 - term2 + term3;
// };
// let getLNormClosed = (N, k, beta) => {
//     let p = BigNumber.TEN.pow(beta);
//     let z = N * k * p;
//     if (z <= BigNumber.from(10**(-16))) { return BigNumber.ONE } // p -> 0 implies L(p) -> 1
//     let z2_4z = z.pow(BigNumber.TWO) + BigNumber.FOUR * z;
//     let sqrt_term = z2_4z.sqrt();
//     let res = (z + sqrt_term + BigNumber.TWO)/BigNumber.TWO;
//     // B(beta) = 2 * log(res) * log10(2) * (z+4)/sqrt(z^2+4z)
//     return (res.log()*LOG10_2 * BigNumber.TWO * (z + BigNumber.FOUR))/sqrt_term;
// };
//
// let getCNormClosed = (beta) => {
//     let p = BigNumber.TEN.pow(beta);
//     let log_10 = BigNumber.TEN.log();
//     let term1 = (BigNumber.THREE*p)/log_10;
//     let term2 = (BigNumber.THREE*(p.pow(BigNumber.TWO)))/(BigNumber.TWO*log_10);
//     let term3 = (p.pow(BigNumber.THREE))/(BigNumber.THREE*log_10)
//     return beta - term1 + term2 - term3;
// }
//
// let getLNormClosed = (N, k, beta) => {
//     let p = BigNumber.TEN.pow(beta);
//     let z = N * k * p;
//     let z2_4z = z.pow(BigNumber.TWO) + (BigNumber.FOUR * z);
//     let sqrt_term = z2_4z.sqrt();
//     let res = (z + sqrt_term + BigNumber.TWO)/BigNumber.TWO;
//     let numerator = res.log()*(BigNumber.FOUR.log())*(z + BigNumber.FOUR)*BigNumber.TWO
//     let denominator = BigNumber.HUNDRED.log() * sqrt_term;
//     return beta - numerator/denominator;
// }
// getLNormClosed without extra cancellation
}

// Average shortest path length in small‑world networks derived in mean‑field analyses
// (what is used in Newman-Moore-Watts models)
// https://arxiv.org/pdf/cond-mat/9909165 (Eq 21)
function getLNorm(N, k, p) {
    const z = N * k * p;

    // Might add extra guard if result proves to be unstable
    // if (z <= 1e-10) return BigNumber.ONE; // Limit as p -> 0 is 1.0

    // L_norm = 2 * ln( (z + 2 + sqrt(z^2 + 4z)) / 2 ) / sqrt(z^2 + 4z)
    const z2_4z = z.pow(BigNumber.TWO) + (BigNumber.FOUR * z);
    const sqrt_term = z2_4z.sqrt();
    const log_term = ((z + BigNumber.TWO + sqrt_term) / BigNumber.TWO).log();

    return (BigNumber.TWO * log_term) / sqrt_term;
}

// Normalized clustering coefficient in Watts-Strogatz small-world models
// C(p) roughly equals C(0)(1 - p)^3
// So normalized C_n(p) = (1 - p)^3/C(0) = (1 - p)^3
function getCNorm(p) {
    // C_norm = (1 - p)^3
    return (BigNumber.ONE - p).pow(BigNumber.THREE);
}

function computeOneOverOneMinusF() {
    const N_val = getN(N.level); // TODO: Should make a getN()
    const k_val = getK(k.level);

    const start = beta_min_val;
    const end = beta_max_val;

    const range = end - start;
    if (range <= 0) {
        range = BigNumber.from(0.01);
    }

    // Because the utility function is pretty smooth the error scales O(h^2)
    // 100 samples should be enough for now (<1% error)
    const sample_rate = 100;
    const step = range / (sample_rate - 1)

    let avg_vals = []
    for (let b = start; b <= end; b += step) {
        const p = 10**b;

        const C_val = getCNorm(p);
        const L_val = getLNorm(N_val, k_val, p);

        avg_vals.push(C_val - L_val);
    }

    let F = Math.sum(avg_vals)/sample_rate;
    if (F >= 1 || F < 0) {
        F = 0
    }

    // 1/(1 - F)
    const res = BigNumber.from(1/(1 - F));

    return res;
}


let FFinal = 0;
let count = 0;

var tick = (elapsedTime, multiplier) =>
{
    let dt = BigNumber.from(elapsedTime * multiplier);
    let bonus = theory.publicationMultiplier;

    let A_val = getA(A.level);

    let F = smallWorldness;
    if (F < 0) {
        F = computeOneOverOneMinusF();
    }
    F = BigNumber.from(F);

    let SW = F.pow(A_val);

    FFinal = SW; // NOTE: Temperary variable for debugging

    let c1_val = getC1(c1.level);
    let c2_val = getC2(c2.level);

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
    let avgUtility = `\\frac{1}{\\Delta\\beta} \\int_{\\beta_{\\min}}^{\\beta_{\\max}} U(x) dx`;

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
    return `\\text{count} = ${count.toString(2)}, F = ${FFinal.toString(6)}`;
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
    quaternaryEntries[1].value = `${N.toString(0)}`;
    quaternaryEntries[2].value = `${(getK(k))}`;
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

let getC1 = (level) => BigNumber.from(1.25).pow(level);
let getC2 = (level) => BigNumber.TWO.pow(level);
let getNDot = (level) => BigNumber.from(level)/BigNumber.HUNDRED;
let getA = (level) => BigNumber.ONE + BigNumber.from(0.01*level);
let getK = (level) => BigNumber.TWO.pow(1 + level);

init();