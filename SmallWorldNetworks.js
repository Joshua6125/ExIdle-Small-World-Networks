import { BigNumber } from '../../exp/TheorySDK.Linux.1.4.40/api/BigNumber';
import { ExponentialCost, FreeCost } from '../../exp/TheorySDK.Linux.1.4.40/api/Costs';
import { QuaternaryEntry, theory } from '../../exp/TheorySDK.Linux.1.4.40/api/Theory';
import { Utils } from '../../exp/TheorySDK.Linux.1.4.40/api/Utils';

var id = 'small_world_networks';
var name = 'Small World Networks';
var description = 'Balance a noisy small world network.';
var authors = 'panda_125';

let currency;
let quaternaryEntries;
let rangeMenu;

let c1, c2, Ndot, A;

let k = 2;
let N = 10;

let beta_min_lim = -8;
let beta_max_lim = 0;

let beta_min_val = beta_min_lim;
let beta_max_val = beta_max_lim;

const BETA_STEP = 0.01;

let rhodot = 0.0;

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
                    onReleased: () => menu.hide()
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
        c1 = theory.createUpgrade(0, currency, new ExponentialCost(10, Math.log2(3)));
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
        Ndot = theory.createUpgrade(2, currency, new ExponentialCost(10, Math.log2(8)));
        let getDesc = (level) => "\\dot{N} = " + getNDot(level).toString(0);
        Ndot.getDescription = (_) => Utils.getMath(getDesc(Ndot.level));
        Ndot.getInfo = (amount) => Utils.getMathTo(getDesc(Ndot.level), getDesc(Ndot.level + amount));
    }

    {
        A = theory.createUpgrade(3, currency, new ExponentialCost(1e25, Math.log2(10)));
        let getDesc = (level) => "A = " + getC2(level).toString(0);
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
    const milestoneArray = [25, -1];
    theory.setMilestoneCost(new CustomCost((lvl) => tauRate * BigNumber.from(milestoneArray[Math.min(lvl, 1)])));
    {
    {
        AVariable = theory.createMilestoneUpgrade(0, 1);
        AVariable.description = `Small range boost`;
        AVariable.boughtOrRefunded = (_) => {
            theory.invalidatePrimaryEquation();
            updateAvailability();
        }
    }
    }
}

var updateAvailability = () => {
    A.isAvailable = AVariable.level > 0
}

var postPublish = () => {
    N = 10;
}

// Closed form formula's, I think they are correct.
// But averaging using this seemed to not work very well?

// let closedFormLNorm = (N, k, beta) => {
//     let p = 10**beta;

//     let z = N * k * p;
//     let log10 = Math.log(10);

//     // This is the integral primitive of the NW approximation
//     let numerator = 2 * (beta * log10 + Math.log(N * k) + 1);
//     let denominator = z * log10;

//     // throw new Error(z)

//     if (denominator == 0) {
//         throw new Error(denominator);
//     }

//     return numerator / denominator;
// }

// let closedFormCNorm = (beta) => {
//     let p = 10**beta;
//     let log_of_10 = Math.log(10);
//     return beta - (3*p)/log_of_10 + (3*p*p)/(2*log_of_10) - (p*p*p)/(3*log_of_10);
// }

let getLNorm = (N, k, p) => {
    let z = N * k * p;
    if (z <= 1e-10) return BigNumber.ONE; // Limit as p -> 0 is 1.0

    // L_norm = 2 * ln( (z + 2 + sqrt(z^2 + 4z)) / 2 ) / sqrt(z^2 + 4z)
    let z2_4z = z.pow(2) + (BigNumber.FOUR * z);
    let sqrt_term = z2_4z.sqrt();
    let log_term = ((z + BigNumber.TWO + sqrt_term) / BigNumber.TWO).log();

    return (BigNumber.TWO * log_term) / sqrt_term;
}

let getCNorm = (p) => {
    // C_norm = (1 - p)^3
    return (BigNumber.ONE - p).pow(3);
}

var tick = (elapsedTime, multiplier) =>
{
    let dt = BigNumber.from(elapsedTime * multiplier);
    let bonus = theory.publicationMultiplier;

    // Update N
    N += getNDot(Ndot.level) * dt;
    let N_val = BigNumber.from(N);
    let k_val = BigNumber.from(k);

    let start = BigNumber.from(beta_min_val);
    let end = BigNumber.from(beta_max_val);

    let range = end - start;
    if (range <= 0) range = BigNumber.from(0.01);

    let samples = 10;
    let step = range / BigNumber.from(samples);
    let sumUtility = BigNumber.ZERO;

    for (let i = 0; i <= samples; i++) {
        let currentBeta = start + (step * BigNumber.from(i));
        let p = BigNumber.TEN.pow(currentBeta);

        let utility = getCNorm(p) - getLNorm(N_val, k_val, p);
        // if (utility < 0) {
        //     throw new Error(getLNorm(N_val, k_val, p))
        // }
        sumUtility += utility;
    }

    let F = sumUtility / BigNumber.from(samples + 1);

    // Apply A_val to sharpen the curve
    let A_val = getA(A.level);
    let final_F = F.max(BigNumber.ZERO).pow(A_val);

    let c1_val = getC1(c1.level);
    let c2_val = getC2(c2.level);

    currency.value += dt * bonus * c1_val * c2_val * (final_F + 1);
    rhodot = c1_val * c2_val * (final_F + 1) * bonus;

    theory.invalidateSecondaryEquation();
    theory.invalidateTertiaryEquation();
    theory.invalidateQuaternaryValues();
}

var getPrimaryEquation = () => {
    theory.primaryEquationHeight = 60;
    let res = ``;

    res += `\\dot{\\rho} =`;
    if (rangeMenu.level > 0) {
        res += `\\frac{c_1 c_2}{\\beta_\\max - \\beta_\\min} \\int_{\\beta_\\min}^{\\beta_\\max} (C(10^x) - L(10^x)) \\; dx`;
        return res;
    }
    if (AVariable.level > 0) {
        res += `\\frac{c_1 c_2}{\\beta_\\max - \\beta_\\min} \\left( \\int_{\\beta_\\min}^{\\beta_\\max} (C(10^x) - L(N \\cdot k \\cdot 10^x)) \\; dx \\right)^{A}`;
        return res;
    }

    return res + "c_1 c_2  \\int_{-8}^{0} (C(10^x) - L(10^x)) \\; dp";
}

var getSecondaryEquation = () => {
    theory.secondaryEquationHeight = 60;
    // Add part for L_norm, with substitution to make expression bearable
    res = `L(z) = \\frac{2\\theta}{\\sinh(\\theta)} , \\theta = \\cosh^{-1}\\left( \\frac{z + 2}{2}\\right)`;

    // Next line
    res += `\\\\`;

    // C_norm part
    res += `C(p) = (1 - p)^3`;

    return res
}

var getTertiaryEquation = () => {
    return `\\rho = ${rhodot.toString(2)}`;
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
    quaternaryEntries[2].value = `${k.toFixed(2)}`;
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
let getNDot = (level) => BigNumber.from(level)/BigNumber.HUNDRED;
let getA  = (level) => BigNumber.ONE + BigNumber.from(0.1)*BigNumber.from(level);

init();