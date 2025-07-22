const axios = require('axios');
const { config } = require('../config');

class QdrantService {
  constructor() {
    this.baseUrl = config.qdrant.url;
    this.apiKey = config.qdrant.apiKey;
    this.collection = config.qdrant.collection;
    this.vectorSize = config.qdrant.vectorSize;
    this.enabled = config.qdrant.enabled;
  }

  // Get headers for API requests
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (this.apiKey) {
      headers['api-key'] = this.apiKey;
    }
    
    return headers;
  }

  // Check if Qdrant is available
  async isAvailable() {
    if (!this.enabled) {
      return false;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/`, {
        headers: this.getHeaders(),
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      console.error('Qdrant availability check failed:', error.message);
      return false;
    }
  }

  // Create collection if it doesn't exist
  async ensureCollection() {
    if (!this.enabled) {
      return;
    }

    try {
      // Check if collection exists
      const checkResponse = await axios.get(
        `${this.baseUrl}/collections/${this.collection}`,
        { headers: this.getHeaders() }
      );

      if (checkResponse.status === 200) {
        console.log(`Qdrant collection '${this.collection}' already exists`);
        return;
      }
    } catch (error) {
      // Collection doesn't exist, create it
      console.log(`Creating Qdrant collection '${this.collection}'`);
    }

    try {
      // Create collection
      await axios.put(
        `${this.baseUrl}/collections/${this.collection}`,
        {
          vectors: {
            size: this.vectorSize,
            distance: 'Cosine'
          }
        },
        { headers: this.getHeaders() }
      );
      
      console.log(`Qdrant collection '${this.collection}' created successfully`);
    } catch (error) {
      console.error('Failed to create Qdrant collection:', error.message);
      throw error;
    }
  }

  // Store document with vector
  async storeDocument(documentId, vector, payload) {
    if (!this.enabled) {
      throw new Error('Qdrant is not enabled');
    }

    try {
      const response = await axios.put(
        `${this.baseUrl}/collections/${this.collection}/points`,
        {
          points: [
            {
              id: documentId,
              vector: vector,
              payload: payload
            }
          ]
        },
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to store document in Qdrant:', error.message);
      throw error;
    }
  }

  // Search for similar documents
  async searchSimilar(vector, limit = 5, threshold = 0.7) {
    if (!this.enabled) {
      throw new Error('Qdrant is not enabled');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/collections/${this.collection}/points/search`,
        {
          vector: vector,
          limit: limit,
          with_payload: true,
          score_threshold: threshold
        },
        { headers: this.getHeaders() }
      );

      return response.data.result || [];
    } catch (error) {
      console.error('Qdrant search failed:', error.message);
      throw error;
    }
  }

  // Get document by ID
  async getDocument(documentId) {
    if (!this.enabled) {
      throw new Error('Qdrant is not enabled');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/collections/${this.collection}/points/${documentId}`,
        { headers: this.getHeaders() }
      );

      return response.data.result;
    } catch (error) {
      console.error('Failed to get document from Qdrant:', error.message);
      throw error;
    }
  }

  // Delete document
  async deleteDocument(documentId) {
    if (!this.enabled) {
      throw new Error('Qdrant is not enabled');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/collections/${this.collection}/points/delete`,
        {
          points: [documentId]
        },
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to delete document from Qdrant:', error.message);
      throw error;
    }
  }

  // Update document payload
  async updateDocument(documentId, payload) {
    if (!this.enabled) {
      throw new Error('Qdrant is not enabled');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/collections/${this.collection}/points/payload`,
        {
          points: [documentId],
          payload: payload
        },
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to update document in Qdrant:', error.message);
      throw error;
    }
  }

  // Get collection statistics
  async getCollectionStats() {
    if (!this.enabled) {
      throw new Error('Qdrant is not enabled');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/collections/${this.collection}`,
        { headers: this.getHeaders() }
      );

      return response.data.result;
    } catch (error) {
      console.error('Failed to get collection stats from Qdrant:', error.message);
      throw error;
    }
  }
}

module.exports = QdrantService; 