/**
 * @file routes.js
 * @layer Route
 * @module warrantyPackage
 * @description HTTP endpoints của warrantyPackage
 */
const express = require('express');
const router = express.Router();
const ctrl = require('@modules/warranty-package/controllers/warranty-package-controller');
const { authenticate } = require('@middlewares/authenticate');
const { adminAuthenticate } = require('@middlewares/admin-auth');
const { validateRequest } = require('@middlewares/validate-request');
const { createSchema, updateSchema } = require('@modules/warranty-package/validators/warranty-package-validator');

router.get('/', ctrl.getAllWarrantyPackages);
router.get('/product/:productId', ctrl.getWarrantyPackagesByProduct);
router.get('/:id', ctrl.getWarrantyPackageById);

router.post('/', adminAuthenticate, validateRequest(createSchema), ctrl.createWarrantyPackage);
router.put('/:id', adminAuthenticate, validateRequest(updateSchema), ctrl.updateWarrantyPackage);
router.delete('/:id', adminAuthenticate, ctrl.deleteWarrantyPackage);

module.exports = router;
