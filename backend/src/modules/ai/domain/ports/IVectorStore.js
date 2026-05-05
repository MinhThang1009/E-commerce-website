// IVectorStore — port abstract cho vector search (currently in-memory JSON file).
// Plan Sprint 11 RAG Pipeline dùng vector retrieve trước khi LLM augment.
class IVectorStore {
  async search(_queryEmbedding, _topK) { throw new Error('not implemented'); }
  async loadPromise() { throw new Error('not implemented'); }
}

module.exports = IVectorStore;
