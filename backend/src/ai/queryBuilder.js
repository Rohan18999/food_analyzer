/**
 * Build a semantic search query from extracted product data.
 */
export function buildSearchQuery(product) {
  const parts = [];

  if (product.productName) {
    parts.push(`Product: ${product.productName}`);
  }

  if (product.ingredients?.length) {
    parts.push(`Ingredients: ${product.ingredients.join(', ')}`);
  }

  const nf = product.nutritionFacts || {};

  if (nf.sodium?.amount != null) {
    parts.push(`Sodium: ${nf.sodium.amount}mg per serving`);
  }
  if (nf.addedSugars?.amount != null) {
    parts.push(`Added sugars: ${nf.addedSugars.amount}g`);
  } else if (nf.totalSugars?.amount != null) {
    parts.push(`Total sugars: ${nf.totalSugars.amount}g`);
  }
  if (nf.saturatedFat?.amount != null) {
    parts.push(`Saturated fat: ${nf.saturatedFat.amount}g`);
  }
  if (nf.dietaryFiber?.amount != null) {
    parts.push(`Dietary fiber: ${nf.dietaryFiber.amount}g`);
  }
  if (nf.protein?.amount != null) {
    parts.push(`Protein: ${nf.protein.amount}g`);
  }

  return parts.join('. ');
}

/**
 * Format retrieved documents for the LLM prompt context block.
 */
export function formatRetrievedContext(documents) {
  if (!documents.length) {
    return 'No specific reference documents were retrieved. Base your analysis on general nutrition principles.';
  }

  return documents
    .map((doc, index) => {
      return `[Source ${index + 1}] Title: ${doc.title}
Category: ${doc.category}
Content: ${doc.content}`;
    })
    .join('\n\n');
}
