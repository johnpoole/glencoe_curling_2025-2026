const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluatePosition17 } = require('../js/analyze/curlingeval.js');

/**
 * Helper to assert that two floating point numbers are approximately equal.
 * @param {number} actual
 * @param {number} expected
 * @param {number} [tolerance]
 */
function assertApprox(actual, expected, tolerance = 1e-9) {
  assert.ok(
    Number.isFinite(actual),
    `Expected a finite number but received ${actual}`
  );
  const scale = Math.max(1, Math.abs(expected));
  assert.ok(
    Math.abs(actual - expected) <= tolerance * scale,
    `Expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

/**
 * Run a scenario regression check against stored expected values.
 * @param {object} scenario
 * @param {object} expected
 * @param {number} [advTolerance]
 * @param {number} [bucketTolerance]
 */
function runScenarioRegression(scenario, expected, advTolerance = 1e-8, bucketTolerance = 1e-8) {
  const actual = evaluatePosition17(
    scenario.shotNumber,
    scenario.hammerTeam,
    scenario.stones,
    scenario.skill
  );

  assertApprox(actual.advantage.red, expected.advantage.red, advTolerance);
  assertApprox(actual.advantage.yellow, expected.advantage.yellow, advTolerance);

  const sum = Object.values(actual.buckets17).reduce((acc, value) => acc + value, 0);
  assertApprox(sum, 1, 1e-9);

  for (const key of Object.keys(expected.buckets17)) {
    assertApprox(actual.buckets17[key], expected.buckets17[key], bucketTolerance);
  }
}

test('evaluatePosition17 matches known baseline probabilities (blank first shot)', () => {
  runScenarioRegression(
    {
      shotNumber: 0,
      hammerTeam: 'red',
      stones: [],
      skill: 50,
    },
    {
      advantage: {
        red: 0.8714212528966688,
        yellow: -0.8714212528966688,
      },
      buckets17: {
        '-8': 0,
        '-7': 1.9684077667762883e-14,
        '-6': 1.2696519903315092e-11,
        '-5': 2.634785952290335e-9,
        '-4': 2.1989077281679227e-7,
        '-3': 0.000015941289454994023,
        '-2': 0.0006196973668374297,
        '-1': 0.012206957250067416,
        '0': 0.28418596975126736,
        '1': 0.4966673819608179,
        '2': 0.1963596261319979,
        '3': 0.009590935928484,
        '4': 0.0003532417921514552,
        '5': 2.5114554248427283e-8,
        '6': 8.61709927640064e-10,
        '7': 1.4268521992046147e-11,
        '8': 1.1401950519694215e-13,
      },
    }
  );
});

test('evaluatePosition17 matches known contested mid-end probabilities', () => {
  runScenarioRegression(
    {
      shotNumber: 8,
      hammerTeam: 'red',
      stones: [
        ['red', 0.1, 0.2],
        ['yellow', -0.6, 0.9],
        ['red', 0.5, -0.8],
        ['yellow', 0.0, 1.5],
      ],
      skill: 60,
    },
    {
      advantage: {
        red: 0.5075987884228725,
        yellow: -0.5075987884228725,
      },
      buckets17: {
        '-8': 0,
        '-7': 0,
        '-6': 0,
        '-5': 5.03126347490665e-10,
        '-4': 9.462360406214381e-8,
        '-3': 0.000012465869790344062,
        '-2': 0.0007101193525061504,
        '-1': 0.016529418690081312,
        '0': 0.3666883813259724,
        '1': 0.4924367034192764,
        '2': 0.12063494560679691,
        '3': 0.0029441774786149255,
        '4': 0.0000436921118341284,
        '5': 1.0093232847655454e-9,
        '6': 9.073726311147792e-12,
        '7': 0,
        '8': 0,
      },
    }
  );
});

test('evaluatePosition17 matches late-end yellow hammer cluttered house scenario', () => {
  runScenarioRegression(
    {
      shotNumber: 12,
      hammerTeam: 'yellow',
      stones: [
        ['red', 0.0, 0.3],
        ['red', -0.4, 0.6],
        ['yellow', 0.2, -0.4],
        ['yellow', -0.2, -0.2],
        ['red', 0.5, 1.2],
        ['yellow', -0.6, 1.4],
        ['red', 0.3, -1.0],
        ['yellow', 0.1, 0.9],
      ],
      skill: 55,
    },
    {
      advantage: {
        red: 1.0544536240330378,
        yellow: -1.0544536240330378,
      },
      buckets17: {
        '-8': 0,
        '-7': 0,
        '-6': 0,
        '-5': 3.0851658723494007e-7,
        '-4': 0.00002791401942691222,
        '-3': 0.0014261941263966377,
        '-2': 0.025399917476268987,
        '-1': 0.14900991639628774,
        '0': 0.6716192056475715,
        '1': 0.14772584161868285,
        '2': 0.004778273716110942,
        '3': 0.000012412676721495444,
        '4': 1.580592058639758e-8,
        '5': 2.5256553429985392e-14,
        '6': 1.2661006624863537e-17,
        '7': 0,
        '8': 0,
      },
    }
  );
});

test('evaluatePosition17 matches final stone deterministic scoring scenario', () => {
  runScenarioRegression(
    {
      shotNumber: 15,
      hammerTeam: 'red',
      stones: [
        ['red', 0.05, 0.1],
        ['red', -0.2, 0.3],
        ['red', 0.3, -0.4],
        ['yellow', 0.9, 0.2],
        ['yellow', -1.0, -0.1],
        ['yellow', 1.2, -0.6],
        ['yellow', -0.5, 1.5],
      ],
      skill: 50,
    },
    {
      advantage: {
        red: -0.2478422189928544,
        yellow: 0.2478422189928544,
      },
      buckets17: {
        '-8': 0,
        '-7': 0,
        '-6': 0,
        '-5': 0,
        '-4': 0,
        '-3': 0,
        '-2': 0,
        '-1': 0,
        '0': 0,
        '1': 0,
        '2': 0,
        '3': 1,
        '4': 0,
        '5': 0,
        '6': 0,
        '7': 0,
        '8': 0,
      },
    },
    1e-9,
    1e-12
  );
});

test('evaluatePosition17 matches low skill early guard battle scenario', () => {
  runScenarioRegression(
    {
      shotNumber: 4,
      hammerTeam: 'yellow',
      stones: [
        ['yellow', 0.0, 0.5],
        ['red', -0.3, 0.7],
        ['yellow', 0.3, 1.1],
        ['red', 0.6, 1.6],
      ],
      skill: 25,
    },
    {
      advantage: {
        red: -1.0115764701226486,
        yellow: 1.0115764701226486,
      },
      buckets17: {
        '-8': 0,
        '-7': 1.412437228537556e-17,
        '-6': 4.6031495851813504e-14,
        '-5': 3.94346801820675e-11,
        '-4': 1.1100661819908349e-8,
        '-3': 0.0000022177903330904137,
        '-2': 0.0001941235168677038,
        '-1': 0.007034831088053006,
        '0': 0.24617442002775716,
        '1': 0.5283798639831696,
        '2': 0.20961358926927662,
        '3': 0.00839384867638876,
        '4': 0.00020708632557128457,
        '5': 8.058056413742865e-9,
        '6': 1.2363393757215378e-10,
        '7': 7.479518807533093e-13,
        '8': 1.7841779827995097e-15,
      },
    }
  );
});

test('evaluatePosition17 matches high skill precise setup scenario', () => {
  runScenarioRegression(
    {
      shotNumber: 10,
      hammerTeam: 'red',
      stones: [
        ['red', -0.1, 0.2],
        ['red', 0.2, -0.3],
        ['yellow', -0.4, 0.4],
        ['yellow', 0.4, 0.7],
        ['red', 0.0, -0.8],
        ['yellow', -0.7, -1.2],
      ],
      skill: 85,
    },
    {
      advantage: {
        red: 1.4678870724222826,
        yellow: -1.4678870724222826,
      },
      buckets17: {
        '-8': 0,
        '-7': 0,
        '-6': 0,
        '-5': 2.975396104083759e-11,
        '-4': 6.580577400655372e-9,
        '-3': 0.000001154888694253637,
        '-2': 0.00009927917516019055,
        '-1': 0.003950480307677699,
        '0': 0.16971147959178132,
        '1': 0.49996830782679946,
        '2': 0.30436830405020343,
        '3': 0.020911286373691912,
        '4': 0.0009896155533423204,
        '5': 8.258415341566958e-8,
        '6': 3.038164592251731e-9,
        '7': 0,
        '8': 0,
      },
    }
  );
});

test('evaluatePosition17 matches late end guard-heavy near-blank scenario', () => {
  runScenarioRegression(
    {
      shotNumber: 13,
      hammerTeam: 'red',
      stones: [
        ['red', 0.9, 1.3],
        ['yellow', -0.8, 1.5],
        ['red', 0.6, 1.7],
        ['yellow', -0.6, 1.2],
        ['red', 0.7, -1.6],
      ],
      skill: 60,
    },
    {
      advantage: {
        red: 0.22473528011535387,
        yellow: -0.22473528011535387,
      },
      buckets17: {
        '-8': 0,
        '-7': 0,
        '-6': 0,
        '-5': 0,
        '-4': 0,
        '-3': 0.00001114513518123992,
        '-2': 0.0008893542452810555,
        '-1': 0.02323318152598942,
        '0': 0.46342869032668876,
        '1': 0.4483300370227908,
        '2': 0.06338831374983128,
        '3': 0.0007153452349407099,
        '4': 0.000003932759296760041,
        '5': 0,
        '6': 0,
        '7': 0,
        '8': 0,
      },
    }
  );
});

test('evaluatePosition17 matches yellow steal pressure scenario', () => {
  runScenarioRegression(
    {
      shotNumber: 11,
      hammerTeam: 'red',
      stones: [
        ['yellow', 0.05, 0.05],
        ['red', -0.6, 0.7],
        ['yellow', 0.3, -0.2],
        ['red', 0.8, 1.4],
        ['yellow', -0.2, 0.3],
        ['yellow', 0.4, 0.1],
      ],
      skill: 70,
    },
    {
      advantage: {
        red: -0.6878833527929833,
        yellow: 0.6878833527929833,
      },
      buckets17: {
        '-8': 0,
        '-7': 0,
        '-6': 8.881891209697739e-10,
        '-5': 1.8911016750316748e-7,
        '-4': 0.000012719716042900011,
        '-3': 0.0005837767718562103,
        '-2': 0.01128516851356637,
        '-1': 0.08683462597646245,
        '0': 0.620293665437539,
        '1': 0.2612893045689862,
        '2': 0.019557869914899387,
        '3': 0.00014206784449934177,
        '4': 6.112577914119423e-7,
        '5': 0,
        '6': 0,
        '7': 0,
        '8': 0,
      },
    }
  );
});

test('evaluatePosition17 matches final stone blank end scenario', () => {
  runScenarioRegression(
    {
      shotNumber: 15,
      hammerTeam: 'yellow',
      stones: [
        ['red', 2.5, 1.5],
        ['yellow', -2.4, 1.6],
        ['red', 2.2, -1.9],
        ['yellow', -2.3, -1.8],
      ],
      skill: 40,
    },
    {
      advantage: {
        red: 0,
        yellow: 0,
      },
      buckets17: {
        '-8': 0,
        '-7': 0,
        '-6': 0,
        '-5': 0,
        '-4': 0,
        '-3': 0,
        '-2': 0,
        '-1': 0,
        '0': 1,
        '1': 0,
        '2': 0,
        '3': 0,
        '4': 0,
        '5': 0,
        '6': 0,
        '7': 0,
        '8': 0,
      },
    },
    1e-10,
    1e-12
  );
});
