const embeddingService = require('./embedding.service');
const path = require('path');
const fs = require('fs');

class SimpleVectorStore {
  constructor() {
    this.storagePath = path.join(__dirname, '../../data/vector_db.json');
    this.items = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const content = fs.readFileSync(this.storagePath, 'utf8');
        if (content && content.trim()) {
           this.items = JSON.parse(content);
           console.log(`✅ Loaded ${this.items.length} vectors from disk`);
        }
      }
    } catch (e) {
      console.error('Error loading vector db:', e);
      this.items = [];
    }
  }

  save() {
    try {
      const dataDir = path.dirname(this.storagePath);
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      
      console.log(`💾 Saving ${this.items.length} items to ${this.storagePath}...`);
      fs.writeFileSync(this.storagePath, JSON.stringify(this.items, null, 2));
      console.log('✅ File saved successfully');
    } catch (e) {
      console.error('❌ Error saving vector store:', e);
    }
  }

  clear() {
    this.items = [];
    console.log('🗑️ Vector store cleared');
  }

  async addProduct(product) {
    try {
      const textToEmbed = `${product.name}. ${product.shortDescription || ''}`.substring(0, 500);
      const vector = await embeddingService.generateEmbedding(textToEmbed);
      
      if (!vector || !Array.isArray(vector)) {
          throw new Error('Invalid vector generated');
      }

      // Remove existing entry for this product if any
      this.items = this.items.filter(item => item.metadata.id !== product.id);
      
      this.items.push({
        vector,
        text: textToEmbed,
        metadata: {
          id: product.id,
          name: product.name,
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          thumbnail: product.thumbnail,
          inStock: product.inStock,
          stockQuantity: product.stockQuantity,
          category: product.categories?.[0]?.name || 'Sản phẩm',
          baseName: product.baseName
        }
      });
    } catch (error) {
      console.error(`Error adding product ${product.id} to vector store:`, error.message);
      throw error;
    }
  }

  /**
   * Cosine similarity calculation
   */
  cosineSimilarity(v1, v2) {
    if (!v1 || !v2 || v1.length !== v2.length) return 0;
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    for (let i = 0; i < v1.length; i++) {
        dotProduct += v1[i] * v2[i];
        mag1 += v1[i] * v1[i];
        mag2 += v2[i] * v2[i];
    }
    const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  async search(query, limit = 5) {
    try {
      const queryVector = await embeddingService.generateEmbedding(query);
      
      const scores = this.items.map(item => ({
        ...item,
        score: this.cosineSimilarity(queryVector, item.vector)
      }));
      
      return scores
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      console.error('Vector search error:', error.message);
      return [];
    }
  }
}

module.exports = new SimpleVectorStore();
