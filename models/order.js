const pool = require('../config/db');

class Order {
    static async getArtisanOrders(artisanId, queryParams) {
        const { status, startDate, endDate, page = 1, limit = 10 } = queryParams;
        let query = `
            SELECT
                o.id,
                u.username AS buyer_name,
                o.total_amount,
                o.status,
                o.created_at,
                o.shipping_address ->> 'city' AS shipping_city,
                o.shipping_address ->> 'state' AS shipping_state
            FROM orders o
            JOIN users u ON o.customer_id = u.id
            WHERE o.artisan_id = $1
        `;
        const values = [artisanId];
        let paramIndex = 2;

        if (status) {
            query += ` AND o.status = $${paramIndex++}`;
            values.push(status);
        }
        if (startDate) {
            query += ` AND o.created_at >= $${paramIndex++}`;
            values.push(new Date(startDate));
        }
        if (endDate) {
            query += ` AND o.created_at <= $${paramIndex++}`;
            values.push(new Date(endDate));
        }

        query += ` ORDER BY o.created_at DESC`;

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

    static async getOrderDetails(orderId, artisanId) {
        const client = await pool.connect();
        try {
            const orderQuery = `
                SELECT
                    o.*,
                    u.username AS buyer_name,
                    u.email AS buyer_email,
                    u.phone_number AS buyer_phone
                FROM orders o
                JOIN users u ON o.customer_id = u.id
                WHERE o.id = $1 AND o.artisan_id = $2;
            `;
            const orderResult = await client.query(orderQuery, [orderId, artisanId]);
            if (orderResult.rows.length === 0) return null;

            const order = orderResult.rows[0];

            const itemsQuery = `
                SELECT
                    id, product_id, product_name, variant_id, variant_details, quantity, unit_price
                FROM order_items
                WHERE order_id = $1;
            `;
            const itemsResult = await client.query(itemsQuery, [orderId]);
            order.items = itemsResult.rows;

            return order;
        } finally {
            client.release();
        }
    }

    static async updateOrderStatus(orderId, newStatus) {
        const client = await pool.connect();
        try {
            const result = await client.query(
                `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING status`,
                [newStatus, orderId]
            );
            return result.rows[0]?.status;
        } finally {
            client.release();
        }
    }

    static async updateOrderShipping(orderId, trackingNumber, shippingCarrier) {
        const newStatus = 'shipped';
        const client = await pool.connect();
        try {
            const result = await client.query(
                `UPDATE orders
                 SET status = $1, tracking_number = $2, shipping_carrier = $3, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $4
                 RETURNING status`,
                [newStatus, trackingNumber, shippingCarrier, orderId]
            );
            return result.rows[0]?.status;
        } finally {
            client.release();
        }
    }
    
    static async getReturnRequests(artisanId, queryParams) {
        const { status, page = 1, limit = 10 } = queryParams;
        let query = `
            SELECT r.*, oi.product_name, oi.unit_price, u.username AS customer_name
            FROM returns r
            JOIN order_items oi ON r.order_item_id = oi.id
            JOIN users u ON r.customer_id = u.id
            WHERE r.artisan_id = $1
        `;
        const values = [artisanId];
        let paramIndex = 2;

        if (status) {
            query += ` AND r.return_status = $${paramIndex++}`;
            values.push(status);
        }

        query += ` ORDER BY r.created_at DESC`;

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

    static async processReturnRequest(returnId, action, reason, refundAmount) {
        let newStatus;
        if (action === 'accept') {
            newStatus = 'accepted';
            reason = 'accepted by artisan';
        } else if (action === 'reject') {
            newStatus = 'rejected';
        } else {
            throw new Error('Invalid return action.');
        }
        
        const client = await pool.connect();
        try {
            const result = await client.query(
                `UPDATE returns
                 SET return_status = $1, reason = $2, refund_amount = $3, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $4
                 RETURNING return_status`,
                [newStatus, reason, refundAmount, returnId]
            );
            return result.rows[0]?.return_status;
        } finally {
            client.release();
        }
    }
    
    static async orderBelongsToArtisan(artisanId, orderId) {
        const client = await pool.connect();
        try {
            const result = await client.query(
                `SELECT 1 FROM orders WHERE id = $1 AND artisan_id = $2`,
                [orderId, artisanId]
            );
            return result.rows.length > 0;
        } finally {
            client.release();
        }
    }
    
    static async returnBelongsToArtisan(artisanId, returnId) {
        const client = await pool.connect();
        try {
            const result = await client.query(
                `SELECT 1 FROM returns WHERE id = $1 AND artisan_id = $2`,
                [returnId, artisanId]
            );
            return result.rows.length > 0;
        } finally {
            client.release();
        }
    }
}

module.exports = Order;