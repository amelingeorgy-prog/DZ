const Database = require('./database');
const db = new Database();

async function initializeDatabase() {
    try {
        // Очистка старых данных
        await db.cleanupExpiredOrders();
        
        // Добавление начальных товаров
        const initialProducts = [
            { name: 'Ноутбук Dell XPS 13', quantity: 15 },
            { name: 'Мышь Logitech MX Master 3', quantity: 45 },
            { name: 'Клавиатура Keychron K8', quantity: 22 },
            { name: 'Монитор Samsung 27"', quantity: 18 },
            { name: 'Наушники Sony WH-1000XM4', quantity: 30 },
            { name: 'Внешний жесткий диск 1TB', quantity: 25 },
            { name: 'USB-C кабель', quantity: 100 },
            { name: 'Роутер TP-Link Archer AX50', quantity: 12 },
            { name: 'Веб-камера Logitech C920', quantity: 20 },
            { name: 'Док-станция Thunderbolt', quantity: 8 }
        ];

        // Очищаем и добавляем товары
        db.db.run('DELETE FROM products', async (err) => {
            if (err) {
                console.error('Ошибка очистки товаров:', err);
                return;
            }

            for (const product of initialProducts) {
                await new Promise((resolve, reject) => {
                    db.db.run(
                        'INSERT INTO products (name, quantity) VALUES (?, ?)',
                        [product.name, product.quantity],
                        function(err) {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }

            console.log('База данных инициализирована с начальными данными');
            db.close();
        });
    } catch (error) {
        console.error('Ошибка инициализации базы данных:', error);
    }
}

initializeDatabase();