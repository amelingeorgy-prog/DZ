class WarehouseApp {
    constructor() {
        this.apiBaseUrl = 'http://localhost:3000/api';
        this.currentDate = null;
        this.orders = [];
        this.products = [];
        this.currentOrderId = null;
        this.currentItemId = null;
        
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadCurrentDate();
        await this.loadProducts();
        await this.loadOrders();
    }

    bindEvents() {
        // Кнопки управления
        document.getElementById('next-day-btn').addEventListener('click', () => this.nextDay());
        document.getElementById('add-order-btn').addEventListener('click', () => this.openOrderModal());
        
        // Модальные окна
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => this.closeModals());
        });
        
        document.getElementById('cancel-order-btn').addEventListener('click', () => this.closeModals());
        document.getElementById('cancel-item-btn').addEventListener('click', () => this.closeModals());
        document.getElementById('cancel-move-btn').addEventListener('click', () => this.closeModals());
        
        // Формы
        document.getElementById('order-form').addEventListener('submit', (e) => this.handleOrderSubmit(e));
        document.getElementById('item-form').addEventListener('submit', (e) => this.handleItemSubmit(e));
        document.getElementById('move-form').addEventListener('submit', (e) => this.handleMoveSubmit(e));
        
        // Закрытие модальных окон при клике вне
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModals();
            }
        });
    }

    async loadCurrentDate() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/current-date`);
            const data = await response.json();
            this.currentDate = data.currentDate;
            document.getElementById('current-date-display').textContent = 
                `Текущая дата: ${new Date(this.currentDate).toLocaleDateString('ru-RU')}`;
            
            // Устанавливаем минимальную дату для формы заказа
            document.getElementById('order-date').min = this.currentDate;
        } catch (error) {
            this.showNotification('Ошибка загрузки даты', 'error');
        }
    }

    async loadProducts() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/products`);
            this.products = await response.json();
            this.renderProducts();
            this.populateProductSelect();
        } catch (error) {
            this.showNotification('Ошибка загрузки товаров', 'error');
        }
    }

    async loadOrders() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/orders`);
            this.orders = await response.json();
            this.renderOrders();
            this.populateOrderSelect();
        } catch (error) {
            this.showNotification('Ошибка загрузки заказов', 'error');
        }
    }

    async nextDay() {
        if (!confirm('Перейти на следующий день? Все заказы на сегодня будут отгружены.')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/next-day`, {
                method: 'POST'
            });
            const result = await response.json();
            
            if (result.success) {
                this.showNotification(result.message, 'success');
                await this.loadCurrentDate();
                await this.loadProducts();
                await this.loadOrders();
            }
        } catch (error) {
            this.showNotification('Ошибка при переходе на следующий день', 'error');
        }
    }

    renderProducts() {
        const container = document.getElementById('products-list');
        container.innerHTML = this.products.map(product => `
            <div class="product-card">
                <div class="product-info">
                    <h4>${product.name}</h4>
                    <div>ID: ${product.id}</div>
                </div>
                <div class="product-quantity">
                    ${product.quantity} шт.
                </div>
            </div>
        `).join('');
    }

    renderOrders() {
        const container = document.getElementById('orders-list');
        
        if (this.orders.length === 0) {
            container.innerHTML = '<div class="order-card"><p>Нет активных заказов</p></div>';
            return;
        }

        container.innerHTML = this.orders.map(order => `
            <div class="order-card" data-order-id="${order.id}">
                <div class="order-header">
                    <div class="order-info">
                        <h4>Заказ #${order.id}</h4>
                        <p><strong>Заказчик:</strong> ${order.customer_name}</p>
                        <p><strong>Дата:</strong> ${new Date(order.order_date).toLocaleDateString('ru-RU')}</p>
                    </div>
                    <div class="order-actions">
                        <button class="btn btn-warning edit-order-btn" data-id="${order.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger delete-order-btn" data-id="${order.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="order-items">
                    <h5>Позиции заказа:</h5>
                    ${order.items && order.items.length > 0 ? 
                        order.items.map(item => `
                            <div class="item-row" data-item-id="${item.id}">
                                <div class="item-info">
                                    <strong>${item.product_name}</strong>
                                    <div>${item.quantity} шт. (ID: ${item.id})</div>
                                </div>
                                <div class="item-actions">
                                    <button class="btn btn-warning btn-sm edit-item-btn" 
                                            data-order-id="${order.id}" 
                                            data-item-id="${item.id}">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn btn-danger btn-sm delete-item-btn"
                                            data-order-id="${order.id}"
                                            data-item-id="${item.id}">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                    <button class="btn btn-primary btn-sm move-item-btn"
                                            data-order-id="${order.id}"
                                            data-item-id="${item.id}">
                                        <i class="fas fa-exchange-alt"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('') : 
                        '<p>Нет позиций</p>'
                    }
                    <button class="btn btn-secondary add-item-btn" data-order-id="${order.id}">
                        <i class="fas fa-plus"></i> Добавить позицию
                    </button>
                </div>
            </div>
        `).join('');

        // Привязка обработчиков событий
        this.bindOrderEvents();
    }

    bindOrderEvents() {
        // Редактирование заказа
        document.querySelectorAll('.edit-order-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const orderId = btn.dataset.id;
                this.openOrderModal(orderId);
            });
        });

        // Удаление заказа
        document.querySelectorAll('.delete-order-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const orderId = btn.dataset.id;
                if (confirm('Удалить этот заказ?')) {
                    await this.deleteOrder(orderId);
                }
            });
        });

        // Добавление позиции
        document.querySelectorAll('.add-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const orderId = btn.dataset.orderId;
                this.openItemModal(orderId);
            });
        });

        // Редактирование позиции
        document.querySelectorAll('.edit-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const orderId = btn.dataset.orderId;
                const itemId = btn.dataset.itemId;
                this.openItemModal(orderId, itemId);
            });
        });

        // Удаление позиции
        document.querySelectorAll('.delete-item-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const orderId = btn.dataset.orderId;
                const itemId = btn.dataset.itemId;
                if (confirm('Удалить эту позицию?')) {
                    await this.deleteOrderItem(orderId, itemId);
                }
            });
        });

        // Перемещение позиции
        document.querySelectorAll('.move-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const orderId = btn.dataset.orderId;
                const itemId = btn.dataset.itemId;
                this.openMoveModal(orderId, itemId);
            });
        });
    }

    populateProductSelect() {
        const select = document.getElementById('product-select');
        select.innerHTML = this.products.map(product => 
            `<option value="${product.id}">${product.name} (доступно: ${product.quantity})</option>`
        ).join('');
    }

    populateOrderSelect() {
        const select = document.getElementById('order-select');
        select.innerHTML = this.orders.map(order => 
            `<option value="${order.id}">Заказ #${order.id} - ${order.customer_name}</option>`
        ).join('');
    }

    openOrderModal(orderId = null) {
        const modal = document.getElementById('order-modal');
        const form = document.getElementById('order-form');
        const title = document.getElementById('modal-title');
        
        if (orderId) {
            // Редактирование существующего заказа
            const order = this.orders.find(o => o.id === orderId);
            if (order) {
                document.getElementById('order-id').value = order.id;
                document.getElementById('customer-name').value = order.customer_name;
                document.getElementById('order-date').value = order.order_date;
                title.textContent = 'Редактировать заказ';
                this.currentOrderId = orderId;
            }
        } else {
            // Новый заказ
            form.reset();
            document.getElementById('order-id').value = '';
            document.getElementById('order-date').value = this.currentDate;
            title.textContent = 'Новый заказ';
            this.currentOrderId = null;
        }
        
        modal.style.display = 'block';
    }

    openItemModal(orderId, itemId = null) {
        const modal = document.getElementById('item-modal');
        const form = document.getElementById('item-form');
        
        form.reset();
        document.getElementById('item-order-id').value = orderId;
        
        if (itemId) {
            // Редактирование существующей позиции
            const order = this.orders.find(o => o.id === orderId);
            if (order && order.items) {
                const item = order.items.find(i => i.id === itemId);
                if (item) {
                    document.getElementById('item-id').value = item.id;
                    document.getElementById('product-select').value = item.product_id;
                    document.getElementById('item-quantity').value = item.quantity;
                    this.currentItemId = itemId;
                }
            }
        } else {
            document.getElementById('item-id').value = '';
            this.currentItemId = null;
        }
        
        modal.style.display = 'block';
    }

    openMoveModal(orderId, itemId) {
        const modal = document.getElementById('move-modal');
        document.getElementById('move-item-id').value = itemId;
        
        // Убираем текущий заказ из списка
        const select = document.getElementById('order-select');
        select.innerHTML = this.orders
            .filter(order => order.id !== orderId)
            .map(order => 
                `<option value="${order.id}">Заказ #${order.id} - ${order.customer_name}</option>`
            ).join('');
        
        modal.style.display = 'block';
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        document.getElementById('order-form').reset();
        document.getElementById('item-form').reset();
        document.getElementById('move-form').reset();
    }

    async handleOrderSubmit(e) {
        e.preventDefault();
        
        const orderId = document.getElementById('order-id').value;
        const customerName = document.getElementById('customer-name').value;
        const orderDate = document.getElementById('order-date').value;
        
        try {
            if (orderId) {
                // Обновление заказа
                await fetch(`${this.apiBaseUrl}/orders/${orderId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        customer_name: customerName,
                        order_date: orderDate
                    })
                });
                this.showNotification('Заказ обновлен', 'success');
            } else {
                // Создание нового заказа
                await fetch(`${this.apiBaseUrl}/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        customer_name: customerName,
                        order_date: orderDate
                    })
                });
                this.showNotification('Заказ создан', 'success');
            }
            
            this.closeModals();
            await this.loadOrders();
        } catch (error) {
            this.showNotification('Ошибка сохранения заказа', 'error');
        }
    }

    async handleItemSubmit(e) {
        e.preventDefault();
        
        const itemId = document.getElementById('item-id').value;
        const orderId = document.getElementById('item-order-id').value;
        const productId = document.getElementById('product-select').value;
        const quantity = parseInt(document.getElementById('item-quantity').value);
        
        try {
            let response;
            if (itemId) {
                // Обновление позиции
                response = await fetch(`${this.apiBaseUrl}/orders/${orderId}/items/${itemId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ quantity })
                });
            } else {
                // Создание новой позиции
                response = await fetch(`${this.apiBaseUrl}/orders/${orderId}/items`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        product_id: parseInt(productId),
                        quantity
                    })
                });
            }
            
            // ВАЖНО: Проверяем статус ответа
            if (!response.ok) {
                throw new Error('Ошибка сохранения позиции');
            }
            
            // Только если ответ успешный (status 2xx)
            this.showNotification(itemId ? 'Позиция обновлена' : 'Позиция добавлена', 'success');
            this.closeModals();
            await this.loadProducts();
            await this.loadOrders();
        } catch (error) {
            // Показываем ошибку, которую получили от сервера
            this.showNotification(error.message, 'error');
        }
    }

    async handleMoveSubmit(e) {
        e.preventDefault();
        
        const itemId = document.getElementById('move-item-id').value;
        const newOrderId = document.getElementById('order-select').value;
        
        try {
            await fetch(`${this.apiBaseUrl}/items/${itemId}/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_order_id: newOrderId })
            });
            
            this.showNotification('Позиция перемещена', 'success');
            this.closeModals();
            await this.loadOrders();
        } catch (error) {
            this.showNotification('Ошибка перемещения позиции', 'error');
        }
    }

    async deleteOrder(orderId) {
        try {
            await fetch(`${this.apiBaseUrl}/orders/${orderId}`, {
                method: 'DELETE'
            });
            
            this.showNotification('Заказ удален', 'success');
            await this.loadProducts();
            await this.loadOrders();
        } catch (error) {
            this.showNotification('Ошибка удаления заказа', 'error');
        }
    }

    async deleteOrderItem(orderId, itemId) {
        try {
            await fetch(`${this.apiBaseUrl}/orders/${orderId}/items/${itemId}`, {
                method: 'DELETE'
            });
            
            this.showNotification('Позиция удалена', 'success');
            await this.loadProducts();
            await this.loadOrders();
        } catch (error) {
            this.showNotification('Ошибка удаления позиции', 'error');
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Инициализация приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new WarehouseApp();
});