// @ts-check

/**
 * Cart Transform Function — Designer Pricing
 *
 * For "Silver Designer" customers, sets the cart line item price
 * to the variant's designer_price metafield value.
 */

/**
 * @typedef {import("../generated/api").CartTransformRunInput} CartTransformRunInput
 * @typedef {import("../generated/api").CartTransformRunResult} CartTransformRunResult
 */

const DESIGNER_LEVELS = ["Silver Designer", "Silver Designer2"];

/** @type {CartTransformRunResult} */
const NO_CHANGES = {
  operations: [],
};

/**
 * @param {CartTransformRunInput} input
 * @returns {CartTransformRunResult}
 */
export function cartTransformRun(input) {
  const customerLevel =
    input.cart.buyerIdentity?.customer?.customerLevel?.value;

  // Not a designer — no price changes
  if (!customerLevel || !DESIGNER_LEVELS.includes(customerLevel)) {
    return NO_CHANGES;
  }

  const operations = [];

  for (const line of input.cart.lines) {
    const merchandise = line.merchandise;

    if (merchandise.__typename !== "ProductVariant") {
      continue;
    }

    const enabled = merchandise.designerEnabled?.value;
    const designerPriceRaw = merchandise.designerPrice?.value;

    // Skip variants without designer pricing enabled
    if (enabled !== "true" || !designerPriceRaw) {
      continue;
    }

    // Money metafield value is JSON: {"amount":"143.99","currency_code":"USD"}
    let designerPriceData;
    try {
      designerPriceData = JSON.parse(designerPriceRaw);
    } catch {
      continue;
    }

    const designerAmount = designerPriceData.amount;
    if (!designerAmount) {
      continue;
    }

    // Only apply if designer price is less than current price
    const currentAmount = parseFloat(line.cost.amountPerQuantity.amount);
    if (parseFloat(designerAmount) >= currentAmount) {
      continue;
    }

    operations.push({
      lineUpdate: {
        cartLineId: line.id,
        price: {
          adjustment: {
            fixedPricePerUnit: {
              amount: designerAmount,
            },
          },
        },
      },
    });
  }

  return { operations };
}
