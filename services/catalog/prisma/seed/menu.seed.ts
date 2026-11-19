import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Redis } from 'ioredis';
import { PrismaClient } from '../../generated/prisma/client.js';
import { CATEGORY_IDS, PRODUCT_IDS, TOPPING_IDS } from './ids.js';

if (process.env.NODE_ENV === 'production') {
  console.error('seed:dev refuses to run when NODE_ENV=production');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Seed defaults (product-overview §8): S +0, M +6,000, L +10,000.
const SIZE_DELTA_VND: Record<'S' | 'M' | 'L', number> = { S: 0, M: 6_000, L: 10_000 };

interface CategorySeed {
  id: string;
  nameEn: string;
  nameVi: string;
  sortOrder: number;
}

interface ProductSeed {
  id: string;
  categoryKey: keyof typeof CATEGORY_IDS;
  nameEn: string;
  nameVi: string;
  basePriceVnd: number;
  sizes: ('S' | 'M' | 'L')[];
  sortOrder: number;
  stockQty?: number;
  isAvailable?: boolean;
}

interface ToppingSeed {
  id: string;
  nameEn: string;
  nameVi: string;
  priceVnd: number;
}

const CATEGORIES: CategorySeed[] = [
  { id: CATEGORY_IDS.coffee, nameEn: 'Coffee', nameVi: 'Cà phê', sortOrder: 1 },
  { id: CATEGORY_IDS.tea, nameEn: 'Tea', nameVi: 'Trà', sortOrder: 2 },
  { id: CATEGORY_IDS.milkTea, nameEn: 'Milk tea', nameVi: 'Trà sữa', sortOrder: 3 },
  { id: CATEGORY_IDS.blended, nameEn: 'Blended', nameVi: 'Đá xay', sortOrder: 4 },
  { id: CATEGORY_IDS.pastry, nameEn: 'Pastry', nameVi: 'Bánh', sortOrder: 5 },
];

const PRODUCTS: ProductSeed[] = [
  // Coffee
  {
    id: PRODUCT_IDS.icedMilkCoffee,
    categoryKey: 'coffee',
    nameEn: 'Iced milk coffee',
    nameVi: 'Cà phê sữa đá',
    basePriceVnd: 29_000,
    sizes: ['S', 'M', 'L'],
    sortOrder: 1,
  },
  {
    id: PRODUCT_IDS.icedBlackCoffee,
    categoryKey: 'coffee',
    nameEn: 'Iced black coffee',
    nameVi: 'Cà phê đen đá',
    basePriceVnd: 25_000,
    sizes: ['S', 'M', 'L'],
    sortOrder: 2,
  },
  {
    id: PRODUCT_IDS.saltedCreamCoffee,
    categoryKey: 'coffee',
    nameEn: 'Salted cream coffee',
    nameVi: 'Cà phê muối',
    basePriceVnd: 39_000,
    sizes: ['S', 'M', 'L'],
    sortOrder: 3,
  },
  {
    id: PRODUCT_IDS.coconutCoffee,
    categoryKey: 'coffee',
    nameEn: 'Coconut coffee',
    nameVi: 'Cà phê cốt dừa',
    basePriceVnd: 45_000,
    sizes: ['M', 'L'],
    sortOrder: 4,
  },
  {
    id: PRODUCT_IDS.eggCoffee,
    categoryKey: 'coffee',
    nameEn: 'Egg coffee',
    nameVi: 'Cà phê trứng',
    basePriceVnd: 45_000,
    sizes: ['S'],
    sortOrder: 5,
  },
  {
    id: PRODUCT_IDS.espresso,
    categoryKey: 'coffee',
    nameEn: 'Espresso',
    nameVi: 'Espresso',
    basePriceVnd: 35_000,
    sizes: ['S', 'M'],
    sortOrder: 6,
  },
  {
    id: PRODUCT_IDS.americano,
    categoryKey: 'coffee',
    nameEn: 'Americano',
    nameVi: 'Americano',
    basePriceVnd: 40_000,
    sizes: ['S', 'M', 'L'],
    sortOrder: 7,
  },
  {
    id: PRODUCT_IDS.latte,
    categoryKey: 'coffee',
    nameEn: 'Latte',
    nameVi: 'Latte',
    basePriceVnd: 49_000,
    sizes: ['S', 'M', 'L'],
    sortOrder: 8,
  },
  {
    id: PRODUCT_IDS.cappuccino,
    categoryKey: 'coffee',
    nameEn: 'Cappuccino',
    nameVi: 'Cappuccino',
    basePriceVnd: 49_000,
    sizes: ['S', 'M'],
    sortOrder: 9,
  },
  {
    id: PRODUCT_IDS.coldBrew,
    categoryKey: 'coffee',
    nameEn: 'Cold brew',
    nameVi: 'Cold brew',
    basePriceVnd: 45_000,
    sizes: ['M', 'L'],
    sortOrder: 10,
    stockQty: 5,
  },

  // Tea
  {
    id: PRODUCT_IDS.peachOrangeLemongrassTea,
    categoryKey: 'tea',
    nameEn: 'Peach orange lemongrass tea',
    nameVi: 'Trà đào cam sả',
    basePriceVnd: 45_000,
    sizes: ['M', 'L'],
    sortOrder: 1,
  },
  {
    id: PRODUCT_IDS.lycheeTea,
    categoryKey: 'tea',
    nameEn: 'Lychee tea',
    nameVi: 'Trà vải',
    basePriceVnd: 45_000,
    sizes: ['M', 'L'],
    sortOrder: 2,
  },
  {
    id: PRODUCT_IDS.kumquatTea,
    categoryKey: 'tea',
    nameEn: 'Kumquat tea',
    nameVi: 'Trà tắc',
    basePriceVnd: 29_000,
    sizes: ['M', 'L'],
    sortOrder: 3,
  },
  {
    id: PRODUCT_IDS.jasmineGreenTea,
    categoryKey: 'tea',
    nameEn: 'Jasmine green tea',
    nameVi: 'Trà xanh nhài',
    basePriceVnd: 35_000,
    sizes: ['M', 'L'],
    sortOrder: 4,
  },
  {
    id: PRODUCT_IDS.oolongTea,
    categoryKey: 'tea',
    nameEn: 'Oolong tea',
    nameVi: 'Trà ô long',
    basePriceVnd: 35_000,
    sizes: ['M', 'L'],
    sortOrder: 5,
  },

  // Milk tea
  {
    id: PRODUCT_IDS.classicMilkTea,
    categoryKey: 'milkTea',
    nameEn: 'Classic milk tea',
    nameVi: 'Trà sữa truyền thống',
    basePriceVnd: 35_000,
    sizes: ['M', 'L'],
    sortOrder: 1,
  },
  {
    id: PRODUCT_IDS.brownSugarMilkTea,
    categoryKey: 'milkTea',
    nameEn: 'Brown sugar milk tea',
    nameVi: 'Trà sữa đường đen',
    basePriceVnd: 45_000,
    sizes: ['M', 'L'],
    sortOrder: 2,
  },
  {
    id: PRODUCT_IDS.matchaMilkTea,
    categoryKey: 'milkTea',
    nameEn: 'Matcha milk tea',
    nameVi: 'Trà sữa matcha',
    basePriceVnd: 45_000,
    sizes: ['M', 'L'],
    sortOrder: 3,
  },
  {
    id: PRODUCT_IDS.taroMilkTea,
    categoryKey: 'milkTea',
    nameEn: 'Taro milk tea',
    nameVi: 'Trà sữa khoai môn',
    basePriceVnd: 42_000,
    sizes: ['M', 'L'],
    sortOrder: 4,
  },
  {
    id: PRODUCT_IDS.oolongMilkTea,
    categoryKey: 'milkTea',
    nameEn: 'Oolong milk tea',
    nameVi: 'Trà sữa ô long',
    basePriceVnd: 42_000,
    sizes: ['M', 'L'],
    sortOrder: 5,
  },

  // Blended
  {
    id: PRODUCT_IDS.cookiesAndCreamFrappe,
    categoryKey: 'blended',
    nameEn: 'Cookies & cream frappé',
    nameVi: 'Cookies đá xay',
    basePriceVnd: 55_000,
    sizes: ['M', 'L'],
    sortOrder: 1,
  },
  {
    id: PRODUCT_IDS.matchaFrappe,
    categoryKey: 'blended',
    nameEn: 'Matcha frappé',
    nameVi: 'Matcha đá xay',
    basePriceVnd: 55_000,
    sizes: ['M', 'L'],
    sortOrder: 2,
  },
  {
    id: PRODUCT_IDS.coffeeFrappe,
    categoryKey: 'blended',
    nameEn: 'Coffee frappé',
    nameVi: 'Cà phê đá xay',
    basePriceVnd: 52_000,
    sizes: ['M', 'L'],
    sortOrder: 3,
  },
  {
    id: PRODUCT_IDS.mangoSmoothie,
    categoryKey: 'blended',
    nameEn: 'Mango smoothie',
    nameVi: 'Sinh tố xoài',
    basePriceVnd: 49_000,
    sizes: ['M', 'L'],
    sortOrder: 4,
  },
  {
    id: PRODUCT_IDS.avocadoSmoothie,
    categoryKey: 'blended',
    nameEn: 'Avocado smoothie',
    nameVi: 'Sinh tố bơ',
    basePriceVnd: 52_000,
    sizes: ['M', 'L'],
    sortOrder: 5,
    isAvailable: false,
  },

  // Pastry
  {
    id: PRODUCT_IDS.croissant,
    categoryKey: 'pastry',
    nameEn: 'Croissant',
    nameVi: 'Bánh sừng bò',
    basePriceVnd: 35_000,
    sizes: ['S'],
    sortOrder: 1,
    stockQty: 12,
  },
  {
    id: PRODUCT_IDS.banhMi,
    categoryKey: 'pastry',
    nameEn: 'Bánh mì',
    nameVi: 'Bánh mì',
    basePriceVnd: 30_000,
    sizes: ['S'],
    sortOrder: 2,
    stockQty: 20,
  },
  {
    id: PRODUCT_IDS.tiramisu,
    categoryKey: 'pastry',
    nameEn: 'Tiramisu',
    nameVi: 'Tiramisu',
    basePriceVnd: 45_000,
    sizes: ['S'],
    sortOrder: 3,
    stockQty: 8,
  },
  {
    id: PRODUCT_IDS.chocolateCake,
    categoryKey: 'pastry',
    nameEn: 'Chocolate cake',
    nameVi: 'Bánh sô-cô-la',
    basePriceVnd: 45_000,
    sizes: ['S'],
    sortOrder: 4,
    stockQty: 8,
  },
  {
    id: PRODUCT_IDS.cremeCaramel,
    categoryKey: 'pastry',
    nameEn: 'Crème caramel',
    nameVi: 'Bánh flan',
    basePriceVnd: 25_000,
    sizes: ['S'],
    sortOrder: 5,
    stockQty: 10,
  },
];

const TOPPINGS: ToppingSeed[] = [
  {
    id: TOPPING_IDS.blackPearls,
    nameEn: 'Black tapioca pearls',
    nameVi: 'Trân châu đen',
    priceVnd: 8_000,
  },
  {
    id: TOPPING_IDS.whitePearls,
    nameEn: 'White pearls',
    nameVi: 'Trân châu trắng',
    priceVnd: 8_000,
  },
  { id: TOPPING_IDS.cheeseFoam, nameEn: 'Cheese foam', nameVi: 'Kem phô mai', priceVnd: 12_000 },
  { id: TOPPING_IDS.grassJelly, nameEn: 'Grass jelly', nameVi: 'Thạch sương sáo', priceVnd: 6_000 },
  { id: TOPPING_IDS.coconutJelly, nameEn: 'Coconut jelly', nameVi: 'Thạch dừa', priceVnd: 6_000 },
  {
    id: TOPPING_IDS.extraEspressoShot,
    nameEn: 'Extra espresso shot',
    nameVi: 'Thêm shot espresso',
    priceVnd: 10_000,
  },
  { id: TOPPING_IDS.peachSlices, nameEn: 'Peach slices', nameVi: 'Đào miếng', priceVnd: 10_000 },
];

// One line per product, both languages (≤ 500 characters, the column's limit).
const DESCRIPTIONS: Record<string, [en: string, vi: string]> = {
  'Iced milk coffee': [
    'Strong phin-dripped coffee with sweetened condensed milk, over ice.',
    'Cà phê phin đậm đà pha sữa đặc, thêm đá.',
  ],
  'Iced black coffee': [
    'Phin-dripped robusta, bold and lightly sweet, over ice.',
    'Robusta pha phin, đậm vị, ngọt nhẹ, thêm đá.',
  ],
  'Salted cream coffee': [
    'Iced coffee under a layer of lightly salted cream.',
    'Cà phê đá phủ lớp kem muối béo nhẹ.',
  ],
  'Coconut coffee': [
    'Coffee blended with icy coconut cream.',
    'Cà phê hoà cùng cốt dừa xay đá mát lạnh.',
  ],
  'Egg coffee': [
    'Hanoi-style coffee under a whipped egg-yolk cream.',
    'Cà phê kiểu Hà Nội dưới lớp kem trứng đánh bông.',
  ],
  Espresso: ['A single, concentrated shot.', 'Một shot cà phê đậm đặc.'],
  Americano: ['Espresso lengthened with hot water.', 'Espresso pha loãng với nước nóng.'],
  Latte: [
    'Espresso with steamed milk and a thin layer of foam.',
    'Espresso với sữa nóng và lớp bọt mỏng.',
  ],
  Cappuccino: [
    'Espresso, steamed milk and a thick cap of foam.',
    'Espresso, sữa nóng và lớp bọt sữa dày.',
  ],
  'Cold brew': [
    'Coffee steeped cold overnight: smooth, with little bitterness.',
    'Cà phê ủ lạnh qua đêm, êm và ít đắng.',
  ],
  'Peach orange lemongrass tea': [
    'Black tea with peach, orange and fresh lemongrass.',
    'Trà đen cùng đào, cam và sả tươi.',
  ],
  'Lychee tea': ['Fragrant tea with lychee fruit.', 'Trà thơm cùng quả vải.'],
  'Kumquat tea': [
    'Green tea with fresh kumquat and a touch of honey.',
    'Trà xanh với tắc tươi và chút mật ong.',
  ],
  'Jasmine green tea': [
    'Light green tea scented with jasmine.',
    'Trà xanh nhẹ, ướp hương hoa nhài.',
  ],
  'Oolong tea': ['Roasted oolong, warm and toasty.', 'Trà ô long rang, thơm ấm.'],
  'Classic milk tea': [
    'Black tea and milk, sweetened just right.',
    'Trà đen và sữa, ngọt vừa phải.',
  ],
  'Brown sugar milk tea': [
    'Fresh milk over slow-cooked brown sugar syrup.',
    'Sữa tươi trên lớp đường đen nấu chậm.',
  ],
  'Matcha milk tea': ['Japanese matcha whisked into milk.', 'Matcha Nhật đánh cùng sữa.'],
  'Taro milk tea': ['Creamy taro with milk tea.', 'Khoai môn bùi béo cùng trà sữa.'],
  'Oolong milk tea': ['Roasted oolong with milk.', 'Ô long rang pha cùng sữa.'],
  'Cookies & cream frappé': [
    'Ice-blended milk with chocolate cookies.',
    'Sữa xay đá cùng bánh quy sô-cô-la.',
  ],
  'Matcha frappé': ['Matcha and milk blended with ice.', 'Matcha và sữa xay cùng đá.'],
  'Coffee frappé': ['Coffee and milk blended with ice.', 'Cà phê và sữa xay cùng đá.'],
  'Mango smoothie': ['Ripe mango blended with ice.', 'Xoài chín xay cùng đá.'],
  'Avocado smoothie': ['Avocado blended with condensed milk.', 'Bơ xay cùng sữa đặc.'],
  Croissant: ['Buttery and flaky, baked every morning.', 'Bơ thơm, giòn xốp, nướng mỗi sáng.'],
  'Bánh mì': [
    'Crusty baguette with pâté, cold cuts and pickled vegetables.',
    'Bánh mì giòn với pa-tê, chả và đồ chua.',
  ],
  Tiramisu: [
    'Coffee-soaked sponge layered with mascarpone cream.',
    'Bánh bông lan thấm cà phê xen lớp kem mascarpone.',
  ],
  'Chocolate cake': ['Rich, moist dark chocolate cake.', 'Bánh sô-cô-la đen ẩm, đậm vị.'],
  'Crème caramel': ['Silky custard under a thin caramel.', 'Bánh flan mềm mịn dưới lớp caramel.'],
};

// Allowed toppings by category.
const ALLOWED_TOPPINGS: Record<keyof typeof CATEGORY_IDS, (keyof typeof TOPPING_IDS)[]> = {
  coffee: ['extraEspressoShot', 'cheeseFoam'],
  tea: ['grassJelly', 'coconutJelly', 'peachSlices', 'whitePearls'],
  milkTea: ['blackPearls', 'whitePearls', 'cheeseFoam', 'grassJelly', 'coconutJelly'],
  blended: ['extraEspressoShot', 'cheeseFoam'],
  pastry: [],
};

async function main(): Promise<void> {
  // Existence is checked before writing — `upsert`'s return value does not say which
  // branch ran, and comparing createdAt/updatedAt is unreliable once a row has been
  // through a genuinely no-op `update: {}` more than once.
  const [existingCategoryIds, existingProductIds, existingToppingIds] = await Promise.all([
    prisma.category.findMany({
      where: { id: { in: CATEGORIES.map((c) => c.id) } },
      select: { id: true },
    }),
    prisma.product.findMany({
      where: { id: { in: PRODUCTS.map((p) => p.id) } },
      select: { id: true },
    }),
    prisma.topping.findMany({
      where: { id: { in: TOPPINGS.map((t) => t.id) } },
      select: { id: true },
    }),
  ]).then((rows) => rows.map((r) => new Set(r.map((row) => row.id))));

  for (const category of CATEGORIES) {
    await prisma.category.upsert({ where: { id: category.id }, create: category, update: {} });
  }

  for (const topping of TOPPINGS) {
    await prisma.topping.upsert({ where: { id: topping.id }, create: topping, update: {} });
  }

  for (const product of PRODUCTS) {
    const isNew = !existingProductIds.has(product.id);
    const description = DESCRIPTIONS[product.nameEn];
    if (!description) throw new Error(`No description for ${product.nameEn}`);
    const [descriptionEn, descriptionVi] = description;
    await prisma.product.upsert({
      where: { id: product.id },
      create: {
        id: product.id,
        categoryId: CATEGORY_IDS[product.categoryKey],
        nameEn: product.nameEn,
        nameVi: product.nameVi,
        descriptionEn,
        descriptionVi,
        basePriceVnd: product.basePriceVnd,
        sortOrder: product.sortOrder,
        stockQty: product.stockQty ?? null,
        isAvailable: product.isAvailable ?? true,
      },
      update: {},
    });
    // A database seeded before the descriptions gains them — only where none is set, so an
    // admin's own description stays (the seed never rewrites a row otherwise).
    await prisma.product.updateMany({
      where: { id: product.id, descriptionEn: null, descriptionVi: null },
      data: { descriptionEn, descriptionVi },
    });
    if (isNew) {
      await prisma.productSize.createMany({
        data: product.sizes.map((size) => ({
          productId: product.id,
          size,
          priceDeltaVnd: SIZE_DELTA_VND[size],
        })),
        skipDuplicates: true,
      });
      const allowed = ALLOWED_TOPPINGS[product.categoryKey];
      if (allowed.length > 0) {
        await prisma.productTopping.createMany({
          data: allowed.map((key) => ({ productId: product.id, toppingId: TOPPING_IDS[key] })),
          skipDuplicates: true,
        });
      }
    }
  }

  const categoriesCreated = CATEGORIES.filter((c) => !existingCategoryIds.has(c.id)).length;
  const productsCreated = PRODUCTS.filter((p) => !existingProductIds.has(p.id)).length;
  const toppingsCreated = TOPPINGS.filter((t) => !existingToppingIds.has(t.id)).length;

  console.log(`${categoriesCreated} created (categories)`);
  console.log(`${productsCreated} created (products)`);
  console.log(`${toppingsCreated} created (toppings)`);

  if (process.env.REDIS_URL) {
    const redis = new Redis(process.env.REDIS_URL);
    await redis.del('catalog:menu');
    await redis.quit();
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
