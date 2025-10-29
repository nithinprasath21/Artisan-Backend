const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');

const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));

const authRoutes = require('./routes/auth');
const artisanRoutes = require('./routes/artisan');
const productRoutes = require('./routes/product');
const orderRoutes = require('./routes/order');
const pool = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/artisan', artisanRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

app.get('/', (req, res) => {
    res.send('Artisan E-commerce Backend API is running!');
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});