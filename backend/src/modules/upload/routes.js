const express = require('express');
const { authenticate } = require('../../middlewares/authenticate');

module.exports = ({ uploadController }) => {
  const router = express.Router();

  router.post('/:type/single', authenticate, uploadController.uploadSingle);
  router.post('/:type/multiple', authenticate, uploadController.uploadMultiple);
  router.delete('/:type/:filename', authenticate, uploadController.deleteFile);

  return router;
};
