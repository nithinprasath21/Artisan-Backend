const express = require('express');
const multer = require('multer');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const Product = require('../models/product');

const router = express.Router();

const checkProductOwnership = async (req, res, next) => {
    const { product_id } = req.params;
    const artisanId = req.user.id;
    const isOwner = await Product.productBelongsToArtisan(artisanId, product_id);
    if (isOwner) {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. You do not own this product.' });
    }
};

const upload = multer({ dest: 'uploads/products/' }); // Placeholder

router.get('/products', authenticateToken, authorizeRoles(['artisan']), async (req, res) => {
    try {
        const products = await Product.getProducts(req.user.id, req.query);
        res.status(200).json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Server error fetching products.' });
    }
});

router.post('/products', authenticateToken, authorizeRoles(['artisan']), async (req, res) => {
    try {
        const newProduct = await Product.createProduct(req.user.id, req.body);
        res.status(201).json({
            message: 'Product created successfully as a draft.',
            product_id: newProduct.id,
            status: newProduct.status
        });
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ message: 'Server error creating product.' });
    }
});

router.get('/products/:product_id', authenticateToken, authorizeRoles(['artisan']), checkProductOwnership, async (req, res) => {
    try {
        const product = await Product.getProductDetails(req.params.product_id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        res.status(200).json(product);
    } catch (error) {
        console.error('Error fetching product details:', error);
        res.status(500).json({ message: 'Server error fetching product details.' });
    }
});

router.put('/products/:product_id', authenticateToken, authorizeRoles(['artisan']), checkProductOwnership, async (req, res) => {
    try {
        const updated = await Product.updateProduct(req.params.product_id, req.body);
        if (!updated) {
            return res.status(400).json({ message: 'No valid fields provided for update.' });
        }
        res.status(200).json({ message: 'Product updated successfully.' });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ message: 'Server error updating product.' });
    }
});

router.delete('/products/:product_id', authenticateToken, authorizeRoles(['artisan']), checkProductOwnership, async (req, res) => {
    try {
        await Product.deleteProduct(req.params.product_id);
        res.status(200).json({ message: 'Product deleted successfully.' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ message: 'Server error deleting product.' });
    }
});

router.post('/products/:product_id/media', authenticateToken, authorizeRoles(['artisan']), checkProductOwnership, upload.single('mediaFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }
        const mediaUrl = req.file.path;
        const { media_type, is_thumbnail } = req.body;
        const newMedia = await Product.addProductMedia(req.params.product_id, mediaUrl, media_type, is_thumbnail);
        res.status(201).json({ message: 'Media uploaded successfully.', media_id: newMedia.id, url: newMedia.url });
    } catch (error) {
        console.error('Error uploading media:', error);
        res.status(500).json({ message: 'Server error uploading media.' });
    }
});

router.delete('/products/:product_id/media/:media_id', authenticateToken, authorizeRoles(['artisan']), checkProductOwnership, async (req, res) => {
    try {
        await Product.deleteProductMedia(req.params.media_id);
        res.status(200).json({ message: 'Media deleted successfully.' });
    } catch (error) {
        console.error('Error deleting media:', error);
        res.status(500).json({ message: 'Server error deleting media.' });
    }
});

router.get('/products/:product_id/variants', authenticateToken, authorizeRoles(['artisan']), checkProductOwnership, async (req, res) => {
    try {
        const variants = await Product.getProductVariants(req.params.product_id);
        res.status(200).json(variants);
    } catch (error) {
        console.error('Error fetching variants:', error);
        res.status(500).json({ message: 'Server error fetching variants.' });
    }
});

router.post('/products/:product_id/variants', authenticateToken, authorizeRoles(['artisan']), checkProductOwnership, async (req, res) => {
    try {
        const { attributes, price_adjustment, initial_inventory } = req.body;
        const newVariantId = await Product.addProductVariant(req.params.product_id, attributes, price_adjustment, initial_inventory);
        res.status(201).json({ message: 'Variant added successfully.', variant_id: newVariantId });
    } catch (error) {
        console.error('Error adding variant:', error);
        res.status(500).json({ message: 'Server error adding variant.' });
    }
});

router.put('/products/:product_id/variants/:variant_id', authenticateToken, authorizeRoles(['artisan']), checkProductOwnership, async (req, res) => {
    try {
        const updated = await Product.updateProductVariant(req.params.variant_id, req.body);
        if (!updated) {
            return res.status(400).json({ message: 'No valid fields provided for update.' });
        }
        res.status(200).json({ message: 'Variant updated successfully.' });
    } catch (error) {
        console.error('Error updating variant:', error);
        res.status(500).json({ message: 'Server error updating variant.' });
    }
});

router.delete('/products/:product_id/variants/:variant_id', authenticateToken, authorizeRoles(['artisan']), checkProductOwnership, async (req, res) => {
    try {
        await Product.deleteProductVariant(req.params.variant_id);
        res.status(200).json({ message: 'Variant deleted successfully.' });
    } catch (error) {
        console.error('Error deleting variant:', error);
        res.status(500).json({ message: 'Server error deleting variant.' });
    }
});

router.put('/products/:product_id/inventory', authenticateToken, authorizeRoles(['artisan']), checkProductOwnership, async (req, res) => {
    try {
        const { quantity, type } = req.body;
        const newInventory = await Product.updateInventory(req.params.product_id, quantity, type);
        res.status(200).json({ message: 'Inventory updated successfully.', new_inventory_level: newInventory });
    } catch (error) {
        console.error('Error updating inventory:', error);
        res.status(500).json({ message: 'Server error updating inventory.' });
    }
});

router.put('/products/:product_id/variants/:variant_id/inventory', authenticateToken, authorizeRoles(['artisan']), checkProductOwnership, async (req, res) => {
    try {
        const { quantity, type } = req.body;
        const newInventory = await Product.updateInventory(req.params.product_id, quantity, type, req.params.variant_id);
        res.status(200).json({ message: 'Variant inventory updated successfully.', new_inventory_level: newInventory });
    } catch (error) {
        console.error('Error updating variant inventory:', error);
        res.status(500).json({ message: 'Server error updating variant inventory.' });
    }
});

router.get('/categories', authenticateToken, authorizeRoles(['artisan']), async (req, res) => {
    try {
        const categories = await Product.getCategories();
        res.status(200).json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ message: 'Server error fetching categories.' });
    }
});

router.get('/pricing-guidance', authenticateToken, authorizeRoles(['artisan']), async (req, res) => {
    try {
        const guidance = await Product.getPricingGuidance(req.query);
        res.status(200).json(guidance);
    } catch (error) {
        console.error('Error fetching pricing guidance:', error);
        res.status(500).json({ message: 'Server error fetching pricing guidance.' });
    }
});

module.exports = router;