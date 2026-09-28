/**
 * Every seeded row's id, generated once with `newId()` and committed — never
 * regenerated. Idempotency (doc 02 §7) depends on these staying fixed forever.
 */
export const CATEGORY_IDS = {
  coffee: '01a0e67a-33ae-7ce5-b743-b7515916139b',
  tea: '01a0e67a-33af-79ac-adfa-f37caf7718de',
  milkTea: '01a0e67a-33af-7b58-8911-cef32052bf65',
  blended: '01a0e67a-33af-7a57-8308-cdd11b6c3f42',
  pastry: '01a0e67a-33af-7cf0-847d-df38aa529b18',
} as const;

export const PRODUCT_IDS = {
  icedMilkCoffee: '01a0e67a-33af-7ef2-927b-90c02731af82',
  icedBlackCoffee: '01a0e67a-33af-748c-8211-e69cfe094b03',
  saltedCreamCoffee: '01a0e67a-33af-7a0d-a0ee-b3d8e67e7a38',
  coconutCoffee: '01a0e67a-33af-7a69-b699-1a232b25d386',
  eggCoffee: '01a0e67a-33af-7b65-9d4d-e083bbfec507',
  espresso: '01a0e67a-33af-7243-8f69-3543b4c5bc74',
  americano: '01a0e67a-33af-7bb2-a8d4-523d7d30a858',
  latte: '01a0e67a-33af-79e6-b85a-394501a26870',
  cappuccino: '01a0e67a-33af-7663-902b-0a8086bbe47f',
  coldBrew: '01a0e67a-33af-7da2-889d-b9a51ad32201',

  peachOrangeLemongrassTea: '01a0e67a-33af-7841-ab4d-b7916963bd92',
  lycheeTea: '01a0e67a-33af-78b1-a397-12eb9cfc8405',
  kumquatTea: '01a0e67a-33af-7059-b488-3827e2b5959b',
  jasmineGreenTea: '01a0e67a-33af-7d3c-8610-b2716dfe7486',
  oolongTea: '01a0e67a-33af-72d5-9514-cb2b2de79ef6',

  classicMilkTea: '01a0e67a-33af-743d-a4c4-39a0241de1ae',
  brownSugarMilkTea: '01a0e67a-33af-782e-9800-2c30d06fc7c3',
  matchaMilkTea: '01a0e67a-33af-79fa-b2bd-01f4594fd642',
  taroMilkTea: '01a0e67a-33af-765e-91db-56752465e452',
  oolongMilkTea: '01a0e67a-33af-746d-9dbb-bffcf6dabbed',

  cookiesAndCreamFrappe: '01a0e67a-33af-7762-a459-d89112ddcce4',
  matchaFrappe: '01a0e67a-33af-74c1-a9cf-64e85ec558d2',
  coffeeFrappe: '01a0e67a-33af-74e8-b867-4582646f5942',
  mangoSmoothie: '01a0e67a-33af-742a-b7cd-65f27f55e9b2',
  avocadoSmoothie: '01a0e67a-33af-75fa-b3c1-ac5a37594e9c',

  croissant: '01a0e67a-33af-791c-891a-07eaf011dfbb',
  banhMi: '01a0e67a-33af-7a47-b27e-592b1d1164f2',
  tiramisu: '01a0e67a-33af-7604-8ccd-965265ea4674',
  chocolateCake: '01a0e67a-33af-794a-963d-5f6d40b24a87',
  cremeCaramel: '01a0e67a-33af-7de1-9693-a881671bb6bf',
} as const;

export const TOPPING_IDS = {
  blackPearls: '01a0e67a-33af-7e79-85e0-5fa716cf59d0',
  whitePearls: '01a0e67a-33af-79a0-a250-41f2290d7dbd',
  cheeseFoam: '01a0e67a-33af-72ad-bdbe-1fcf4e056b58',
  grassJelly: '01a0e67a-33af-71a1-8af5-b836442a0349',
  coconutJelly: '01a0e67a-33af-7f59-bc2f-c9f2d7de5b73',
  extraEspressoShot: '01a0e67a-33af-7666-9288-12ded4c6ea1b',
  peachSlices: '01a0e67a-33b0-76a4-8ee8-cb0562b7f323',
} as const;
