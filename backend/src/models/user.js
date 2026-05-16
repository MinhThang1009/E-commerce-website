const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const argon2 = require('argon2');
const sequelize = require('../config/sequelize');

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [6, 100],
      },
    },
    googleId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    avatar: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM('customer', 'admin', 'manager'),
      defaultValue: 'customer',
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    otpCode: {
      type: DataTypes.STRING(6),
      allowNull: true,
    },
    otpExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    resetPasswordToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    resetPasswordExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    loyaltyPoints: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    tableName: 'users',
    timestamps: true,
    paranoid: true,
    underscored: true,
    indexes: [
      { name: 'idx_users_role', fields: ['role'] },
    ],
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          user.password = await argon2.hash(user.password, { type: argon2.argon2id });
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          user.password = await argon2.hash(user.password, { type: argon2.argon2id });
        }
      },
    },
  }
);

// Backward-compatible: verify cả argon2 (mới) và bcrypt (legacy)
User.prototype.comparePassword = async function (candidatePassword) {
  if (this.password.startsWith('$argon2')) {
    return argon2.verify(this.password, candidatePassword);
  }
  return bcrypt.compare(candidatePassword, this.password);
};

User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password;
  delete values.otpCode;
  delete values.otpExpires;
  delete values.resetPasswordToken;
  delete values.resetPasswordExpires;
  return values;
};

module.exports = User;
