'use strict';

const { Spot } = require('../models');
const bcrypt = require("bcryptjs");

let options = {};
if (process.env.NODE_ENV === 'production') {
  options.schema = process.env.SCHEMA;  // define your schema in options object
}

module.exports = {
  async up (queryInterface, Sequelize) {
    await Spot.bulkCreate([
      {
        ownerId: 1,
        address: '123 Main St',
        city: 'Example City',
        state: 'CA',
        country: 'USA',
        lat: '37.7749',
        lng: '-122.4194',
        name: 'Beautiful Spot 1',
        description: 'A lovely spot with a great view.',
        price: 100.00,
        avgRating: 3.0,
        previewImage: "789"
      },
      {
        ownerId: 2,
        address: '456 Oak Ave',
        city: 'Another City',
        state: 'NY',
        country: 'USA',
        lat: '40.7128',
        lng: '-74.0060',
        name: 'Cozy Retreat',
        description: 'Perfect spot for a weekend getaway.',
        price: 150.00,
        avgRating: 4.5,
        previewImage: "1234"
      }
    ], {validate :true})
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
    */
  },

  async down (queryInterface, Sequelize) {
    options.tableName = 'Spots';
    const Op = Sequelize.Op;
    return queryInterface.bulkDelete(options, {
      address: { [Op.in]: ['456 Oak Ave', '123 Main Street'] }
    }, {});
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
  }
};
