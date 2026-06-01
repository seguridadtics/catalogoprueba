document.addEventListener('DOMContentLoaded', () => {
    const productsGrid = document.getElementById('productsGrid');
    const searchInput = document.getElementById('searchInput');
    const categoryFilters = document.getElementById('categoryFilters');
    const cartToggle = document.getElementById('cartToggle');
    const themeToggle = document.getElementById('themeToggle');
    
    // Elementos del carrito
    const cartOverlay = document.getElementById('cartOverlay');
    const cartSidebar = document.getElementById('cartSidebar');
    const closeCartBtn = document.getElementById('closeCart');
    const cartItemsContainer = document.getElementById('cartItems');
    const cartTotalValue = document.getElementById('cartTotalValue');
    const cartBadge = document.getElementById('cartBadge');
    const checkoutBtn = document.getElementById('checkoutBtn');
    
    // Elementos del formulario del cliente
    const customerName = document.getElementById('customerName');
    const customerID = document.getElementById('customerID');
    const customerPhone = document.getElementById('customerPhone');
    const customerAddress = document.getElementById('customerAddress');
    
    // Mejoras UX
    const toast = document.getElementById('toast');
    const floatingWhatsApp = document.getElementById('floatingWhatsApp');

    let allProducts = [];
    let currentFilteredProducts = []; // Productos después de aplicar filtros
    let configData = {}; // Variable para guardar la configuración
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    
    // Variables para Paginación (Mejora de rendimiento para >500 productos)
    let currentPage = 1;
    const itemsPerPage = 24;

    // --- 1. Lógica del Modo Claro/Oscuro ---
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon(currentTheme);

    themeToggle.addEventListener('click', () => {
        let theme = document.documentElement.getAttribute('data-theme');
        let newTheme = theme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });

    function updateThemeIcon(theme) {
        const icon = themeToggle.querySelector('i');
        if (theme === 'dark') {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }

    // --- 2. Carga de Datos desde JSON (Productos y Configuración) ---
    // Usamos getTime() para evitar que el navegador guarde los archivos en caché y siempre muestre los nuevos productos
    const cacheBuster = new Date().getTime();
    
    Promise.all([
        fetch(`config.json?v=${cacheBuster}`).then(res => {
            if (!res.ok) throw new Error('No se pudo cargar config.json');
            return res.json();
        }),
        fetch(`productos.json?v=${cacheBuster}`).then(res => {
            if (!res.ok) throw new Error('No se pudo cargar productos.json');
            return res.json();
        })
    ])
    .then(([config, products]) => {
        configData = config;
        allProducts = products;
        currentFilteredProducts = [...allProducts];

        // Actualizar el nombre de la tienda en el HTML usando la configuración
        if (configData.nombre_tienda) {
            document.title = configData.nombre_tienda;
            const logo = document.querySelector('.logo h1');
            if (logo) logo.innerHTML = `${configData.nombre_tienda}<span>.</span>`;
        }

        // Configurar botón flotante de WhatsApp
        if (configData.whatsapp) {
            floatingWhatsApp.href = `https://wa.me/${configData.whatsapp}?text=¡Hola! Necesito ayuda con los productos de ${configData.nombre_tienda || 'su catálogo'}.`;
        }

        renderProducts(currentFilteredProducts, true);
        generateCategoryButtons(allProducts);
        updateCartUI(); // Cargar carrito al iniciar
    })
    .catch(error => {
        console.error('Error cargando los archivos JSON:', error);
        productsGrid.innerHTML = `
            <div class="no-results">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: #ef4444; margin-bottom: 1rem; display: block;"></i>
                No se pudieron cargar los datos.<br>
                <small>Asegúrate de ejecutar esto en un servidor local y que <b>productos.json</b> y <b>config.json</b> existan.</small>
            </div>`;
    });

    // --- 3. Renderizado de Productos ---
    function renderProducts(products, reset = true) {
        if (reset) {
            productsGrid.innerHTML = '';
            currentPage = 1;
        }

        if (products.length === 0 && reset) {
            productsGrid.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-box-open" style="font-size: 2rem; margin-bottom: 1rem; display: block; opacity: 0.5;"></i>
                    No se encontraron productos que coincidan con tu búsqueda.
                </div>`;
            return;
        }

        // Paginación
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const productsToRender = products.slice(startIndex, endIndex);

        productsToRender.forEach((product, index) => {
            const card = document.createElement('div');
            card.classList.add('product-card');
            
            // Animación escalonada
            card.style.animationDelay = `${(index % itemsPerPage) * 0.05}s`;

            // Imagen con fallback por si no existe
            const imgSrc = product.imagen ? product.imagen : 'https://placehold.co/400x400/eeeeee/999999?text=Sin+Imagen';

            card.innerHTML = `
                <div class="product-image-container">
                    <span class="product-category">${product.categoria}</span>
                    <img src="${imgSrc}" loading="lazy" alt="${product.nombre}" class="product-image" onerror="this.onerror=null;this.src='https://placehold.co/400x400/eeeeee/999999?text=Sin+Imagen';">
                </div>
                <div class="product-info">
                    <span class="product-code">#${product.codigo}</span>
                    <h3 class="product-name">${product.nombre}</h3>
                </div>
                <div class="product-footer">
                    <div class="product-price"><span>$</span>${product.precio.toFixed(2)}</div>
                    <button class="btn-buy" aria-label="Comprar ${product.nombre}">
                        <i class="fas fa-shopping-bag"></i> Comprar
                    </button>
                </div>
            `;
            
            // Evento para añadir al carrito
            const buyBtn = card.querySelector('.btn-buy');
            buyBtn.addEventListener('click', () => addToCart(product));

            productsGrid.appendChild(card);
        });

        manageLoadMoreButton(products);
    }

    function manageLoadMoreButton(products) {
        const existingBtn = document.getElementById('loadMoreBtnContainer');
        if (existingBtn) {
            existingBtn.remove();
        }

        if (currentPage * itemsPerPage < products.length) {
            const btnContainer = document.createElement('div');
            btnContainer.id = 'loadMoreBtnContainer';
            btnContainer.style.gridColumn = '1 / -1';
            btnContainer.style.textAlign = 'center';
            btnContainer.style.marginTop = '2rem';

            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.classList.add('filter-btn');
            loadMoreBtn.style.padding = '0.8rem 2rem';
            loadMoreBtn.style.fontSize = '1rem';
            loadMoreBtn.style.background = 'var(--accent-color)';
            loadMoreBtn.style.color = 'white';
            loadMoreBtn.style.cursor = 'pointer';
            loadMoreBtn.textContent = 'Cargar más productos';
            
            loadMoreBtn.addEventListener('click', () => {
                currentPage++;
                renderProducts(currentFilteredProducts, false); // Añadir sin limpiar
            });

            btnContainer.appendChild(loadMoreBtn);
            productsGrid.appendChild(btnContainer);
        }
    }

    // --- 4. Generación de Botones de Categoría Dinámicos ---
    function generateCategoryButtons(products) {
        // Extraer categorías únicas
        const categories = ['Todos', ...new Set(products.map(p => p.categoria))];
        
        categoryFilters.innerHTML = ''; // Limpiar

        categories.forEach(category => {
            const btn = document.createElement('button');
            btn.classList.add('filter-btn');
            if (category === 'Todos') btn.classList.add('active');
            
            btn.dataset.category = category;
            btn.textContent = category;
            
            btn.addEventListener('click', () => {
                // Actualizar estado activo
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Filtrar
                filterProducts();
            });

            categoryFilters.appendChild(btn);
        });
    }

    // --- 5. Lógica de Filtrado (Búsqueda + Categoría) ---
    function filterProducts() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const activeCategoryBtn = document.querySelector('.filter-btn.active');
        const activeCategory = activeCategoryBtn ? activeCategoryBtn.dataset.category : 'Todos';

        currentFilteredProducts = allProducts.filter(product => {
            // Coincidencia de texto (nombre o descripción)
            const matchesSearch = product.nombre.toLowerCase().includes(searchTerm);
            
            // Coincidencia de categoría
            const matchesCategory = activeCategory === 'Todos' || product.categoria === activeCategory;
            
            return matchesSearch && matchesCategory;
        });

        renderProducts(currentFilteredProducts, true); // true = reset grid y paginación
    }

    // Event listeners para la búsqueda en tiempo real
    searchInput.addEventListener('input', filterProducts);

    // --- 6. Lógica del Carrito de Compras ---
    function openCart() {
        cartOverlay.classList.add('active');
        cartSidebar.classList.add('active');
    }

    function closeCart() {
        cartOverlay.classList.remove('active');
        cartSidebar.classList.remove('active');
    }

    cartToggle.addEventListener('click', openCart);
    closeCartBtn.addEventListener('click', closeCart);
    cartOverlay.addEventListener('click', closeCart);

    function addToCart(product) {
        const existingItem = cart.find(item => item.id === product.id);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({ ...product, quantity: 1 });
        }
        saveCart();
        updateCartUI();
        showToast(`<i class="fas fa-check-circle" style="color: #4ade80;"></i> ${product.nombre} añadido`);
    }

    function showToast(message) {
        toast.innerHTML = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2500);
    }

    function removeFromCart(productId) {
        cart = cart.filter(item => item.id !== productId);
        saveCart();
        updateCartUI();
    }

    function changeQuantity(productId, delta) {
        const item = cart.find(i => i.id === productId);
        if (item) {
            item.quantity += delta;
            if (item.quantity <= 0) {
                removeFromCart(productId);
            } else {
                saveCart();
                updateCartUI();
            }
        }
    }

    function saveCart() {
        localStorage.setItem('cart', JSON.stringify(cart));
    }

    function updateCartUI() {
        // Actualizar el número del icono del carrito
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartBadge.textContent = totalItems;

        // Limpiar items
        cartItemsContainer.innerHTML = '';
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<div style="text-align:center; opacity:0.5; margin-top:2rem;">Tu carrito está vacío</div>';
        } else {
            // Renderizar items del carrito
            cart.forEach(item => {
                const div = document.createElement('div');
                div.classList.add('cart-item');
                
                const imgSrc = item.imagen ? item.imagen : 'https://placehold.co/400x400/eeeeee/999999?text=Sin+Imagen';

                div.innerHTML = `
                    <img src="${imgSrc}" class="cart-item-img" alt="${item.nombre}" onerror="this.onerror=null;this.src='https://placehold.co/400x400/eeeeee/999999?text=Sin+Imagen';">
                    <div class="cart-item-info">
                        <div class="cart-item-title">${item.nombre}</div>
                        <div class="cart-item-price">$${item.precio.toFixed(2)}</div>
                        <div class="cart-item-actions">
                            <button class="qty-btn minus" data-id="${item.id}">-</button>
                            <span>${item.quantity}</span>
                            <button class="qty-btn plus" data-id="${item.id}">+</button>
                        </div>
                    </div>
                    <button class="cart-item-remove" data-id="${item.id}"><i class="fas fa-trash"></i></button>
                `;
                cartItemsContainer.appendChild(div);
            });

            // Asignar eventos a los botones de + y - y eliminar
            cartItemsContainer.querySelectorAll('.minus').forEach(btn => {
                btn.addEventListener('click', (e) => changeQuantity(parseInt(e.target.dataset.id), -1));
            });
            cartItemsContainer.querySelectorAll('.plus').forEach(btn => {
                btn.addEventListener('click', (e) => changeQuantity(parseInt(e.target.dataset.id), 1));
            });
            cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => {
                btn.addEventListener('click', (e) => removeFromCart(parseInt(e.currentTarget.dataset.id)));
            });
        }

        // Actualizar el total monetario
        const total = cart.reduce((sum, item) => sum + (item.precio * item.quantity), 0);
        cartTotalValue.textContent = total.toFixed(2);
    }

    // --- 7. Enviar Pedido (Checkout por WhatsApp) ---
    checkoutBtn.addEventListener('click', () => {
        if (cart.length === 0) {
            alert('Agrega productos al carrito primero.');
            return;
        }

        const name = customerName.value.trim();
        const cedula = customerID.value.trim();
        const phone = customerPhone.value.trim();
        const address = customerAddress.value.trim();

        if (!name || !cedula || !phone) {
            alert('Por favor, llena tus datos obligatorios (Nombre, Cédula y Teléfono) para enviar el pedido.');
            return;
        }

        // Leer el número desde config.json, si no existe usa un fallback
        const phoneNumber = configData.whatsapp || '1234567890'; 
        const saludo = configData.mensaje_saludo || '¡Hola! Me gustaría hacer un pedido.';

        let message = `${saludo}%0A%0A`;
        message += `*Datos del Cliente:*%0A`;
        message += `- Nombre: ${name}%0A`;
        message += `- Cédula: ${cedula}%0A`;
        message += `- Teléfono: ${phone}%0A`;
        if (address) {
            message += `- Dirección/Notas: ${address}%0A`;
        }
        message += `%0A*Detalle del Pedido:*%0A`;
        
        cart.forEach(item => {
            // Se incluye el código de forma limpia para que el cliente lo vea normal
            // Y el sistema Django lo pueda extraer fácilmente
            message += `- ${item.quantity}x ${item.nombre} (CÓD: ${item.codigo}) [$${(item.precio * item.quantity).toFixed(2)}]%0A`;
        });
        
        const total = cart.reduce((sum, item) => sum + (item.precio * item.quantity), 0);
        message += `%0A*Total a Pagar: $${total.toFixed(2)}*`;

        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
        window.open(whatsappUrl, '_blank');

        // Vaciar el carrito después de enviar
        cart = [];
        saveCart();
        updateCartUI();
        
        // Limpiar el formulario
        customerName.value = '';
        customerID.value = '';
        customerPhone.value = '';
        customerAddress.value = '';

        closeCart();
        showToast(`<i class="fas fa-check-circle" style="color: #4ade80;"></i> Pedido procesado`);
    });

});
