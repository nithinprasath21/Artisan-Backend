const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const Order = require('../models/order');

const router = express.Router();

const checkOrderOwnership = async (req, res, next) => {
    const { order_id } = req.params;
    const artisanId = req.user.id;
    try {
        const isOwner = await Order.orderBelongsToArtisan(artisanId, order_id);
        if (isOwner) {
            next();
        } else {
            res.status(403).json({ message: 'Access denied. This order does not belong to you.' });
        }
    } catch (error) {
        console.error('Order ownership check error:', error);
        res.status(500).json({ message: 'Server error during ownership check.' });
    }
};

const checkReturnOwnership = async (req, res, next) => {
    const { return_id } = req.params;
    const artisanId = req.user.id;
    try {
        const isOwner = await Order.returnBelongsToArtisan(artisanId, return_id);
        if (isOwner) {
            next();
        } else {
            res.status(403).json({ message: 'Access denied. This return request does not belong to your products.' });
        }
    } catch (error) {
        console.error('Return ownership check error:', error);
        res.status(500).json({ message: 'Server error during ownership check.' });
    }
};

router.get('/orders', authenticateToken, authorizeRoles(['artisan']), async (req, res) => {
    try {
        const orders = await Order.getArtisanOrders(req.user.id, req.query);
        res.status(200).json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Server error fetching orders.' });
    }
});

router.get('/orders/:order_id', authenticateToken, authorizeRoles(['artisan']), checkOrderOwnership, async (req, res) => {
    try {
        const order = await Order.getOrderDetails(req.params.order_id, req.user.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        res.status(200).json(order);
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).json({ message: 'Server error fetching order details.' });
    }
});

router.put('/orders/:order_id/confirm', authenticateToken, authorizeRoles(['artisan']), checkOrderOwnership, async (req, res) => {
    try {
        const newStatus = await Order.updateOrderStatus(req.params.order_id, 'confirmed');
        res.status(200).json({ message: 'Order confirmed successfully.', order_status: newStatus });
    } catch (error) {
        console.error('Error confirming order:', error);
        res.status(500).json({ message: 'Server error confirming order.' });
    }
});

router.put('/orders/:order_id/ready-for-pickup', authenticateToken, authorizeRoles(['artisan']), checkOrderOwnership, async (req, res) => {
    try {
        const newStatus = await Order.updateOrderStatus(req.params.order_id, 'ready_for_pickup');
        res.status(200).json({ message: 'Order marked as ready for pickup.', order_status: newStatus });
    } catch (error) {
        console.error('Error marking order as ready for pickup:', error);
        res.status(500).json({ message: 'Server error marking order as ready for pickup.' });
    }
});

router.put('/orders/:order_id/ship', authenticateToken, authorizeRoles(['artisan']), checkOrderOwnership, async (req, res) => {
    const { tracking_number, shipping_carrier } = req.body;
    if (!tracking_number || !shipping_carrier) {
        return res.status(400).json({ message: 'Tracking number and shipping carrier are required.' });
    }
    try {
        const newStatus = await Order.updateOrderShipping(req.params.order_id, tracking_number, shipping_carrier);
        res.status(200).json({ message: 'Order marked as shipped.', order_status: newStatus, tracking_number });
    } catch (error) {
        console.error('Error shipping order:', error);
        res.status(500).json({ message: 'Server error shipping order.' });
    }
});

router.get('/orders/:order_id/shipping-label', authenticateToken, authorizeRoles(['artisan']), checkOrderOwnership, async (req, res) => {
    // to generate a label and stream the PDF/Image file back to the client.
    res.status(501).json({ message: 'Shipping label generation is not yet integrated with a fulfillment service.' });
});

router.post('/orders/:order_id/cancel-request', authenticateToken, authorizeRoles(['artisan']), checkOrderOwnership, async (req, res) => {
    const { reason } = req.body;
    if (!reason) {
        return res.status(400).json({ message: 'A reason for cancellation is required.' });
    }
    try {
        const newStatus = await Order.updateOrderStatus(req.params.order_id, 'cancellation_requested');
        res.status(200).json({ message: 'Cancellation requested. Awaiting admin review.', order_status: newStatus });
    } catch (error) {
        console.error('Error requesting cancellation:', error);
        res.status(500).json({ message: 'Server error requesting cancellation.' });
    }
});

router.get('/returns', authenticateToken, authorizeRoles(['artisan']), async (req, res) => {
    try {
        const returns = await Order.getReturnRequests(req.user.id, req.query);
        res.status(200).json(returns);
    } catch (error) {
        console.error('Error fetching return requests:', error);
        res.status(500).json({ message: 'Server error fetching return requests.' });
    }
});

router.put('/returns/:return_id/process', authenticateToken, authorizeRoles(['artisan']), checkReturnOwnership, async (req, res) => {
    const { action, reason, refund_amount } = req.body;
    
    if (!['accept', 'reject'].includes(action)) {
        return res.status(400).json({ message: 'Action must be "accept" or "reject".' });
    }
    if (action === 'reject' && !reason) {
        return res.status(400).json({ message: 'Reason is required when rejecting a return.' });
    }

    try {
        const newStatus = await Order.processReturnRequest(req.params.return_id, action, reason, refund_amount);
        res.status(200).json({ message: `Return request ${action}ed successfully.`, return_status: newStatus });
    } catch (error) {
        console.error('Error processing return request:', error);
        res.status(500).json({ message: 'Server error processing return request.' });
    }
});

module.exports = router;