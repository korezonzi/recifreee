import type {
  ReceiptOCRResult,
  CategoryLearningData,
  CategoryMapping,
} from "./types";

export function applyCategoryLearning(
  ocr: ReceiptOCRResult,
  learningData: CategoryLearningData,
): ReceiptOCRResult {
  if (!ocr.vendor) return ocr;

  const vendorNormalized = ocr.vendor.trim().toLowerCase();
  const match = learningData.mappings.find(
    (m) => m.vendor.toLowerCase() === vendorNormalized && m.count >= 2,
  );

  if (match) {
    return {
      ...ocr,
      category: match.category,
      confidence: { ...ocr.confidence, category: "high" },
    };
  }

  return ocr;
}

export function recordCategoryChoice(
  learningData: CategoryLearningData,
  vendor: string,
  category: string,
): CategoryLearningData {
  const vendorNormalized = vendor.trim();
  if (!vendorNormalized || !category) return learningData;

  const mappings = [...learningData.mappings];
  const existingIdx = mappings.findIndex(
    (m) =>
      m.vendor.toLowerCase() === vendorNormalized.toLowerCase() &&
      m.category === category,
  );

  if (existingIdx >= 0) {
    mappings[existingIdx] = {
      ...mappings[existingIdx],
      count: mappings[existingIdx].count + 1,
      lastUsed: new Date().toISOString(),
    };
  } else {
    // Check if there's an existing mapping for this vendor with a different category
    const sameVendorIdx = mappings.findIndex(
      (m) => m.vendor.toLowerCase() === vendorNormalized.toLowerCase(),
    );
    if (sameVendorIdx >= 0) {
      // Replace existing mapping with new category
      mappings[sameVendorIdx] = {
        vendor: vendorNormalized,
        category,
        count: 1,
        lastUsed: new Date().toISOString(),
      };
    } else {
      mappings.push({
        vendor: vendorNormalized,
        category,
        count: 1,
        lastUsed: new Date().toISOString(),
      });
    }
  }

  return { mappings, version: learningData.version + 1 };
}

export const EMPTY_LEARNING_DATA: CategoryLearningData = {
  mappings: [],
  version: 0,
};
