// scripts/seedStateCities.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { STATE_CITY_MAPPING } from '../utils/constants.js';

// Import colors from your colorAssigner
import StateCity from '../models/stateCity.model.js';
import { ColorAssigner } from '../utils/colorAssigner.js';

dotenv.config();

const seedStateCities = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing data
        await StateCity.deleteMany({});
        console.log('Cleared existing StateCity data');

        const stateCities = [];

        // Create entries for all state-city combinations
        for (const [state, cities] of Object.entries(STATE_CITY_MAPPING)) {
            for (const city of cities) {

                const displayName = city
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');

                const cityColors = ColorAssigner.getCityColors(city);

                stateCities.push({
                    state,
                    city: city.toLowerCase(),
                    displayName,
                    colorPalette: cityColors,
                    isActive: true
                });
            }
        }


        // Insert all
        await StateCity.insertMany(stateCities);

        // Verify Florida cities
        const floridaCities = await StateCity.find({ state: 'Florida' });
        console.log('\nFlorida cities in database:');
        floridaCities.forEach(city => {
            console.log(`  - ${city.displayName}, ${city.state} (${city.city})`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding error:', error);
        process.exit(1);
    }
};

seedStateCities();