/** Unique stock photos per demo SKU (Unsplash only — must match next.config remotePatterns). */

const U = (photoId: string) =>
  `https://images.unsplash.com/${photoId}?w=800&h=800&fit=crop&auto=format`;

/**
 * One distinct Unsplash photo per sample SKU id.
 * Prefer BY_ID over title keywords so similar products don't share images.
 * All photo IDs below are verified HTTP 200 on images.unsplash.com.
 */
const BY_ID: Record<string, string> = {
  // Island Linen Co
  "linen-camp-shirt-sand": U("photo-1596755094514-f87e34085b2c"),
  "linen-camp-shirt-white": U("photo-1602810318383-e386cc2a3ccf"),
  "breezy-tank-ivory": U("photo-1503342217505-b0a15ec3261c"),
  "breezy-tank-sage": U("photo-1489987707025-afc232f7ea0f"),
  "resort-midi-dress": U("photo-1595777457583-95e059d581b8"),
  "wrap-sundress-sky": U("photo-1572804013427-4d7ca7268217"),
  "tailored-short-khaki": U("photo-1591195853828-11db59a44f6b"),
  "tailored-short-navy": U("photo-1473966968600-fa801b869a1a"),
  "wide-linen-pant": U("photo-1594633312681-425c7b97ccd1"),
  "crop-tee-palm": U("photo-1576566588028-4147f3842f27"),
  "poplin-shirt-dress": U("photo-1496747611176-843222e1e57c"),
  "rib-henley-sand": U("photo-1620799140408-edc6dcb6d633"),

  // Tropic Step
  "knit-ballet-flat-black": U("photo-1543163521-1bf539c55dd2"),
  "knit-ballet-flat-nude": U("photo-1518049362265-d5b2a6467637"),
  "pointed-flat-ivory": U("photo-1549298916-b41d501d3772"),
  "slingback-flat-tan": U("photo-1460353581641-37baddab0fa2"),
  "mary-jane-flat-black": U("photo-1560769629-975ec94e6a86"),
  "strappy-sandal-gold": U("photo-1603487742131-4160ec999306"),
  "slide-sandal-white": U("photo-1600185365483-26d7a4cc7519"),
  "mesh-sneaker-sky": U("photo-1595950653106-6c9ebd614d3a"),
  "canvas-espadrille": U("photo-1515347619252-60a4bf4fff4f"),
  "wide-knit-flat": U("photo-1551107696-a4b0c5a0d9a2"),

  // Linjer Light
  "slim-chain-necklace": U("photo-1599643478518-a784e5dc4c8f"),
  "pearl-drop-earrings": U("photo-1535632066927-ab7c9ab60908"),
  "hoop-earrings-small": U("photo-1611591437281-460bfbe1220a"),
  "stack-ring-set": U("photo-1605100804763-247f67b3557e"),
  "cuff-bracelet": U("photo-1573408301185-9146fe634ad0"),
  "tennis-bracelet": U("photo-1515562141207-7a88fb7ce338"),
  "pendant-necklace": U("photo-1611652022419-a9419f74343d"),
  "stud-earrings-crystal": U("photo-1630019852942-f89202989a59"),
  "anklet-chain": U("photo-1602173574767-37ac01994b2a"),
  "ear-cuff-set": U("photo-1601121141461-9d6647bca1ed"),

  // Canopy Wear
  "treeblend-tee-forest": U("photo-1521572163474-6864f9cf17ab"),
  "treeblend-tee-ocean": U("photo-1583743814966-8936f5b7be1a"),
  "oversized-shirt-white": U("photo-1603252109303-2751441dd157"),
  "jogger-short-olive": U("photo-1552902865-b72c031ac5ea"),
  "packable-hat-khaki": U("photo-1521369909029-2afed882baee"),
  "bucket-hat-sage": U("photo-1588850561407-ed78c282e89b"),
  "canvas-daypack": U("photo-1553062407-98eeb64c6a62"),
  "crossbody-mini": U("photo-1548036328-c9fa89d128fa"),
  "aviator-shades": U("photo-1511499767150-a48a237f0083"),
  "silk-scarf-tropic": U("photo-1606760227091-3dd870d97f1d"),
  "linen-shorts-ivory": U("photo-1624378439575-d8705ad7ae80"),
  "rash-guard-navy": U("photo-1560243563-062bfc001d68"),
  "beach-tote-stripe": U("photo-1544816155-12df9643f363"),

  // Hackathon
  shirt: U("photo-1562157873-818bc0726f68"),
  "borneo-cap": U("photo-1556306535-0f09a537f0a3"),
  "poison-tee": U("photo-1618354691373-d851c5c3a990"),
  "summer-lanyard": U("photo-1586953208448-b95a79798f07"),
  "sticker-pack": U("photo-1611532736597-de2d4265fba3"),

  // Legacy sample ids
  "oxford-shirt": U("photo-1598033129183-c4f50c736f10"),
  "selvedge-jeans": U("photo-1541099649105-f69ad21f3246"),
  "merino-crew": U("photo-1578587018452-892bacefd3f2"),
  "wool-coat": U("photo-1539533018447-63fcce2678e3"),
  "leather-belt": U("photo-1479064555552-3ef4979f8908"),
  "air-runner": U("photo-1606107557195-0e29a4b5b4aa"),
  "trail-hiker": U("photo-1520639888713-7851133b1ed0"),
  "court-classic": U("photo-1491553895911-0055eca6402d"),
  "crew-socks": U("photo-1586350977771-b3b0abd50c82"),
  "shoe-cleaner": U("photo-1601925260368-ae2f83cf8b7f"),
  "canvas-tote": U("photo-1584917865442-de89df76afd3"),
  "crossbody-bag": U("photo-1483985988355-763728e1935b"),
  "silk-scarf": U("photo-1558171813-4c088753af8f"),
  "beaded-bracelet": U("photo-1602751584552-8ba73aad10e1"),
};

/** Fallback pool for unknown SKUs — hashed by id/title so collisions are rare. */
const FALLBACKS = [
  U("photo-1441986300917-64674bd600d8"),
  U("photo-1469334031218-e382a71b716b"),
  U("photo-1490481651871-ab68de25d43d"),
  U("photo-1558769132-cb1aea458c5e"),
  U("photo-1445205170230-053b83016050"),
  U("photo-1467043237213-65f2da53396f"),
  U("photo-1556905055-8f358a7a47b2"),
  U("photo-1492707892479-7bc8d5a4ee93"),
  U("photo-1487222477894-8943e31ef7b2"),
  U("photo-1515886657613-9f3515b0c78f"),
  U("photo-1509631179647-0177331693ae"),
  U("photo-1487412720507-e7ab37603c6f"),
  U("photo-1515372039744-b8f02a3ae446"),
  U("photo-1556821840-3a63f95609a7"),
  U("photo-1475180098004-ca77a66827be"),
  U("photo-1551028719-00167b16eac5"),
  U("photo-1617137968427-85924c800a22"),
  U("photo-1594938298603-c8148c4dae35"),
  U("photo-1552374196-1ab2a1c593e8"),
  U("photo-1617127365659-c47fa864d8bc"),
];

function hashSeed(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function imageForProduct(
  title: string,
  _description?: string,
  id?: string,
): string {
  if (id && BY_ID[id]) return BY_ID[id];
  const seed = id || title || "borneo";
  return FALLBACKS[hashSeed(seed) % FALLBACKS.length]!;
}
