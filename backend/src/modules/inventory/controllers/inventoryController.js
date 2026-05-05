class InventoryController {
  constructor({ inventoryService }) {
    this.inventoryService = inventoryService;
  }

  restockProduct = async (req, res, next) => {
    try {
      const data = await this.inventoryService.restockProduct({
        productId: req.params.productId,
        variantId: req.body.variantId,
        quantity: req.body.quantity,
        note: req.body.note,
        adminId: req.user.id,
      });
      res.status(200).json({ data });
    } catch (err) { next(err); }
  };

  getInventoryLogs = async (req, res, next) => {
    try {
      const result = await this.inventoryService.getInventoryLogs(req.query);
      res.status(200).json({ status: 'success', ...result });
    } catch (err) { next(err); }
  };
}

module.exports = InventoryController;
