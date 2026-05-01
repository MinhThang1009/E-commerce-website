const express = require('express');
const router = express.Router();
const collectionController = require('../controllers/collection.controller');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');

// Public routes
router.get('/', collectionController.getAllCollections);
router.get('/slug/:slug', collectionController.getCollectionBySlug);
router.get('/slug/:slug/products', collectionController.getProductsByCollection);

// Admin routes
router.post('/', authenticate, authorize('admin'), collectionController.createCollection);
router.put('/:id', authenticate, authorize('admin'), collectionController.updateCollection);
router.delete('/:id', authenticate, authorize('admin'), collectionController.deleteCollection);

module.exports = router;
