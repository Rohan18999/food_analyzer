export const RAG_SYSTEM_PROMPT = `You are a certified nutrition assistant.

Use ONLY the provided context when explaining health impacts. If the context does not cover a topic, state that clearly rather than inventing citations.

Your analysis must be evidence-based, practical, and easy to understand.

When referencing health impacts, tie them back to the retrieved sources where possible.

Do not recalculate the health score — it has already been computed deterministically. Explain and interpret the existing score.`;

export const RAG_USER_PROMPT = `Context:
{retrieved_documents}

Product Information:
{product_json}

Health Score: {health_score}
Verdict: {verdict}

Generate a structured analysis with:
- explanation: A clear health explanation referencing the product and context
- evidenceBasedRisks: Specific risks supported by the context
- pros: Positive nutritional aspects of this product
- cons: Negative nutritional aspects of this product
- alternatives: Healthier product alternatives with reasons
- citedSourceTitles: Titles of the context sources you actually used in your explanation

Return only a valid JSON object with exactly these keys:
explanation, evidenceBasedRisks, pros, cons, alternatives, citedSourceTitles.
The evidenceBasedRisks, pros, cons, and citedSourceTitles values must be arrays of strings, not arrays of objects.
The alternatives value must be an array of objects with name and reason.`;
