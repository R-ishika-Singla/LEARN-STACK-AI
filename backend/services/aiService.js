const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiKeyRotator {
  constructor() {
    const keysString = process.env.GEMINI_API_KEYS || '';
    this.keys = keysString.split(',').map(k => k.trim()).filter(k => k.length > 0);
    this.currentKeyIndex = 0;
    
    this.models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    this.currentModelIndex = 0;
  }

  async generateSummaryWithRotation(prompt) {
    if (this.keys.length === 0) {
      throw new Error("No Gemini API keys configured in environment.");
    }

    let attempts = 0;
    const maxAttempts = this.keys.length * this.models.length; // Try all keys across all models
    
    while (attempts < maxAttempts) {
      try {
        const currentKey = this.keys[this.currentKeyIndex];
        const currentModel = this.models[this.currentModelIndex];
        
        console.log(`[AI System] Attempting generation using model: ${currentModel} on Key Index: ${this.currentKeyIndex}`);
        
        const genAI = new GoogleGenerativeAI(currentKey);
        const model = genAI.getGenerativeModel({ model: currentModel });
        
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (error) {
        console.error(`[AI Error] Model ${this.models[this.currentModelIndex]} or Key ${this.currentKeyIndex} failed:`, error.message);
        
        if (error.status === 429 || error.status === 503 || error.message.includes('429') || error.message.includes('503') || error.message.includes('quota') || error.message.includes('overloaded')) {
          console.log(`[AI System] High traffic or limit reached. Rotating model and API key...`);
          
          this.currentModelIndex = (this.currentModelIndex + 1) % this.models.length;
          
          if (this.currentModelIndex === 0) {
            this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
          }
          
          attempts++;
        } else {
          throw error;
        }
      }
    }
    
    throw new Error("All configured Gemini API keys and fallback models are currently exhausted or experiencing high traffic.");
  }
}

module.exports = new GeminiKeyRotator();
