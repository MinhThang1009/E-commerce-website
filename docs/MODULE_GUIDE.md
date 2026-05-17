# Hướng dẫn tạo Module mới

## Module template (DDD-lite)

### 1. Tạo cấu trúc thư mục

```bash
mkdir -p backend/src/modules/<name>/{controllers,services,repositories,domain/{aggregates,events,policies,ports},dtos,validators}
```

### 2. `module.js` — Factory function

```js
'use strict';
const Controller = require('./controllers/<name>Controller');
const Service    = require('./services/<name>Service');
const Repository = require('./repositories/Sequelize<Name>Repository');
const buildRoutes = require('./routes');

module.exports = ({ ModelA, ModelB, eventBus, logger }) => {
  if (!ModelA) throw new Error('<name> module: ModelA bắt buộc');

  const repository = new Repository({ ModelA, ModelB });
  const service    = new Service({ repository, eventBus, logger });
  const controller = new Controller({ service, logger });
  const router     = buildRoutes({ controller });

  return {
    basePath: '/<name>s',   // URL prefix
    router,
    subscribeEvents() {
      // eventBus.subscribe('some.event', handler);
    },
  };
};
```

### 3. `routes.js`

```js
'use strict';
const express = require('express');
const { authenticate } = require('../../shared/http/middlewares/authenticate');
const { authorize }    = require('../../shared/http/middlewares/authorize');
const { validateRequest } = require('../../shared/http/middlewares/validateRequest');
const { createSchema, updateSchema } = require('./validators/<name>Validator');

module.exports = ({ controller }) => {
  const router = express.Router();

  router.get('/',    controller.getAll);
  router.get('/:id', controller.getById);
  router.post('/',   authenticate, authorize('admin'), validateRequest(createSchema), controller.create);
  router.put('/:id', authenticate, authorize('admin'), validateRequest(updateSchema), controller.update);
  router.delete('/:id', authenticate, authorize('admin'), controller.delete);

  return router;
};
```

### 4. Service pattern

```js
class <Name>Service {
  constructor({ repository, eventBus, logger }) {
    this.repo     = repository;
    this.eventBus = eventBus;
    this.logger   = logger;
  }

  async getAll(filters) { return this.repo.findAll(filters); }
  async getById(id)      { return this.repo.findById(id); }
  async create(data)     { return this.repo.create(data); }
  async update(id, data) { return this.repo.update(id, data); }
  async delete(id)       { return this.repo.delete(id); }
}
module.exports = <Name>Service;
```

### 5. Mount trong `app.js`

```js
const build<Name>Module = require('./modules/<name>/module');
// ...
const <name>Module = build<Name>Module({ ModelA, ModelB, eventBus, logger });
<name>Module.subscribeEvents();
// ...
app.use('/api' + <name>Module.basePath, <name>Module.router);
```

---

## Wrapper module (migration step)

Dùng khi migrating flat controller → module (chưa DDD full):

```js
// modules/<name>/module.js
module.exports = () => ({
  basePath: '/<names>',
  router: require('../../routes/<name>'),
  subscribeEvents() {},
});
```

---

## Conventions

| Pattern | Convention |
|---------|-----------|
| Module factory | `build<Name>Module({ deps })` |
| basePath | kebab-case plural: `/discount-codes`, `/warranty-packages` |
| Controller methods | `getAll`, `getById`, `create`, `update`, `delete` |
| Repository interface | `IRepository.js` + `Sequelize<Name>Repository.js` |
| Domain events | `<Domain><Action>Event.js` (e.g., `StockRestockedEvent.js`) |
| Error handling | Throw `AppError` trong service, catch trong controller → `next(err)` |
| Response format | `{ status: 'success', data: ... }` / `{ status: 'error', message: ... }` |

---

## Hiện trạng modules

| Module | Loại | Basepath |
|--------|------|---------|
| auth | Full DDD-lite | /auth |
| users | Full DDD-lite | /users |
| cart | Full DDD-lite | /cart |
| catalog | Full DDD-lite | /brands, /categories, /collections, /products |
| content | Full DDD-lite | /banners, /news, /newsletter, /contact |
| orders | Full DDD-lite | /orders |
| payment | Full DDD-lite | /payments |
| reviews | Full DDD-lite | /reviews |
| inventory | Full DDD-lite | /inventory |
| loyalty | Full DDD-lite | /loyalty |
| upload | Full DDD-lite | /uploads |
| wishlist | Full DDD-lite | /wishlist |
| ai | Full DDD-lite | /chatbot |
| admin | Wrapper | /admin |
| searchHistory | Wrapper | /search-histories |
| image | Wrapper | /images |
| discountCode | Wrapper | /discount-codes |
| warrantyPackage | Wrapper | /warranty-packages |
| location | Wrapper | /locations |
| attribute | Wrapper | /attributes |

**Wrapper modules** — delegate đến flat controllers/routes. Sẽ nâng cấp lên Full DDD-lite theo thứ tự ưu tiên.
