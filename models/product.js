// models/product.js
const pool = require('../config/db');

class Product {
    static async getProducts(artisanId, queryParams) {
        const { status, category, sortBy, page = 1, limit = 10 } = queryParams;
        let query = `
            SELECT id, name, status, base_price, created_at, updated_at
            FROM products
            WHERE artisan_id = $1 AND deleted_at IS NULL
        `;
        const values = [artisanId];
        let paramIndex = 2;

        if (status) {
            query += ` AND status = $${paramIndex++}`;
            values.push(status);
        }
        if (category) {
            query += ` AND category_id = $${paramIndex++}`;
            values.push(category);
        }

        // Sorting logic
        const sortOptions = ['created_at', 'base_price', 'name'];
        if (sortBy && sortOptions.includes(sortBy)) {
            query += ` ORDER BY ${sortBy}`;
        } else {
            query += ` ORDER BY created_at DESC`;
        }

        // Pagination
        const offset = (page - 1) * limit;
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        values.push(limit, offset);

        const client = await pool.connect();
        try {
            const result = await client.query(query, values);
            return result.rows;
        } finally {
            client.release();
        }
    }

    static async createProduct(artisanId, productData) {
        const { name, description, category_id, price, materials, technique, origin, dimensions, weight, min_order_quantity } = productData;
        const client = await pool.connect();
        try {
            const result = await client.query(
                `INSERT INTO products (artisan_id, name, description, category_id, base_price, materials, technique, origin, dimensions, weight, min_order_quantity)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 RETURNING id, status`,
                [artisanId, name, description, category_id, price, materials, technique, origin, dimensions, weight, min_order_quantity]
            );
            return result.rows[0];
        } finally {
            client.release();
        }
    }

    static async getProductDetails(productId) {
        const client = await pool.connect();
        try {
            const productResult = await client.query(
                `SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL`,
                [productId]
            );
            return productResult.rows[0];
        } finally {
            client.release();
        }
    }
    
    static async productBelongsToArtisan(artisanId, productId) {
        const client = await pool.connect();
        try {
            const result = await client.query(
                `SELECT 1 FROM products WHERE id = $1 AND artisan_id = $2 AND deleted_at IS NULL`,
                [productId, artisanId]
            );
            return result.rows.length > 0;
        } finally {
            client.release();
        }
    }

    static async updateProduct(productId, productData) {
        const { name, description, category_id, price, status, materials, technique, origin, dimensions, weight, min_order_quantity } = productData;
        
        const client = await pool.connect();
        try {
            const updateFields = [];
            const updateValues = [];
            let paramIndex = 1;

            if (name) { updateFields.push(`name = $${paramIndex++}`); updateValues.push(name); }
            if (description) { updateFields.push(`description = $${paramIndex++}`); updateValues.push(description); }
            if (category_id) { updateFields.push(`category_id = $${paramIndex++}`); updateValues.push(category_id); }
            if (price) { updateFields.push(`base_price = $${paramIndex++}`); updateValues.push(price); }
            if (status) { updateFields.push(`status = $${paramIndex++}`); updateValues.push(status); }
            if (materials) { updateFields.push(`materials = $${paramIndex++}`); updateValues.push(materials); }
            if (technique) { updateFields.push(`technique = $${paramIndex++}`); updateValues.push(technique); }
            if (origin) { updateFields.push(`origin = $${paramIndex++}`); updateValues.push(origin); }
            if (dimensions) { updateFields.push(`dimensions = $${paramIndex++}`); updateValues.push(dimensions); }
            if (weight) { updateFields.push(`weight = $${paramIndex++}`); updateValues.push(weight); }
            if (min_order_quantity) { updateFields.push(`min_order_quantity = $${paramIndex++}`); updateValues.push(min_order_quantity); }

            if (updateFields.length === 0) {
                return false;
            }

            const query = `UPDATE products SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING id`;
            await client.query(query, [...updateValues, productId]);
            return true;
        } finally {
            client.release();
        }
    }
    
    static async deleteProduct(productId) {
        const client = await pool.connect();
        try {
            await client.query(
                `UPDATE products SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`,
                [productId]
            );
            return true;
        } finally {
            client.release();
        }
    }

    static async addProductMedia(productId, url, mediaType, isThumbnail) {
        const client = await pool.connect();
        try {
            const result = await client.query(
                `INSERT INTO product_media (product_id, url, media_type, is_thumbnail) VALUES ($1, $2, $3, $4) RETURNING id, url`,
                [productId, url, mediaType, isThumbnail]
            );
            return result.rows[0];
        } finally {
            client.release();
        }
    }
    
    static async deleteProductMedia(mediaId) {
        const client = await pool.connect();
        try {
            await client.query(`DELETE FROM product_media WHERE id = $1`, [mediaId]);
            return true;
        } finally {
            client.release();
        }
    }

    static async getProductVariants(productId) {
        const client = await pool.connect();
        try {
            const result = await client.query(
                `SELECT * FROM product_variants WHERE product_id = $1`,
                [productId]
            );
            return result.rows;
        } finally {
            client.release();
        }
    }
    
    static async addProductVariant(productId, attributes, price_adjustment, inventory) {
        const client = await pool.connect();
        try {
            const result = await client.query(
                `INSERT INTO product_variants (product_id, attributes, price_adjustment, inventory) VALUES ($1, $2, $3, $4) RETURNING id`,
                [productId, attributes, price_adjustment, inventory]
            );
            return result.rows[0].id;
        } finally {
            client.release();
        }
    }

    static async updateProductVariant(variantId, variantData) {
        const { attributes, price_adjustment, inventory } = variantData;

        const client = await pool.connect();
        try {
            const updateFields = [];
            const updateValues = [];
            let paramIndex = 1;

            if (attributes) { updateFields.push(`attributes = $${paramIndex++}`); updateValues.push(attributes); }
            if (price_adjustment) { updateFields.push(`price_adjustment = $${paramIndex++}`); updateValues.push(price_adjustment); }
            if (inventory !== undefined) { updateFields.push(`inventory = $${paramIndex++}`); updateValues.push(inventory); }

            if (updateFields.length === 0) {
                return false;
            }

            const query = `UPDATE product_variants SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING id`;
            await client.query(query, [...updateValues, variantId]);
            return true;
        } finally {
            client.release();
        }
    }
    
    static async deleteProductVariant(variantId) {
        const client = await pool.connect();
        try {
            await client.query(`DELETE FROM product_variants WHERE id = $1`, [variantId]);
            return true;
        } finally {
            client.release();
        }
    }

    static async updateInventory(productId, quantity, type, variantId = null) {
        const client = await pool.connect();
        try {
            const table = variantId ? 'product_variants' : 'products';
            const idField = variantId ? 'id' : 'id';
            const idValue = variantId ? variantId : productId;
            
            let query = '';
            if (type === 'increase') {
                query = `UPDATE ${table} SET inventory = inventory + $1 WHERE ${idField} = $2 RETURNING inventory`;
            } else if (type === 'decrease') {
                query = `UPDATE ${table} SET inventory = GREATEST(inventory - $1, 0) WHERE ${idField} = $2 RETURNING inventory`;
            } else if (type === 'set') {
                query = `UPDATE ${table} SET inventory = $1 WHERE ${idField} = $2 RETURNING inventory`;
            } else {
                throw new Error('Invalid inventory update type.');
            }

            const result = await client.query(query, [quantity, idValue]);
            return result.rows[0].inventory;

        } finally {
            client.release();
        }
    }

    static async getCategories() {
        const client = await pool.connect();
        try {
            const result = await client.query(`SELECT id, name, icon_url FROM categories`);
            return result.rows;
        } finally {
            client.release();
        }
    }
    
    // Note: Pricing guidance is a placeholder. You'd need a more complex model or service for this.
    static async getPricingGuidance(queryParams) {
        // This is a simplified example. A real implementation would query a pricing model.
        const { material_cost, labor_hours, complexity_level, category_id } = queryParams;
        
        // Example logic:
        const basePrice = material_cost * 2; // Double material cost
        const laborPrice = labor_hours * 15; // $15/hour
        
        let min_price = basePrice + laborPrice;
        let max_price = min_price * 1.5;
        
        // This is a placeholder. A real platform would use a more sophisticated model.
        return {
            min_price_suggestion: min_price,
            max_price_suggestion: max_price,
            average_price_on_platform: max_price * 0.8
        };
    }
}

module.exports = Product;