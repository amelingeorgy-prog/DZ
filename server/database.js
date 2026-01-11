const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = new sqlite3.Database(path.join(__dirname, 'warehouse.db'), (err) => {
            if (err) {
                console.error('Ошибка подключения к базе данных:', err);
            } else {
                console.log('Подключено к SQLite базе данных');
            }
        });
        this.initTables();
    }

    initTables() {
        // Таблица товаров
        this.db.run(`
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Таблица заказов
        this.db.run(`
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                customer_name TEXT NOT NULL,
                order_date DATE NOT NULL,
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Таблица позиций заказа
        this.db.run(`
            CREATE TABLE IF NOT EXISTS order_items (
                id TEXT PRIMARY KEY,
                order_id TEXT NOT NULL,
                product_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id)
            )
        `);
    }

    // Методы для работы с товарами
    async getProducts() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM products', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async updateProductQuantity(productId, change) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE products SET quantity = quantity + ? WHERE id = ?',
                [change, productId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    async getProductById(productId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM products WHERE id = ?', [productId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    // Методы для работы с заказами
    async createOrder(order) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO orders (id, customer_name, order_date) VALUES (?, ?, ?)',
                [order.id, order.customer_name, order.order_date],
                function(err) {
                    if (err) reject(err);
                    else resolve(order.id);
                }
            );
        });
    }

    async getOrders(date = null) {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM orders WHERE status = "active"';
            let params = [];
            
            if (date) {
                query += ' AND order_date >= ?';
                params.push(date);
            } else {
                query += ' AND order_date >= date("now")';
            }
            
            query += ' ORDER BY order_date';
            
            this.db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async updateOrder(orderId, updates) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE orders SET customer_name = ?, order_date = ? WHERE id = ?',
                [updates.customer_name, updates.order_date, orderId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    async deleteOrder(orderId) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM orders WHERE id = ?', [orderId], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    async getOrdersByDate(date) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM orders WHERE order_date = ? AND status = "active"',
                [date],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async shipOrders(date) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE orders SET status = "shipped" WHERE order_date = ? AND status = "active"',
                [date],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    // Методы для работы с позициями заказа
    async createOrderItem(item) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO order_items (id, order_id, product_id, quantity) VALUES (?, ?, ?, ?)',
                [item.id, item.order_id, item.product_id, item.quantity],
                function(err) {
                    if (err) reject(err);
                    else resolve(item.id);
                }
            );
        });
    }

    async getOrderItems(orderId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT oi.*, p.name as product_name 
                 FROM order_items oi 
                 JOIN products p ON oi.product_id = p.id 
                 WHERE oi.order_id = ?`,
                [orderId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async updateOrderItem(itemId, quantity) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE order_items SET quantity = ? WHERE id = ?',
                [quantity, itemId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    async deleteOrderItem(itemId) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM order_items WHERE id = ?', [itemId], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    async moveOrderItem(itemId, newOrderId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE order_items SET order_id = ? WHERE id = ?',
                [newOrderId, itemId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    async getOrderItemWithProduct(itemId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT oi.*, p.quantity as available_quantity 
                 FROM order_items oi 
                 JOIN products p ON oi.product_id = p.id 
                 WHERE oi.id = ?`,
                [itemId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    // Удалить устаревшие заказы
    async cleanupExpiredOrders() {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM orders WHERE order_date < date("now") AND status = "active"',
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    // Добавить случайные товары (моделирование поставки)
    async addRandomStock() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT id FROM products', (err, products) => {
                if (err) {
                    reject(err);
                    return;
                }

                const updates = products.map(product => {
                    const randomIncrease = Math.floor(Math.random() * 50) + 10;
                    return new Promise((res, rej) => {
                        this.db.run(
                            'UPDATE products SET quantity = quantity + ? WHERE id = ?',
                            [randomIncrease, product.id],
                            function(updateErr) {
                                if (updateErr) rej(updateErr);
                                else res();
                            }
                        );
                    });
                });

                Promise.all(updates)
                    .then(() => resolve(products.length))
                    .catch(reject);
            });
        });
    }

    close() {
        this.db.close();
    }
}

module.exports = Database;