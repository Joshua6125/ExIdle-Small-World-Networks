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

let c1, c2, Ndot, A;

let k = 0;
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
        Ndot = theory.createUpgrade(2, currency, new ExponentialCost(10, Math.log2(8)));
        let getDesc = (level) => "\\dot{N} = " + getNDot(level).toString(2);
        Ndot.getDescription = (_) => Utils.getMath(getDesc(Ndot.level));
        Ndot.getInfo = (amount) => Utils.getMathTo(getDesc(Ndot.level), getDesc(Ndot.level + amount));
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
    N = 10;
}

let getLNorm = (N, k, p) => {
    let z = N * k * p;
    // if (z <= 1e-10) return BigNumber.ONE; // Limit as p -> 0 is 1.0

    // L_norm = 2 * ln( (z + 2 + sqrt(z^2 + 4z)) / 2 ) / sqrt(z^2 + 4z)
    let z2_4z = z.pow(BigNumber.TWO) + (BigNumber.FOUR * z);
    let sqrt_term = z2_4z.sqrt();
    let log_term = ((z + BigNumber.TWO + sqrt_term) / BigNumber.TWO).log();

    return (BigNumber.TWO * log_term) / sqrt_term;
}

let getCNorm = (p) => {
    // C_norm = (1 - p)^3
    return (BigNumber.ONE - p).pow(3);
}

// Normalized clustering coefficient in Watts-Strogatz small-world models
// C(p) roughly equals C(0)(1 - p)^3
// So normalized C_n(p) = (1 - p)^3/C(0) = (1 - p)^3
let getCNormClosed = (beta) => {
    let p = BigNumber.TEN.pow(beta);
    let log_10 = BigNumber.TEN.log();

    let term1 = (BigNumber.THREE*p)/log_10;
    let term2 = (BigNumber.THREE*(p.pow(BigNumber.TWO)))/(BigNumber.TWO*log_10);
    let term3 = (p.pow(BigNumber.THREE))/(BigNumber.THREE*log_10)

    return beta - term1 + term2 - term3;
}

// Average shortest path length in small‑world networks derived in mean‑field analyses
// (what is used in Newman-Moore-Watts models)
// https://arxiv.org/pdf/cond-mat/9909165 (Eq 21)
let getLNormClosed = (N, k, beta) => {
    let p = BigNumber.TEN.pow(beta);
    let z = N * k * p;

    let z2_4z = z.pow(BigNumber.TWO) + (BigNumber.FOUR * z);
    let sqrt_term = z2_4z.sqrt();

    let res = (z + sqrt_term + BigNumber.TWO)/BigNumber.TWO;

    let numerator = res.log()*(BigNumber.FOUR.log())*(z + BigNumber.FOUR)*BigNumber.TWO

    let denominator = BigNumber.HUNDRED.log() * sqrt_term;

    return beta - numerator/denominator;
}

let FFinal = 0;
let Cnorm = 0;
let Lnorm = 0;

var tick = (elapsedTime, multiplier) =>
{
    let dt = BigNumber.from(elapsedTime * multiplier);
    let bonus = theory.publicationMultiplier;

    // Update N
    N += getNDot(Ndot.level) * dt;
    let N_val = BigNumber.from(N);
    let k_val = getK(k);

    let start = BigNumber.from(beta_min_val);
    let end = BigNumber.from(beta_max_val);

    let range = end - start;
    if (range <= 0) range = BigNumber.from(0.01);

    // Get average using integrals
    let int_L_norm = getLNormClosed(N_val, k_val, end) - getLNormClosed(N_val, k_val, start);
    let int_C_norm = getCNormClosed(end) - getCNormClosed(start);

    Cnorm = int_C_norm; // NOTE: Temperary variable for debugging
    Lnorm = int_L_norm; // NOTE: Temperary variable for debugging

    let F = (int_C_norm - int_L_norm)/range;

    if (!(F instanceof BigNumber)) {
        throw Error(F);
    }

    if (F >= BigNumber.ONE) {
        throw Error("F should not be greater than 1")
    }

    let A_val = getA(A.level);

    let final_F = (BigNumber.ONE - F).pow(-A_val);

    FFinal = final_F; // NOTE: Temperary variable for debugging

    let c1_val = getC1(c1.level);
    let c2_val = getC2(c2.level);

    currency.value += dt * bonus * c1_val * c2_val * (final_F );
    rhodot = c1_val * c2_val * (final_F + 1) * bonus;

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
        res += `\\int_{-8}^{0} U(x) dx`;
    }

    return res;
}

var getSecondaryEquation = () => {
    theory.secondaryEquationHeight = 85;

    // Define the Utility Function U(x)
    let res = `U(x) = C(10^x) - L(N k 10^x)`;

    res += `\\\\`;

    // TODO: I think this is right? But should prob still check again some time.
    res += `L(z) = \\frac{\\theta}{\\sinh\\theta}, \\; \\theta = \\text{cosh}^{-1}\\left(\\frac{z+2}{2}\\right)`;

    res += `\\\\`;

    res += `C(p) = (1-p)^3`;

    return res;
}

var getTertiaryEquation = () => {
    return `\\rho = ${rhodot.toString(2)}, F = ${FFinal.toString(6)}`;
}

var getQuaternaryEntries = () => {
    quaternaryEntries = [];

    quaternaryEntries.push(new QuaternaryEntry("{\\rho}_{{}\\,}", null));
    quaternaryEntries.push(new QuaternaryEntry("{N}_{{}\\,}", null));
    quaternaryEntries.push(new QuaternaryEntry("{k_0}_{{}\\,}", null));
    quaternaryEntries.push(new QuaternaryEntry("{C}_{{}\\,}", null));
    quaternaryEntries.push(new QuaternaryEntry("{L}_{{}\\,}", null));
    if (rangeMenu.level > 0) {
        quaternaryEntries.push(new QuaternaryEntry("{\\beta_\\min}_{{}\\,}", null));
        quaternaryEntries.push(new QuaternaryEntry("{\\beta_\\max}_{{}\\,}", null));
    }

    quaternaryEntries[0].value = `${rhodot.toString(2)}`;
    quaternaryEntries[1].value = `${N.toString(0)}`;
    quaternaryEntries[2].value = `${(getK(k))}`;
    quaternaryEntries[3].value = `${(Cnorm)}`;
    quaternaryEntries[4].value = `${(Lnorm)}`;
    if (rangeMenu.level > 0) {
        quaternaryEntries[5].value = `${beta_min_val.toFixed(2)}`;
        quaternaryEntries[6].value = `${beta_max_val.toFixed(2)}`;
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