// IVectorStore — port abstract cho vector search (currently in-memory JSON file).
class IVectorStore {
  async hybridSearch(_query, _limit, _minScore) { throw new Error('not implemented'); }
  async upsertProduct(_product) { throw new Error('not implemented'); }
}

module.exports = IVectorStore;
