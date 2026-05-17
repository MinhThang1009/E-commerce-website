/**
 * @file module.js
 * @layer Module
 * @module users
 * @description Entry point users module — khởi tạo dependencies và đăng ký routes
 */
const UsersController = require('./controllers/usersController');
const UsersService = require('./services/usersService');
const SequelizeUsersRepository = require('./repositories/SequelizeUsersRepository');
const buildRoutes = require('./routes');

// Users module — DI wire repo → service → controller → router.
// User + Address model inject từ app.js (legacy models/index.js đến Phase 5).
module.exports = ({ User, Address, eventBus, logger }) => {
  if (!User) throw new Error('users module: User model bắt buộc trong deps');
  if (!Address) throw new Error('users module: Address model bắt buộc trong deps');
  if (!eventBus) throw new Error('users module: eventBus bắt buộc trong deps');
  if (!logger) throw new Error('users module: logger bắt buộc trong deps');

  const usersRepository = new SequelizeUsersRepository({ User, Address });
  const usersService = new UsersService({ usersRepository, eventBus, logger });
  const usersController = new UsersController({ usersService });
  const router = buildRoutes({ usersController });

  return {
    basePath: '/users',
    router,
    subscribeEvents() {
      // Users module hiện không subscribe event nào.
    },
  };
};
