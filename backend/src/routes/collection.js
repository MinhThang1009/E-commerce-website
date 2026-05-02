const express = require('express');
const router = express.Router();
const collectionController = require('../controllers/collection');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');

// Route công khai
router.get('/', collectionController.getAllCollections);
router.get('/slug/:slug', collectionController.getCollectionBySlug);
router.get('/slug/:slug/products', collectionController.getProductsByCollection);

// Route của admin
router.post('/', authenticate, authorize('admin'), collectionController.createCollection);
router.put('/:id', authenticate, authorize('admin'), collectionController.updateCollection);
router.delete('/:id', authenticate, authorize('admin'), collectionController.deleteCollection);

module.exports = router;
