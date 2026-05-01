const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') }); // be/.env

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    logging: console.log,
  }
);

async function runUpdates() {
  try {
    await sequelize.authenticate();
    console.log('--- DATABASE CONNECTED ---');

    console.log('Updating chat_messages table...');

    // Add session_id
    try {
      await sequelize.query('ALTER TABLE chat_messages ADD COLUMN session_id VARCHAR(255);');
      console.log('✅ Added session_id column');
    } catch (e) {
      console.log('ℹ️ session_id column might already exist');
    }

    // Modify user_id to be nullable
    try {
      await sequelize.query('ALTER TABLE chat_messages MODIFY COLUMN user_id CHAR(36) BINARY NULL;');
      console.log('✅ Modified user_id to be nullable');
    } catch (e) {
      console.log('❌ Error modifying user_id column:', e.message);
    }

    console.log('--- UPDATE COMPLETED ---');
    process.exit(0);
  } catch (error) {
    console.error('--- ERROR ---', error.message);
    process.exit(1);
  }
}

runUpdates();
