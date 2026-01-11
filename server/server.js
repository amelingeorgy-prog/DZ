const express = require('express');
const cors = require('cors');
const Database = require('./database');

const app = express();
const port = 3000;
const db = new Database();

app.use(cors());
app.use(express.json());

// Переменная для хранения текущей даты (можно менять через API)
let currentDate = new Date().toISOString().split('T')[0];

// Получить текущую дату
app.get('/api/current-date', (req, res) => {
    res.json({ currentDate });
});

// Переключить на следующий день
app.post('/api/next-day', async (req, res) => {
    try {
        const today = currentDate;
        
        // Получаем все заказы на текущий день
        const todaysOrders = await db.getOrdersByDate(today);
        
        // Для каждого заказа списываем товары
        // for (const order of todaysOrders) {
        //     const items = await db.getOrderItems(order.id);
        //     for (const item of items) {
        //         await db.updateProductQuantity(item.product_id, -item.quantity);
        //     }
        // }
        
        // Помечаем заказы как отгруженные
        await db.shipOrders(today);
        
        // Увеличиваем текущую дату на 1 день
        const nextDay = new Date(currentDate);
        nextDay.setDate(nextDay.getDate() + 1);
        currentDate = nextDay.toISOString().split('T')[0];
        
        // Добавляем случайные товары (поставка)
        // const updatedCount = await db.addRandomStock();
        
        res.json({ 
            success: true, 
            message: `Отгружено ${todaysOrders.length} заказов`,
            newDate: currentDate 
        });
    } catch (error) {
        console.error('Ошибка при переходе на следующий день:', error);
        res.status(500).json({ error: error.message });
    }
});

// CRUD для заказов
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await db.getOrders(currentDate);
        // Добавляем позиции к каждому заказу
        const ordersWithItems = await Promise.all(
            orders.map(async (order) => {
                const items = await db.getOrderItems(order.id);
                return { ...order, items };
            })
        );
        res.json(ordersWithItems);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        const { customer_name, order_date } = req.body;
        
        // Проверка даты
        if (new Date(order_date) < new Date(currentDate)) {
            return res.status(400).json({ 
                error: 'Дата заказа не может быть меньше текущей даты' 
            });
        }
        
        const order = {
            id: 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            customer_name,
            order_date
        };
        
        await db.createOrder(order);
        res.status(201).json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/orders/:id', async (req, res) => {
    try {
        const { customer_name, order_date } = req.body;
        
        // Проверка даты
        if (new Date(order_date) < new Date(currentDate)) {
            return res.status(400).json({ 
                error: 'Дата заказа не может быть меньше текущей даты' 
            });
        }
        
        await db.updateOrder(req.params.id, { customer_name, order_date });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/orders/:id', async (req, res) => {
    try {
        // Перед удалением заказа возвращаем товары на склад
        const items = await db.getOrderItems(req.params.id);
        for (const item of items) {
            await db.updateProductQuantity(item.product_id, item.quantity);
        }
        
        await db.deleteOrder(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CRUD для позиций заказа
app.post('/api/orders/:orderId/items', async (req, res) => {
    try {
        const { product_id, quantity } = req.body;
        
        // Проверка наличия товара
        const product = await db.getProductById(product_id);
        if (!product) {
            return res.status(404).json({ error: 'Товар не найден' });
        }
        
        if (product.quantity < quantity) {
            return res.status(400).json({ 
                error: `Недостаточно товара на складе. Доступно: ${product.quantity}` 
            });
        }
        
        const item = {
            id: 'ITEM-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            order_id: req.params.orderId,
            product_id,
            quantity
        };
        
        await db.createOrderItem(item);
        // Списываем товар со склада
        await db.updateProductQuantity(product_id, -quantity);
        
        res.status(201).json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/orders/:orderId/items/:itemId', async (req, res) => {
    try {
        const { quantity } = req.body;
        
        // Получаем текущую позицию
        const currentItem = await db.getOrderItemWithProduct(req.params.itemId);
        if (!currentItem) {
            return res.status(404).json({ error: 'Позиция не найдена' });
        }
        
        // Проверяем изменение количества
        const quantityChange = quantity - currentItem.quantity;
        if (quantityChange > 0) {
            // Нужно больше товара
            if (currentItem.available_quantity < quantityChange) {
                return res.status(400).json({ 
                    error: `Недостаточно товара на складе. Доступно: ${currentItem.available_quantity}` 
                });
            }
            // Списываем дополнительное количество
            await db.updateProductQuantity(currentItem.product_id, -quantityChange);
        } else if (quantityChange < 0) {
            // Возвращаем излишки на склад
            await db.updateProductQuantity(currentItem.product_id, -quantityChange);
        }
        
        await db.updateOrderItem(req.params.itemId, quantity);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/orders/:orderId/items/:itemId', async (req, res) => {
    try {
        // Получаем позицию для возврата товара
        const item = await db.getOrderItemWithProduct(req.params.itemId);
        if (item) {
            // Возвращаем товар на склад
            await db.updateProductQuantity(item.product_id, item.quantity);
        }
        
        await db.deleteOrderItem(req.params.itemId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Перемещение позиции между заказами
app.post('/api/items/:itemId/move', async (req, res) => {
    try {
        const { new_order_id } = req.body;
        
        await db.moveOrderItem(req.params.itemId, new_order_id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Получить список товаров
app.get('/api/products', async (req, res) => {
    try {
        const products = await db.getProducts();
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
    console.log(`Текущая дата: ${currentDate}`);
    
    // Очистка устаревших заказов при старте
    db.cleanupExpiredOrders()
        .then(count => {
            if (count > 0) {
                console.log(`Удалено ${count} устаревших заказов`);
            }
        });
});